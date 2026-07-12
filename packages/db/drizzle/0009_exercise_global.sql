ALTER TABLE "exercises" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "exercises_user_name_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_global_name_active_idx" ON "exercises" USING btree ("name") WHERE is_global = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_name_active_idx" ON "exercises" USING btree ("user_id","name") WHERE is_global = false AND deleted_at IS NULL;
