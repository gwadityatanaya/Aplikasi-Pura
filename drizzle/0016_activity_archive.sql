ALTER TABLE "activities" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "archive_reason" text;--> statement-breakpoint
-- A kegiatan that has records linked to it (transactions incl. drafts, punia, penggalangan dana)
-- may only be archived, never deleted. Runs for every DELETE, also one reached by a cascade.
CREATE OR REPLACE FUNCTION pura_guard_activity_delete() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE activity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM donations WHERE activity_id = OLD.id)
     OR EXISTS (SELECT 1 FROM campaigns WHERE activity_id = OLD.id) THEN
    RAISE EXCEPTION 'Kegiatan yang sudah memiliki data terkait tidak boleh dihapus. Arsipkan saja.';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_activity_delete ON activities;--> statement-breakpoint
CREATE TRIGGER pura_activity_delete BEFORE DELETE ON activities FOR EACH ROW EXECUTE FUNCTION pura_guard_activity_delete();
