import { z } from "zod";

export function emptyToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export function emptyToNull(value: unknown) {
  const normalized = emptyToUndefined(value);
  return normalized === undefined ? null : normalized;
}

function preprocessOptionalText(value: unknown) {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) {
    return undefined;
  }

  if (typeof normalized === "string") {
    return normalized.trim();
  }

  return normalized;
}

function preprocessOptionalNumber(value: unknown) {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) {
    return undefined;
  }

  if (typeof normalized === "number") {
    return normalized;
  }

  if (typeof normalized === "string") {
    return Number(normalized);
  }

  return normalized;
}

export const optionalString = z.preprocess(
  preprocessOptionalText,
  z.string({ invalid_type_error: "Please enter a valid value." }).optional(),
).transform((value) => value ?? null);

export const optionalUuid = z.preprocess(
  emptyToUndefined,
  z.string().uuid("Please select a valid option.").optional(),
).transform((value) => value ?? null);

export const optionalEmail = z.preprocess(
  preprocessOptionalText,
  z.string().email("Please enter a valid email address.").optional(),
).transform((value) => value ?? null);

export function optionalUrl(message = "Please enter a valid website URL.") {
  return z.preprocess(
    preprocessOptionalText,
    z.string().url(message).optional(),
  ).transform((value) => value ?? null);
}

export function optionalNumber(schema: z.ZodNumber) {
  return z.preprocess(
    preprocessOptionalNumber,
    schema.optional(),
  ).transform((value) => value ?? null);
}

export const optionalDate = z.preprocess(
  preprocessOptionalText,
  z.string({ invalid_type_error: "Please enter a valid date." }).optional(),
).transform((value) => value ?? null);

export const optionalDateTime = z.preprocess(
  preprocessOptionalText,
  z.string({ invalid_type_error: "Please enter a valid date and time." }).optional(),
).transform((value) => value ?? null);

const optionalNumberWithDefault = (schema: z.ZodNumber, fallback: number) => z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? fallback : value),
  schema,
);

const companyPrioritySchema = z.enum(["low", "medium", "high", "urgent"], {
  invalid_type_error: "Please select a valid option.",
});
const leadTemperatureSchema = z.enum(["cold", "warm", "hot", "very_hot"], {
  invalid_type_error: "Please select a valid option.",
});

function requiredEnum<const T extends readonly [string, ...string[]]>(values: T, requiredMessage: string) {
  return z.preprocess(
    emptyToUndefined,
    z.enum(values, {
      required_error: requiredMessage,
      invalid_type_error: "Please select a valid option.",
    }),
  );
}

function optionalEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    emptyToUndefined,
    z.enum(values, {
      invalid_type_error: "Please select a valid option.",
    }).optional(),
  ).transform((value) => value ?? null);
}

export const statusSchema = requiredEnum(["active", "inactive", "archived"], "Status is required.");

export const industrySchema = z.object({
  name: z.string().trim().min(2, "Industry name is required."),
  description: optionalString,
  status: statusSchema.default("active"),
});

export const companyCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required."),
  code: z.preprocess(
    preprocessOptionalText,
    z.string().max(12, "Use a short category code.").optional(),
  ).transform((value) => value ?? null),
  description: optionalString,
  priority_level: optionalNumberWithDefault(z.coerce.number().int().min(1).max(5), 3),
  status: statusSchema.default("active"),
});

