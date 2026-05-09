"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { helpRequestSchema, helpRequestUpdateSchema } from "@/lib/crm/schemas";
import { createNotification } from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";
import type { CrmActionState } from "./actions";

type HelpRequestLookup = {
  id: string;
  company_id: string;
  organization_id: string;
  title: string | null;
  requested_by: string | null;
  assigned_to: string | null;
};

async function insertActivityLog(
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
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

function getValidationFailure(error: z.ZodError): CrmActionState {
  return {
    ok: false,
    error: error.errors[0]?.message ?? "Please check the form and try again.",
    fieldErrors: Object.fromEntries(error.errors.map((issue) => [String(issue.path[0]), issue.message])),
  };
}

async function validateHelpRequestOwnership(helpRequestId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<HelpRequestLookup[]>`
    select
      id::text as id,
      company_id::text as company_id,
      organization_id::text as organization_id,
      title,
      requested_by::text as requested_by,
      assigned_to::text as assigned_to
    from public.help_requests
    where id = ${helpRequestId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const helpRequest = rows[0] ?? null;
  if (!helpRequest) {
    throw new Error("Help request not found or access denied.");
  }

  return { organization, helpRequest };
}

export async function createHelpRequest(formData: FormData): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();

  const rawValues = Object.fromEntries(formData.entries());
  const validated = helpRequestSchema.safeParse(rawValues);

  if (!validated.success) {
    return getValidationFailure(validated.error);
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; title: string; company_id: string }>>`
      insert into public.help_requests (
        organization_id,
        company_id,
        contact_person_id,
        interaction_id,
        followup_id,
        document_id,
        requested_by,
        assigned_to,
        help_type,
        title,
        description,
        priority,
        status,
        resolution_note,
        created_by,
        updated_by
      )
      values (
        ${organization.id}::uuid,
        ${validated.data.company_id}::uuid,
        ${validated.data.contact_person_id}::uuid,
        ${validated.data.interaction_id}::uuid,
        ${validated.data.followup_id}::uuid,
        ${validated.data.document_id}::uuid,
        ${user.id}::uuid,
        ${validated.data.assigned_to}::uuid,
        ${validated.data.help_type},
        ${validated.data.title},
        ${validated.data.description},
        ${validated.data.priority},
        ${validated.data.status},
        ${validated.data.resolution_note},
        ${user.id}::uuid,
        ${user.id}::uuid
      )
      returning id::text as id, title, company_id::text as company_id
    `;

    const data = rows[0];
    if (!data) {
      return { ok: false, error: "Unable to create the help request right now." };
    }

    await insertActivityLog("created", "help_request", data.id, {
      title: data.title,
      help_type: validated.data.help_type,
      priority: validated.data.priority,
    });

    revalidatePath("/need-help");
    revalidatePath(`/companies/${validated.data.company_id}`);

    return { ok: true, id: data.id };
  } catch (error) {
    logServerError("help-request.create", error, { organizationId: organization.id, companyId: validated.data.company_id });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the help request right now.") };
  }
}

export async function updateHelpRequest(helpRequestId: string, formData: FormData): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, helpRequest } = await validateHelpRequestOwnership(helpRequestId);

  const rawValues = Object.fromEntries(formData.entries());
  const validated = helpRequestUpdateSchema.safeParse(rawValues);

  if (!validated.success) {
    return getValidationFailure(validated.error);
  }

  try {
    await prisma.$executeRaw`
      update public.help_requests
      set
        company_id = coalesce(${validated.data.company_id}::uuid, company_id),
        title = coalesce(${validated.data.title}, title),
        help_type = coalesce(${validated.data.help_type}, help_type),
        contact_person_id = coalesce(${validated.data.contact_person_id}::uuid, contact_person_id),
        interaction_id = coalesce(${validated.data.interaction_id}::uuid, interaction_id),
        followup_id = coalesce(${validated.data.followup_id}::uuid, followup_id),
        document_id = coalesce(${validated.data.document_id}::uuid, document_id),
        assigned_to = coalesce(${validated.data.assigned_to}::uuid, assigned_to),
        priority = coalesce(${validated.data.priority}, priority),
        status = coalesce(${validated.data.status}, status),
        description = coalesce(${validated.data.description}, description),
        resolution_note = coalesce(${validated.data.resolution_note}, resolution_note),
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${helpRequestId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("updated", "help_request", helpRequestId, {
      title: validated.data.title,
    });

    const nextCompanyId = validated.data.company_id ?? helpRequest.company_id;
    revalidatePath("/need-help");
    revalidatePath(`/need-help/${helpRequestId}`);
    revalidatePath(`/companies/${helpRequest.company_id}`);
    if (nextCompanyId !== helpRequest.company_id) {
      revalidatePath(`/companies/${nextCompanyId}`);
    }

    return { ok: true, id: helpRequestId };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update the help request right now.") };
  }
}

export async function assignHelpRequest(helpRequestId: string, assignedTo: string, setInProgress = false): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, helpRequest } = await validateHelpRequestOwnership(helpRequestId);

  try {
    await prisma.$executeRaw`
      update public.help_requests
      set
        assigned_to = ${assignedTo}::uuid,
        status = case when ${setInProgress} then 'in_progress' else status end,
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${helpRequestId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("assigned", "help_request", helpRequestId, {
      assigned_to: assignedTo,
    });

    if (assignedTo && assignedTo !== user.id) {
      await createNotification({
        userId: assignedTo,
        type: "help_request.assigned",
        title: "Help request assigned",
        message: `You were assigned the help request "${helpRequest.title ?? "Untitled request"}".`,
        link: `/need-help/${helpRequestId}`,
      });
    }

    revalidatePath("/need-help");
    revalidatePath(`/need-help/${helpRequestId}`);
    revalidatePath(`/companies/${helpRequest.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to assign the help request right now.") };
  }
}

