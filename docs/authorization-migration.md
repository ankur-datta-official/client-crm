# Authorization Migration

## Snapshot
- Date/time: 2026-05-07 +06:00
- Goal: move authorization to the PostgreSQL + Prisma + Better Auth backend path without changing UI design or business logic

## Existing Roles
- `organization-admin`
- `sales-manager`
- `sales-executive`
- `support-user`
- `viewer`

No confirmed runtime role slugs were found for `team_head`, `employee`, `security`, `reception`, or `hr`. Those names should not be introduced unless a later schema/data audit proves they exist.

## Existing Permissions
- `dashboard.view`
- `companies.view`
- `companies.create`
- `companies.update`
- `companies.archive`
- `companies.delete`
- `contacts.view`
- `contacts.create`
- `contacts.update`
- `contacts.archive`
- `meetings.view`
- `meetings.create`
- `meetings.update`
- `meetings.archive`
- `followups.view`
- `followups.create`
- `followups.update`
- `followups.complete`
- `followups.cancel`
- `followups.archive`
- `documents.view`
- `documents.upload`
- `documents.update`
- `documents.download`
- `documents.archive`
- `help_requests.view`
- `help_requests.create`
- `help_requests.assign`
- `help_requests.resolve`
- `help_requests.reject`
- `help_requests.archive`
- `reports.view`
- `reports.export`
- `team.view`
- `team.invite`
- `team.update_role`
- `team.deactivate`
- `settings.view`
- `settings.manage`
- `subscription.view`
- `subscription.manage`
- `scoring.view`
- `scoring.manage`
- `rewards.manage`
- `leaderboard.view`

## Protected Routes And Pages
- `/dashboard` -> `dashboard.view`
- `/companies` -> `companies.view`
- `/contacts` -> `contacts.view`
- `/meetings` -> `meetings.view`
- `/followups` -> `followups.view`
- `/pipeline` -> `companies.view`
- `/documents` -> `documents.view`
- `/need-help` -> `help_requests.view`
- `/reports` -> `reports.view`
- `/team` -> `team.view`
- `/subscription` -> `subscription.view`
- `/settings` -> `settings.view`
- `/onboarding` -> authenticated user required, no extra permission gate
- `/auth/login` and `/auth/register` -> redirect away for authenticated users

Representative page-level permission gates already present:
- `app/(app)/team/page.tsx` -> `team.view`, with conditional actions for `team.invite`, `team.update_role`, `team.deactivate`, `settings.manage`
- `app/(app)/reports/page.tsx` -> `reports.view`
- `app/(app)/subscription/page.tsx` -> `subscription.view`, with manage actions behind `subscription.manage`
- settings/scoring admin pages -> `settings.manage` or `scoring.manage`

## API Routes Requiring Protection
- `app/api/import/companies/route.ts`
  - authenticated user
  - organization membership
  - `companies.create`
- `app/api/search/route.ts`
  - authenticated user
  - organization scoping via backend search helper
- `app/api/storage/documents/[documentId]/route.ts`
  - authenticated user
  - same-organization resource access
- `app/api/storage/avatars/[profileId]/route.ts`
  - authenticated user
  - same-organization profile access
- `app/api/scoring/wallet/route.ts`
  - authenticated user
- `app/api/scoring/rewards/route.ts`
  - authenticated user
- `app/api/scoring/redeem/route.ts`
  - authenticated user
- `app/api/scoring/leaderboard/route.ts`
  - authenticated user
- `app/api/scoring/activity/route.ts`
  - authenticated user
- `app/api/cron/followup-reminders/route.ts`
  - cron secret, not user session auth

## Dashboard Modules Requiring Role Or Permission Filters
- Team dashboard modules depend on `team.view` and related team action permissions.
- Reporting modules depend on `reports.view` and `reports.export`.
- Subscription modules depend on `subscription.view` and `subscription.manage`.
- Scoring modules depend on `scoring.view`, `scoring.manage`, `rewards.manage`, and `leaderboard.view`.
- CRM list/detail surfaces are organization-scoped and typically rely on view/create/update/archive permission families.

## Data Ownership Rules
- Most business data is organization-scoped through `organization_id`.
- Inactive users (`profiles.is_active = false`) must not access protected areas.
- Super admins (`profiles.is_super_admin = true`) retain wildcard access.
- Route handlers for private files enforce same-organization access before reading files.
- Team membership, role assignment, and permission evaluation are organization-specific.
- Current scoring/history endpoints still rely on downstream organization checks inside feature helpers.

## Old Supabase RLS Assumptions
- SQL migrations under `supabase/migrations/` still contain `auth.users`, `auth.uid()`, `enable row level security`, and `security definer` assumptions.
- Some app error translations still mention row-level security or Supabase permissions:
  - `lib/auth/errors.ts`
  - `lib/crm/document-actions.ts`
  - `lib/profile/profile-actions.ts`
- Remaining Supabase runtime auth/authorization remnants:
  - `app/(auth)/auth/callback/route.ts`
  - `lib/team/invite-email.ts`
  - `lib/team/team-actions.ts`
  - Supabase fallback branches in auth UI components kept for rollback safety

## Migration Outcome In This Prompt
- Central permission helpers are now defined in `lib/permissions.ts`.
- Runtime session/profile/permission helpers now use Better Auth + Prisma in:
  - `lib/auth/session.ts`
  - `lib/current-user.ts`
  - `lib/auth/middleware.ts`
- Sensitive search and scoring route handlers now perform explicit top-level auth checks before executing backend work.
- Profile role display lookup now comes from Prisma instead of Supabase.

## Remaining Risks
- Invite acceptance and Supabase callback flow still keep Supabase-era identity assumptions alive.
- Team action modules and many CRM/scoring modules still use Supabase for data access, even when authorization now starts from the own backend path.
- SQL-layer RLS and `auth.users` references still exist in migrations and database-side logic, so Supabase cannot be removed yet.
