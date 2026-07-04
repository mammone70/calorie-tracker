#!/usr/bin/env node
/**
 * Import exported user data into the current database.
 * The target user must already exist (same email). Password is unchanged.
 *
 * Usage:
 *   node scripts/import-user-data.js export.json mammone@gmail.com [--replace]
 *
 * --replace  Delete existing data for this user before import (recommended).
 */
const fs = require('fs');
const { createSql } = require('./lib/db-env');

const INSERT_ORDER = [
  'foods',
  'weekly_meals',
  'weekly_macro_targets',
  'macro_targets',
  'weekly_meal_plan_entries',
  'day_meals',
  'meal_plan_entries',
  'daily_log_materializations',
  'food_log_entries',
];

const DELETE_ORDER = [...INSERT_ORDER].reverse();

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const replace = argv.includes('--replace');
  const inputPath = positional[2];
  const email = positional[3];
  return { inputPath, email, replace };
}

function rowValues(row, userId) {
  return { ...row, user_id: userId };
}

async function deleteUserData(sql, userId) {
  for (const table of DELETE_ORDER) {
    const deleted = await sql.unsafe(
      `DELETE FROM ${table} WHERE user_id = $1 RETURNING id`,
      [userId],
    );
    console.error(`Deleted ${deleted.length} rows from ${table}`);
  }
}

async function insertRows(sql, table, rows, userId) {
  if (rows.length === 0) return;

  for (const row of rows) {
    const data = rowValues(row, userId);
    const columns = Object.keys(data);
    await sql.unsafe(
      `INSERT INTO ${table} (${columns.map((col) => `"${col}"`).join(', ')})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
       ON CONFLICT (id) DO NOTHING`,
      Object.values(data),
    );
  }

  console.error(`Imported ${rows.length} rows into ${table}`);
}

async function main() {
  const { inputPath, email, replace } = parseArgs(process.argv);

  if (!inputPath || !email) {
    console.error(
      'Usage: node scripts/import-user-data.js <export.json> <email> [--replace]',
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const normalizedEmail = email.toLowerCase();

  if (payload.email && payload.email.toLowerCase() !== normalizedEmail) {
    console.error(
      `Export email (${payload.email}) does not match target email (${normalizedEmail})`,
    );
    process.exit(1);
  }

  const sql = createSql();

  try {
    const users = await sql`
      SELECT id, email FROM users WHERE email = ${normalizedEmail} LIMIT 1
    `;

    if (users.length === 0) {
      console.error(
        `No user found in target database: ${normalizedEmail}. Create the account first with create-user.js`,
      );
      process.exit(1);
    }

    const targetUserId = users[0].id;
    console.error(`Importing into ${normalizedEmail} (${targetUserId})`);

    if (replace) {
      await deleteUserData(sql, targetUserId);
    }

    for (const table of INSERT_ORDER) {
      const rows = payload.tables?.[table] ?? [];
      await insertRows(sql, table, rows, targetUserId);
    }

    console.error('Import completed successfully');
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
