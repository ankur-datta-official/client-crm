"use server";

import { Prisma } from "@prisma/client";
import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { Document, DocumentFilters } from "@/lib/crm/types";

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

function buildDocumentWhere(organizationId: string, filters: DocumentFilters) {
  const clauses: Prisma.Sql[] = [Prisma.sql`d.organization_id = ${organizationId}::uuid`];

  if (filters.company) clauses.push(Prisma.sql`d.company_id = ${filters.company}::uuid`);
  if (filters.type) clauses.push(Prisma.sql`d.document_type = ${filters.type}`);
  if (filters.status) clauses.push(Prisma.sql`d.status = ${filters.status}`);
  if (filters.uploadedBy) clauses.push(Prisma.sql`d.uploaded_by = ${filters.uploadedBy}::uuid`);
  if (filters.dateFrom) clauses.push(Prisma.sql`d.submitted_at >= ${filters.dateFrom}::timestamptz`);
  if (filters.dateTo) clauses.push(Prisma.sql`d.submitted_at <= ${filters.dateTo}::timestamptz`);

  if (filters.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    clauses.push(
      Prisma.sql`(
        d.title ilike ${search}
        or d.file_name ilike ${search}
        or d.submitted_to ilike ${search}
        or d.remarks ilike ${search}
      )`,
    );
  }

  return Prisma.join(clauses, " and ");
}

async function queryDocumentRows(whereSql: Prisma.Sql, pagination?: { from: number; pageSize: number }) {
  const paginationSql = pagination
    ? Prisma.sql` offset ${pagination.from} limit ${pagination.pageSize}`
    : Prisma.sql``;

  return prisma.$queryRaw<Array<JsonRow<Document>>>(Prisma.sql`
    select
      (
        to_jsonb(d)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'interactions', case when i.id is null then null else jsonb_build_object('id', i.id, 'interaction_type', i.interaction_type, 'meeting_datetime', i.meeting_datetime) end,
          'followups', case when f.id is null then null else jsonb_build_object('id', f.id, 'title', f.title, 'scheduled_at', f.scheduled_at) end,
          'uploaded_profile', case when up.id is null then null else jsonb_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) end
        )
      ) as payload,
      count(*) over() as total_count
    from public.documents d
    left join public.companies c on c.id = d.company_id
    left join public.contact_persons cp on cp.id = d.contact_person_id
    left join public.interactions i on i.id = d.interaction_id
    left join public.followups f on f.id = d.followup_id
    left join public.profiles up on up.id = d.uploaded_by
    where ${whereSql}
    order by d.created_at desc
    ${paginationSql}
  `);
}

export async function getDocuments(filters: DocumentFilters = {}) {
  const organization = await requireOrganization();
  const rows = await queryDocumentRows(buildDocumentWhere(organization.id, filters));
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getDocumentsPaginated(filters: DocumentFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Document>> {
  const organization = await requireOrganization();
  const { page, pageSize, from } = resolvePagination(filters);
  const rows = await queryDocumentRows(buildDocumentWhere(organization.id, filters), { from, pageSize });

  return {
    rows: rows.flatMap((row) => (row.payload ? [row.payload] : [])),
    total: rows.length > 0 ? normalizeCount(rows[0]?.total_count) : 0,
    page,
    pageSize,
  };
}

export async function getDocumentsByCompany(companyId: string) {
  const organization = await requireOrganization();
  const rows = await queryDocumentRows(
    Prisma.sql`d.organization_id = ${organization.id}::uuid and d.company_id = ${companyId}::uuid`,
  );
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getDocumentById(documentId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<Array<{ payload: Document }>>(Prisma.sql`
    select
      (
        to_jsonb(d)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'interactions', case when i.id is null then null else jsonb_build_object('id', i.id, 'interaction_type', i.interaction_type, 'meeting_datetime', i.meeting_datetime) end,
          'followups', case when f.id is null then null else jsonb_build_object('id', f.id, 'title', f.title, 'scheduled_at', f.scheduled_at) end,
          'uploaded_profile', case when up.id is null then null else jsonb_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) end
        )
      ) as payload
    from public.documents d
    left join public.companies c on c.id = d.company_id
    left join public.contact_persons cp on cp.id = d.contact_person_id
    left join public.interactions i on i.id = d.interaction_id
    left join public.followups f on f.id = d.followup_id
    left join public.profiles up on up.id = d.uploaded_by
    where d.organization_id = ${organization.id}::uuid
      and d.id = ${documentId}::uuid
    limit 1
  `);

  return rows[0]?.payload ?? null;
}

export async function getDocumentsByInteraction(interactionId: string) {
  const organization = await requireOrganization();
  const rows = await queryDocumentRows(
    Prisma.sql`d.organization_id = ${organization.id}::uuid and d.interaction_id = ${interactionId}::uuid`,
  );
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getDocumentsByFollowup(followupId: string) {
  const organization = await requireOrganization();
  const rows = await queryDocumentRows(
    Prisma.sql`d.organization_id = ${organization.id}::uuid and d.followup_id = ${followupId}::uuid`,
  );
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}
