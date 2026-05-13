import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export const QA_TAG = "[qa-launch-v1]";
export const QA_WORKSPACE_NAME = "QA Launch Validation Workspace";
export const DEFAULT_TARGET_EMAIL = "admin@gmail.com";

const DEFAULT_ROLE_DEFINITIONS = [
  {
    name: "Organization Admin",
    slug: "organization-admin",
    description: "Full access to workspace administration and CRM data.",
  },
  {
    name: "Sales Manager",
    slug: "sales-manager",
    description: "Manage sales team activity, pipeline, and reports.",
  },
  {
    name: "Sales Executive",
    slug: "sales-executive",
    description: "Work assigned leads, meetings, pipeline, and follow-ups.",
  },
  {
    name: "Support User",
    slug: "support-user",
    description: "Assist with support requests and client follow-up needs.",
  },
  {
    name: "Viewer",
    slug: "viewer",
    description: "Read-only visibility into CRM data.",
  },
];

const DEFAULT_ROLE_PERMISSIONS = {
  "organization-admin": [
    "dashboard.view",
    "companies.view", "companies.create", "companies.update", "companies.archive", "companies.delete",
    "contacts.view", "contacts.create", "contacts.update", "contacts.archive",
    "meetings.view", "meetings.create", "meetings.update", "meetings.archive",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel", "followups.archive",
    "documents.view", "documents.upload", "documents.update", "documents.download", "documents.archive",
    "help_requests.view", "help_requests.create", "help_requests.assign", "help_requests.resolve", "help_requests.reject", "help_requests.archive",
    "reports.view", "reports.export",
    "team.view", "team.invite", "team.update_role", "team.deactivate",
    "settings.view", "settings.manage",
    "scoring.view", "scoring.manage", "rewards.manage", "leaderboard.view",
  ],
  "sales-manager": [
    "dashboard.view",
    "companies.view", "companies.create", "companies.update", "companies.archive",
    "contacts.view", "contacts.create", "contacts.update", "contacts.archive",
    "meetings.view", "meetings.create", "meetings.update", "meetings.archive",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel", "followups.archive",
    "documents.view", "documents.upload", "documents.update", "documents.download", "documents.archive",
    "help_requests.view", "help_requests.create", "help_requests.assign", "help_requests.resolve",
    "reports.view", "reports.export",
    "team.view",
    "scoring.view", "leaderboard.view",
  ],
  "sales-executive": [
    "dashboard.view",
    "companies.view", "companies.create", "companies.update", "companies.archive",
    "contacts.view", "contacts.create", "contacts.update", "contacts.archive",
    "meetings.view", "meetings.create", "meetings.update",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel",
    "documents.view", "documents.upload", "documents.update", "documents.download",
    "leaderboard.view",
  ],
  "support-user": [
    "dashboard.view",
    "companies.view",
    "contacts.view",
    "meetings.view",
    "followups.view", "followups.create", "followups.update", "followups.complete", "followups.cancel",
    "documents.view", "documents.upload", "documents.update", "documents.download", "documents.archive",
    "help_requests.view", "help_requests.create", "help_requests.assign", "help_requests.resolve", "help_requests.reject", "help_requests.archive",
    "leaderboard.view",
  ],
  viewer: [
    "dashboard.view",
    "companies.view",
    "contacts.view",
    "meetings.view",
    "followups.view",
    "documents.view",
    "help_requests.view",
    "reports.view",
    "team.view",
    "settings.view",
    "leaderboard.view",
  ],
};

const DEFAULT_PIPELINE_STAGES = [
  ["New Lead", "new-lead", 1, 5, false, false, "#0f766e"],
  ["Contacted", "contacted", 2, 15, false, false, "#0ea5e9"],
  ["Meeting Scheduled", "meeting-scheduled", 3, 25, false, false, "#6366f1"],
  ["Meeting Done", "meeting-done", 4, 40, false, false, "#8b5cf6"],
  ["Proposal Sent", "proposal-sent", 5, 60, false, false, "#f59e0b"],
  ["Negotiation", "negotiation", 6, 75, false, false, "#f97316"],
  ["Won", "won", 7, 100, true, false, "#16a34a"],
  ["Lost", "lost", 8, 0, false, true, "#ef4444"],
];

const DEFAULT_CATEGORIES = [
  ["New Lead", "NEW", "Freshly captured lead for QA workspace.", 1],
  ["Imported Company", "IMP", "Imported or migrated company for QA workspace.", 2],
  ["Existing Client", "EXT", "Existing client account used in QA scenarios.", 3],
];

const DEFAULT_INDUSTRIES = [
  "Manufacturing",
  "Retail",
  "Technology",
  "Energy",
  "Construction",
];

