import "server-only";

import { Prisma } from "@prisma/client";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/session";

export type AdminDateRange = "30d" | "90d" | "365d" | "all" | "custom";

export type AdminFilters = {
  dateRange: AdminDateRange;
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  userId?: string;
  status?: string;
  query?: string;
  page: number;
  pageSize: number;
};

export type AdminFilterOption = {
  id: string;
  label: string;
  meta?: string | null;
};

export type AdminFilterOptions = {
  workspaces: AdminFilterOption[];
  users: AdminFilterOption[];
};

export type AdminKpiSnapshot = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingSignupRequests: number;
  totalWorkspaces: number;
  totalCompanies: number;
  totalMeetings: number;
  totalFollowups: number;
  totalDocuments: number;
  totalHelpRequests: number;
  totalPipelineValue: number;
};

export type AdminAccessRequestSummary = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  reviewed_by_email: string | null;
};

export type AdminActivityRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  organization_id: string | null;
  organization_name: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  metadata: Prisma.JsonValue;
};

export type AdminAlert = {
  id: string;
  title: string;
  description: string;
  tone: "rose" | "amber" | "sky" | "emerald";
  href: string;
};

export type AdminOverviewData = {
  filters: AdminFilters;
  filterOptions: AdminFilterOptions;
  kpis: AdminKpiSnapshot;
  userGrowthTrend: Array<{ month: string; users: number }>;
  workspaceActivity: Array<{ workspace: string; activityCount: number }>;
  signupRequestFunnel: Array<{ status: string; count: number }>;
  pipelineValueByWorkspace: Array<{ workspace: string; value: number }>;
  userActivityDistribution: Array<{ user: string; activityCount: number }>;
  latestAccessRequests: AdminAccessRequestSummary[];
  recentActivity: AdminActivityRow[];
  recentWorkspaces: AdminWorkspaceRow[];
  alerts: AdminAlert[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  role_name: string | null;
  role_slug: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  companies_count: number;
  meetings_count: number;
  followups_count: number;
  documents_count: number;
  help_requests_count: number;
};

export type AdminUserDetail = AdminUserRow & {
  job_title: string | null;
  department: string | null;
  phone: string | null;
  workspace_member_count: number;
  recentActivity: AdminActivityRow[];
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  company_size: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  member_count: number;
  active_member_count: number;
  companies_count: number;
  meetings_count: number;
  followups_pending_count: number;
  documents_count: number;
  help_requests_open_count: number;
  pipeline_value: number;
  activity_count: number;
  last_activity_at: string | null;
  created_at: string;
};

export type AdminWorkspaceMember = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  role_name: string | null;
  role_slug: string | null;
};

