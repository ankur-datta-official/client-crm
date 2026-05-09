import { requireOrganization } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type {
  OrganizationSubscription,
  OrganizationUsage,
  SubscriptionFeatureCode,
  SubscriptionLimitCheck,
  SubscriptionLimitType,
  SubscriptionPlan,
} from "./types";

function serializePlan(plan: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: { toString(): string };
  max_users: number | null;
  max_organizations: number;
  max_companies: number | null;
  storage_limit_mb: number | null;
  file_size_limit_mb: number | null;
  custom_pipeline: boolean;
  pdf_export: boolean;
  csv_import: boolean;
  advanced_reports: boolean;
  audit_log: boolean;
  is_active: boolean;
}): SubscriptionPlan {
  return {
    ...plan,
    monthly_price: Number(plan.monthly_price.toString()),
  };
}

function serializeSubscription(row: {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  trial_starts_at: Date;
  trial_ends_at: Date;
  current_period_starts_at: Date | null;
  current_period_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
  plan: Parameters<typeof serializePlan>[0] | null;
}): OrganizationSubscription {
  return {
    id: row.id,
    organization_id: row.organization_id,
    plan_id: row.plan_id,
    status: row.status as OrganizationSubscription["status"],
    trial_starts_at: row.trial_starts_at.toISOString(),
    trial_ends_at: row.trial_ends_at.toISOString(),
    current_period_starts_at: row.current_period_starts_at?.toISOString() ?? null,
    current_period_ends_at: row.current_period_ends_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    plan: row.plan ? serializePlan(row.plan) : null,
  };
}

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
  const row = await prisma.organizationSubscription.findUnique({
    where: {
      organization_id: organization.id,
    },
    include: {
      plan: true,
    },
  });

  return row ? serializeSubscription(row) : null;
}

export async function getCurrentPlan(): Promise<SubscriptionPlan | null> {
  const subscription = await getCurrentSubscription();
  return subscription?.plan ?? null;
}

export async function getAllPlans(): Promise<SubscriptionPlan[]> {
  await requireOrganization();
  const data = await prisma.subscriptionPlan.findMany({
    where: {
      is_active: true,
    },
    orderBy: {
      monthly_price: "asc",
    },
  });

  const planOrder = new Map([
    ["starter", 0],
    ["professional", 1],
    ["business", 2],
    ["enterprise", 3],
  ]);

  return data.map(serializePlan).sort((left, right) => {
    return (planOrder.get(left.slug) ?? Number.MAX_SAFE_INTEGER) - (planOrder.get(right.slug) ?? Number.MAX_SAFE_INTEGER);
  });
}

export async function getOrganizationUsage(): Promise<OrganizationUsage> {
  const organization = await requireOrganization();
  const [activeUsers, pendingInvitations, companies, documents] = await Promise.all([
    prisma.user.count({
      where: {
        organization_id: organization.id,
        is_active: true,
      },
    }),
    prisma.teamInvitation.count({
      where: {
        organization_id: organization.id,
        status: "pending",
        expires_at: {
          gt: new Date(),
        },
      },
    }),
    prisma.company.count({
      where: {
        organization_id: organization.id,
        status: {
          not: "archived",
        },
      },
    }),
    prisma.document.findMany({
      where: {
        organization_id: organization.id,
      },
      select: {
        file_size_mb: true,
      },
    }),
  ]);

  const storageUsedMb = documents.reduce((total, document) => {
    return total + Number(document.file_size_mb?.toString() ?? 0);
  }, 0);

  return {
    activeUsers,
    pendingInvitations,
    reservedSeats: activeUsers + pendingInvitations,
    companies,
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
  const subscription = await prisma.organizationSubscription.findUnique({
    where: {
      organization_id: organizationId,
    },
    include: {
      plan: {
        select: {
          name: true,
          max_companies: true,
        },
      },
    },
  });

  const plan = subscription?.plan ?? null;
  const max = plan?.max_companies ?? null;

  const current = await prisma.company.count({
    where: {
      organization_id: organizationId,
      status: {
        not: "archived",
      },
    },
  });
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
  const data = await prisma.organizationSubscription.findUnique({
    where: {
      organization_id: organizationId,
    },
    include: {
      plan: {
        select: {
          custom_pipeline: true,
          pdf_export: true,
          csv_import: true,
          advanced_reports: true,
          audit_log: true,
        },
      },
    },
  });

  if (!data?.plan) {
    return false;
  }

  return Boolean(data.plan[featureCode]);
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
