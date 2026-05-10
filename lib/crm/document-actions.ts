"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, requireOrganization, requirePermission } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import {
  buildStorageRouteUrl,
  buildDocumentStoredPath,
  isLocalStoredFilePath,
  removePrivateUpload,
  savePrivateUpload,
  validateUploadMetadata,
  validateUploadSize,
} from "@/lib/storage/local";
import { prisma } from "@/lib/prisma";
import { documentSchema } from "@/lib/crm/schemas";
import { createWorkspaceNotification } from "@/lib/notifications/notifications";

async function insertActivityLog(action: string, entityType: string, entityId: string, metadata: Record<string, any> = {}) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  await prisma.$executeRaw`
    insert into public.activity_logs (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      ${organization.id}::uuid,
      ${user.id}::uuid,
      ${action},
      ${entityType},
      ${entityId}::uuid,
      ${JSON.stringify(metadata)}::jsonb
    )
  `;
}

export type DocumentActionState = {
  ok: boolean;
  error?: string;
  id?: string;
  fieldErrors?: Record<string, string>;
};

type AccessibleDocumentFile = {
  id: string;
  organization_id: string;
  company_id: string;
  file_path: string;
  file_name: string;
  file_size_mb: number | null;
  mime_type: string | null;
  file_extension: string | null;
};

function getValidationFailure(error: z.ZodError): DocumentActionState {
  return {
    ok: false,
    error: error.errors[0]?.message ?? "Please check the form and try again.",
    fieldErrors: Object.fromEntries(error.errors.map((issue) => [String(issue.path[0]), issue.message])),
  };
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .trim();

  const fallback = cleaned || "document";
  return fallback.slice(0, 120);
}

function getStorageErrorMessage(error: { message?: string; statusCode?: string | number } | null | undefined) {
  const rawMessage = error?.message?.toLowerCase() ?? "";
  const statusCode = String(error?.statusCode ?? "");

  if (rawMessage.includes("bucket not found") || rawMessage.includes("not found") || statusCode === "404") {
    return "Storage bucket not found. Please create crm-documents bucket.";
  }

  if (rawMessage.includes("row-level security") || rawMessage.includes("permission denied") || rawMessage.includes("unauthorized") || statusCode === "403" || statusCode === "401") {
    return "You do not have permission to upload this document.";
  }

  if (rawMessage.includes("already exists") || rawMessage.includes("duplicate")) {
    return "A file with the same name already exists in this upload path. Please rename the file and try again.";
  }

  if (rawMessage.includes("invalid") || rawMessage.includes("path")) {
    return "Upload failed. Please try again.";
  }

  return "Upload failed. Please try again.";
}

async function cleanupUploadedFile(filePath: string) {
  if (!isLocalStoredFilePath(filePath)) {
    return;
  }

  try {
    await removePrivateUpload(filePath);
  } catch (error) {
    logServerError("document.upload.cleanup_failed", error, { filePath });
  }
}

