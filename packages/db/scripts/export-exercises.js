#!/usr/bin/env node
/**
 * Export exercise catalog + workout data for one user (no foods/meals/logs).
 *
 * Usage:
 *   node scripts/export-exercises.js mammone@gmail.com [output.json]
 */
const fs = require('fs');
const path = require('path');
const { createSql } = require('./lib/db-env');

const WORKOUT_TABLES = [
  'workout_templates',
  'workout_template_exercises',
  'day_workout_sessions',
  'day_workout_exercises',
  'workout_set_logs',
  'daily_workout_materializations',
];

async function main() {
  const email = process.argv[2];
  const outputPath =
    process.argv[3] ??
    path.join(
      process.cwd(),
      `exercises-export-${email?.replace(/[^a-z0-9.-]/gi, '_') ?? 'unknown'}.json`,
    );

  if (!email) {
    console.error('Usage: node scripts/export-exercises.js <email> [output.json]');
    process.exit(1);
  }

  const sql = createSql();

  try {
    const normalizedEmail = email.toLowerCase();
    const users = await sql`
      SELECT id, email FROM users WHERE email = ${normalizedEmail} LIMIT 1
    `;

    if (users.length === 0) {
      console.error(`No user found: ${normalizedEmail}`);
      process.exit(1);
    }

    const user = users[0];
    const data = {
      version: 1,
      kind: 'exercises',
      exportedAt: new Date().toISOString(),
      email: user.email,
      sourceUserId: user.id,
      tables: {},
    };

    const exercises = await sql`
      SELECT *
      FROM exercises
      WHERE user_id = ${user.id}
         OR is_global = true
      ORDER BY created_at
    `;
    data.tables.exercises = exercises;
    console.error(
      `Exported ${exercises.length} rows from exercises (personal + global catalog)`,
    );

    for (const table of WORKOUT_TABLES) {
      const rows = await sql.unsafe(
        `SELECT * FROM ${table} WHERE user_id = $1 ORDER BY created_at`,
        [user.id],
      );
      data.tables[table] = rows;
      console.error(`Exported ${rows.length} rows from ${table}`);
    }

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.error(`Wrote ${outputPath}`);
    console.log(outputPath);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