export async function resolveHelpRequest(helpRequestId: string, resolutionNote?: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, helpRequest } = await validateHelpRequestOwnership(helpRequestId);

  try {
    await prisma.$executeRaw`
      update public.help_requests
      set
        status = 'resolved',
        resolution_note = ${resolutionNote || null},
        resolved_at = now(),
        resolved_by = ${user.id}::uuid,
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${helpRequestId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("resolved", "help_request", helpRequestId, {
      resolution_note: resolutionNote,
    });

    if (helpRequest.requested_by && helpRequest.requested_by !== user.id) {
      await createNotification({
        userId: helpRequest.requested_by,
        type: "help_request.resolved",
        title: "Help request resolved",
        message: `Your help request "${helpRequest.title ?? "Untitled request"}" has been resolved.`,
        link: `/need-help/${helpRequestId}`,
      });
    }

    revalidatePath("/need-help");
    revalidatePath(`/need-help/${helpRequestId}`);
    revalidatePath(`/companies/${helpRequest.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to resolve the help request right now.") };
  }
}

export async function rejectHelpRequest(helpRequestId: string, reason?: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, helpRequest } = await validateHelpRequestOwnership(helpRequestId);

  try {
    await prisma.$executeRaw`
      update public.help_requests
      set
        status = 'rejected',
        resolution_note = ${reason || null},
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${helpRequestId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("rejected", "help_request", helpRequestId, {
      reason,
    });

    revalidatePath("/need-help");
    revalidatePath(`/need-help/${helpRequestId}`);
    revalidatePath(`/companies/${helpRequest.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to reject the help request right now.") };
  }
}

export async function reopenHelpRequest(helpRequestId: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, helpRequest } = await validateHelpRequestOwnership(helpRequestId);

  try {
    await prisma.$executeRaw`
      update public.help_requests
      set
        status = 'open',
        resolution_note = null,
        resolved_at = null,
        resolved_by = null,
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${helpRequestId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("reopened", "help_request", helpRequestId);

    revalidatePath("/need-help");
    revalidatePath(`/need-help/${helpRequestId}`);
    revalidatePath(`/companies/${helpRequest.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to reopen the help request right now.") };
  }
}

export async function archiveHelpRequest(helpRequestId: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, helpRequest } = await validateHelpRequestOwnership(helpRequestId);

  try {
    await prisma.$executeRaw`
      update public.help_requests
      set
        status = 'archived',
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${helpRequestId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("archived", "help_request", helpRequestId);

    revalidatePath("/need-help");
    revalidatePath(`/companies/${helpRequest.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the help request right now.") };
  }
}

export async function addHelpRequestComment(helpRequestId: string, comment: string, isInternal = true): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      insert into public.help_request_comments (
        organization_id,
        help_request_id,
        user_id,
        comment,
        is_internal
      )
      values (
        ${organization.id}::uuid,
        ${helpRequestId}::uuid,
        ${user.id}::uuid,
        ${comment},
        ${isInternal}
      )
    `;

    await insertActivityLog("commented", "help_request", helpRequestId, {
      is_internal: isInternal,
    });

    revalidatePath(`/need-help/${helpRequestId}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to add the comment right now.") };
  }
}
