#!/usr/bin/env node
/**
 * Populate weekday workout board from the Main Squat / Main DL / Main Bench spreadsheet.
 *
 * Usage:
 *   node scripts/seed-spreadsheet-workout.js <email>
 */
const { randomUUID } = require('crypto');
const { createSql } = require('./lib/db-env');

/** 0 = Monday … 6 = Sunday */
const PROGRAM = [
  {
    dayOfWeek: 0,
    name: 'Main Squat',
    exercises: [
      'LB Squat',
      '2-Mat Def DL',
      '4-Mat SLDL',
      'Pendlay Defs',
      'SL Ext',
      'Rev Hypers',
    ],
  },
  {
    dayOfWeek: 1,
    name: 'Conditioning',
    exercises: ['Trail Run'],
  },
  {
    dayOfWeek: 2,
    name: 'Press/Secondary Bench',
    exercises: [
      'Press',
      'Cambered Bench',
      'Incline DB Press',
      'Lats',
      'Delts',
      'Arms',
    ],
  },
  {
    dayOfWeek: 3,
    name: 'Conditioning',
    exercises: ['Trail Run'],
  },
  {
    dayOfWeek: 4,
    name: 'Main DL',
    exercises: [
      'DL- Stiff Bar',
      'Paused HBS',
      'Front Squats',
      'SL Press',
      'Rows',
      'SL Curl',
      'Abs',
    ],
  },
  {
    dayOfWeek: 5,
    name: 'Main Bench',
    exercises: [
      'Comp Bench',
      'POC Bench',
      'BNP',
      'Dips',
      'Chins',
      'Pecs',
      'Arms',
    ],
  },
  {
    dayOfWeek: 6,
    name: 'Rest',
    exercises: [],
  },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

async function ensureExercise(sql, userId, name, cache) {
  if (cache.has(name)) return cache.get(name);

  const existing = await sql`
    SELECT id FROM exercises
    WHERE deleted_at IS NULL
      AND lower(name) = ${name.toLowerCase()}
      AND (is_global = true OR user_id = ${userId})
    ORDER BY is_global ASC
    LIMIT 1
  `;
  if (existing.length > 0) {
    cache.set(name, existing[0].id);
    return existing[0].id;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO exercises (id, user_id, name, notes, is_global, created_at, updated_at, deleted_at)
    VALUES (${id}, ${userId}, ${name}, ${null}, ${false}, ${now}, ${now}, ${null})
  `;
  cache.set(name, id);
  console.error(`Created exercise: ${name}`);
  return id;
}

async function ensureWeekdayTemplates(sql, userId) {
  const existing = await sql`
    SELECT id, day_of_week, name
    FROM workout_templates
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND schedule_kind = 'weekday'
    ORDER BY day_of_week ASC, sort_index ASC
  `;

  const byDay = new Map();
  for (const row of existing) {
    if (row.day_of_week == null) continue;
    if (!byDay.has(row.day_of_week)) byDay.set(row.day_of_week, row);
  }

  const now = new Date().toISOString();
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    if (byDay.has(dayOfWeek)) continue;
    const id = randomUUID();
    const name = dayOfWeek === 6 ? 'Rest' : WEEKDAYS[dayOfWeek];
    await sql`
      INSERT INTO workout_templates (
        id, user_id, name, schedule_kind, day_of_week, interval_days, anchor_date,
        sort_index, is_active, created_at, updated_at, deleted_at
      ) VALUES (
        ${id}, ${userId}, ${name}, ${'weekday'}, ${dayOfWeek}, ${null}, ${null},
        ${dayOfWeek}, ${1}, ${now}, ${now}, ${null}
      )
    `;
    byDay.set(dayOfWeek, { id, day_of_week: dayOfWeek, name });
    console.error(`Created template for ${WEEKDAYS[dayOfWeek]}`);
  }

  return byDay;
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/seed-spreadsheet-workout.js <email>');
    process.exit(1);
  }

  const sql = createSql();
  try {
    const users = await sql`
      SELECT id, email FROM users WHERE email = ${email} LIMIT 1
    `;
    if (users.length === 0) {
      throw new Error(`User not found: ${email}`);
    }
    const userId = users[0].id;
    console.error(`Seeding workout for ${users[0].email}`);

    const byDay = await ensureWeekdayTemplates(sql, userId);
    const exerciseCache = new Map();
    const allNames = [
      ...new Set(PROGRAM.flatMap((day) => day.exercises)),
    ];
    for (const name of allNames) {
      await ensureExercise(sql, userId, name, exerciseCache);
    }

    const now = new Date().toISOString();

    for (const day of PROGRAM) {
      const template = byDay.get(day.dayOfWeek);
      if (!template) throw new Error(`Missing template for day ${day.dayOfWeek}`);

      await sql`
        UPDATE workout_templates
        SET name = ${day.name}, updated_at = ${now}
        WHERE id = ${template.id}
      `;
      console.error(`Named ${WEEKDAYS[day.dayOfWeek]} → ${day.name}`);

      // Soft-delete existing template exercises for this day (all weeks).
      await sql`
        UPDATE workout_template_exercises
        SET deleted_at = ${now}, updated_at = ${now}
        WHERE template_id = ${template.id}
          AND user_id = ${userId}
          AND deleted_at IS NULL
      `;

      for (let sortIndex = 0; sortIndex < day.exercises.length; sortIndex++) {
        const exerciseName = day.exercises[sortIndex];
        const exerciseId = exerciseCache.get(exerciseName);
        const id = randomUUID();
        await sql`
          INSERT INTO workout_template_exercises (
            id, user_id, template_id, exercise_id, body_part, week_index, sort_index,
            target_sets, reps_min, reps_max, target_weight, prescription_kind, prescription_value,
            created_at, updated_at, deleted_at
          ) VALUES (
            ${id}, ${userId}, ${template.id}, ${exerciseId}, ${null}, ${1}, ${sortIndex},
            ${null}, ${null}, ${null}, ${null}, ${'none'}, ${null},
            ${now}, ${now}, ${null}
          )
        `;
      }
      console.error(
        `  Added ${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}`,
      );
    }

    console.error('Done.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
