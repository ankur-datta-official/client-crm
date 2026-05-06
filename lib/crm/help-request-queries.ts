"use server";

import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest, HelpRequestComment, HelpRequestFilters } from "@/lib/crm/types";

export async function getHelpRequests(filters: HelpRequestFilters = {}) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  let query = supabase
    .from("help_requests")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      documents (id, title, document_type),
      requested_profile:profiles!requested_by (id, full_name, email),
      assigned_profile:profiles!assigned_to (id, full_name, email),
      created_profile:profiles!created_by (id, full_name, email),
      resolved_profile:profiles!resolved_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id);

  if (filters.company) {
    query = query.eq("company_id", filters.company);
  }
  if (filters.contact) {
    query = query.eq("contact_person_id", filters.contact);
  }
  if (filters.interaction) {
    query = query.eq("interaction_id", filters.interaction);
  }
  if (filters.followup) {
    query = query.eq("followup_id", filters.followup);
  }
  if (filters.document) {
    query = query.eq("document_id", filters.document);
  }
  if (filters.helpType) {
    query = query.eq("help_type", filters.helpType);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo);
  }
  if (filters.requestedBy) {
    query = query.eq("requested_by", filters.requestedBy);
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }
  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,resolution_note.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HelpRequest[];
}

export async function getHelpRequestsPaginated(filters: HelpRequestFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<HelpRequest>> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { page, pageSize, from, to } = resolvePagination(filters);

  let query = supabase
    .from("help_requests")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      documents (id, title, document_type),
      requested_profile:profiles!requested_by (id, full_name, email),
      assigned_profile:profiles!assigned_to (id, full_name, email),
      created_profile:profiles!created_by (id, full_name, email),
      resolved_profile:profiles!resolved_by (id, full_name, email)
    `, { count: "exact" })
    .eq("organization_id", organization.id);

  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.contact) query = query.eq("contact_person_id", filters.contact);
  if (filters.interaction) query = query.eq("interaction_id", filters.interaction);
  if (filters.followup) query = query.eq("followup_id", filters.followup);
  if (filters.document) query = query.eq("document_id", filters.document);
  if (filters.helpType) query = query.eq("help_type", filters.helpType);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  if (filters.requestedBy) query = query.eq("requested_by", filters.requestedBy);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,resolution_note.ilike.%${filters.search}%`);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) {
    throw new Error(error.message);
  }

  return { rows: (data ?? []) as HelpRequest[], total: count ?? 0, page, pageSize };
}

export async function getHelpRequestsByCompany(companyId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("help_requests")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      documents (id, title, document_type),
      requested_profile:profiles!requested_by (id, full_name, email),
      assigned_profile:profiles!assigned_to (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HelpRequest[];
}

export async function getHelpRequestById(helpRequestId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("help_requests")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      documents (id, title, document_type),
      requested_profile:profiles!requested_by (id, full_name, email),
      assigned_profile:profiles!assigned_to (id, full_name, email),
      created_profile:profiles!created_by (id, full_name, email),
      resolved_profile:profiles!resolved_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("id", helpRequestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as HelpRequest | null;
}

export async function getHelpRequestComments(helpRequestId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("help_request_comments")
    .select(`
      *,
      user_profile:profiles!user_id (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("help_request_id", helpRequestId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HelpRequestComment[];
}

export async function getOpenHelpRequestsCount() {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("help_requests")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .in("status", ["open", "in_progress"]);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getUrgentHelpRequestsCount() {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("help_requests")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .eq("priority", "urgent")
    .in("status", ["open", "in_progress"]);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
