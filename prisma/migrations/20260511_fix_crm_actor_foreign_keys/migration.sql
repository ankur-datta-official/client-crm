-- Align legacy CRM ownership columns with the profiles table used by the app.
-- This keeps live databases created from older Supabase SQL compatible with the
-- current Better Auth / Prisma runtime.

update public.industries i
set created_by = null
where created_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = i.created_by
  );

update public.industries i
set updated_by = null
where updated_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = i.updated_by
  );

update public.company_categories c
set created_by = null
where created_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = c.created_by
  );

update public.company_categories c
set updated_by = null
where updated_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = c.updated_by
  );

update public.companies c
set created_by = null
where created_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = c.created_by
  );

update public.companies c
set updated_by = null
where updated_by is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = c.updated_by
  );

alter table public.industries
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column created_by drop default,
  alter column updated_by drop default;

alter table public.company_categories
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column created_by drop default,
  alter column updated_by drop default;

alter table public.companies
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column created_by drop default,
  alter column updated_by drop default;

alter table public.industries
  drop constraint if exists industries_created_by_fkey,
  drop constraint if exists industries_updated_by_fkey;

alter table public.company_categories
  drop constraint if exists company_categories_created_by_fkey,
  drop constraint if exists company_categories_updated_by_fkey;

alter table public.companies
  drop constraint if exists companies_created_by_fkey,
  drop constraint if exists companies_updated_by_fkey;

alter table public.industries
  add constraint industries_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null on update cascade,
  add constraint industries_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null on update cascade;

alter table public.company_categories
  add constraint company_categories_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null on update cascade,
  add constraint company_categories_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null on update cascade;

alter table public.companies
  add constraint companies_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null on update cascade,
  add constraint companies_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null on update cascade;
