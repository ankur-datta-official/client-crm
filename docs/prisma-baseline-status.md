# Prisma Baseline Status

## Snapshot
- Date/time: 2026-05-09 +06:00
- Goal: prepare a safe Prisma migration baseline after the Supabase runtime removal

## Current Status
- Active app runtime is PostgreSQL + Prisma + Better Auth + own storage.
- `prisma/schema.prisma` now has conservative model coverage for all SQL tables created in `supabase/migrations/*.sql`.
- `prisma/migrations/20260509_initial_baseline/migration.sql` now exists as the first baseline migration artifact.
- The populated local PostgreSQL database has now been reconciled to the Prisma schema and the baseline migration has been marked as applied.
- `prisma migrate status` now reports `Database schema is up to date!`.

## Coverage Status
- Coverage checker result:
  - SQL tables discovered: `34`
  - Prisma mapped tables: `37`
  - Covered tables: `34`
  - Missing Prisma models: `0`
- Prisma validation result:
  - `npx prisma generate`: passed
  - `npx prisma validate`: passed

## Final Normalization Result
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: `No difference detected.`
- `npx prisma migrate resolve --applied 20260509_initial_baseline`: passed
- `npx prisma migrate status`: passed
- The final normalization pass aligned:
  - foreign-key names and actions
  - reconciled index names
  - `updated_at` defaults on the older core tables
  - remaining nullable-vs-required columns that were safe to tighten locally

## Local Drift Snapshot
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` is now clean.
- A local reconciliation script now exists:
  - `npm run prisma:reconcile-local:dry`
  - `npm run prisma:reconcile-local`
- A local normalization script now exists:
  - `npm run prisma:normalize-local:dry`
  - `npm run prisma:normalize-local`
- Reconciliation apply was run locally.
- Normalization apply was run locally.
- Main differences before reconciliation:
  - missing CRM/support/scoring tables in the current local database
  - incomplete `companies`, `documents`, and `profiles` shape compared with the expanded Prisma schema
- Safe interpretation:
  - the baseline migration is ready for a new database
  - the current populated local DB is now normalized enough to participate safely in the Prisma Migrate workflow

## Safe Current Workflow
- Keep using the runtime with the current PostgreSQL database.
- Use Prisma Migrate as the schema source of truth going forward.
- On a fresh VPS database, `prisma migrate deploy` is now the intended production workflow.
- On an already-reconciled database, the baseline is already marked applied.

## Coverage Checker
- Run:
```bash
npm run prisma:check-coverage
```

This checker compares:
- tables created in `supabase/migrations/*.sql`
- tables mapped in `prisma/schema.prisma`

It fails when SQL tables exist without a corresponding Prisma `@@map(...)` model.

## Next Safe Steps
1. Review the generated baseline SQL in `prisma/migrations/20260509_initial_baseline/migration.sql` one more time before first VPS deploy.
2. Use `npx prisma migrate deploy` on a fresh VPS database.
3. Keep future schema changes in new Prisma migrations instead of ad-hoc SQL drift.
4. Run `npx prisma migrate status` as part of deployment verification.
