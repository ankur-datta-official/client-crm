# PostgreSQL Backup And Restore

## 1. Manual Backup Using `pg_dump`
Create a compressed custom-format backup:
```bash
pg_dump -Fc -d "postgresql://crm_app:replace-with-a-strong-password@127.0.0.1:5432/crm" > /var/backups/postgres/crm-$(date +%F-%H%M%S).dump
```

Create the backup directory first if needed:
```bash
sudo mkdir -p /var/backups/postgres
sudo chown postgres:postgres /var/backups/postgres
```

## 2. Manual Restore
Restore into a fresh database:
```bash
createdb crm_restore
pg_restore -d crm_restore /var/backups/postgres/crm-2026-05-07-020000.dump
```

If you need a clean restore:
```bash
dropdb crm_restore
createdb crm_restore
pg_restore --clean --if-exists -d crm_restore /var/backups/postgres/crm-2026-05-07-020000.dump
```

Always restore into a recovery database first before overwriting production.

## 3. Daily Cron Backup
Open the postgres crontab:
```bash
sudo crontab -e
```

Example daily 2:00 AM backup:
```cron
0 2 * * * /usr/bin/pg_dump -Fc -d postgresql://crm_app:replace-with-a-strong-password@127.0.0.1:5432/crm > /var/backups/postgres/crm-$(date +\%F-\%H\%M\%S).dump
```

## 4. Backup Folder Structure
Recommended:
```text
/var/backups/postgres/
  crm-2026-05-07-020000.dump
  crm-2026-05-08-020000.dump
  crm-2026-05-09-020000.dump
```

## 5. Backup Retention Recommendation
- Keep at least 7 daily backups.
- Keep at least 4 weekly backups for longer rollback coverage.
- Keep at least 1 manual pre-deployment backup before every production schema change.

Example retention cleanup:
```cron
30 2 * * * /usr/bin/find /var/backups/postgres -name "crm-*.dump" -mtime +14 -delete
```

## 6. VPS Storage Warning
- PostgreSQL dump files can grow quickly.
- A small VPS disk can fill unexpectedly if backups are never rotated.
- Monitor free disk space regularly:
```bash
df -h
du -sh /var/backups/postgres
```

## 7. Off-Server Backup Recommendation
- Do not rely only on local VPS disk.
- Copy backups to another machine or cloud bucket regularly.
- Recommended options:
  - another secure VPS
  - S3-compatible object storage
  - encrypted backup sync to an external server

## 8. Restore Verification
After restore:
```bash
psql -d crm_restore -c "\dt"
psql -d crm_restore -c "select count(*) from profiles;"
```

Then run app-level checks against the restored database before trusting it for production rollback.
