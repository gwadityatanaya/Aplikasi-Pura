ALTER TABLE "banjars" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "banjars" ADD COLUMN "province_code" text;--> statement-breakpoint
ALTER TABLE "banjars" ADD COLUMN "regency_code" text;--> statement-breakpoint
ALTER TABLE "banjars" ADD COLUMN "district_code" text;--> statement-breakpoint
ALTER TABLE "banjars" ADD COLUMN "village_code" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "province_code" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "regency_code" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "district_code" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "village_code" text;--> statement-breakpoint
CREATE INDEX "banjars_regency_code" ON "banjars" USING btree ("regency_code");