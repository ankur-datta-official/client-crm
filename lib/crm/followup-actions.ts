"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { followupSchema } from "@/lib/crm/schemas";
import { createNotification } from "@/lib/notifications/notifications";
import { applyScoringEvent, buildScoreIdempotencyKey } from "@/lib/scoring/service";
import { createClient } from "@/lib/supabase/server";
import { ensureCanAssignUser, ensureCanWorkWithCompany, notifyDirectManagerOfActivity } from "@/lib/team/hierarchy";
import type { CrmActionState } from "./actions";

// Reuse activity log helper
async function insertActivityLog(action: string, entityType: string, entityId: string, metadata: Record<string, any> = {}) {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

  await supabase.from("activity_logs").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("followups")
    .select("id, company_id, title, created_by, assigned_user_id")
    .eq("id", followupId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Follow-up not found or access denied.");
  }

  return { organization, followup: data };
}

export async function createFollowup(formData: FormData): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

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

  const { data, error } = await supabase
    .from("followups")
    .insert({
      ...validated.data,
      organization_id: organization.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, title, assigned_user_id, created_by")
    .single();

  if (error) {
    logServerError("followup.create", error, { organizationId: organization.id, companyId: validated.data.company_id });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the follow-up right now.") };
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
}

export async function updateFollowup(followupId: string, formData: FormData): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization } = await validateFollowupOwnership(followupId);
  const supabase = await createClient();

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

  const { error } = await supabase
    .from("followups")
    .update({
      ...validated.data,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followupId)
    .eq("organization_id", organization.id);

  if (error) {
    return { ok: false, error: error.message };
  }

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
}

export async function completeFollowup(followupId: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);
  const supabase = await createClient();
  await ensureCanWorkWithCompany(followup.company_id);

  const { error } = await supabase
    .from("followups")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followupId)
    .eq("organization_id", organization.id);

  if (error) {
    return { ok: false, error: error.message };
  }

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
}

export async function rescheduleFollowup(followupId: string, newDate: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);
  const supabase = await createClient();
  await ensureCanWorkWithCompany(followup.company_id);

  // Get current scheduled_at for rescheduled_from
  const { data: currentFollowup } = await supabase
    .from("followups")
    .select("scheduled_at")
    .eq("id", followupId)
    .single();

  const { error } = await supabase
    .from("followups")
    .update({
      scheduled_at: newDate,
      rescheduled_from: currentFollowup?.scheduled_at,
      status: "rescheduled",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followupId)
    .eq("organization_id", organization.id);

  if (error) {
    return { ok: false, error: error.message };
  }

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
}

export async function cancelFollowup(followupId: string, reason?: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("followups")
    .update({
      status: "cancelled",
      cancelled_reason: reason,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followupId)
    .eq("organization_id", organization.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await insertActivityLog("cancelled", "followup", followupId, { reason });

  revalidatePath("/followups");
  revalidatePath(`/companies/${followup.company_id}`);

  return { ok: true };
}

export async function archiveFollowup(followupId: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const { organization, followup } = await validateFollowupOwnership(followupId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("followups")
    .update({
      status: "archived",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followupId)
    .eq("organization_id", organization.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await insertActivityLog("archived", "followup", followupId);

  revalidatePath("/followups");
  revalidatePath(`/companies/${followup.company_id}`);

  return { ok: true };
}
