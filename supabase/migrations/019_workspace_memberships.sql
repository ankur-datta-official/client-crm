create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  deactivated_at timestamptz,
  manager_user_id uuid references public.profiles(id) on delete set null,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists workspace_memberships_user_status_idx
  on public.workspace_memberships (user_id, status);

create index if not exists workspace_memberships_org_status_idx
  on public.workspace_memberships (organization_id, status);

create index if not exists workspace_memberships_org_manager_status_idx
  on public.workspace_memberships (organization_id, manager_user_id, status);

create or replace function public.validate_workspace_membership_relationship()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  manager_membership_exists boolean;
begin
  if new.manager_user_id is null then
    return new;
  end if;

  if new.manager_user_id = new.user_id then
    raise exception 'A user cannot report to themselves.';
  end if;

  select exists (
    select 1
    from public.workspace_memberships manager_membership
    where manager_membership.organization_id = new.organization_id
      and manager_membership.user_id = new.manager_user_id
      and manager_membership.status = 'active'
  )
    into manager_membership_exists;

  if not manager_membership_exists then
    raise exception 'Selected manager must be an active member of the same workspace.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_workspace_membership_relationship on public.workspace_memberships;
create trigger validate_workspace_membership_relationship
before insert or update of organization_id, user_id, manager_user_id, status
on public.workspace_memberships
for each row
execute function public.validate_workspace_membership_relationship();

drop trigger if exists set_workspace_memberships_updated_at on public.workspace_memberships;
create trigger set_workspace_memberships_updated_at
before update on public.workspace_memberships
for each row execute function public.set_updated_at();

with membership_source as (
  select
    p.organization_id,
    p.id as user_id,
    p.manager_user_id,
    null::uuid as invited_by,
    p.created_at as joined_at
  from public.profiles p
  where p.organization_id is not null

  union

  select
    ur.organization_id,
    ur.user_id,
    null::uuid as manager_user_id,
    ur.assigned_by as invited_by,
    ur.assigned_at as joined_at
  from public.user_roles ur

  union

  select
    o.id as organization_id,
    o.owner_user_id as user_id,
    null::uuid as manager_user_id,
    o.owner_user_id as invited_by,
    o.created_at as joined_at
  from public.organizations o
)
insert into public.workspace_memberships (
  organization_id,
  user_id,
  status,
  joined_at,
  deactivated_at,
  manager_user_id,
  invited_by,
  created_at,
  updated_at
)
select
  source.organization_id,
  source.user_id,
  'active',
  min(source.joined_at),
  null,
  max(source.manager_user_id),
  max(source.invited_by),
  now(),
  now()
from membership_source source
group by source.organization_id, source.user_id
on conflict (organization_id, user_id) do update
set
  status = 'active',
  manager_user_id = coalesce(public.workspace_memberships.manager_user_id, excluded.manager_user_id),
  invited_by = coalesce(public.workspace_memberships.invited_by, excluded.invited_by),
  updated_at = now();
