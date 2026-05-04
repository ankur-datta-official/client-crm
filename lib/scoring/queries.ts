"use server";

import { getCurrentUser, requireOrganization, requirePermission } from "@/lib/auth/session";
import { resolveProfileAvatarUrl } from "@/lib/profile/profile-utils";
import { createClient } from "@/lib/supabase/server";
import type {
  ChallengeTemplate,
  LeadScoreRule,
  LeadSourceScoreRule,
  LeaderboardEntry,
  Reward,
  RewardRedemption,
  ScoringActivityLog,
  UserBadge,
  UserChallengeProgress,
  WalletSummary,
  WalletTransaction,
} from "./types";

async function resolveLeaderboardAvatarUrls(entries: LeaderboardEntry[]) {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      avatar_url: await resolveProfileAvatarUrl(entry.avatar_url),
    })),
  );
}

export async function getCurrentUserWalletSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_user_wallet_summary", {});

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data[0] : data) as WalletSummary | null;
}

export async function getWalletSummaryForUser(userId: string) {
  await requirePermission("scoring.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_user_wallet_summary", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data[0] : data) as WalletSummary | null;
}

export async function getUserWalletTransactions(userId?: string, limit = 50) {
  const organization = await requireOrganization();
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  let query = supabase
    .from("wallet_transactions")
    .select("*")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = query.eq("user_id", userId ?? currentUser?.id ?? "");

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WalletTransaction[];
}

export async function getCompanyScoringHistory(companyId: string, limit = 50) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scoring_activity_logs")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ScoringActivityLog[];
}

export async function getWalletLeaderboard(period: "all_time" | "weekly" | "daily" = "all_time", limit = 10) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_wallet_leaderboard", {
    p_organization_id: organization.id,
    p_period: period,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return resolveLeaderboardAvatarUrls((data ?? []) as LeaderboardEntry[]);
}

export async function getActiveRewards() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewards_catalog")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("cost_points")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  const dedupedRewards = new Map<string, Reward>();

  for (const reward of (data ?? []) as Reward[]) {
    const key = reward.feature_key?.trim() || `${reward.reward_type}:${reward.name.trim().toLowerCase()}`;
    const existing = dedupedRewards.get(key);

    if (!existing || reward.updated_at > existing.updated_at) {
      dedupedRewards.set(key, reward);
    }
  }

  return Array.from(dedupedRewards.values()).sort((a, b) => {
    if (a.cost_points !== b.cost_points) return a.cost_points - b.cost_points;
    return a.name.localeCompare(b.name);
  });
}

export async function getRewardRedemptionHistory(limit = 50) {
  const organization = await requireOrganization();
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("*, rewards_catalog(id, name, reward_type, cost_points)")
    .eq("organization_id", organization.id)
    .eq("user_id", currentUser?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RewardRedemption[];
}

export async function getOrganizationRewardRedemptions(limit = 50) {
  await requirePermission("rewards.manage");
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("*, rewards_catalog(id, name, reward_type, cost_points)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RewardRedemption[];
}

export async function getActiveChallenges() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("challenge_templates")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("cadence")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ChallengeTemplate[]).filter((challenge) => {
    const startsAtOkay = !challenge.starts_at || challenge.starts_at <= now;
    const endsAtOkay = !challenge.ends_at || challenge.ends_at >= now;
    return startsAtOkay && endsAtOkay;
  });
}

export async function getUserChallengeProgress(userId?: string, limit = 50) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("user_challenge_progress")
    .select("*, challenge_templates(name, description, cadence, target_metric)")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<any>).map((row) => ({
    ...row,
    name: row.challenge_templates?.name,
    description: row.challenge_templates?.description,
    cadence: row.challenge_templates?.cadence,
    target_metric: row.challenge_templates?.target_metric,
  })) as UserChallengeProgress[];
}

export async function getUserBadges(userId?: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("user_badges")
    .select("*")
    .eq("organization_id", organization.id)
    .order("awarded_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UserBadge[];
}

export async function getScoringAdminDashboard() {
  await requirePermission("scoring.view");
  const organization = await requireOrganization();
  const supabase = await createClient();

  const [
    rulesResult,
    sourceRulesResult,
    rewardsResult,
    challengesResult,
    topActionsResult,
    leaderboardResult,
  ] = await Promise.all([
    supabase.from("lead_score_rules").select("*").eq("organization_id", organization.id).order("name"),
    supabase.from("lead_source_score_rules").select("*").eq("organization_id", organization.id).order("source_name"),
    supabase.from("rewards_catalog").select("*").eq("organization_id", organization.id).order("cost_points"),
    supabase.from("challenge_templates").select("*").eq("organization_id", organization.id).order("name"),
    supabase
      .from("wallet_transactions")
      .select("action_key, points_delta")
      .eq("organization_id", organization.id)
      .gt("points_delta", 0),
    supabase.rpc("get_wallet_leaderboard", {
      p_organization_id: organization.id,
      p_period: "all_time",
      p_limit: 10,
    }),
  ]);

  if (rulesResult.error) throw new Error(rulesResult.error.message);
  if (sourceRulesResult.error) throw new Error(sourceRulesResult.error.message);
  if (rewardsResult.error) throw new Error(rewardsResult.error.message);
  if (challengesResult.error) throw new Error(challengesResult.error.message);
  if (topActionsResult.error) throw new Error(topActionsResult.error.message);
  if (leaderboardResult.error) throw new Error(leaderboardResult.error.message);

  const topEarnActions = Object.entries(
    ((topActionsResult.data ?? []) as Array<{ action_key: string; points_delta: number }>).reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.action_key] = (acc[item.action_key] ?? 0) + item.points_delta;
        return acc;
      },
      {},
    ),
  )
    .map(([actionKey, totalPoints]) => ({ actionKey, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return {
    rules: (rulesResult.data ?? []) as LeadScoreRule[],
    sourceRules: (sourceRulesResult.data ?? []) as LeadSourceScoreRule[],
    rewards: (rewardsResult.data ?? []) as Reward[],
    challenges: (challengesResult.data ?? []) as ChallengeTemplate[],
    topEarnActions,
    leaderboard: await resolveLeaderboardAvatarUrls((leaderboardResult.data ?? []) as LeaderboardEntry[]),
  };
}