export type AdminWorkspaceDetail = AdminWorkspaceRow & {
  members: AdminWorkspaceMember[];
  recentActivity: AdminActivityRow[];
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveAdminFilters(searchParams: RawSearchParams): AdminFilters {
  const dateRange = toSingle(searchParams.dateRange);
  const resolvedDateRange: AdminDateRange =
    dateRange === "30d" || dateRange === "90d" || dateRange === "365d" || dateRange === "all" || dateRange === "custom"
      ? dateRange
      : "30d";
  const { page, pageSize } = resolvePagination({
    page: toSingle(searchParams.page),
    pageSize: toSingle(searchParams.pageSize),
  });

  return {
    dateRange: resolvedDateRange,
    startDate: toSingle(searchParams.startDate),
    endDate: toSingle(searchParams.endDate),
    workspaceId: toSingle(searchParams.workspaceId) || undefined,
    userId: toSingle(searchParams.userId) || undefined,
    status: toSingle(searchParams.status) || undefined,
    query: toSingle(searchParams.query) || undefined,
    page,
    pageSize,
  };
}

function buildDateWindow(filters: AdminFilters) {
  if (filters.dateRange === "all") {
    return { start: null as Date | null, end: null as Date | null };
  }

  const now = new Date();
  const end = filters.endDate ? new Date(filters.endDate) : new Date(now);
  end.setHours(23, 59, 59, 999);

  if (filters.dateRange === "custom") {
    const start = filters.startDate ? new Date(filters.startDate) : new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filters.dateRange === "90d") {
    start.setDate(start.getDate() - 89);
  } else if (filters.dateRange === "365d") {
    start.setDate(start.getDate() - 364);
  } else {
    start.setDate(start.getDate() - 29);
  }

  return { start, end };
}

function numberValue(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function dateClause(column: Prisma.Sql, filters: AdminFilters) {
  const { start, end } = buildDateWindow(filters);
  if (!start || !end) {
    return Prisma.empty;
  }

  return Prisma.sql` and ${column} >= ${start.toISOString()}::timestamptz and ${column} <= ${end.toISOString()}::timestamptz`;
}

function workspaceClause(column: Prisma.Sql, filters: AdminFilters) {
  if (!filters.workspaceId) {
    return Prisma.empty;
  }

  return Prisma.sql` and ${column} = ${filters.workspaceId}::uuid`;
}

function actorClause(column: Prisma.Sql, filters: AdminFilters) {
  if (!filters.userId) {
    return Prisma.empty;
  }

  return Prisma.sql` and ${column} = ${filters.userId}::uuid`;
}

function ilikeClause(parts: Prisma.Sql[], query?: string) {
  if (!query?.trim()) {
    return Prisma.empty;
  }

  const like = `%${query.trim().toLowerCase()}%`;
  return Prisma.sql` and (${Prisma.join(parts.map((part) => Prisma.sql`lower(${part}) like ${like}`), " or ")})`;
}

export async function getAdminFilterOptions(): Promise<AdminFilterOptions> {
  await requireSuperAdmin();

  const [workspaces, users] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.user.findMany({
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
      },
      take: 250,
    }),
  ]);

  return {
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      label: workspace.name,
      meta: workspace.slug,
    })),
    users: users.map((user) => ({
      id: user.id,
      label: user.name?.trim() || user.email,
      meta: user.email,
    })),
  };
}

export async function getAdminOverviewData(filters: AdminFilters): Promise<AdminOverviewData> {
  await requireSuperAdmin();
  const [filterOptions, kpis, userGrowthTrend, workspaceActivity, signupRequestFunnel, pipelineValueByWorkspace, userActivityDistribution, latestAccessRequests, recentActivity, recentWorkspaces, alerts] = await Promise.all([
    getAdminFilterOptions(),
    getPlatformKpis(filters),
    getUserGrowthTrend(filters),
    getWorkspaceActivityComparison(filters),
    getSignupRequestFunnel(),
    getPipelineValueByWorkspace(filters),
    getUserActivityDistribution(filters),
    listLatestAccessRequests(),
    listAdminActivity(filters, 8),
    listAdminWorkspaces({ ...filters, page: 1, pageSize: 5 }).then((result) => result.rows),
    listAdminAlerts(filters),
  ]);

  return {
    filters,
    filterOptions,
    kpis,
    userGrowthTrend,
    workspaceActivity,
    signupRequestFunnel,
    pipelineValueByWorkspace,
    userActivityDistribution,
    latestAccessRequests,
    recentActivity,
    recentWorkspaces,
    alerts,
  };
}

