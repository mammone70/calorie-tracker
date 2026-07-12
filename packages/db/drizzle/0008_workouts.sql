CREATE TYPE "public"."workout_schedule_kind" AS ENUM('weekday', 'interval');--> statement-breakpoint
CREATE TYPE "public"."workout_set_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"schedule_kind" "workout_schedule_kind" NOT NULL,
	"day_of_week" smallint,
	"interval_days" integer,
	"anchor_date" date,
	"sort_index" smallint DEFAULT 0 NOT NULL,
	"is_active" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "workout_template_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sort_index" smallint DEFAULT 0 NOT NULL,
	"target_sets" smallint NOT NULL,
	"reps_min" integer NOT NULL,
	"reps_max" integer NOT NULL,
	"target_weight" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "day_workout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"name" text NOT NULL,
	"sort_index" smallint DEFAULT 0 NOT NULL,
	"source_template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "day_workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sort_index" smallint DEFAULT 0 NOT NULL,
	"target_sets" smallint NOT NULL,
	"reps_min" integer NOT NULL,
	"reps_max" integer NOT NULL,
	"target_weight" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "workout_set_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day_exercise_id" uuid NOT NULL,
	"set_index" smallint NOT NULL,
	"status" "workout_set_status" DEFAULT 'pending' NOT NULL,
	"target_reps_min" integer NOT NULL,
	"target_reps_max" integer NOT NULL,
	"target_weight" numeric(10, 2),
	"actual_reps" integer,
	"actual_weight" numeric(10, 2),
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "daily_workout_materializations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workout_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD CONSTRAINT "workout_template_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_workout_sessions" ADD CONSTRAINT "day_workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_workout_sessions" ADD CONSTRAINT "day_workout_sessions_source_template_id_workout_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."workout_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD CONSTRAINT "day_workout_exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD CONSTRAINT "day_workout_exercises_session_id_day_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."day_workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_workout_exercises" ADD CONSTRAINT "day_workout_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_day_exercise_id_day_workout_exercises_id_fk" FOREIGN KEY ("day_exercise_id") REFERENCES "public"."day_workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_workout_materializations" ADD CONSTRAINT "daily_workout_materializations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_name_active_idx" ON "exercises" USING btree ("user_id","name") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "day_workout_sessions_user_date_sort_idx" ON "day_workout_sessions" USING btree ("user_id","session_date","sort_index") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_workout_materializations_user_date_idx" ON "daily_workout_materializations" USING btree ("user_id","session_date");
