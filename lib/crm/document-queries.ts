"use server";

import { requireOrganization } from "@/lib/auth/session";
import { resolvePagination, type PaginatedResult } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import type { Document, DocumentFilters } from "@/lib/crm/types";

export async function getDocuments(filters: DocumentFilters = {}) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      uploaded_profile:profiles!uploaded_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id);

  if (filters.company) {
    query = query.eq("company_id", filters.company);
  }
  if (filters.type) {
    query = query.eq("document_type", filters.type);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.uploadedBy) {
    query = query.eq("uploaded_by", filters.uploadedBy);
  }
  if (filters.dateFrom) {
    query = query.gte("submitted_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("submitted_at", filters.dateTo);
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,file_name.ilike.%${filters.search}%,submitted_to.ilike.%${filters.search}%,remarks.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Document[];
}

export async function getDocumentsPaginated(filters: DocumentFilters & { page?: string; pageSize?: string } = {}): Promise<PaginatedResult<Document>> {
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { page, pageSize, from, to } = resolvePagination(filters);

  let query = supabase
    .from("documents")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      uploaded_profile:profiles!uploaded_by (id, full_name, email)
    `, { count: "exact" })
    .eq("organization_id", organization.id);

  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.type) query = query.eq("document_type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.uploadedBy) query = query.eq("uploaded_by", filters.uploadedBy);
  if (filters.dateFrom) query = query.gte("submitted_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("submitted_at", filters.dateTo);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,file_name.ilike.%${filters.search}%,submitted_to.ilike.%${filters.search}%,remarks.ilike.%${filters.search}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) {
    throw new Error(error.message);
  }

  return { rows: (data ?? []) as Document[], total: count ?? 0, page, pageSize };
}

export async function getDocumentsByCompany(companyId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      uploaded_profile:profiles!uploaded_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Document[];
}

export async function getDocumentById(documentId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      uploaded_profile:profiles!uploaded_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Document | null;
}

export async function getDocumentsByInteraction(interactionId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      uploaded_profile:profiles!uploaded_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("interaction_id", interactionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Document[];
}

export async function getDocumentsByFollowup(followupId: string) {
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      companies (id, name),
      contact_persons (id, name, mobile, email),
      interactions (id, interaction_type, meeting_datetime),
      followups (id, title, scheduled_at),
      uploaded_profile:profiles!uploaded_by (id, full_name, email)
    `)
    .eq("organization_id", organization.id)
    .eq("followup_id", followupId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Document[];
}
