"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { followupSchema } from "@/lib/crm/schemas";
import { createNotification } from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";
import { applyScoringEvent, buildScoreIdempotencyKey } from "@/lib/scoring/service";
import { ensureCanAssignUser, ensureCanWorkWithCompany, notifyDirectManagerOfActivity } from "@/lib/team/hierarchy";
import type { CrmActionState } from "./actions";

type FollowupLookup = {
  id: string;
  company_id: string;
  title: string | null;
  created_by: string | null;
  assigned_user_id: string | null;
  scheduled_at: string | null;
};

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

function getValidationFailure(error: z.ZodError): CrmActionState {
  return {
    ok: false,
    error: error.errors[0]?.message ?? "Please check the form and try again.",
    fieldErrors: Object.fromEntries(error.errors.map((issue) => [String(issue.path[0]), issue.message])),
  };
}

async function validateFollowupOwnership(followupId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<FollowupLookup[]>`
    select
      id::text as id,
      company_id::text as company_id,
      title,
      created_by::text as created_by,
      assigned_user_id::text as assigned_user_id,
      scheduled_at::text as scheduled_at
    from public.followups
    where id = ${followupId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const followup = rows[0] ?? null;
  if (!followup) {
    throw new Error("Follow-up not found or access denied.");
  }

  return { organization, followup };
}

export async function createFollowup(formData: FormData): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();

  const rawValues = Object.fromEntries(formData.entries());
  const validated = followupSchema.safeParse(rawValues);

  if (!validated.success) {
    return getValidationFailure(validated.error);
  }

  await ensureCanWorkWithCompany(validated.data.company_id);
  if (validated.data.assigned_user_id) {
    try {
      await ensureCanAssignUser(validated.data.assigned_user_id);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "You cannot assign this follow-up to that user." };
    }
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; title: string; assigned_user_id: string | null; created_by: string | null }>>`
      insert into public.followups (
        organization_id,
        company_id,
        contact_person_id,
        interaction_id,
        assigned_user_id,
        followup_type,
        title,
        description,
        scheduled_at,
        reminder_before_minutes,
        status,
        priority,
        created_by,
        updated_by
      )
      values (
        ${organization.id}::uuid,
        ${validated.data.company_id}::uuid,
        ${validated.data.contact_person_id}::uuid,
        ${validated.data.interaction_id}::uuid,
        ${validated.data.assigned_user_id}::uuid,
        ${validated.data.followup_type},
        ${validated.data.title},
        ${validated.data.description},
        ${validated.data.scheduled_at}::timestamptz,
        ${validated.data.reminder_before_minutes},
        ${validated.data.status},
        ${validated.data.priority},
        ${user.id}::uuid,
        ${user.id}::uuid
      )
      returning
        id::text as id,
        title,
        assigned_user_id::text as assigned_user_id,
        created_by::text as created_by
    `;

    const data = rows[0];
    if (!data) {
      return { ok: false, error: "Unable to create the follow-up right now." };
    }

    await insertActivityLog("created", "followup", data.id, { title: data.title });
    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior created a follow-up",
      message: `"${data.title}" was created by one of your direct team members.`,
      link: `/followups/${data.id}`,
    });

    if (data.assigned_user_id && data.assigned_user_id !== user.id) {
      await createNotification({
        userId: data.assigned_user_id,
        type: "followup.assigned",
        title: "New follow-up assigned",
        message: `You were assigned the follow-up "${data.title}".`,
        link: `/followups/${data.id}`,
      });
    }

    revalidatePath("/followups");
    revalidatePath(`/companies/${validated.data.company_id}`);

    return { ok: true, id: data.id };
  } catch (error) {
    logServerError("followup.create", error, { organizationId: organization.id, companyId: validated.data.company_id });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the follow-up right now.") };
  }
}

export async function updateFollowup(followupId: string, formData: FormData): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization } = await validateFollowupOwnership(followupId);

  const rawValues = Object.fromEntries(formData.entries());
  const validated = followupSchema.safeParse(rawValues);

  if (!validated.success) {
    return getValidationFailure(validated.error);
  }

  await ensureCanWorkWithCompany(validated.data.company_id);
  if (validated.data.assigned_user_id) {
    try {
      await ensureCanAssignUser(validated.data.assigned_user_id);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "You cannot assign this follow-up to that user." };
    }
  }

  try {
    await prisma.$executeRaw`
      update public.followups
      set
        company_id = ${validated.data.company_id}::uuid,
        contact_person_id = ${validated.data.contact_person_id}::uuid,
        interaction_id = ${validated.data.interaction_id}::uuid,
        assigned_user_id = ${validated.data.assigned_user_id}::uuid,
        followup_type = ${validated.data.followup_type},
        title = ${validated.data.title},
        description = ${validated.data.description},
        scheduled_at = ${validated.data.scheduled_at}::timestamptz,
        reminder_before_minutes = ${validated.data.reminder_before_minutes},
        status = ${validated.data.status},
        priority = ${validated.data.priority},
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${followupId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("updated", "followup", followupId, { title: validated.data.title });
    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior updated a follow-up",
      message: `"${validated.data.title}" was updated by one of your direct team members.`,
      link: `/followups/${followupId}`,
    });

    revalidatePath("/followups");
    revalidatePath(`/followups/${followupId}`);
    revalidatePath(`/companies/${validated.data.company_id}`);

    return { ok: true, id: followupId };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update the follow-up right now.") };
  }
}

