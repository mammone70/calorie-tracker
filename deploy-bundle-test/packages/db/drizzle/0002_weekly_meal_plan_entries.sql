-- Weekly meal plan templates (0 = Monday … 6 = Sunday)

CREATE TABLE IF NOT EXISTS "weekly_meal_plan_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "day_of_week" smallint NOT NULL,
  "meal_slot" "meal_slot" NOT NULL,
  "food_id" uuid NOT NULL REFERENCES "foods"("id") ON DELETE cascade,
  "quantity" numeric(10, 2) NOT NULL,
  "unit" text DEFAULT 'g' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "weekly_meal_plan_entries_user_dow_idx"
  ON "weekly_meal_plan_entries" ("user_id", "day_of_week");