async function validateDocumentOwnership(documentId: string): Promise<{ organization: Awaited<ReturnType<typeof requireOrganization>>; document: AccessibleDocumentFile }> {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<AccessibleDocumentFile[]>`
    select
      id::text as id,
      organization_id::text as organization_id,
      company_id::text as company_id,
      file_path,
      file_name,
      file_size_mb,
      mime_type,
      file_extension
    from public.documents
    where id = ${documentId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const document = rows[0] ?? null;
  if (!document) {
    throw new Error("Document not found or access denied.");
  }

  return { organization, document };
}

async function createSignedDocumentUrl(documentId: string, expiresInSeconds = 900) {
  await requireAuth();
  const { document } = await validateDocumentOwnership(documentId);

  if (!document.file_path) {
    throw new Error("This document is missing its stored file path.");
  }

  return {
    signedUrl: buildStorageRouteUrl(`/api/storage/documents/${documentId}`),
    fileName: document.file_name,
    mimeType: document.mime_type,
    fileExtension: document.file_extension,
    fileSizeMb: document.file_size_mb,
  };
}

export async function createDocument(formData: FormData): Promise<DocumentActionState> {
  await requirePermission("documents.upload");
  const user = await requireAuth();
  const organization = await requireOrganization();

  const maybeFile = formData.get("file");
  const file = maybeFile instanceof File ? maybeFile : null;
  if (!file || file.size <= 0) return { ok: false, error: "File is required." };

  const hardSizeValidation = validateUploadSize(file.size);
  if (!hardSizeValidation.ok) {
    return { ok: false, error: hardSizeValidation.message };
  }

  const uploadMetadataValidation = validateUploadMetadata(file);
  if (!uploadMetadataValidation.ok) {
    return { ok: false, error: uploadMetadataValidation.message };
  }

  const rawValues = Object.fromEntries(formData.entries());
  const validated = documentSchema.safeParse(rawValues);

  if (!validated.success) {
    return getValidationFailure(validated.error);
  }

  const documentId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(file.name);
  const fileExtension = uploadMetadataValidation.extension ?? null;
  const filePath = buildDocumentStoredPath(organization.id, validated.data.company_id, documentId, safeFileName);

  try {
    await savePrivateUpload(filePath, file);
  } catch (uploadError) {
    logServerError("document.upload.storage", uploadError, {
      organizationId: organization.id,
      companyId: validated.data.company_id,
      documentId,
      filePath,
      fileName: file.name,
      fileSize: file.size,
    });
    return { ok: false, error: getStorageErrorMessage(null) };
  }

  try {
    await prisma.$executeRaw`
      insert into public.documents (
        id,
        organization_id,
        company_id,
        contact_person_id,
        interaction_id,
        followup_id,
        document_type,
        title,
        description,
        file_name,
        file_path,
        file_size_mb,
        mime_type,
        file_extension,
        status,
        submitted_to,
        submitted_at,
        expiry_date,
        remarks,
        uploaded_by,
        created_by,
        updated_by
      )
      values (
        ${documentId}::uuid,
        ${organization.id}::uuid,
        ${validated.data.company_id}::uuid,
        ${validated.data.contact_person_id}::uuid,
        ${validated.data.interaction_id}::uuid,
        ${validated.data.followup_id}::uuid,
        ${validated.data.document_type},
        ${validated.data.title},
        ${validated.data.description},
        ${safeFileName},
        ${filePath},
        ${Number((file.size / (1024 * 1024)).toFixed(2))},
        ${file.type},
        ${fileExtension},
        ${validated.data.status},
        ${validated.data.submitted_to},
        ${validated.data.submitted_at}::date,
        ${validated.data.expiry_date}::date,
        ${validated.data.remarks},
        ${user.id}::uuid,
        ${user.id}::uuid,
        ${user.id}::uuid
      )
    `;
  } catch (dbError) {
    await cleanupUploadedFile(filePath);
    logServerError("document.upload.record", dbError, { organizationId: organization.id, documentId, companyId: validated.data.company_id });
    return { ok: false, error: getSafeErrorMessage(dbError, "The document was uploaded but could not be saved. Please try again.") };
  }

  await insertActivityLog("uploaded", "document", documentId, { title: validated.data.title });

  const companyRows = await prisma.$queryRaw<Array<{ assigned_user_id: string | null; name: string | null }>>`
    select
      assigned_user_id::text as assigned_user_id,
      name
    from public.companies
    where id = ${validated.data.company_id}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;
  const company = companyRows[0] ?? null;

  if (company?.assigned_user_id && company.assigned_user_id !== user.id) {
    await createWorkspaceNotification({
      userId: company.assigned_user_id,
      type: "document.uploaded",
      title: "New document uploaded",
      message: `A document was uploaded for ${company.name ?? "your assigned company"}: "${validated.data.title}".`,
      link: `/documents/${documentId}`,
    });
  }

  revalidatePath("/documents");
  revalidatePath(`/companies/${validated.data.company_id}`);

  return { ok: true, id: documentId };
}

