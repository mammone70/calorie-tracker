ALTER TABLE "workout_template_exercises" ALTER COLUMN "target_sets" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ALTER COLUMN "reps_min" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ALTER COLUMN "reps_max" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ALTER COLUMN "target_sets" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ALTER COLUMN "reps_min" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ALTER COLUMN "reps_max" DROP NOT NULL;
