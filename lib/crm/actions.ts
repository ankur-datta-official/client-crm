"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import {
  companyCategorySchema,
  companySchema,
  contactPersonSchema,
  interactionSchema,
  industrySchema,
  pipelineStageSchema,
  quickCompleteInteractionSchema,
  temperatureFromRating,
} from "@/lib/crm/schemas";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { hasInteractionCompletionSupport } from "@/lib/crm/interaction-completion-support";
import { slugify } from "@/lib/crm/utils";
import {
  buildContactValues,
  buildEmailValues,
  getPrimaryContactValue,
} from "@/lib/crm/contact-channels";
import { createWorkspaceNotification } from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";
import { applyScoringEvent, buildScoreIdempotencyKey } from "@/lib/scoring/service";
import { ensureCanAssignUser, ensureCanWorkWithCompany, notifyDirectManagerOfActivity } from "@/lib/team/hierarchy";

export type CrmActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

type CompanyLookup = {
  id: string;
  name: string;
  pipeline_stage_id: string | null;
};

type PipelineStageLookup = {
  id: string;
  name: string;
  color: string;
  probability: number;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
};

type ContactLookup = {
  id: string;
  company_id: string;
  is_primary: boolean;
  name: string;
};

type InteractionLookup = {
  id: string;
  company_id: string;
  contact_person_id: string | null;
  assigned_user_id: string | null;
  interaction_type: string;
  discussion_details: string;
  next_action: string | null;
  next_followup_at: string | null;
  need_help: boolean;
  completed_at: string | null;
  success_rating: number | null;
  lead_temperature: string | null;
};

type ExistingCompanyStage = {
  pipeline_stage_id: string | null;
  previous_position: number | null;
  previous_is_won: boolean | null;
  previous_is_lost: boolean | null;
};

function resolveCompanyLeadTemperature(
  explicitTemperature: string | null | undefined,
  successRating: number | null | undefined,
): string {
  return explicitTemperature ?? temperatureFromRating(successRating) ?? "warm";
}

function getFirstError(error: z.ZodError) {
  return error.errors[0]?.message ?? "Please check the form and try again.";
}

function getFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    error.errors
      .filter((issue) => issue.path.length > 0)
      .map((issue) => [String(issue.path[0]), issue.message]),
  );
}

function getValidationState(error: z.ZodError): CrmActionState {
  return {
    ok: false,
    error: getFirstError(error),
    fieldErrors: getFieldErrors(error),
  };
}

function makeShortCode(value: string) {
  const code = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9+]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);

  return code || `CAT-${Date.now().toString().slice(-4)}`;
}

function normalizeCountResult(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return value == null ? 0 : Number(value);
}

async function insertActivityLog(action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const user = await requireAuth();
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      insert into public.activity_logs (
        organization_id,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        ${organization.id}::uuid,
        ${user.id}::uuid,
        ${action},
        ${entityType},
        ${entityId}::uuid,
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
  } catch (error) {
    logServerError("activity_log.insert", error, {
      organizationId: organization.id,
      actorUserId: user.id,
      action,
      entityType,
      entityId,
    });
  }
}

async function requireCompanyInOrganization(companyId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<CompanyLookup[]>`
    select
      id::text as id,
      name,
      pipeline_stage_id::text as pipeline_stage_id
    from public.companies
    where id = ${companyId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const company = rows[0] ?? null;
  if (!company) {
    throw new Error("Company was not found in your workspace.");
  }

  return { organization, company };
}

async function validateCompanyRelations(
  organizationId: string,
  values: {
    industry_id: string | null;
    category_id: string | null;
    pipeline_stage_id: string | null;
    assigned_user_id: string | null;
    referred_by_user_id?: string | null;
  },
): Promise<Record<string, string>> {
  const fieldErrors: Record<string, string> = {};

  if (values.industry_id) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.industries
      where id = ${values.industry_id}::uuid
        and organization_id = ${organizationId}::uuid
        and status <> 'archived'
      limit 1
    `;

    if (!rows[0]) {
      fieldErrors.industry_id = "Selected industry is not available in this workspace.";
    }
  }

  if (values.category_id) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.company_categories
      where id = ${values.category_id}::uuid
        and organization_id = ${organizationId}::uuid
        and status <> 'archived'
      limit 1
    `;

    if (!rows[0]) {
      fieldErrors.category_id = "Selected category is not available in this workspace.";
    }
  }

  if (values.pipeline_stage_id) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.pipeline_stages
      where id = ${values.pipeline_stage_id}::uuid
        and organization_id = ${organizationId}::uuid
        and is_active = true
      limit 1
    `;

    if (!rows[0]) {
      fieldErrors.pipeline_stage_id = "Selected pipeline stage is not available in this workspace.";
    }
  }

  if (values.assigned_user_id) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.profiles
      where id = ${values.assigned_user_id}::uuid
        and organization_id = ${organizationId}::uuid
      limit 1
    `;

    if (!rows[0]) {
      fieldErrors.assigned_user_id = "Selected assigned user is not part of this workspace.";
    } else {
      try {
        await ensureCanAssignUser(values.assigned_user_id);
      } catch (error) {
        fieldErrors.assigned_user_id = error instanceof Error ? error.message : "You cannot assign this user.";
      }
    }
  }

  if (values.referred_by_user_id) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.profiles
      where id = ${values.referred_by_user_id}::uuid
        and organization_id = ${organizationId}::uuid
        and is_active = true
      limit 1
    `;

    if (!rows[0]) {
      fieldErrors.referred_by_user_id = "Selected referral user is not part of this workspace.";
    }
  }

  return fieldErrors;
}

