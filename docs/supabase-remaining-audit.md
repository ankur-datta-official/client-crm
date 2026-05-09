# Supabase Remaining Audit

## Audit Metadata
- Audit date/time: 2026-05-07 12:31:03 +06:00
- Branch: `full-postgres-own-backend-migration`
- Goal: identify every remaining Supabase dependency before full migration to PostgreSQL + Prisma + own backend

## Summary Of Total Supabase Usages
- Runtime/support files in `app/`, `lib/`, and `scripts/` with remaining Supabase references: `34`
- Supabase package dependencies still installed: `2`
  - `@supabase/ssr`
  - `@supabase/supabase-js`
- Supabase env/template/helper references still present:
  - `.env.example`
  - `.env.production.example`
  - `lib/env.ts`
  - `SUPABASE_SETUP.md`
  - `docs/DEPLOYMENT_GUIDE.md`
- Realtime usage found in app runtime: `0`
- `functions.invoke(...)` usage found in app runtime: `0`
- `edge function` runtime integration found: `0`

## Already Migrated To Prisma
- `lib/notifications/notifications.ts`
- `lib/product-tour/server.ts`
- `lib/product-tour/actions.ts`
- `lib/subscription/subscription-queries.ts`
- `lib/prisma.ts`
- `prisma/schema.prisma`
- `app/api/health/prisma/route.ts`
- Auth scaffolding is partially migrated:
  - `lib/auth/options.ts`
  - `app/api/auth/[...nextauth]/route.ts`
  - `app/api/auth/register/route.ts`
- Storage is partially migrated:
  - new local/private upload flow exists
  - legacy Supabase storage fallback still remains

## Remaining Supabase-Dependent Modules