async function getPlatformKpis(filters: AdminFilters): Promise<AdminKpiSnapshot> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    select
      (select count(*) from public.profiles p where 1=1 ${workspaceClause(Prisma.sql`p.organization_id`, filters)}) as total_users,
      (select count(*) from public.profiles p where p.is_active = true ${workspaceClause(Prisma.sql`p.organization_id`, filters)}) as active_users,
      (select count(*) from public.profiles p where p.is_active = false ${workspaceClause(Prisma.sql`p.organization_id`, filters)}) as inactive_users,
      (select count(*) from public.signup_requests sr where sr.status = 'pending') as pending_signup_requests,
      (select count(*) from public.organizations o where 1=1 ${filters.workspaceId ? Prisma.sql` and o.id = ${filters.workspaceId}::uuid` : Prisma.empty}) as total_workspaces,
      (select count(*) from public.companies c where c.status <> 'archived' ${workspaceClause(Prisma.sql`c.organization_id`, filters)} ${actorClause(Prisma.sql`c.assigned_user_id`, filters)} ${dateClause(Prisma.sql`c.created_at`, filters)}) as total_companies,
      (select count(*) from public.interactions i where i.status <> 'archived' ${workspaceClause(Prisma.sql`i.organization_id`, filters)} ${actorClause(Prisma.sql`i.assigned_user_id`, filters)} ${dateClause(Prisma.sql`i.created_at`, filters)}) as total_meetings,
      (select count(*) from public.followups f where 1=1 ${workspaceClause(Prisma.sql`f.organization_id`, filters)} ${actorClause(Prisma.sql`f.assigned_user_id`, filters)} ${dateClause(Prisma.sql`f.created_at`, filters)}) as total_followups,
      (select count(*) from public.documents d where d.status <> 'archived' ${workspaceClause(Prisma.sql`d.organization_id`, filters)} ${actorClause(Prisma.sql`d.uploaded_by`, filters)} ${dateClause(Prisma.sql`d.created_at`, filters)}) as total_documents,
      (select count(*) from public.help_requests hr where 1=1 ${workspaceClause(Prisma.sql`hr.organization_id`, filters)} ${actorClause(Prisma.sql`hr.assigned_to`, filters)} ${dateClause(Prisma.sql`hr.created_at`, filters)}) as total_help_requests,
      (select coalesce(sum(c.estimated_value), 0) from public.companies c where c.status <> 'archived' ${workspaceClause(Prisma.sql`c.organization_id`, filters)} ${actorClause(Prisma.sql`c.assigned_user_id`, filters)}) as total_pipeline_value
  `);

  const row = rows[0] ?? {};
  return {
    totalUsers: numberValue(row.total_users),
    activeUsers: numberValue(row.active_users),
    inactiveUsers: numberValue(row.inactive_users),
    pendingSignupRequests: numberValue(row.pending_signup_requests),
    totalWorkspaces: numberValue(row.total_workspaces),
    totalCompanies: numberValue(row.total_companies),
    totalMeetings: numberValue(row.total_meetings),
    totalFollowups: numberValue(row.total_followups),
    totalDocuments: numberValue(row.total_documents),
    totalHelpRequests: numberValue(row.total_help_requests),
    totalPipelineValue: numberValue(row.total_pipeline_value),
  };
}

async function getUserGrowthTrend(filters: AdminFilters) {
  const rows = await prisma.$queryRaw<Array<{ month_key: string; count: bigint }>>(Prisma.sql`
    select to_char(date_trunc('month', p.created_at), 'YYYY-MM') as month_key, count(*)::bigint as count
    from public.profiles p
    where 1=1
      ${workspaceClause(Prisma.sql`p.organization_id`, filters)}
      ${dateClause(Prisma.sql`p.created_at`, filters)}
    group by 1
    order by 1 asc
  `);

  return rows.map((row) => ({ month: row.month_key, users: Number(row.count) }));
}

async function getWorkspaceActivityComparison(filters: AdminFilters) {
  const rows = await prisma.$queryRaw<Array<{ workspace_name: string; activity_count: bigint }>>(Prisma.sql`
    select o.name as workspace_name, count(al.id)::bigint as activity_count
    from public.organizations o
    left join public.activity_logs al on al.organization_id = o.id
    where 1=1
      ${filters.workspaceId ? Prisma.sql` and o.id = ${filters.workspaceId}::uuid` : Prisma.empty}
      ${filters.userId ? Prisma.sql` and al.actor_user_id = ${filters.userId}::uuid` : Prisma.empty}
      ${dateClause(Prisma.sql`al.created_at`, filters)}
    group by o.id, o.name
    order by activity_count desc, o.name asc
    limit 8
  `);

  return rows.map((row) => ({ workspace: row.workspace_name, activityCount: Number(row.activity_count) }));
}

async function getSignupRequestFunnel() {
  const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
    select status, count(*)::bigint as count
    from public.signup_requests
    group by status
    order by status asc
  `);

  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}

