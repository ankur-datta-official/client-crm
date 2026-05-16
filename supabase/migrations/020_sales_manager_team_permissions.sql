insert into public.permissions (key, name, description)
values
  ('team.view_activity', 'View Team Activity', 'Review activity updates from directly managed team members.'),
  ('team.manage_hierarchy', 'Manage Team Hierarchy', 'Update workspace reporting lines for team members.'),
  ('team.manage_targets', 'Manage Team Targets', 'Assign and update workspace performance targets for team members.')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;

update public.roles
set description = 'Manage sales team activity, targets, pipeline, and reports.',
    updated_at = now()
where slug = 'sales-manager'
  and is_system = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.key in ('team.view_activity', 'team.manage_hierarchy', 'team.manage_targets')
where r.slug = 'sales-manager'
  and r.is_system = true
on conflict do nothing;
