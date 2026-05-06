import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import type { Followup, FollowupFilters } from "@/lib/crm/types";

export async function getFollowups(filters: FollowupFilters = {}) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  let query = supabase
    .from("followups")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      assigned_profile:profiles!assigned_user_id (id, full_name, email),
      created_profile:profiles!created_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id);

  if (filters.company) {
    query = query.eq("company_id", filters.company);
  }
  if (filters.contact) {
    query = query.eq("contact_person_id", filters.contact);
  }
  if (filters.assigned) {
    query = query.eq("assigned_user_id", filters.assigned);
  }
  if (filters.type) {
    query = query.eq("followup_type", filters.type);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.dateStart) {
    query = query.gte("scheduled_at", filters.dateStart);
  }
  if (filters.dateEnd) {
    query = query.lte("scheduled_at", filters.dateEnd);
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Followup[];
}

export async function getFollowupsPaginated(filters: FollowupFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Followup>> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { page, pageSize, from, to } = resolvePagination(filters);

  let query = supabase
    .from("followups")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      assigned_profile:profiles!assigned_user_id (id, full_name, email),
      created_profile:profiles!created_by (id, full_name, email)
    `, { count: "exact" })
    .eq("organization_id", organization.id);

  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.contact) query = query.eq("contact_person_id", filters.contact);
  if (filters.assigned) query = query.eq("assigned_user_id", filters.assigned);
  if (filters.type) query = query.eq("followup_type", filters.type);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateStart) query = query.gte("scheduled_at", filters.dateStart);
  if (filters.dateEnd) query = query.lte("scheduled_at", filters.dateEnd);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

  const { data, error, count } = await query.order("scheduled_at", { ascending: true }).range(from, to);
  if (error) {
    throw new Error(error.message);
  }

  return { rows: (data ?? []) as Followup[], total: count ?? 0, page, pageSize };
}

export async function getFollowupsByCompany(companyId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("followups")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      assigned_profile:profiles!assigned_user_id (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("company_id", companyId)
    .order("scheduled_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Followup[];
}

export async function getFollowupById(followupId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("followups")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      assigned_profile:profiles!assigned_user_id (id, full_name, email),
      created_profile:profiles!created_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("id", followupId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Followup | null;
}
