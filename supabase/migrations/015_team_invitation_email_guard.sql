create or replace function public.accept_team_invitation(invite_token text)
returns table (
  invitation_id uuid,
  organization_id uuid,
  role_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  invitation_record public.team_invitations%rowtype;
  profile_record public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to accept an invitation.';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  select
    users.id,
    users.email,
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'avatar_url', '')
  from auth.users users
  where users.id = current_user_id
  on conflict (id) do nothing;

  select *
  into invitation_record
  from public.team_invitations
  where token = invite_token
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if invitation_record.id is null then
    raise exception 'Invitation is invalid or expired.';
  end if;

  select users.email
  into current_user_email
  from auth.users users
  where users.id = current_user_id;

  if current_user_email is null or lower(current_user_email) <> lower(invitation_record.email) then
    raise exception 'This invitation was sent to a different email address.';
  end if;

  select *
  into profile_record
  from public.profiles
  where id = current_user_id;

  if profile_record.organization_id is not null and profile_record.organization_id <> invitation_record.organization_id then
    raise exception 'This account already belongs to another organization.';
  end if;

  update public.profiles
  set
    organization_id = invitation_record.organization_id,
    is_active = true,
    full_name = coalesce(public.profiles.full_name, invitation_record.full_name),
    job_title = coalesce(public.profiles.job_title, invitation_record.job_title),
    department = coalesce(public.profiles.department, invitation_record.department),
    phone = coalesce(public.profiles.phone, invitation_record.phone)
  where id = current_user_id;

  delete from public.user_roles
  where organization_id = invitation_record.organization_id
    and user_id = current_user_id;

  insert into public.user_roles (organization_id, user_id, role_id, assigned_by)
  values (
    invitation_record.organization_id,
    current_user_id,
    invitation_record.role_id,
    invitation_record.invited_by
  )
  on conflict (organization_id, user_id, role_id) do nothing;

  update public.team_invitations
  set
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  where id = invitation_record.id;

  return query
  select invitation_record.id, invitation_record.organization_id, invitation_record.role_id;
end;
$$;
