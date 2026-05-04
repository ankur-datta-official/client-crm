import { requireOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type {
  OrganizationSubscription,
  OrganizationUsage,
  SubscriptionFeatureCode,
  SubscriptionLimitCheck,
  SubscriptionLimitType,
  SubscriptionPlan,
} from "./types";

function formatUnlimitedLabel(value: number | null, unit: string) {
  return value === null ? `Unlimited ${unit}` : `${value.toLocaleString()} ${unit}`;
}

export function getUpgradeMessage(limitType: SubscriptionLimitType, planName?: string | null) {
  const prefix = planName ? `${planName} plan` : "Current plan";

  switch (limitType) {
    case "users":
      return `${prefix} user seats are fully used. Upgrade to invite more teammates.`;
    case "companies":
      return `${prefix} company limit has been reached. Upgrade to add more leads.`;
    case "storage":
      return `${prefix} storage limit has been reached. Upgrade for more document storage.`;
    case "file_size":
      return `${prefix} file size limit does not allow this upload. Upgrade for larger files.`;
    case "custom_pipeline":
      return `${prefix} does not include custom pipeline management. Upgrade to edit stages.`;
    case "pdf_export":
      return `${prefix} does not include PDF export yet. Upgrade to unlock it.`;
    case "csv_import":
      return `${prefix} does not include CSV import. Upgrade to unlock bulk import.`;
    case "advanced_reports":
      return `${prefix} does not include advanced reports. Upgrade to unlock deeper analytics.`;
    case "audit_log":
      return `${prefix} does not include audit log access. Upgrade to unlock it.`;
    default:
      return `${prefix} feature is locked. Upgrade to continue.`;
  }
}

export async function getCurrentSubscription(): Promise<OrganizationSubscription | null> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select(`
      id,
      organization_id,
      plan_id,
      status,
      trial_starts_at,
      trial_ends_at,
      current_period_starts_at,
      current_period_ends_at,
      created_at,
      updated_at,
      plan:subscription_plans(
        id,
        name,
        slug,
        description,
        monthly_price,
        max_users,
        max_organizations,
        max_companies,
        storage_limit_mb,
        file_size_limit_mb,
        custom_pipeline,
        pdf_export,
        csv_import,
        advanced_reports,
        audit_log,
        is_active
      )
    `)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OrganizationSubscription | null) ?? null;
}

export async function getCurrentPlan(): Promise<SubscriptionPlan | null> {
  const subscription = await getCurrentSubscription();
  return subscription?.plan ?? null;
}

export async function getAllPlans(): Promise<SubscriptionPlan[]> {
  await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(`
      id,
      name,
      slug,
      description,
      monthly_price,
      max_users,
      max_organizations,
      max_companies,
      storage_limit_mb,
      file_size_limit_mb,
      custom_pipeline,
      pdf_export,
      csv_import,
      advanced_reports,
      audit_log,
      is_active
    `)
    .eq("is_active", true)
    .order("monthly_price", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const planOrder = new Map([
    ["starter", 0],
    ["professional", 1],
    ["business", 2],
    ["enterprise", 3],
  ]);

  return ((data ?? []) as SubscriptionPlan[]).sort((left, right) => {
    return (planOrder.get(left.slug) ?? Number.MAX_SAFE_INTEGER) - (planOrder.get(right.slug) ?? Number.MAX_SAFE_INTEGER);
  });
}

export async function getOrganizationUsage(): Promise<OrganizationUsage> {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const [usersResult, invitationsResult, companiesResult, documentsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),
    supabase
      .from("team_invitations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("documents")
      .select("file_size_mb")
      .eq("organization_id", organization.id),
  ]);

  if (usersResult.error) throw new Error(usersResult.error.message);
  if (invitationsResult.error) throw new Error(invitationsResult.error.message);
  if (companiesResult.error) throw new Error(companiesResult.error.message);
  if (documentsResult.error) throw new Error(documentsResult.error.message);

  const storageUsedMb = (documentsResult.data ?? []).reduce((total, document) => {
    return total + Number(document.file_size_mb ?? 0);
  }, 0);

  const activeUsers = usersResult.count ?? 0;
  const pendingInvitations = invitationsResult.count ?? 0;

  return {
    activeUsers,
    pendingInvitations,
    reservedSeats: activeUsers + pendingInvitations,
    companies: companiesResult.count ?? 0,
    storageUsedMb: Number(storageUsedMb.toFixed(2)),
  };
}