async function getPipelineStageInOrganization(stageId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<PipelineStageLookup[]>`
    select
      id::text as id,
      name,
      color,
      probability,
      position,
      is_won,
      is_lost,
      is_active
    from public.pipeline_stages
    where id = ${stageId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const stage = rows[0] ?? null;
  if (!stage || !stage.is_active) {
    throw new Error("Selected pipeline stage is not available in this workspace.");
  }

  return stage;
}

async function requireContactInOrganization(contactId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<ContactLookup[]>`
    select
      id::text as id,
      company_id::text as company_id,
      is_primary,
      name
    from public.contact_persons
    where id = ${contactId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const contact = rows[0] ?? null;
  if (!contact) {
    throw new Error("Contact was not found in your workspace.");
  }

  return { organization, contact };
}

async function validateInteractionRelations(
  organizationId: string,
  values: { company_id: string; contact_person_id: string | null; assigned_user_id: string | null },
) {
  const fieldErrors: Record<string, string> = {};

  const companyRows = await prisma.$queryRaw<Array<{ id: string }>>`
    select id::text as id
    from public.companies
    where id = ${values.company_id}::uuid
      and organization_id = ${organizationId}::uuid
      and status <> 'archived'
    limit 1
  `;

  if (!companyRows[0]) {
    fieldErrors.company_id = "Selected company is not available in this workspace.";
  }

  if (values.contact_person_id) {
    const contactRows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.contact_persons
      where id = ${values.contact_person_id}::uuid
        and company_id = ${values.company_id}::uuid
        and organization_id = ${organizationId}::uuid
        and status <> 'archived'
      limit 1
    `;

    if (!contactRows[0]) {
      fieldErrors.contact_person_id = "Selected contact does not belong to this company.";
    }
  }

  if (values.assigned_user_id) {
    const assignedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.profiles
      where id = ${values.assigned_user_id}::uuid
        and organization_id = ${organizationId}::uuid
      limit 1
    `;

    if (!assignedRows[0]) {
      fieldErrors.assigned_user_id = "Selected assigned user is not part of this workspace.";
    } else {
      try {
        await ensureCanAssignUser(values.assigned_user_id);
      } catch (error) {
        fieldErrors.assigned_user_id = error instanceof Error ? error.message : "You cannot assign this user.";
      }
    }
  }

  return fieldErrors;
}

async function requireInteractionInOrganization(interactionId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<InteractionLookup[]>`
    select
      id::text as id,
      company_id::text as company_id,
      contact_person_id::text as contact_person_id,
      assigned_user_id::text as assigned_user_id,
      interaction_type,
      discussion_details,
      next_action,
      next_followup_at::text as next_followup_at,
      need_help,
      completed_at::text as completed_at,
      success_rating,
      lead_temperature
    from public.interactions
    where id = ${interactionId}::uuid
      and organization_id = ${organization.id}::uuid
    limit 1
  `;

  const interaction = rows[0] ?? null;
  if (!interaction) {
    throw new Error("Meeting was not found in your workspace.");
  }

  return { organization, interaction };
}

function mapInteractionToFollowupType(interactionType: string) {
  const supportedTypes = new Set([
    "Phone Call",
    "Email",
    "WhatsApp",
    "Physical Meeting",
    "Online Meeting",
    "Quotation Follow-up",
    "Payment Follow-up",
    "Technical Follow-up",
    "Demo Follow-up",
    "Decision Follow-up",
    "Other",
  ]);

  const mappedType = interactionType === "WhatsApp Discussion"
    ? "WhatsApp"
    : interactionType === "Email Follow-up"
      ? "Email"
      : interactionType === "Physical Meeting"
        ? "Physical Meeting"
        : interactionType === "Online Meeting"
          ? "Online Meeting"
          : interactionType === "Phone Call"
            ? "Phone Call"
            : interactionType === "Technical Meeting"
              ? "Technical Follow-up"
              : interactionType === "Demo Meeting"
                ? "Demo Follow-up"
                : interactionType === "Quotation Discussion"
                  ? "Quotation Follow-up"
                  : interactionType === "Payment Discussion"
                    ? "Payment Follow-up"
                    : interactionType === "Closing Meeting"
                      ? "Decision Follow-up"
                      : "Other";

  return supportedTypes.has(mappedType) ? mappedType : "Other";
}

async function updateCompanyRatingFromInteraction(companyId: string, rating: number | null, temperature: string | null) {
  if (!rating) return;

  const organization = await requireOrganization();
  const resolvedTemperature = temperature ?? temperatureFromRating(rating);

  await prisma.$executeRaw`
    update public.companies
    set success_rating = ${rating},
        lead_temperature = ${resolvedTemperature}
    where id = ${companyId}::uuid
      and organization_id = ${organization.id}::uuid
  `;

  await insertActivityLog("company.rating_updated_from_meeting", "company", companyId, {
    success_rating: rating,
    lead_temperature: resolvedTemperature,
  });
}

async function getExistingCompanyStage(companyId: string, organizationId: string) {
  const rows = await prisma.$queryRaw<ExistingCompanyStage[]>`
    select
      c.pipeline_stage_id::text as pipeline_stage_id,
      ps.position as previous_position,
      ps.is_won as previous_is_won,
      ps.is_lost as previous_is_lost
    from public.companies c
    left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id
    where c.id = ${companyId}::uuid
      and c.organization_id = ${organizationId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

async function getCompanyByIdForMove(companyId: string, organizationId: string) {
  const rows = await prisma.$queryRaw<CompanyLookup[]>`
    select
      id::text as id,
      name,
      pipeline_stage_id::text as pipeline_stage_id
    from public.companies
    where id = ${companyId}::uuid
      and organization_id = ${organizationId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

export async function createIndustryAction(values: unknown): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const parsed = industrySchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  try {
    await prisma.$executeRaw`
      insert into public.industries (
        organization_id,
        name,
        description,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      values (
        ${organization.id}::uuid,
        ${parsed.data.name},
        ${parsed.data.description},
        ${parsed.data.status},
        null,
        null,
        now(),
        now()
      )
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the industry right now.") };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/industries");
  return { ok: true };
}

export async function updateIndustryAction(id: string, values: unknown): Promise<CrmActionState> {
  const organization = await requireOrganization();
  const parsed = industrySchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  try {
    await prisma.$executeRaw`
      update public.industries
      set
        name = ${parsed.data.name},
        description = ${parsed.data.description},
        status = ${parsed.data.status}
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update the industry right now.") };
  }

  revalidatePath("/settings/industries");
  return { ok: true };
}

export async function archiveIndustryAction(id: string): Promise<CrmActionState> {
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.industries
      set status = 'archived'
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the industry right now.") };
  }

  revalidatePath("/settings/industries");
  return { ok: true };
}

export async function createCompanyCategoryAction(values: unknown): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const parsed = companyCategorySchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  try {
    await prisma.$executeRaw`
      insert into public.company_categories (
        organization_id,
        name,
        code,
        description,
        priority_level,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      values (
        ${organization.id}::uuid,
        ${parsed.data.name},
        ${makeShortCode(parsed.data.code ?? parsed.data.name)},
        ${parsed.data.description},
        ${parsed.data.priority_level},
        ${parsed.data.status},
        null,
        null,
        now(),
        now()
      )
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the category right now.") };
  }

  revalidatePath("/settings/company-categories");
  return { ok: true };
}

export async function updateCompanyCategoryAction(id: string, values: unknown): Promise<CrmActionState> {
  const organization = await requireOrganization();
  const parsed = companyCategorySchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  try {
    await prisma.$executeRaw`
      update public.company_categories
      set
        name = ${parsed.data.name},
        code = ${makeShortCode(parsed.data.code ?? parsed.data.name)},
        description = ${parsed.data.description},
        priority_level = ${parsed.data.priority_level},
        status = ${parsed.data.status}
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update the category right now.") };
  }

  revalidatePath("/settings/company-categories");
  return { ok: true };
}

