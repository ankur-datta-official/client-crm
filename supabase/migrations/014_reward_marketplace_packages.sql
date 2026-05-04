-- Migration 014: Curated reward packages and duplicate-safe active catalog

with ranked_rewards as (
  select
    id,
    row_number() over (
      partition by organization_id, coalesce(nullif(feature_key, ''), lower(name))
      order by updated_at desc, created_at desc, id desc
    ) as keep_rank
  from public.rewards_catalog
  where is_active = true
)
update public.rewards_catalog rewards
set is_active = false
from ranked_rewards ranked
where rewards.id = ranked.id
  and ranked.keep_rank > 1;

create unique index if not exists rewards_catalog_active_feature_key_idx
on public.rewards_catalog (
  organization_id,
  (coalesce(nullif(feature_key, ''), lower(name)))
)
where is_active = true;

create or replace function public.seed_lead_scoring_defaults(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_score_rules (
    organization_id,
    action_key,
    name,
    description,
    points,
    is_active,
    rule_scope
  )
  values
    (target_organization_id, 'lead_created', 'Lead creation', 'Awarded when a user creates a new lead.', 10, true, '{}'::jsonb),
    (target_organization_id, 'lead_qualified', 'Lead qualification', 'Awarded when a user advances a lead forward in the pipeline.', 5, true, jsonb_build_object('mode', 'per_stage_transition')),
    (target_organization_id, 'lead_converted_won', 'Lead conversion', 'Awarded when a user moves a lead into a won stage.', 50, true, '{}'::jsonb),
    (target_organization_id, 'followup_completed', 'Follow-up completion', 'Awarded when a follow-up is marked completed.', 5, true, '{}'::jsonb),
    (target_organization_id, 'weekly_conversion_bonus', 'Weekly conversion bonus', 'Bonus awarded after 5 won conversions in a week.', 50, true, jsonb_build_object('threshold', 5)),
    (target_organization_id, 'lead_referral', 'Lead referral reward', 'Awarded to the referring user when a referred lead is created.', 15, true, '{}'::jsonb),
    (target_organization_id, 'team_invite_accepted', 'Team invitation reward', 'Awarded when an invited teammate accepts a team invitation.', 25, true, '{}'::jsonb)
  on conflict (organization_id, action_key) do update
  set
    name = excluded.name,
    description = excluded.description,
    points = excluded.points,
    is_active = excluded.is_active,
    rule_scope = excluded.rule_scope;

  insert into public.lead_source_score_rules (
    organization_id,
    source_name,
    normalized_source,
    bonus_points,
    is_active
  )
  values
    (target_organization_id, 'LinkedIn', public.normalize_lead_source('LinkedIn'), 20, true),
    (target_organization_id, 'Website', public.normalize_lead_source('Website'), 10, true)
  on conflict (organization_id, normalized_source) do update
  set
    source_name = excluded.source_name,
    bonus_points = excluded.bonus_points,
    is_active = excluded.is_active;

  insert into public.challenge_templates (
    organization_id,
    name,
    description,
    cadence,
    target_metric,
    target_count,
    bonus_points,
    is_active,
    config
  )
  values
    (target_organization_id, 'Daily Follow-up Focus', 'Complete three follow-ups today for a bonus.', 'daily', 'followup_completed', 3, 15, true, '{}'::jsonb),
    (target_organization_id, 'Weekly Closer', 'Convert five leads to won this week for a bonus.', 'weekly', 'lead_converted_won', 5, 50, true, '{}'::jsonb)
  on conflict do nothing;

  with reward_defaults as (
    select *
    from (values
      (
        'Momentum Starter',
        'Entry badge for building the habit: create leads and complete follow-ups consistently.',
        'badge',
        75,
        'momentum-starter',
        null::integer,
        'automatic',
        jsonb_build_object('icon', 'zap', 'tier', 'Bronze', 'rank', 'Rookie', 'benefit', 'Profile badge + leaderboard boost signal', 'requirement', 'Reach 75 points')
      ),
      (
        'Top Seller',
        'Badge for consistent high performers who keep client work moving every week.',
        'badge',
        150,
        'top-seller',
        null::integer,
        'automatic',
        jsonb_build_object('icon', 'trophy', 'tier', 'Silver', 'rank', 'Closer', 'benefit', 'Top Seller badge on profile and leaderboard', 'requirement', 'Reach 150 points')
      ),
      (
        'Pipeline Pro',
        'Recognition badge for users who qualify leads and maintain disciplined pipeline hygiene.',
        'badge',
        250,
        'pipeline-pro',
        null::integer,
        'automatic',
        jsonb_build_object('icon', 'target', 'tier', 'Gold', 'rank', 'Pipeline Pro', 'benefit', 'Premium rank label + badge collection progress', 'requirement', 'Reach 250 points')
      ),
      (
        'Advanced Analytics Unlock',
        'Temporary premium analytics access for your profile to review sales patterns faster.',
        'premium_feature',
        350,
        'advanced_analytics',
        null::integer,
        'manual',
        jsonb_build_object('icon', 'chart', 'tier', 'Pro', 'rank', 'Analyst', 'benefit', '7 days of advanced analytics access', 'requirement', 'Reach 350 points', 'duration', '7 days')
      ),
      (
        'Priority Support Pass',
        'Admin-prioritized support request review for one workspace issue.',
        'manual_reward',
        450,
        'priority_support_pass',
        30,
        'manual',
        jsonb_build_object('icon', 'shield', 'tier', 'Pro', 'rank', 'Operator', 'benefit', 'One priority support request', 'requirement', 'Reach 450 points')
      ),
      (
        'Subscription Discount',
        'Admin-fulfilled discount reward for your next subscription billing cycle.',
        'discount',
        650,
        'subscription_discount',
        25,
        'manual',
        jsonb_build_object('icon', 'percent', 'tier', 'Elite', 'rank', 'Rainmaker', 'benefit', 'Subscription discount request', 'requirement', 'Reach 650 points')
      ),
      (
        'Elite Champion Pack',
        'Highest-tier recognition package for power users who repeatedly drive CRM outcomes.',
        'manual_reward',
        1000,
        'elite_champion_pack',
        10,
        'manual',
        jsonb_build_object('icon', 'crown', 'tier', 'Legend', 'rank', 'Champion', 'benefit', 'Champion badge + admin-selected perk bundle', 'requirement', 'Reach 1000 points')
      )
    ) as defaults(name, description, reward_type, cost_points, feature_key, inventory, fulfillment_mode, metadata)
  )
  update public.rewards_catalog rewards
  set
    name = reward_defaults.name,
    description = reward_defaults.description,
    reward_type = reward_defaults.reward_type,
    cost_points = reward_defaults.cost_points,
    inventory = reward_defaults.inventory,
    fulfillment_mode = reward_defaults.fulfillment_mode,
    metadata = reward_defaults.metadata,
    updated_at = now()
  from reward_defaults
  where rewards.organization_id = target_organization_id
    and rewards.is_active = true
    and coalesce(nullif(rewards.feature_key, ''), lower(rewards.name)) = reward_defaults.feature_key;

  with reward_defaults as (
    select *
    from (values
      ('Momentum Starter', 'Entry badge for building the habit: create leads and complete follow-ups consistently.', 'badge', 75, 'momentum-starter', null::integer, 'automatic', jsonb_build_object('icon', 'zap', 'tier', 'Bronze', 'rank', 'Rookie', 'benefit', 'Profile badge + leaderboard boost signal', 'requirement', 'Reach 75 points')),
      ('Top Seller', 'Badge for consistent high performers who keep client work moving every week.', 'badge', 150, 'top-seller', null::integer, 'automatic', jsonb_build_object('icon', 'trophy', 'tier', 'Silver', 'rank', 'Closer', 'benefit', 'Top Seller badge on profile and leaderboard', 'requirement', 'Reach 150 points')),
      ('Pipeline Pro', 'Recognition badge for users who qualify leads and maintain disciplined pipeline hygiene.', 'badge', 250, 'pipeline-pro', null::integer, 'automatic', jsonb_build_object('icon', 'target', 'tier', 'Gold', 'rank', 'Pipeline Pro', 'benefit', 'Premium rank label + badge collection progress', 'requirement', 'Reach 250 points')),
      ('Advanced Analytics Unlock', 'Temporary premium analytics access for your profile to review sales patterns faster.', 'premium_feature', 350, 'advanced_analytics', null::integer, 'manual', jsonb_build_object('icon', 'chart', 'tier', 'Pro', 'rank', 'Analyst', 'benefit', '7 days of advanced analytics access', 'requirement', 'Reach 350 points', 'duration', '7 days')),
      ('Priority Support Pass', 'Admin-prioritized support request review for one workspace issue.', 'manual_reward', 450, 'priority_support_pass', 30, 'manual', jsonb_build_object('icon', 'shield', 'tier', 'Pro', 'rank', 'Operator', 'benefit', 'One priority support request', 'requirement', 'Reach 450 points')),
      ('Subscription Discount', 'Admin-fulfilled discount reward for your next subscription billing cycle.', 'discount', 650, 'subscription_discount', 25, 'manual', jsonb_build_object('icon', 'percent', 'tier', 'Elite', 'rank', 'Rainmaker', 'benefit', 'Subscription discount request', 'requirement', 'Reach 650 points')),
      ('Elite Champion Pack', 'Highest-tier recognition package for power users who repeatedly drive CRM outcomes.', 'manual_reward', 1000, 'elite_champion_pack', 10, 'manual', jsonb_build_object('icon', 'crown', 'tier', 'Legend', 'rank', 'Champion', 'benefit', 'Champion badge + admin-selected perk bundle', 'requirement', 'Reach 1000 points'))
    ) as defaults(name, description, reward_type, cost_points, feature_key, inventory, fulfillment_mode, metadata)
  )
  insert into public.rewards_catalog (
    organization_id,
    name,
    description,
    reward_type,
    cost_points,
    feature_key,
    inventory,
    fulfillment_mode,
    is_active,
    metadata
  )
  select
    target_organization_id,
    reward_defaults.name,
    reward_defaults.description,
    reward_defaults.reward_type,
    reward_defaults.cost_points,
    reward_defaults.feature_key,
    reward_defaults.inventory,
    reward_defaults.fulfillment_mode,
    true,
    reward_defaults.metadata
  from reward_defaults
  where not exists (
    select 1
    from public.rewards_catalog rewards
    where rewards.organization_id = target_organization_id
      and rewards.is_active = true
      and coalesce(nullif(rewards.feature_key, ''), lower(rewards.name)) = reward_defaults.feature_key
  );
end;
$$;

do $$
declare
  organization_record record;
begin
  for organization_record in select id from public.organizations loop
    perform public.seed_lead_scoring_defaults(organization_record.id);
  end loop;
end;
$$;
