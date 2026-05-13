alter table public.companies
  add column if not exists phone_numbers jsonb not null default '[]'::jsonb,
  add column if not exists email_addresses jsonb not null default '[]'::jsonb;

alter table public.contact_persons
  add column if not exists mobile_numbers jsonb not null default '[]'::jsonb,
  add column if not exists email_addresses jsonb not null default '[]'::jsonb;

update public.companies
set
  phone_numbers = case
    when coalesce(trim(phone), '') = '' then '[]'::jsonb
    else jsonb_build_array(trim(phone))
  end,
  email_addresses = case
    when coalesce(trim(email), '') = '' then '[]'::jsonb
    else jsonb_build_array(lower(trim(email)))
  end
where phone_numbers = '[]'::jsonb
  and email_addresses = '[]'::jsonb;

update public.contact_persons
set
  mobile_numbers = case
    when coalesce(trim(mobile), '') = '' then '[]'::jsonb
    else jsonb_build_array(trim(mobile))
  end,
  email_addresses = case
    when coalesce(trim(email), '') = '' then '[]'::jsonb
    else jsonb_build_array(lower(trim(email)))
  end
where mobile_numbers = '[]'::jsonb
  and email_addresses = '[]'::jsonb;
