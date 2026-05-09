import { Prisma } from "@prisma/client";
import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { Followup, FollowupFilters } from "@/lib/crm/types";

type JsonRow<T> = {
  payload: T | null;
  total_count?: bigint | number | null;
};

function normalizeCount(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return Number(value ?? 0);
}

function buildFollowupWhere(organizationId: string, filters: FollowupFilters, includeArchived = true) {
  const clauses: Prisma.Sql[] = [Prisma.sql`f.organization_id = ${organizationId}::uuid`];

  if (!includeArchived) {
    clauses.push(Prisma.sql`f.status <> 'archived'`);
  }

  if (filters.company) clauses.push(Prisma.sql`f.company_id = ${filters.company}::uuid`);
  if (filters.contact) clauses.push(Prisma.sql`f.contact_person_id = ${filters.contact}::uuid`);
  if (filters.assigned) clauses.push(Prisma.sql`f.assigned_user_id = ${filters.assigned}::uuid`);
  if (filters.type) clauses.push(Prisma.sql`f.followup_type = ${filters.type}`);
  if (filters.priority) clauses.push(Prisma.sql`f.priority = ${filters.priority}`);
  if (filters.status) clauses.push(Prisma.sql`f.status = ${filters.status}`);
  if (filters.dateStart) clauses.push(Prisma.sql`f.scheduled_at >= ${filters.dateStart}::timestamptz`);
  if (filters.dateEnd) clauses.push(Prisma.sql`f.scheduled_at <= ${filters.dateEnd}::timestamptz`);

  if (filters.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    clauses.push(Prisma.sql`(f.title ilike ${search} or f.description ilike ${search})`);
  }

  return Prisma.join(clauses, " and ");
}

async function queryFollowupRows(whereSql: Prisma.Sql, pagination?: { from: number; pageSize: number }) {
  const paginationSql = pagination
    ? Prisma.sql` offset ${pagination.from} limit ${pagination.pageSize}`
    : Prisma.sql``;

  return prisma.$queryRaw<Array<JsonRow<Followup>>>(Prisma.sql`
    select
      (
        to_jsonb(f)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'interactions', case when i.id is null then null else jsonb_build_object('id', i.id, 'interaction_type', i.interaction_type, 'meeting_datetime', i.meeting_datetime) end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'created_profile', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'full_name', cr.full_name, 'email', cr.email) end
        )
      ) as payload,
      count(*) over() as total_count
    from public.followups f
    left join public.companies c on c.id = f.company_id
    left join public.contact_persons cp on cp.id = f.contact_person_id
    left join public.interactions i on i.id = f.interaction_id
    left join public.profiles ap on ap.id = f.assigned_user_id
    left join public.profiles cr on cr.id = f.created_by
    where ${whereSql}
    order by f.scheduled_at asc
    ${paginationSql}
  `);
}

export async function getFollowups(filters: FollowupFilters = {}) {
  const organization = await requireOrganization();
  const rows = await queryFollowupRows(buildFollowupWhere(organization.id, filters, true));
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getFollowupsPaginated(filters: FollowupFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Followup>> {
  const organization = await requireOrganization();
  const { page, pageSize, from } = resolvePagination(filters);
  const rows = await queryFollowupRows(buildFollowupWhere(organization.id, filters, true), { from, pageSize });

  return {
    rows: rows.flatMap((row) => (row.payload ? [row.payload] : [])),
    total: rows.length > 0 ? normalizeCount(rows[0]?.total_count) : 0,
    page,
    pageSize,
  };
}

export async function getFollowupsByCompany(companyId: string) {
  const organization = await requireOrganization();
  const rows = await queryFollowupRows(
    Prisma.sql`f.organization_id = ${organization.id}::uuid and f.company_id = ${companyId}::uuid`,
  );
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getFollowupById(followupId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<Array<{ payload: Followup }>>(Prisma.sql`
    select
      (
        to_jsonb(f)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'interactions', case when i.id is null then null else jsonb_build_object('id', i.id, 'interaction_type', i.interaction_type, 'meeting_datetime', i.meeting_datetime) end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'created_profile', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'full_name', cr.full_name, 'email', cr.email) end
        )
      ) as payload
    from public.followups f
    left join public.companies c on c.id = f.company_id
    left join public.contact_persons cp on cp.id = f.contact_person_id
    left join public.interactions i on i.id = f.interaction_id
    left join public.profiles ap on ap.id = f.assigned_user_id
    left join public.profiles cr on cr.id = f.created_by
    where f.organization_id = ${organization.id}::uuid
      and f.id = ${followupId}::uuid
    limit 1
  `);

  return rows[0]?.payload ?? null;
}
