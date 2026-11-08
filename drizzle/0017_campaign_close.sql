ALTER TABLE "campaigns" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "close_reason" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "close_notes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Once a penggalangan is closed: the closing time, reason and who closed it never change, it
-- stays closed, and the extra notes can only be appended (never edited or removed).
CREATE OR REPLACE FUNCTION pura_guard_campaign_close() RETURNS trigger AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND (NEW.close_reason IS NULL OR length(trim(NEW.close_reason)) < 5) THEN
    RAISE EXCEPTION 'Penutupan penggalangan harus mencatat alasannya';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.closed_at IS NOT NULL THEN
    IF NEW.closed_at IS DISTINCT FROM OLD.closed_at OR NEW.close_reason IS DISTINCT FROM OLD.close_reason
       OR NEW.closed_by IS DISTINCT FROM OLD.closed_by OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Penggalangan yang sudah ditutup dan alasannya tidak boleh diubah';
    END IF;
    IF jsonb_array_length(NEW.close_notes) < jsonb_array_length(OLD.close_notes)
       OR left(NEW.close_notes::text, length(OLD.close_notes::text) - 1) <> left(OLD.close_notes::text, length(OLD.close_notes::text) - 1) THEN
      RAISE EXCEPTION 'Catatan penutupan hanya boleh ditambah, tidak boleh diubah atau dihapus';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_campaign_close ON campaigns;--> statement-breakpoint
CREATE TRIGGER pura_campaign_close BEFORE INSERT OR UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION pura_guard_campaign_close();
