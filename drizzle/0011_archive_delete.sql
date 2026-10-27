ALTER TABLE "activities" ADD COLUMN "auto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "banjars" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "banjars" ADD COLUMN "archive_reason" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "archive_reason" text;--> statement-breakpoint
-- The "Operasional Pura" activity every new temple starts with is not data entered by people.
UPDATE "activities" a SET "auto" = true
WHERE a."name" = 'Operasional Pura' AND a."budget" = 0
  AND a."id" = (SELECT min(b."id") FROM "activities" b WHERE b."temple_id" = a."temple_id" AND b."name" = 'Operasional Pura');--> statement-breakpoint
-- A temple may only be deleted when it holds no data at all: no transactions, punia, campaigns,
-- activities (other than the automatic one), published reports, photos/receipts or opening
-- balances. Runs for every DELETE, including one reached through a cascading foreign key.
CREATE OR REPLACE FUNCTION pura_guard_temple_delete() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE temple_id = OLD.id)
     OR EXISTS (SELECT 1 FROM donations WHERE temple_id = OLD.id)
     OR EXISTS (SELECT 1 FROM campaigns WHERE temple_id = OLD.id)
     OR EXISTS (SELECT 1 FROM activities WHERE temple_id = OLD.id AND NOT auto)
     OR EXISTS (SELECT 1 FROM reports WHERE temple_id = OLD.id)
     OR EXISTS (SELECT 1 FROM attachments WHERE temple_id = OLD.id)
     OR EXISTS (SELECT 1 FROM accounts WHERE temple_id = OLD.id AND opening_balance <> 0)
     OR OLD.photo IS NOT NULL THEN
    RAISE EXCEPTION 'Pura yang sudah memiliki data tidak boleh dihapus permanen. Arsipkan saja.';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_temple_delete ON temples;--> statement-breakpoint
CREATE TRIGGER pura_temple_delete BEFORE DELETE ON temples FOR EACH ROW EXECUTE FUNCTION pura_guard_temple_delete();--> statement-breakpoint
-- A banjar that still supports a temple cannot be deleted (archive it instead).
CREATE OR REPLACE FUNCTION pura_guard_banjar_delete() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM temple_banjars WHERE banjar_id = OLD.id) THEN
    RAISE EXCEPTION 'Banjar yang masih mengempon pura tidak boleh dihapus. Arsipkan saja.';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_banjar_delete ON banjars;--> statement-breakpoint
CREATE TRIGGER pura_banjar_delete BEFORE DELETE ON banjars FOR EACH ROW EXECUTE FUNCTION pura_guard_banjar_delete();--> statement-breakpoint
-- An archived temple receives no new transactions or punia.
CREATE OR REPLACE FUNCTION pura_guard_archived_temple() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM temples WHERE id = NEW.temple_id AND status = 'archived') THEN
    RAISE EXCEPTION 'Pura ini diarsipkan dan tidak menerima transaksi atau punia baru';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_tx_archived ON transactions;--> statement-breakpoint
CREATE TRIGGER pura_tx_archived BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION pura_guard_archived_temple();--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_donation_archived ON donations;--> statement-breakpoint
CREATE TRIGGER pura_donation_archived BEFORE INSERT ON donations FOR EACH ROW EXECUTE FUNCTION pura_guard_archived_temple();