| SL | File path | Supabase dependency type | Current purpose | Current risk level | Replacement needed | Recommended conversion priority | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `lib/supabase/server.ts` | auth/env/package | SSR Supabase server client factory | High | remove after all server-side Supabase usage is gone | 1 | central helper used widely |
| 2 | `lib/supabase/client.ts` | auth/package | browser Supabase client for login/logout | High | replace with pure NextAuth client flow | 1 | still imported by auth UI |
| 3 | `lib/supabase/middleware.ts` | auth | Supabase session refresh and protected-route logic | Critical | replace fully with NextAuth/app-owned middleware | 1 | still used as fallback in `lib/auth/middleware.ts` |
| 4 | `lib/env.ts` | env | resolves `NEXT_PUBLIC_SUPABASE_*` config | High | remove after no runtime Supabase client remains | 1 | currently required by auth/storage fallback |
| 5 | `app/(auth)/auth/callback/route.ts` | auth | Supabase auth callback, OTP verify, invite redirect | Critical | replace with own callback/reset/invite flow | 1 | depends on `exchangeCodeForSession` and `verifyOtp` |
| 6 | `lib/team/invite-email.ts` | auth/env/package | service-role invite email and magic-link fallback | Critical | replace with own mailer + token flow | 1 | uses `inviteUserByEmail` and `signInWithOtp` |
| 7 | `lib/team/team-actions.ts` | database/auth/rpc | team invites, accept invite, role assignment, activation, role permission writes | Critical | Prisma + own invite workflow | 1 | calls `accept_team_invitation` RPC and many table writes |
| 8 | `lib/team/team-queries.ts` | database/rpc | team members, invitations, roles, permissions, invitation preview | High | Prisma replacements for list/read paths | 1 | uses `get_team_members_for_current_organization` and `get_team_invitation_preview` RPCs |
| 9 | `app/(app)/onboarding/workspace/actions.ts` | rpc | create workspace and seed org via DB function | Critical | replace with Prisma transaction/service | 1 | calls `create_organization_workspace` |
| 10 | `lib/auth/session.ts` | auth/database | dual-provider session/profile/org/permission lookup | Critical | remove Supabase branch after full auth cutover | 1 | still contains `getSupabaseCurrentUser/Profile/Organization` |
| 11 | `components/auth/auth-form.tsx` | auth | login/register still supports Supabase path | High | remove Supabase branch when auth cutover finishes | 2 | `signUp` and `signInWithPassword` still present |
| 12 | `components/auth/logout-button.tsx` | auth | logout still supports Supabase path | Medium | remove Supabase branch later | 2 | `supabase.auth.signOut()` fallback remains |
| 13 | `components/app/app-topbar.tsx` | auth | topbar logout still supports Supabase path | Medium | remove Supabase branch later | 2 | same fallback pattern as logout button |
| 14 | `app/api/import/companies/route.ts` | auth/database | import auth gate and profile lookup | High | switch to shared app auth + Prisma import path | 2 | still calls `supabase.auth.getUser()` |
| 15 | `lib/crm/company-import-runner.ts` | database/package | bulk import helper using Supabase client type and inserts | High | Prisma bulk import service | 2 | typed against `SupabaseClient` |
| 16 | `lib/subscription/subscription-actions.ts` | database | subscription change writes and activity log | Medium | Prisma action rewrite | 2 | queries and updates subscription tables |
| 17 | `lib/profile/profile-actions.ts` | database/storage | profile reads/updates, avatar DB writes, legacy cleanup path | High | Prisma profile writes + remove legacy Supabase fallback | 2 | local storage introduced, DB layer still Supabase |
| 18 | `lib/profile/profile-utils.ts` | storage | legacy signed avatar URL fallback | Medium | remove after all avatars are local or migrated | 2 | current local path support is already added |
| 19 | `app/api/storage/avatars/[profileId]/route.ts` | storage/database | avatar local-file route with Supabase legacy redirect fallback | Medium | Prisma lookup + remove legacy fallback | 2 | current fallback uses Supabase signed URL |
| 20 | `app/api/storage/documents/[documentId]/route.ts` | storage/database | document local-file route with Supabase legacy redirect fallback | Medium | Prisma lookup + remove legacy fallback | 2 | same legacy fallback pattern |
| 21 | `lib/crm/document-actions.ts` | database/storage | document CRUD, local storage plus legacy signed URL path | High | Prisma CRUD + remove Supabase record layer/fallback | 2 | storage partially migrated, DB layer not yet |
| 22 | `lib/crm/document-queries.ts` | database | document list/detail queries | Medium | Prisma reads | 2 | straightforward read migration |
| 23 | `lib/crm/followup-actions.ts` | database | follow-up CRUD and status changes | Medium | Prisma writes | 2 | standard table operations |
| 24 | `lib/crm/followup-queries.ts` | database | follow-up list/detail queries | Medium | Prisma reads | 2 | standard read migration |
| 25 | `lib/crm/help-request-actions.ts` | database | help-request CRUD/comments/status changes | Medium | Prisma writes | 2 | standard action migration |
| 26 | `lib/crm/help-request-queries.ts` | database | help-request list/detail/count queries | Medium | Prisma reads | 2 | standard read migration |
| 27 | `lib/crm/actions.ts` | database | core CRM company/contact/interaction/settings writes | High | Prisma transactions/services | 2 | broad write surface across many tables |
| 28 | `lib/crm/queries.ts` | database | dashboard and CRM read queries | High | Prisma reads | 2 | high-traffic surface |
| 29 | `lib/crm/report-queries.ts` | database | reporting and aggregation queries | High | Prisma/raw SQL replacements | 3 | many joins/aggregates |
| 30 | `lib/search/global-search.ts` | database | tenant-safe global search across entities | High | Prisma/raw SQL search layer | 3 | cross-table search surface |
| 31 | `lib/crm/reminder-helpers.ts` | database | reminder reads/log helpers for follow-up cron | Medium | Prisma rewrite | 3 | cron-related read/write path |
| 32 | `lib/team/performance-queries.ts` | database | performance reads and manager/team rollups | High | Prisma/raw SQL replacements | 3 | manager hierarchy assumptions remain |
| 33 | `lib/team/performance-actions.ts` | rpc | performance target upsert/delete DB functions | High | Prisma/service or SQL function replacement | 3 | uses `upsert_user_performance_target` and `delete_user_performance_target` |
| 34 | `lib/team/hierarchy.ts` | database | hierarchy lookups and manager chain filtering | High | Prisma rewrite | 3 | tied to org/manager relationships |
| 35 | `lib/scoring/service.ts` | rpc | lead scoring, wallet points, redemption RPC gateway | Critical | own scoring service and SQL/Prisma logic | 3 | uses `apply_scoring_event`, `award_wallet_points`, `redeem_wallet_reward` |
| 36 | `lib/scoring/queries.ts` | database/rpc/storage | wallet summary, leaderboard, rewards, rules, signed avatar enrichment | Critical | Prisma + SQL replacement | 3 | uses leaderboard/wallet RPCs and profile avatar fallback |
| 37 | `lib/scoring/actions.ts` | database | scoring admin writes and reward management | High | Prisma writes | 3 | linked to scoring RPC ecosystem |
| 38 | `scripts/seed-dashboard-demo.mjs` | package/env/database | Supabase service-role demo seeding script | Low | replace or archive after migration | 4 | not runtime-critical |
| 39 | `.env.example` | env | local/staging example Supabase vars | Medium | remove later after no runtime Supabase | 4 | still needed right now |
| 40 | `.env.production.example` | env | production template still includes Supabase vars | Medium | remove later after full cutover | 4 | intentionally retained for current state |
| 41 | `package.json` | package | installed Supabase dependencies | High | remove only after runtime usage is zero | 4 | `@supabase/ssr`, `@supabase/supabase-js` |
| 42 | `SUPABASE_SETUP.md` | env/docs | legacy platform setup guide | Low | archive or replace later | 4 | documentation-only dependency |
| 43 | `docs/DEPLOYMENT_GUIDE.md` | env/docs | legacy Vercel + Supabase deployment guide | Low | update/replace later | 4 | documentation-only |
| 44 | `supabase/migrations/*.sql` | auth/users/rpc/schema | legacy source-of-truth for tables, RPCs, and `auth.users` assumptions | Critical | translate/replace carefully, not delete yet | 1 | still needed as migration reference |

