# Auth Migration

## Snapshot
- Date: 2026-05-07
- Goal: move from Supabase Auth to a PostgreSQL-backed own auth system without breaking protected routes or user identity relationships
- Selected auth technology: Better Auth + Prisma adapter
- Why Better Auth fits:
  - official Better Auth docs support Next.js App Router and Prisma
  - it works with server-side session reads through route handlers, RSCs, and Next.js 16 `proxy`
  - it lets us keep the existing `profiles` table as the core user record while moving auth state into PostgreSQL

## Current auth flow
- Login UI:
  - `app/(auth)/auth/login/page.tsx`
  - `components/auth/auth-form.tsx`
- Register UI:
  - `app/(auth)/auth/register/page.tsx`
  - `components/auth/auth-form.tsx`
- Logout UI:
  - `components/auth/logout-button.tsx`
  - `components/app/app-topbar.tsx`
- Session/current-user helpers:
  - `lib/auth/session.ts`
  - `lib/current-user.ts`
- Protected-route proxy:
  - `proxy.ts`
  - `lib/auth/middleware.ts`
- Remaining Supabase-only auth paths:
  - `app/(auth)/auth/callback/route.ts`
  - `lib/team/invite-email.ts`
  - parts of `lib/team/team-actions.ts`

## Current tables involved
- `profiles`
  - user identity, profile details, organization relationship, active/super-admin flags
- `organizations`
  - workspace ownership and onboarding routing
- `roles`
  - organization-scoped role definitions
- `permissions`
  - permission keys
- `role_permissions`
  - role to permission mapping
- `user_roles`
  - user to role assignments
- `team_invitations`
  - invitation metadata and token tracking
- Better Auth tables/records now prepared in PostgreSQL:
  - `accounts`
  - `sessions`
  - `verification_tokens` mapped as Better Auth verification records

## Current role/profile relationship
- The app treats `profiles` as the canonical user/profile record.
- `profiles.id` is the user identity key used across the app.
- `user_roles.user_id -> profiles.id`
- `organizations.owner_user_id -> profiles.id`
- permissions are resolved from `user_roles -> roles -> role_permissions -> permissions`
- active/inactive access control still depends on `profiles.is_active`

## Risks
- Supabase invite callback flow still depends on Supabase Auth and magic-link behavior.
- Supabase-era users may exist in `profiles` without a reusable local credential account.
- RLS and SQL functions still assume `auth.uid()` in some remaining database-side flows.
- The project currently has no self-hosted password-reset email flow wired into Better Auth.
- Existing `app/api/auth/[...nextauth]` rollback route conflicts with Better Auth’s default `/api/auth/*` route path.

## User migration strategy
- Selected strategy: Option 2, password reset / reactivation for existing Supabase-era users.
- Safety reason:
  - Supabase password hashes should not be migrated unsafely.
  - user identity relationships must stay attached to the existing `profiles.id`.
- Current implementation status:
  - new Better Auth registrations create PostgreSQL-backed local credential accounts
  - legacy local users with `password_hash` can be backfilled into Better Auth credential accounts without changing `profiles.id`
  - Supabase-era users without local password material are intentionally blocked from silent migration
- Operational fallback until reset email is implemented:
  - admin/manual reactivation with a temporary password can be used for controlled migrations

## Current implementation notes
- Better Auth is mounted at `/api/better-auth/*` instead of `/api/auth/*`.
- Reason for the custom path:
  - the repo already has `app/api/auth/[...nextauth]/route.ts`
  - using `/api/better-auth/*` keeps rollback possible during the transition
- The auth provider toggle remains in env:
  - `AUTH_PROVIDER`
  - `NEXT_PUBLIC_AUTH_PROVIDER`
- Recommended value for the new path during local testing:
  - `betterauth`

## Remaining work
- Replace Supabase invite email delivery and callback flow.
- Implement a real self-hosted password reset / reactivation flow.
- Remove `next-auth` only after Better Auth is fully verified and rollback is no longer needed.
- Remove Supabase Auth helpers only after invite/callback dependencies are replaced.
