CREATE TYPE "public"."weight_unit" AS ENUM('lbs', 'kg');--> statement-breakpoint
CREATE TYPE "public"."prescription_kind" AS ENUM('none', 'rpe', 'rir', 'load_increase');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "weight_unit" "weight_unit" DEFAULT 'lbs' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD COLUMN "prescription_kind" "prescription_kind" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD COLUMN "prescription_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD COLUMN "prescription_kind" "prescription_kind" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD COLUMN "prescription_value" numeric(10, 2);
