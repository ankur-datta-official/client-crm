update public.activity_logs l
set actor_user_id = null
where actor_user_id is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = l.actor_user_id
  );

alter table public.activity_logs
  drop constraint if exists activity_logs_actor_user_id_fkey;

alter table public.activity_logs
  add constraint activity_logs_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles(id) on delete set null on update cascade;