async function getPipelineValueByWorkspace(filters: AdminFilters) {
  const rows = await prisma.$queryRaw<Array<{ workspace_name: string; total_value: unknown }>>(Prisma.sql`
    select o.name as workspace_name, coalesce(sum(c.estimated_value), 0) as total_value
    from public.organizations o
    left join public.companies c on c.organization_id = o.id and c.status <> 'archived'
    where 1=1
      ${filters.workspaceId ? Prisma.sql` and o.id = ${filters.workspaceId}::uuid` : Prisma.empty}
      ${filters.userId ? Prisma.sql` and c.assigned_user_id = ${filters.userId}::uuid` : Prisma.empty}
    group by o.id, o.name
    order by total_value desc, o.name asc
    limit 8
  `);

  return rows.map((row) => ({ workspace: row.workspace_name, value: numberValue(row.total_value) }));
}

async function getUserActivityDistribution(filters: AdminFilters) {
  const rows = await prisma.$queryRaw<Array<{ user_label: string; activity_count: bigint }>>(Prisma.sql`
    select coalesce(nullif(trim(p.full_name), ''), p.email) as user_label, count(al.id)::bigint as activity_count
    from public.activity_logs al
    join public.profiles p on p.id = al.actor_user_id
    where 1=1
      ${workspaceClause(Prisma.sql`al.organization_id`, filters)}
      ${actorClause(Prisma.sql`al.actor_user_id`, filters)}
      ${dateClause(Prisma.sql`al.created_at`, filters)}
    group by p.id, p.full_name, p.email
    order by activity_count desc, user_label asc
    limit 8
  `);

  return rows.map((row) => ({ user: row.user_label, activityCount: Number(row.activity_count) }));
}

async function listLatestAccessRequests(): Promise<AdminAccessRequestSummary[]> {
  const rows = await prisma.$queryRaw<AdminAccessRequestSummary[]>(Prisma.sql`
    select
      sr.id::text as id,
      sr.email,
      sr.full_name,
      sr.status,
      sr.requested_at::text as requested_at,
      sr.approved_at::text as approved_at,
      sr.rejected_at::text as rejected_at,
      sr.completed_at::text as completed_at,
      reviewer.email as reviewed_by_email
    from public.signup_requests sr
    left join public.profiles reviewer on reviewer.id = sr.reviewed_by
    order by sr.requested_at desc
    limit 6
  `);

  return rows;
}

export async function listAdminActivity(filters: AdminFilters, limit = 20): Promise<AdminActivityRow[]> {
  await requireSuperAdmin();

  const rows = await prisma.$queryRaw<AdminActivityRow[]>(Prisma.sql`
    select
      al.id::text as id,
      al.created_at::text as created_at,
      al.action,
      al.entity_type,
      al.entity_id::text as entity_id,
      al.organization_id::text as organization_id,
      o.name as organization_name,
      al.actor_user_id::text as actor_user_id,
      p.full_name as actor_name,
      p.email as actor_email,
      al.metadata
    from public.activity_logs al
    left join public.organizations o on o.id = al.organization_id
    left join public.profiles p on p.id = al.actor_user_id
    where 1=1
      ${workspaceClause(Prisma.sql`al.organization_id`, filters)}
      ${actorClause(Prisma.sql`al.actor_user_id`, filters)}
      ${dateClause(Prisma.sql`al.created_at`, filters)}
      ${filters.status?.trim() ? Prisma.sql` and lower(al.action) like ${`%${filters.status.trim().toLowerCase()}%`}` : Prisma.empty}
      ${ilikeClause([Prisma.sql`coalesce(p.full_name, '')`, Prisma.sql`p.email`, Prisma.sql`al.action`, Prisma.sql`coalesce(o.name, '')`], filters.query)}
    order by al.created_at desc
    limit ${limit}
  `);

  return rows;
}

