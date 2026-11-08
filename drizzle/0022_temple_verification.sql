CREATE TABLE "temple_verifications" (
	"temple_id" text PRIMARY KEY NOT NULL,
	"reference_contacted_at" date,
	"video_call_at" date,
	"account_checked_at" date,
	"account_holder_type" text,
	"trial_start" date,
	"trial_end" date,
	"notes" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "temple_verifications" ADD CONSTRAINT "temple_verifications_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;