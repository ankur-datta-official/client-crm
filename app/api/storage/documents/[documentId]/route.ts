import { NextResponse } from "next/server";
import { requireOrganization, requirePermission } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  isLocalStoredFilePath,
  readPrivateUpload,
} from "@/lib/storage/local";

export const runtime = "nodejs";

type DocumentFileRow = {
  id: string;
  organization_id: string;
  company_id: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await context.params;
  await requirePermission("documents.view");
  const organization = await requireOrganization();
  const url = new URL(request.url);
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";

  if (disposition === "attachment") {
    await requirePermission("documents.download");
  }

  const documents = await prisma.$queryRaw<DocumentFileRow[]>`
    select
      id::text as id,
      organization_id::text as organization_id,
      company_id::text as company_id,
      file_path,
      file_name,
      mime_type
    from public.documents
    where id = ${documentId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;
  const document = documents[0] ?? null;

  if (!document?.file_path) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (!isLocalStoredFilePath(document.file_path)) {
    return NextResponse.json({ error: "Document file is missing." }, { status: 404 });
  }

  try {
    const file = await readPrivateUpload(document.file_path);

    return new NextResponse(file.content, {
      headers: {
        "Content-Type": document.mime_type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(document.file_name || "document")}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (readError) {
    logServerError("storage.document.read", readError, {
      documentId,
      filePath: document.file_path,
    });
    return NextResponse.json({ error: "Document file is missing." }, { status: 404 });
  }
}
