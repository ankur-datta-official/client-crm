import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { getAssignableTeamMembers } from "@/lib/team/hierarchy";
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

const companySelect = `
  *,
  industries(id, name),
  company_categories(id, name, code),
  pipeline_stages(id, name, color, probability, is_won, is_lost),
  assigned_profile:profiles!companies_assigned_user_id_fkey(id, full_name, email),
  primary_contact:contact_persons!contact_persons_company_id_fkey(id, name, mobile, email, designation)
`;

export async function getIndustries(includeArchived = false) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("industries")
    .select("*")
    .eq("organization_id", organization.id)
    .order("name");

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Industry[];
}

export async function getCompanyCategories(includeArchived = false) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("company_categories")
    .select("*")
    .eq("organization_id", organization.id)
    .order("priority_level")
    .order("name");

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CompanyCategory[];
}

export async function getPipelineStages(includeArchived = false) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("pipeline_stages")
    .select("*")
    .eq("organization_id", organization.id)
    .order("position");

  if (!includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PipelineStage[];
}

export async function getTeamMembers() {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TeamMemberOption[];
}

export async function getCompanies(filters: CompanyFilters = {}) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select(companySelect)
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (filters.search) {
    const search = filters.search.trim();
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,website.ilike.%${search}%`);
  }

  if (filters.industry) {
    query = query.eq("industry_id", filters.industry);
  }

  if (filters.category) {
    query = query.eq("category_id", filters.category);
  }

  if (filters.pipeline) {
    query = query.eq("pipeline_stage_id", filters.pipeline);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.temperature) {
    query = query.eq("lead_temperature", filters.temperature);
  }

  if (filters.assigned) {
    query = query.eq("assigned_user_id", filters.assigned);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return attachPrimaryContacts((data ?? []) as Company[]);
}

export async function getCompaniesPaginated(filters: CompanyFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Company>> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { page, pageSize, from, to } = resolvePagination(filters);
  let query = supabase
    .from("companies")
    .select(companySelect, { count: "exact" })
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (filters.search) {
    const search = filters.search.trim();
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,website.ilike.%${search}%`);
  }
  if (filters.industry) query = query.eq("industry_id", filters.industry);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.pipeline) query = query.eq("pipeline_stage_id", filters.pipeline);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.temperature) query = query.eq("lead_temperature", filters.temperature);
  if (filters.assigned) query = query.eq("assigned_user_id", filters.assigned);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: await attachPrimaryContacts((data ?? []) as Company[]),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getCompanyOptions(limit = 200) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("name")
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Pick<Company, "id" | "name">[];
}

export async function getCompanyById(id: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(companySelect)
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const normalized = await attachPrimaryContacts(data ? ([data] as Company[]) : []);
  return normalized[0] ?? null;
}

async function attachPrimaryContacts(companies: Company[]) {
  if (companies.length === 0) {
    return companies;
  }

  const organization = await requireOrganization();
  const supabase = await createClient();
  const companyIds = companies.map((company) => company.id);
  const { data, error } = await supabase
    .from("contact_persons")
    .select("id, company_id, name, mobile, email, designation")
    .eq("organization_id", organization.id)
    .in("company_id", companyIds)
    .eq("is_primary", true)
    .neq("status", "archived");

  if (error) {
    throw new Error(error.message);
  }

  const primaryByCompany = new Map((data ?? []).map((contact) => [contact.company_id, contact]));
  return companies.map((company) => ({
    ...company,
    primary_contact: primaryByCompany.get(company.id) ?? null,
  }));
}

