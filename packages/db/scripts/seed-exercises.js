#!/usr/bin/env node
/**
 * Seed global lifting exercises (visible to all users).
 * Usage: node scripts/seed-exercises.js [creatorEmail]
 *
 * creatorEmail is only used as created_by for new rows; exercises are is_global=true.
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

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://calorie:calorie@localhost:5432/calorie_tracker';

const USER_EMAIL = process.argv[2] ?? 'mammone@gmail.com';

const EXERCISES = [
  'Comp Squat',
  'Pause Squat',
  'High Bar Pause Squat',
  'Stiff Leg DL',
  'Pendlay Rows',
  'Reverse Hypers',
  'Walking Lunges',
  'SL Leg Exts',
  'Press',
  'BB Rows',
  'Hyperextension',
  'Dips',
  'Chin Ups',
  'DB Side Laterals',
  'Pec Dec Flyes',
  'Pec Dec Rear Delts',
  'Behind Neck Press',
  'Incline DB Press',
  'DB Rolls',
  'Incline DB Rolls',
  'Wide Grip Pull Downs',
  'Flyes',
  'Incline Flyes',
  'DB Curls',
  'Hammer Curls',
  'Incline Curls',
  'Deadlift',
  'Deficit DLs',
  'Front Squats',
  'Bulgarian Split Squats',
  'SL Leg Press',
  'Leg Press',
  'Hammer Rows',
  'Leg Curls',
  'SL Leg Curls',
  'Comp Bench Press',
  'Bench Press',
  'POC Bench',
  'DB Military Press',
  'Incline BB Press',
  'CG Bench',
  'CG Incline BB Press',
  'CG Steep Incline BB Press',
];

async function main() {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });

  try {
    const [user] = await sql`
      SELECT id, email FROM users WHERE email = ${USER_EMAIL}
    `;

    if (!user) {
      console.error(`No user found with email ${USER_EMAIL}. Register first, then re-run:`);
      console.error('  pnpm db:seed-exercises');
      process.exit(1);
    }

    const tables = await sql`
      SELECT to_regclass('public.exercises') AS exercises
    `;
    if (!tables[0]?.exercises) {
      console.error('exercises table missing. Run migrations first:');
      console.error('  pnpm db:migrate');
      process.exit(1);
    }

    const cols = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'exercises' AND column_name = 'is_global'
    `;
    if (cols.length === 0) {
      console.error('is_global column missing. Run migrations first:');
      console.error('  pnpm db:migrate');
      process.exit(1);
    }

    let inserted = 0;
    let promoted = 0;
    let skipped = 0;

    for (const name of EXERCISES) {
      const [globalExisting] = await sql`
        SELECT id FROM exercises
        WHERE is_global = true
          AND lower(name) = lower(${name})
          AND deleted_at IS NULL
      `;

      if (globalExisting) {
        skipped += 1;
        console.log(`Skipped (global exists): ${name}`);
        continue;
      }

      const [userExisting] = await sql`
        SELECT id FROM exercises
        WHERE is_global = false
          AND lower(name) = lower(${name})
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
      `;

      if (userExisting) {
        await sql`
          UPDATE exercises
          SET is_global = true, updated_at = now()
          WHERE id = ${userExisting.id}
        `;
        promoted += 1;
        console.log(`Promoted to global: ${name}`);
        continue;
      }

      await sql`
        INSERT INTO exercises (user_id, name, notes, is_global)
        VALUES (${user.id}, ${name}, NULL, true)
      `;
      inserted += 1;
      console.log(`Inserted (global): ${name}`);
    }

    console.log(
      `\nDone (creator ${user.email}): ${inserted} inserted, ${promoted} promoted to global, ${skipped} already global (${EXERCISES.length} total).`,
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