export function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getPrismaClient() {
  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in .env.local");
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSlugSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

function buildWorkspaceSlug(name) {
  return `${slugify(name) || "qa-workspace"}-${randomSlugSuffix()}`;
}

async function ensurePermissions(prisma) {
  const keys = Array.from(new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat()));
  await prisma.permission.createMany({
    data: keys.map((key) => ({
      key,
      name: key
        .split(/[._-]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      description: `${key} permission for QA workspace.`,
    })),
    skipDuplicates: true,
  });
}

async function ensureWorkspaceRoles(prisma, organizationId, userId) {
  for (const role of DEFAULT_ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: {
        organization_id_slug: {
          organization_id: organizationId,
          slug: role.slug,
        },
      },
      update: {
        name: role.name,
        description: role.description,
        is_system: true,
        updated_at: new Date(),
      },
      create: {
        organization_id: organizationId,
        name: role.name,
        slug: role.slug,
        description: role.description,
        is_system: true,
        updated_at: new Date(),
      },
    });
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { organization_id: organizationId },
      select: { id: true, slug: true },
    }),
    prisma.permission.findMany({
      where: { key: { in: Array.from(new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat())) } },
      select: { id: true, key: true },
    }),
  ]);

  const permissionIdByKey = new Map(permissions.map((item) => [item.key, item.id]));
  const roleIdBySlug = new Map(roles.map((item) => [item.slug, item.id]));

  const rolePermissionRows = [];
  for (const [roleSlug, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleId = roleIdBySlug.get(roleSlug);
    if (!roleId) continue;

    for (const permissionKey of permissionKeys) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) continue;
      rolePermissionRows.push({
        role_id: roleId,
        permission_id: permissionId,
      });
    }
  }

  if (rolePermissionRows.length > 0) {
    await prisma.rolePermission.createMany({
      data: rolePermissionRows,
      skipDuplicates: true,
    });
  }

  const adminRoleId = roleIdBySlug.get("organization-admin");
  if (adminRoleId) {
    await prisma.userRole.upsert({
      where: {
        organization_id_user_id_role_id: {
          organization_id: organizationId,
          user_id: userId,
          role_id: adminRoleId,
        },
      },
      update: {
        assigned_by: userId,
      },
      create: {
        organization_id: organizationId,
        user_id: userId,
        role_id: adminRoleId,
        assigned_by: userId,
      },
    });
  }
}

async function ensureWorkspacePipeline(prisma, organizationId) {
  for (const [name, slug, position, probability, isWon, isLost, color] of DEFAULT_PIPELINE_STAGES) {
    await prisma.pipelineStage.upsert({
      where: {
        organization_id_slug: {
          organization_id: organizationId,
          slug,
        },
      },
      update: {
        name,
        position,
        probability,
        is_won: isWon,
        is_lost: isLost,
        is_active: true,
        color,
        updated_at: new Date(),
      },
      create: {
        organization_id: organizationId,
        name,
        slug,
        position,
        probability,
        is_won: isWon,
        is_lost: isLost,
        is_active: true,
        color,
      },
    });
  }
}

async function ensureWorkspaceCategories(prisma, organizationId, userId) {
  for (const [name, code, description, priority] of DEFAULT_CATEGORIES) {
    await prisma.companyCategory.upsert({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code,
        },
      },
      update: {
        name,
        description,
        priority_level: priority,
        status: "active",
        updated_by: userId,
        updated_at: new Date(),
      },
      create: {
        organization_id: organizationId,
        name,
        code,
        description,
        priority_level: priority,
        status: "active",
        created_by: userId,
        updated_by: userId,
      },
    });
  }
}

async function ensureWorkspaceIndustries(prisma, organizationId, userId) {
  for (const name of DEFAULT_INDUSTRIES) {
    await prisma.industry.upsert({
      where: {
        organization_id_name: {
          organization_id: organizationId,
          name,
        },
      },
      update: {
        status: "active",
        description: `${name} QA industry`,
        updated_by: userId,
        updated_at: new Date(),
      },
      create: {
        organization_id: organizationId,
        name,
        description: `${name} QA industry`,
        status: "active",
        created_by: userId,
        updated_by: userId,
      },
    });
  }
}

export async function getTargetUser(prisma, email) {
  const normalizedEmail = email.toLowerCase();
  const selectedUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      organization_id: true,
      is_super_admin: true,
      is_active: true,
    },
  });

  if (selectedUser) {
    return selectedUser;
  }

  const fallbackUser = await prisma.user.findFirst({
    where: {
      is_active: true,
      OR: [
        { organization_id: { not: null } },
        { is_super_admin: true },
      ],
    },
    orderBy: [
      { is_super_admin: "desc" },
      { created_at: "asc" },
    ],
    select: {
      id: true,
      email: true,
      name: true,
      organization_id: true,
      is_super_admin: true,
      is_active: true,
    },
  });

  if (fallbackUser) {
    return fallbackUser;
  }

  throw new Error(`User ${email} was not found, and no active fallback user is available in the local database.`);
}

export async function ensureQaWorkspace(prisma, email = DEFAULT_TARGET_EMAIL, options = {}) {
  const { activate = false, workspaceName = QA_WORKSPACE_NAME } = options;
  const user = await getTargetUser(prisma, email);

  let organization = await prisma.organization.findFirst({
    where: {
      owner_user_id: user.id,
      name: workspaceName,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: workspaceName,
        slug: buildWorkspaceSlug(workspaceName),
        company_size: "QA Workspace",
        owner_user_id: user.id,
        updated_at: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }

  await ensurePermissions(prisma);
  await ensureWorkspaceRoles(prisma, organization.id, user.id);
  await ensureWorkspacePipeline(prisma, organization.id);
  await ensureWorkspaceCategories(prisma, organization.id, user.id);
  await ensureWorkspaceIndustries(prisma, organization.id, user.id);

  if (activate) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        organization_id: organization.id,
        is_active: true,
      },
    });
  }

  return {
    user,
    organization,
  };
}

