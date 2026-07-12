#!/usr/bin/env bash
set -euo pipefail

# Daily Postgres backup for production Docker Compose deployment.
# Run from /opt/calorie-tracker with .env present.
#
# Optional offsite upload: set RCLONE_REMOTE (e.g. gdrive:calorie-tracker-backups)
# Requires rclone configured on the host: rclone config

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
OFFSITE_RETENTION_DAYS="${BACKUP_OFFSITE_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILENAME="calorie_tracker_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "Creating backup ${FILEPATH}..."

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl \
  | gzip -9 > "$FILEPATH"

if [[ ! -s "$FILEPATH" ]]; then
  echo "Backup failed: file is empty" >&2
  exit 1
fi

echo "Backup created ($(du -h "$FILEPATH" | cut -f1))"

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "RCLONE_REMOTE is set but rclone is not installed" >&2
    exit 1
  fi

  # Prefer running as deploy (systemd User=deploy). sudo/root needs its own rclone config.
  if [[ -n "${RCLONE_CONFIG:-}" ]]; then
    export RCLONE_CONFIG
    if [[ ! -f "$RCLONE_CONFIG" ]]; then
      echo "RCLONE_CONFIG file not found: ${RCLONE_CONFIG}" >&2
      exit 1
    fi
  elif [[ "$(id -u)" -eq 0 ]]; then
    echo "Running as root, but rclone is usually configured for the deploy user." >&2
    echo "Re-run without sudo, e.g.:" >&2
    echo "  sudo -u deploy -H bash -lc 'cd /opt/calorie-tracker && ./deploy/scripts/backup-db.sh'" >&2
    exit 1
  fi

  echo "Uploading to ${RCLONE_REMOTE}..."
  rclone copy "$FILEPATH" "${RCLONE_REMOTE}/"

  echo "Pruning offsite backups older than ${OFFSITE_RETENTION_DAYS} days..."
  # Include directory so --min-age applies to files inside the remote path.
  rclone delete "${RCLONE_REMOTE}/" \
    --include 'calorie_tracker_*.sql.gz' \
    --min-age "${OFFSITE_RETENTION_DAYS}d"
fi

echo "Pruning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'calorie_tracker_*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete

echo "Done."
