ALTER TABLE "banjar_members" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "banjar_members" ADD COLUMN "position_title" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "position_title" text;--> statement-breakpoint
CREATE UNIQUE INDEX "banjar_member_position_unique" ON "banjar_members" USING btree ("banjar_id","position") WHERE position in ('ketua','kelian_banjar','sekretaris','bendahara') and status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "membership_position_unique" ON "memberships" USING btree ("temple_id","position") WHERE position in ('ketua','kelian_banjar','sekretaris','bendahara') and status = 'active';