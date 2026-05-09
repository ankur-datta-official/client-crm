# VPS Deployment Guide

## Readiness Summary
- PostgreSQL + Prisma deployment path is ready.
- Better Auth deployment path is ready.
- Local/VPS private storage deployment path is ready.
- Full Supabase removal is ready in the active runtime architecture.

## 1. Ubuntu Server Update
```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git ufw nginx
```

## 2. PostgreSQL Install
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

## 3. PostgreSQL Database And User Creation
```bash
sudo -u postgres psql
```

Inside `psql`:
```sql
create user crm_app with password 'replace-with-a-strong-password';
create database crm owner crm_app;
grant all privileges on database crm to crm_app;
\q
```

## 4. DATABASE_URL Setup
Example production value:
```bash
DATABASE_URL=postgresql://crm_app:replace-with-a-strong-password@127.0.0.1:5432/crm?schema=public
```

Keep `DATABASE_URL` server-only. Never create `NEXT_PUBLIC_DATABASE_URL`.

## 5. Project Upload Or Pull Method
Option A, clone directly on the server:
```bash
cd /var/www
git clone <your-repo-url> saas-crm
cd /var/www/saas-crm
```

Option B, update an existing checkout:
```bash
cd /var/www/saas-crm
git fetch --all
git checkout full-postgres-own-backend-migration
git pull --ff-only
```

## 6. Environment File Setup
Create `.env.production` from [`.env.production.example`](/c:/Users/Mugnee/Desktop/saas-crm/.env.production.example:1).

Minimum own-backend values:
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://crm.example.com
DATABASE_URL=postgresql://crm_app:replace-with-a-strong-password@127.0.0.1:5432/crm?schema=public
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=https://crm.example.com
UPLOAD_DIR=/var/www/saas-crm/public/uploads
PRIVATE_UPLOAD_DIR=/var/www/saas-crm/storage/private
TEMP_UPLOAD_DIR=/var/www/saas-crm/storage/tmp
PUBLIC_UPLOAD_BASE_URL=https://crm.example.com
MAX_UPLOAD_SIZE_MB=25
CRON_SECRET=replace-with-a-random-cron-secret
```

## 7. Package Install
This repo uses `npm`.
```bash
cd /var/www/saas-crm
npm install
```

## 8. Prisma Generate
```bash
npx prisma generate
```

## 9. Prisma Migrate Deploy
If you already have committed Prisma migrations:
```bash
npx prisma migrate deploy
```

If migration history is not finalized yet, stop and confirm the rollout plan before using `db push` in production.

## 10. Next.js Build
```bash
npm run lint
npm run typecheck
npm run build
```

## 11. PM2 Setup
Install PM2:
```bash
sudo npm install -g pm2
```

Start the app:
```bash
cd /var/www/saas-crm
PORT=3000 pm2 start npm --name saas-crm -- start
pm2 save
pm2 startup
```

## 12. Nginx Reverse Proxy
Create `/etc/nginx/sites-available/saas-crm`:
```nginx
server {
    listen 80;
    server_name crm.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/saas-crm /etc/nginx/sites-enabled/saas-crm
sudo nginx -t
sudo systemctl reload nginx
```

## 13. SSL With Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.example.com
sudo certbot renew --dry-run
```

## 14. Upload Folder Permissions
```bash
sudo mkdir -p /var/www/saas-crm/public/uploads
sudo mkdir -p /var/www/saas-crm/storage/private
sudo mkdir -p /var/www/saas-crm/storage/tmp
sudo chown -R www-data:www-data /var/www/saas-crm/public/uploads /var/www/saas-crm/storage
sudo chmod -R 750 /var/www/saas-crm/storage
sudo chmod -R 755 /var/www/saas-crm/public/uploads
```

Notes:
- Do not let nginx serve the private storage directory directly.
- Private files should only be accessed through authenticated Next.js routes.

## 15. Firewall Notes
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 16. Production Restart Command
```bash
cd /var/www/saas-crm
pm2 restart saas-crm
```

## 17. Log Checking Commands
```bash
pm2 logs saas-crm
pm2 status
sudo journalctl -u nginx -n 100 --no-pager
```

## 18. Rollback Deployment Notes
- Keep the previous branch or tag available.
- Keep the previous `.env.production` backup.
- Take a PostgreSQL backup before schema changes.
