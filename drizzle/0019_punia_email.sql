CREATE TABLE "email_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"user_id" text NOT NULL,
	"donation_id" text,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text_body" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "donor_seen" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_punia" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "email_queue_waiting" ON "email_queue" USING btree ("status","not_before");--> statement-breakpoint
CREATE INDEX "email_queue_sent" ON "email_queue" USING btree ("sent_at");