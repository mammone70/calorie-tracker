CREATE TABLE IF NOT EXISTS "waist_circumference_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "logged_on" date NOT NULL,
  "inches" numeric(6, 3) NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waist_circumference_logs_user_day_active_idx"
  ON "waist_circumference_logs" ("user_id", "logged_on")
  WHERE deleted_at IS NULL;
