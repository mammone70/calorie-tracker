#!/usr/bin/env node
/**
 * Seed common foods for a user from MyFitnessPal-style serving data.
 * Usage: node scripts/seed-foods.js [email]
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

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Derive per-100g nutrients from a logged serving; calories follow 4/4/9 rule. */
function per100gFromServing({ calories, protein, fat, carbs, grams }) {
  const scale = 100 / grams;
  const proteinPer100 = round1(protein * scale);
  const fatPer100 = round1(fat * scale);
  const carbsPer100 = round1(carbs * scale);
  const caloriesPer100 = Math.round(proteinPer100 * 4 + fatPer100 * 9 + carbsPer100 * 4);

  return {
    calories: caloriesPer100,
    protein: proteinPer100,
    fat: fatPer100,
    carbs: carbsPer100,
  };
}

/**
 * Common foods from MyFitnessPal logs (unique items).
 * Serving weights from the log; per-100g derived for gram-based logging.
 */
const FOODS = [
  {
    name: 'Sprouted Rolled Oats',
    brand: 'One Degree',
    externalId: 'seed-one-degree-oats',
    serving: { calories: 200, protein: 7, fat: 4, carbs: 34, grams: 52 },
    servingSizes: [{ label: '52 g', grams: 52 }],
  },
  {
    name: 'Whey Isolate',
    brand: 'True Nutrition',
    externalId: 'seed-true-nutrition-whey',
    // MFP lists 1 scoop; ~30 g is typical for 27 g protein isolate.
    serving: { calories: 114, protein: 27, fat: 0, carbs: 1, grams: 30 },
    servingSizes: [{ label: '1 scoop (30 g)', grams: 30 }],
  },
  {
    name: '0% Greek Yogurt',
    brand: 'Wegmans',
    externalId: 'seed-wegmans-greek-yogurt',
    serving: { calories: 130, protein: 23, fat: 0, carbs: 9, grams: 227 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 cup (227 g)', grams: 227 },
    ],
  },
  {
    name: 'Walnuts',
    brand: null,
    externalId: 'seed-walnuts',
    serving: { calories: 92, protein: 2, fat: 9, carbs: 2, grams: 14 },
    servingSizes: [{ label: '1 g', grams: 1 }],
  },
  {
    name: 'Berry Mixture',
    brand: 'Kirkland',
    externalId: 'seed-kirkland-berry-mix',
    // MFP lists 1 cup; ~140 g for frozen mixed berries.
    serving: { calories: 70, protein: 2, fat: 0, carbs: 15, grams: 140 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 cup (140 g)', grams: 140 },
    ],
  },
  {
    name: 'Chicken Breast Skinless, Cooked',
    brand: 'Generic',
    externalId: 'seed-chicken-breast-cooked',
    serving: { calories: 242, protein: 51, fat: 3, carbs: 0, grams: 220 },
    servingSizes: [{ label: '1 g', grams: 1 }],
  },
  {
    name: 'White Rice, Cooked',
    brand: 'Generic',
    externalId: 'seed-white-rice-cooked',
    serving: { calories: 260, protein: 5, fat: 1, carbs: 56, grams: 200 },
    servingSizes: [{ label: '1 g', grams: 1 }],
  },
  {
    name: 'Flank Steak, Cooked',
    brand: 'Generic',
    externalId: 'seed-flank-steak-cooked',
    serving: { calories: 335, protein: 50, fat: 13, carbs: 0, grams: 180 },
    servingSizes: [{ label: '1 g', grams: 1 }],
  },
  {
    name: 'Banana',
    brand: 'Generic',
    externalId: 'seed-banana',
    serving: { calories: 101, protein: 1, fat: 0, carbs: 26, grams: 112 },
    servingSizes: [{ label: '1 g', grams: 1 }],
  },
  {
    name: 'Organic Peanut Butter',
    brand: 'Kirkland',
    externalId: 'seed-kirkland-peanut-butter',
    serving: { calories: 141, protein: 6, fat: 12, carbs: 5, grams: 25 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '25 g', grams: 25 },
    ],
  },
  // Additional common foods
  {
    name: 'Solid White Albacore Tuna in Water',
    brand: 'Kirkland Signature',
    externalId: 'seed-kirkland-albacore-tuna',
    // MFP: 1 can drained; ~142 g (5 oz drained).
    serving: { calories: 180, protein: 41, fat: 1, carbs: 0, grams: 142 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 can drained (142 g)', grams: 142 },
    ],
  },
  {
    name: 'Egg, Large',
    brand: 'Generic',
    externalId: 'seed-egg-large',
    // MFP: 2 large eggs; ~100 g total.
    serving: { calories: 143, protein: 13, fat: 10, carbs: 1, grams: 100 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 large egg (50 g)', grams: 50 },
      { label: '2 large eggs (100 g)', grams: 100 },
    ],
  },
  {
    name: 'Avocado Mayo',
    brand: 'Primal Kitchen',
    externalId: 'seed-primal-kitchen-avocado-mayo',
    serving: { calories: 100, protein: 0, fat: 12, carbs: 0, grams: 15 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 tbsp (15 g)', grams: 15 },
    ],
  },
  {
    name: 'Yam',
    brand: 'Generic',
    externalId: 'seed-yam',
    serving: { calories: 225, protein: 8, fat: 0, carbs: 53, grams: 180 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '180 g', grams: 180 },
    ],
  },
  {
    name: 'Cuties Clementine',
    brand: 'Generic',
    externalId: 'seed-cuties-clementine',
    // MFP: 1 fruit; ~74 g per clementine.
    serving: { calories: 45, protein: 1, fat: 0, carbs: 11, grams: 74 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 fruit (74 g)', grams: 74 },
    ],
  },
  {
    name: 'Fuji Apple',
    brand: 'Generic',
    externalId: 'seed-fuji-apple',
    serving: { calories: 59, protein: 0, fat: 0, carbs: 13, grams: 115 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '115 g', grams: 115 },
    ],
  },
  {
    name: 'Pineapple Chunks',
    brand: 'Amazon Fresh',
    externalId: 'seed-amazon-fresh-pineapple',
    // MFP: 1 cup; ~165 g.
    serving: { calories: 70, protein: 1, fat: 0, carbs: 18, grams: 165 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 cup (165 g)', grams: 165 },
    ],
  },
  {
    name: 'Coconut Oil',
    brand: 'Generic',
    externalId: 'seed-coconut-oil',
    serving: { calories: 120, protein: 0, fat: 14, carbs: 0, grams: 14 },
    servingSizes: [
      { label: '1 g', grams: 1 },
      { label: '1 tbsp (14 g)', grams: 14 },
    ],
  },
  {
    name: 'Raw Almonds',
    brand: 'Generic',
    externalId: 'seed-raw-almonds',
    serving: { calories: 81, protein: 3, fat: 7, carbs: 3, grams: 14 },
    servingSizes: [{ label: '1 g', grams: 1 }],
  },
];

