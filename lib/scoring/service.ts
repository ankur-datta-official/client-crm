import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { ScoringEventResult } from "./types";

type ApplyScoringEventInput = {
  organizationId: string;
  userId: string;
  actionKey: string;
  companyId?: string | null;
  followupId?: string | null;
  sourceRecordId?: string | null;
  sourceRecordType?: string | null;
  metadata?: Record<string, unknown>;
  actorUserId?: string | null;
  happenedAt?: string;
  addToLeadScore?: boolean;
  idempotencyKey: string;
};

type AdjustWalletInput = {
  organizationId: string;
  userId: string;
  actorUserId: string;
  pointsDelta: number;
  reason: string;
  companyId?: string | null;
  rewardId?: string | null;
  sourceRecordId?: string | null;
  sourceRecordType?: string | null;
  addToLeadScore?: boolean;
  idempotencyKey: string;
};

type WalletTxResultRow = {
  transaction_id: string | null;
  points_delta: number;
  balance_after: number;
};

type RedeemRewardRow = {
  redemption_id: string;
  transaction_id: string;
  remaining_balance: number;
  status: string;
};

type RewardRedemptionResult = {
  redemption_id: string;
  transaction_id: string;
  remaining_balance: number;
  status: string;
};

export function buildScoreIdempotencyKey(parts: Array<string | null | undefined>) {
  return parts.filter((value) => value && value.trim().length > 0).join(":");
}

function normalizeRpcSingle<T>(data: T[]): T | null {
  return data[0] ?? null;
}

function isMissingScoringFunctionError(error: unknown) {
  return error instanceof Error
    && error.message.includes("function public.apply_scoring_event")
    && error.message.includes("does not exist");
}

function isMissingRewardRedemptionFunctionError(error: unknown) {
  return error instanceof Error
    && error.message.includes("function public.redeem_wallet_reward")
    && error.message.includes("does not exist");
}

function humanizeActionKey(actionKey: string) {
  return actionKey
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildRedemptionDescription(rewardName: string, status: RewardRedemptionResult["status"]) {
  if (status === "fulfilled") {
    return `${rewardName} redeemed and fulfilled.`;
  }

  return `${rewardName} redemption submitted for fulfillment.`;
}

async function applyScoringEventFallback(input: ApplyScoringEventInput): Promise<ScoringEventResult> {
  const rule = await prisma.leadScoreRule.findFirst({
    where: {
      organization_id: input.organizationId,
      action_key: input.actionKey,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      points: true,
    },
  });

  if (!rule || rule.points === 0) {
    return {
      transaction_id: null,
      points_awarded: 0,
      balance_after: 0,
      applied: false,
    };
  }

  const existingTransaction = await prisma.walletTransaction.findFirst({
    where: {
      organization_id: input.organizationId,
      idempotency_key: input.idempotencyKey,
    },
    select: {
      id: true,
      balance_after: true,
      points_delta: true,
    },
  });

  if (existingTransaction) {
    return {
      transaction_id: existingTransaction.id,
      points_awarded: existingTransaction.points_delta,
      balance_after: existingTransaction.balance_after,
      applied: false,
    };
  }

  const actorUserId = input.actorUserId ?? input.userId;
  const metadata = (input.metadata ?? {}) as Prisma.InputJsonValue;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        id: true,
        organization_id: true,
        wallet_balance: true,
        wallet_lifetime_earned: true,
      },
    });

    if (!user || user.organization_id !== input.organizationId) {
      return {
        transaction_id: null,
        points_awarded: 0,
        balance_after: 0,
        applied: false,
      };
    }

    const balanceAfter = user.wallet_balance + rule.points;
    const lifetimeEarnedAfter = user.wallet_lifetime_earned + Math.max(rule.points, 0);
    const title = rule.name || humanizeActionKey(input.actionKey);
    const description = rule.description ?? `${title} points awarded.`;

    const updatedUser = await tx.user.update({
      where: {
        id: input.userId,
      },
      data: {
        wallet_balance: balanceAfter,
        wallet_lifetime_earned: lifetimeEarnedAfter,
      },
      select: {
        wallet_balance: true,
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        organization_id: input.organizationId,
        user_id: input.userId,
        transaction_type: rule.points >= 0 ? "earn" : "adjustment",
        action_key: input.actionKey,
        points_delta: rule.points,
        balance_after: updatedUser.wallet_balance,
        company_id: input.companyId ?? null,
        followup_id: input.followupId ?? null,
        challenge_id: null,
        reward_id: null,
        source_record_id: input.sourceRecordId ?? null,
        source_record_type: input.sourceRecordType ?? null,
        idempotency_key: input.idempotencyKey,
        metadata,
        created_by: actorUserId,
      },
      select: {
        id: true,
        points_delta: true,
        balance_after: true,
      },
    });

    await tx.scoringActivityLog.create({
      data: {
        organization_id: input.organizationId,
        wallet_transaction_id: transaction.id,
        user_id: input.userId,
        actor_user_id: actorUserId,
        action_key: input.actionKey,
        title,
        description,
        points_delta: rule.points,
        company_id: input.companyId ?? null,
        followup_id: input.followupId ?? null,
        challenge_id: null,
        reward_id: null,
        source_record_id: input.sourceRecordId ?? null,
        source_record_type: input.sourceRecordType ?? null,
        metadata,
      },
    });

    return {
      transaction_id: transaction.id,
      points_awarded: transaction.points_delta,
      balance_after: transaction.balance_after,
      applied: true,
    };
  });
}

