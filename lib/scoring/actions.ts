"use server";

import { z } from "zod";
import { requireAuth, requireOrganization, requirePermission } from "@/lib/auth/session";
import { getSafeErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { adjustWalletBalance, redeemWalletReward } from "./service";

type ScoringActionState = {
  ok: boolean;
  error?: string;
  id?: string;
};

const leadScoreRuleSchema = z.object({
  action_key: z.string().trim().min(2),
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  points: z.coerce.number().int(),
  is_active: z.coerce.boolean().default(true),
  rule_scope: z.record(z.unknown()).optional().default({}),
});

const leadSourceRuleSchema = z.object({
  source_name: z.string().trim().min(1),
  bonus_points: z.coerce.number().int(),
  is_active: z.coerce.boolean().default(true),
  rule_scope: z.record(z.unknown()).optional().default({}),
});

const rewardSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  reward_type: z.enum(["badge", "discount", "premium_feature", "manual_reward"]),
  cost_points: z.coerce.number().int().min(0),
  feature_key: z.string().trim().optional().nullable(),
  inventory: z.preprocess((value) => (value === "" || value === null || value === undefined ? null : value), z.coerce.number().int().min(0).nullable()),
  fulfillment_mode: z.enum(["automatic", "manual"]),
  is_active: z.coerce.boolean().default(true),
  metadata: z.record(z.unknown()).optional().default({}),
});

const challengeTemplateSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  cadence: z.enum(["daily", "weekly"]),
  target_metric: z.string().trim().min(2),
  target_count: z.coerce.number().int().min(1),
  bonus_points: z.coerce.number().int().min(0),
  is_active: z.coerce.boolean().default(true),
  starts_at: z.string().trim().optional().nullable(),
  ends_at: z.string().trim().optional().nullable(),
  config: z.record(z.unknown()).optional().default({}),
});

async function upsertLeadScoreRule(id: string | null, values: unknown): Promise<ScoringActionState> {
  const organization = await requireOrganization();
  const parsed = leadScoreRuleSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const rows = id
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          update public.lead_score_rules
          set
            action_key = ${parsed.data.action_key},
            name = ${parsed.data.name},
            description = ${parsed.data.description ?? null},
            points = ${parsed.data.points},
            is_active = ${parsed.data.is_active},
            rule_scope = ${JSON.stringify(parsed.data.rule_scope ?? {})}::jsonb,
            updated_at = now()
          where id = ${id}::uuid
            and organization_id = ${organization.id}::uuid
          returning id
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          insert into public.lead_score_rules (
            organization_id,
            action_key,
            name,
            description,
            points,
            is_active,
            rule_scope
          )
          values (
            ${organization.id}::uuid,
            ${parsed.data.action_key},
            ${parsed.data.name},
            ${parsed.data.description ?? null},
            ${parsed.data.points},
            ${parsed.data.is_active},
            ${JSON.stringify(parsed.data.rule_scope ?? {})}::jsonb
          )
          returning id
        `;

    return { ok: true, id: rows[0]?.id ?? id ?? undefined };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to save scoring data.") };
  }
}

async function upsertLeadSourceRule(id: string | null, values: unknown): Promise<ScoringActionState> {
  const organization = await requireOrganization();
  const parsed = leadSourceRuleSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const normalizedSource = parsed.data.source_name.trim().toLowerCase();

  try {
    const rows = id
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          update public.lead_source_score_rules
          set
            source_name = ${parsed.data.source_name},
            normalized_source = ${normalizedSource},
            bonus_points = ${parsed.data.bonus_points},
            is_active = ${parsed.data.is_active},
            rule_scope = ${JSON.stringify(parsed.data.rule_scope ?? {})}::jsonb,
            updated_at = now()
          where id = ${id}::uuid
            and organization_id = ${organization.id}::uuid
          returning id
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          insert into public.lead_source_score_rules (
            organization_id,
            source_name,
            normalized_source,
            bonus_points,
            is_active,
            rule_scope
          )
          values (
            ${organization.id}::uuid,
            ${parsed.data.source_name},
            ${normalizedSource},
            ${parsed.data.bonus_points},
            ${parsed.data.is_active},
            ${JSON.stringify(parsed.data.rule_scope ?? {})}::jsonb
          )
          returning id
        `;

    return { ok: true, id: rows[0]?.id ?? id ?? undefined };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to save scoring data.") };
  }
}

