# Rollback Plan

## Git Rollback
- Keep the last known good branch or tag before deployment.
- To switch back quickly:
```bash
git checkout <last-known-good-branch-or-tag>
git pull --ff-only
```

## Database Restore
- Take a `pg_dump` backup before every production migration or schema change.
- Restore into a recovery database first:
```bash
createdb crm_restore
pg_restore -d crm_restore /var/backups/postgres/crm-YYYY-MM-DD-HHMMSS.dump
```
- Validate the restored data before replacing production.

## Env Rollback
- Keep a backup copy of the previous `.env.production`.
- If a new deploy fails, restore the old env file and restart PM2.

## PM2 Rollback
- Restart the previous app version after rolling back code and env:
```bash
pm2 restart saas-crm
pm2 logs saas-crm
```

## Nginx Rollback
- Keep the previous nginx site config backup.
- If needed:
```bash
sudo cp /etc/nginx/sites-available/saas-crm.bak /etc/nginx/sites-available/saas-crm
sudo nginx -t
sudo systemctl reload nginx
```

## Emergency Supabase Rollback Note
- The active runtime no longer depends on Supabase.
- If the own-backend rollout fails, deploy the last stable Supabase-backed branch or tag instead of trying to reintroduce Supabase into this branch.
- Keep PostgreSQL backups intact before any rollback that changes database shape.
