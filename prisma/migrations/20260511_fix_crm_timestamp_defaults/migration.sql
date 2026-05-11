-- Restore missing timestamp defaults on legacy CRM tables so inserts from the
-- current app do not fail with NOT NULL violations on updated_at.

alter table public.contact_persons
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.interactions
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.followups
  alter column created_at set default now();

alter table public.documents
  alter column created_at set default now();

alter table public.help_requests
  alter column created_at set default now();

alter table public.help_request_comments
  alter column created_at set default now();

update public.contact_persons
set created_at = now()
where created_at is null;

update public.contact_persons
set updated_at = now()
where updated_at is null;

update public.interactions
set created_at = now()
where created_at is null;

update public.interactions
set updated_at = now()
where updated_at is null;

update public.followups
set created_at = now()
where created_at is null;

update public.documents
set created_at = now()
where created_at is null;

update public.help_requests
set created_at = now()
where created_at is null;

update public.help_request_comments
set created_at = now()
where created_at is null;