export async function completeFollowup(followupId: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);
  await ensureCanWorkWithCompany(followup.company_id);

  try {
    await prisma.$executeRaw`
      update public.followups
      set
        status = 'completed',
        completed_at = now(),
        completed_by = ${user.id}::uuid,
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${followupId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("completed", "followup", followupId);
    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior completed a follow-up",
      message: `"${followup.title ?? "Untitled follow-up"}" was marked complete by one of your direct team members.`,
      link: `/followups/${followupId}`,
    });

    await applyScoringEvent({
      organizationId: organization.id,
      userId: user.id,
      actionKey: "followup_completed",
      companyId: followup.company_id,
      followupId,
      sourceRecordId: followupId,
      sourceRecordType: "followup",
      metadata: {
        followup_title: followup.title,
        company_id: followup.company_id,
      },
      actorUserId: user.id,
      addToLeadScore: true,
      idempotencyKey: buildScoreIdempotencyKey(["followup_completed", followupId]),
    });

    if (followup.created_by && followup.created_by !== user.id) {
      await createNotification({
        userId: followup.created_by,
        type: "followup.completed",
        title: "Follow-up completed",
        message: `The follow-up "${followup.title ?? "Untitled follow-up"}" was marked complete.`,
        link: `/followups/${followupId}`,
      });
    }

    revalidatePath("/followups");
    revalidatePath(`/companies/${followup.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to complete the follow-up right now.") };
  }
}

export async function rescheduleFollowup(followupId: string, newDate: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);
  await ensureCanWorkWithCompany(followup.company_id);

  try {
    await prisma.$executeRaw`
      update public.followups
      set
        scheduled_at = ${newDate}::timestamptz,
        rescheduled_from = ${followup.scheduled_at}::timestamptz,
        status = 'rescheduled',
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${followupId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("rescheduled", "followup", followupId, { new_date: newDate });
    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior rescheduled a follow-up",
      message: `"${followup.title ?? "Untitled follow-up"}" was rescheduled by one of your direct team members.`,
      link: `/followups/${followupId}`,
    });

    revalidatePath("/followups");
    revalidatePath(`/companies/${followup.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to reschedule the follow-up right now.") };
  }
}

export async function cancelFollowup(followupId: string, reason?: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);

  try {
    await prisma.$executeRaw`
      update public.followups
      set
        status = 'cancelled',
        cancelled_reason = ${reason ?? null},
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${followupId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("cancelled", "followup", followupId, { reason });

    revalidatePath("/followups");
    revalidatePath(`/companies/${followup.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to cancel the follow-up right now.") };
  }
}

export async function archiveFollowup(followupId: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);

  try {
    await prisma.$executeRaw`
      update public.followups
      set
        status = 'archived',
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${followupId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("archived", "followup", followupId);

    revalidatePath("/followups");
    revalidatePath(`/companies/${followup.company_id}`);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the follow-up right now.") };
  }
}