## Database Usage Audit

### Remaining Supabase table queries
- Team:
  - `team_invitations`
  - `roles`
  - `permissions`
  - `role_permissions`
  - `user_roles`
  - `profiles`
  - `activity_logs`
- CRM:
  - `companies`
  - `contact_persons`
  - `interactions`
  - `followups`
  - `documents`
  - `document_download_logs`
  - `help_requests`
  - `industries`
  - `company_categories`
  - `pipeline_stages`
  - `activity_logs`
- Subscription:
  - `organization_subscriptions`
  - related plan/activity rows in action paths
- Profile:
  - `profiles`
- Search/reporting:
  - cross-entity reads over CRM and related lookup tables
- Import:
  - `profiles`, `industries`, `companies`, `contact_persons`

### Remaining Supabase operations
- `select`: heavily used across team, CRM, profile, search, reports, performance
- `insert`: team invitations, activity logs, user roles, CRM entities, imports
- `update`: profiles, invitations, followups, documents, roles, subscriptions, help requests
- `delete`: roles, role permissions, user roles, documents, some archival/remove paths

### Remaining RPC calls
- `create_organization_workspace`
- `get_team_members_for_current_organization`
- `get_team_invitation_preview`
- `accept_team_invitation`
- `upsert_user_performance_target`
- `delete_user_performance_target`
- `apply_scoring_event`
- `award_wallet_points`
- `redeem_wallet_reward`
- `get_user_wallet_summary`
- `get_wallet_leaderboard`

### Relationship assumptions still tied to Supabase schema
- `profiles.id` mirrors `auth.users.id`
- `organizations.owner_user_id` historically references `auth.users`
- `user_roles.user_id` and `assigned_by` historically reference Supabase auth users
- many permission and organization checks assume the current DB identity is derived from `auth.uid()`
- invite acceptance and onboarding seeding still assume DB functions can inspect `auth.users`

## Auth Usage Audit

### Remaining login/register/logout/session usage
- Login: `components/auth/auth-form.tsx` still contains Supabase `signInWithPassword`
- Register: `components/auth/auth-form.tsx` still contains Supabase `signUp`
- Logout:
  - `components/auth/logout-button.tsx`
  - `components/app/app-topbar.tsx`
- Session check:
  - `lib/auth/session.ts`
  - `lib/supabase/middleware.ts`
