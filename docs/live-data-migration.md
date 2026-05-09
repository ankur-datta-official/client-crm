# Live Data Migration

## Goal
Safely migrate the old live Supabase PostgreSQL data into the new local or VPS PostgreSQL database without reintroducing Supabase into the runtime architecture.

## Current Reality
- The app runtime is already running on:
  - PostgreSQL
  - Prisma
  - Better Auth
  - own storage
- The missing piece is live business data from the old Supabase project.
- Local verification on 2026-05-09 showed that the current local database is mostly empty except for a couple of profile rows.

## Safe Strategy
1. Keep the current local/VPS PostgreSQL schema as the target source of truth.
2. Read the old Supabase data directly from the source PostgreSQL database using a one-time server-only connection string.
3. Import data into the new database in dependency order.
4. Preserve user IDs so relationships remain intact.
5. Do not attempt unsafe password hash migration from Supabase Auth.
6. Use the existing password reset / reactivation flow for imported legacy users.

## Required Env
Add this to `.env.local` only for the one-time migration:

```env
SUPABASE_SOURCE_DATABASE_URL=postgresql://...
```

Important:
- keep it server-only
- do not add `NEXT_PUBLIC_`
- remove it after migration completes

## Commands
Check current local data:

```bash
npm run data:check:local
```

Preview the live migration without writing:

```bash
npm run data:migrate:supabase:dry
```

Run the live migration:

```bash
npm run data:migrate:supabase
```

## What The Migration Script Imports

### Users
Imported from:
- `auth.users`
- joined with `public.profiles`

Mapped into:
- `public.profiles`

Preserved:
- user ID
- organization relation
- profile metadata
- active/super-admin flags
- wallet fields
- product tour fields

Not migrated unsafely:
- Supabase password hashes

User login plan after import:
- imported legacy users should use the existing forgot-password / reset-password flow
- or an admin can manage controlled reactivation if needed

### Public App Tables
The migration script imports these in dependency-safe order:
- `organizations`
- `subscription_plans`
- `organization_subscriptions`
- `permissions`
- `roles`
- `role_permissions`
- `team_invitations`
- `pipeline_stages`
- `industries`
- `company_categories`
- `companies`
- `contact_persons`
- `interactions`
- `followups`
- `documents`
- `notifications`
- `activity_logs`
- `document_download_logs`
- `email_reminder_logs`
- `help_requests`
- `help_request_comments`
- `lead_score_rules`
- `lead_source_score_rules`
- `challenge_templates`
- `rewards_catalog`
- `wallet_transactions`
- `user_challenge_progress`
- `user_streaks`
- `reward_redemptions`
- `user_badges`
- `scoring_activity_logs`
- `user_performance_targets`
- `user_roles`

## Current Limitation
This migration cannot fetch the old live data unless the source Supabase PostgreSQL connection string is available locally.

That means:
- code and tooling are ready
- actual live import still depends on providing `SUPABASE_SOURCE_DATABASE_URL`

## Verification After Import
1. Run:

```bash
npm run data:check:local
```

2. Confirm these are no longer zero:
- `organizations`
- `roles`
- `permissions`
- `companies`
- `contact_persons`
- `interactions`
- `followups`
- `documents`
- `subscription_plans`

3. Test auth:
- use the forgot-password flow for an imported legacy user
- set a new password
- sign in through Better Auth

4. Test app behavior:
- dashboard
- companies
- contacts
- meetings
- followups
- documents
- team
- reports

## Rollback
- take a `pg_dump` backup before running the import against a valuable target DB
- if the import result is bad, restore the target DB backup
- do not delete the old Supabase data source until verification is complete
