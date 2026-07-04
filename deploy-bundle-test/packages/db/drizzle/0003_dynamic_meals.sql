-- Dynamic weekly/day meals (1–10 per day) with optional times

CREATE TABLE IF NOT EXISTS "weekly_meals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "day_of_week" smallint NOT NULL,
  "meal_index" smallint NOT NULL,
  "name" text NOT NULL,
  "meal_time" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_meals_user_dow_index_idx"
  ON "weekly_meals" ("user_id", "day_of_week", "meal_index")
  WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "day_meals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "plan_date" date NOT NULL,
  "meal_index" smallint NOT NULL,
  "name" text NOT NULL,
  "meal_time" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "day_meals_user_date_index_idx"
  ON "day_meals" ("user_id", "plan_date", "meal_index")
  WHERE "deleted_at" IS NULL;

-- Migrate weekly_meal_plan_entries from meal_slot -> weekly_meal_id
ALTER TABLE "weekly_meal_plan_entries" ADD COLUMN IF NOT EXISTS "weekly_meal_id" uuid;

INSERT INTO "weekly_meals" ("id", "user_id", "day_of_week", "meal_index", "name")
SELECT
  gen_random_uuid(),
  w.user_id,
  w.day_of_week,
  CASE w.meal_slot
    WHEN 'breakfast' THEN 0
    WHEN 'lunch' THEN 1
    WHEN 'dinner' THEN 2
    WHEN 'snack' THEN 3
  END,
  CASE w.meal_slot
    WHEN 'breakfast' THEN 'Breakfast'
    WHEN 'lunch' THEN 'Lunch'
    WHEN 'dinner' THEN 'Dinner'
    WHEN 'snack' THEN 'Snacks'
  END
FROM (
  SELECT DISTINCT user_id, day_of_week, meal_slot
  FROM weekly_meal_plan_entries
  WHERE deleted_at IS NULL
) w
ON CONFLICT DO NOTHING;

UPDATE "weekly_meal_plan_entries" wpe
SET weekly_meal_id = wm.id
FROM "weekly_meals" wm
WHERE wpe.deleted_at IS NULL
  AND wpe.weekly_meal_id IS NULL
  AND wm.user_id = wpe.user_id
  AND wm.day_of_week = wpe.day_of_week
  AND wm.deleted_at IS NULL
  AND wm.meal_index = CASE wpe.meal_slot
    WHEN 'breakfast' THEN 0
    WHEN 'lunch' THEN 1
    WHEN 'dinner' THEN 2
    WHEN 'snack' THEN 3
  END;

DELETE FROM "weekly_meal_plan_entries" WHERE weekly_meal_id IS NULL AND deleted_at IS NULL;

ALTER TABLE "weekly_meal_plan_entries" DROP COLUMN IF EXISTS "day_of_week";
ALTER TABLE "weekly_meal_plan_entries" DROP COLUMN IF EXISTS "meal_slot";
ALTER TABLE "weekly_meal_plan_entries"
  ALTER COLUMN "weekly_meal_id" SET NOT NULL;
ALTER TABLE "weekly_meal_plan_entries"
  ADD CONSTRAINT "weekly_meal_plan_entries_weekly_meal_id_fkey"
  FOREIGN KEY ("weekly_meal_id") REFERENCES "weekly_meals"("id") ON DELETE cascade;

-- Migrate meal_plan_entries from meal_slot -> day_meal_id
ALTER TABLE "meal_plan_entries" ADD COLUMN IF NOT EXISTS "day_meal_id" uuid;

INSERT INTO "day_meals" ("id", "user_id", "plan_date", "meal_index", "name")
SELECT
  gen_random_uuid(),
  m.user_id,
  m.plan_date,
  CASE m.meal_slot
    WHEN 'breakfast' THEN 0
    WHEN 'lunch' THEN 1
    WHEN 'dinner' THEN 2
    WHEN 'snack' THEN 3
  END,
  CASE m.meal_slot
    WHEN 'breakfast' THEN 'Breakfast'
    WHEN 'lunch' THEN 'Lunch'
    WHEN 'dinner' THEN 'Dinner'
    WHEN 'snack' THEN 'Snacks'
  END
FROM (
  SELECT DISTINCT user_id, plan_date, meal_slot
  FROM meal_plan_entries
  WHERE deleted_at IS NULL
) m
ON CONFLICT DO NOTHING;

UPDATE "meal_plan_entries" mpe
SET day_meal_id = dm.id
FROM "day_meals" dm
WHERE mpe.deleted_at IS NULL
  AND mpe.day_meal_id IS NULL
  AND dm.user_id = mpe.user_id
  AND dm.plan_date = mpe.plan_date
  AND dm.deleted_at IS NULL
  AND dm.meal_index = CASE mpe.meal_slot
    WHEN 'breakfast' THEN 0
    WHEN 'lunch' THEN 1
    WHEN 'dinner' THEN 2
    WHEN 'snack' THEN 3
  END;

DELETE FROM "meal_plan_entries" WHERE day_meal_id IS NULL AND deleted_at IS NULL;

ALTER TABLE "meal_plan_entries" DROP COLUMN IF EXISTS "meal_slot";
ALTER TABLE "meal_plan_entries"
  ALTER COLUMN "day_meal_id" SET NOT NULL;
ALTER TABLE "meal_plan_entries"
  ADD CONSTRAINT "meal_plan_entries_day_meal_id_fkey"
  FOREIGN KEY ("day_meal_id") REFERENCES "day_meals"("id") ON DELETE cascade;