async function main() {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });

  try {
    const [user] = await sql`
      SELECT id, email FROM users WHERE email = ${USER_EMAIL}
    `;

    if (!user) {
      console.error(`No user found with email ${USER_EMAIL}. Register first, then re-run:`);
      console.error('  pnpm --filter @calorie-tracker/db seed:foods');
      process.exit(1);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const food of FOODS) {
      const nutrientsPer100g = per100gFromServing(food.serving);

      const [existing] = await sql`
        SELECT id FROM foods
        WHERE user_id = ${user.id}
          AND source = 'user'
          AND external_id = ${food.externalId}
          AND deleted_at IS NULL
      `;

      if (existing) {
        await sql`
          UPDATE foods SET
            name = ${food.name},
            brand = ${food.brand},
            nutrients_per_100g = ${sql.json(nutrientsPer100g)},
            serving_sizes = ${sql.json(food.servingSizes)},
            updated_at = now()
          WHERE id = ${existing.id}
        `;
        updated += 1;
        console.log(`Updated: ${food.brand ? `${food.brand} - ` : ''}${food.name}`);
        continue;
      }

      await sql`
        INSERT INTO foods (
          user_id,
          name,
          brand,
          source,
          external_id,
          nutrients_per_100g,
          serving_sizes
        ) VALUES (
          ${user.id},
          ${food.name},
          ${food.brand},
          'user',
          ${food.externalId},
          ${sql.json(nutrientsPer100g)},
          ${sql.json(food.servingSizes)}
        )
      `;
      inserted += 1;
      console.log(`Inserted: ${food.brand ? `${food.brand} - ` : ''}${food.name}`);
    }

    console.log(
      `\nDone for ${user.email}: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`,
    );
    console.log('\nPer-100g summary:');
    for (const food of FOODS) {
      const n = per100gFromServing(food.serving);
      console.log(
        `  ${food.name}: ${n.calories} cal · P ${n.protein}g · F ${n.fat}g · C ${n.carbs}g / 100g`,
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
