#!/usr/bin/env node
/**
 * Create a user account directly in the database (for invite-only production).
 *
 * Usage:
 *   node packages/db/scripts/create-user.js user@example.com 'secure-password'
 *   node packages/db/scripts/create-user.js --admin user@example.com 'secure-password'
 *
 * Requires DATABASE_URL in environment or .env at repo root.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const postgres = require('postgres');
const { randomUUID } = require('crypto');

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
  const args = process.argv.slice(2);
  const isAdmin = args[0] === '--admin';
  const email = isAdmin ? args[1] : args[0];
  const password = isAdmin ? args[2] : args[1];

  if (!email || !password) {
    console.error('Usage: node packages/db/scripts/create-user.js [--admin] <email> <password>');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://calorie:calorie@localhost:5432/calorie_tracker';

  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });
  const role = isAdmin ? 'admin' : 'client';

  try {
    const normalizedEmail = email.toLowerCase();
    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    if (existing.length > 0) {
      console.error(`User already exists: ${normalizedEmail}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = randomUUID();
    const now = new Date();

    await sql`
      INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
      VALUES (${id}, ${normalizedEmail}, ${passwordHash}, ${role}, ${now}, ${now})
    `;

    console.log(`Created ${role} user ${normalizedEmail} (${id})`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
