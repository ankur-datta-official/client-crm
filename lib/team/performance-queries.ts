import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { formatMonthDayBD } from "@/lib/format/datetime";
import {
  PERFORMANCE_TARGET_METRICS,
  type CurrentUserPerformanceSnapshot,
  type ManagedActivityReportItem,
  type PerformanceMetricSnapshot,
  type PerformanceTargetMetric,
  type UserPerformanceTarget,
} from "@/lib/team/types";

const PERFORMANCE_METRIC_KEYS = Object.keys(PERFORMANCE_TARGET_METRICS) as PerformanceTargetMetric[];

type PerformanceTargetRow = {
  id: string;
  organization_id: string;
  user_id: string;
  metric_key: PerformanceTargetMetric;
  period_type: "daily" | "monthly";
  target_value: number;
  effective_date: Date | string;
  notes: string | null;
  assigned_by: string | null;
  created_at: Date;
  updated_at: Date;
  profile_full_name?: string | null;
  profile_email?: string | null;
};

type ActivityDateRow = {
  activity_at: Date;
  metric: PerformanceTargetMetric;
};

type ManagedActivityRow = {
  id: string;
  created_at: Date;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatTrendLabel(date: Date) {
  return formatMonthDayBD(date);
}

function formatDateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function mapPerformanceTarget(row: PerformanceTargetRow): UserPerformanceTarget {
  return {
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    metric_key: row.metric_key,
    period_type: row.period_type,
    target_value: Number(row.target_value),
    effective_date: formatDateOnly(row.effective_date),
    notes: row.notes,
    assigned_by: row.assigned_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    profile: row.profile_email
      ? {
          full_name: row.profile_full_name ?? null,
          email: row.profile_email,
        }
      : null,
  };
}

function resolveTargetValue(targets: UserPerformanceTarget[], metric: PerformanceTargetMetric, periodType: "daily" | "monthly", pointDate: Date) {
  const pointTime = startOfDay(pointDate).getTime();

  return targets
    .filter((target) => target.metric_key === metric && target.period_type === periodType)
    .filter((target) => startOfDay(new Date(target.effective_date)).getTime() <= pointTime)
    .sort((left, right) => new Date(right.effective_date).getTime() - new Date(left.effective_date).getTime())[0]?.target_value ?? 0;
}

function resolveTrendTargetValue(targets: UserPerformanceTarget[], metric: PerformanceTargetMetric, pointDate: Date) {
  const dailyTarget = resolveTargetValue(targets, metric, "daily", pointDate);
  if (dailyTarget > 0) {
    return dailyTarget;
  }

  return resolveTargetValue(targets, metric, "monthly", pointDate);
}

function countByDate(items: Array<{ date: string; metric: PerformanceTargetMetric }>) {
  const result = new Map<string, Record<PerformanceTargetMetric, number>>();

  for (const item of items) {
    const key = item.date.slice(0, 10);
    if (!result.has(key)) {
      result.set(key, {
        leads_created: 0,
        meetings_logged: 0,
        followups_completed: 0,
      });
    }
    result.get(key)![item.metric] += 1;
  }

  return result;
}

export async function getPerformanceTargetsForOrganization() {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<PerformanceTargetRow[]>`
    select
      upt.id,
      upt.organization_id,
      upt.user_id,
      upt.metric_key,
      upt.period_type,
      upt.target_value,
      upt.effective_date,
      upt.notes,
      upt.assigned_by,
      upt.created_at,
      upt.updated_at,
      p.full_name as profile_full_name,
      p.email as profile_email
    from public.user_performance_targets upt
    left join public.profiles p
      on p.id = upt.user_id
    where upt.organization_id = ${organization.id}::uuid
    order by upt.effective_date desc, upt.created_at desc
  `;

  return rows.map(mapPerformanceTarget);
}

export async function getCurrentUserPerformanceSnapshot(): Promise<CurrentUserPerformanceSnapshot> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const trendStart = new Date(dayStart);
  trendStart.setDate(trendStart.getDate() - 13);

  const [targetRows, activityRows] = await Promise.all([
    prisma.$queryRaw<PerformanceTargetRow[]>`
      select
        id,
        organization_id,
        user_id,
        metric_key,
        period_type,
        target_value,
        effective_date,
        notes,
        assigned_by,
        created_at,
        updated_at
      from public.user_performance_targets
      where organization_id = ${organization.id}::uuid
        and user_id = ${user.id}::uuid
        and effective_date <= ${dayEnd.toISOString().slice(0, 10)}::date
      order by effective_date desc
    `,
    prisma.$queryRaw<ActivityDateRow[]>`
      select created_at as activity_at, 'leads_created'::text as metric
      from public.companies
      where organization_id = ${organization.id}::uuid
        and created_by = ${user.id}::uuid
        and created_at >= ${trendStart}
        and created_at <= ${dayEnd}
        and status <> 'archived'

      union all

      select meeting_datetime as activity_at, 'meetings_logged'::text as metric
      from public.interactions
      where organization_id = ${organization.id}::uuid
        and created_by = ${user.id}::uuid
        and meeting_datetime >= ${trendStart}
        and meeting_datetime <= ${dayEnd}
        and status <> 'archived'

      union all

      select completed_at as activity_at, 'followups_completed'::text as metric
      from public.followups
      where organization_id = ${organization.id}::uuid
        and completed_by = ${user.id}::uuid
        and status = 'completed'
        and completed_at is not null
        and completed_at >= ${trendStart}
        and completed_at <= ${dayEnd}
    `,
  ]);

  const targets = targetRows.map(mapPerformanceTarget);
  const actualByDate = countByDate(
    activityRows.map((row) => ({
      date: row.activity_at.toISOString(),
      metric: row.metric,
    })),
  );

  const metricSnapshots: PerformanceMetricSnapshot[] = PERFORMANCE_METRIC_KEYS.map((metric) => {
    const label = PERFORMANCE_TARGET_METRICS[metric];
    const dailyActual = actualByDate.get(dayStart.toISOString().slice(0, 10))?.[metric] ?? 0;
    const monthlyActual = Array.from(actualByDate.entries())
      .filter(([date]) => new Date(date) >= monthStart)
      .reduce((sum, [, values]) => sum + values[metric], 0);

    return {
      metric,
      label,
      dailyTarget: resolveTargetValue(targets, metric, "daily", today),
      dailyActual,
      monthlyTarget: resolveTargetValue(targets, metric, "monthly", today),
      monthlyActual,
    };
  });

  const trend = Array.from({ length: 14 }).map((_, index) => {
    const pointDate = new Date(trendStart);
    pointDate.setDate(trendStart.getDate() + index);
    const key = pointDate.toISOString().slice(0, 10);
    const pointActual = actualByDate.get(key) ?? {
      leads_created: 0,
      meetings_logged: 0,
      followups_completed: 0,
    };

    return {
      date: key,
      label: formatTrendLabel(pointDate),
      target: PERFORMANCE_METRIC_KEYS.reduce(
        (sum, metric) => sum + resolveTrendTargetValue(targets, metric, pointDate),
        0,
      ),
      achievement: PERFORMANCE_METRIC_KEYS.reduce((sum, metric) => sum + pointActual[metric], 0),
    };
  });

  return {
    metrics: metricSnapshots,
    trend,
  };
}

