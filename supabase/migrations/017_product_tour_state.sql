alter table public.profiles
  add column if not exists product_tour_last_completed_version text,
  add column if not exists product_tour_last_skipped_version text,
  add column if not exists product_tour_last_started_at timestamptz;
