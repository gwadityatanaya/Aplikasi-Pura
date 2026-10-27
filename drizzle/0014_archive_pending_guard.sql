-- A temple cannot be archived while punia are still waiting for verification: umat already
-- transferred real money, and an archived temple can no longer sahkan or tolak them.
CREATE OR REPLACE FUNCTION pura_guard_archive_pending() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'archived' AND OLD.status IS DISTINCT FROM 'archived'
     AND EXISTS (SELECT 1 FROM donations WHERE temple_id = NEW.id AND status = 'pending') THEN
    RAISE EXCEPTION 'Pura dengan punia yang masih menunggu verifikasi tidak boleh diarsipkan';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_temple_archive_pending ON temples;--> statement-breakpoint
CREATE TRIGGER pura_temple_archive_pending BEFORE UPDATE OF status ON temples FOR EACH ROW EXECUTE FUNCTION pura_guard_archive_pending();