export async function applyScoringEvent(input: ApplyScoringEventInput): Promise<ScoringEventResult> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        transaction_id: string | null;
        points_awarded: number;
        balance_after: number;
        applied: boolean;
      }>
    >`
      select *
      from public.apply_scoring_event(
        ${input.organizationId}::uuid,
        ${input.userId}::uuid,
        ${input.actionKey},
        ${input.companyId ?? null}::uuid,
        ${input.followupId ?? null}::uuid,
        ${input.sourceRecordId ?? null}::uuid,
        ${input.sourceRecordType ?? null},
        ${JSON.stringify(input.metadata ?? {})}::jsonb,
        ${input.actorUserId ?? input.userId}::uuid,
        ${input.happenedAt ? new Date(input.happenedAt) : new Date()},
        ${input.addToLeadScore ?? true},
        ${input.idempotencyKey}
      )
    `;

    return normalizeRpcSingle(rows) ?? {
      transaction_id: null,
      points_awarded: 0,
      balance_after: 0,
      applied: false,
    };
  } catch (error) {
    if (!isMissingScoringFunctionError(error)) {
      throw error;
    }

    return applyScoringEventFallback(input);
  }
}

export async function adjustWalletBalance(input: AdjustWalletInput) {
  const rows = await prisma.$queryRaw<WalletTxResultRow[]>`
    select *
    from public.award_wallet_points(
      ${input.organizationId}::uuid,
      ${input.userId}::uuid,
      'adjustment',
      'manual_adjustment',
      ${input.pointsDelta},
      ${input.companyId ?? null}::uuid,
      null::uuid,
      null::uuid,
      ${input.rewardId ?? null}::uuid,
      ${input.sourceRecordId ?? null}::uuid,
      ${input.sourceRecordType ?? null},
      ${input.idempotencyKey},
      ${JSON.stringify({ reason: input.reason })}::jsonb,
      ${input.actorUserId}::uuid,
      ${input.addToLeadScore ?? false}
    )
  `;

  return normalizeRpcSingle(rows);
}

export async function redeemWalletReward(rewardId: string, metadata: Record<string, unknown> = {}) {
  try {
    const rows = await prisma.$queryRaw<RedeemRewardRow[]>`
      select *
      from public.redeem_wallet_reward(
        ${rewardId}::uuid,
        ${JSON.stringify(metadata)}::jsonb
      )
    `;

    return normalizeRpcSingle(rows);
  } catch (error) {
    if (!isMissingRewardRedemptionFunctionError(error)) {
      throw error;
    }

    return redeemWalletRewardFallback(rewardId, metadata);
  }
}

