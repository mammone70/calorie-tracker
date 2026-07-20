ALTER TABLE "workout_template_exercises" ALTER COLUMN "exercise_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD COLUMN "body_part" text;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_entry_check" CHECK (
  (("exercise_id" IS NOT NULL AND "body_part" IS NULL) OR ("exercise_id" IS NULL AND "body_part" IS NOT NULL))
);--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ALTER COLUMN "exercise_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD COLUMN "body_part" text;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD CONSTRAINT "day_workout_exercises_entry_check" CHECK (
  (("exercise_id" IS NOT NULL AND "body_part" IS NULL) OR ("exercise_id" IS NULL AND "body_part" IS NOT NULL))
);
