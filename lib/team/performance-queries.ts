import "server-only";

import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  PERFORMANCE_TARGET_METRICS,
  type CurrentUserPerformanceSnapshot,
  type ManagedActivityReportItem,
  type PerformanceMetricSnapshot,
  type PerformanceTargetMetric,
  type UserPerformanceTarget,
} from "@/lib/team/types";

const PERFORMANCE_METRIC_KEYS = Object.keys(PERFORMANCE_TARGET_METRICS) as PerformanceTargetMetric[];

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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function resolveTargetValue(targets: UserPerformanceTarget[], metric: PerformanceTargetMetric, periodType: "daily" | "monthly", pointDate: Date) {
  const pointTime = startOfDay(pointDate).getTime();

  return targets
    .filter((target) => target.metric_key === metric && target.period_type === periodType)
    .filter((target) => startOfDay(new Date(target.effective_date)).getTime() <= pointTime)
    .sort((left, right) => new Date(right.effective_date).getTime() - new Date(left.effective_date).getTime())[0]?.target_value ?? 0;
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_performance_targets")
    .select("id, organization_id, user_id, metric_key, period_type, target_value, effective_date, notes, assigned_by, created_at, updated_at, profile:profiles!user_performance_targets_user_id_fkey(full_name, email)")
    .eq("organization_id", organization.id)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const profileRelation = row.profile as Array<{ full_name: string | null; email: string }> | { full_name: string | null; email: string } | null;
    const profile = Array.isArray(profileRelation) ? profileRelation[0] ?? null : profileRelation;

    return {
      ...(row as unknown as UserPerformanceTarget),
      profile,
    };
  });
}

export async function getCurrentUserPerformanceSnapshot(): Promise<CurrentUserPerformanceSnapshot> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const trendStart = new Date(dayStart);
  trendStart.setDate(trendStart.getDate() - 13);

  const { data: targets, error: targetError } = await supabase
    .from("user_performance_targets")
    .select("id, organization_id, user_id, metric_key, period_type, target_value, effective_date, notes, assigned_by, created_at, updated_at")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .lte("effective_date", dayEnd.toISOString().slice(0, 10))
    .order("effective_date", { ascending: false });

  if (targetError) {
    throw new Error(targetError.message);
  }

  const [companiesResult, meetingsResult, followupsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("created_at")
      .eq("organization_id", organization.id)
      .eq("created_by", user.id)
      .gte("created_at", trendStart.toISOString())
      .lte("created_at", dayEnd.toISOString())
      .neq("status", "archived"),
    supabase
      .from("interactions")
      .select("meeting_datetime")
      .eq("organization_id", organization.id)
      .eq("created_by", user.id)
      .gte("meeting_datetime", trendStart.toISOString())
      .lte("meeting_datetime", dayEnd.toISOString())
      .neq("status", "archived"),
    supabase
      .from("followups")
      .select("completed_at")
      .eq("organization_id", organization.id)
      .eq("completed_by", user.id)
      .eq("status", "completed")
      .gte("completed_at", trendStart.toISOString())
      .lte("completed_at", dayEnd.toISOString()),
  ]);

  if (companiesResult.error) throw new Error(companiesResult.error.message);
  if (meetingsResult.error) throw new Error(meetingsResult.error.message);
  if (followupsResult.error) throw new Error(followupsResult.error.message);

  const actualByDate = countByDate([
    ...(companiesResult.data ?? []).map((row) => ({ date: row.created_at as string, metric: "leads_created" as const })),
    ...(meetingsResult.data ?? []).map((row) => ({ date: row.meeting_datetime as string, metric: "meetings_logged" as const })),
    ...(followupsResult.data ?? []).map((row) => ({ date: row.completed_at as string, metric: "followups_completed" as const })),
  ]);

  const metricSnapshots: PerformanceMetricSnapshot[] = PERFORMANCE_METRIC_KEYS.map((metric) => {
    const label = PERFORMANCE_TARGET_METRICS[metric];
    const dailyActual = (actualByDate.get(dayStart.toISOString().slice(0, 10))?.[metric] ?? 0);
    const monthlyActual = Array.from(actualByDate.entries())
      .filter(([date]) => new Date(date) >= monthStart)
      .reduce((sum, [, values]) => sum + values[metric], 0);

    return {
      metric,
      label,
      dailyTarget: resolveTargetValue((targets ?? []) as UserPerformanceTarget[], metric, "daily", today),
      dailyActual,
      monthlyTarget: resolveTargetValue((targets ?? []) as UserPerformanceTarget[], metric, "monthly", today),
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
        (sum, metric) => sum + resolveTargetValue((targets ?? []) as UserPerformanceTarget[], metric, "daily", pointDate),
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
  const supabase = await createClient();

  const { data: managedUsers, error: managedUsersError } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("manager_user_id", user.id)
    .eq("is_active", true);

  if (managedUsersError) {
    throw new Error(managedUsersError.message);
  }

  const managedUserIds = (managedUsers ?? []).map((profile) => profile.id);
  if (managedUserIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, created_at, action, entity_type, entity_id, metadata, actor_user_id, actor:profiles!activity_logs_actor_user_id_fkey(full_name, email)")
    .eq("organization_id", organization.id)
    .in("actor_user_id", managedUserIds)
    .in("entity_type", ["company", "interaction", "followup"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const actor = row.actor as { full_name: string | null; email: string } | null;

    return {
      id: row.id as string,
      created_at: row.created_at as string,
      action: row.action as string,
      entity_type: row.entity_type as string | null,
      entity_id: (row.entity_id as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      actor_user_id: (row.actor_user_id as string | null) ?? null,
      actor_name: actor?.full_name ?? actor?.email ?? "Unknown",
      actor_email: actor?.email ?? "unknown@example.com",
    };
  });
}
