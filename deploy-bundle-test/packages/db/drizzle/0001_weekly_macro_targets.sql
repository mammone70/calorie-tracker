-- Weekly default macro targets (0 = Monday … 6 = Sunday)

CREATE TABLE IF NOT EXISTS "weekly_macro_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "day_of_week" smallint NOT NULL,
  "calories" integer NOT NULL,
  "protein_g" numeric(8, 2) NOT NULL,
  "fat_g" numeric(8, 2) NOT NULL,
  "carbs_g" numeric(8, 2) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_macro_targets_user_dow_idx"
  ON "weekly_macro_targets" ("user_id", "day_of_week");