async function listAdminAlerts(filters: AdminFilters): Promise<AdminAlert[]> {
  const [inactiveRows, overdueRows, pendingRows, quietWorkspaceRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      select count(*)::bigint as count
      from public.profiles p
      where p.is_active = false
        ${workspaceClause(Prisma.sql`p.organization_id`, filters)}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      select count(*)::bigint as count
      from public.followups f
      where f.status = 'pending'
        and f.scheduled_at < now()
        ${workspaceClause(Prisma.sql`f.organization_id`, filters)}
        ${actorClause(Prisma.sql`f.assigned_user_id`, filters)}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      select count(*)::bigint as count from public.signup_requests where status = 'pending'
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      select count(*)::bigint as count
      from public.organizations o
      left join lateral (
        select max(al.created_at) as last_activity_at
        from public.activity_logs al
        where al.organization_id = o.id
      ) latest on true
      where 1=1
        ${filters.workspaceId ? Prisma.sql` and o.id = ${filters.workspaceId}::uuid` : Prisma.empty}
        and (latest.last_activity_at is null or latest.last_activity_at < now() - interval '14 days')
    `),
  ]);

  const alerts: AdminAlert[] = [];
  const inactiveCount = Number(inactiveRows[0]?.count ?? 0);
  const overdueCount = Number(overdueRows[0]?.count ?? 0);
  const pendingCount = Number(pendingRows[0]?.count ?? 0);
  const quietWorkspaceCount = Number(quietWorkspaceRows[0]?.count ?? 0);

  if (inactiveCount > 0) {
    alerts.push({
      id: "inactive-users",
      title: `${inactiveCount} inactive user${inactiveCount === 1 ? "" : "s"}`,
      description: "Some accounts are disabled and may need review or reactivation.",
      tone: "rose",
      href: "/admin/users?status=inactive",
    });
  }

  if (pendingCount > 0) {
    alerts.push({
      id: "pending-requests",
      title: `${pendingCount} pending signup request${pendingCount === 1 ? "" : "s"}`,
      description: "New account requests are waiting for super admin approval.",
      tone: "amber",
      href: "/admin/access-requests",
    });
  }

  if (overdueCount > 0) {
    alerts.push({
      id: "overdue-followups",
      title: `${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"}`,
      description: "Workspace execution needs attention across pending follow-ups.",
      tone: "sky",
      href: "/admin/analytics?status=followup",
    });
  }

  if (quietWorkspaceCount > 0) {
    alerts.push({
      id: "quiet-workspaces",
      title: `${quietWorkspaceCount} quiet workspace${quietWorkspaceCount === 1 ? "" : "s"}`,
      description: "Some workspaces show little or no activity in the last 14 days.",
      tone: "emerald",
      href: "/admin/workspaces",
    });
  }

  return alerts;
}

