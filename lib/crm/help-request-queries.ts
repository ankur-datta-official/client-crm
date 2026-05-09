"use server";

import { Prisma } from "@prisma/client";
import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { HelpRequest, HelpRequestComment, HelpRequestFilters } from "@/lib/crm/types";

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

function buildHelpRequestWhere(organizationId: string, filters: HelpRequestFilters) {
  const clauses: Prisma.Sql[] = [Prisma.sql`hr.organization_id = ${organizationId}::uuid`];

  if (filters.company) clauses.push(Prisma.sql`hr.company_id = ${filters.company}::uuid`);
  if (filters.contact) clauses.push(Prisma.sql`hr.contact_person_id = ${filters.contact}::uuid`);
  if (filters.interaction) clauses.push(Prisma.sql`hr.interaction_id = ${filters.interaction}::uuid`);
  if (filters.followup) clauses.push(Prisma.sql`hr.followup_id = ${filters.followup}::uuid`);
  if (filters.document) clauses.push(Prisma.sql`hr.document_id = ${filters.document}::uuid`);
  if (filters.helpType) clauses.push(Prisma.sql`hr.help_type = ${filters.helpType}`);
  if (filters.priority) clauses.push(Prisma.sql`hr.priority = ${filters.priority}`);
  if (filters.status) clauses.push(Prisma.sql`hr.status = ${filters.status}`);
  if (filters.assignedTo) clauses.push(Prisma.sql`hr.assigned_to = ${filters.assignedTo}::uuid`);
  if (filters.requestedBy) clauses.push(Prisma.sql`hr.requested_by = ${filters.requestedBy}::uuid`);
  if (filters.dateFrom) clauses.push(Prisma.sql`hr.created_at >= ${filters.dateFrom}::timestamptz`);
  if (filters.dateTo) clauses.push(Prisma.sql`hr.created_at <= ${filters.dateTo}::timestamptz`);

  if (filters.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    clauses.push(
      Prisma.sql`(
        hr.title ilike ${search}
        or hr.description ilike ${search}
        or hr.resolution_note ilike ${search}
      )`,
    );
  }

  return Prisma.join(clauses, " and ");
}

async function queryHelpRequestRows(whereSql: Prisma.Sql, pagination?: { from: number; pageSize: number }) {
  const paginationSql = pagination
    ? Prisma.sql` offset ${pagination.from} limit ${pagination.pageSize}`
    : Prisma.sql``;

  return prisma.$queryRaw<Array<JsonRow<HelpRequest>>>(Prisma.sql`
    select
      (
        to_jsonb(hr)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'interactions', case when i.id is null then null else jsonb_build_object('id', i.id, 'interaction_type', i.interaction_type, 'meeting_datetime', i.meeting_datetime) end,
          'followups', case when f.id is null then null else jsonb_build_object('id', f.id, 'title', f.title, 'scheduled_at', f.scheduled_at) end,
          'documents', case when d.id is null then null else jsonb_build_object('id', d.id, 'title', d.title, 'document_type', d.document_type) end,
          'requested_profile', case when rp.id is null then null else jsonb_build_object('id', rp.id, 'full_name', rp.full_name, 'email', rp.email) end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'created_profile', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'full_name', cr.full_name, 'email', cr.email) end,
          'resolved_profile', case when rs.id is null then null else jsonb_build_object('id', rs.id, 'full_name', rs.full_name, 'email', rs.email) end
        )
      ) as payload,
      count(*) over() as total_count
    from public.help_requests hr
    left join public.companies c on c.id = hr.company_id
    left join public.contact_persons cp on cp.id = hr.contact_person_id
    left join public.interactions i on i.id = hr.interaction_id
    left join public.followups f on f.id = hr.followup_id
    left join public.documents d on d.id = hr.document_id
    left join public.profiles rp on rp.id = hr.requested_by
    left join public.profiles ap on ap.id = hr.assigned_to
    left join public.profiles cr on cr.id = hr.created_by
    left join public.profiles rs on rs.id = hr.resolved_by
    where ${whereSql}
    order by hr.created_at desc
    ${paginationSql}
  `);
}

