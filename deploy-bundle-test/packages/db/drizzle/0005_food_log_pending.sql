CREATE TYPE "food_log_status" AS ENUM ('pending', 'confirmed');

ALTER TABLE "food_log_entries"
  ADD COLUMN IF NOT EXISTS "status" "food_log_status" NOT NULL DEFAULT 'confirmed';

CREATE TABLE IF NOT EXISTS "daily_log_materializations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "plan_date" date NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_log_materializations_user_date_idx"
  ON "daily_log_materializations" ("user_id", "plan_date");
