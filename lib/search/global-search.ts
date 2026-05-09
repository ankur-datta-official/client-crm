import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/auth/session";

const DEFAULT_SECTION_LIMIT = 5;

export type SearchResultType =
  | "company"
  | "contact"
  | "meeting"
  | "followup"
  | "document"
  | "help_request";

export type GlobalSearchItem = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
  badge: string | null;
  status?: string | null;
};

export type GlobalSearchResults = {
  companies: GlobalSearchItem[];
  contacts: GlobalSearchItem[];
  meetings: GlobalSearchItem[];
  followups: GlobalSearchItem[];
  documents: GlobalSearchItem[];
  helpRequests: GlobalSearchItem[];
};

type SearchCompanyRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: string | null;
};

type SearchContactRow = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  designation: string | null;
  status: string | null;
  company_name: string | null;
};

type SearchInteractionRow = {
  id: string;
  interaction_type: string;
  discussion_details: string | null;
  next_action: string | null;
  status: string | null;
  company_name: string | null;
};

type SearchFollowupRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  company_name: string | null;
};

type SearchDocumentRow = {
  id: string;
  title: string;
  file_name: string | null;
  remarks: string | null;
  status: string | null;
  document_type: string | null;
  company_name: string | null;
};

type SearchHelpRequestRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  help_type: string | null;
  company_name: string | null;
};

function createEmptyResults(): GlobalSearchResults {
  return {
    companies: [],
    contacts: [],
    meetings: [],
    followups: [],
    documents: [],
    helpRequests: [],
  };
}

function normalizeQuery(query: string) {
  return query.trim();
}

function hasEnoughQuery(query: string) {
  return normalizeQuery(query).length >= 2;
}

function toPattern(query: string) {
  return `%${query}%`;
}

export async function searchCompanies(query: string, limit = DEFAULT_SECTION_LIMIT): Promise<GlobalSearchItem[]> {
  const normalizedQuery = normalizeQuery(query);
  if (!hasEnoughQuery(normalizedQuery)) {
    return [];
  }

  const organization = await requireOrganization();
  const pattern = toPattern(normalizedQuery);
  const data = await prisma.$queryRaw<SearchCompanyRow[]>`
    select id, name, email, phone, website, status
    from public.companies
    where organization_id = ${organization.id}::uuid
      and status <> 'archived'
      and (
        name ilike ${pattern}
        or email ilike ${pattern}
        or phone ilike ${pattern}
        or website ilike ${pattern}
      )
    order by updated_at desc
    limit ${limit}
  `;

  return data.map((company) => ({
    id: company.id,
    type: "company" as const,
    title: company.name,
    subtitle: company.email ?? company.phone ?? company.website ?? "Company record",
    href: `/companies/${company.id}`,
    badge: company.status,
    status: company.status,
  }));
}

export async function searchContacts(query: string, limit = DEFAULT_SECTION_LIMIT): Promise<GlobalSearchItem[]> {
  const normalizedQuery = normalizeQuery(query);
  if (!hasEnoughQuery(normalizedQuery)) {
    return [];
  }

  const organization = await requireOrganization();
  const pattern = toPattern(normalizedQuery);
  const data = await prisma.$queryRaw<SearchContactRow[]>`
    select
      cp.id,
      cp.name,
      cp.email,
      cp.mobile,
      cp.designation,
      cp.status,
      c.name as company_name
    from public.contact_persons cp
    left join public.companies c
      on c.id = cp.company_id
    where cp.organization_id = ${organization.id}::uuid
      and cp.status <> 'archived'
      and (
        cp.name ilike ${pattern}
        or cp.email ilike ${pattern}
        or cp.mobile ilike ${pattern}
        or cp.designation ilike ${pattern}
      )
    order by cp.updated_at desc
    limit ${limit}
  `;

  return data.map((contact) => ({
    id: contact.id,
    type: "contact" as const,
    title: contact.name,
    subtitle: contact.email ?? contact.mobile ?? contact.designation ?? contact.company_name ?? "Contact record",
    href: `/contacts/${contact.id}`,
    badge: contact.designation ?? contact.status,
    status: contact.status,
  }));
}

export async function searchInteractions(query: string, limit = DEFAULT_SECTION_LIMIT): Promise<GlobalSearchItem[]> {
  const normalizedQuery = normalizeQuery(query);
  if (!hasEnoughQuery(normalizedQuery)) {
    return [];
  }

  const organization = await requireOrganization();
  const pattern = toPattern(normalizedQuery);
  const data = await prisma.$queryRaw<SearchInteractionRow[]>`
    select
      i.id,
      i.interaction_type,
      i.discussion_details,
      i.next_action,
      i.status,
      c.name as company_name
    from public.interactions i
    left join public.companies c
      on c.id = i.company_id
    where i.organization_id = ${organization.id}::uuid
      and i.status <> 'archived'
      and (
        i.discussion_details ilike ${pattern}
        or i.next_action ilike ${pattern}
      )
    order by i.meeting_datetime desc
    limit ${limit}
  `;

  return data.map((meeting) => ({
    id: meeting.id,
    type: "meeting" as const,
    title: meeting.company_name ? `${meeting.company_name} meeting` : meeting.interaction_type,
    subtitle: meeting.discussion_details ?? meeting.next_action ?? "Interaction record",
    href: `/meetings/${meeting.id}`,
    badge: meeting.interaction_type,
    status: meeting.status,
  }));
}

