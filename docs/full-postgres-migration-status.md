# Full Postgres Migration Status

## Snapshot
- Current date/time: 2026-05-07 12:31:03 +06:00
- Current branch: `full-postgres-own-backend-migration`
- Current migration goal: complete migration from Supabase to self-hosted PostgreSQL + Prisma + own backend system, while preserving rollback safety

## Project Baseline
- Package manager: `npm`
- Next.js router type: `App Router`
- Language: `TypeScript`
- Directory structure: root-level `app/` directory, no `src/`, no `pages/`

## Current Known Database Status
- PostgreSQL + Prisma foundation is already present in the repo.
- Prisma-related files already exist: `prisma/schema.prisma`, `prisma.config.ts`, `lib/prisma.ts`.
- Local PostgreSQL setup has already been introduced for server-side work.
- Some modules have already moved from Supabase DB queries to Prisma.
- Runtime migration is complete, but historical live Supabase business data has not yet been imported into the new PostgreSQL database.

## Current Known Supabase Status
- Supabase is no longer part of the active application runtime.
- Supabase packages are removed.
- Supabase env variables are removed from active env templates.
- Remaining references are historical only in docs and archived SQL migration source files.

## Prompt 1 Audit Snapshot
- Audit completed for remaining Supabase dependencies.
- Runtime/support files with remaining Supabase references in `app/`, `lib/`, and `scripts/`: `34`
- Remaining env templates/lookup files referencing Supabase:
  - `.env.example`
  - `.env.production.example`
- Realtime status:
  - no active `channel(...)`, `realtime`, or `functions.invoke(...)` usage found in `app/`, `lib/`, or `scripts/`
- Detailed report:
  - see [docs/supabase-remaining-audit.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/supabase-remaining-audit.md:1)

## Backend Foundation Status
- Prisma foundation confirmed:
  - `prisma/schema.prisma` exists
  - `lib/prisma.ts` exists
  - Prisma uses a server-only singleton client pattern for Next.js development
  - `DATABASE_URL` remains server-only and is consumed through Prisma server configuration
- Backend helper files created for the own-backend migration layer:
  - `lib/api-response.ts`
  - `lib/validation.ts`
  - `lib/permissions.ts`
  - `lib/current-user.ts`
  - `lib/auth.ts`
- Existing project baseline reused:
  - `App Router`
  - root-level `app/`
  - `TypeScript`
- Current auth compatibility approach:
  - `lib/auth/session.ts` remains the temporary bridge for both Supabase and NextAuth-backed flows
  - new helper files wrap that layer without removing Supabase behavior yet
- Current role and permission baseline centralized from existing project data:
  - roles: `organization-admin`, `sales-manager`, `sales-executive`, `support-user`, `viewer`
  - permission groups continue to come from `lib/team/types.ts`
- Client-side migration targets identified but intentionally not converted in this step:
  - `components/auth/auth-form.tsx`
  - `components/auth/logout-button.tsx`
  - `components/app/app-topbar.tsx`
  These still call the browser Supabase auth client and should be moved fully behind the new auth layer in a later prompt.

## Remaining Supabase Dependency
- No active runtime Supabase dependency remains in `app/`, `lib/`, `scripts/`, `package.json`, or active env templates.
- Historical references remain in migration notes and `supabase/migrations/*` as archival source material only.

## Next Auth Migration Plan
- Keep the temporary compatibility layer in `lib/auth/session.ts` until all protected-route and invite flows are fully verified on the own-backend path.
- Migrate client-side auth calls next so browser components stop importing the Supabase browser client directly.
- After that, replace remaining callback/invite/reset paths and then remove unused Supabase auth helpers only when rollback safety is preserved.

## Auth Migration Status
- Better Auth has been selected for the PostgreSQL-backed auth path.
- Reason:
  - official Better Auth docs support Next.js App Router, Prisma, and Next.js 16 `proxy`
  - it fits the current server-side architecture better than expanding the temporary Auth.js bridge
- Current implementation status:
  - Better Auth server config added in `lib/auth.ts`
  - Better Auth client helper added in `lib/auth-client.ts`
  - Better Auth route mounted at `app/api/better-auth/[...all]/route.ts`
  - login, register, logout, session helpers, and proxy logic now support `AUTH_PROVIDER=betterauth`
  - `app/api/auth/register/route.ts` now creates Better Auth-compatible credential accounts while preserving `profiles` rows
  - legacy local users with `password_hash` can be backfilled via `scripts/backfill-better-auth-accounts.mjs`
