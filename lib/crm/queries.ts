import { Prisma } from "@prisma/client";
import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getAssignableTeamMembers } from "@/lib/team/hierarchy";
import { ensureDefaultCompanyCategories } from "@/lib/crm/default-company-categories";
import { getFollowups } from "./followup-queries";
import { getDocuments } from "./document-queries";
import type {
  Company,
  CompanyCategory,
  CompanyFilters,
  ContactFilters,
  ContactPerson,
  Document,
  Interaction,
  InteractionFilters,
  Industry,
  PipelineBoardCompany,
  PipelineBoardData,
  PipelineBoardSummary,
  PipelineStage,
  TeamMemberOption,
} from "@/lib/crm/types";

type JsonRow<T> = {
  payload: T | null;
  total_count?: bigint | number | null;
};

function normalizeJsonRecord<T>(value: T | null): T | null {
  return value;
}

function normalizeCount(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return Number(value ?? 0);
}

function buildCompanyWhere(organizationId: string, filters: CompanyFilters) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`c.organization_id = ${organizationId}::uuid`,
    Prisma.sql`c.status <> 'archived'`,
  ];

  if (filters.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    clauses.push(
      Prisma.sql`(
        c.name ilike ${search}
        or c.email ilike ${search}
        or c.phone ilike ${search}
        or c.website ilike ${search}
      )`,
    );
  }

  if (filters.industry) clauses.push(Prisma.sql`c.industry_id = ${filters.industry}::uuid`);
  if (filters.category) clauses.push(Prisma.sql`c.category_id = ${filters.category}::uuid`);
  if (filters.pipeline) clauses.push(Prisma.sql`c.pipeline_stage_id = ${filters.pipeline}::uuid`);
  if (filters.priority) clauses.push(Prisma.sql`c.priority = ${filters.priority}`);
  if (filters.temperature) clauses.push(Prisma.sql`c.lead_temperature = ${filters.temperature}`);
  if (filters.assigned) clauses.push(Prisma.sql`c.assigned_user_id = ${filters.assigned}::uuid`);

  return Prisma.join(clauses, " and ");
}

function buildContactWhere(organizationId: string, filters: ContactFilters) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`cp.organization_id = ${organizationId}::uuid`,
    Prisma.sql`cp.status <> 'archived'`,
  ];

  if (filters.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    clauses.push(
      Prisma.sql`(
        cp.name ilike ${search}
        or cp.mobile ilike ${search}
        or cp.email ilike ${search}
        or cp.designation ilike ${search}
      )`,
    );
  }

  if (filters.company) clauses.push(Prisma.sql`cp.company_id = ${filters.company}::uuid`);
  if (filters.decisionRole) clauses.push(Prisma.sql`cp.decision_role = ${filters.decisionRole}`);
  if (filters.relationshipLevel) clauses.push(Prisma.sql`cp.relationship_level = ${filters.relationshipLevel}`);
  if (filters.preferredMethod) clauses.push(Prisma.sql`cp.preferred_contact_method = ${filters.preferredMethod}`);
  if (filters.status) clauses.push(Prisma.sql`cp.status = ${filters.status}`);

  return Prisma.join(clauses, " and ");
}

