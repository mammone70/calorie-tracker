#!/usr/bin/env node
/**
 * Update weekly meal times by meal index (default template: 08:00, 12:00, 16:00, 20:00).
 *
 * Usage: node scripts/update-meal-times.js [email]
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
    if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

loadEnvFile(path.join(__dirname, '../../../.env'));
loadEnvFile(path.join(__dirname, '../../../apps/api/.env'));

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://calorie:calorie@localhost:5432/calorie_tracker';

const USER_EMAIL = process.argv[2] ?? 'mammone@gmail.com';
const MEAL_TIMES = ['08:00', '12:00', '16:00', '20:00'];

async function main() {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });

  try {
    const [user] = await sql`
      SELECT id, email FROM users WHERE email = ${USER_EMAIL}
    `;

    if (!user) {
      console.error(`No user found with email ${USER_EMAIL}.`);
      process.exit(1);
    }

    const weeklyUpdated = await sql`
      UPDATE weekly_meals
      SET
        meal_time = CASE meal_index
          WHEN 0 THEN ${MEAL_TIMES[0]}
          WHEN 1 THEN ${MEAL_TIMES[1]}
          WHEN 2 THEN ${MEAL_TIMES[2]}
          WHEN 3 THEN ${MEAL_TIMES[3]}
          ELSE meal_time
        END,
        updated_at = now()
      WHERE user_id = ${user.id}
        AND deleted_at IS NULL
        AND meal_index BETWEEN 0 AND 3
      RETURNING id, day_of_week, meal_index, meal_time
    `;

    const dayUpdated = await sql`
      UPDATE day_meals
      SET
        meal_time = CASE meal_index
          WHEN 0 THEN ${MEAL_TIMES[0]}
          WHEN 1 THEN ${MEAL_TIMES[1]}
          WHEN 2 THEN ${MEAL_TIMES[2]}
          WHEN 3 THEN ${MEAL_TIMES[3]}
          ELSE meal_time
        END,
        updated_at = now()
      WHERE user_id = ${user.id}
        AND deleted_at IS NULL
        AND meal_index BETWEEN 0 AND 3
      RETURNING id, plan_date, meal_index, meal_time
    `;

    console.log(
      `Updated ${weeklyUpdated.length} weekly meal(s) and ${dayUpdated.length} day meal(s) for ${user.email}.`,
    );
    console.log(`Times: ${MEAL_TIMES.join(', ')}`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