export async function updateDocument(documentId: string, formData: FormData): Promise<DocumentActionState> {
  await requirePermission("documents.update");
  const user = await requireAuth();
  const { organization, document } = await validateDocumentOwnership(documentId);

  const rawValues = Object.fromEntries(formData.entries());
  const validated = documentSchema.safeParse(rawValues);

  if (!validated.success) {
    return getValidationFailure(validated.error);
  }

  const maybeFile = formData.get("file");
  const file = maybeFile instanceof File ? maybeFile : null;
  let filePath = document.file_path;
  let fileMetadata: Record<string, unknown> = {};

  if (file && file.size > 0) {
    const hardSizeValidation = validateUploadSize(file.size);
    if (!hardSizeValidation.ok) {
      return { ok: false, error: hardSizeValidation.message };
    }

    const uploadMetadataValidation = validateUploadMetadata(file);
    if (!uploadMetadataValidation.ok) {
      return { ok: false, error: uploadMetadataValidation.message };
    }

    const safeFileName = sanitizeFileName(file.name);
    const newFilePath = buildDocumentStoredPath(organization.id, validated.data.company_id, documentId, safeFileName);

    try {
      await savePrivateUpload(newFilePath, file);
    } catch (uploadError) {
      logServerError("document.update.storage", uploadError, {
        organizationId: organization.id,
        companyId: validated.data.company_id,
        documentId,
        oldFilePath: document.file_path,
        newFilePath,
        fileName: file.name,
        fileSize: file.size,
      });
      return { ok: false, error: getStorageErrorMessage(null) };
    }

    if (newFilePath !== document.file_path && isLocalStoredFilePath(document.file_path)) {
      await cleanupUploadedFile(document.file_path);
    }

    filePath = newFilePath;
    fileMetadata = {
      file_name: safeFileName,
      file_path: filePath,
      file_size_mb: Number((file.size / (1024 * 1024)).toFixed(2)),
      mime_type: file.type,
      file_extension: uploadMetadataValidation.extension ?? null,
    };

    await insertActivityLog("file_replaced", "document", documentId, { title: validated.data.title });
  }

  try {
    await prisma.$executeRaw`
      update public.documents
      set
        company_id = ${validated.data.company_id}::uuid,
        contact_person_id = ${validated.data.contact_person_id}::uuid,
        interaction_id = ${validated.data.interaction_id}::uuid,
        followup_id = ${validated.data.followup_id}::uuid,
        document_type = ${validated.data.document_type},
        title = ${validated.data.title},
        description = ${validated.data.description},
        file_name = ${String(fileMetadata.file_name ?? document.file_name)},
        file_path = ${String(fileMetadata.file_path ?? filePath)},
        file_size_mb = ${Number(fileMetadata.file_size_mb ?? document.file_size_mb ?? 0)},
        mime_type = ${String(fileMetadata.mime_type ?? document.mime_type ?? "") || null},
        file_extension = ${String(fileMetadata.file_extension ?? document.file_extension ?? "") || null},
        status = ${validated.data.status},
        submitted_to = ${validated.data.submitted_to},
        submitted_at = ${validated.data.submitted_at}::date,
        expiry_date = ${validated.data.expiry_date}::date,
        remarks = ${validated.data.remarks},
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${documentId}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (dbError) {
    logServerError("document.update.record", dbError, {
      organizationId: organization.id,
      documentId,
      companyId: validated.data.company_id,
    });
    return { ok: false, error: getSafeErrorMessage(dbError, "Unable to update this document right now.") };
  }

  await insertActivityLog("updated", "document", documentId, { title: validated.data.title });

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath(`/companies/${validated.data.company_id}`);

  return { ok: true, id: documentId };
}

export async function archiveDocument(documentId: string): Promise<DocumentActionState> {
  await requirePermission("documents.archive");
  const user = await requireAuth();
  const { organization } = await validateDocumentOwnership(documentId);

  try {
    await prisma.$executeRaw`
      update public.documents
      set
        status = 'archived',
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${documentId}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive this document right now.") };
  }

  await insertActivityLog("archived", "document", documentId);

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);

  return { ok: true };
}

export async function logDocumentDownload(documentId: string): Promise<void> {
  await requirePermission("documents.download");
  const user = await requireAuth();
  const organization = await requireOrganization();

  await prisma.$executeRaw`
    insert into public.document_download_logs (
      organization_id,
      document_id,
      downloaded_by
    )
    values (
      ${organization.id}::uuid,
      ${documentId}::uuid,
      ${user.id}::uuid
    )
  `;

  await insertActivityLog("downloaded", "document", documentId);
}

export async function getSignedDocumentDownloadUrl(documentId: string) {
  await requirePermission("documents.download");
  const document = await createSignedDocumentUrl(documentId, 900);
  if (isLocalStoredFilePath((await validateDocumentOwnership(documentId)).document.file_path)) {
    return {
      ...document,
      signedUrl: buildStorageRouteUrl(`/api/storage/documents/${documentId}?download=1`),
    };
  }

  return document;
}

export async function getSignedDocumentViewUrl(documentId: string) {
  await requirePermission("documents.view");
  return createSignedDocumentUrl(documentId, 900);
}

export async function deleteDocument(documentId: string): Promise<DocumentActionState> {
  await requirePermission("documents.archive");
  const { organization, document } = await validateDocumentOwnership(documentId);

  if (isLocalStoredFilePath(document.file_path)) {
    try {
      await removePrivateUpload(document.file_path);
    } catch (storageError) {
      logServerError("document.delete.storage", storageError, { organizationId: organization.id, documentId, filePath: document.file_path });
      return { ok: false, error: "Unable to remove the stored file. Please try again." };
    }
  }

  try {
    await prisma.$executeRaw`
      delete from public.documents
      where id = ${documentId}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (dbError) {
    return { ok: false, error: getSafeErrorMessage(dbError, "Unable to delete the document right now.") };
  }

  revalidatePath("/documents");
  revalidatePath(`/companies/${document.company_id}`);

  return { ok: true };
}