export async function archiveCompanyCategoryAction(id: string): Promise<CrmActionState> {
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.company_categories
      set status = 'archived'
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the category right now.") };
  }

  revalidatePath("/settings/company-categories");
  return { ok: true };
}

export async function createPipelineStageAction(values: unknown): Promise<CrmActionState> {
  const organization = await requireOrganization();
  const parsed = pipelineStageSchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  try {
    await prisma.$executeRaw`
      insert into public.pipeline_stages (
        organization_id,
        name,
        slug,
        color,
        probability,
        position,
        is_won,
        is_lost,
        is_active
      )
      values (
        ${organization.id}::uuid,
        ${parsed.data.name},
        ${`${slugify(parsed.data.name)}-${Date.now()}`},
        ${parsed.data.color},
        ${parsed.data.probability},
        ${parsed.data.position},
        ${parsed.data.is_won},
        ${parsed.data.is_lost},
        ${parsed.data.is_active}
      )
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the pipeline stage right now.") };
  }

  revalidatePath("/settings/pipeline");
  return { ok: true };
}

export async function updatePipelineStageAction(id: string, values: unknown): Promise<CrmActionState> {
  const organization = await requireOrganization();
  const parsed = pipelineStageSchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  try {
    await prisma.$executeRaw`
      update public.pipeline_stages
      set
        name = ${parsed.data.name},
        color = ${parsed.data.color},
        probability = ${parsed.data.probability},
        position = ${parsed.data.position},
        is_won = ${parsed.data.is_won},
        is_lost = ${parsed.data.is_lost},
        is_active = ${parsed.data.is_active}
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update the pipeline stage right now.") };
  }

  revalidatePath("/settings/pipeline");
  revalidatePath("/companies");
  return { ok: true };
}

export async function archivePipelineStageAction(id: string): Promise<CrmActionState> {
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.pipeline_stages
      set is_active = false
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the pipeline stage right now.") };
  }

  revalidatePath("/settings/pipeline");
  return { ok: true };
}

