-- Food logs reference customizable meals (weekly or day-specific)

ALTER TABLE "food_log_entries" ADD COLUMN IF NOT EXISTS "weekly_meal_id" uuid;
ALTER TABLE "food_log_entries" ADD COLUMN IF NOT EXISTS "day_meal_id" uuid;

-- Ensure weekly meals exist for logged meal slots before linking
INSERT INTO "weekly_meals" ("id", "user_id", "day_of_week", "meal_index", "name")
SELECT
  gen_random_uuid(),
  needed.user_id,
  needed.day_of_week,
  needed.meal_index,
  needed.meal_name
FROM (
  SELECT DISTINCT
    fle.user_id,
    CASE
      WHEN EXTRACT(DOW FROM fle.logged_at AT TIME ZONE 'UTC') = 0 THEN 6
      ELSE EXTRACT(DOW FROM fle.logged_at AT TIME ZONE 'UTC')::int - 1
    END AS day_of_week,
    CASE fle.meal_slot
      WHEN 'breakfast' THEN 0
      WHEN 'lunch' THEN 1
      WHEN 'dinner' THEN 2
      WHEN 'snack' THEN 3
    END AS meal_index,
    CASE fle.meal_slot
      WHEN 'breakfast' THEN 'Breakfast'
      WHEN 'lunch' THEN 'Lunch'
      WHEN 'dinner' THEN 'Dinner'
      WHEN 'snack' THEN 'Snacks'
    END AS meal_name
  FROM food_log_entries fle
  WHERE fle.deleted_at IS NULL
) needed
WHERE NOT EXISTS (
  SELECT 1
  FROM weekly_meals wm
  WHERE wm.user_id = needed.user_id
    AND wm.day_of_week = needed.day_of_week
    AND wm.meal_index = needed.meal_index
    AND wm.deleted_at IS NULL
);

UPDATE "food_log_entries" fle
SET weekly_meal_id = wm.id
FROM "weekly_meals" wm
WHERE fle.deleted_at IS NULL
  AND fle.weekly_meal_id IS NULL
  AND fle.day_meal_id IS NULL
  AND wm.user_id = fle.user_id
  AND wm.deleted_at IS NULL
  AND wm.day_of_week = (
    CASE
      WHEN EXTRACT(DOW FROM fle.logged_at AT TIME ZONE 'UTC') = 0 THEN 6
      ELSE EXTRACT(DOW FROM fle.logged_at AT TIME ZONE 'UTC')::int - 1
    END
  )
  AND wm.meal_index = CASE fle.meal_slot
    WHEN 'breakfast' THEN 0
    WHEN 'lunch' THEN 1
    WHEN 'dinner' THEN 2
    WHEN 'snack' THEN 3
  END;

DELETE FROM "food_log_entries"
WHERE weekly_meal_id IS NULL AND day_meal_id IS NULL AND deleted_at IS NULL;

ALTER TABLE "food_log_entries" DROP COLUMN IF EXISTS "meal_slot";

ALTER TABLE "food_log_entries"
  ADD CONSTRAINT "food_log_entries_weekly_meal_id_fkey"
  FOREIGN KEY ("weekly_meal_id") REFERENCES "weekly_meals"("id") ON DELETE set null;

ALTER TABLE "food_log_entries"
  ADD CONSTRAINT "food_log_entries_day_meal_id_fkey"
  FOREIGN KEY ("day_meal_id") REFERENCES "day_meals"("id") ON DELETE set null;
