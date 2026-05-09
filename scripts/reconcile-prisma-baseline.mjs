import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const APPLY = process.argv.includes("--apply");

const STATEMENTS = [
  {
    name: "profiles scoring columns",
    sql: `
      alter table if exists public.profiles
        add column if not exists wallet_balance integer default 0,
        add column if not exists wallet_lifetime_earned integer default 0,
        add column if not exists manager_user_id uuid;
    `,
  },
  {
    name: "pipeline stages",
    sql: `
      create table if not exists public.pipeline_stages (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        name text not null,
        slug text not null,
        position integer not null,
        probability integer not null default 0,
        is_won boolean not null default false,
        is_lost boolean not null default false,
        is_active boolean not null default true,
        color text not null default '#0f766e',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, slug),
        unique (organization_id, position)
      );
    `,
  },
  {
    name: "activity logs",
    sql: `
      create table if not exists public.activity_logs (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        actor_user_id uuid references public.profiles(id) on delete set null,
        action text not null,
        entity_type text,
        entity_id uuid,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    `,
  },
  {
    name: "industries",
    sql: `
      create table if not exists public.industries (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        name text not null,
        description text,
        status text not null default 'active',
        created_by uuid references public.profiles(id) on delete set null,
        updated_by uuid references public.profiles(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, name)
      );
    `,
  },
  {
    name: "company categories",
    sql: `
      create table if not exists public.company_categories (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        name text not null,
        code text not null,
        description text,
        priority_level integer not null default 3,
        status text not null default 'active',
        created_by uuid references public.profiles(id) on delete set null,
        updated_by uuid references public.profiles(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, code)
      );
    `,
  },
  {
    name: "companies additional columns",
    sql: `
      alter table if exists public.companies
        add column if not exists name text,
        add column if not exists industry_id uuid references public.industries(id) on delete set null,
        add column if not exists category_id uuid references public.company_categories(id) on delete set null,
        add column if not exists lead_source text,
        add column if not exists priority text default 'medium',
        add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null,
        add column if not exists pipeline_stage_id uuid references public.pipeline_stages(id) on delete set null,
        add column if not exists phone text,
        add column if not exists whatsapp text,
        add column if not exists email text,
        add column if not exists website text,
        add column if not exists address text,
        add column if not exists city text,
        add column if not exists country text,
        add column if not exists success_rating integer,
        add column if not exists lead_temperature text default 'warm',
        add column if not exists estimated_value numeric(14, 2),
        add column if not exists expected_closing_date date,
        add column if not exists notes text,
        add column if not exists created_by uuid references public.profiles(id) on delete set null,
        add column if not exists updated_by uuid references public.profiles(id) on delete set null,
        add column if not exists lead_score integer default 0,
        add column if not exists referred_by_user_id uuid references public.profiles(id) on delete set null;
    `,
  },
  {
    name: "contact persons",
    sql: `
      create table if not exists public.contact_persons (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        company_id uuid not null references public.companies(id) on delete cascade,
        name text not null,
        designation text,
        department text,
        mobile text,
        whatsapp text,
        email text,
        linkedin text,
        decision_role text,
        relationship_level text,
        preferred_contact_method text,
        remarks text,
        is_primary boolean not null default false,
        status text not null default 'active',
        created_by uuid references public.profiles(id) on delete set null,
        updated_by uuid references public.profiles(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    name: "interactions",
    sql: `
      create table if not exists public.interactions (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        company_id uuid not null references public.companies(id) on delete cascade,
        contact_person_id uuid references public.contact_persons(id) on delete set null,
        assigned_user_id uuid references public.profiles(id) on delete set null,
        interaction_type text not null default 'Phone Call',
        meeting_datetime timestamptz not null default now(),
        location text,
        online_meeting_link text,
        discussion_details text not null,
        client_requirement text,
        pain_point text,
        proposed_solution text,
        budget_discussion text,
        competitor_mentioned text,
        decision_timeline text,
        success_rating integer,
        lead_temperature text,
        next_action text,
        next_followup_at timestamptz,
        need_help boolean not null default false,
        internal_note text,
        status text not null default 'active',
        created_by uuid references public.profiles(id) on delete set null,
        updated_by uuid references public.profiles(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    name: "followups",
    sql: `
      create table if not exists public.followups (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        company_id uuid not null references public.companies(id) on delete cascade,
        contact_person_id uuid references public.contact_persons(id) on delete set null,
        interaction_id uuid references public.interactions(id) on delete set null,
        assigned_user_id uuid references public.profiles(id) on delete set null,
        followup_type text not null default 'Phone Call',
        title text not null,
        description text,
        scheduled_at timestamptz not null,
        reminder_before_minutes integer default 60,
        status text not null default 'pending',
        priority text not null default 'medium',
        completed_at timestamptz,
        completed_by uuid references public.profiles(id) on delete set null,
        rescheduled_from timestamptz,
        cancelled_reason text,
        created_by uuid references public.profiles(id) on delete cascade,
        updated_by uuid references public.profiles(id) on delete cascade,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `,
  },
  {
    name: "email reminder logs",
    sql: `
      create table if not exists public.email_reminder_logs (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        followup_id uuid not null references public.followups(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        email text not null,
        status text not null default 'pending',
        provider text,
        error_message text,
        sent_at timestamptz,
        created_at timestamptz default now()
      );
    `,
  },
  {
    name: "documents additional columns",
    sql: `
      alter table if exists public.documents
        add column if not exists company_id uuid references public.companies(id) on delete cascade,
        add column if not exists contact_person_id uuid references public.contact_persons(id) on delete set null,
        add column if not exists interaction_id uuid references public.interactions(id) on delete set null,
        add column if not exists followup_id uuid references public.followups(id) on delete set null,
        add column if not exists document_type text default 'Other',
        add column if not exists title text,
        add column if not exists description text,
        add column if not exists file_name text,
        add column if not exists file_path text,
        add column if not exists file_url text,
        add column if not exists file_size_mb numeric,
        add column if not exists mime_type text,
        add column if not exists file_extension text,
        add column if not exists status text default 'submitted',
        add column if not exists submitted_to text,
        add column if not exists submitted_at timestamptz,
        add column if not exists expiry_date date,
        add column if not exists remarks text,
        add column if not exists created_by uuid references public.profiles(id) on delete set null,
        add column if not exists updated_by uuid references public.profiles(id) on delete set null,
        add column if not exists uploaded_by uuid references public.profiles(id) on delete set null;
    `,
  },
  {
    name: "document download logs",
    sql: `
      create table if not exists public.document_download_logs (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        document_id uuid not null references public.documents(id) on delete cascade,
        downloaded_by uuid not null references public.profiles(id) on delete cascade,
        created_at timestamptz default now()
      );
    `,
  },
  {
    name: "help requests",
    sql: `
      create table if not exists public.help_requests (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        company_id uuid not null references public.companies(id) on delete cascade,
        contact_person_id uuid references public.contact_persons(id) on delete set null,
        interaction_id uuid references public.interactions(id) on delete set null,
        followup_id uuid references public.followups(id) on delete set null,
        document_id uuid references public.documents(id) on delete set null,
        requested_by uuid not null references public.profiles(id) on delete cascade,
        assigned_to uuid references public.profiles(id) on delete set null,
        help_type text not null default 'General Support',
        title text not null,
        description text,
        priority text default 'medium',
        status text default 'open',
        resolution_note text,
        resolved_at timestamptz,
        resolved_by uuid references public.profiles(id) on delete set null,
        created_by uuid not null references public.profiles(id) on delete cascade,
        updated_by uuid not null references public.profiles(id) on delete cascade,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `,
  },
  {
    name: "help request comments",
    sql: `
      create table if not exists public.help_request_comments (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        help_request_id uuid not null references public.help_requests(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        comment text not null,
        is_internal boolean default true,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `,
  },
  {
    name: "lead score rules",
    sql: `
      create table if not exists public.lead_score_rules (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        action_key text not null,
        name text not null,
        description text,
        points integer not null default 0,
        is_active boolean not null default true,
        rule_scope jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, action_key)
      );
    `,
  },
  {
    name: "lead source score rules",
    sql: `
      create table if not exists public.lead_source_score_rules (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        source_name text not null,
        normalized_source text not null,
        bonus_points integer not null default 0,
        is_active boolean not null default true,
        rule_scope jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, normalized_source)
      );
    `,
  },
  {
    name: "challenge templates",
    sql: `
      create table if not exists public.challenge_templates (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        name text not null,
        description text,
        cadence text not null,
        target_metric text not null,
        target_count integer not null,
        bonus_points integer not null default 0,
        is_active boolean not null default true,
        starts_at timestamptz,
        ends_at timestamptz,
        config jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    name: "rewards catalog",
    sql: `
      create table if not exists public.rewards_catalog (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        name text not null,
        description text,
        reward_type text not null,
        cost_points integer not null,
        feature_key text,
        inventory integer,
        fulfillment_mode text not null default 'manual',
        is_active boolean not null default true,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    name: "wallet transactions",
    sql: `
      create table if not exists public.wallet_transactions (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        transaction_type text not null,
        action_key text not null,
        points_delta integer not null,
        balance_after integer not null,
        company_id uuid references public.companies(id) on delete set null,
        followup_id uuid references public.followups(id) on delete set null,
        challenge_id uuid references public.challenge_templates(id) on delete set null,
        reward_id uuid references public.rewards_catalog(id) on delete set null,
        source_record_id uuid,
        source_record_type text,
        idempotency_key text not null,
        metadata jsonb not null default '{}'::jsonb,
        created_by uuid references public.profiles(id) on delete set null,
        created_at timestamptz not null default now(),
        unique (organization_id, idempotency_key)
      );
    `,
  },
  {
    name: "user challenge progress",
    sql: `
      create table if not exists public.user_challenge_progress (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        challenge_template_id uuid not null references public.challenge_templates(id) on delete cascade,
        progress_count integer not null default 0,
        target_count integer not null,
        is_completed boolean not null default false,
        completed_at timestamptz,
        bonus_awarded_transaction_id uuid references public.wallet_transactions(id) on delete set null,
        window_starts_at timestamptz not null,
        window_ends_at timestamptz not null,
        last_event_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, user_id, challenge_template_id, window_starts_at)
      );
    `,
  },
  {
    name: "user streaks",
    sql: `
      create table if not exists public.user_streaks (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        streak_key text not null,
        current_streak integer not null default 0,
        best_streak integer not null default 0,
        last_activity_date date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, user_id, streak_key)
      );
    `,
  },
  {
    name: "reward redemptions",
    sql: `
      create table if not exists public.reward_redemptions (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        reward_id uuid not null references public.rewards_catalog(id) on delete restrict,
        points_spent integer not null,
        status text not null default 'pending',
        fulfillment_notes text,
        processed_by uuid references public.profiles(id) on delete set null,
        processed_at timestamptz,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `,
  },
  {
    name: "user badges",
    sql: `
      create table if not exists public.user_badges (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        reward_id uuid references public.rewards_catalog(id) on delete set null,
        badge_key text not null,
        badge_name text not null,
        badge_description text,
        metadata jsonb not null default '{}'::jsonb,
        awarded_at timestamptz not null default now(),
        awarded_by uuid references public.profiles(id) on delete set null,
        unique (organization_id, user_id, badge_key)
      );
    `,
  },
  {
    name: "scoring activity logs",
    sql: `
      create table if not exists public.scoring_activity_logs (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
        user_id uuid not null references public.profiles(id) on delete cascade,
        actor_user_id uuid references public.profiles(id) on delete set null,
        action_key text not null,
        title text not null,
        description text,
        points_delta integer not null,
        company_id uuid references public.companies(id) on delete set null,
        followup_id uuid references public.followups(id) on delete set null,
        challenge_id uuid references public.challenge_templates(id) on delete set null,
        reward_id uuid references public.rewards_catalog(id) on delete set null,
        source_record_id uuid,
        source_record_type text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    `,
  },
  {
    name: "user performance targets",
    sql: `
      create table if not exists public.user_performance_targets (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id) on delete cascade,
        user_id uuid not null references public.profiles(id) on delete cascade,
        metric_key text not null,
        period_type text not null,
        target_value integer not null,
        effective_date date not null,
        notes text,
        assigned_by uuid references public.profiles(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (organization_id, user_id, metric_key, period_type, effective_date)
      );
    `,
  },
  {
    name: "reconciliation indexes",
    sql: `
      create index if not exists profiles_manager_user_id_idx on public.profiles (manager_user_id);
      create index if not exists industries_organization_id_idx on public.industries (organization_id);
      create index if not exists company_categories_organization_id_idx on public.company_categories (organization_id);
      create index if not exists companies_organization_id_idx on public.companies (organization_id);
      create index if not exists companies_pipeline_stage_id_idx on public.companies (pipeline_stage_id);
      create index if not exists companies_assigned_user_id_idx on public.companies (assigned_user_id);
      create index if not exists contact_persons_organization_id_idx on public.contact_persons (organization_id);
      create index if not exists contact_persons_company_id_idx on public.contact_persons (company_id);
      create index if not exists interactions_organization_id_idx on public.interactions (organization_id);
      create index if not exists interactions_company_id_idx on public.interactions (company_id);
      create index if not exists interactions_contact_person_id_idx on public.interactions (contact_person_id);
      create index if not exists interactions_meeting_datetime_idx on public.interactions (meeting_datetime);
      create index if not exists documents_org_status_created_idx on public.documents (organization_id, status, created_at desc);
      create index if not exists documents_org_company_created_idx on public.documents (organization_id, company_id, created_at desc);
      create index if not exists user_performance_targets_org_user_idx on public.user_performance_targets (organization_id, user_id, period_type, effective_date desc);
      create index if not exists wallet_transactions_org_user_created_idx on public.wallet_transactions (organization_id, user_id, created_at desc);
      create index if not exists scoring_activity_logs_org_user_created_idx on public.scoring_activity_logs (organization_id, user_id, created_at desc);
    `,
  },
];

const NULLABLE_FIXES = [
  {
    name: "profiles wallet_balance not null",
    updateSql: `update public.profiles set wallet_balance = 0 where wallet_balance is null;`,
    countSql: `select count(*)::int as count from public.profiles where wallet_balance is null;`,
    alterSql: `alter table public.profiles alter column wallet_balance set default 0; alter table public.profiles alter column wallet_balance set not null;`,
  },
  {
    name: "profiles wallet_lifetime_earned not null",
    updateSql: `update public.profiles set wallet_lifetime_earned = 0 where wallet_lifetime_earned is null;`,
    countSql: `select count(*)::int as count from public.profiles where wallet_lifetime_earned is null;`,
    alterSql: `alter table public.profiles alter column wallet_lifetime_earned set default 0; alter table public.profiles alter column wallet_lifetime_earned set not null;`,
  },
  {
    name: "companies lead_score not null",
    updateSql: `update public.companies set lead_score = 0 where lead_score is null;`,
    countSql: `select count(*)::int as count from public.companies where lead_score is null;`,
    alterSql: `alter table public.companies alter column lead_score set default 0; alter table public.companies alter column lead_score set not null;`,
  },
  {
    name: "companies priority not null",
    updateSql: `update public.companies set priority = 'medium' where priority is null;`,
    countSql: `select count(*)::int as count from public.companies where priority is null;`,
    alterSql: `alter table public.companies alter column priority set default 'medium'; alter table public.companies alter column priority set not null;`,
  },
  {
    name: "companies lead_temperature not null",
    updateSql: `update public.companies set lead_temperature = 'warm' where lead_temperature is null;`,
    countSql: `select count(*)::int as count from public.companies where lead_temperature is null;`,
    alterSql: `alter table public.companies alter column lead_temperature set default 'warm'; alter table public.companies alter column lead_temperature set not null;`,
  },
  {
    name: "documents document_type not null",
    updateSql: `update public.documents set document_type = 'Other' where document_type is null;`,
    countSql: `select count(*)::int as count from public.documents where document_type is null;`,
    alterSql: `alter table public.documents alter column document_type set default 'Other'; alter table public.documents alter column document_type set not null;`,
  },
  {
    name: "documents status default",
    updateSql: `update public.documents set status = 'submitted' where status is null;`,
    countSql: `select count(*)::int as count from public.documents where status is null;`,
    alterSql: `alter table public.documents alter column status set default 'submitted';`,
  },
];

const REQUIRED_COLUMN_BLOCKERS = [
  {
    label: "companies.name",
    sql: `select count(*)::int as count from public.companies where name is null;`,
  },
  {
    label: "documents.company_id",
    sql: `select count(*)::int as count from public.documents where company_id is null;`,
  },
  {
    label: "documents.title",
    sql: `select count(*)::int as count from public.documents where title is null;`,
  },
  {
    label: "documents.file_name",
    sql: `select count(*)::int as count from public.documents where file_name is null;`,
  },
  {
    label: "documents.file_path",
    sql: `select count(*)::int as count from public.documents where file_path is null;`,
  },
];

try {
  console.log(`Mode: ${APPLY ? "apply" : "dry-run"}`);

  for (const statement of STATEMENTS) {
    if (APPLY) {
      await prisma.$executeRawUnsafe(statement.sql);
      console.log(`[applied] ${statement.name}`);
    } else {
      console.log(`[pending] ${statement.name}`);
    }
  }

  for (const fix of NULLABLE_FIXES) {
    if (APPLY) {
      await prisma.$executeRawUnsafe(fix.updateSql);
      const [{ count }] = await prisma.$queryRawUnsafe(fix.countSql);
      if (count === 0) {
        await prisma.$executeRawUnsafe(fix.alterSql);
        console.log(`[tightened] ${fix.name}`);
      } else {
        console.log(`[blocked] ${fix.name} -> remaining nulls: ${count}`);
      }
    } else {
      console.log(`[check] ${fix.name}`);
    }
  }

  console.log("");
  console.log("Required-column blocker snapshot:");

  let hasBlockers = false;
  for (const blocker of REQUIRED_COLUMN_BLOCKERS) {
    const [{ count }] = await prisma.$queryRawUnsafe(blocker.sql);
    if (count > 0) {
      hasBlockers = true;
      console.log(`- ${blocker.label}: ${count} null row(s)`);
    } else {
      console.log(`- ${blocker.label}: ok`);
    }
  }

  if (hasBlockers) {
    console.log("");
    console.log("Some required-column blockers remain. Baseline should not be marked applied yet.");
  }
} finally {
  await prisma.$disconnect();
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