export async function createCompanyAction(values: unknown): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const parsed = companySchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  const relationErrors = await validateCompanyRelations(organization.id, parsed.data);
  if (Object.keys(relationErrors).length > 0) {
    return {
      ok: false,
      error: Object.values(relationErrors)[0],
      fieldErrors: relationErrors,
    };
  }

  const leadTemperature = resolveCompanyLeadTemperature(
    parsed.data.lead_temperature,
    parsed.data.success_rating,
  );
  const phoneNumbers = buildContactValues(parsed.data.phone, parsed.data.phone_numbers);
  const emailAddresses = buildEmailValues(parsed.data.email, parsed.data.email_addresses);
  const primaryPhone = getPrimaryContactValue(phoneNumbers);
  const primaryEmail = getPrimaryContactValue(emailAddresses);

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      insert into public.companies (
        organization_id,
        name,
        industry_id,
        category_id,
        lead_source,
        referred_by_user_id,
        priority,
        assigned_user_id,
        pipeline_stage_id,
        status,
        phone,
        phone_numbers,
        whatsapp,
        email,
        email_addresses,
        website,
        address,
          city,
          country,
          success_rating,
          lead_temperature,
        estimated_value,
        expected_closing_date,
        notes,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      values (
        ${organization.id}::uuid,
        ${parsed.data.name},
        ${parsed.data.industry_id}::uuid,
        ${parsed.data.category_id}::uuid,
        ${parsed.data.lead_source},
        ${parsed.data.referred_by_user_id}::uuid,
        ${parsed.data.priority},
        ${parsed.data.assigned_user_id}::uuid,
        ${parsed.data.pipeline_stage_id}::uuid,
        ${parsed.data.status},
        ${primaryPhone},
        ${JSON.stringify(phoneNumbers)}::jsonb,
        ${parsed.data.whatsapp},
        ${primaryEmail},
        ${JSON.stringify(emailAddresses)}::jsonb,
        ${parsed.data.website},
        ${parsed.data.address},
          ${parsed.data.city},
          ${parsed.data.country},
          ${parsed.data.success_rating},
          ${leadTemperature},
          ${parsed.data.estimated_value},
          ${parsed.data.expected_closing_date}::date,
          ${parsed.data.notes},
        null,
        null,
        now(),
        now()
      )
      returning id::text as id
    `;

    const companyId = rows[0]?.id;
    if (!companyId) {
      return { ok: false, error: "Unable to create the company right now." };
    }

    await insertActivityLog("company.created", "company", companyId, { name: parsed.data.name });

    try {
      await applyScoringEvent({
        organizationId: organization.id,
        userId: user.id,
        actionKey: "lead_created",
        companyId,
        sourceRecordId: companyId,
        sourceRecordType: "company",
        metadata: {
          company_name: parsed.data.name,
          lead_source: parsed.data.lead_source,
        },
        actorUserId: user.id,
        addToLeadScore: true,
        idempotencyKey: buildScoreIdempotencyKey(["lead_created", companyId]),
      });
    } catch (error) {
      logServerError("company.create.scoring", error, {
        organizationId: organization.id,
        companyId,
        userId: user.id,
      });
    }

    if (parsed.data.lead_source) {
      try {
        await applyScoringEvent({
          organizationId: organization.id,
          userId: user.id,
          actionKey: "lead_source_bonus",
          companyId,
          sourceRecordId: companyId,
          sourceRecordType: "company",
          metadata: {
            company_name: parsed.data.name,
            lead_source: parsed.data.lead_source,
          },
          actorUserId: user.id,
          addToLeadScore: true,
          idempotencyKey: buildScoreIdempotencyKey(["lead_source_bonus", companyId, parsed.data.lead_source]),
        });
      } catch (error) {
        logServerError("company.create.lead_source_scoring", error, {
          organizationId: organization.id,
          companyId,
          leadSource: parsed.data.lead_source,
          userId: user.id,
        });
      }
    }

    if (parsed.data.referred_by_user_id && parsed.data.referred_by_user_id !== user.id) {
      await applyScoringEvent({
        organizationId: organization.id,
        userId: parsed.data.referred_by_user_id,
        actionKey: "lead_referral",
        companyId,
        sourceRecordId: companyId,
        sourceRecordType: "company",
        metadata: {
          company_name: parsed.data.name,
          referred_user_id: parsed.data.referred_by_user_id,
          created_by_user_id: user.id,
        },
        actorUserId: user.id,
        addToLeadScore: true,
        idempotencyKey: buildScoreIdempotencyKey(["lead_referral", companyId, parsed.data.referred_by_user_id]),
      });
    }

    revalidatePath("/companies");
    return { ok: true, id: companyId };
  } catch (error) {
    logServerError("company.create", error, { organizationId: organization.id, name: parsed.data.name });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the company right now.") };
  }
}

export async function updateCompanyAction(id: string, values: unknown): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const parsed = companySchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);
  await ensureCanWorkWithCompany(id);

  const relationErrors = await validateCompanyRelations(organization.id, parsed.data);
  if (Object.keys(relationErrors).length > 0) {
    return {
      ok: false,
      error: Object.values(relationErrors)[0],
      fieldErrors: relationErrors,
    };
  }

  const leadTemperature = resolveCompanyLeadTemperature(
    parsed.data.lead_temperature,
    parsed.data.success_rating,
  );
  const phoneNumbers = buildContactValues(parsed.data.phone, parsed.data.phone_numbers);
  const emailAddresses = buildEmailValues(parsed.data.email, parsed.data.email_addresses);
  const primaryPhone = getPrimaryContactValue(phoneNumbers);
  const primaryEmail = getPrimaryContactValue(emailAddresses);

  try {
    const existing = await getExistingCompanyStage(id, organization.id);

    await prisma.$executeRaw`
      update public.companies
      set
        name = ${parsed.data.name},
        industry_id = ${parsed.data.industry_id}::uuid,
        category_id = ${parsed.data.category_id}::uuid,
        lead_source = ${parsed.data.lead_source},
        referred_by_user_id = ${parsed.data.referred_by_user_id}::uuid,
        priority = ${parsed.data.priority},
        assigned_user_id = ${parsed.data.assigned_user_id}::uuid,
        pipeline_stage_id = ${parsed.data.pipeline_stage_id}::uuid,
        status = ${parsed.data.status},
        phone = ${primaryPhone},
        phone_numbers = ${JSON.stringify(phoneNumbers)}::jsonb,
        whatsapp = ${parsed.data.whatsapp},
        email = ${primaryEmail},
        email_addresses = ${JSON.stringify(emailAddresses)}::jsonb,
        website = ${parsed.data.website},
        address = ${parsed.data.address},
          city = ${parsed.data.city},
          country = ${parsed.data.country},
          success_rating = ${parsed.data.success_rating},
          lead_temperature = ${leadTemperature},
          estimated_value = ${parsed.data.estimated_value},
        expected_closing_date = ${parsed.data.expected_closing_date}::date,
        notes = ${parsed.data.notes}
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("company.updated", "company", id);
    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior updated a company",
      message: `${parsed.data.name} was updated by one of your assigned team members.`,
      link: `/companies/${id}`,
    });

    if (existing?.pipeline_stage_id !== parsed.data.pipeline_stage_id) {
      await insertActivityLog("company.pipeline_stage_changed", "company", id, {
        from: existing?.pipeline_stage_id,
        to: parsed.data.pipeline_stage_id,
      });

      const nextStage = await getPipelineStageInOrganization(parsed.data.pipeline_stage_id);
      const movedForward =
        typeof existing?.previous_position === "number"
          ? nextStage.position > existing.previous_position
          : false;

      if (movedForward && !nextStage.is_won && !nextStage.is_lost) {
        await applyScoringEvent({
          organizationId: organization.id,
          userId: user.id,
          actionKey: "lead_qualified",
          companyId: id,
          sourceRecordId: parsed.data.pipeline_stage_id,
          sourceRecordType: "pipeline_stage",
          metadata: {
            from_stage_id: existing?.pipeline_stage_id,
            to_stage_id: parsed.data.pipeline_stage_id,
            to_stage_name: nextStage.name,
          },
          actorUserId: user.id,
          addToLeadScore: true,
          idempotencyKey: buildScoreIdempotencyKey(["lead_qualified", id, parsed.data.pipeline_stage_id]),
        });
      }

      const wasWon = Boolean(existing?.previous_is_won);
      if (!wasWon && nextStage.is_won) {
        await applyScoringEvent({
          organizationId: organization.id,
          userId: user.id,
          actionKey: "lead_converted_won",
          companyId: id,
          sourceRecordId: id,
          sourceRecordType: "company",
          metadata: {
            from_stage_id: existing?.pipeline_stage_id,
            to_stage_id: parsed.data.pipeline_stage_id,
            to_stage_name: nextStage.name,
          },
          actorUserId: user.id,
          addToLeadScore: true,
          idempotencyKey: buildScoreIdempotencyKey(["lead_converted_won", id]),
        });
      }
    }

    revalidatePath("/companies");
    revalidatePath(`/companies/${id}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to update the company right now.") };
  }
}

export async function archiveCompanyAction(id: string): Promise<CrmActionState> {
  const organization = await requireOrganization();

  try {
    await prisma.$executeRaw`
      update public.companies
      set status = 'archived'
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to archive the company right now.") };
  }

  await insertActivityLog("company.archived", "company", id);
  revalidatePath("/companies");
  return { ok: true };
}

