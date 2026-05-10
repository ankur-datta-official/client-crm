"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireOrganization, requirePermission } from "@/lib/auth/session";
import { resolveProfileAvatarUrl } from "@/lib/profile/profile-utils";
import { Prisma } from "@prisma/client";
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

function normalizeJsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeCadence(value: string | null | undefined): UserChallengeProgress["cadence"] {
  return value === "daily" || value === "weekly" ? value : undefined;
}

async function resolveLeaderboardAvatarUrls(entries: LeaderboardEntry[]) {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      avatar_url: await resolveProfileAvatarUrl(entry.avatar_url, 900, {
        profileId: entry.user_id,
      }),
    })),
  );
}

function rewardDedupKey(reward: Reward) {
  return reward.feature_key?.trim() || `${reward.reward_type}:${reward.name.trim().toLowerCase()}`;
}

function pickPreferredReward(current: Reward | undefined, next: Reward) {
  if (!current) return next;
  if (current.is_active !== next.is_active) return next.is_active ? next : current;
  return next.updated_at > current.updated_at ? next : current;
}

function dedupeRewards(rewards: Reward[]) {
  const dedupedRewards = new Map<string, Reward>();

  for (const reward of rewards) {
    const key = rewardDedupKey(reward);
    dedupedRewards.set(key, pickPreferredReward(dedupedRewards.get(key), reward));
  }

  return Array.from(dedupedRewards.values()).sort((a, b) => {
    if (a.cost_points !== b.cost_points) return a.cost_points - b.cost_points;
    return a.name.localeCompare(b.name);
  });
}

function challengeDedupKey(challenge: ChallengeTemplate) {
  return `${challenge.cadence}:${challenge.target_metric}:${challenge.name.trim().toLowerCase()}`;
}

function pickPreferredChallenge(current: ChallengeTemplate | undefined, next: ChallengeTemplate) {
  if (!current) return next;
  if (current.is_active !== next.is_active) return next.is_active ? next : current;
  return next.updated_at > current.updated_at ? next : current;
}

function dedupeChallenges(challenges: ChallengeTemplate[]) {
  const dedupedChallenges = new Map<string, ChallengeTemplate>();

  for (const challenge of challenges) {
    const key = challengeDedupKey(challenge);
    dedupedChallenges.set(key, pickPreferredChallenge(dedupedChallenges.get(key), challenge));
  }

  return Array.from(dedupedChallenges.values()).sort((a, b) => {
    if (a.cadence !== b.cadence) return a.cadence.localeCompare(b.cadence);
    return a.name.localeCompare(b.name);
  });
}

function asIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapWalletTransaction(row: any): WalletTransaction {
  return {
    ...row,
    metadata: normalizeJsonObject(row.metadata),
    created_at: asIsoString(row.created_at)!,
  };
}

function mapReward(row: any): Reward {
  return {
    ...row,
    metadata: normalizeJsonObject(row.metadata),
    created_at: asIsoString(row.created_at)!,
    updated_at: asIsoString(row.updated_at)!,
  };
}

function mapChallenge(row: any): ChallengeTemplate {
  return {
    ...row,
    config: row.config ?? {},
    starts_at: asIsoString(row.starts_at),
    ends_at: asIsoString(row.ends_at),
    created_at: asIsoString(row.created_at)!,
    updated_at: asIsoString(row.updated_at)!,
  };
}

function mapUserBadge(row: any): UserBadge {
  return {
    ...row,
    metadata: normalizeJsonObject(row.metadata),
    awarded_at: asIsoString(row.awarded_at)!,
  };
}

function mapScoringActivity(row: any): ScoringActivityLog {
  return {
    ...row,
    metadata: normalizeJsonObject(row.metadata),
    created_at: asIsoString(row.created_at)!,
  };
}

export async function getCurrentUserWalletSummary() {
  const user = await getCurrentUser();

  try {
    const rows = await prisma.$queryRaw<Array<{ payload: WalletSummary | null }>>`
      select public.get_user_wallet_summary() as payload
    `;
    return rows[0]?.payload ?? null;
  } catch (error) {
    if (isWalletSummaryFunctionUnavailableError(error)) {
      return getWalletSummaryFromTables(user?.id);
    }

    throw error;
  }
}

export async function getWalletSummaryForUser(userId: string) {
  await requirePermission("scoring.view");
  try {
    const rows = await prisma.$queryRaw<Array<{ payload: WalletSummary | null }>>`
      select public.get_user_wallet_summary(${userId}::uuid) as payload
    `;

    return rows[0]?.payload ?? null;
  } catch (error) {
    if (isWalletSummaryFunctionUnavailableError(error)) {
      return getWalletSummaryFromTables(userId);
    }

    throw error;
  }
}

function isWalletSummaryFunctionUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    error.message.includes("42883")
  );
}

function isWalletLeaderboardFunctionUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    error.message.includes("42883")
  );
}

async function getWalletSummaryFromTables(userId?: string | null): Promise<WalletSummary | null> {
  if (!userId) {
    return null;
  }

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organization_id: true,
      email: true,
      name: true,
      wallet_balance: true,
      wallet_lifetime_earned: true,
      userBadges: {
        select: {
          id: true,
          organization_id: true,
          user_id: true,
          reward_id: true,
          badge_key: true,
          badge_name: true,
          badge_description: true,
          metadata: true,
          awarded_at: true,
          awarded_by: true,
        },
        orderBy: { awarded_at: "desc" },
      },
      userStreaks: {
        select: {
          id: true,
          organization_id: true,
          user_id: true,
          streak_key: true,
          current_streak: true,
          best_streak: true,
          last_activity_date: true,
          updated_at: true,
        },
        orderBy: { updated_at: "desc" },
      },
    },
  });

  if (!profile?.organization_id) {
    return null;
  }

  const [transactions, challengeProgress] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: {
        organization_id: profile.organization_id,
        user_id: userId,
      },
      select: {
        id: true,
        transaction_type: true,
        action_key: true,
        points_delta: true,
        balance_after: true,
        company_id: true,
        followup_id: true,
        reward_id: true,
        metadata: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
      take: 25,
    }),
    prisma.userChallengeProgress.findMany({
      where: {
        organization_id: profile.organization_id,
        user_id: userId,
      },
      select: {
        id: true,
        challenge_template_id: true,
        progress_count: true,
        target_count: true,
        is_completed: true,
        completed_at: true,
        window_starts_at: true,
        window_ends_at: true,
        updated_at: true,
        challengeTemplate: {
          select: {
            name: true,
            description: true,
            cadence: true,
            target_metric: true,
          },
        },
      },
      orderBy: { window_starts_at: "desc" },
      take: 25,
    }),
  ]);

  return {
    user_id: profile.id,
    organization_id: profile.organization_id,
    full_name: profile.name,
    email: profile.email,
    wallet_balance: profile.wallet_balance,
    wallet_lifetime_earned: profile.wallet_lifetime_earned,
    recent_transactions: transactions.map((record) => ({
      id: record.id,
      transaction_type: record.transaction_type as WalletSummary["recent_transactions"][number]["transaction_type"],
      action_key: record.action_key,
      points_delta: record.points_delta,
      balance_after: record.balance_after,
      company_id: record.company_id,
      followup_id: record.followup_id,
      reward_id: record.reward_id,
      metadata: normalizeJsonObject(record.metadata),
      created_at: asIsoString(record.created_at) as string,
    })),
    badges: profile.userBadges.map((record) => ({
      id: record.id,
      organization_id: record.organization_id,
      user_id: record.user_id,
      reward_id: record.reward_id,
      badge_key: record.badge_key,
      badge_name: record.badge_name,
      badge_description: record.badge_description,
      metadata: normalizeJsonObject(record.metadata),
      awarded_at: asIsoString(record.awarded_at) as string,
      awarded_by: record.awarded_by ?? null,
    })),
    streaks: profile.userStreaks.map((record) => ({
      id: record.id,
      streak_key: record.streak_key,
      current_streak: record.current_streak,
      best_streak: record.best_streak,
      last_activity_date: asIsoString(record.last_activity_date),
      updated_at: asIsoString(record.updated_at) as string,
    })),
    challenge_progress: challengeProgress.map((record) => ({
      id: record.id,
      challenge_template_id: record.challenge_template_id,
      progress_count: record.progress_count,
      target_count: record.target_count,
      is_completed: record.is_completed,
      completed_at: asIsoString(record.completed_at),
      window_starts_at: asIsoString(record.window_starts_at) as string,
      window_ends_at: asIsoString(record.window_ends_at) as string,
      name: record.challengeTemplate?.name,
      description: record.challengeTemplate?.description,
      cadence: normalizeCadence(record.challengeTemplate?.cadence),
      target_metric: record.challengeTemplate?.target_metric,
    })),
  };
}

export async function getUserWalletTransactions(userId?: string, limit = 50) {
  const organization = await requireOrganization();
  const currentUser = await getCurrentUser();
  const effectiveUserId = userId ?? currentUser?.id ?? "";

  const rows = await prisma.$queryRaw<any[]>`
    select *
    from public.wallet_transactions
    where organization_id = ${organization.id}::uuid
      and user_id = ${effectiveUserId}::uuid
    order by created_at desc
    limit ${limit}
  `;

  return rows.map(mapWalletTransaction);
}

