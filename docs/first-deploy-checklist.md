# First Deploy Checklist

Use this as the exact order for the first safe VPS launch.

## 1. Local final check

Run locally before touching the server:

```bash
npm run lint
npm run typecheck
npm run build
```

## 2. DNS preparation

- Point `staging.crm.mugnee.com` to the VPS public IP.
- Point `crm.mugnee.com` to the VPS public IP only when staging is approved.

## 3. Secret generation

Generate strong secrets on your machine or server:

```bash
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
```

Use separate values for:
- `BETTER_AUTH_SECRET`
- `AUTH_SECRET`
- `CRON_SECRET`

## 4. Staging first

Server commands:

```bash
cd /var/www/saas-crm-staging
cp .env.staging.example .env.production
nano .env.production
npm install
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run typecheck
npm run build
pm2 start /var/www/saas-crm/ecosystem.config.cjs --only saas-crm-staging
pm2 save
```

Nginx:

```bash
sudo cp /var/www/saas-crm/config/nginx/saas-crm-staging.conf /etc/nginx/sites-available/saas-crm-staging
sudo ln -s /etc/nginx/sites-available/saas-crm-staging /etc/nginx/sites-enabled/saas-crm-staging
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d staging.crm.mugnee.com
```

Then run [STAGING_SMOKE_TEST.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/STAGING_SMOKE_TEST.md:1).

## 5. Production launch

Take a backup first:

```bash
mkdir -p ~/backups
pg_dump -Fc -d "postgresql://crm_app:replace-with-strong-password@127.0.0.1:5432/crm" > ~/backups/crm-$(date +%F-%H%M%S).dump
```

Deploy:

```bash
cd /var/www/saas-crm
cp .env.production.example .env.production
nano .env.production
npm install
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run typecheck
npm run build
pm2 start /var/www/saas-crm/ecosystem.config.cjs --only saas-crm
pm2 save
```

Nginx:

```bash
sudo cp /var/www/saas-crm/config/nginx/saas-crm.conf /etc/nginx/sites-available/saas-crm
sudo ln -s /etc/nginx/sites-available/saas-crm /etc/nginx/sites-enabled/saas-crm
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d crm.mugnee.com
sudo certbot renew --dry-run
```

Then run [production-test-checklist.md](/c:/Users/Mugnee/Desktop/saas-crm/docs/production-test-checklist.md:1).

## 6. Post-launch log check

```bash
pm2 status
pm2 logs saas-crm --lines 100
pm2 logs saas-crm-staging --lines 100
sudo journalctl -u nginx -n 100 --no-pager
```

## 7. Safety reminders

- Do not copy secrets from `.env.local`.
- Keep staging and production databases separate.
- Do not expose `storage/private` through Nginx.
- If production fails after release, rollback code and env first, then restart PM2, then reload Nginx.