export async function createContactAction(values: unknown): Promise<CrmActionState> {
  const user = await requireAuth();
  const parsed = contactPersonSchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  const mobileNumbers = buildContactValues(parsed.data.mobile, parsed.data.mobile_numbers);
  const emailAddresses = buildEmailValues(parsed.data.email, parsed.data.email_addresses);
  const primaryMobile = getPrimaryContactValue(mobileNumbers);
  const primaryEmail = getPrimaryContactValue(emailAddresses);

  try {
    const { organization } = await requireCompanyInOrganization(parsed.data.company_id);
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      insert into public.contact_persons (
        organization_id,
        company_id,
        name,
        designation,
        department,
        mobile,
        mobile_numbers,
        whatsapp,
        email,
        email_addresses,
        linkedin,
        decision_role,
        relationship_level,
        preferred_contact_method,
        remarks,
        is_primary,
        status,
        created_by,
        updated_by
      )
      values (
        ${organization.id}::uuid,
        ${parsed.data.company_id}::uuid,
        ${parsed.data.name},
        ${parsed.data.designation},
        ${parsed.data.department},
        ${primaryMobile},
        ${JSON.stringify(mobileNumbers)}::jsonb,
        ${parsed.data.whatsapp},
        ${primaryEmail},
        ${JSON.stringify(emailAddresses)}::jsonb,
        ${parsed.data.linkedin},
        ${parsed.data.decision_role},
        ${parsed.data.relationship_level},
        ${parsed.data.preferred_contact_method},
        ${parsed.data.remarks},
        ${parsed.data.is_primary},
        ${parsed.data.status},
        ${user.id}::uuid,
        ${user.id}::uuid
      )
      returning id::text as id
    `;

    const contactId = rows[0]?.id;
    if (!contactId) {
      return { ok: false, error: "Unable to create the contact right now." };
    }

    await insertActivityLog("contact.created", "contact_person", contactId, {
      company_id: parsed.data.company_id,
      name: parsed.data.name,
    });

    if (parsed.data.is_primary) {
      await insertActivityLog("contact.primary_changed", "contact_person", contactId, {
        company_id: parsed.data.company_id,
      });
    }

    revalidatePath("/contacts");
    revalidatePath(`/companies/${parsed.data.company_id}`);
    return { ok: true, id: contactId };
  } catch (error) {
    logServerError("contact.create", error, { companyId: parsed.data.company_id, name: parsed.data.name });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the contact right now.") };
  }
}

export async function updateContactAction(id: string, values: unknown): Promise<CrmActionState> {
  const parsed = contactPersonSchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);

  const mobileNumbers = buildContactValues(parsed.data.mobile, parsed.data.mobile_numbers);
  const emailAddresses = buildEmailValues(parsed.data.email, parsed.data.email_addresses);
  const primaryMobile = getPrimaryContactValue(mobileNumbers);
  const primaryEmail = getPrimaryContactValue(emailAddresses);

  try {
    const { organization, contact } = await requireContactInOrganization(id);
    await requireCompanyInOrganization(parsed.data.company_id);

    await prisma.$executeRaw`
      update public.contact_persons
      set
        company_id = ${parsed.data.company_id}::uuid,
        name = ${parsed.data.name},
        designation = ${parsed.data.designation},
        department = ${parsed.data.department},
        mobile = ${primaryMobile},
        mobile_numbers = ${JSON.stringify(mobileNumbers)}::jsonb,
        whatsapp = ${parsed.data.whatsapp},
        email = ${primaryEmail},
        email_addresses = ${JSON.stringify(emailAddresses)}::jsonb,
        linkedin = ${parsed.data.linkedin},
        decision_role = ${parsed.data.decision_role},
        relationship_level = ${parsed.data.relationship_level},
        preferred_contact_method = ${parsed.data.preferred_contact_method},
        remarks = ${parsed.data.remarks},
        is_primary = ${parsed.data.is_primary},
        status = ${parsed.data.status}
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("contact.updated", "contact_person", id, {
      company_id: parsed.data.company_id,
    });

    if (!contact.is_primary && parsed.data.is_primary) {
      await insertActivityLog("contact.primary_changed", "contact_person", id, {
        company_id: parsed.data.company_id,
      });
    }

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    revalidatePath(`/companies/${contact.company_id}`);
    revalidatePath(`/companies/${parsed.data.company_id}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update contact." };
  }
}

export async function archiveContactAction(id: string): Promise<CrmActionState> {
  try {
    const { organization, contact } = await requireContactInOrganization(id);

    await prisma.$executeRaw`
      update public.contact_persons
      set status = 'archived',
          is_primary = false
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("contact.archived", "contact_person", id, {
      company_id: contact.company_id,
    });

    revalidatePath("/contacts");
    revalidatePath(`/companies/${contact.company_id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to archive contact." };
  }
}

export async function createInteractionAction(values: unknown): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const parsed = interactionSchema.safeParse(values);

  if (!parsed.success) return getValidationState(parsed.error);
  await ensureCanWorkWithCompany(parsed.data.company_id);

  const relationErrors = await validateInteractionRelations(organization.id, parsed.data);
  if (Object.keys(relationErrors).length > 0) {
    return { ok: false, error: Object.values(relationErrors)[0], fieldErrors: relationErrors };
  }

  const meetingDatetime = parsed.data.meeting_datetime ?? new Date().toISOString();
  const leadTemperature = parsed.data.lead_temperature ?? temperatureFromRating(parsed.data.success_rating);

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      insert into public.interactions (
        organization_id,
        company_id,
        contact_person_id,
        assigned_user_id,
        interaction_type,
        meeting_datetime,
        location,
        online_meeting_link,
        discussion_details,
        client_requirement,
        pain_point,
        proposed_solution,
        budget_discussion,
        competitor_mentioned,
        decision_timeline,
        success_rating,
        lead_temperature,
        next_action,
        next_followup_at,
        need_help,
        internal_note,
        status,
        created_by,
        updated_by
      )
      values (
        ${organization.id}::uuid,
        ${parsed.data.company_id}::uuid,
        ${parsed.data.contact_person_id}::uuid,
        ${parsed.data.assigned_user_id}::uuid,
        ${parsed.data.interaction_type},
        ${meetingDatetime}::timestamptz,
        ${parsed.data.location},
        ${parsed.data.online_meeting_link},
        ${parsed.data.discussion_details},
        ${parsed.data.client_requirement},
        ${parsed.data.pain_point},
        ${parsed.data.proposed_solution},
        ${parsed.data.budget_discussion},
        ${parsed.data.competitor_mentioned},
        ${parsed.data.decision_timeline},
        ${parsed.data.success_rating},
        ${leadTemperature},
        ${parsed.data.next_action},
        ${parsed.data.next_followup_at}::timestamptz,
        ${parsed.data.need_help},
        ${parsed.data.internal_note},
        ${parsed.data.status},
        ${user.id}::uuid,
        ${user.id}::uuid
      )
      returning id::text as id
    `;

    const interactionId = rows[0]?.id;
    if (!interactionId) {
      return { ok: false, error: "Unable to create the meeting right now." };
    }

    await insertActivityLog("meeting.created", "interaction", interactionId, { company_id: parsed.data.company_id });
    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior logged a meeting",
      message: "A direct junior team member logged a company meeting or interaction.",
      link: `/meetings/${interactionId}`,
    });

    if (parsed.data.next_followup_at) {
      await insertActivityLog("meeting.next_followup_added", "interaction", interactionId, {
        next_followup_at: parsed.data.next_followup_at,
      });
    }

    if (parsed.data.assigned_user_id && parsed.data.assigned_user_id !== user.id) {
      await createWorkspaceNotification({
        userId: parsed.data.assigned_user_id,
        type: "meeting.assigned",
        title: "New meeting assigned",
        message: "A new meeting or interaction has been assigned to you.",
        link: `/meetings/${interactionId}`,
      });
    }

    await updateCompanyRatingFromInteraction(parsed.data.company_id, parsed.data.success_rating, leadTemperature);
    revalidatePath("/meetings");
    revalidatePath(`/companies/${parsed.data.company_id}`);
    return { ok: true, id: interactionId };
  } catch (error) {
    logServerError("meeting.create", error, { organizationId: organization.id, companyId: parsed.data.company_id });
    return { ok: false, error: getSafeErrorMessage(error, "Unable to create the meeting right now.") };
  }
}