export const pipelineStageSchema = z.object({
  name: z.string().trim().min(2, "Stage name is required."),
  color: z.string().optional().transform((value) => value || "#0f766e").pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a valid hex color.")),
  probability: optionalNumberWithDefault(z.coerce.number().int().min(0).max(100), 0),
  position: optionalNumberWithDefault(z.coerce.number().int().min(1), 1),
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const companySchema = z.object({
  name: z.string().trim().min(2, "Company name is required."),
  industry_id: optionalUuid,
  category_id: optionalUuid,
  lead_source: optionalString,
  referred_by_user_id: optionalUuid,
  priority: z.preprocess(emptyToUndefined, companyPrioritySchema.optional()).transform((value) => value ?? "medium"),
  assigned_user_id: optionalUuid,
  pipeline_stage_id: z.preprocess(
    emptyToUndefined,
    z.string({
      required_error: "Pipeline stage is required.",
      invalid_type_error: "Pipeline stage is required.",
    }).uuid("Please select a valid option."),
  ),
  status: statusSchema,
  phone: optionalString,
  whatsapp: optionalString,
  email: optionalEmail,
  website: optionalUrl(),
  address: optionalString,
  city: optionalString,
  country: optionalString,
  success_rating: optionalNumber(z.coerce.number().int().min(1, "Success rating must be between 1 and 10.").max(10, "Success rating must be between 1 and 10.")),
  lead_temperature: optionalEnum(["cold", "warm", "hot", "very_hot"]),
  estimated_value: optionalNumber(z.coerce.number().min(0, "Estimated value must be zero or greater.")),
  expected_closing_date: optionalDate,
  notes: optionalString,
});

export const interactionTypeOptions = [
  "Phone Call",
  "Physical Meeting",
  "Online Meeting",
  "WhatsApp Discussion",
  "Email Follow-up",
  "Demo Meeting",
  "Technical Meeting",
  "Quotation Discussion",
  "Payment Discussion",
  "Closing Meeting",
  "Other",
] as const;

export function temperatureFromRating(rating: number | null | undefined) {
  if (!rating) return null;
  if (rating <= 3) return "cold";
  if (rating <= 6) return "warm";
  if (rating <= 8) return "hot";
  return "very_hot";
}

export const interactionSchema = z.object({
  company_id: z.string().uuid("Company is required."),
  contact_person_id: optionalUuid,
  assigned_user_id: optionalUuid,
  interaction_type: requiredEnum(interactionTypeOptions, "Interaction type is required."),
  meeting_datetime: optionalDateTime,
  location: optionalString,
  online_meeting_link: optionalUrl("Please enter a valid website URL."),
  discussion_details: z.string().trim().min(5, "Discussion details are required."),
  client_requirement: optionalString,
  pain_point: optionalString,
  proposed_solution: optionalString,
  budget_discussion: optionalString,
  competitor_mentioned: optionalString,
  decision_timeline: optionalString,
  success_rating: optionalNumber(z.coerce.number({ invalid_type_error: "Please enter a valid number." }).int().min(1, "Success rating must be between 1 and 10.").max(10, "Success rating must be between 1 and 10.")),
  lead_temperature: optionalEnum(["cold", "warm", "hot", "very_hot"]),
  next_action: optionalString,
  next_followup_at: optionalDate,
  need_help: z.boolean().default(false),
  internal_note: optionalString,
  status: statusSchema.default("active"),
});

export const followupTypeOptions = [
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
] as const;

export const followupPriorityOptions = ["low", "medium", "high", "urgent"] as const;
export const followupStatusOptions = ["pending", "completed", "rescheduled", "cancelled", "archived"] as const;

export const followupSchema = z.object({
  company_id: z.string().uuid("Company is required."),
  title: z.string().trim().min(2, "Title is required."),
  scheduled_at: z.preprocess(
    emptyToUndefined,
    z.string({
      required_error: "Scheduled date and time is required.",
      invalid_type_error: "Scheduled date and time is required.",
    }).min(1, "Scheduled date and time is required."),
  ),
  contact_person_id: optionalUuid,
  interaction_id: optionalUuid,
  assigned_user_id: optionalUuid,
  followup_type: requiredEnum(followupTypeOptions, "Follow-up type is required."),
  description: optionalString,
  reminder_before_minutes: optionalNumberWithDefault(z.coerce.number({ invalid_type_error: "Please enter a valid number." }).int().min(0, "Please enter a valid number."), 60),
  priority: z.preprocess(emptyToUndefined, z.enum(followupPriorityOptions, { invalid_type_error: "Please select a valid option." }).optional()).transform((value) => value ?? "medium"),
  status: requiredEnum(followupStatusOptions, "Status is required."),
});

export const decisionRoleOptions = [
  "Owner",
  "CEO / MD",
  "Director",
  "Procurement",
  "IT Head",
  "Admin",
  "Engineer",
  "Finance",
  "Influencer",
  "Gatekeeper",
  "Other",
] as const;

export const relationshipLevelOptions = [
  "New",
  "Known",
  "Warm",
  "Strong",
  "Decision Maker",
  "Risky",
  "Inactive",
] as const;

export const preferredContactMethodOptions = [
  "Phone",
  "WhatsApp",
  "Email",
  "LinkedIn",
  "Physical Meeting",
] as const;

export const contactPersonSchema = z.object({
  name: z.string().trim().min(2, "Contact name is required."),
  company_id: z.string().uuid("Company is required."),
  designation: optionalString,
  department: optionalString,
  mobile: optionalString,
  whatsapp: optionalString,
  email: optionalEmail,
  linkedin: optionalUrl("Please enter a valid website URL."),
  decision_role: optionalEnum(decisionRoleOptions),
  relationship_level: optionalEnum(relationshipLevelOptions),
  preferred_contact_method: optionalEnum(preferredContactMethodOptions),
  remarks: optionalString,
  is_primary: z.boolean().default(false),
  status: statusSchema.default("active"),
});

export type IndustryInput = z.infer<typeof industrySchema>;
export type CompanyCategoryInput = z.infer<typeof companyCategorySchema>;
export type PipelineStageInput = z.infer<typeof pipelineStageSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type CompanyFormValues = z.input<typeof companySchema>;
export type ContactPersonInput = z.infer<typeof contactPersonSchema>;
export type ContactPersonFormValues = z.input<typeof contactPersonSchema>;
export type InteractionInput = z.infer<typeof interactionSchema>;
export type InteractionFormValues = z.input<typeof interactionSchema>;
export type FollowupInput = z.infer<typeof followupSchema>;
export type FollowupFormValues = z.input<typeof followupSchema>;

export const documentTypeOptions = [
  "Company Profile",
  "Brochure",
  "Quotation",
  "Technical Proposal",
  "Financial Proposal",
  "Agreement",
  "Presentation",
  "BOQ",
  "Meeting File",
  "Product Catalogue",
  "Invoice",
  "Purchase Order",
  "Other",
] as const;

export const documentStatusOptions = [
  "draft",
  "submitted",
  "seen",
  "revision_requested",
  "approved",
  "rejected",
  "archived",
] as const;

export const documentSchema = z.object({
  company_id: z.string().uuid("Company is required."),
  title: z.string().trim().min(2, "Document title is required."),
  document_type: requiredEnum(documentTypeOptions, "Document type is required."),
  description: optionalString,
  contact_person_id: optionalUuid,
  interaction_id: optionalUuid,
  followup_id: optionalUuid,
  status: requiredEnum(documentStatusOptions, "Status is required."),
  submitted_to: optionalString,
  submitted_at: optionalDate,
  expiry_date: optionalDate,
  remarks: optionalString,
});

export type DocumentInput = z.infer<typeof documentSchema>;
export type DocumentFormValues = z.input<typeof documentSchema>;

export const helpRequestTypeOptions = [
  "General Support",
  "Need Technical Support",
  "Need Price Approval",
  "Need Senior Meeting",
  "Need Product Demo",
  "Need Quotation Support",
  "Need Proposal Support",
  "Need Management Decision",
  "Need Site Visit",
  "Need Document Support",
  "Need Payment Follow-up",
  "Other",
] as const;

export const helpRequestPriorityOptions = ["low", "medium", "high", "urgent"] as const;
export const helpRequestStatusOptions = ["open", "in_progress", "resolved", "rejected", "archived"] as const;

export const helpRequestSchema = z.object({
  company_id: z.string().uuid("Company is required."),
  title: z.string().trim().min(2, "Title is required."),
  help_type: requiredEnum(helpRequestTypeOptions, "Help type is required."),
  contact_person_id: optionalUuid,
  interaction_id: optionalUuid,
  followup_id: optionalUuid,
  document_id: optionalUuid,
  assigned_to: optionalUuid,
  priority: requiredEnum(helpRequestPriorityOptions, "Priority is required."),
  status: requiredEnum(helpRequestStatusOptions, "Status is required."),
  description: optionalString,
  resolution_note: optionalString,
});

export const helpRequestUpdateSchema = z.object({
  company_id: z.preprocess(emptyToUndefined, z.string().uuid("Please select a valid option.").optional()),
  title: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(2, "Title is required.").optional(),
  ),
  help_type: z.preprocess(emptyToUndefined, z.enum(helpRequestTypeOptions, { invalid_type_error: "Please select a valid option." }).optional()),
  contact_person_id: optionalUuid,
  interaction_id: optionalUuid,
  followup_id: optionalUuid,
  document_id: optionalUuid,
  assigned_to: optionalUuid,
  priority: z.preprocess(emptyToUndefined, z.enum(helpRequestPriorityOptions, { invalid_type_error: "Please select a valid option." }).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(helpRequestStatusOptions, { invalid_type_error: "Please select a valid option." }).optional()),
  description: optionalString,
  resolution_note: optionalString,
});

export const helpRequestCommentSchema = z.object({
  comment: z.string().trim().min(1, "Comment is required."),
  is_internal: z.boolean().default(true),
});

export type HelpRequestInput = z.infer<typeof helpRequestSchema>;
export type HelpRequestFormValues = z.input<typeof helpRequestSchema>;
export type HelpRequestUpdateInput = z.infer<typeof helpRequestUpdateSchema>;
export type HelpRequestCommentInput = z.infer<typeof helpRequestCommentSchema>;