- Intentional remaining Supabase Auth dependency:
  - invite callback and magic-link invite delivery are still Supabase-based and must be replaced in a later prompt
- Detailed auth report:
  - see [docs/auth-migration.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/auth-migration.md:1)

## Authorization Migration Status
- Runtime authorization now flows through the own backend path:
  - `lib/auth/session.ts`
  - `lib/current-user.ts`
  - `lib/auth/middleware.ts`
  - `lib/permissions.ts`
- Protected route prefixes are now centrally mapped to permission keys.
- Better Auth + Prisma now back:
  - current user resolution
  - profile lookup
  - organization membership checks
  - role slug lookup
  - permission evaluation
  - middleware redirects for unauthenticated and unauthorized users
- Explicit top-level auth guards were added to sensitive scoring and search route handlers so security no longer depends only on downstream feature helpers.
- Profile role display lookup now uses Prisma instead of Supabase.
- Remaining risks:
  - Supabase invite/callback flow still exists
  - Supabase-era RLS assumptions still exist in `supabase/migrations/*`
  - many feature modules still use Supabase for data access, even though authz entry points now come from the own backend path
- Detailed authorization report:
  - see [docs/authorization-migration.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/authorization-migration.md:1)

## Storage Migration Status
- Local/VPS-compatible storage remains the active path for new private uploads.
- Private storage is now structured with explicit roots:
  - public upload root: `UPLOAD_DIR`
  - private upload root: `PRIVATE_UPLOAD_DIR`
  - temporary upload root: `TEMP_UPLOAD_DIR`
- Current active private file flows:
  - profile avatars
  - CRM documents
- Storage hardening now includes:
  - env-based hard upload-size limits through `MAX_UPLOAD_SIZE_MB`
  - reusable MIME/extension validation helpers
  - path traversal protection rooted to the private upload directory
  - explicit document permission checks for private file access
  - `nosniff` headers on locally served private files
- No active Supabase storage dependency remains in the running app.
- Detailed storage report:
  - see [docs/storage-migration.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/storage-migration.md:1)

## Final Cleanup Status
- A final Supabase removal audit was run again across app code, route handlers, auth, storage, env templates, scripts, and docs.
- Outcome:
  - active runtime Supabase removal is complete
  - `@supabase/supabase-js` and `@supabase/ssr` are removed
  - Supabase env variables are removed from active env templates
- Remaining Supabase references:
  - historical docs
  - `supabase/migrations/*` archival source files
- Latest migration progress:
  - Better Auth is now the default provider target in env templates and provider resolution
  - invite email delivery now uses SMTP instead of Supabase invite APIs
  - onboarding workspace creation now uses Prisma instead of the Supabase workspace RPC
  - team invitation preview, team member queries, team invitation queries, role queries, and team role/member actions now use Prisma
  - invitation acceptance now uses Prisma instead of the Supabase invite acceptance RPC
  - performance target reads/writes and hierarchy access helpers in `lib/team/*` now run through Prisma and server-side SQL instead of Supabase
  - company import and global search now run through Prisma/server-side SQL instead of Supabase
  - scoring service, scoring queries, and scoring admin actions now call PostgreSQL through Prisma/server-side SQL instead of Supabase RPC
  - core CRM read queries in `lib/crm/queries.ts` now run through Prisma/server-side SQL instead of Supabase
  - core CRM write actions in `lib/crm/actions.ts` now run through Prisma/server-side SQL instead of Supabase
  - follow-up queries and follow-up actions now run through Prisma/server-side SQL instead of Supabase
  - help-request queries and help-request actions now run through Prisma/server-side SQL instead of Supabase
  - document queries and document actions now run through Prisma/server-side SQL instead of Supabase for database operations
  - report queries and reminder helpers now run through Prisma/server-side SQL instead of Supabase
  - subscription actions now run through Prisma/server-side SQL instead of Supabase
  - profile actions now run through Prisma/server-side SQL instead of Supabase for profile updates and avatar metadata writes
  - document storage route metadata lookup now runs through Prisma/server-side SQL instead of Supabase
  - auth form and sign-out UI components no longer call the Supabase browser auth client directly
  - the demo dashboard seed script now uses Prisma instead of the Supabase service-role client
  - unused `lib/supabase/client.ts` and `lib/supabase/middleware.ts` have been removed
  - a local schema parity checker now exists:
    - `npm run db:check-schema-parity`
  - a local schema repair script now exists:
    - `npm run db:repair-local-schema:dry`
    - `npm run db:repair-local-schema`
  - current local DB mismatch discovered:
    - resolved by `npm run db:repair-local-schema`
  - local schema parity is now clean for the checked migration-critical tables:
    - `profiles`
    - `documents`
    - `companies`
    - `team_invitations`
  - `lib/supabase/server.ts` and `lib/env.ts` have been removed as dead code
  - obsolete Supabase env placeholders have been removed from example env files
  - legacy storage bridge files and cutover scripts have been removed after readiness passed
