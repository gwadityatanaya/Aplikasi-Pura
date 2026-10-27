ALTER TABLE "sessions" ADD COLUMN "emergency_temple_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "emergency_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "emergency_reason" text;