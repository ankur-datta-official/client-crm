create index if not exists companies_org_status_updated_idx
  on public.companies (organization_id, status, updated_at desc);

create index if not exists companies_org_stage_status_idx
  on public.companies (organization_id, pipeline_stage_id, status);

create index if not exists companies_org_assigned_status_idx
  on public.companies (organization_id, assigned_user_id, status);

create index if not exists companies_org_created_idx
  on public.companies (organization_id, created_at desc);

create index if not exists contact_persons_org_status_updated_idx
  on public.contact_persons (organization_id, status, updated_at desc);

create index if not exists contact_persons_org_company_status_idx
  on public.contact_persons (organization_id, company_id, status);

create index if not exists interactions_org_status_datetime_idx
  on public.interactions (organization_id, status, meeting_datetime desc);

create index if not exists interactions_org_company_datetime_idx
  on public.interactions (organization_id, company_id, meeting_datetime desc);

create index if not exists followups_org_status_scheduled_idx
  on public.followups (organization_id, status, scheduled_at);

create index if not exists followups_org_company_scheduled_idx
  on public.followups (organization_id, company_id, scheduled_at);

create index if not exists documents_org_status_created_idx
  on public.documents (organization_id, status, created_at desc);

create index if not exists documents_org_company_created_idx
  on public.documents (organization_id, company_id, created_at desc);

create index if not exists help_requests_org_status_created_idx
  on public.help_requests (organization_id, status, created_at desc);

create index if not exists help_requests_org_assigned_status_idx
  on public.help_requests (organization_id, assigned_to, status);

create index if not exists notifications_org_user_read_created_idx
  on public.notifications (organization_id, user_id, is_read, created_at desc);

create index if not exists activity_logs_org_created_idx
  on public.activity_logs (organization_id, created_at desc);