- Realtime status:
  - no active runtime `channel(...)` or `functions.invoke(...)` usage found
- Prisma migration readiness:
  - `prisma generate` passes
  - `prisma migrate status` currently reports that the database is not yet baselined under Prisma Migrate
- Detailed final report:
  - see [docs/final-supabase-removal-report.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/final-supabase-removal-report.md:1)

## Prisma Baseline Status
- Prisma schema coverage checker is now green against the archived SQL source.
- Current coverage snapshot:
  - SQL tables discovered: `34`
  - Prisma mapped tables: `37`
  - Covered tables: `34`
  - Missing Prisma models: `0`
- Validation snapshot:
  - `npx prisma generate`: passed
  - `npx prisma validate`: passed
  - `npm run typecheck`: passed
  - `npm run lint`: passed with the same 4 pre-existing React Compiler warnings
- Baseline artifact:
  - `prisma/migrations/20260509_initial_baseline/migration.sql`
  - `prisma/migrations/migration_lock.toml`
- Local baseline reconciliation:
  - `scripts/reconcile-prisma-baseline.mjs`
  - `npm run prisma:reconcile-local:dry`
  - `npm run prisma:reconcile-local`
  - the additive local reconciliation pass has already been applied
- Remaining blocker:
  - final normalization has now been completed with:
    - `scripts/normalize-prisma-local-db.mjs`
    - `npm run prisma:normalize-local:dry`
    - `npm run prisma:normalize-local`
  - `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` now reports `No difference detected.`
  - `npx prisma migrate resolve --applied 20260509_initial_baseline` has been run on the populated local DB.
  - `npx prisma migrate status` now reports `Database schema is up to date!`
  - Prisma baseline hardening is now complete for local development and a fresh VPS deployment can use `prisma migrate deploy`.
- Detailed baseline report:
  - see [docs/prisma-baseline-status.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/prisma-baseline-status.md:1)

## Live Data Migration Status
- Runtime architecture is ready for live data import.
- Local verification showed the target PostgreSQL database is still mostly empty for real business tables.
- A one-time live data migration path now exists:
  - `scripts/migrate-supabase-live-data.mjs`
  - `npm run data:migrate:supabase:dry`
  - `npm run data:migrate:supabase`
- A local target data verification script now exists:
  - `scripts/check-local-data-status.mjs`
  - `npm run data:check:local`
- The live import still requires a private source connection string:
  - `SUPABASE_SOURCE_DATABASE_URL`
- Imported legacy users are expected to use the existing forgot-password / reset-password flow after migration because Supabase Auth password hashes are not migrated.
- Detailed live data migration plan:
  - see [docs/live-data-migration.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/live-data-migration.md:1)

## Git Working Tree Status
- This branch was created from `migrate-supabase-to-postgres-prisma`.
- The working tree already contains uncommitted changes carried into this branch.
- Rollback is currently possible by:
  1. switching back to `migrate-supabase-to-postgres-prisma`
  2. avoiding destructive git commands
  3. committing migration steps incrementally before any risky removal work

## Rollback Instruction
- To return to the prior branch state:
  - `git checkout migrate-supabase-to-postgres-prisma`
- To preserve current work before risky changes:
  - commit the current branch in small reviewable steps
- Do not run `git reset --hard` or delete Supabase code until all remaining dependencies are verified and replaced.