export async function listAdminUsers(filters: AdminFilters): Promise<PaginatedResult<AdminUserRow>> {
  await requireSuperAdmin();
  const { from, page, pageSize } = resolvePagination(filters);

  const statusClause = filters.status === "active"
    ? Prisma.sql` and p.is_active = true`
    : filters.status === "inactive"
      ? Prisma.sql` and p.is_active = false`
      : filters.status === "super_admin"
        ? Prisma.sql` and p.is_super_admin = true`
        : Prisma.empty;

  const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    select count(*)::bigint as count
    from public.profiles p
    where 1=1
      ${workspaceClause(Prisma.sql`p.organization_id`, filters)}
      ${statusClause}
      ${ilikeClause([Prisma.sql`coalesce(p.full_name, '')`, Prisma.sql`p.email`, Prisma.sql`coalesce(p.job_title, '')`, Prisma.sql`coalesce(p.department, '')`], filters.query)}
  `);

  const rows = await prisma.$queryRaw<AdminUserRow[]>(Prisma.sql`
    select
      p.id::text as id,
      p.email,
      p.full_name,
      p.organization_id::text as organization_id,
      o.name as organization_name,
      role_info.role_name,
      role_info.role_slug,
      p.is_active,
      p.is_super_admin,
      max(coalesce(s.updated_at, s.created_at))::text as last_login_at,
      p.created_at::text as created_at,
      (
        select count(*)
        from public.companies c
        where c.organization_id = p.organization_id
          and c.assigned_user_id = p.id
          and c.status <> 'archived'
      )::int as companies_count,
      (
        select count(*)
        from public.interactions i
        where i.organization_id = p.organization_id
          and i.assigned_user_id = p.id
          and i.status <> 'archived'
      )::int as meetings_count,
      (
        select count(*)
        from public.followups f
        where f.organization_id = p.organization_id
          and f.assigned_user_id = p.id
      )::int as followups_count,
      (
        select count(*)
        from public.documents d
        where d.organization_id = p.organization_id
          and d.uploaded_by = p.id
          and d.status <> 'archived'
      )::int as documents_count,
      (
        select count(*)
        from public.help_requests hr
        where hr.organization_id = p.organization_id
          and (hr.requested_by = p.id or hr.assigned_to = p.id)
      )::int as help_requests_count
    from public.profiles p
    left join public.organizations o on o.id = p.organization_id
    left join lateral (
      select r.name as role_name, r.slug as role_slug
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p.id
      order by ur.assigned_at asc
      limit 1
    ) role_info on true
    left join public.sessions s on s."userId" = p.id
    where 1=1
      ${workspaceClause(Prisma.sql`p.organization_id`, filters)}
      ${statusClause}
      ${ilikeClause([Prisma.sql`coalesce(p.full_name, '')`, Prisma.sql`p.email`, Prisma.sql`coalesce(p.job_title, '')`, Prisma.sql`coalesce(p.department, '')`], filters.query)}
    group by p.id, o.name, role_info.role_name, role_info.role_slug
    order by p.created_at desc, p.email asc
    offset ${from}
    limit ${pageSize}
  `);

  return {
    rows,
    total: Number(totalRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  await requireSuperAdmin();

  const rows = await prisma.$queryRaw<AdminUserDetail[]>(Prisma.sql`
    select
      p.id::text as id,
      p.email,
      p.full_name,
      p.organization_id::text as organization_id,
      o.name as organization_name,
      role_info.role_name,
      role_info.role_slug,
      p.is_active,
      p.is_super_admin,
      max(coalesce(s.updated_at, s.created_at))::text as last_login_at,
      p.created_at::text as created_at,
      p.job_title,
      p.department,
      p.phone,
      (
        select count(*) from public.profiles members where members.organization_id = p.organization_id
      )::int as workspace_member_count,
      (
        select count(*) from public.companies c where c.organization_id = p.organization_id and c.assigned_user_id = p.id and c.status <> 'archived'
      )::int as companies_count,
      (
        select count(*) from public.interactions i where i.organization_id = p.organization_id and i.assigned_user_id = p.id and i.status <> 'archived'
      )::int as meetings_count,
      (
        select count(*) from public.followups f where f.organization_id = p.organization_id and f.assigned_user_id = p.id
      )::int as followups_count,
      (
        select count(*) from public.documents d where d.organization_id = p.organization_id and d.uploaded_by = p.id and d.status <> 'archived'
      )::int as documents_count,
      (
        select count(*) from public.help_requests hr where hr.organization_id = p.organization_id and (hr.requested_by = p.id or hr.assigned_to = p.id)
      )::int as help_requests_count
    from public.profiles p
    left join public.organizations o on o.id = p.organization_id
    left join lateral (
      select r.name as role_name, r.slug as role_slug
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p.id
      order by ur.assigned_at asc
      limit 1
    ) role_info on true
    left join public.sessions s on s."userId" = p.id
    where p.id = ${userId}::uuid
    group by p.id, o.name, role_info.role_name, role_info.role_slug
    limit 1
  `);

  const user = rows[0] ?? null;
  if (!user) {
    return null;
  }

  const recentActivity = await prisma.$queryRaw<AdminActivityRow[]>(Prisma.sql`
    select
      al.id::text as id,
      al.created_at::text as created_at,
      al.action,
      al.entity_type,
      al.entity_id::text as entity_id,
      al.organization_id::text as organization_id,
      o.name as organization_name,
      al.actor_user_id::text as actor_user_id,
      p.full_name as actor_name,
      p.email as actor_email,
      al.metadata
    from public.activity_logs al
    left join public.organizations o on o.id = al.organization_id
    left join public.profiles p on p.id = al.actor_user_id
    where al.actor_user_id = ${userId}::uuid
    order by al.created_at desc
    limit 12
  `);

  return {
    ...user,
    recentActivity,
  };
}

export async function listAdminWorkspaces(filters: AdminFilters): Promise<PaginatedResult<AdminWorkspaceRow>> {
  await requireSuperAdmin();
  const { from, page, pageSize } = resolvePagination(filters);
  const statusClause = filters.status === "quiet"
    ? Prisma.sql` and coalesce(latest_activity.last_activity_at, o.created_at) < now() - interval '14 days'`
    : Prisma.empty;

  const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    select count(*)::bigint as count
    from public.organizations o
    left join lateral (
      select max(al.created_at) as last_activity_at
      from public.activity_logs al
      where al.organization_id = o.id
    ) latest_activity on true
    where 1=1
      ${filters.workspaceId ? Prisma.sql` and o.id = ${filters.workspaceId}::uuid` : Prisma.empty}
      ${ilikeClause([Prisma.sql`o.name`, Prisma.sql`o.slug`, Prisma.sql`coalesce(owner.full_name, '')`, Prisma.sql`coalesce(owner.email, '')`], filters.query)}
      ${statusClause}
  `);

  const rows = await prisma.$queryRaw<AdminWorkspaceRow[]>(Prisma.sql`
    select
      o.id::text as id,
      o.name,
      o.slug,
      o.company_size,
      owner.id::text as owner_user_id,
      owner.full_name as owner_name,
      owner.email as owner_email,
      (
        select count(*) from public.profiles p where p.organization_id = o.id
      )::int as member_count,
      (
        select count(*) from public.profiles p where p.organization_id = o.id and p.is_active = true
      )::int as active_member_count,
      (
        select count(*) from public.companies c where c.organization_id = o.id and c.status <> 'archived'
      )::int as companies_count,
      (
        select count(*) from public.interactions i where i.organization_id = o.id and i.status <> 'archived'
      )::int as meetings_count,
      (
        select count(*) from public.followups f where f.organization_id = o.id and f.status = 'pending'
      )::int as followups_pending_count,
      (
        select count(*) from public.documents d where d.organization_id = o.id and d.status <> 'archived'
      )::int as documents_count,
      (
        select count(*) from public.help_requests hr where hr.organization_id = o.id and hr.status in ('open', 'in_progress')
      )::int as help_requests_open_count,
      (
        select coalesce(sum(c.estimated_value), 0) from public.companies c where c.organization_id = o.id and c.status <> 'archived'
      ) as pipeline_value,
      (
        select count(*) from public.activity_logs al where al.organization_id = o.id ${dateClause(Prisma.sql`al.created_at`, filters)}
      )::int as activity_count,
      latest_activity.last_activity_at::text as last_activity_at,
      o.created_at::text as created_at
    from public.organizations o
    left join public.profiles owner on owner.id = o.owner_user_id
    left join lateral (
      select max(al.created_at) as last_activity_at
      from public.activity_logs al
      where al.organization_id = o.id
    ) latest_activity on true
    where 1=1
      ${filters.workspaceId ? Prisma.sql` and o.id = ${filters.workspaceId}::uuid` : Prisma.empty}
      ${ilikeClause([Prisma.sql`o.name`, Prisma.sql`o.slug`, Prisma.sql`coalesce(owner.full_name, '')`, Prisma.sql`coalesce(owner.email, '')`], filters.query)}
      ${statusClause}
    order by coalesce(latest_activity.last_activity_at, o.created_at) desc, o.name asc
    offset ${from}
    limit ${pageSize}
  `);

  return {
    rows: rows.map((row) => ({ ...row, pipeline_value: numberValue(row.pipeline_value) })),
    total: Number(totalRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getAdminWorkspaceDetail(workspaceId: string): Promise<AdminWorkspaceDetail | null> {
  await requireSuperAdmin();

  const rows = await prisma.$queryRaw<AdminWorkspaceRow[]>(Prisma.sql`
    select
      o.id::text as id,
      o.name,
      o.slug,
      o.company_size,
      owner.id::text as owner_user_id,
      owner.full_name as owner_name,
      owner.email as owner_email,
      (
        select count(*) from public.profiles p where p.organization_id = o.id
      )::int as member_count,
      (
        select count(*) from public.profiles p where p.organization_id = o.id and p.is_active = true
      )::int as active_member_count,
      (
        select count(*) from public.companies c where c.organization_id = o.id and c.status <> 'archived'
      )::int as companies_count,
      (
        select count(*) from public.interactions i where i.organization_id = o.id and i.status <> 'archived'
      )::int as meetings_count,
      (
        select count(*) from public.followups f where f.organization_id = o.id and f.status = 'pending'
      )::int as followups_pending_count,
      (
        select count(*) from public.documents d where d.organization_id = o.id and d.status <> 'archived'
      )::int as documents_count,
      (
        select count(*) from public.help_requests hr where hr.organization_id = o.id and hr.status in ('open', 'in_progress')
      )::int as help_requests_open_count,
      (
        select coalesce(sum(c.estimated_value), 0) from public.companies c where c.organization_id = o.id and c.status <> 'archived'
      ) as pipeline_value,
      (
        select count(*) from public.activity_logs al where al.organization_id = o.id
      )::int as activity_count,
      (
        select max(al.created_at) from public.activity_logs al where al.organization_id = o.id
      )::text as last_activity_at,
      o.created_at::text as created_at
    from public.organizations o
    left join public.profiles owner on owner.id = o.owner_user_id
    where o.id = ${workspaceId}::uuid
    limit 1
  `);

  const workspace = rows[0] ? { ...rows[0], pipeline_value: numberValue(rows[0].pipeline_value) } : null;
  if (!workspace) {
    return null;
  }

  const [members, recentActivity] = await Promise.all([
    prisma.$queryRaw<AdminWorkspaceMember[]>(Prisma.sql`
      select
        p.id::text as id,
        p.email,
        p.full_name,
        p.is_active,
        p.is_super_admin,
        role_info.role_name,
        role_info.role_slug
      from public.profiles p
      left join lateral (
        select r.name as role_name, r.slug as role_slug
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p.id and ur.organization_id = ${workspaceId}::uuid
        order by ur.assigned_at asc
        limit 1
      ) role_info on true
      where p.organization_id = ${workspaceId}::uuid
      order by p.is_active desc, coalesce(nullif(trim(p.full_name), ''), p.email) asc
    `),
    prisma.$queryRaw<AdminActivityRow[]>(Prisma.sql`
      select
        al.id::text as id,
        al.created_at::text as created_at,
        al.action,
        al.entity_type,
        al.entity_id::text as entity_id,
        al.organization_id::text as organization_id,
        o.name as organization_name,
        al.actor_user_id::text as actor_user_id,
        p.full_name as actor_name,
        p.email as actor_email,
        al.metadata
      from public.activity_logs al
      left join public.organizations o on o.id = al.organization_id
      left join public.profiles p on p.id = al.actor_user_id
      where al.organization_id = ${workspaceId}::uuid
      order by al.created_at desc
      limit 12
    `),
  ]);

  return {
    ...workspace,
    members,
    recentActivity,
  };
}
