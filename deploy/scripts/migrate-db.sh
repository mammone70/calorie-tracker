#!/bin/sh
set -eu

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

if ! ls "$MIGRATIONS_DIR"/*.sql >/dev/null 2>&1; then
  echo "ERROR: no SQL migration files found in $MIGRATIONS_DIR"
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

applied_count="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM schema_migrations")"
if [ "$applied_count" = "0" ]; then
  users_exists="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 'false' ELSE 'true' END")"
  if [ "$users_exists" = "true" ]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('0000_initial.sql') ON CONFLICT DO NOTHING"
    echo "Marked 0000_initial.sql as already applied"
  fi
fi

for migration in "$MIGRATIONS_DIR"/*.sql; do
  filename="$(basename "$migration")"
  applied="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM schema_migrations WHERE filename = '$filename') THEN 'true' ELSE 'false' END")"

  if [ "$applied" = "true" ]; then
    echo "Skipping $filename (already applied)"
    continue
  fi

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('$filename')"
  echo "Applied $filename"
done

echo "Migrations applied successfully"