export async function updateInteractionAction(id: string, values: unknown): Promise<CrmActionState> {
  const parsed = interactionSchema.safeParse(values);
  if (!parsed.success) return getValidationState(parsed.error);

  try {
    const user = await requireAuth();
    const { organization, interaction } = await requireInteractionInOrganization(id);
    await ensureCanWorkWithCompany(interaction.company_id);

    const relationErrors = await validateInteractionRelations(organization.id, parsed.data);
    if (Object.keys(relationErrors).length > 0) {
      return { ok: false, error: Object.values(relationErrors)[0], fieldErrors: relationErrors };
    }

    const leadTemperature = parsed.data.lead_temperature ?? temperatureFromRating(parsed.data.success_rating);

    await prisma.$executeRaw`
      update public.interactions
      set
        company_id = ${parsed.data.company_id}::uuid,
        contact_person_id = ${parsed.data.contact_person_id}::uuid,
        assigned_user_id = ${parsed.data.assigned_user_id}::uuid,
        interaction_type = ${parsed.data.interaction_type},
        meeting_datetime = ${(parsed.data.meeting_datetime ?? new Date().toISOString())}::timestamptz,
        location = ${parsed.data.location},
        online_meeting_link = ${parsed.data.online_meeting_link},
        discussion_details = ${parsed.data.discussion_details},
        client_requirement = ${parsed.data.client_requirement},
        pain_point = ${parsed.data.pain_point},
        proposed_solution = ${parsed.data.proposed_solution},
        budget_discussion = ${parsed.data.budget_discussion},
        competitor_mentioned = ${parsed.data.competitor_mentioned},
        decision_timeline = ${parsed.data.decision_timeline},
        success_rating = ${parsed.data.success_rating},
        lead_temperature = ${leadTemperature},
        next_action = ${parsed.data.next_action},
        next_followup_at = ${parsed.data.next_followup_at}::timestamptz,
        need_help = ${parsed.data.need_help},
        internal_note = ${parsed.data.internal_note},
        status = ${parsed.data.status}
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("meeting.updated", "interaction", id, { company_id: parsed.data.company_id });
    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior updated a meeting",
      message: "A direct junior team member updated a company meeting or interaction.",
      link: `/meetings/${id}`,
    });

    if (parsed.data.next_followup_at) {
      await insertActivityLog("meeting.next_followup_added", "interaction", id, {
        next_followup_at: parsed.data.next_followup_at,
      });
    }

    await updateCompanyRatingFromInteraction(parsed.data.company_id, parsed.data.success_rating, leadTemperature);
    revalidatePath("/meetings");
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/companies/${interaction.company_id}`);
    revalidatePath(`/companies/${parsed.data.company_id}`);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update meeting." };
  }
}