export async function getContacts(filters: ContactFilters = {}) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("contact_persons")
    .select(
      `
      *,
      companies(id, name, phone, email)
    `,
    )
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (filters.search) {
    const search = filters.search.trim();
    query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%,designation.ilike.%${search}%`);
  }

  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.decisionRole) query = query.eq("decision_role", filters.decisionRole);
  if (filters.relationshipLevel) query = query.eq("relationship_level", filters.relationshipLevel);
  if (filters.preferredMethod) query = query.eq("preferred_contact_method", filters.preferredMethod);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ContactPerson[];
}

export async function getContactsPaginated(filters: ContactFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<ContactPerson>> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { page, pageSize, from, to } = resolvePagination(filters);
  let query = supabase
    .from("contact_persons")
    .select(
      `
      *,
      companies(id, name, phone, email)
    `,
      { count: "exact" },
    )
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (filters.search) {
    const search = filters.search.trim();
    query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%,designation.ilike.%${search}%`);
  }
  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.decisionRole) query = query.eq("decision_role", filters.decisionRole);
  if (filters.relationshipLevel) query = query.eq("relationship_level", filters.relationshipLevel);
  if (filters.preferredMethod) query = query.eq("preferred_contact_method", filters.preferredMethod);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ContactPerson[], total: count ?? 0, page, pageSize };
}

export async function getContactOptions(limit = 300) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_persons")
    .select("id, name, company_id")
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("name")
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Pick<ContactPerson, "id" | "name" | "company_id">[];
}

export async function getContactsByCompany(companyId: string, includeArchived = false) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("contact_persons")
    .select("*, companies(id, name, phone, email)")
    .eq("organization_id", organization.id)
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("name");

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ContactPerson[];
}

export async function getContactById(contactId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_persons")
    .select(
      `
      *,
      companies(id, name, phone, email),
      created_profile:profiles!contact_persons_created_by_fkey(id, full_name, email)
    `,
    )
    .eq("id", contactId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ContactPerson | null;
}

const interactionSelect = `
  *,
  companies(id, name),
  contact_persons(id, name, mobile, email),
  assigned_profile:profiles!interactions_assigned_user_id_fkey(id, full_name, email),
  created_profile:profiles!interactions_created_by_fkey(id, full_name, email)
`;

export async function getInteractions(filters: InteractionFilters = {}) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("interactions")
    .select(interactionSelect)
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("meeting_datetime", { ascending: false });

  if (filters.search) {
    const search = filters.search.trim();
    query = query.or(`discussion_details.ilike.%${search}%,next_action.ilike.%${search}%`);
  }
  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.contact) query = query.eq("contact_person_id", filters.contact);
  if (filters.type) query = query.eq("interaction_type", filters.type);
  if (filters.ratingMin) query = query.gte("success_rating", Number(filters.ratingMin));
  if (filters.ratingMax) query = query.lte("success_rating", Number(filters.ratingMax));
  if (filters.temperature) query = query.eq("lead_temperature", filters.temperature);
  if (filters.dateFrom) query = query.gte("meeting_datetime", filters.dateFrom);
  if (filters.dateTo) query = query.lte("meeting_datetime", filters.dateTo);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Interaction[];
}

export async function getInteractionsPaginated(filters: InteractionFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Interaction>> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { page, pageSize, from, to } = resolvePagination(filters);
  let query = supabase
    .from("interactions")
    .select(interactionSelect, { count: "exact" })
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("meeting_datetime", { ascending: false });

  if (filters.search) {
    const search = filters.search.trim();
    query = query.or(`discussion_details.ilike.%${search}%,next_action.ilike.%${search}%`);
  }
  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.contact) query = query.eq("contact_person_id", filters.contact);
  if (filters.type) query = query.eq("interaction_type", filters.type);
  if (filters.ratingMin) query = query.gte("success_rating", Number(filters.ratingMin));
  if (filters.ratingMax) query = query.lte("success_rating", Number(filters.ratingMax));
  if (filters.temperature) query = query.eq("lead_temperature", filters.temperature);
  if (filters.dateFrom) query = query.gte("meeting_datetime", filters.dateFrom);
  if (filters.dateTo) query = query.lte("meeting_datetime", filters.dateTo);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Interaction[], total: count ?? 0, page, pageSize };
}

export async function getInteractionsByCompany(companyId: string, includeArchived = false) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("interactions")
    .select(interactionSelect)
    .eq("organization_id", organization.id)
    .eq("company_id", companyId)
    .order("meeting_datetime", { ascending: false });

  if (!includeArchived) query = query.neq("status", "archived");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Interaction[];
}

