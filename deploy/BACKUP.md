# Database backup and restore

Production Postgres runs in Docker (`docker-compose.prod.yml`). Backups are plain SQL dumps compressed with gzip.

**Policy (defaults):**

| Setting | Default | Env var |
|---------|---------|---------|
| Frequency | Daily 03:00 UTC | systemd timer |
| Local retention | 7 days | `BACKUP_RETENTION_DAYS` |
| Offsite retention | 14 days | `BACKUP_OFFSITE_RETENTION_DAYS` |
| Offsite | Google Drive via rclone (optional) | `RCLONE_REMOTE` |

## Automated backups

### 1. Enable the systemd timer

Ensure `deploy` owns the backup directory (earlier `sudo` runs may leave it owned by root):

```bash
sudo mkdir -p /opt/calorie-tracker/backups
sudo chown -R deploy:deploy /opt/calorie-tracker/backups
```

Install/reload the units from `/opt/calorie-tracker`:

```bash
sudo cp deploy/systemd/calorie-tracker-backup.service /etc/systemd/system/
sudo cp deploy/systemd/calorie-tracker-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now calorie-tracker-backup.timer
systemctl list-timers | grep calorie
```

### 2. Optional offsite upload (Google Drive)

Install [rclone](https://rclone.org/) on the VPS, then create a remote dedicated to backups (do not sync your whole Drive).

Configure rclone **as the `deploy` user** (the backup timer and smoke tests run as `deploy`, which is already in the `docker` group):

```bash
# Install rclone (example for Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y rclone

# If you already configured rclone as another user, copy it:
#   sudo mkdir -p /home/deploy/.config/rclone
#   sudo cp ~/.config/rclone/rclone.conf /home/deploy/.config/rclone/rclone.conf
#   sudo chown -R deploy:deploy /home/deploy/.config/rclone
#   sudo chmod 600 /home/deploy/.config/rclone/rclone.conf

sudo -u deploy -H rclone config
# n) New remote
# name> gdrive
# Storage> drive  (Google Drive)
# scope> drive.file  (access only files rclone creates — recommended)
# Follow prompts; for headless VPS use `rclone authorize "drive"` on a machine with a browser
# Configure as a team drive? No
# Keep this "gdrive" remote? Yes
```

Verify as `deploy`:

```bash
sudo -u deploy -H rclone lsd gdrive:
```

Add to `/opt/calorie-tracker/.env`:

```bash
BACKUP_DIR=/opt/calorie-tracker/backups
BACKUP_RETENTION_DAYS=7
BACKUP_OFFSITE_RETENTION_DAYS=14
RCLONE_REMOTE=gdrive:calorie-tracker-backups
```

Create a folder in Google Drive named `calorie-tracker-backups` (or let the first upload create it under that path).

Do **not** run the backup script with `sudo` — that switches to root and ignores `deploy`’s rclone config.

**Alternative:** Backblaze B2 / S3 works the same way — set `RCLONE_REMOTE=b2:your-bucket-name` after configuring that rclone remote. No script changes required.

### 3. Smoke test

Run as `deploy` (no sudo):

```bash
sudo -u deploy -H bash -lc 'cd /opt/calorie-tracker && ./deploy/scripts/backup-db.sh'
sudo -u deploy -H bash -lc 'ls -lh /opt/calorie-tracker/backups/'
sudo -u deploy -H rclone ls gdrive:calorie-tracker-backups
```

If you SSH in as `deploy` already:

```bash
cd /opt/calorie-tracker
./deploy/scripts/backup-db.sh
ls -lh backups/
rclone ls gdrive:calorie-tracker-backups
```

Backups are written to `backups/calorie_tracker_YYYYMMDDTHHMMSSZ.sql.gz`. After upload, the script deletes offsite dumps older than `BACKUP_OFFSITE_RETENTION_DAYS` and local dumps older than `BACKUP_RETENTION_DAYS`.

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

If backups are on Google Drive (or B2/S3) via rclone:

```bash
mkdir -p /opt/calorie-tracker/backups
rclone copy gdrive:calorie-tracker-backups/calorie_tracker_YYYYMMDDTHHMMSSZ.sql.gz \
  /opt/calorie-tracker/backups/
```

Then follow the restore steps above.

## Testing backups (recommended quarterly)

1. Run `./deploy/scripts/backup-db.sh`
2. Confirm the file is non-empty: `ls -lh backups/`
3. Confirm offsite copy exists: `rclone ls gdrive:calorie-tracker-backups`
4. Optionally restore into a temporary local Postgres to validate the dump opens cleanly

## VPS enablement checklist

Use this once on production after deploying these scripts:

- [ ] Copy and enable `calorie-tracker-backup.timer` (section 1) — service runs as `deploy`
- [ ] Configure rclone as `deploy` (or copy config into `/home/deploy/.config/rclone/`)
- [ ] Set `BACKUP_*` and `RCLONE_REMOTE` in `/opt/calorie-tracker/.env`
- [ ] Smoke-test as `deploy` (no sudo) (section 3)
- [ ] Confirm `systemctl list-timers` shows the next backup run