export async function getHelpRequests(filters: HelpRequestFilters = {}) {
  const organization = await requireOrganization();
  const rows = await queryHelpRequestRows(buildHelpRequestWhere(organization.id, filters));
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getHelpRequestsPaginated(filters: HelpRequestFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<HelpRequest>> {
  const organization = await requireOrganization();
  const { page, pageSize, from } = resolvePagination(filters);
  const rows = await queryHelpRequestRows(buildHelpRequestWhere(organization.id, filters), { from, pageSize });

  return {
    rows: rows.flatMap((row) => (row.payload ? [row.payload] : [])),
    total: rows.length > 0 ? normalizeCount(rows[0]?.total_count) : 0,
    page,
    pageSize,
  };
}

export async function getHelpRequestsByCompany(companyId: string) {
  const organization = await requireOrganization();
  const rows = await queryHelpRequestRows(
    Prisma.sql`hr.organization_id = ${organization.id}::uuid and hr.company_id = ${companyId}::uuid`,
  );
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getHelpRequestById(helpRequestId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<Array<{ payload: HelpRequest }>>(Prisma.sql`
    select
      (
        to_jsonb(hr)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'interactions', case when i.id is null then null else jsonb_build_object('id', i.id, 'interaction_type', i.interaction_type, 'meeting_datetime', i.meeting_datetime) end,
          'followups', case when f.id is null then null else jsonb_build_object('id', f.id, 'title', f.title, 'scheduled_at', f.scheduled_at) end,
          'documents', case when d.id is null then null else jsonb_build_object('id', d.id, 'title', d.title, 'document_type', d.document_type) end,
          'requested_profile', case when rp.id is null then null else jsonb_build_object('id', rp.id, 'full_name', rp.full_name, 'email', rp.email) end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'created_profile', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'full_name', cr.full_name, 'email', cr.email) end,
          'resolved_profile', case when rs.id is null then null else jsonb_build_object('id', rs.id, 'full_name', rs.full_name, 'email', rs.email) end
        )
      ) as payload
    from public.help_requests hr
    left join public.companies c on c.id = hr.company_id
    left join public.contact_persons cp on cp.id = hr.contact_person_id
    left join public.interactions i on i.id = hr.interaction_id
    left join public.followups f on f.id = hr.followup_id
    left join public.documents d on d.id = hr.document_id
    left join public.profiles rp on rp.id = hr.requested_by
    left join public.profiles ap on ap.id = hr.assigned_to
    left join public.profiles cr on cr.id = hr.created_by
    left join public.profiles rs on rs.id = hr.resolved_by
    where hr.organization_id = ${organization.id}::uuid
      and hr.id = ${helpRequestId}::uuid
    limit 1
  `);

  return rows[0]?.payload ?? null;
}

export async function getHelpRequestComments(helpRequestId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<Array<{ payload: HelpRequestComment }>>(Prisma.sql`
    select
      (
        to_jsonb(hc)
        || jsonb_build_object(
          'user_profile', case when p.id is null then null else jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email) end
        )
      ) as payload
    from public.help_request_comments hc
    left join public.profiles p on p.id = hc.user_id
    where hc.organization_id = ${organization.id}::uuid
      and hc.help_request_id = ${helpRequestId}::uuid
    order by hc.created_at asc
  `);

  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getOpenHelpRequestsCount() {
  const organization = await requireOrganization();
  const [row] = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    select count(*) as count
    from public.help_requests
    where organization_id = ${organization.id}::uuid
      and status in ('open', 'in_progress')
  `);

  return normalizeCount(row?.count);
}

export async function getUrgentHelpRequestsCount() {
  const organization = await requireOrganization();
  const [row] = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    select count(*) as count
    from public.help_requests
    where organization_id = ${organization.id}::uuid
      and priority = 'urgent'
      and status in ('open', 'in_progress')
  `);

  return normalizeCount(row?.count);
}