export async function getInteractionById(interactionId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .select(interactionSelect)
    .eq("id", interactionId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Interaction | null;
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
  const supabase = await createClient();

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

  const [totalResult, hotResult, valueResult, contactResult, meetingResult, todayFollowupResult, missedFollowupResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("lead_temperature", "hot")
      .neq("status", "archived"),
    supabase
      .from("companies")
      .select("estimated_value")
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("contact_persons")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .gte("meeting_datetime", weekStart.toISOString())
      .lt("meeting_datetime", weekEnd.toISOString())
      .neq("status", "archived"),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString()),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .lt("scheduled_at", now.toISOString()),
  ]);

  if (totalResult.error) throw new Error(totalResult.error.message);
  if (hotResult.error) throw new Error(hotResult.error.message);
  if (valueResult.error) throw new Error(valueResult.error.message);
  if (contactResult.error) throw new Error(contactResult.error.message);
  if (meetingResult.error) throw new Error(meetingResult.error.message);
  if (todayFollowupResult.error) throw new Error(todayFollowupResult.error.message);
  if (missedFollowupResult.error) throw new Error(missedFollowupResult.error.message);

  const pipelineValue = (valueResult.data ?? []).reduce(
    (total, company) => total + Number(company.estimated_value ?? 0),
    0,
  );

  return {
    totalCompanies: totalResult.count ?? 0,
    hotLeads: hotResult.count ?? 0,
    totalContacts: contactResult.count ?? 0,
    meetingsThisWeek: meetingResult.count ?? 0,
    todaysFollowups: todayFollowupResult.count ?? 0,
    missedFollowups: missedFollowupResult.count ?? 0,
    pipelineValue,
  };
}

export async function getDashboardSetupCounts() {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const [companiesResult, contactsResult, meetingsResult, followupsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("contact_persons")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .neq("status", "archived"),
  ]);

  if (companiesResult.error) throw new Error(companiesResult.error.message);
  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (meetingsResult.error) throw new Error(meetingsResult.error.message);
  if (followupsResult.error) throw new Error(followupsResult.error.message);

  return {
    companies: companiesResult.count ?? 0,
    contacts: contactsResult.count ?? 0,
    meetings: meetingsResult.count ?? 0,
    followups: followupsResult.count ?? 0,
  };
}

export async function getPipelineStagesForBoard() {
  return getPipelineStages();
}

export async function getPipelineCompanies(): Promise<PipelineBoardCompany[]> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(companySelect)
    .eq("organization_id", organization.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const companies = await attachPrimaryContacts((data ?? []) as Company[]);
  if (companies.length === 0) {
    return [];
  }

  const companyIds = companies.map((company) => company.id);
  const [followupsResult, interactionsResult] = await Promise.all([
    supabase
      .from("followups")
      .select("company_id, scheduled_at, status")
      .eq("organization_id", organization.id)
      .in("company_id", companyIds)
      .in("status", ["pending", "rescheduled"])
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("interactions")
      .select("company_id, meeting_datetime")
      .eq("organization_id", organization.id)
      .in("company_id", companyIds)
      .neq("status", "archived")
      .order("meeting_datetime", { ascending: false }),
  ]);

  if (followupsResult.error) {
    throw new Error(followupsResult.error.message);
  }

  if (interactionsResult.error) {
    throw new Error(interactionsResult.error.message);
  }

  const nextFollowupByCompany = new Map<string, string>();
  for (const followup of followupsResult.data ?? []) {
    if (!nextFollowupByCompany.has(followup.company_id)) {
      nextFollowupByCompany.set(followup.company_id, followup.scheduled_at);
    }
  }

  const lastInteractionByCompany = new Map<string, string>();
  for (const interaction of interactionsResult.data ?? []) {
    if (!lastInteractionByCompany.has(interaction.company_id)) {
      lastInteractionByCompany.set(interaction.company_id, interaction.meeting_datetime);
    }
  }

  return companies.map((company) => ({
    ...company,
    next_followup_at: nextFollowupByCompany.get(company.id) ?? null,
    last_interaction_at: lastInteractionByCompany.get(company.id) ?? null,
  }));
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

      if (isHot) {
        summary.hotLeads += 1;
      }

      if (isWon) {
        summary.wonDeals += 1;
      }

      if (isLost) {
        summary.lostDeals += 1;
      }

      if (hasOverdueFollowup) {
        summary.overdueFollowups += 1;
      }

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
