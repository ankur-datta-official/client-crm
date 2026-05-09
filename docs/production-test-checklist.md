# Production Test Checklist

## Authentication
- Login works with the selected production auth provider.
- Logout clears the session correctly.
- Session persists across refresh and browser restart as expected.
- Protected routes redirect unauthenticated users to login.

## Authorization
- Admin access works for admin-only routes and actions.
- Manager or team access matches the expected permission set.
- Standard employee or user access cannot reach restricted areas.
- Unauthorized users are redirected to `/unauthorized` where expected.

## Core Product Data
- Create core CRM data successfully.
- Edit core CRM data successfully.
- Archive or delete core CRM data where supported.
- Dashboard data loads without server errors.
- Reports load successfully.

## Files
- Avatar upload works if storage is enabled.
- Avatar view works after upload.
- Document upload works if storage is enabled.
- Document inline view works.
- Document download works.

## Infrastructure
- `npm run build` passes on the server.
- Prisma connects successfully to PostgreSQL.
- PM2 restart succeeds.
- Nginx routes requests to the app correctly.
- SSL certificate is active and browser trust is valid.

## Backup And Recovery
- Manual `pg_dump` backup completes successfully.
- Restore test into a recovery database succeeds.
- Daily cron backup is installed and verified.

## Runtime Health
- PM2 logs show no auth or database crash loops.
- Nginx logs show no repeated proxy errors.
- File-serving routes return expected status codes for authorized and unauthorized users.