function buildInteractionWhere(organizationId: string, filters: InteractionFilters) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`i.organization_id = ${organizationId}::uuid`,
    Prisma.sql`i.status <> 'archived'`,
  ];

  if (filters.search?.trim()) {
    const search = `%${filters.search.trim()}%`;
    clauses.push(
      Prisma.sql`(
        i.discussion_details ilike ${search}
        or i.next_action ilike ${search}
      )`,
    );
  }

  if (filters.company) clauses.push(Prisma.sql`i.company_id = ${filters.company}::uuid`);
  if (filters.contact) clauses.push(Prisma.sql`i.contact_person_id = ${filters.contact}::uuid`);
  if (filters.type) clauses.push(Prisma.sql`i.interaction_type = ${filters.type}`);
  if (filters.ratingMin) clauses.push(Prisma.sql`i.success_rating >= ${Number(filters.ratingMin)}`);
  if (filters.ratingMax) clauses.push(Prisma.sql`i.success_rating <= ${Number(filters.ratingMax)}`);
  if (filters.temperature) clauses.push(Prisma.sql`i.lead_temperature = ${filters.temperature}`);
  if (filters.assigned) clauses.push(Prisma.sql`i.assigned_user_id = ${filters.assigned}::uuid`);
  if (filters.dateFrom) clauses.push(Prisma.sql`i.meeting_datetime >= ${filters.dateFrom}::timestamptz`);
  if (filters.dateTo) clauses.push(Prisma.sql`i.meeting_datetime <= ${filters.dateTo}::timestamptz`);
  if (filters.status) clauses.push(Prisma.sql`i.status = ${filters.status}`);

  return Prisma.join(clauses, " and ");
}

async function queryCompaniesRows(whereSql: Prisma.Sql, pagination?: { from: number; pageSize: number }) {
  const paginationSql = pagination
    ? Prisma.sql` offset ${pagination.from} limit ${pagination.pageSize}`
    : Prisma.sql``;

  return prisma.$queryRaw<Array<JsonRow<Company>>>(Prisma.sql`
    select
      (
        to_jsonb(c)
        || jsonb_build_object(
          'industries', case when i.id is null then null else to_jsonb(i) - 'organization_id' - 'description' - 'status' - 'created_at' - 'updated_at' end,
          'company_categories', case when cc.id is null then null else to_jsonb(cc) - 'organization_id' - 'description' - 'priority_level' - 'status' - 'created_at' - 'updated_at' end,
          'pipeline_stages', case when ps.id is null then null else to_jsonb(ps) - 'organization_id' - 'position' - 'is_active' - 'created_at' - 'updated_at' end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'primary_contact', case when pc.id is null then null else jsonb_build_object('id', pc.id, 'name', pc.name, 'mobile', pc.mobile, 'email', pc.email, 'designation', pc.designation) end
        )
      ) as payload,
      count(*) over() as total_count
    from public.companies c
    left join public.industries i on i.id = c.industry_id
    left join public.company_categories cc on cc.id = c.category_id
    left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id
    left join public.profiles ap on ap.id = c.assigned_user_id
    left join lateral (
      select id, name, mobile, email, designation
      from public.contact_persons
      where organization_id = c.organization_id
        and company_id = c.id
        and is_primary = true
        and status <> 'archived'
      order by updated_at desc
      limit 1
    ) pc on true
    where ${whereSql}
    order by c.updated_at desc
    ${paginationSql}
  `);
}

async function queryContactRows(whereSql: Prisma.Sql, pagination?: { from: number; pageSize: number }) {
  const paginationSql = pagination
    ? Prisma.sql` offset ${pagination.from} limit ${pagination.pageSize}`
    : Prisma.sql``;

  return prisma.$queryRaw<Array<JsonRow<ContactPerson>>>(Prisma.sql`
    select
      (
        to_jsonb(cp)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email) end
        )
      ) as payload,
      count(*) over() as total_count
    from public.contact_persons cp
    left join public.companies c on c.id = cp.company_id
    where ${whereSql}
    order by cp.updated_at desc
    ${paginationSql}
  `);
}

async function queryInteractionRows(whereSql: Prisma.Sql, pagination?: { from: number; pageSize: number }) {
  const paginationSql = pagination
    ? Prisma.sql` offset ${pagination.from} limit ${pagination.pageSize}`
    : Prisma.sql``;

  return prisma.$queryRaw<Array<JsonRow<Interaction>>>(Prisma.sql`
    select
      (
        to_jsonb(i)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'created_profile', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'full_name', cr.full_name, 'email', cr.email) end
        )
      ) as payload,
      count(*) over() as total_count
    from public.interactions i
    left join public.companies c on c.id = i.company_id
    left join public.contact_persons cp on cp.id = i.contact_person_id
    left join public.profiles ap on ap.id = i.assigned_user_id
    left join public.profiles cr on cr.id = i.created_by
    where ${whereSql}
    order by i.meeting_datetime desc
    ${paginationSql}
  `);
}

