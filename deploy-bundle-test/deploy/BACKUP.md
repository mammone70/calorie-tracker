# Database backup and restore

Production Postgres runs in Docker (`docker-compose.prod.yml`). Backups are plain SQL dumps compressed with gzip.

## Automated backups

1. Copy systemd units to the host:

```bash
sudo cp deploy/systemd/calorie-tracker-backup.service /etc/systemd/system/
sudo cp deploy/systemd/calorie-tracker-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now calorie-tracker-backup.timer
```

2. Optional offsite upload — install [rclone](https://rclone.org/) and configure a remote (Backblaze B2, S3, etc.), then add to `/opt/calorie-tracker/.env`:

```bash
RCLONE_REMOTE=b2:your-bucket-name
BACKUP_DIR=/opt/calorie-tracker/backups
BACKUP_RETENTION_DAYS=30
```

3. Run a manual backup:

```bash
cd /opt/calorie-tracker
chmod +x deploy/scripts/backup-db.sh
./deploy/scripts/backup-db.sh
```

Backups are written to `backups/calorie_tracker_YYYYMMDDTHHMMSSZ.sql.gz`.

## Restore from backup

Use this if the VPS fails or you need to recover data onto a new server.

### Prerequisites

- New or wiped VPS with Docker installed
- Repository deployed to `/opt/calorie-tracker`
- Restored `/opt/calorie-tracker/.env` (same Postgres credentials as when backup was taken, or update `POSTGRES_*` and `DATABASE_URL` consistently)
- Backup file available locally on the VPS (or download from offsite first)

### Steps

1. **Start Postgres only**

```bash
cd /opt/calorie-tracker
docker compose -f docker-compose.prod.yml up -d postgres
```

Wait until healthy:

```bash
docker compose -f docker-compose.prod.yml ps postgres
```

2. **Restore the dump**

Replace `backups/calorie_tracker_....sql.gz` with your backup file:

```bash
gunzip -c backups/calorie_tracker_YYYYMMDDTHHMMSSZ.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

If restoring to a fresh database, drop and recreate first:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"
```

Then run the `gunzip -c ... | psql` command again.

3. **Start the full stack**

```bash
docker compose -f docker-compose.prod.yml up -d
```

4. **Verify**

- Open your site in a browser and sign in
- Check API health: `curl -s https://your.domain.com/api/health`

## Offsite restore

If backups are on Backblaze B2 / S3 via rclone:

```bash
mkdir -p /opt/calorie-tracker/backups
rclone copy b2:your-bucket-name/calorie_tracker_YYYYMMDDTHHMMSSZ.sql.gz /opt/calorie-tracker/backups/
```

Then follow the restore steps above.

## Testing backups (recommended monthly)

1. Run `./deploy/scripts/backup-db.sh`
2. Confirm the file is non-empty: `ls -lh backups/`
3. Optionally restore into a temporary local Postgres to validate the dump opens cleanly
