-- Ensure live databases that were created from the Prisma baseline can insert
-- performance targets without relying on application-provided timestamps.

alter table if exists public.user_performance_targets
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.user_performance_targets
set created_at = now()
where created_at is null;

update public.user_performance_targets
set updated_at = now()
where updated_at is null;
