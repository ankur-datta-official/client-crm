"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { PERFORMANCE_TARGET_METRICS, PERFORMANCE_TARGET_PERIODS, type PerformanceTargetMetric } from "@/lib/team/types";

const performanceTargetSchema = z.object({
  userId: z.string().uuid("A valid team member is required."),
  metricKey: z.enum(Object.keys(PERFORMANCE_TARGET_METRICS) as [PerformanceTargetMetric, ...PerformanceTargetMetric[]]),
  periodType: z.enum(PERFORMANCE_TARGET_PERIODS),
  targetValue: z.coerce.number().int().min(1, "Target value must be at least 1."),
  effectiveDate: z.string().min(1, "Effective date is required."),
  notes: z.string().trim().max(250).optional(),
});

export async function upsertPerformanceTarget(input: unknown) {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const parsed = performanceTargetSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Please check the target form and try again.");
  }

  const { data, error } = await supabase.rpc("upsert_user_performance_target", {
    target_user_id: parsed.data.userId,
    target_metric: parsed.data.metricKey,
    target_period: parsed.data.periodType,
    target_value: parsed.data.targetValue,
    target_effective_date: parsed.data.effectiveDate,
    target_notes: parsed.data.notes ?? null,
  });

  if (error) {
    logServerError("performance_target.upsert", error, {
      organizationId: organization.id,
      actorUserId: user.id,
      targetUserId: parsed.data.userId,
      metricKey: parsed.data.metricKey,
      periodType: parsed.data.periodType,
    });
    throw new Error(getSafeErrorMessage(error, "Unable to save the target right now."));
  }

  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/reports");

  return data as string;
}

export async function deletePerformanceTarget(targetId: string) {
  await requireAuth();
  await requireOrganization();
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_user_performance_target", {
    target_row_id: targetId,
  });

  if (error) {
    throw new Error(getSafeErrorMessage(error, "Unable to delete the target right now."));
  }

  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/reports");
  return { success: true };
}