async function upsertReward(id: string | null, values: unknown): Promise<ScoringActionState> {
  const organization = await requireOrganization();
  const parsed = rewardSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const rows = id
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          update public.rewards_catalog
          set
            name = ${parsed.data.name},
            description = ${parsed.data.description ?? null},
            reward_type = ${parsed.data.reward_type},
            cost_points = ${parsed.data.cost_points},
            feature_key = ${parsed.data.feature_key ?? null},
            inventory = ${parsed.data.inventory},
            fulfillment_mode = ${parsed.data.fulfillment_mode},
            is_active = ${parsed.data.is_active},
            metadata = ${JSON.stringify(parsed.data.metadata ?? {})}::jsonb,
            updated_at = now()
          where id = ${id}::uuid
            and organization_id = ${organization.id}::uuid
          returning id
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          insert into public.rewards_catalog (
            organization_id,
            name,
            description,
            reward_type,
            cost_points,
            feature_key,
            inventory,
            fulfillment_mode,
            is_active,
            metadata
          )
          values (
            ${organization.id}::uuid,
            ${parsed.data.name},
            ${parsed.data.description ?? null},
            ${parsed.data.reward_type},
            ${parsed.data.cost_points},
            ${parsed.data.feature_key ?? null},
            ${parsed.data.inventory},
            ${parsed.data.fulfillment_mode},
            ${parsed.data.is_active},
            ${JSON.stringify(parsed.data.metadata ?? {})}::jsonb
          )
          returning id
        `;

    return { ok: true, id: rows[0]?.id ?? id ?? undefined };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to save scoring data.") };
  }
}

async function upsertChallenge(id: string | null, values: unknown): Promise<ScoringActionState> {
  const organization = await requireOrganization();
  const parsed = challengeTemplateSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const rows = id
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          update public.challenge_templates
          set
            name = ${parsed.data.name},
            description = ${parsed.data.description ?? null},
            cadence = ${parsed.data.cadence},
            target_metric = ${parsed.data.target_metric},
            target_count = ${parsed.data.target_count},
            bonus_points = ${parsed.data.bonus_points},
            is_active = ${parsed.data.is_active},
            starts_at = ${parsed.data.starts_at ? new Date(parsed.data.starts_at) : null},
            ends_at = ${parsed.data.ends_at ? new Date(parsed.data.ends_at) : null},
            config = ${JSON.stringify(parsed.data.config ?? {})}::jsonb,
            updated_at = now()
          where id = ${id}::uuid
            and organization_id = ${organization.id}::uuid
          returning id
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          insert into public.challenge_templates (
            organization_id,
            name,
            description,
            cadence,
            target_metric,
            target_count,
            bonus_points,
            is_active,
            starts_at,
            ends_at,
            config
          )
          values (
            ${organization.id}::uuid,
            ${parsed.data.name},
            ${parsed.data.description ?? null},
            ${parsed.data.cadence},
            ${parsed.data.target_metric},
            ${parsed.data.target_count},
            ${parsed.data.bonus_points},
            ${parsed.data.is_active},
            ${parsed.data.starts_at ? new Date(parsed.data.starts_at) : null},
            ${parsed.data.ends_at ? new Date(parsed.data.ends_at) : null},
            ${JSON.stringify(parsed.data.config ?? {})}::jsonb
          )
          returning id
        `;

    return { ok: true, id: rows[0]?.id ?? id ?? undefined };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to save scoring data.") };
  }
}

export async function createLeadScoreRuleAction(values: unknown) {
  await requirePermission("scoring.manage");
  return upsertLeadScoreRule(null, values);
}

export async function updateLeadScoreRuleAction(id: string, values: unknown) {
  await requirePermission("scoring.manage");
  return upsertLeadScoreRule(id, values);
}

export async function archiveLeadScoreRuleAction(id: string) {
  await requirePermission("scoring.manage");
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.lead_score_rules
      set is_active = false, updated_at = now()
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the scoring rule.") };
  }
}

export async function createLeadSourceScoreRuleAction(values: unknown) {
  await requirePermission("scoring.manage");
  return upsertLeadSourceRule(null, values);
}

export async function updateLeadSourceScoreRuleAction(id: string, values: unknown) {
  await requirePermission("scoring.manage");
  return upsertLeadSourceRule(id, values);
}

export async function archiveLeadSourceScoreRuleAction(id: string) {
  await requirePermission("scoring.manage");
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.lead_source_score_rules
      set is_active = false, updated_at = now()
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the lead source rule.") };
  }
}

export async function createRewardAction(values: unknown) {
  await requirePermission("rewards.manage");
  return upsertReward(null, values);
}

export async function updateRewardAction(id: string, values: unknown) {
  await requirePermission("rewards.manage");
  return upsertReward(id, values);
}

export async function archiveRewardAction(id: string) {
  await requirePermission("rewards.manage");
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.rewards_catalog
      set is_active = false, updated_at = now()
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the reward.") };
  }
}

export async function createChallengeTemplateAction(values: unknown) {
  await requirePermission("scoring.manage");
  return upsertChallenge(null, values);
}

export async function updateChallengeTemplateAction(id: string, values: unknown) {
  await requirePermission("scoring.manage");
  return upsertChallenge(id, values);
}

export async function archiveChallengeTemplateAction(id: string) {
  await requirePermission("scoring.manage");
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.challenge_templates
      set is_active = false, updated_at = now()
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the challenge.") };
  }
}

export async function redeemRewardAction(rewardId: string): Promise<ScoringActionState> {
  await requireAuth();

  try {
    const result = await redeemWalletReward(rewardId, {});
    return { ok: true, id: result?.redemption_id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to redeem reward." };
  }
}

export async function adjustWalletBalanceAction(
  userId: string,
  pointsDelta: number,
  reason: string,
): Promise<ScoringActionState> {
  await requirePermission("scoring.manage");
  const organization = await requireOrganization();
  const actor = await requireAuth();

  try {
    const result = await adjustWalletBalance({
      organizationId: organization.id,
      userId,
      actorUserId: actor.id,
      pointsDelta,
      reason,
      idempotencyKey: `manual_adjustment:${userId}:${actor.id}:${Date.now()}`,
    });

    return { ok: true, id: result?.transaction_id ?? undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to adjust wallet balance." };
  }
}

export async function fulfillRewardRedemptionAction(
  redemptionId: string,
  status: "fulfilled" | "rejected" | "cancelled",
  fulfillmentNotes?: string,
): Promise<ScoringActionState> {
  await requirePermission("rewards.manage");
  const organization = await requireOrganization();
  const actor = await requireAuth();

  try {
    await prisma.$executeRaw`
      update public.reward_redemptions
      set
        status = ${status},
        fulfillment_notes = ${fulfillmentNotes ?? null},
        processed_by = ${actor.id}::uuid,
        processed_at = now(),
        updated_at = now()
      where id = ${redemptionId}::uuid
        and organization_id = ${organization.id}::uuid
    `;
    return { ok: true, id: redemptionId };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update reward redemption.") };
  }
}