export async function archiveInteractionAction(id: string): Promise<CrmActionState> {
  try {
    const { organization, interaction } = await requireInteractionInOrganization(id);

    await prisma.$executeRaw`
      update public.interactions
      set status = 'archived'
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("meeting.archived", "interaction", id, { company_id: interaction.company_id });
    revalidatePath("/meetings");
    revalidatePath(`/companies/${interaction.company_id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to archive meeting." };
  }
}

export async function completeInteractionAction(id: string, values: unknown): Promise<CrmActionState> {
  const parsed = quickCompleteInteractionSchema.safeParse(values);
  if (!parsed.success) return getValidationState(parsed.error);

  try {
    const interactionCompletionEnabled = await hasInteractionCompletionSupport();
    if (!interactionCompletionEnabled) {
      return {
        ok: false,
        error: "Meeting quick completion needs the latest database update. Please refresh after applying the latest migration.",
      };
    }

    const user = await requireAuth();
    const { organization, interaction } = await requireInteractionInOrganization(id);
    await ensureCanWorkWithCompany(interaction.company_id);

    const leadTemperature = temperatureFromRating(interaction.success_rating) ?? interaction.lead_temperature;

    await prisma.$executeRaw`
      update public.interactions
      set
        discussion_details = ${parsed.data.discussion_details},
        next_action = ${parsed.data.next_action},
        next_followup_at = ${parsed.data.next_followup_at}::timestamptz,
        need_help = ${parsed.data.need_help},
        completed_at = coalesce(completed_at, now()),
        completed_by = coalesce(completed_by, ${user.id}::uuid),
        updated_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    if (parsed.data.create_followup_now && parsed.data.next_followup_at) {
      const followupTitle =
        parsed.data.next_action?.trim() || `${interaction.interaction_type} follow-up`;

      await prisma.$executeRaw`
        insert into public.followups (
          organization_id,
          company_id,
          contact_person_id,
          interaction_id,
          assigned_user_id,
          followup_type,
          title,
          description,
          scheduled_at,
          reminder_before_minutes,
          status,
          priority,
          created_by,
          updated_by
        )
        values (
          ${organization.id}::uuid,
          ${interaction.company_id}::uuid,
          ${interaction.contact_person_id}::uuid,
          ${id}::uuid,
          ${interaction.assigned_user_id ?? user.id}::uuid,
          ${mapInteractionToFollowupType(interaction.interaction_type)},
          ${followupTitle},
          ${parsed.data.discussion_details},
          ${parsed.data.next_followup_at}::timestamptz,
          60,
          'pending',
          'medium',
          ${user.id}::uuid,
          ${user.id}::uuid
        )
      `;

      await insertActivityLog("meeting.followup_created_from_quick_done", "interaction", id, {
        next_followup_at: parsed.data.next_followup_at,
        title: followupTitle,
      });
    }

    await insertActivityLog("meeting.completed", "interaction", id, {
      next_action: parsed.data.next_action,
      next_followup_at: parsed.data.next_followup_at,
      need_help: parsed.data.need_help,
      created_followup_now: parsed.data.create_followup_now,
    });

    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior completed a meeting",
      message: "A direct junior team member closed out a meeting and captured the next step.",
      link: `/meetings/${id}`,
    });

    await applyScoringEvent({
      organizationId: organization.id,
      userId: user.id,
      actionKey: "meeting-done",
      companyId: interaction.company_id,
      sourceRecordId: id,
      sourceRecordType: "interaction",
      metadata: {
        interaction_type: interaction.interaction_type,
        company_id: interaction.company_id,
        create_followup_now: parsed.data.create_followup_now,
      },
      actorUserId: user.id,
      addToLeadScore: true,
      idempotencyKey: buildScoreIdempotencyKey(["meeting-done", id]),
    });

    await updateCompanyRatingFromInteraction(interaction.company_id, interaction.success_rating, leadTemperature);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/todo-tasks");
    revalidatePath("/dashboard/completed-tasks");
    revalidatePath("/meetings");
    revalidatePath(`/meetings/${id}`);
    revalidatePath(`/companies/${interaction.company_id}`);
    if (interaction.contact_person_id) {
      revalidatePath(`/contacts/${interaction.contact_person_id}`);
    }
    if (parsed.data.create_followup_now) {
      revalidatePath("/followups");
    }

    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to complete the meeting right now.") };
  }
}

export async function setPrimaryContactAction(id: string): Promise<CrmActionState> {
  try {
    const { organization, contact } = await requireContactInOrganization(id);

    await prisma.$executeRaw`
      update public.contact_persons
      set is_primary = true
      where id = ${id}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("contact.primary_changed", "contact_person", id, {
      company_id: contact.company_id,
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    revalidatePath(`/companies/${contact.company_id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to set primary contact." };
  }
}

export async function moveCompanyToPipelineStage(companyId: string, stageId: string): Promise<CrmActionState> {
  const user = await requireAuth();
  const organization = await requireOrganization();

  try {
    await ensureCanWorkWithCompany(companyId);

    const [stage, existingCompany] = await Promise.all([
      getPipelineStageInOrganization(stageId),
      getCompanyByIdForMove(companyId, organization.id),
    ]);

    if (!existingCompany) {
      return { ok: false, error: "Company was not found in your workspace." };
    }

    if (existingCompany.pipeline_stage_id === stage.id) {
      return { ok: true, id: companyId };
    }

    await prisma.$executeRaw`
      update public.companies
      set
        pipeline_stage_id = ${stage.id}::uuid,
        updated_by = null,
        updated_at = now()
      where id = ${companyId}::uuid
        and organization_id = ${organization.id}::uuid
    `;

    await insertActivityLog("company.pipeline_stage_changed", "company", companyId, {
      from: existingCompany.pipeline_stage_id,
      to: stage.id,
      to_stage_name: stage.name,
      is_won: stage.is_won,
      is_lost: stage.is_lost,
    });

    await notifyDirectManagerOfActivity({
      actorUserId: user.id,
      title: "Junior moved a lead stage",
      message: `${existingCompany.name} moved to ${stage.name}.`,
      link: `/companies/${companyId}`,
    });

    revalidatePath("/pipeline");
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    revalidatePath("/reports");
    return { ok: true, id: companyId };
  } catch (error) {
    logServerError("company.pipeline_stage_move", error, {
      organizationId: organization.id,
      companyId,
      stageId,
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to move the company in the pipeline right now.",
    };
  }
}

export async function markCompanyWon(companyId: string): Promise<CrmActionState> {
  const organization = await requireOrganization();

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.pipeline_stages
      where organization_id = ${organization.id}::uuid
        and is_active = true
        and is_won = true
      order by position asc
      limit 1
    `;

    const stage = rows[0] ?? null;
    if (!stage) {
      return { ok: false, error: "No active Won stage is configured for this workspace." };
    }

    return moveCompanyToPipelineStage(companyId, stage.id);
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to move the company right now.") };
  }
}

export async function markCompanyLost(companyId: string): Promise<CrmActionState> {
  const organization = await requireOrganization();

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from public.pipeline_stages
      where organization_id = ${organization.id}::uuid
        and is_active = true
        and is_lost = true
      order by position asc
      limit 1
    `;

    const stage = rows[0] ?? null;
    if (!stage) {
      return { ok: false, error: "No active Lost stage is configured for this workspace." };
    }

    return moveCompanyToPipelineStage(companyId, stage.id);
  } catch (error) {
    return { ok: false, error: getSafeErrorMessage(error, "Unable to move the company right now.") };
  }
}
