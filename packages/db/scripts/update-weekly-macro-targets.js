#!/usr/bin/env node
/**
 * Upsert weekly macro targets for a user.
 *
 * Usage:
 *   node packages/db/scripts/update-weekly-macro-targets.js [email]
 */
const { randomUUID } = require('crypto');
const { createSql } = require('./lib/db-env');

const EMAIL = (process.argv[2] ?? 'mammone@gmail.com').toLowerCase();

/** 0 = Monday … 6 = Sunday */
const TARGETS = [
  { dayOfWeek: 0, label: 'Monday', calories: 3000, proteinG: 210, fatG: 70, carbsG: 385 },
  { dayOfWeek: 1, label: 'Tuesday', calories: 2350, proteinG: 210, fatG: 65, carbsG: 230 },
  { dayOfWeek: 2, label: 'Wednesday', calories: 2450, proteinG: 210, fatG: 70, carbsG: 245 },
  { dayOfWeek: 3, label: 'Thursday (Trail run)', calories: 2300, proteinG: 210, fatG: 65, carbsG: 218 },
  { dayOfWeek: 4, label: 'Friday', calories: 2850, proteinG: 210, fatG: 70, carbsG: 345 },
  { dayOfWeek: 5, label: 'Saturday', calories: 2700, proteinG: 210, fatG: 70, carbsG: 308 },
  { dayOfWeek: 6, label: 'Sunday', calories: 2300, proteinG: 210, fatG: 70, carbsG: 208 },
];

async function main() {
  const sql = createSql();

  try {
    const users = await sql`SELECT id FROM users WHERE email = ${EMAIL} LIMIT 1`;
    if (users.length === 0) {
      console.error(`User not found: ${EMAIL}`);
      process.exit(1);
    }

    const userId = users[0].id;
    const now = new Date();

    for (const target of TARGETS) {
      await sql`
        INSERT INTO weekly_macro_targets (
          id, user_id, day_of_week, calories, protein_g, fat_g, carbs_g, created_at, updated_at, deleted_at
        )
        VALUES (
          ${randomUUID()}, ${userId}, ${target.dayOfWeek}, ${target.calories},
          ${target.proteinG}, ${target.fatG}, ${target.carbsG}, ${now}, ${now}, NULL
        )
        ON CONFLICT (user_id, day_of_week)
        DO UPDATE SET
          calories = EXCLUDED.calories,
          protein_g = EXCLUDED.protein_g,
          fat_g = EXCLUDED.fat_g,
          carbs_g = EXCLUDED.carbs_g,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL
      `;
      console.log(
        `Updated ${target.label}: ${target.calories} kcal, ${target.proteinG}P / ${target.fatG}F / ${target.carbsG}C`,
      );
    }

    const rows = await sql`
      SELECT day_of_week, calories, protein_g, fat_g, carbs_g
      FROM weekly_macro_targets
      WHERE user_id = ${userId} AND deleted_at IS NULL
      ORDER BY day_of_week
    `;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    console.log('\nVerified:');
    for (const row of rows) {
      console.log(
        `  ${days[row.day_of_week]}: ${row.calories} cal, P ${row.protein_g} / F ${row.fat_g} / C ${row.carbs_g}`,
      );
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