export async function getIndustries(includeArchived = false) {
  const organization = await requireOrganization();
  const statusFilter = includeArchived ? Prisma.sql`` : Prisma.sql` and status <> 'archived'`;

  const rows = await prisma.$queryRaw<Array<{ payload: Industry }>>(Prisma.sql`
    select to_jsonb(i) as payload
    from public.industries i
    where i.organization_id = ${organization.id}::uuid
    ${statusFilter}
    order by i.name asc
  `);

  return rows.map((row) => row.payload);
}

export async function getCompanyCategories(includeArchived = false) {
  const organization = await requireOrganization();
  const ownerUserId = organization.owner_user_id;
  if (ownerUserId) {
    await ensureDefaultCompanyCategories({
      db: prisma,
      organizationId: organization.id,
      userId: ownerUserId,
    });
  }
  const statusFilter = includeArchived ? Prisma.sql`` : Prisma.sql` and status <> 'archived'`;

  const rows = await prisma.$queryRaw<Array<{ payload: CompanyCategory }>>(Prisma.sql`
    select to_jsonb(cc) as payload
    from public.company_categories cc
    where cc.organization_id = ${organization.id}::uuid
    ${statusFilter}
    order by cc.priority_level asc, cc.name asc
  `);

  return rows.map((row) => row.payload);
}

export async function getPipelineStages(includeArchived = false) {
  const organization = await requireOrganization();
  const activeFilter = includeArchived ? Prisma.sql`` : Prisma.sql` and is_active = true`;

  const rows = await prisma.$queryRaw<Array<{ payload: PipelineStage }>>(Prisma.sql`
    select to_jsonb(ps) as payload
    from public.pipeline_stages ps
    where ps.organization_id = ${organization.id}::uuid
    ${activeFilter}
    order by ps.position asc
  `);

  return rows.map((row) => row.payload);
}

export async function getTeamMembers() {
  const organization = await requireOrganization();

  return prisma.$queryRaw<Array<TeamMemberOption>>(Prisma.sql`
    select
      id::text as id,
      full_name,
      email
    from public.profiles
    where organization_id = ${organization.id}::uuid
      and is_active = true
    order by full_name asc nulls last, email asc
  `);
}

