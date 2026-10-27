CREATE TABLE "help_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text NOT NULL,
	"from_admin" boolean NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'baru' NOT NULL,
	"context" jsonb NOT NULL,
	"attachment_id" text,
	"attachment_removed_at" timestamp with time zone,
	"unread_by_admin" boolean DEFAULT true NOT NULL,
	"unread_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "help_replies" ADD CONSTRAINT "help_replies_ticket_id_help_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."help_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_replies" ADD CONSTRAINT "help_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "help_replies_ticket" ON "help_replies" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "help_tickets_user" ON "help_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "help_tickets_status" ON "help_tickets" USING btree ("status","updated_at");