async function insertRows(prisma, table, payload, returning) {
  if (!payload.length) {
    return [];
  }

  const columns = [...new Set(payload.flatMap((row) => Object.keys(row)))];
  const values = [];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const rowPlaceholders = payload.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      const value = row[column] ?? null;
      values.push(value);

      const placeholderIndex = rowIndex * columns.length + columnIndex + 1;
      const isUuidValue = typeof value === "string" && uuidPattern.test(value);

      if (!isUuidValue) {
        return `$${placeholderIndex}`;
      }

      return `$${placeholderIndex}::uuid`;
    });
    return `(${placeholders.join(", ")})`;
  });

  const query = `
    insert into public.${table} (${columns.join(", ")})
    values ${rowPlaceholders.join(",\n")}
    returning ${returning}
  `;

  return prisma.$queryRawUnsafe(query, ...values);
}

async function getWorkspaceOptions(prisma, organizationId) {
  const [stages, categories, industries] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organization_id: organizationId, is_active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true, position: true, is_won: true, is_lost: true },
    }),
    prisma.companyCategory.findMany({
      where: { organization_id: organizationId, status: { not: "archived" } },
      orderBy: { priority_level: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.industry.findMany({
      where: { organization_id: organizationId, status: { not: "archived" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (stages.length < 4) {
    throw new Error("QA workspace does not have enough pipeline stages to seed test data.");
  }

  return { stages, categories, industries };
}

export async function getQaSeedCounts(prisma, organizationId) {
  const counts = await Promise.all([
    prisma.company.count({ where: { organization_id: organizationId, notes: { contains: QA_TAG } } }),
    prisma.contactPerson.count({ where: { organization_id: organizationId, remarks: { contains: QA_TAG } } }),
    prisma.interaction.count({ where: { organization_id: organizationId, discussion_details: { contains: QA_TAG } } }),
    prisma.followup.count({ where: { organization_id: organizationId, description: { contains: QA_TAG } } }),
    prisma.document.count({ where: { organization_id: organizationId, description: { contains: QA_TAG } } }),
    prisma.helpRequest.count({ where: { organization_id: organizationId, description: { contains: QA_TAG } } }),
  ]);

  return {
    companies: counts[0],
    contacts: counts[1],
    interactions: counts[2],
    followups: counts[3],
    documents: counts[4],
    helpRequests: counts[5],
  };
}

async function hasTableColumn(prisma, tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = $2
      ) as exists
    `,
    tableName,
    columnName,
  );
  return !!rows?.[0]?.exists;
}

function isoDate(date) {
  return date.toISOString();
}

export async function seedQaDataset(prisma, input) {
  const { organizationId, userId } = input;
  const existingCounts = await getQaSeedCounts(prisma, organizationId);
  if (existingCounts.companies > 0) {
    return {
      created: false,
      organizationId,
      counts: existingCounts,
    };
  }

  const { stages, categories, industries } = await getWorkspaceOptions(prisma, organizationId);
  const now = new Date();
  const categoryIds = categories.map((item) => item.id);
  const industryIds = industries.map((item) => item.id);

  const companiesPayload = [
    {
      organization_id: organizationId,
      name: "QA Northwind Trading",
      industry_id: industryIds[0] ?? null,
      category_id: categoryIds[0] ?? null,
      lead_source: "Website",
      priority: "high",
      assigned_user_id: userId,
      pipeline_stage_id: stages[0]?.id ?? null,
      status: "active",
      phone: "+8801700001001",
      whatsapp: "+8801700001001",
      email: "qa-northwind@example.test",
      website: "https://qa-northwind.example.test",
      address: "Suite 3, Dhaka",
      city: "Dhaka",
      country: "Bangladesh",
      success_rating: 5,
      lead_temperature: "warm",
      estimated_value: 80000,
      expected_closing_date: new Date(now.getFullYear(), now.getMonth() + 1, 15),
      notes: `${QA_TAG} Primary QA company with active tasks and mixed linked records.`,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      name: "QA Acme Manufacturing",
      industry_id: industryIds[1] ?? null,
      category_id: categoryIds[1] ?? null,
      lead_source: "Referral",
      priority: "urgent",
      assigned_user_id: userId,
      pipeline_stage_id: stages[3]?.id ?? stages[1]?.id ?? null,
      status: "active",
      phone: "+8801700001002",
      email: "qa-acme@example.test",
      website: "https://qa-acme.example.test",
      city: "Chattogram",
      country: "Bangladesh",
      success_rating: 8,
      lead_temperature: "hot",
      estimated_value: 180000,
      expected_closing_date: new Date(now.getFullYear(), now.getMonth() + 1, 22),
      notes: `${QA_TAG} Completed-meeting scenario with resolved support and won-progress context.`,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      name: "QA Summit Power",
      industry_id: industryIds[2] ?? null,
      category_id: categoryIds[0] ?? null,
      lead_source: "Phone Inquiry",
      priority: "urgent",
      assigned_user_id: userId,
      pipeline_stage_id: stages[2]?.id ?? null,
      status: "active",
      phone: "+8801700001003",
      email: "qa-summit@example.test",
      website: "https://qa-summit.example.test",
      city: "Khulna",
      country: "Bangladesh",
      success_rating: 6,
      lead_temperature: "warm",
      estimated_value: 120000,
      expected_closing_date: new Date(now.getFullYear(), now.getMonth() + 2, 4),
      notes: `${QA_TAG} Overdue follow-up and in-progress help request scenario.`,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      name: "QA Metro Retail",
      industry_id: industryIds[3] ?? null,
      category_id: categoryIds[2] ?? null,
      lead_source: "Existing Contact",
      priority: "medium",
      assigned_user_id: userId,
      pipeline_stage_id: stages[4]?.id ?? null,
      status: "active",
      phone: "+8801700001004",
      email: "qa-metro@example.test",
      website: "https://qa-metro.example.test",
      city: "Sylhet",
      country: "Bangladesh",
      success_rating: 7,
      lead_temperature: "warm",
      estimated_value: 140000,
      expected_closing_date: new Date(now.getFullYear(), now.getMonth() + 2, 14),
      notes: `${QA_TAG} Document-heavy scenario with partial relationship data.`,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      name: "QA Vertex Solutions",
      industry_id: industryIds[4] ?? industryIds[0] ?? null,
      category_id: categoryIds[1] ?? null,
      lead_source: "LinkedIn",
      priority: "medium",
      assigned_user_id: userId,
      pipeline_stage_id: stages[5]?.id ?? stages[2]?.id ?? null,
      status: "active",
      phone: "+8801700001005",
      email: "qa-vertex@example.test",
      website: "https://qa-vertex.example.test",
      city: "Dhaka",
      country: "Bangladesh",
      success_rating: 9,
      lead_temperature: "hot",
      estimated_value: 220000,
      expected_closing_date: new Date(now.getFullYear(), now.getMonth() + 1, 28),
      notes: `${QA_TAG} Negotiation-stage scenario with rejected support request and pending discussion.`,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      name: "QA Prime Engineering",
      industry_id: industryIds[0] ?? null,
      category_id: categoryIds[2] ?? null,
      lead_source: "Referral",
      priority: "high",
      assigned_user_id: userId,
      pipeline_stage_id: stages.find((item) => item.is_won)?.id ?? stages[1]?.id ?? null,
      status: "active",
      phone: "+8801700001006",
      email: "qa-prime@example.test",
      website: "https://qa-prime.example.test",
      city: "Gazipur",
      country: "Bangladesh",
      success_rating: 10,
      lead_temperature: "hot",
      estimated_value: 300000,
      expected_closing_date: new Date(now.getFullYear(), now.getMonth() + 1, 5),
      notes: `${QA_TAG} Won-stage company for completed workflow and signed document checks.`,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
    },
  ];

  const insertedCompanies = await insertRows(
    prisma,
    "companies",
    companiesPayload,
    "id::text as id, name, pipeline_stage_id::text as pipeline_stage_id",
  );

  const companyByName = new Map(insertedCompanies.map((item) => [item.name, item]));

  const contactsPayload = [
    ["QA Northwind Trading", "Omar Khan", "Owner", "Operations", "+8801800002001", "omar.khan@example.test", "Decision Maker", "Warm", "Phone", true, `${QA_TAG} Primary contact.`],
    ["QA Northwind Trading", "Sara Islam", "Procurement Lead", "Procurement", "+8801800002002", "sara.islam@example.test", "Influencer", "Known", null, false, `${QA_TAG} Missing preferred method scenario.`],
    ["QA Acme Manufacturing", "Rashed Karim", "Managing Director", "Management", "+8801800002003", "rashed.karim@example.test", "Decision Maker", "Strong", "Email", true, `${QA_TAG} Completed meeting contact.`],
    ["QA Acme Manufacturing", "Nusrat Jahan", "Finance Controller", "Finance", "+8801800002004", "nusrat.jahan@example.test", "Approver", "Warm", "WhatsApp", false, `${QA_TAG} Secondary finance contact.`],
    ["QA Summit Power", "Hasib Rahman", "Project Lead", "Projects", "+8801800002005", "hasib.rahman@example.test", "Influencer", "Warm", "Phone", true, `${QA_TAG} Overdue follow-up contact.`],
    ["QA Metro Retail", "Farzana Noor", "Brand Manager", "Marketing", "+8801800002006", "farzana.noor@example.test", "Unknown", "Known", "Email", true, `${QA_TAG} Partial data contact.`],
    ["QA Vertex Solutions", "Tanmoy Das", "CTO", "Technology", "+8801800002007", "tanmoy.das@example.test", "Decision Maker", "Strong", "Phone", true, `${QA_TAG} Negotiation contact.`],
    ["QA Prime Engineering", "Naeem Ahmed", "Director", "Leadership", "+8801800002008", "naeem.ahmed@example.test", "Decision Maker", "Strong", "Phone", true, `${QA_TAG} Won-stage contact.`],
  ].map(([companyName, name, designation, department, mobile, email, decisionRole, relationship, preferredMethod, isPrimary, remarks]) => ({
    organization_id: organizationId,
    company_id: companyByName.get(companyName)?.id ?? null,
    name,
    designation,
    department,
    mobile,
    email,
    decision_role: decisionRole,
    relationship_level: relationship,
    preferred_contact_method: preferredMethod,
    is_primary: isPrimary,
    status: "active",
    remarks,
    created_by: userId,
    updated_by: userId,
    created_at: new Date(),
    updated_at: new Date(),
  }));

  const insertedContacts = await insertRows(
    prisma,
    "contact_persons",
    contactsPayload,
    "id::text as id, company_id::text as company_id, name",
  );

  const contactLookup = new Map(insertedContacts.map((item) => [`${item.company_id}:${item.name}`, item]));
  const primaryContactByCompanyId = new Map();
  for (const item of insertedContacts) {
    if (!primaryContactByCompanyId.has(item.company_id)) {
      primaryContactByCompanyId.set(item.company_id, item.id);
    }
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(11, 0, 0, 0);
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  inTwoDays.setHours(15, 30, 0, 0);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  yesterday.setHours(14, 15, 0, 0);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  threeDaysAgo.setHours(16, 0, 0, 0);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  fiveDaysAgo.setHours(10, 30, 0, 0);
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  sixDaysAgo.setHours(13, 0, 0, 0);

  const interactionsPayload = [
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Northwind Trading")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Northwind Trading")?.id ?? "") ?? null,
      assigned_user_id: userId,
      interaction_type: "Phone Call",
      meeting_datetime: tomorrow,
      discussion_details: `${QA_TAG} Upcoming relationship check-in scheduled from dashboard task flow.`,
      success_rating: 5,
      lead_temperature: "warm",
      next_action: "Prepare pricing overview before the next call.",
      next_followup_at: inTwoDays,
      need_help: false,
      status: "active",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Acme Manufacturing")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Acme Manufacturing")?.id ?? "") ?? null,
      assigned_user_id: userId,
      interaction_type: "Demo Meeting",
      meeting_datetime: yesterday,
      discussion_details: `${QA_TAG} Completed product demo with next-step and follow-up outcome captured.`,
      success_rating: 8,
      lead_temperature: "hot",
      next_action: "Send final proposal and confirm commercial approval.",
      next_followup_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      completed_at: new Date(now.getTime() - 20 * 60 * 1000),
      completed_by: userId,
      need_help: false,
      status: "active",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 28 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 20 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Summit Power")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Summit Power")?.id ?? "") ?? null,
      assigned_user_id: userId,
      interaction_type: "Technical Review",
      meeting_datetime: inTwoDays,
      discussion_details: `${QA_TAG} Upcoming technical review linked to overdue action queue and help dependency.`,
      success_rating: 6,
      lead_temperature: "warm",
      next_action: "Collect engineering clarification before proposal revision.",
      next_followup_at: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      need_help: true,
      status: "active",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 36 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 36 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Vertex Solutions")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Vertex Solutions")?.id ?? "") ?? null,
      assigned_user_id: userId,
      interaction_type: "Negotiation Meeting",
      meeting_datetime: threeDaysAgo,
      discussion_details: `${QA_TAG} Negotiation discussion logged but intentionally left not completed for open-workflow validation.`,
      success_rating: 7,
      lead_temperature: "hot",
      next_action: "Clarify revised scope and discount request.",
      next_followup_at: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      need_help: true,
      status: "active",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 72 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Prime Engineering")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Prime Engineering")?.id ?? "") ?? null,
      assigned_user_id: userId,
      interaction_type: "Closing Meeting",
      meeting_datetime: fiveDaysAgo,
      discussion_details: `${QA_TAG} Closing meeting completed successfully for won-stage validation.`,
      success_rating: 10,
      lead_temperature: "hot",
      next_action: "Collect onboarding documents and start implementation kickoff.",
      next_followup_at: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
      completed_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      completed_by: userId,
      need_help: false,
      status: "active",
      created_by: userId,
      updated_by: userId,
      created_at: sixDaysAgo,
      updated_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
    },
  ];

  const insertedInteractions = await insertRows(
    prisma,
    "interactions",
    interactionsPayload,
    "id::text as id, company_id::text as company_id, interaction_type",
  );

  const interactionByCompanyId = new Map(insertedInteractions.map((item) => [item.company_id, item.id]));

  const todayPending = new Date(now);
  todayPending.setHours(17, 0, 0, 0);
  const overduePending = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  overduePending.setHours(9, 0, 0, 0);
  const upcomingPending = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  upcomingPending.setHours(11, 30, 0, 0);
  const completedScheduled = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  completedScheduled.setHours(15, 0, 0, 0);
  const completedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000);
  const cancelledScheduled = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  cancelledScheduled.setHours(13, 15, 0, 0);

  const followupsPayload = [
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Northwind Trading")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Northwind Trading")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Northwind Trading")?.id ?? "") ?? null,
      assigned_user_id: userId,
      followup_type: "Phone Call",
      title: "QA Today follow-up",
      description: `${QA_TAG} Today task for dashboard quick-complete validation.`,
      scheduled_at: todayPending,
      reminder_before_minutes: 30,
      status: "pending",
      priority: "high",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Summit Power")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Summit Power")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Summit Power")?.id ?? "") ?? null,
      assigned_user_id: userId,
      followup_type: "Email",
      title: "QA Overdue follow-up",
      description: `${QA_TAG} Overdue task for alert-state validation.`,
      scheduled_at: overduePending,
      reminder_before_minutes: 60,
      status: "pending",
      priority: "urgent",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Acme Manufacturing")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Acme Manufacturing")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Acme Manufacturing")?.id ?? "") ?? null,
      assigned_user_id: userId,
      followup_type: "Quotation Follow-up",
      title: "QA Upcoming follow-up",
      description: `${QA_TAG} Upcoming task created from completed meeting next step.`,
      scheduled_at: upcomingPending,
      reminder_before_minutes: 45,
      status: "pending",
      priority: "medium",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 20 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Prime Engineering")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Prime Engineering")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Prime Engineering")?.id ?? "") ?? null,
      assigned_user_id: userId,
      followup_type: "WhatsApp",
      title: "QA Completed follow-up",
      description: `${QA_TAG} Completed task for completed-history validation.`,
      scheduled_at: completedScheduled,
      reminder_before_minutes: 15,
      status: "completed",
      priority: "medium",
      completed_at: completedAt,
      completed_by: userId,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 96 * 60 * 60 * 1000),
      updated_at: completedAt,
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Metro Retail")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Metro Retail")?.id ?? "") ?? null,
      interaction_id: null,
      assigned_user_id: userId,
      followup_type: "Document Check",
      title: "QA Cancelled follow-up",
      description: `${QA_TAG} Cancelled task for status-history and edge-case coverage.`,
      scheduled_at: cancelledScheduled,
      reminder_before_minutes: 60,
      status: "cancelled",
      priority: "low",
      cancelled_reason: "Client requested to postpone this step until next quarter.",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
  ];

  const insertedFollowups = await insertRows(
    prisma,
    "followups",
    followupsPayload,
    "id::text as id, company_id::text as company_id, title, status",
  );

  const followupByTitle = new Map(insertedFollowups.map((item) => [item.title, item.id]));

  const documentsPayload = [
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Northwind Trading")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Northwind Trading")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Northwind Trading")?.id ?? "") ?? null,
      followup_id: followupByTitle.get("QA Today follow-up") ?? null,
      document_type: "Brochure",
      title: "QA Northwind Brochure",
      description: `${QA_TAG} Linked document for company-contact-meeting-follow-up context checks.`,
      file_name: "qa-northwind-brochure.pdf",
      file_path: "local://qa-launch-v1/northwind-brochure.pdf",
      file_url: "https://example.test/files/qa-northwind-brochure.pdf",
      file_size_mb: 1.4,
      mime_type: "application/pdf",
      file_extension: "pdf",
      status: "submitted",
      submitted_to: "Northwind Procurement",
      submitted_at: now,
      remarks: `${QA_TAG} External URL plus local path export scenario.`,
      created_by: userId,
      updated_by: userId,
      uploaded_by: userId,
      created_at: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 48 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Acme Manufacturing")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Acme Manufacturing")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Acme Manufacturing")?.id ?? "") ?? null,
      followup_id: followupByTitle.get("QA Upcoming follow-up") ?? null,
      document_type: "Proposal",
      title: "QA Acme Proposal",
      description: `${QA_TAG} Proposal linked to completed meeting and pending follow-up.`,
      file_name: "qa-acme-proposal.pdf",
      file_path: "local://qa-launch-v1/acme-proposal.pdf",
      file_size_mb: 2.2,
      mime_type: "application/pdf",
      file_extension: "pdf",
      status: "submitted",
      submitted_to: "Acme Finance Team",
      submitted_at: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      remarks: `${QA_TAG} Local file export scenario.`,
      created_by: userId,
      updated_by: userId,
      uploaded_by: userId,
      created_at: new Date(now.getTime() - 36 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 12 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Prime Engineering")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Prime Engineering")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Prime Engineering")?.id ?? "") ?? null,
      followup_id: followupByTitle.get("QA Completed follow-up") ?? null,
      document_type: "Agreement",
      title: "QA Prime Signed Agreement",
      description: `${QA_TAG} Signed document linked to completed workflow and won-stage company.`,
      file_name: "qa-prime-signed-agreement.pdf",
      file_path: "local://qa-launch-v1/prime-signed-agreement.pdf",
      file_size_mb: 3.1,
      mime_type: "application/pdf",
      file_extension: "pdf",
      status: "approved",
      submitted_to: "Prime Engineering",
      submitted_at: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      remarks: `${QA_TAG} Approved document scenario.`,
      created_by: userId,
      updated_by: userId,
      uploaded_by: userId,
      created_at: new Date(now.getTime() - 96 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 72 * 60 * 60 * 1000),
    },
  ];

  const insertedDocuments = await insertRows(
    prisma,
    "documents",
    documentsPayload,
    "id::text as id, company_id::text as company_id, title",
  );

  const documentByTitle = new Map(insertedDocuments.map((item) => [item.title, item.id]));

  const helpRequestsPayload = [
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Northwind Trading")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Northwind Trading")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Northwind Trading")?.id ?? "") ?? null,
      followup_id: followupByTitle.get("QA Today follow-up") ?? null,
      document_id: documentByTitle.get("QA Northwind Brochure") ?? null,
      requested_by: userId,
      assigned_to: null,
      help_type: "Need Proposal Support",
      title: "QA Open help request",
      description: `${QA_TAG} Open support request for dashboard and company detail validation.`,
      priority: "high",
      status: "open",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Summit Power")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Summit Power")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Summit Power")?.id ?? "") ?? null,
      followup_id: followupByTitle.get("QA Overdue follow-up") ?? null,
      document_id: null,
      requested_by: userId,
      assigned_to: userId,
      help_type: "Need Technical Clarification",
      title: "QA In-progress help request",
      description: `${QA_TAG} In-progress support case for assigned quick-action validation.`,
      priority: "urgent",
      status: "in_progress",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 30 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Acme Manufacturing")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Acme Manufacturing")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Acme Manufacturing")?.id ?? "") ?? null,
      followup_id: followupByTitle.get("QA Upcoming follow-up") ?? null,
      document_id: documentByTitle.get("QA Acme Proposal") ?? null,
      requested_by: userId,
      assigned_to: userId,
      help_type: "Need Price Approval",
      title: "QA Resolved help request",
      description: `${QA_TAG} Resolved support case for completed-task history validation.`,
      priority: "medium",
      status: "resolved",
      resolution_note: "Pricing approval confirmed by finance.",
      resolved_at: new Date(now.getTime() - 90 * 60 * 1000),
      resolved_by: userId,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 90 * 60 * 1000),
    },
    {
      organization_id: organizationId,
      company_id: companyByName.get("QA Vertex Solutions")?.id ?? null,
      contact_person_id: primaryContactByCompanyId.get(companyByName.get("QA Vertex Solutions")?.id ?? "") ?? null,
      interaction_id: interactionByCompanyId.get(companyByName.get("QA Vertex Solutions")?.id ?? "") ?? null,
      followup_id: null,
      document_id: null,
      requested_by: userId,
      assigned_to: userId,
      help_type: "Need Senior Meeting",
      title: "QA Rejected help request",
      description: `${QA_TAG} Rejected support case for status transition coverage.`,
      priority: "low",
      status: "rejected",
      resolution_note: "Request is not needed after negotiation scope was reduced.",
      created_by: userId,
      updated_by: userId,
      created_at: new Date(now.getTime() - 42 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
  ];

  await insertRows(prisma, "help_requests", helpRequestsPayload, "id::text as id");

  return {
    created: true,
    organizationId,
    counts: await getQaSeedCounts(prisma, organizationId),
  };
}

export async function cleanupQaDataset(prisma, organizationId) {
  const companies = await prisma.company.findMany({
    where: {
      organization_id: organizationId,
      notes: { contains: QA_TAG },
    },
    select: { id: true },
  });

  if (companies.length === 0) {
    return { deletedCompanies: 0 };
  }

  const deleted = await prisma.company.deleteMany({
    where: {
      id: { in: companies.map((item) => item.id) },
    },
  });

  return {
    deletedCompanies: deleted.count,
  };
}

export async function validateQaDataset(prisma, organizationId) {
  const counts = await getQaSeedCounts(prisma, organizationId);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [
    meetingCompletionSummary,
    overduePendingFollowups,
    todayPendingFollowups,
    upcomingPendingFollowups,
    completedFollowups,
    helpStateRows,
    orphanContactLinks,
    orphanInteractionLinks,
    orphanFollowupLinks,
    orphanDocumentLinks,
    orphanHelpRequestLinks,
  ] = await Promise.all([
    (async () => {
      const hasCompletedAt = await hasTableColumn(prisma, "interactions", "completed_at");
      if (!hasCompletedAt) {
        return { count: 0, missingActor: 0, upcoming: 0, supported: false };
      }

      const [countRows, missingActorRows, upcomingRows] = await Promise.all([
        prisma.$queryRawUnsafe(
          `select count(*)::int as count
           from public.interactions
           where organization_id = $1::uuid
             and discussion_details like $2
             and completed_at is not null`,
          organizationId,
          `%${QA_TAG}%`,
        ),
        prisma.$queryRawUnsafe(
          `select count(*)::int as count
           from public.interactions
           where organization_id = $1::uuid
             and discussion_details like $2
             and completed_at is not null
             and completed_by is null`,
          organizationId,
          `%${QA_TAG}%`,
        ),
        prisma.$queryRawUnsafe(
          `select count(*)::int as count
           from public.interactions
           where organization_id = $1::uuid
             and discussion_details like $2
             and completed_at is not null
             and meeting_datetime >= $3`,
          organizationId,
          `%${QA_TAG}%`,
          now,
        ),
      ]);

      return {
        count: Number(countRows?.[0]?.count ?? 0),
        missingActor: Number(missingActorRows?.[0]?.count ?? 0),
        upcoming: Number(upcomingRows?.[0]?.count ?? 0),
        supported: true,
      };
    })(),
    prisma.followup.count({
      where: {
        organization_id: organizationId,
        description: { contains: QA_TAG },
        status: "pending",
        scheduled_at: { lt: startOfToday },
      },
    }),
    prisma.followup.count({
      where: {
        organization_id: organizationId,
        description: { contains: QA_TAG },
        status: "pending",
        scheduled_at: { gte: startOfToday, lte: endOfToday },
      },
    }),
    prisma.followup.count({
      where: {
        organization_id: organizationId,
        description: { contains: QA_TAG },
        status: "pending",
        scheduled_at: { gt: endOfToday },
      },
    }),
    prisma.followup.count({
      where: {
        organization_id: organizationId,
        description: { contains: QA_TAG },
        status: "completed",
        completed_at: { not: null },
      },
    }),
    prisma.helpRequest.groupBy({
      by: ["status"],
      where: {
        organization_id: organizationId,
        description: { contains: QA_TAG },
      },
      _count: { _all: true },
    }),
    prisma.$queryRawUnsafe(
      `
        select count(*)::int as count
        from public.contact_persons cp
        left join public.companies c on c.id = cp.company_id
        where cp.organization_id = $1::uuid
          and cp.remarks like $2
          and c.id is null
      `,
      organizationId,
      `%${QA_TAG}%`,
    ),
    prisma.$queryRawUnsafe(
      `
        select count(*)::int as count
        from public.interactions i
        left join public.companies c on c.id = i.company_id
        left join public.contact_persons cp on cp.id = i.contact_person_id
        where i.organization_id = $1::uuid
          and i.discussion_details like $2
          and (c.id is null or (i.contact_person_id is not null and cp.id is null))
      `,
      organizationId,
      `%${QA_TAG}%`,
    ),
    prisma.$queryRawUnsafe(
      `
        select count(*)::int as count
        from public.followups f
        left join public.companies c on c.id = f.company_id
        left join public.contact_persons cp on cp.id = f.contact_person_id
        left join public.interactions i on i.id = f.interaction_id
        where f.organization_id = $1::uuid
          and f.description like $2
          and (
            c.id is null
            or (f.contact_person_id is not null and cp.id is null)
            or (f.interaction_id is not null and i.id is null)
          )
      `,
      organizationId,
      `%${QA_TAG}%`,
    ),
    prisma.$queryRawUnsafe(
      `
        select count(*)::int as count
        from public.documents d
        left join public.companies c on c.id = d.company_id
        left join public.contact_persons cp on cp.id = d.contact_person_id
        left join public.interactions i on i.id = d.interaction_id
        left join public.followups f on f.id = d.followup_id
        where d.organization_id = $1::uuid
          and d.description like $2
          and (
            c.id is null
            or (d.contact_person_id is not null and cp.id is null)
            or (d.interaction_id is not null and i.id is null)
            or (d.followup_id is not null and f.id is null)
          )
      `,
      organizationId,
      `%${QA_TAG}%`,
    ),
    prisma.$queryRawUnsafe(
      `
        select count(*)::int as count
        from public.help_requests hr
        left join public.companies c on c.id = hr.company_id
        left join public.contact_persons cp on cp.id = hr.contact_person_id
        left join public.interactions i on i.id = hr.interaction_id
        left join public.followups f on f.id = hr.followup_id
        left join public.documents d on d.id = hr.document_id
        where hr.organization_id = $1::uuid
          and hr.description like $2
          and (
            c.id is null
            or (hr.contact_person_id is not null and cp.id is null)
            or (hr.interaction_id is not null and i.id is null)
            or (hr.followup_id is not null and f.id is null)
            or (hr.document_id is not null and d.id is null)
          )
      `,
      organizationId,
      `%${QA_TAG}%`,
    ),
  ]);

  const completedMeetingsCount = meetingCompletionSummary.count ?? 0;
  const completedMeetingsMissingActor = meetingCompletionSummary.missingActor ?? 0;
  const upcomingCompletedMeetings = meetingCompletionSummary.upcoming ?? 0;

  const helpStates = Object.fromEntries(helpStateRows.map((item) => [item.status ?? "unknown", item._count._all]));

  return {
    counts,
    assertions: [
      { key: "seeded-companies", ok: counts.companies >= 6, details: `Companies: ${counts.companies}` },
      { key: "seeded-contacts", ok: counts.contacts >= 8, details: `Contacts: ${counts.contacts}` },
      { key: "seeded-interactions", ok: counts.interactions >= 5, details: `Meetings: ${counts.interactions}` },
      { key: "seeded-followups", ok: counts.followups >= 5, details: `Follow-ups: ${counts.followups}` },
      { key: "seeded-documents", ok: counts.documents >= 3, details: `Documents: ${counts.documents}` },
      { key: "seeded-help-requests", ok: counts.helpRequests >= 4, details: `Help requests: ${counts.helpRequests}` },
      { key: "completed-meetings-present", ok: completedMeetingsCount >= 2, details: `Completed meetings: ${completedMeetingsCount}` },
      { key: "completed-meetings-have-actor", ok: completedMeetingsMissingActor === 0, details: `Missing completed_by: ${completedMeetingsMissingActor}` },
      { key: "no-future-completed-meetings", ok: upcomingCompletedMeetings === 0, details: `Future meetings already completed: ${upcomingCompletedMeetings}` },
      { key: "overdue-followups-present", ok: overduePendingFollowups >= 1, details: `Overdue pending follow-ups: ${overduePendingFollowups}` },
      { key: "today-followups-present", ok: todayPendingFollowups >= 1, details: `Today pending follow-ups: ${todayPendingFollowups}` },
      { key: "upcoming-followups-present", ok: upcomingPendingFollowups >= 1, details: `Upcoming pending follow-ups: ${upcomingPendingFollowups}` },
      { key: "completed-followups-present", ok: completedFollowups >= 1, details: `Completed follow-ups: ${completedFollowups}` },
      { key: "open-help-present", ok: (helpStates.open ?? 0) >= 1, details: `Open help requests: ${helpStates.open ?? 0}` },
      { key: "in-progress-help-present", ok: (helpStates.in_progress ?? 0) >= 1, details: `In-progress help requests: ${helpStates.in_progress ?? 0}` },
      { key: "resolved-help-present", ok: (helpStates.resolved ?? 0) >= 1, details: `Resolved help requests: ${helpStates.resolved ?? 0}` },
      { key: "contact-links-intact", ok: Number(orphanContactLinks[0]?.count ?? 0) === 0, details: `Orphan contacts: ${orphanContactLinks[0]?.count ?? 0}` },
      { key: "interaction-links-intact", ok: Number(orphanInteractionLinks[0]?.count ?? 0) === 0, details: `Orphan meetings: ${orphanInteractionLinks[0]?.count ?? 0}` },
      { key: "followup-links-intact", ok: Number(orphanFollowupLinks[0]?.count ?? 0) === 0, details: `Orphan follow-ups: ${orphanFollowupLinks[0]?.count ?? 0}` },
      { key: "document-links-intact", ok: Number(orphanDocumentLinks[0]?.count ?? 0) === 0, details: `Orphan documents: ${orphanDocumentLinks[0]?.count ?? 0}` },
      { key: "help-request-links-intact", ok: Number(orphanHelpRequestLinks[0]?.count ?? 0) === 0, details: `Orphan help requests: ${orphanHelpRequestLinks[0]?.count ?? 0}` },
    ],
    helpStates,
  };
}
