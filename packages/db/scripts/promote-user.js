#!/usr/bin/env node
/**
 * Promote an existing user to admin role.
 *
 * Usage:
 *   node packages/db/scripts/promote-user.js user@example.com
 *
 * Requires DATABASE_URL in environment or .env at repo root.
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

loadEnvFile(path.join(__dirname, '../../../.env'));
loadEnvFile(path.join(__dirname, '../../../apps/api/.env'));

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node packages/db/scripts/promote-user.js <email>');
    process.exit(1);
  }

  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://calorie:calorie@localhost:5432/calorie_tracker';

  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });

  try {
    const normalizedEmail = email.toLowerCase();
    const updated = await sql`
      UPDATE users
      SET role = 'admin', updated_at = now()
      WHERE email = ${normalizedEmail}
      RETURNING id, email, role
    `;

    if (updated.length === 0) {
      console.error(`User not found: ${normalizedEmail}`);
      process.exit(1);
    }

    console.log(`Promoted ${updated[0].email} to admin (${updated[0].id})`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
