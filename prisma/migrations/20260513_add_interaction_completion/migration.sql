alter table public.interactions
  add column if not exists completed_at timestamptz(6),
  add column if not exists completed_by uuid;

create index if not exists interactions_completed_at_idx on public.interactions (completed_at);

alter table public.interactions
  drop constraint if exists interactions_completed_by_fkey;

alter table public.interactions
  add constraint interactions_completed_by_fkey
    foreign key (completed_by) references public.profiles(id) on delete set null on update cascade not valid;
