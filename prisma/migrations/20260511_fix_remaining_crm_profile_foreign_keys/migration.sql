-- Align remaining CRM user-linked foreign keys with public.profiles so
-- Better Auth profile ids work consistently on legacy databases.

update public.contact_persons cp
set created_by = null
where created_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = cp.created_by
  );

update public.contact_persons cp
set updated_by = null
where updated_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = cp.updated_by
  );

update public.interactions i
set contact_person_id = null
where contact_person_id is not null
  and not exists (
    select 1
    from public.contact_persons cp
    where cp.id = i.contact_person_id
  );

update public.interactions i
set assigned_user_id = null
where assigned_user_id is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = i.assigned_user_id
  );

update public.interactions i
set created_by = null
where created_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = i.created_by
  );

update public.interactions i
set updated_by = null
where updated_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = i.updated_by
  );

update public.followups f
set contact_person_id = null
where contact_person_id is not null
  and not exists (
    select 1
    from public.contact_persons cp
    where cp.id = f.contact_person_id
  );

update public.followups f
set interaction_id = null
where interaction_id is not null
  and not exists (
    select 1
    from public.interactions i
    where i.id = f.interaction_id
  );

update public.followups f
set assigned_user_id = null
where assigned_user_id is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = f.assigned_user_id
  );

update public.followups f
set completed_by = null
where completed_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = f.completed_by
  );

update public.documents d
set contact_person_id = null
where contact_person_id is not null
  and not exists (
    select 1
    from public.contact_persons cp
    where cp.id = d.contact_person_id
  );

update public.documents d
set interaction_id = null
where interaction_id is not null
  and not exists (
    select 1
    from public.interactions i
    where i.id = d.interaction_id
  );

update public.documents d
set followup_id = null
where followup_id is not null
  and not exists (
    select 1
    from public.followups f
    where f.id = d.followup_id
  );

update public.documents d
set created_by = null
where created_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = d.created_by
  );

update public.documents d
set updated_by = null
where updated_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = d.updated_by
  );

update public.documents d
set uploaded_by = null
where uploaded_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = d.uploaded_by
  );

update public.help_requests hr
set contact_person_id = null
where contact_person_id is not null
  and not exists (
    select 1
    from public.contact_persons cp
    where cp.id = hr.contact_person_id
  );

update public.help_requests hr
set interaction_id = null
where interaction_id is not null
  and not exists (
    select 1
    from public.interactions i
    where i.id = hr.interaction_id
  );

update public.help_requests hr
set followup_id = null
where followup_id is not null
  and not exists (
    select 1
    from public.followups f
    where f.id = hr.followup_id
  );

update public.help_requests hr
set document_id = null
where document_id is not null
  and not exists (
    select 1
    from public.documents d
    where d.id = hr.document_id
  );

update public.help_requests hr
set assigned_to = null
where assigned_to is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = hr.assigned_to
  );

update public.help_requests hr
set resolved_by = null
where resolved_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = hr.resolved_by
  );

alter table public.contact_persons
  alter column created_by drop default,
  alter column updated_by drop default;

alter table public.interactions
  alter column created_by drop default,
  alter column updated_by drop default;

alter table public.documents
  alter column created_by drop default,
  alter column updated_by drop default,
  alter column uploaded_by drop default;

alter table public.contact_persons
  drop constraint if exists contact_persons_created_by_fkey,
  drop constraint if exists contact_persons_updated_by_fkey;

alter table public.interactions
  drop constraint if exists interactions_contact_person_id_fkey,
  drop constraint if exists interactions_assigned_user_id_fkey,
  drop constraint if exists interactions_created_by_fkey,
  drop constraint if exists interactions_updated_by_fkey;

alter table public.followups
  drop constraint if exists followups_contact_person_id_fkey,
  drop constraint if exists followups_interaction_id_fkey,
  drop constraint if exists followups_assigned_user_id_fkey,
  drop constraint if exists followups_completed_by_fkey,
  drop constraint if exists followups_created_by_fkey,
  drop constraint if exists followups_updated_by_fkey;