export async function checkUserLimit(extraSeats = 1): Promise<SubscriptionLimitCheck> {
  const [plan, usage] = await Promise.all([getCurrentPlan(), getOrganizationUsage()]);
  const max = plan?.max_users ?? null;
  const current = usage.reservedSeats;
  const projected = current + extraSeats;
  const allowed = max === null || projected <= max;

  return {
    allowed,
    current,
    projected,
    max,
    message: allowed ? null : getUpgradeMessage("users", plan?.name),
  };
}

export async function checkCompanyLimit(extraCompanies = 1): Promise<SubscriptionLimitCheck> {
  const [plan, usage] = await Promise.all([getCurrentPlan(), getOrganizationUsage()]);
  const max = plan?.max_companies ?? null;
  const current = usage.companies;
  const projected = current + extraCompanies;
  const allowed = max === null || projected <= max;

  return {
    allowed,
    current,
    projected,
    max,
    message: allowed ? null : getUpgradeMessage("companies", plan?.name),
  };
}

/** Same as {@link checkCompanyLimit} but scoped to an organization (e.g. API routes without `requireOrganization`). */
export async function checkCompanyLimitForOrganization(
  organizationId: string,
  extraCompanies = 1,
): Promise<SubscriptionLimitCheck> {
  const supabase = await createClient();
  const { data: subscription, error: subError } = await supabase
    .from("organization_subscriptions")
    .select(
      `
      plan:subscription_plans(
        name,
        max_companies
      )
    `,
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (subError) {
    throw new Error(subError.message);
  }

  const rawPlan = subscription?.plan as { name: string | null; max_companies: number | null } | { name: string | null; max_companies: number | null }[] | null | undefined;
  const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;
  const max = plan?.max_companies ?? null;

  const { count, error: countError } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("status", "archived");

  if (countError) {
    throw new Error(countError.message);
  }

  const current = count ?? 0;
  const projected = current + extraCompanies;
  const allowed = max === null || projected <= max;

  return {
    allowed,
    current,
    projected,
    max,
    message: allowed ? null : getUpgradeMessage("companies", plan?.name ?? undefined),
  };
}

export async function checkStorageLimit(additionalStorageMb: number, existingSizeMb = 0): Promise<SubscriptionLimitCheck> {
  const [plan, usage] = await Promise.all([getCurrentPlan(), getOrganizationUsage()]);
  const max = plan?.storage_limit_mb ?? null;
  const current = usage.storageUsedMb;
  const projected = Number((current - existingSizeMb + additionalStorageMb).toFixed(2));
  const allowed = max === null || projected <= max;

  return {
    allowed,
    current: Number(current.toFixed(2)),
    projected,
    max,
    message: allowed ? null : getUpgradeMessage("storage", plan?.name),
  };
}

export async function checkFileSizeLimit(fileSizeBytes: number): Promise<SubscriptionLimitCheck> {
  const plan = await getCurrentPlan();
  const max = plan?.file_size_limit_mb ?? null;
  const current = 0;
  const projected = Number((fileSizeBytes / (1024 * 1024)).toFixed(2));
  const allowed = max === null || projected <= max;

  return {
    allowed,
    current,
    projected,
    max,
    message: allowed ? null : getUpgradeMessage("file_size", plan?.name),
  };
}

export async function hasFeature(featureCode: SubscriptionFeatureCode): Promise<boolean> {
  const plan = await getCurrentPlan();

  if (!plan) {
    return false;
  }

  return Boolean(plan[featureCode]);
}

export async function hasPlanFeatureForOrganization(
  organizationId: string,
  featureCode: SubscriptionFeatureCode,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select(
      `
      plan:subscription_plans(
        ${featureCode}
      )
    `,
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const raw = data.plan as Record<string, boolean> | Record<string, boolean>[] | null | undefined;
  const plan = Array.isArray(raw) ? raw[0] : raw;
  return Boolean(plan?.[featureCode]);
}

export async function requireFeature(featureCode: SubscriptionFeatureCode): Promise<void> {
  const plan = await getCurrentPlan();

  if (!plan?.[featureCode]) {
    throw new Error(getUpgradeMessage(featureCode, plan?.name));
  }
}

export function formatLimitValue(value: number | null, unit: string) {
  return formatUnlimitedLabel(value, unit);
}