export async function getCompanyScoringHistory(companyId: string, limit = 50) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<any[]>`
    select *
    from public.scoring_activity_logs
    where organization_id = ${organization.id}::uuid
      and company_id = ${companyId}::uuid
    order by created_at desc
    limit ${limit}
  `;

  return rows.map(mapScoringActivity);
}

export async function getWalletLeaderboard(period: "all_time" | "weekly" | "daily" = "all_time", limit = 10) {
  const organization = await requireOrganization();

  try {
    const rows = await prisma.$queryRaw<any[]>`
      select *
      from public.get_wallet_leaderboard(
        ${organization.id}::uuid,
        ${period},
        ${limit}
      )
    `;

    const mapped: LeaderboardEntry[] = rows.map((row) => ({
      ...row,
      wallet_balance: Number(row.wallet_balance),
      wallet_lifetime_earned: Number(row.wallet_lifetime_earned),
      period_points: Number(row.period_points),
    }));

    return resolveLeaderboardAvatarUrls(mapped);
  } catch (error) {
    if (isWalletLeaderboardFunctionUnavailableError(error)) {
      return getWalletLeaderboardFromTables(organization.id, period, limit);
    }

    throw error;
  }
}

async function getWalletLeaderboardFromTables(
  organizationId: string,
  period: "all_time" | "weekly" | "daily",
  limit: number,
) {
  const leaderboardLimit = Math.max(1, limit);
  const startAt =
    period === "daily"
      ? Prisma.sql`date_trunc('day', now())`
      : period === "weekly"
        ? Prisma.sql`date_trunc('week', now())`
        : Prisma.sql`null::timestamptz`;

  const rows = await prisma.$queryRaw<Array<{
    user_id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    wallet_balance: number | bigint;
    wallet_lifetime_earned: number | bigint;
    period_points: number | bigint;
  }>>`
    with bounds as (
      select ${startAt} as start_at
    ),
    ranked as (
      select
        p.id::text as user_id,
        p.full_name,
        p.email,
        p.avatar_url,
        p.wallet_balance,
        p.wallet_lifetime_earned,
        coalesce(sum(
          case
            when b.start_at is null and wt.points_delta > 0 then wt.points_delta
            when b.start_at is not null and wt.created_at >= b.start_at and wt.points_delta > 0 then wt.points_delta
            else 0
          end
        ), 0)::integer as period_points
      from public.profiles p
      cross join bounds b
      left join public.wallet_transactions wt
        on wt.organization_id = p.organization_id
       and wt.user_id = p.id
      where p.organization_id = ${organizationId}::uuid
        and p.is_active = true
      group by p.id, p.full_name, p.email, p.avatar_url, p.wallet_balance, p.wallet_lifetime_earned
    )
    select
      ranked.user_id,
      ranked.full_name,
      ranked.email,
      ranked.avatar_url,
      ranked.wallet_balance,
      ranked.wallet_lifetime_earned,
      ranked.period_points
    from ranked
    where ranked.period_points > 0 or ${period} = 'all_time'
    order by ranked.period_points desc, ranked.wallet_balance desc, ranked.email asc
    limit ${leaderboardLimit}
  `;

  const mapped: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: index + 1,
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    avatar_url: row.avatar_url,
    wallet_balance: Number(row.wallet_balance),
    wallet_lifetime_earned: Number(row.wallet_lifetime_earned),
    period_points: Number(row.period_points),
  }));

  return resolveLeaderboardAvatarUrls(mapped);
}

export async function getActiveRewards() {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<any[]>`
    select *
    from public.rewards_catalog
    where organization_id = ${organization.id}::uuid
      and is_active = true
    order by cost_points asc, name asc
  `;

  return dedupeRewards(rows.map(mapReward));
}

export async function getRewardRedemptionHistory(limit = 50) {
  const organization = await requireOrganization();
  const currentUser = await getCurrentUser();
  const rows = await prisma.$queryRaw<any[]>`
    select
      rr.*,
      jsonb_build_object(
        'id', rc.id,
        'name', rc.name,
        'reward_type', rc.reward_type,
        'cost_points', rc.cost_points
      ) as rewards_catalog
    from public.reward_redemptions rr
    left join public.rewards_catalog rc
      on rc.id = rr.reward_id
    where rr.organization_id = ${organization.id}::uuid
      and rr.user_id = ${currentUser?.id ?? ""}::uuid
    order by rr.created_at desc
    limit ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    metadata: normalizeJsonObject(row.metadata),
    created_at: asIsoString(row.created_at)!,
    updated_at: asIsoString(row.updated_at)!,
    processed_at: asIsoString(row.processed_at),
  })) as RewardRedemption[];
}

export async function getOrganizationRewardRedemptions(limit = 50) {
  await requirePermission("rewards.manage");
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<any[]>`
    select
      rr.*,
      jsonb_build_object(
        'id', rc.id,
        'name', rc.name,
        'reward_type', rc.reward_type,
        'cost_points', rc.cost_points
      ) as rewards_catalog
    from public.reward_redemptions rr
    left join public.rewards_catalog rc
      on rc.id = rr.reward_id
    where rr.organization_id = ${organization.id}::uuid
    order by rr.created_at desc
    limit ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    metadata: normalizeJsonObject(row.metadata),
    created_at: asIsoString(row.created_at)!,
    updated_at: asIsoString(row.updated_at)!,
    processed_at: asIsoString(row.processed_at),
  })) as RewardRedemption[];
}