export async function getManagedActivityReport(limit = 10): Promise<ManagedActivityReportItem[]> {
  const user = await requireAuth();
  const organization = await requireOrganization();

  const managedUsers = await prisma.user.findMany({
    where: {
      organization_id: organization.id,
      manager_user_id: user.id,
      is_active: true,
    },
    select: {
      id: true,
    },
  });

  const managedUserIds = managedUsers.map((profile) => profile.id);
  if (managedUserIds.length === 0) {
    return [];
  }

  const rows = await prisma.$queryRaw<ManagedActivityRow[]>`
    select
      al.id,
      al.created_at,
      al.action,
      al.entity_type,
      al.entity_id::text as entity_id,
      al.metadata,
      al.actor_user_id::text as actor_user_id,
      actor.full_name as actor_name,
      actor.email as actor_email
    from public.activity_logs al
    left join public.profiles actor
      on actor.id = al.actor_user_id
    where al.organization_id = ${organization.id}::uuid
      and al.actor_user_id in (${Prisma.join(managedUserIds.map((id) => Prisma.sql`${id}::uuid`))})
      and al.entity_type in ('company', 'interaction', 'followup')
    order by al.created_at desc
    limit ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at.toISOString(),
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id ?? null,
    metadata: row.metadata ?? {},
    actor_user_id: row.actor_user_id ?? null,
    actor_name: row.actor_name ?? row.actor_email ?? "Unknown",
    actor_email: row.actor_email ?? "unknown@example.com",
  }));
}
