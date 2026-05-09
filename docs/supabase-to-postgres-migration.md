# Supabase To Postgres Migration

## Status Legend
- `converted`: moved from Supabase DB queries to Prisma
- `not converted`: still uses Supabase DB queries
- `blocked`: cannot safely convert yet
- `needs manual review`: logic is coupled enough that it should be reviewed during migration

## Current Phase 3 Progress

### Converted
- `lib/notifications/notifications.ts`
- `lib/product-tour/server.ts`
- `lib/product-tour/actions.ts`
- `lib/subscription/subscription-queries.ts`

### Not Converted
- `app/(app)/onboarding/workspace/actions.ts`
- `lib/crm/actions.ts`
- `lib/crm/company-import-runner.ts`
- `lib/crm/document-actions.ts`
- `lib/crm/followup-actions.ts`
- `lib/crm/help-request-actions.ts`
- `lib/crm/reminder-helpers.ts`
- `lib/scoring/actions.ts`
- `lib/scoring/queries.ts`
- `lib/scoring/service.ts`
- `lib/subscription/subscription-actions.ts`
- `lib/team/performance-actions.ts`
- `lib/team/team-actions.ts`
- `lib/team/team-queries.ts`

### Blocked
- `app/(auth)/auth/callback/route.ts`
- `lib/auth/session.ts`
- `lib/supabase/middleware.ts`
- `components/app/app-topbar.tsx`
- `components/auth/auth-form.tsx`
- `components/auth/logout-button.tsx`

### Needs Manual Review
- `app/api/import/companies/route.ts`
- `lib/profile/profile-actions.ts`
- `lib/profile/profile-utils.ts`

## Notes
- Auth/session flow is intentionally still on Supabase.
- Storage-backed modules are intentionally still on Supabase.
- Local Prisma connection is working, but the local PostgreSQL `crm` database was previously empty during `prisma db pull`, so runtime validation of converted table queries depends on the target schema existing locally.

## Phase 4 Progress

### Converted
- `lib/auth/session.ts`
- `proxy.ts`
- `components/auth/auth-form.tsx`
- `components/auth/logout-button.tsx`
- `components/app/app-topbar.tsx`
- `app/(auth)/auth/login/page.tsx`
- `app/(auth)/auth/register/page.tsx`

### Not Converted
- `app/(auth)/auth/callback/route.ts`
- `app/(auth)/auth/accept-invite/page.tsx`
- `lib/team/invite-email.ts`
- `lib/team/team-actions.ts`

### Blocked
- Supabase invite magic-link flow still depends on `auth.users`, `inviteUserByEmail`, and the existing callback route.
- A user reactivation or password-reset path is still needed for existing Supabase-only users who do not yet have a local `password_hash`.

### Needs Manual Review
- `supabase/migrations/015_team_invitation_email_guard.sql`
- any server actions or RPC paths that still assume `auth.uid()` inside database functions

## Auth Notes
- `AUTH_PROVIDER=supabase` remains the safe rollback default.
- `AUTH_PROVIDER=nextauth` enables the parallel local credentials flow with Auth.js and Prisma.
- Existing Supabase users are not silently migrated to credentials auth. They need an explicit password setup or reset path.