export async function getActiveChallenges() {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<any[]>`
    select *
    from public.challenge_templates
    where organization_id = ${organization.id}::uuid
      and is_active = true
    order by cadence asc, name asc
  `;

  const now = new Date().toISOString();
  return dedupeChallenges(
    rows
      .map(mapChallenge)
      .filter((challenge) => {
        const startsAtOkay = !challenge.starts_at || challenge.starts_at <= now;
        const endsAtOkay = !challenge.ends_at || challenge.ends_at >= now;
        return startsAtOkay && endsAtOkay;
      }),
  );
}

export async function getUserChallengeProgress(userId?: string, limit = 50) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<any[]>`
    select
      ucp.*,
      ct.name,
      ct.description,
      ct.cadence,
      ct.target_metric
    from public.user_challenge_progress ucp
    left join public.challenge_templates ct
      on ct.id = ucp.challenge_template_id
    where ucp.organization_id = ${organization.id}::uuid
      and (${userId ?? null}::uuid is null or ucp.user_id = ${userId ?? null}::uuid)
    order by ucp.updated_at desc
    limit ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    completed_at: asIsoString(row.completed_at),
    window_starts_at: asIsoString(row.window_starts_at)!,
    window_ends_at: asIsoString(row.window_ends_at)!,
    updated_at: asIsoString(row.updated_at)!,
    cadence: normalizeCadence(row.cadence),
  })) as UserChallengeProgress[];
}

export async function getUserBadges(userId?: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<any[]>`
    select *
    from public.user_badges
    where organization_id = ${organization.id}::uuid
      and (${userId ?? null}::uuid is null or user_id = ${userId ?? null}::uuid)
    order by awarded_at desc
  `;

  return rows.map(mapUserBadge);
}

export async function getScoringAdminDashboard() {
  await requirePermission("scoring.view");
  const organization = await requireOrganization();

  const [
    rulesRows,
    sourceRuleRows,
    rewardRows,
    challengeRows,
    topActionRows,
  ] = await Promise.all([
    prisma.$queryRaw<any[]>`
      select *
      from public.lead_score_rules
      where organization_id = ${organization.id}::uuid
      order by name asc
    `,
    prisma.$queryRaw<any[]>`
      select *
      from public.lead_source_score_rules
      where organization_id = ${organization.id}::uuid
      order by source_name asc
    `,
    prisma.$queryRaw<any[]>`
      select *
      from public.rewards_catalog
      where organization_id = ${organization.id}::uuid
      order by cost_points asc
    `,
    prisma.$queryRaw<any[]>`
      select *
      from public.challenge_templates
      where organization_id = ${organization.id}::uuid
      order by name asc
    `,
    prisma.$queryRaw<Array<{ action_key: string; points_delta: number }>>`
      select action_key, points_delta
      from public.wallet_transactions
      where organization_id = ${organization.id}::uuid
        and points_delta > 0
    `,
  ]);

  const leaderboard = await getWalletLeaderboard("all_time", 10);

  const topEarnActions = Object.entries(
    topActionRows.reduce<Record<string, number>>((acc, item) => {
      acc[item.action_key] = (acc[item.action_key] ?? 0) + Number(item.points_delta);
      return acc;
    }, {}),
  )
    .map(([actionKey, totalPoints]) => ({ actionKey, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return {
    rules: rulesRows.map((row) => ({
      ...row,
      rule_scope: normalizeJsonObject(row.rule_scope),
      created_at: asIsoString(row.created_at)!,
      updated_at: asIsoString(row.updated_at)!,
    })) as LeadScoreRule[],
    sourceRules: sourceRuleRows.map((row) => ({
      ...row,
      rule_scope: normalizeJsonObject(row.rule_scope),
      created_at: asIsoString(row.created_at)!,
      updated_at: asIsoString(row.updated_at)!,
    })) as LeadSourceScoreRule[],
    rewards: dedupeRewards(rewardRows.map(mapReward)),
    challenges: dedupeChallenges(challengeRows.map(mapChallenge)),
    topEarnActions,
    leaderboard,
  };
}