export async function getCompanies(filters: CompanyFilters = {}) {
  const organization = await requireOrganization();
  const rows = await queryCompaniesRows(buildCompanyWhere(organization.id, filters));
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getCompaniesPaginated(filters: CompanyFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Company>> {
  const organization = await requireOrganization();
  const { page, pageSize, from } = resolvePagination(filters);
  const rows = await queryCompaniesRows(buildCompanyWhere(organization.id, filters), { from, pageSize });

  return {
    rows: rows.flatMap((row) => (row.payload ? [row.payload] : [])),
    total: rows.length > 0 ? normalizeCount(rows[0]?.total_count) : 0,
    page,
    pageSize,
  };
}

export async function getCompanyOptions(limit = 200) {
  const organization = await requireOrganization();

  return prisma.$queryRaw<Array<Pick<Company, "id" | "name">>>(Prisma.sql`
    select id::text as id, name
    from public.companies
    where organization_id = ${organization.id}::uuid
      and status <> 'archived'
    order by name asc
    limit ${limit}
  `);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<Array<{ payload: Company }>>(Prisma.sql`
    select
      (
        to_jsonb(c)
        || jsonb_build_object(
          'industries', case when i.id is null then null else to_jsonb(i) - 'organization_id' - 'description' - 'status' - 'created_at' - 'updated_at' end,
          'company_categories', case when cc.id is null then null else to_jsonb(cc) - 'organization_id' - 'description' - 'priority_level' - 'status' - 'created_at' - 'updated_at' end,
          'pipeline_stages', case when ps.id is null then null else to_jsonb(ps) - 'organization_id' - 'position' - 'is_active' - 'created_at' - 'updated_at' end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'primary_contact', case when pc.id is null then null else jsonb_build_object('id', pc.id, 'name', pc.name, 'mobile', pc.mobile, 'email', pc.email, 'designation', pc.designation) end
        )
      ) as payload
    from public.companies c
    left join public.industries i on i.id = c.industry_id
    left join public.company_categories cc on cc.id = c.category_id
    left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id
    left join public.profiles ap on ap.id = c.assigned_user_id
    left join lateral (
      select id, name, mobile, email, designation
      from public.contact_persons
      where organization_id = c.organization_id
        and company_id = c.id
        and is_primary = true
        and status <> 'archived'
      order by updated_at desc
      limit 1
    ) pc on true
    where c.id = ${id}::uuid
      and c.organization_id = ${organization.id}::uuid
    limit 1
  `);

  return normalizeJsonRecord(rows[0]?.payload ?? null);
}

export async function getContacts(filters: ContactFilters = {}): Promise<ContactPerson[]> {
  const organization = await requireOrganization();
  const rows = await queryContactRows(buildContactWhere(organization.id, filters));
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getContactsPaginated(filters: ContactFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<ContactPerson>> {
  const organization = await requireOrganization();
  const { page, pageSize, from } = resolvePagination(filters);
  const rows = await queryContactRows(buildContactWhere(organization.id, filters), { from, pageSize });

  return {
    rows: rows.flatMap((row) => (row.payload ? [row.payload] : [])),
    total: rows.length > 0 ? normalizeCount(rows[0]?.total_count) : 0,
    page,
    pageSize,
  };
}

export async function getContactOptions(limit = 300): Promise<Array<Pick<ContactPerson, "id" | "name" | "company_id">>> {
  const organization = await requireOrganization();

  return prisma.$queryRaw<Array<Pick<ContactPerson, "id" | "name" | "company_id">>>(Prisma.sql`
    select
      id::text as id,
      name,
      company_id::text as company_id
    from public.contact_persons
    where organization_id = ${organization.id}::uuid
      and status <> 'archived'
    order by name asc
    limit ${limit}
  `);
}

export async function getContactsByCompany(companyId: string, includeArchived = false): Promise<ContactPerson[]> {
  const organization = await requireOrganization();
  const archivedFilter = includeArchived ? Prisma.sql`` : Prisma.sql` and cp.status <> 'archived'`;

  const rows = await prisma.$queryRaw<Array<{ payload: ContactPerson }>>(Prisma.sql`
    select
      (
        to_jsonb(cp)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email) end
        )
      ) as payload
    from public.contact_persons cp
    left join public.companies c on c.id = cp.company_id
    where cp.organization_id = ${organization.id}::uuid
      and cp.company_id = ${companyId}::uuid
      ${archivedFilter}
    order by cp.is_primary desc, cp.name asc
  `);

  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getContactById(contactId: string): Promise<ContactPerson | null> {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<Array<{ payload: ContactPerson }>>(Prisma.sql`
    select
      (
        to_jsonb(cp)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email) end,
          'created_profile', case when p.id is null then null else jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email) end
        )
      ) as payload
    from public.contact_persons cp
    left join public.companies c on c.id = cp.company_id
    left join public.profiles p on p.id = cp.created_by
    where cp.id = ${contactId}::uuid
      and cp.organization_id = ${organization.id}::uuid
    limit 1
  `);

  return normalizeJsonRecord(rows[0]?.payload ?? null);
}

export async function getInteractions(filters: InteractionFilters = {}) {
  const organization = await requireOrganization();
  const rows = await queryInteractionRows(buildInteractionWhere(organization.id, filters));
  return rows.flatMap((row) => (row.payload ? [row.payload] : []));
}

export async function getInteractionsPaginated(filters: InteractionFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Interaction>> {
  const organization = await requireOrganization();
  const { page, pageSize, from } = resolvePagination(filters);
  const rows = await queryInteractionRows(buildInteractionWhere(organization.id, filters), { from, pageSize });

  return {
    rows: rows.flatMap((row) => (row.payload ? [row.payload] : [])),
    total: rows.length > 0 ? normalizeCount(rows[0]?.total_count) : 0,
    page,
    pageSize,
  };
}

export async function getInteractionsByCompany(companyId: string, includeArchived = false) {
  const organization = await requireOrganization();
  const archivedFilter = includeArchived ? Prisma.sql`` : Prisma.sql` and i.status <> 'archived'`;

  const rows = await prisma.$queryRaw<Array<{ payload: Interaction }>>(Prisma.sql`
    select
      (
        to_jsonb(i)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'created_profile', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'full_name', cr.full_name, 'email', cr.email) end
        )
      ) as payload
    from public.interactions i
    left join public.companies c on c.id = i.company_id
    left join public.contact_persons cp on cp.id = i.contact_person_id
    left join public.profiles ap on ap.id = i.assigned_user_id
    left join public.profiles cr on cr.id = i.created_by
    where i.organization_id = ${organization.id}::uuid
      and i.company_id = ${companyId}::uuid
      ${archivedFilter}
    order by i.meeting_datetime desc
  `);

  return rows.map((row) => row.payload);
}

export async function getInteractionById(interactionId: string) {
  const organization = await requireOrganization();
  const rows = await prisma.$queryRaw<Array<{ payload: Interaction }>>(Prisma.sql`
    select
      (
        to_jsonb(i)
        || jsonb_build_object(
          'companies', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name) end,
          'contact_persons', case when cp.id is null then null else jsonb_build_object('id', cp.id, 'name', cp.name, 'mobile', cp.mobile, 'email', cp.email) end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'created_profile', case when cr.id is null then null else jsonb_build_object('id', cr.id, 'full_name', cr.full_name, 'email', cr.email) end
        )
      ) as payload
    from public.interactions i
    left join public.companies c on c.id = i.company_id
    left join public.contact_persons cp on cp.id = i.contact_person_id
    left join public.profiles ap on ap.id = i.assigned_user_id
    left join public.profiles cr on cr.id = i.created_by
    where i.id = ${interactionId}::uuid
      and i.organization_id = ${organization.id}::uuid
    limit 1
  `);

  return normalizeJsonRecord(rows[0]?.payload ?? null);
}

export async function getCompanyFormOptions() {
  const [industries, categories, stages, teamMembers] = await Promise.all([
    getIndustries(),
    getCompanyCategories(),
    getPipelineStages(),
    getAssignableTeamMembers(),
  ]);

  return { industries, categories, stages, teamMembers };
}

export async function getContactFormOptions() {
  const companies = await getCompanies({});
  return { companies };
}

export async function getInteractionFormOptions() {
  const [companies, contacts, teamMembers] = await Promise.all([
    getCompanies({}),
    getContacts({}),
    getAssignableTeamMembers(),
  ]);
  return { companies, contacts, teamMembers };
}

export async function getFollowupFormOptions() {
  const [companies, contacts, interactions, teamMembers] = await Promise.all([
    getCompanies({}),
    getContacts({}),
    getInteractions({}),
    getAssignableTeamMembers(),
  ]);
  return { companies, contacts, interactions, teamMembers };
}

export async function getDocumentFormOptions() {
  const [companies, contacts, interactions, followups, teamMembers] = await Promise.all([
    getCompanies({}),
    getContacts({}),
    getInteractions({}),
    getFollowups({}),
    getTeamMembers(),
  ]);
  return { companies, contacts, interactions, followups, teamMembers };
}

export async function getHelpRequestFormOptions() {
  const [companies, contacts, interactions, followups, documents, teamMembers] = await Promise.all([
    getCompanies({}),
    getContacts({}),
    getInteractions({}),
    getFollowups({}),
    getDocuments({}),
    getTeamMembers(),
  ]);
  return { companies, contacts, interactions, followups, documents, teamMembers };
}

export async function getDashboardMetrics() {
  const organization = await requireOrganization();

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const now = new Date();

  const [countsRow] = await prisma.$queryRaw<
    Array<{
      total_companies: bigint;
      hot_leads: bigint;
      total_contacts: bigint;
      meetings_this_week: bigint;
      todays_followups: bigint;
      missed_followups: bigint;
      pipeline_value: number | string | null;
    }>
  >(Prisma.sql`
    select
      (
        select count(*)
        from public.companies c
        where c.organization_id = ${organization.id}::uuid
          and c.status <> 'archived'
      ) as total_companies,
      (
        select count(*)
        from public.companies c
        where c.organization_id = ${organization.id}::uuid
          and c.status <> 'archived'
          and c.lead_temperature = 'hot'
      ) as hot_leads,
      (
        select count(*)
        from public.contact_persons cp
        where cp.organization_id = ${organization.id}::uuid
          and cp.status <> 'archived'
      ) as total_contacts,
      (
        select count(*)
        from public.interactions i
        where i.organization_id = ${organization.id}::uuid
          and i.status <> 'archived'
          and i.meeting_datetime >= ${weekStart.toISOString()}::timestamptz
          and i.meeting_datetime < ${weekEnd.toISOString()}::timestamptz
      ) as meetings_this_week,
      (
        select count(*)
        from public.followups f
        where f.organization_id = ${organization.id}::uuid
          and f.status = 'pending'
          and f.scheduled_at >= ${todayStart.toISOString()}::timestamptz
          and f.scheduled_at <= ${todayEnd.toISOString()}::timestamptz
      ) as todays_followups,
      (
        select count(*)
        from public.followups f
        where f.organization_id = ${organization.id}::uuid
          and f.status = 'pending'
          and f.scheduled_at < ${now.toISOString()}::timestamptz
      ) as missed_followups,
      (
        select coalesce(sum(c.estimated_value), 0)
        from public.companies c
        where c.organization_id = ${organization.id}::uuid
          and c.status <> 'archived'
      ) as pipeline_value
  `);

  return {
    totalCompanies: normalizeCount(countsRow?.total_companies),
    hotLeads: normalizeCount(countsRow?.hot_leads),
    totalContacts: normalizeCount(countsRow?.total_contacts),
    meetingsThisWeek: normalizeCount(countsRow?.meetings_this_week),
    todaysFollowups: normalizeCount(countsRow?.todays_followups),
    missedFollowups: normalizeCount(countsRow?.missed_followups),
    pipelineValue: Number(countsRow?.pipeline_value ?? 0),
  };
}

export async function getDashboardSetupCounts() {
  const organization = await requireOrganization();

  const [countsRow] = await prisma.$queryRaw<
    Array<{
      companies: bigint;
      contacts: bigint;
      meetings: bigint;
      followups: bigint;
    }>
  >(Prisma.sql`
    select
      (
        select count(*)
        from public.companies c
        where c.organization_id = ${organization.id}::uuid
          and c.status <> 'archived'
      ) as companies,
      (
        select count(*)
        from public.contact_persons cp
        where cp.organization_id = ${organization.id}::uuid
          and cp.status <> 'archived'
      ) as contacts,
      (
        select count(*)
        from public.interactions i
        where i.organization_id = ${organization.id}::uuid
          and i.status <> 'archived'
      ) as meetings,
      (
        select count(*)
        from public.followups f
        where f.organization_id = ${organization.id}::uuid
          and f.status <> 'archived'
      ) as followups
  `);

  return {
    companies: normalizeCount(countsRow?.companies),
    contacts: normalizeCount(countsRow?.contacts),
    meetings: normalizeCount(countsRow?.meetings),
    followups: normalizeCount(countsRow?.followups),
  };
}

export async function getPipelineStagesForBoard() {
  return getPipelineStages();
}

export async function getPipelineCompanies(): Promise<PipelineBoardCompany[]> {
  const organization = await requireOrganization();

  const rows = await prisma.$queryRaw<Array<{ payload: PipelineBoardCompany }>>(Prisma.sql`
    select
      (
        to_jsonb(c)
        || jsonb_build_object(
          'industries', case when i.id is null then null else to_jsonb(i) - 'organization_id' - 'description' - 'status' - 'created_at' - 'updated_at' end,
          'company_categories', case when cc.id is null then null else to_jsonb(cc) - 'organization_id' - 'description' - 'priority_level' - 'status' - 'created_at' - 'updated_at' end,
          'pipeline_stages', case when ps.id is null then null else to_jsonb(ps) - 'organization_id' - 'position' - 'is_active' - 'created_at' - 'updated_at' end,
          'assigned_profile', case when ap.id is null then null else jsonb_build_object('id', ap.id, 'full_name', ap.full_name, 'email', ap.email) end,
          'primary_contact', case when pc.id is null then null else jsonb_build_object('id', pc.id, 'name', pc.name, 'mobile', pc.mobile, 'email', pc.email, 'designation', pc.designation) end,
          'next_followup_at', nf.scheduled_at,
          'last_interaction_at', li.meeting_datetime
        )
      ) as payload
    from public.companies c
    left join public.industries i on i.id = c.industry_id
    left join public.company_categories cc on cc.id = c.category_id
    left join public.pipeline_stages ps on ps.id = c.pipeline_stage_id
    left join public.profiles ap on ap.id = c.assigned_user_id
    left join lateral (
      select id, name, mobile, email, designation
      from public.contact_persons
      where organization_id = c.organization_id
        and company_id = c.id
        and is_primary = true
        and status <> 'archived'
      order by updated_at desc
      limit 1
    ) pc on true
    left join lateral (
      select scheduled_at
      from public.followups
      where organization_id = c.organization_id
        and company_id = c.id
        and status in ('pending', 'rescheduled')
      order by scheduled_at asc
      limit 1
    ) nf on true
    left join lateral (
      select meeting_datetime
      from public.interactions
      where organization_id = c.organization_id
        and company_id = c.id
        and status <> 'archived'
      order by meeting_datetime desc
      limit 1
    ) li on true
    where c.organization_id = ${organization.id}::uuid
      and c.status <> 'archived'
    order by c.updated_at desc
  `);

  return rows.map((row) => row.payload);
}

export async function getPipelineSummary(companies?: PipelineBoardCompany[]): Promise<PipelineBoardSummary> {
  const scopedCompanies = companies ?? await getPipelineCompanies();
  const now = Date.now();

  return scopedCompanies.reduce<PipelineBoardSummary>(
    (summary, company) => {
      const isWon = Boolean(company.pipeline_stages?.is_won);
      const isLost = Boolean(company.pipeline_stages?.is_lost);
      const isHot = company.lead_temperature === "hot" || company.lead_temperature === "very_hot";
      const hasOverdueFollowup = Boolean(
        company.next_followup_at && new Date(company.next_followup_at).getTime() < now && !isWon && !isLost,
      );

      if (!isWon && !isLost) {
        summary.totalActiveDeals += 1;
        summary.totalPipelineValue += Number(company.estimated_value ?? 0);
      }

      if (isHot) summary.hotLeads += 1;
      if (isWon) summary.wonDeals += 1;
      if (isLost) summary.lostDeals += 1;
      if (hasOverdueFollowup) summary.overdueFollowups += 1;

      return summary;
    },
    {
      totalPipelineValue: 0,
      totalActiveDeals: 0,
      hotLeads: 0,
      wonDeals: 0,
      lostDeals: 0,
      overdueFollowups: 0,
    },
  );
}

export async function getPipelineBoard(): Promise<PipelineBoardData> {
  const [stages, companies, teamMembers, industries, categories] = await Promise.all([
    getPipelineStagesForBoard(),
    getPipelineCompanies(),
    getTeamMembers(),
    getIndustries(),
    getCompanyCategories(),
  ]);
  const summary = await getPipelineSummary(companies);

  return {
    stages,
    companies,
    teamMembers,
    industries,
    categories,
    summary,
  };
}