async function redeemWalletRewardFallback(
  rewardId: string,
  metadata: Record<string, unknown> = {},
): Promise<RewardRedemptionResult | null> {
  const user = await getCurrentUser();

  if (!user?.id) {
    throw new Error("Authentication required.");
  }

  const fallbackMetadata = metadata as Prisma.InputJsonValue;

  return prisma.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        organization_id: true,
        wallet_balance: true,
        wallet_lifetime_earned: true,
      },
    });

    if (!actor?.organization_id) {
      throw new Error("Workspace not available.");
    }

    const reward = await tx.rewardCatalog.findFirst({
      where: {
        id: rewardId,
        organization_id: actor.organization_id,
        is_active: true,
      },
      select: {
        id: true,
        organization_id: true,
        name: true,
        description: true,
        reward_type: true,
        cost_points: true,
        feature_key: true,
        inventory: true,
        fulfillment_mode: true,
      },
    });

    if (!reward) {
      throw new Error("Reward not found.");
    }

    const existingRedemption = await tx.rewardRedemption.findFirst({
      where: {
        organization_id: actor.organization_id,
        user_id: actor.id,
        reward_id: reward.id,
        status: {
          in: ["pending", "fulfilled"],
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingRedemption) {
      throw new Error(
        existingRedemption.status === "fulfilled"
          ? "This reward is already unlocked."
          : "This reward is already pending fulfillment.",
      );
    }

    if (actor.wallet_balance < reward.cost_points) {
      throw new Error("You do not have enough points to redeem this reward.");
    }

    if (reward.inventory !== null && reward.inventory <= 0) {
      throw new Error("This reward is currently out of stock.");
    }

    if (reward.reward_type === "badge") {
      const existingBadge = await tx.userBadge.findFirst({
        where: {
          organization_id: actor.organization_id,
          user_id: actor.id,
          OR: [
            { reward_id: reward.id },
            ...(reward.feature_key ? [{ badge_key: reward.feature_key }] : []),
          ],
        },
        select: { id: true },
      });

      if (existingBadge) {
        throw new Error("This reward is already unlocked.");
      }
    }

    const nextBalance = actor.wallet_balance - reward.cost_points;
    const availableInventory = reward.inventory;
    const nextInventory = availableInventory === null ? null : availableInventory - 1;
    const redemptionStatus =
      reward.fulfillment_mode === "automatic" || reward.reward_type === "badge"
        ? "fulfilled"
        : "pending";

    const updatedUser = await tx.user.update({
      where: { id: actor.id },
      data: {
        wallet_balance: nextBalance,
      },
      select: {
        wallet_balance: true,
      },
    });

    if (reward.inventory !== null) {
      await tx.rewardCatalog.update({
        where: { id: reward.id },
        data: {
          inventory: nextInventory,
          updated_at: new Date(),
        },
      });
    }

    const redemption = await tx.rewardRedemption.create({
      data: {
        organization_id: actor.organization_id,
        user_id: actor.id,
        reward_id: reward.id,
        points_spent: reward.cost_points,
        status: redemptionStatus,
        metadata: fallbackMetadata,
        processed_by: redemptionStatus === "fulfilled" ? actor.id : null,
        processed_at: redemptionStatus === "fulfilled" ? new Date() : null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        organization_id: actor.organization_id,
        user_id: actor.id,
        transaction_type: "redeem",
        action_key: "reward_redemption",
        points_delta: -reward.cost_points,
        balance_after: updatedUser.wallet_balance,
        reward_id: reward.id,
        source_record_id: redemption.id,
        source_record_type: "reward_redemption",
        idempotency_key: `reward_redemption:${redemption.id}`,
        metadata: fallbackMetadata,
        created_by: actor.id,
      },
      select: {
        id: true,
      },
    });

    if (reward.reward_type === "badge") {
      await tx.userBadge.create({
        data: {
          organization_id: actor.organization_id,
          user_id: actor.id,
          reward_id: reward.id,
          badge_key: reward.feature_key?.trim() || `reward:${reward.id}`,
          badge_name: reward.name,
          badge_description: reward.description,
          metadata: fallbackMetadata,
          awarded_by: actor.id,
        },
      });
    }

    await tx.scoringActivityLog.create({
      data: {
        organization_id: actor.organization_id,
        wallet_transaction_id: transaction.id,
        user_id: actor.id,
        actor_user_id: actor.id,
        action_key: "reward_redemption",
        title: `Redeemed ${reward.name}`,
        description: buildRedemptionDescription(reward.name, redemption.status as RewardRedemptionResult["status"]),
        points_delta: -reward.cost_points,
        reward_id: reward.id,
        source_record_id: redemption.id,
        source_record_type: "reward_redemption",
        metadata: fallbackMetadata,
      },
    });

    return {
      redemption_id: redemption.id,
      transaction_id: transaction.id,
      remaining_balance: updatedUser.wallet_balance,
      status: redemption.status,
    };
  });
}
