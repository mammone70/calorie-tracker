CREATE TABLE IF NOT EXISTS "body_weight_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "logged_on" date NOT NULL,
  "weight" numeric(8, 2) NOT NULL,
  "unit" "weight_unit" DEFAULT 'lbs' NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "body_weight_logs_user_day_active_idx"
  ON "body_weight_logs" ("user_id", "logged_on")
  WHERE deleted_at IS NULL;
