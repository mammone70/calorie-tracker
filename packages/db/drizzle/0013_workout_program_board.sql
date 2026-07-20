ALTER TABLE "workout_template_exercises" ADD COLUMN "week_index" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD COLUMN "week_index" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE TABLE "workout_blocks" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "start_date" date,
  "week_count" smallint DEFAULT 3 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