- Protected routes:
  - `lib/supabase/middleware.ts`
  - fallback path in `lib/auth/middleware.ts`
- Role checks:
  - `lib/auth/session.ts`
  - `lib/team/team-queries.ts`
  - `lib/team/team-actions.ts`

### Password reset
- No dedicated replacement password-reset flow exists yet.
- Existing users without local `password_hash` are still a blocker for full auth cutover.

### Email verification / invite callback
- `app/(auth)/auth/callback/route.ts` still handles Supabase code exchange and OTP verification.
- `lib/team/invite-email.ts` still sends Supabase invite/magic-link emails.

### `auth.users` dependency
- Still present in SQL migration source and invite/auth assumptions.
- This is a major blocker for deleting Supabase Auth.

## Storage Usage Audit

### Buckets still referenced
- `crm-documents`
- `profile-avatars`

### Remaining storage behaviors
- New local/private upload flow exists already.
- Remaining Supabase storage usage is fallback-only for legacy stored file paths:
  - `lib/profile/profile-utils.ts`
  - `app/api/storage/avatars/[profileId]/route.ts`
  - `app/api/storage/documents/[documentId]/route.ts`
  - `lib/crm/document-actions.ts`

### Access model
- Legacy files still rely on Supabase signed URLs.
- Local files are now served through authenticated Next.js API routes.

## Realtime Audit
- No active `channel(...)` usage found in `app/`, `lib/`, or `scripts/`
- No active `realtime` subscription implementation found in runtime code
- No `functions.invoke(...)` usage found
- No direct Edge Function runtime calls found

## Environment Variable Audit

### Current Supabase env variables found
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Files referencing them
- `.env.example`
- `.env.production.example`
- `lib/env.ts`
- `SUPABASE_SETUP.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `scripts/seed-dashboard-demo.mjs`
- `lib/team/invite-email.ts`

### Remove later
- remove only after:
  - `lib/supabase/*` is unused
  - auth callback/invite flow is replaced
  - legacy storage fallback is retired
  - service-role seeding script is removed or replaced

## Package Usage Audit
- Installed Supabase dependencies in `package.json`:
  - `@supabase/ssr`
  - `@supabase/supabase-js`
- Helper files tied to those packages:
  - `lib/supabase/server.ts`
  - `lib/supabase/client.ts`
  - `lib/supabase/middleware.ts`

## Suggested Conversion Order
1. Finish auth cutover:
   - callback route
   - invite email flow
   - invite acceptance
   - remove Supabase session fallback
2. Replace onboarding and team RPCs with Prisma/services.
3. Replace remaining high-traffic CRM read/write modules:
   - `lib/crm/queries.ts`
   - `lib/crm/actions.ts`
   - import route/runner
4. Replace document/profile DB layers and retire legacy storage fallback after file migration.
5. Replace performance and reporting/search modules.
6. Replace scoring RPC/service stack last.
7. Remove `lib/supabase/*`, env vars, packages, and legacy docs only after runtime Supabase usage reaches zero.

## Blockers
- `auth.users` assumptions still exist in SQL schema and invite/auth flow.
- Team invite lifecycle is still Supabase-auth-based.
- Onboarding and scoring still depend on DB RPCs.
- Legacy storage redirect fallback still depends on Supabase for old file paths.
- `lib/auth/session.ts` still contains a Supabase branch, so auth is not fully cut over.

## Exact Next Step For Prompt 2
Prompt 2 should focus on **auth and invite dependency removal planning**, not broad cleanup.

Recommended next prompt:

> Start Prompt 2: Supabase Auth and invite dependency removal plan.  
> Audit and design the replacement for:
> - `app/(auth)/auth/callback/route.ts`
> - `lib/team/invite-email.ts`
> - `lib/team/team-actions.ts`
> - remaining Supabase branch inside `lib/auth/session.ts`
> - any `auth.users` assumptions in SQL/RPC flows  
> Do not change application code yet.  
> Produce:
> 1. exact replacement architecture
> 2. required Prisma/schema changes
> 3. required email/invite token flow
> 4. password reset/reactivation plan
> 5. safe implementation order

