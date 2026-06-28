#!/usr/bin/env node
/**
 * Seed weekly meal schedule (4 meals/day) and food plan from MFP-style template.
 * Scales portions to hit weekly macro targets (P=210, F per day, C per day).
 *
 * Usage: node scripts/seed-weekly-meal-plan.js [email]
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

const PROTEIN_TARGET = 210;
const MEAL_LABELS = ['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4'];
const MEAL_TIMES = ['08:00', '12:00', '16:00', '20:00'];

function round1(n) {
  return Math.round(n * 10) / 10;
}

function roundGrams(g, step = 1) {
  return Math.max(step, Math.round(g / step) * step);
}

function per100gFromServing({ calories, protein, fat, carbs, grams }) {
  const scale = 100 / grams;
  const proteinPer100 = round1(protein * scale);
  const fatPer100 = round1(fat * scale);
  const carbsPer100 = round1(carbs * scale);
  const caloriesPer100 = Math.round(proteinPer100 * 4 + fatPer100 * 9 + carbsPer100 * 4);
  return { calories: caloriesPer100, protein: proteinPer100, fat: fatPer100, carbs: carbsPer100 };
}

/** MFP sample day structure — grams per item */
const TEMPLATE_SERVINGS = {
  oats: { externalId: 'seed-one-degree-oats', grams: 52, mealIndex: 0 },
  whey: { externalId: 'seed-true-nutrition-whey', grams: 30, mealIndex: 0 },
  yogurt: { externalId: 'seed-wegmans-greek-yogurt', grams: 227, mealIndex: 0 },
  walnuts: { externalId: 'seed-walnuts', grams: 14, mealIndex: 0 },
  berries: { externalId: 'seed-kirkland-berry-mix', grams: 140, mealIndex: 0 },
  chicken: { externalId: 'seed-chicken-breast-cooked', grams: 440, mealIndex: 1 },
  lunchRice: { externalId: 'seed-white-rice-cooked', grams: 400, mealIndex: 1 },
  steak: { externalId: 'seed-flank-steak-cooked', grams: 180, mealIndex: 2 },
  dinnerRice: { externalId: 'seed-white-rice-cooked', grams: 200, mealIndex: 2 },
  banana: { externalId: 'seed-banana', grams: 112, mealIndex: 3 },
  pb: { externalId: 'seed-kirkland-peanut-butter', grams: 25, mealIndex: 3 },
};

const SERVING_DEFS = {
  'seed-one-degree-oats': { calories: 200, protein: 7, fat: 4, carbs: 34, grams: 52 },
  'seed-true-nutrition-whey': { calories: 114, protein: 27, fat: 0, carbs: 1, grams: 30 },
  'seed-wegmans-greek-yogurt': { calories: 130, protein: 23, fat: 0, carbs: 9, grams: 227 },
  'seed-walnuts': { calories: 92, protein: 2, fat: 9, carbs: 2, grams: 14 },
  'seed-kirkland-berry-mix': { calories: 70, protein: 2, fat: 0, carbs: 15, grams: 140 },
  'seed-chicken-breast-cooked': { calories: 242, protein: 51, fat: 3, carbs: 0, grams: 220 },
  'seed-white-rice-cooked': { calories: 260, protein: 5, fat: 1, carbs: 56, grams: 200 },
  'seed-flank-steak-cooked': { calories: 335, protein: 50, fat: 13, carbs: 0, grams: 180 },
  'seed-banana': { calories: 101, protein: 1, fat: 0, carbs: 26, grams: 112 },
  'seed-kirkland-peanut-butter': { calories: 141, protein: 6, fat: 12, carbs: 5, grams: 25 },
};

const NUTRIENTS_PER_100G = Object.fromEntries(
  Object.entries(SERVING_DEFS).map(([id, serving]) => [id, per100gFromServing(serving)]),
);

function macrosForGrams(externalId, grams) {
  const n = NUTRIENTS_PER_100G[externalId];
  const scale = grams / 100;
  return {
    calories: n.calories * scale,
    protein: n.protein * scale,
    fat: n.fat * scale,
    carbs: n.carbs * scale,
  };
}

