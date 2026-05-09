# Client CRM

Client CRM is a production-oriented SaaS sales workspace platform built with **Next.js App Router** and **PostgreSQL + Prisma**.

It helps teams manage leads, meetings, follow-ups, documents, team collaboration, and internal rewards/workflow scoring from one interface.  
The app is designed for **workspaces / organizations** with role-based access, notification flow, and subscription-aware limits.

---

## What this project does

- Manage company and contact intelligence in one pipeline-first CRM workspace
- Track meetings, follow-ups, and activities with clear status/priority/risk signals
- Route support/help requests across teams and keep everything tenant-safe
- Handle document upload, storage, and traceability across company interactions
- Run a scoring and rewards system for productivity/engagement with wallets, badges, and rewards
- Provide team and workspace administration with roles, permissions, and invitations
- Offer analytics, charts, and leaderboard views for performance visibility
- Provide global search and activity notifications
- Include secure auth with migration-friendly architecture (Better Auth + NextAuth compatibility layer)

---

## Features (High-level)

### 1) CRM Sales Flow
- **Companies / Contacts**
  - Create, filter, and manage prospects
  - Assign ownership and team members
  - Track lead temperatures, stages, source, priority, expected closing
- **Pipeline**
  - Visual stage board with drag-drop style workflow updates
  - Stage history and activity logging
- **Meetings (Interactions)**
  - Schedule and log interactions with companies
  - Meeting-oriented follow-ups and visibility
- **Follow-ups**
  - Create, prioritize, and complete follow-up tasks
  - Alert and reminder flow for overdue items

### 2) Collaboration & Operations
- Team structure and role-based permissions
- Invite workflow (request, send, accept, revoke, resend)
- Workspace creation and workspace switching
- Help desk-style need-help tickets with assignment/resolution lifecycle
- Team performance tracking and profile management

### 3) Documents & Storage
- Upload and organize documents per company/contact/interaction/follow-up
- Document metadata and download auditing
- Local file layout helpers for non-cloud environments

### 4) Smart Engagement Layer
- Scoring engine for activities and workflow events
- Wallet-like transaction and rewards model
- Leaderboards and user rewards catalog
- Badge and streak support for progress gamification

### 5) Reporting & Analytics
- Sales dashboard with KPIs
- Pipeline and performance charts
- Reports for company, team, rewards, and scoring trends
- Search endpoints and grouped result views for rapid operations

### 6) Platform & Hardening
- Multi-organization (tenant-aware) data model
- Subscription model with usage checks (users, storage, file size, feature flags)
- Notification center (unread/read and actions)
- Health and cron endpoints for scheduled jobs

---

## Tech Stack

- **Framework:** Next.js 16.2.4 (App Router), React 19
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Better Auth + NextAuth bridge layer (can operate in migration-ready provider mode)
- **Styling:** Tailwind CSS
- **UI primitives:** Radix UI + custom component system
- **Charts:** Recharts
- **Background / Jobs / Integrations:** Node scripts + cron endpoint model
- **Email:** Nodemailer support for OTP/invite/notifications where enabled

---

## Folder map (quick orientation)

- `app/` – route handlers and app pages
- `components/` – UI and domain components
- `lib/` – business logic, queries/actions, auth, notifications, storage, reporting, scoring
- `prisma/` – Prisma schema and migration files
- `scripts/` – migration checks, parity checks, baseline + reconciliation scripts
- `docs/` – migration, deployment, testing, and rollout notes
- `public/` – static assets
- `supabase/` – legacy migration folder retained for historical/context migration references

---

## Getting Started

### Prerequisites

- Node.js 18+  
- PostgreSQL 13+
- pnpm/npm/yarn (project uses npm scripts)

### 1) Clone and install

```bash
git clone https://github.com/ankur-datta-official/client-crm.git
cd client-crm
npm install
```

### 2) Environment

Create `.env.local` (or copy from examples):

```bash
cp .env.example .env.local
```

Then set at least:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `AUTH_PROVIDER=betterauth` (default auth mode used in current release)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_AUTH_PROVIDER`
- Upload settings (`UPLOAD_DIR`, `PRIVATE_UPLOAD_DIR`, `TEMP_UPLOAD_DIR`, `PUBLIC_UPLOAD_BASE_URL`)
- Optional email/cron variables: `SMTP_*`, `CRON_SECRET`, `REMINDER_EMAIL_ENABLED`

### 3) Database and Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

If you need schema status:

```bash
npm run prisma:migrate:status
```

### 4) Run dev server

```bash
npm run dev
```

Open:

- `http://localhost:3000/auth/login`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/companies`
- `http://localhost:3000/reports`

---

## Useful scripts

- `npm run dev` – start development server
- `npm run build` – production build
- `npm run start` – run built app
- `npm run lint` – lint code
- `npm run typecheck` – TypeScript type check
- `npm run prisma:generate` – generate Prisma client
- `npm run prisma:migrate` – run Prisma migration in dev mode
- `npm run prisma:migrate:status` – check migration status
- `npm run data:migrate:supabase` – migrate Supabase live data to current schema
- `npm run prisma:check-coverage` – validate Prisma migration schema coverage
- `npm run db:check-schema-parity` – verify schema parity against references
- `npm run db:repair-local-schema` – repair parity issues (with `--apply`)

---

## Security and access model

- Workspace/organization data is tenant scoped.
- Routes under authenticated area use server-session guarded layouts.
- Notifications, invitations, documents, team actions, and sensitive mutations are server-driven via guarded API/actions.
- Cron-related endpoints are protected using `CRON_SECRET`.
- Inactive users are blocked from normal operation flows.

---

## API highlights

This codebase includes structured route groups for:

- `/api/auth` – authentication handlers (including reset/forgot/register flows)
- `/api/scoring` – scoring and wallet operations
- `/api/search` – search APIs
- `/api/health` – health checks
- `/api/storage` – document/avatar upload helpers
- `/api/import` – company import tooling
- `/api/cron` – scheduled/background job triggers

---

## Docs and migration references

The repo includes operational docs for migration and verification:

- `SUPABASE_SETUP.md`
- `docs/full-postgres-migration-status.md`
- `docs/storage-migration.md`
- `docs/production-test-checklist.md`
- `docs/rollback-plan.md`

---

## Deployment notes

- Build checks to run before deploy:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- Set production environment values from `.env.production.example`
- Ensure database and auth base URLs align with your production domain
- Keep `DATABASE_URL` and secret keys out of version control and rotate periodically

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Keep changes scoped and maintain migration-safe patterns (especially schema or RBAC)
4. Run lint/typecheck/build before opening PR

---

## License

This project is currently proprietary/private unless stated otherwise in a future license file.

---

## Support

If you want a quick contributor-friendly onboarding package (Docker, seed data, deployment script templates, or GitHub Actions workflow), I can add a separate section next.
