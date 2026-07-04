#!/usr/bin/env bash
set -euo pipefail

# Daily Postgres backup for production Docker Compose deployment.
# Run from /opt/calorie-tracker with .env present.
#
# Optional offsite upload: set RCLONE_REMOTE (e.g. b2:calorie-tracker-backups)
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
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
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
  echo "Uploading to ${RCLONE_REMOTE}..."
  rclone copy "$FILEPATH" "${RCLONE_REMOTE}/"
fi

echo "Pruning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'calorie_tracker_*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete

echo "Done."
