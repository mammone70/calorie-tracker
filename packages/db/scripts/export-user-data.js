#!/usr/bin/env node
/**
 * Export all app data for one user (foods, plans, logs, targets, workouts).
 *
 * Usage:
 *   node scripts/export-user-data.js mammone@gmail.com [output.json]
 *
 * Exercises include the user's personal rows plus all global exercises
 * (so workout templates keep valid exercise_id foreign keys).
 */
const fs = require('fs');
const path = require('path');
const { createSql } = require('./lib/db-env');

/** Tables keyed only by user_id (simple SELECT … WHERE user_id = $1). */
const USER_TABLES = [
  'foods',
  'weekly_meals',
  'weekly_macro_targets',
  'macro_targets',
  'weekly_meal_plan_entries',
  'day_meals',
  'meal_plan_entries',
  'daily_log_materializations',
  'food_log_entries',
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
    path.join(process.cwd(), `user-export-${email?.replace(/[^a-z0-9.-]/gi, '_') ?? 'unknown'}.json`);

  if (!email) {
    console.error('Usage: node scripts/export-user-data.js <email> [output.json]');
    process.exit(1);
  }

  const sql = createSql();

  try {
    const normalizedEmail = email.toLowerCase();
    const users = await sql`
      SELECT id, email, created_at, updated_at
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    if (users.length === 0) {
      console.error(`No user found: ${normalizedEmail}`);
      process.exit(1);
    }

    const user = users[0];
    const data = {
      version: 2,
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

    for (const table of USER_TABLES) {
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
