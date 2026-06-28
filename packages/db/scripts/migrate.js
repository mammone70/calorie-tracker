#!/usr/bin/env node
/**
 * Apply SQL migrations manually when drizzle-kit migrate is unavailable.
 */
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Load monorepo root .env (packages/db/scripts -> ../../../.env)
loadEnvFile(path.join(__dirname, '../../../.env'));
loadEnvFile(path.join(__dirname, '../../../apps/api/.env'));

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://calorie:calorie@localhost:5432/calorie_tracker';

async function main() {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });
  const migrationPath = path.join(__dirname, '../drizzle/0000_initial.sql');

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const migration = fs.readFileSync(migrationPath, 'utf8');

  try {
    await sql.unsafe(migration);
    console.log('Migration applied successfully');
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || String(err.message).includes('ECONNREFUSED')) {
      console.error(`
Database connection refused at: ${connectionString.replace(/:[^:@]+@/, ':****@')}

Postgres is not running or not reachable. Start it with:

  cd <project-root>
  docker compose up -d

Wait a few seconds, then verify:

  docker compose ps

You should see calorie-tracker-db as "healthy". Then run:

  pnpm db:migrate
`);
      process.exit(1);
    }
    throw err;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
