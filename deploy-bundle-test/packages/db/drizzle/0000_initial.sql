-- Initial schema for calorie-tracker

CREATE TYPE "meal_slot" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE "food_source" AS ENUM ('user', 'usda', 'open_food_facts');

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "macro_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "target_date" date NOT NULL,
  "calories" integer NOT NULL,
  "protein_g" numeric(8, 2) NOT NULL,
  "fat_g" numeric(8, 2) NOT NULL,
  "carbs_g" numeric(8, 2) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "macro_targets_user_date_idx" ON "macro_targets" ("user_id", "target_date");

CREATE TABLE IF NOT EXISTS "foods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "brand" text,
  "source" "food_source" DEFAULT 'user' NOT NULL,
  "external_id" text,
  "nutrients_per_100g" jsonb NOT NULL,
  "serving_sizes" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "meal_plan_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "plan_date" date NOT NULL,
  "meal_slot" "meal_slot" NOT NULL,
  "food_id" uuid NOT NULL REFERENCES "foods"("id") ON DELETE cascade,
  "quantity" numeric(10, 2) NOT NULL,
  "unit" text DEFAULT 'g' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "food_log_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "logged_at" timestamptz NOT NULL,
  "meal_slot" "meal_slot" NOT NULL,
  "food_id" uuid NOT NULL REFERENCES "foods"("id") ON DELETE cascade,
  "quantity" numeric(10, 2) NOT NULL,
  "unit" text DEFAULT 'g' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);
