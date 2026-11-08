ALTER TABLE "accounts" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "qris_image" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "qris_account_id" text;--> statement-breakpoint
-- Existing temples keep working without manual steps: their bank account becomes the primary one,
-- filled with the official details already set by Admin Utama.
INSERT INTO accounts (id, temple_id, name, type, bank_name, account_number, account_holder, opening_balance, opening_date, is_public)
SELECT 'acc_' || substr(md5(random()::text || t.id), 1, 12), t.id, 'Rekening Pura', 'bank', t.bank_name, t.bank_account_number, t.bank_account_holder, 0, current_date, true
FROM temples t
WHERE t.bank_account_number IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.temple_id = t.id AND a.type = 'bank');--> statement-breakpoint
UPDATE accounts a SET is_primary = true
WHERE a.id = (SELECT b.id FROM accounts b WHERE b.temple_id = a.temple_id AND b.type = 'bank' AND NOT b.archived ORDER BY (b.account_number IS NULL), b.id LIMIT 1);--> statement-breakpoint
UPDATE accounts a SET bank_name = t.bank_name, account_number = t.bank_account_number, account_holder = t.bank_account_holder, is_public = true
FROM temples t WHERE a.temple_id = t.id AND a.is_primary AND t.bank_account_number IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_one_primary" ON "accounts" USING btree ("temple_id") WHERE "accounts"."is_primary";
