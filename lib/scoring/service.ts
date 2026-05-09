import { Prisma } from "@prisma/client";
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

function humanizeActionKey(actionKey: string) {
  return actionKey
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const rows = await prisma.$queryRaw<RedeemRewardRow[]>`
    select *
    from public.redeem_wallet_reward(
      ${rewardId}::uuid,
      ${JSON.stringify(metadata)}::jsonb
    )
  `;

  return normalizeRpcSingle(rows);
}
