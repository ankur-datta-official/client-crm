alter table public.profiles
  add column if not exists manager_user_id uuid references public.profiles(id) on delete set null;

create index if not exists profiles_manager_user_id_idx
  on public.profiles (manager_user_id);

create or replace function public.validate_profile_manager_relationship()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  manager_org_id uuid;
begin
  if new.manager_user_id is null then
    return new;
  end if;

  if new.manager_user_id = new.id then
    raise exception 'A user cannot report to themselves.';
  end if;

  select organization_id
    into manager_org_id
  from public.profiles
  where id = new.manager_user_id;

  if manager_org_id is null then
    raise exception 'Selected manager was not found.';
  end if;

  if new.organization_id is distinct from manager_org_id then
    raise exception 'Manager must belong to the same organization.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_manager_relationship on public.profiles;
create trigger validate_profile_manager_relationship
before insert or update of organization_id, manager_user_id
on public.profiles
for each row
execute function public.validate_profile_manager_relationship();

create table if not exists public.user_performance_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  metric_key text not null check (metric_key in ('leads_created', 'meetings_logged', 'followups_completed')),
  period_type text not null check (period_type in ('daily', 'monthly')),
  target_value integer not null check (target_value > 0),
  effective_date date not null,
  notes text,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, metric_key, period_type, effective_date)
);

create index if not exists user_performance_targets_org_user_idx
  on public.user_performance_targets (organization_id, user_id, period_type, effective_date desc);

drop trigger if exists set_user_performance_targets_updated_at on public.user_performance_targets;
create trigger set_user_performance_targets_updated_at
before update on public.user_performance_targets
for each row execute function public.set_updated_at();

create or replace function public.has_settings_manage_access(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles actor
    left join public.organizations o
      on o.id = actor.organization_id
    left join public.user_roles ur
      on ur.user_id = actor.id
     and ur.organization_id = actor.organization_id
    left join public.role_permissions rp
      on rp.role_id = ur.role_id
    left join public.permissions p
      on p.id = rp.permission_id
    where actor.id = auth.uid()
      and actor.organization_id = target_organization_id
      and actor.is_active = true
      and (
        actor.is_super_admin
        or o.owner_user_id = actor.id
        or p.key = 'settings.manage'
      )
  );
$$;

create or replace function public.can_manage_target_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles actor
    join public.profiles target
      on target.id = target_user_id
    where actor.id = auth.uid()
      and actor.organization_id is not null
      and target.organization_id = actor.organization_id
      and target.is_active = true
      and (
        actor.id = target.id
        or target.manager_user_id = actor.id
        or public.has_settings_manage_access(actor.organization_id)
      )
  );
$$;

create or replace function public.upsert_user_performance_target(
  target_user_id uuid,
  target_metric text,
  target_period text,
  target_value integer,
  target_effective_date date,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  resolved_target_id uuid;
begin
  select *
    into actor_profile
  from public.profiles
  where id = auth.uid();

  if actor_profile.id is null or actor_profile.organization_id is null or not actor_profile.is_active then
    raise exception 'Authentication required.';
  end if;

  select *
    into target_profile
  from public.profiles
  where id = target_user_id
    and organization_id = actor_profile.organization_id;

  if target_profile.id is null then
    raise exception 'Target user was not found in this workspace.';
  end if;

  if not public.can_manage_target_user(target_user_id) then
    raise exception 'You do not have permission to manage this user target.';
  end if;

  insert into public.user_performance_targets (
    organization_id,
    user_id,
    metric_key,
    period_type,
    target_value,
    effective_date,
    notes,
    assigned_by
  )
  values (
    actor_profile.organization_id,
    target_user_id,
    target_metric,
    target_period,
    target_value,
    target_effective_date,
    nullif(target_notes, ''),
    auth.uid()
  )
  on conflict (organization_id, user_id, metric_key, period_type, effective_date)
  do update set
    target_value = excluded.target_value,
    notes = excluded.notes,
    assigned_by = excluded.assigned_by,
    updated_at = now()
  returning id into resolved_target_id;

  return resolved_target_id;
end;
$$;

create or replace function public.delete_user_performance_target(target_row_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_record public.user_performance_targets%rowtype;
begin
  select *
    into target_record
  from public.user_performance_targets
  where id = target_row_id;

  if target_record.id is null then
    raise exception 'Target record was not found.';
  end if;

  if not public.can_manage_target_user(target_record.user_id) then
    raise exception 'You do not have permission to delete this user target.';
  end if;

  delete from public.user_performance_targets
  where id = target_row_id;

  return true;
end;
$$;

drop function if exists public.get_team_members_for_current_organization();

create or replace function public.get_team_members_for_current_organization()
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  job_title text,
  department text,
  phone text,
  organization_id uuid,
  created_at timestamptz,
  is_active boolean,
  last_login_at timestamptz,
  role_id uuid,
  role_name text,
  role_slug text,
  manager_user_id uuid,
  manager_name text,
  manager_email text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.job_title,
    p.department,
    p.phone,
    p.organization_id,
    p.created_at,
    p.is_active,
    au.last_sign_in_at,
    ur.role_id,
    r.name,
    r.slug,
    p.manager_user_id,
    manager.full_name,
    manager.email
  from public.profiles p
  left join public.user_roles ur
    on ur.user_id = p.id
   and ur.organization_id = p.organization_id
  left join public.roles r
    on r.id = ur.role_id
  left join auth.users au
    on au.id = p.id
  left join public.profiles manager
    on manager.id = p.manager_user_id
  where p.organization_id = public.current_organization_id()
  order by coalesce(p.full_name, p.email);
$$;

alter table public.user_performance_targets enable row level security;

drop policy if exists "Organization members can read performance targets" on public.user_performance_targets;
create policy "Organization members can read performance targets"
on public.user_performance_targets for select
using (organization_id = public.current_organization_id());

grant select on public.user_performance_targets to authenticated;
grant execute on function public.has_settings_manage_access(uuid) to authenticated;
grant execute on function public.can_manage_target_user(uuid) to authenticated;
grant execute on function public.upsert_user_performance_target(uuid, text, text, integer, date, text) to authenticated;
grant execute on function public.delete_user_performance_target(uuid) to authenticated;