function sumMacros(items) {
  return items.reduce(
    (acc, item) => {
      const m = macrosForGrams(item.externalId, item.grams);
      acc.calories += m.calories;
      acc.protein += m.protein;
      acc.fat += m.fat;
      acc.carbs += m.carbs;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

function buildDayPlan(targetCarbs, targetFat) {
  const templateProtein = sumMacros(
    Object.values(TEMPLATE_SERVINGS).map((t) => ({
      externalId: t.externalId,
      grams: t.grams,
    })),
  ).protein;

  const proteinScale = PROTEIN_TARGET / templateProtein;

  const items = Object.entries(TEMPLATE_SERVINGS).map(([key, t]) => ({
    key,
    externalId: t.externalId,
    mealIndex: t.mealIndex,
    grams: roundGrams(t.grams * proteinScale, key.includes('Rice') ? 5 : 1),
  }));

  let totals = sumMacros(items);

  // Fat: add via walnuts and peanut butter (template is usually low on fat)
  let fatGap = targetFat - totals.fat;
  const walnutItem = items.find((i) => i.key === 'walnuts');
  const pbItem = items.find((i) => i.key === 'pb');
  const walnutFatPerG = NUTRIENTS_PER_100G['seed-walnuts'].fat / 100;
  const pbFatPerG = NUTRIENTS_PER_100G['seed-kirkland-peanut-butter'].fat / 100;

  if (fatGap > 0) {
    const walnutAdd = Math.min(40, fatGap * 0.55 / walnutFatPerG);
    walnutItem.grams = roundGrams(walnutItem.grams + walnutAdd);
    totals = sumMacros(items);
    fatGap = targetFat - totals.fat;
    if (fatGap > 0) {
      pbItem.grams = roundGrams(pbItem.grams + fatGap / pbFatPerG);
    }
  } else if (fatGap < -2) {
    const reduce = Math.min(walnutItem.grams - 5, Math.abs(fatGap) / walnutFatPerG);
    walnutItem.grams = roundGrams(Math.max(5, walnutItem.grams - reduce));
    totals = sumMacros(items);
    fatGap = targetFat - totals.fat;
    if (fatGap < -1) {
      pbItem.grams = roundGrams(Math.max(10, pbItem.grams + fatGap / pbFatPerG));
    }
  }

  totals = sumMacros(items);

  // Carbs: primarily white rice (lunch + dinner), small tweaks to oats/berries/banana
  let carbGap = targetCarbs - totals.carbs;
  const lunchRice = items.find((i) => i.key === 'lunchRice');
  const dinnerRice = items.find((i) => i.key === 'dinnerRice');
  const riceCarbPerG = NUTRIENTS_PER_100G['seed-white-rice-cooked'].carbs / 100;
  const oatsItem = items.find((i) => i.key === 'oats');
  const berriesItem = items.find((i) => i.key === 'berries');
  const bananaItem = items.find((i) => i.key === 'banana');

  if (carbGap > 0) {
    const lunchAdd = roundGrams((carbGap * 0.6) / riceCarbPerG, 5);
    const dinnerAdd = roundGrams((carbGap * 0.4) / riceCarbPerG, 5);
    lunchRice.grams = roundGrams(lunchRice.grams + lunchAdd, 5);
    dinnerRice.grams = roundGrams(dinnerRice.grams + dinnerAdd, 5);
  } else if (carbGap < -5) {
    const lunchCut = roundGrams(Math.min(lunchRice.grams - 50, (Math.abs(carbGap) * 0.6) / riceCarbPerG), 5);
    const dinnerCut = roundGrams(Math.min(dinnerRice.grams - 50, (Math.abs(carbGap) * 0.4) / riceCarbPerG), 5);
    lunchRice.grams = roundGrams(lunchRice.grams - lunchCut, 5);
    dinnerRice.grams = roundGrams(dinnerRice.grams - dinnerCut, 5);
    totals = sumMacros(items);
    carbGap = targetCarbs - totals.carbs;
    if (carbGap < -3) {
      oatsItem.grams = roundGrams(Math.max(30, oatsItem.grams + carbGap * 0.3 / (NUTRIENTS_PER_100G['seed-one-degree-oats'].carbs / 100)));
      berriesItem.grams = roundGrams(Math.max(50, berriesItem.grams + carbGap * 0.4 / (NUTRIENTS_PER_100G['seed-kirkland-berry-mix'].carbs / 100)));
      bananaItem.grams = roundGrams(Math.max(50, bananaItem.grams + carbGap * 0.3 / (NUTRIENTS_PER_100G['seed-banana'].carbs / 100)));
    }
  }

  totals = sumMacros(items);

  // Fine-tune protein via chicken if off by more than 3g
  const chickenItem = items.find((i) => i.key === 'chicken');
  const chickenProteinPerG = NUTRIENTS_PER_100G['seed-chicken-breast-cooked'].protein / 100;
  const proteinGap = PROTEIN_TARGET - totals.protein;
  if (Math.abs(proteinGap) > 3) {
    chickenItem.grams = roundGrams(chickenItem.grams + proteinGap / chickenProteinPerG, 5);
    totals = sumMacros(items);
  }

  return {
    items: items.filter((i) => i.grams > 0),
    totals: {
      calories: Math.round(totals.calories),
      protein: round1(totals.protein),
      fat: round1(totals.fat),
      carbs: round1(totals.carbs),
    },
  };
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

async function main() {
  const sql = postgres(connectionString, { max: 1, connect_timeout: 5 });

  try {
    const [user] = await sql`
      SELECT id, email FROM users WHERE email = ${USER_EMAIL}
    `;

    if (!user) {
      console.error(`No user found with email ${USER_EMAIL}. Register first.`);
      process.exit(1);
    }

    const targets = await sql`
      SELECT day_of_week, calories, protein_g, fat_g, carbs_g
      FROM weekly_macro_targets
      WHERE user_id = ${user.id} AND deleted_at IS NULL
      ORDER BY day_of_week
    `;

    if (targets.length === 0) {
      console.error('No weekly macro targets found. Set weekly targets first.');
      process.exit(1);
    }

    const foods = await sql`
      SELECT id, external_id, name, brand
      FROM foods
      WHERE user_id = ${user.id}
        AND source = 'user'
        AND deleted_at IS NULL
        AND external_id LIKE 'seed-%'
    `;

    const foodByExternalId = new Map(foods.map((f) => [f.external_id, f]));

    for (const key of Object.values(TEMPLATE_SERVINGS).map((t) => t.externalId)) {
      if (!foodByExternalId.has(key)) {
        console.error(`Missing food ${key}. Run: pnpm db:seed-foods`);
        process.exit(1);
      }
    }

    await sql.begin(async (tx) => {
      await tx`
        UPDATE weekly_meal_plan_entries
        SET deleted_at = now(), updated_at = now()
        WHERE user_id = ${user.id} AND deleted_at IS NULL
      `;
      await tx`
        UPDATE weekly_meals
        SET deleted_at = now(), updated_at = now()
        WHERE user_id = ${user.id} AND deleted_at IS NULL
      `;

      for (const target of targets) {
        const dayOfWeek = target.day_of_week;
        const targetCarbs = Number(target.carbs_g);
        const targetFat = Number(target.fat_g);
        const plan = buildDayPlan(targetCarbs, targetFat);

        const mealIds = [];
        for (let mealIndex = 0; mealIndex < 4; mealIndex++) {
          const [meal] = await tx`
            INSERT INTO weekly_meals (user_id, day_of_week, meal_index, name, meal_time)
            VALUES (
              ${user.id},
              ${dayOfWeek},
              ${mealIndex},
              ${MEAL_LABELS[mealIndex]},
              ${MEAL_TIMES[mealIndex]}
            )
            RETURNING id
          `;
          mealIds[mealIndex] = meal.id;
        }

        for (const item of plan.items) {
          const food = foodByExternalId.get(item.externalId);
          await tx`
            INSERT INTO weekly_meal_plan_entries (
              user_id, weekly_meal_id, food_id, quantity, unit
            ) VALUES (
              ${user.id},
              ${mealIds[item.mealIndex]},
              ${food.id},
              ${String(item.grams)},
              'g'
            )
          `;
        }

        const t = plan.totals;
        console.log(
          `${WEEKDAYS[dayOfWeek]}: ${t.calories} cal · P ${t.protein}g · F ${t.fat}g · C ${t.carbs}g` +
            ` (target C ${targetCarbs}g, F ${targetFat}g)`,
        );
      }
    });

    console.log(`\nWeekly meal plan seeded for ${user.email} (4 meals × 7 days).`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