export async function searchFollowups(query: string, limit = DEFAULT_SECTION_LIMIT): Promise<GlobalSearchItem[]> {
  const normalizedQuery = normalizeQuery(query);
  if (!hasEnoughQuery(normalizedQuery)) {
    return [];
  }

  const organization = await requireOrganization();
  const pattern = toPattern(normalizedQuery);
  const data = await prisma.$queryRaw<SearchFollowupRow[]>`
    select
      f.id,
      f.title,
      f.description,
      f.status,
      f.priority,
      c.name as company_name
    from public.followups f
    left join public.companies c
      on c.id = f.company_id
    where f.organization_id = ${organization.id}::uuid
      and f.status <> 'archived'
      and (
        f.title ilike ${pattern}
        or f.description ilike ${pattern}
      )
    order by f.scheduled_at asc
    limit ${limit}
  `;

  return data.map((followup) => ({
    id: followup.id,
    type: "followup" as const,
    title: followup.title,
    subtitle: followup.description ?? followup.company_name ?? "Follow-up record",
    href: `/followups/${followup.id}`,
    badge: followup.priority ?? followup.status,
    status: followup.status,
  }));
}

export async function searchDocuments(query: string, limit = DEFAULT_SECTION_LIMIT): Promise<GlobalSearchItem[]> {
  const normalizedQuery = normalizeQuery(query);
  if (!hasEnoughQuery(normalizedQuery)) {
    return [];
  }

  const organization = await requireOrganization();
  const pattern = toPattern(normalizedQuery);
  const data = await prisma.$queryRaw<SearchDocumentRow[]>`
    select
      d.id,
      d.title,
      d.file_name,
      d.remarks,
      d.status,
      d.document_type,
      c.name as company_name
    from public.documents d
    left join public.companies c
      on c.id = d.company_id
    where d.organization_id = ${organization.id}::uuid
      and d.status <> 'archived'
      and (
        d.title ilike ${pattern}
        or d.file_name ilike ${pattern}
        or d.remarks ilike ${pattern}
      )
    order by d.created_at desc
    limit ${limit}
  `;

  return data.map((document) => ({
    id: document.id,
    type: "document" as const,
    title: document.title,
    subtitle: document.file_name ?? document.remarks ?? document.company_name ?? "Document record",
    href: `/documents/${document.id}`,
    badge: document.document_type ?? document.status,
    status: document.status,
  }));
}

export async function searchHelpRequests(query: string, limit = DEFAULT_SECTION_LIMIT): Promise<GlobalSearchItem[]> {
  const normalizedQuery = normalizeQuery(query);
  if (!hasEnoughQuery(normalizedQuery)) {
    return [];
  }

  const organization = await requireOrganization();
  const pattern = toPattern(normalizedQuery);
  const data = await prisma.$queryRaw<SearchHelpRequestRow[]>`
    select
      hr.id,
      hr.title,
      hr.description,
      hr.status,
      hr.help_type,
      c.name as company_name
    from public.help_requests hr
    left join public.companies c
      on c.id = hr.company_id
    where hr.organization_id = ${organization.id}::uuid
      and hr.status <> 'archived'
      and (
        hr.title ilike ${pattern}
        or hr.description ilike ${pattern}
      )
    order by hr.created_at desc
    limit ${limit}
  `;

  return data.map((request) => ({
    id: request.id,
    type: "help_request" as const,
    title: request.title,
    subtitle: request.description ?? request.company_name ?? "Help request",
    href: `/need-help/${request.id}`,
    badge: request.help_type ?? request.status,
    status: request.status,
  }));
}

export async function globalSearch(query: string, limit = DEFAULT_SECTION_LIMIT): Promise<GlobalSearchResults> {
  const normalizedQuery = normalizeQuery(query);
  if (!hasEnoughQuery(normalizedQuery)) {
    return createEmptyResults();
  }

  const [companies, contacts, meetings, followups, documents, helpRequests] = await Promise.all([
    searchCompanies(normalizedQuery, limit),
    searchContacts(normalizedQuery, limit),
    searchInteractions(normalizedQuery, limit),
    searchFollowups(normalizedQuery, limit),
    searchDocuments(normalizedQuery, limit),
    searchHelpRequests(normalizedQuery, limit),
  ]);

  return {
    companies,
    contacts,
    meetings,
    followups,
    documents,
    helpRequests,
  };
}