alter table public.documents
  drop constraint if exists documents_contact_person_id_fkey,
  drop constraint if exists documents_interaction_id_fkey,
  drop constraint if exists documents_followup_id_fkey,
  drop constraint if exists documents_created_by_fkey,
  drop constraint if exists documents_updated_by_fkey,
  drop constraint if exists documents_uploaded_by_fkey;

alter table public.help_requests
  drop constraint if exists help_requests_contact_person_id_fkey,
  drop constraint if exists help_requests_interaction_id_fkey,
  drop constraint if exists help_requests_followup_id_fkey,
  drop constraint if exists help_requests_document_id_fkey,
  drop constraint if exists help_requests_requested_by_fkey,
  drop constraint if exists help_requests_assigned_to_fkey,
  drop constraint if exists help_requests_resolved_by_fkey,
  drop constraint if exists help_requests_created_by_fkey,
  drop constraint if exists help_requests_updated_by_fkey;

alter table public.document_download_logs
  drop constraint if exists document_download_logs_downloaded_by_fkey;

alter table public.email_reminder_logs
  drop constraint if exists email_reminder_logs_user_id_fkey;

alter table public.help_request_comments
  drop constraint if exists help_request_comments_user_id_fkey;

alter table public.contact_persons
  add constraint contact_persons_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint contact_persons_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null on update cascade not valid;

alter table public.interactions
  add constraint interactions_contact_person_id_fkey
    foreign key (contact_person_id) references public.contact_persons(id) on delete set null on update cascade not valid,
  add constraint interactions_assigned_user_id_fkey
    foreign key (assigned_user_id) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint interactions_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint interactions_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null on update cascade not valid;

alter table public.followups
  add constraint followups_contact_person_id_fkey
    foreign key (contact_person_id) references public.contact_persons(id) on delete set null on update cascade not valid,
  add constraint followups_interaction_id_fkey
    foreign key (interaction_id) references public.interactions(id) on delete set null on update cascade not valid,
  add constraint followups_assigned_user_id_fkey
    foreign key (assigned_user_id) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint followups_completed_by_fkey
    foreign key (completed_by) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint followups_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade on update cascade not valid,
  add constraint followups_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete cascade on update cascade not valid;

alter table public.documents
  add constraint documents_contact_person_id_fkey
    foreign key (contact_person_id) references public.contact_persons(id) on delete set null on update cascade not valid,
  add constraint documents_interaction_id_fkey
    foreign key (interaction_id) references public.interactions(id) on delete set null on update cascade not valid,
  add constraint documents_followup_id_fkey
    foreign key (followup_id) references public.followups(id) on delete set null on update cascade not valid,
  add constraint documents_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint documents_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint documents_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles(id) on delete set null on update cascade not valid;

alter table public.help_requests
  add constraint help_requests_contact_person_id_fkey
    foreign key (contact_person_id) references public.contact_persons(id) on delete set null on update cascade not valid,
  add constraint help_requests_interaction_id_fkey
    foreign key (interaction_id) references public.interactions(id) on delete set null on update cascade not valid,
  add constraint help_requests_followup_id_fkey
    foreign key (followup_id) references public.followups(id) on delete set null on update cascade not valid,
  add constraint help_requests_document_id_fkey
    foreign key (document_id) references public.documents(id) on delete set null on update cascade not valid,
  add constraint help_requests_requested_by_fkey
    foreign key (requested_by) references public.profiles(id) on delete cascade on update cascade not valid,
  add constraint help_requests_assigned_to_fkey
    foreign key (assigned_to) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint help_requests_resolved_by_fkey
    foreign key (resolved_by) references public.profiles(id) on delete set null on update cascade not valid,
  add constraint help_requests_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade on update cascade not valid,
  add constraint help_requests_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete cascade on update cascade not valid;

alter table public.document_download_logs
  add constraint document_download_logs_downloaded_by_fkey
    foreign key (downloaded_by) references public.profiles(id) on delete cascade on update cascade not valid;

alter table public.email_reminder_logs
  add constraint email_reminder_logs_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade on update cascade not valid;

alter table public.help_request_comments
  add constraint help_request_comments_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade on update cascade not valid;
