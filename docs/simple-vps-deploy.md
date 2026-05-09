# Simple VPS Deploy

This guide is for deploying this existing Next.js CRM to a CyberPanel/OpenLiteSpeed VPS with:

- Domain: `crm.mugnee.com`
- App path: `/home/crm.mugnee.com/app`
- Runtime: Node.js
- Process manager: `PM2`
- App port: `3001`
- Reverse proxy target: `http://127.0.0.1:3001`

## Before you start

- Do not copy `.env.local` to the server.
- Do not put real secrets into committed files.
- Do not expose `DATABASE_URL` with any `NEXT_PUBLIC_` variable.
- Keep `.env.production.example` as placeholders only.
- Keep any remaining Supabase migration code unless you fully finish that migration later.

## 1. Confirm the local project is ready

Run these locally:

```bash
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

This project already has these main scripts:

```bash
npm run build
npm run start
npm run lint
npm run typecheck
```

## 2. Create a clean ZIP on your computer

From the project root, create a ZIP that excludes `node_modules`, `.next`, and `.env.local`.

PowerShell example:

```powershell
$staging = "deploy-package"
Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging | Out-Null
robocopy . $staging /MIR /XD node_modules .next .git .vscode $staging /XF .env.local *.log
Compress-Archive -Path "$staging\\*" -DestinationPath "crm-next.zip" -Force
Remove-Item -Recurse -Force $staging
```

Upload `crm-next.zip` to:

```bash
/home/crm.mugnee.com/
```

## 3. SSH into the VPS and prepare the app folder

```bash
cd /home/crm.mugnee.com
rm -rf app_backup
if [ -d app ]; then mv app app_backup; fi
mkdir -p app
unzip -o crm-next.zip -d app
cd app
```

## 4. Create the production env file manually

Do not copy `.env.local`.

```bash
cp .env.production.example .env.production
nano .env.production
```

Set real production values manually inside `.env.production`.

Minimum values:

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://crm.mugnee.com
DATABASE_URL=postgresql://crm_app:YOUR_DB_PASSWORD@127.0.0.1:5432/crm?schema=public
BETTER_AUTH_SECRET=YOUR_LONG_RANDOM_SECRET
BETTER_AUTH_URL=https://crm.mugnee.com
AUTH_SECRET=YOUR_LONG_RANDOM_SECRET
NEXTAUTH_URL=https://crm.mugnee.com
AUTH_PROVIDER=betterauth
NEXT_PUBLIC_AUTH_PROVIDER=betterauth
UPLOAD_DIR=/home/crm.mugnee.com/app/public/uploads
PRIVATE_UPLOAD_DIR=/home/crm.mugnee.com/app/storage/private
TEMP_UPLOAD_DIR=/home/crm.mugnee.com/app/storage/tmp
PUBLIC_UPLOAD_BASE_URL=https://crm.mugnee.com
MAX_UPLOAD_SIZE_MB=25
CRON_SECRET=YOUR_RANDOM_CRON_SECRET
```

Optional:

```bash
SUPABASE_SOURCE_DATABASE_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
REMINDER_EMAIL_ENABLED=false
```

## 5. Create required storage folders

```bash
mkdir -p /home/crm.mugnee.com/app/public/uploads
mkdir -p /home/crm.mugnee.com/app/storage/private
mkdir -p /home/crm.mugnee.com/app/storage/tmp
```

## 6. Install packages

```bash
cd /home/crm.mugnee.com/app
npm install
```

## 7. Generate Prisma client

```bash
npx prisma generate
```

## 8. Apply database schema

Preferred for this repo:

```bash
npx prisma migrate deploy
```

Only if you are intentionally skipping migrations on a fresh non-critical setup:

```bash
npx prisma db push
```

Use only one of those commands, not both.

## 9. Build the app

```bash
npm run build
```

Optional extra checks:

```bash
npm run typecheck
npm run lint
```

## 10. Start with PM2

Install PM2 once if needed:

```bash
npm install -g pm2
```

Start the app:

```bash
cd /home/crm.mugnee.com/app
pm2 start ecosystem.config.cjs
pm2 save
```

Useful PM2 commands:

```bash
pm2 status
pm2 logs crm-next --lines 100
pm2 restart crm-next
pm2 stop crm-next
```

## 11. Check the app directly on the VPS

```bash
curl http://127.0.0.1:3001
```

If the app is healthy, you should get HTML back instead of a connection error.

## 12. OpenLiteSpeed reverse proxy

In CyberPanel/OpenLiteSpeed, point the domain to this local app:

```text
http://127.0.0.1:3001
```

At a high level, the reverse proxy target should be:

- Domain: `crm.mugnee.com`
- Backend: `127.0.0.1`
- Port: `3001`

After saving the reverse proxy rule, restart or reload OpenLiteSpeed from CyberPanel.

## 13. Quick update deploy later

For your next deploy:

```bash
cd /home/crm.mugnee.com/app
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart crm-next
curl http://127.0.0.1:3001
```

## 14. Rollback commands

If the new deploy fails and you still have the previous folder in `app_backup`:

```bash
cd /home/crm.mugnee.com
pm2 stop crm-next
rm -rf app
mv app_backup app
cd app
pm2 start ecosystem.config.cjs
pm2 save
curl http://127.0.0.1:3001
```

If the problem is only the new process state:

```bash
pm2 logs crm-next --lines 100
pm2 restart crm-next
```

## 15. Beginner safety reminders

- Never commit the real `.env.production`.
- Never rename `.env.local` into production.
- Never expose `DATABASE_URL` to the browser.
- Always test `curl http://127.0.0.1:3001` before blaming OpenLiteSpeed.
- If the build fails on the server, stop and fix that first before touching the reverse proxy.
