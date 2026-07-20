#!/usr/bin/env node
/**
 * Import exercise/workout export into the current database.
 * Does not touch foods, meal plans, or food logs.
 *
 * Usage:
 *   node scripts/import-exercises.js export.json mammone@gmail.com [--replace]
 *
 * --replace  Clear this user's workout data (and personal exercises) first.
 *            Global exercises are never deleted.
 */
const fs = require('fs');
const { createSql } = require('./lib/db-env');

const INSERT_ORDER = [
  'exercises',
  'workout_templates',
  'workout_template_exercises',
  'day_workout_sessions',
  'day_workout_exercises',
  'workout_set_logs',
  'daily_workout_materializations',
];

const DELETE_ORDER = [
  'workout_set_logs',
  'day_workout_exercises',
  'daily_workout_materializations',
  'day_workout_sessions',
  'workout_template_exercises',
  'workout_templates',
];

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

async function deleteWorkoutData(sql, userId) {
  for (const table of DELETE_ORDER) {
    const deleted = await sql.unsafe(
      `DELETE FROM ${table} WHERE user_id = $1 RETURNING id`,
      [userId],
    );
    console.error(`Deleted ${deleted.length} rows from ${table}`);
  }

  const deletedExercises = await sql`
    DELETE FROM exercises
    WHERE user_id = ${userId}
      AND is_global = false
    RETURNING id
  `;
  console.error(`Deleted ${deletedExercises.length} personal exercises`);
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

async function insertExercises(sql, rows, targetUserId) {
  if (rows.length === 0) return;

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const ownerId = row.is_global ? (row.user_id ?? targetUserId) : targetUserId;
    const ownerExists = await sql`
      SELECT id FROM users WHERE id = ${ownerId} LIMIT 1
    `;
    const userId = ownerExists.length > 0 ? ownerId : targetUserId;
    const data = { ...row, user_id: userId };
    const columns = Object.keys(data);

    try {
      const result = await sql.unsafe(
        `INSERT INTO exercises (${columns.map((col) => `"${col}"`).join(', ')})
         VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        Object.values(data),
      );
      if (result.length > 0) imported += 1;
      else skipped += 1;
    } catch (err) {
      if (err?.code === '23505' && row.is_global) {
        console.error(
          `Skipped global exercise "${row.name}" (name already exists with a different id)`,
        );
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  console.error(`Imported ${imported} exercises (${skipped} already present or skipped)`);
}

async function main() {
  const { inputPath, email, replace } = parseArgs(process.argv);

  if (!inputPath || !email) {
    console.error(
      'Usage: node scripts/import-exercises.js <export.json> <email> [--replace]',
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const normalizedEmail = email.toLowerCase();

  if (payload.kind && payload.kind !== 'exercises') {
    console.error(`Expected kind "exercises", got "${payload.kind}"`);
    process.exit(1);
  }

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
        `No user found in target database: ${normalizedEmail}. Create the account first.`,
      );
      process.exit(1);
    }

    const targetUserId = users[0].id;
    console.error(`Importing exercises into ${normalizedEmail} (${targetUserId})`);

    if (replace) {
      await deleteWorkoutData(sql, targetUserId);
    }

    for (const table of INSERT_ORDER) {
      const rows = payload.tables?.[table] ?? [];
      if (table === 'exercises') {
        await insertExercises(sql, rows, targetUserId);
      } else {
        await insertRows(sql, table, rows, targetUserId);
      }
    }

    console.error('Exercise import completed successfully');
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
