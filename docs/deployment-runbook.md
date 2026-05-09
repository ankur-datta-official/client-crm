# Deployment Runbook

This runbook turns the CRM into a staged Ubuntu deployment first, then promotes it to `crm.mugnee.com`.

## 1. Local release gate

Run all checks locally before uploading anything:

```bash
npm run lint
npm run typecheck
npm run build
```

If any command fails, stop and fix locally first.

## 2. Prepare staging on the server

- Create a separate checkout, for example `/var/www/saas-crm-staging`.
- Copy [`.env.staging.example`](/c:/Users/Mugnee/Desktop/saas-crm/.env.staging.example:1) to `.env.production` in the staging checkout.
- Use a separate PostgreSQL database such as `crm_staging`.
- Keep SMTP enabled if you want to verify OTP, invite, and reset-password flows before production.
- Use [config/nginx/saas-crm-staging.conf](/c:/Users/Mugnee/Desktop/saas-crm/config/nginx/saas-crm-staging.conf:1) for the staging site config.

## 3. Staging deploy commands

```bash
cd /var/www/saas-crm-staging
npm install
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run typecheck
npm run build
pm2 start /var/www/saas-crm/ecosystem.config.cjs --only saas-crm-staging
```

- Point staging Nginx to port `3001`.
- Run the checks from [STAGING_SMOKE_TEST.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/STAGING_SMOKE_TEST.md:1).

## 4. Production cutover

- Copy [`.env.production.example`](/c:/Users/Mugnee/Desktop/saas-crm/.env.production.example:1) to `.env.production`.
- Replace every placeholder and rotate any old local secrets before go-live.
- Take a PostgreSQL backup before the first production migration and before every later schema-affecting deploy.
- Use [config/nginx/saas-crm.conf](/c:/Users/Mugnee/Desktop/saas-crm/config/nginx/saas-crm.conf:1) for the production site config.

Production deploy:

```bash
cd /var/www/saas-crm
npm install
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run typecheck
npm run build
pm2 start /var/www/saas-crm/ecosystem.config.cjs --only saas-crm
```

- Point Nginx at port `3000`.
- Issue or renew SSL for `crm.mugnee.com`.
- Run [production-test-checklist.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/production-test-checklist.md:1).

## 5. Rollback essentials

- Keep the previous branch or tag ready.
- Keep the previous `.env.production` backup.
- Keep the previous Nginx site config backup.
- Restore code and env first, restart PM2, reload Nginx, and restore PostgreSQL only if data or schema integrity is affected.
