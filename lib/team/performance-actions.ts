"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireAuth, requireOrganization } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PERFORMANCE_TARGET_METRICS, PERFORMANCE_TARGET_PERIODS, type PerformanceTargetMetric } from "@/lib/team/types";

const performanceTargetSchema = z.object({
  userId: z.string().uuid("A valid team member is required."),
  metricKey: z.enum(Object.keys(PERFORMANCE_TARGET_METRICS) as [PerformanceTargetMetric, ...PerformanceTargetMetric[]]),
  periodType: z.enum(PERFORMANCE_TARGET_PERIODS),
  targetValue: z.coerce.number().int().min(1, "Target value must be at least 1."),
  effectiveDate: z.string().min(1, "Effective date is required."),
  notes: z.string().trim().max(250).optional(),
});

type PerformanceTargetActionResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

async function ensureCanManagePerformanceTarget(targetUserId: string, organizationId: string, actorUserId: string) {
  if (targetUserId === actorUserId) {
    return;
  }

  if (await hasPermission("settings.manage")) {
    return;
  }

  const targetProfile = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      organization_id: organizationId,
      is_active: true,
      manager_user_id: actorUserId,
    },
    select: {
      id: true,
    },
  });

  if (!targetProfile) {
    throw new Error("You do not have permission to manage this user target.");
  }
}

export async function upsertPerformanceTarget(input: unknown): Promise<PerformanceTargetActionResult> {
  const parsed = performanceTargetSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Please check the target form and try again.",
    };
  }

  try {
    const user = await requireAuth();
    const organization = await requireOrganization();

    const targetProfile = await prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        organization_id: organization.id,
      },
      select: {
        id: true,
      },
    });

    if (!targetProfile) {
      return {
        ok: false,
        error: "Target user was not found in this workspace.",
      };
    }

    await ensureCanManagePerformanceTarget(parsed.data.userId, organization.id, user.id);

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      insert into public.user_performance_targets (
        organization_id,
        user_id,
        metric_key,
        period_type,
        target_value,
        effective_date,
        notes,
        assigned_by
      )
      values (
        ${organization.id}::uuid,
        ${parsed.data.userId}::uuid,
        ${parsed.data.metricKey},
        ${parsed.data.periodType},
        ${parsed.data.targetValue},
        ${parsed.data.effectiveDate}::date,
        nullif(${parsed.data.notes ?? null}, ''),
        ${user.id}::uuid
      )
      on conflict (organization_id, user_id, metric_key, period_type, effective_date)
      do update set
        target_value = excluded.target_value,
        notes = excluded.notes,
        assigned_by = excluded.assigned_by,
        updated_at = now()
      returning id
    `;

    revalidatePath("/dashboard");
    revalidatePath("/team");
    revalidatePath("/reports");

    return {
      ok: true,
      id: rows[0]?.id ?? null,
    };
  } catch (error) {
    logServerError("performance_target.upsert", error, {
      targetUserId: parsed.data.userId,
      metricKey: parsed.data.metricKey,
      periodType: parsed.data.periodType,
    });
    return {
      ok: false,
      error: getSafeErrorMessage(error, "Unable to save the target right now."),
    };
  }
}

export async function deletePerformanceTarget(targetId: string) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  const rows = await prisma.$queryRaw<Array<{ id: string; user_id: string }>>`
    select id, user_id::text as user_id
    from public.user_performance_targets
    where id = ${targetId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const targetRecord = rows[0] ?? null;

  if (!targetRecord) {
    throw new Error("Target record was not found.");
  }

  await ensureCanManagePerformanceTarget(targetRecord.user_id, organization.id, user.id);

  await prisma.$executeRaw`
    delete from public.user_performance_targets
    where id = ${targetId}::uuid
  `;

  revalidatePath("/dashboard");
  revalidatePath("/team");
  revalidatePath("/reports");
  return { success: true };
}
