CREATE TABLE "banjar_members" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"banjar_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banjars" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"village" text DEFAULT '' NOT NULL,
	"district" text DEFAULT '' NOT NULL,
	"regency" text DEFAULT '' NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banjars_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "temple_banjars" (
	"temple_id" text NOT NULL,
	"banjar_id" text NOT NULL,
	CONSTRAINT "temple_banjars_temple_id_banjar_id_pk" PRIMARY KEY("temple_id","banjar_id")
);
--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "campaign_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "password_tokens" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "activity_id" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "purpose" text DEFAULT 'umum' NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "transfer_date" date;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "reference_no" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "submitted_by" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "submitter_email" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "input_by" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "evidence_hash" text;--> statement-breakpoint
ALTER TABLE "password_tokens" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "bank_account_holder" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_digest" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "banjar_members" ADD CONSTRAINT "banjar_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banjar_members" ADD CONSTRAINT "banjar_members_banjar_id_banjars_id_fk" FOREIGN KEY ("banjar_id") REFERENCES "public"."banjars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temple_banjars" ADD CONSTRAINT "temple_banjars_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temple_banjars" ADD CONSTRAINT "temple_banjars_banjar_id_banjars_id_fk" FOREIGN KEY ("banjar_id") REFERENCES "public"."banjars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "banjar_member_unique" ON "banjar_members" USING btree ("user_id","banjar_id");--> statement-breakpoint
CREATE INDEX "temple_banjars_banjar" ON "temple_banjars" USING btree ("banjar_id");--> statement-breakpoint
CREATE INDEX "donations_temple_status" ON "donations" USING btree ("temple_id","status");--> statement-breakpoint
CREATE INDEX "donations_evidence_hash" ON "donations" USING btree ("evidence_hash");--> statement-breakpoint
CREATE INDEX "donations_submitted_by" ON "donations" USING btree ("submitted_by");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub");