-- Phase 3: map old temple roles to the new ones.
UPDATE memberships SET role = 'pengurus' WHERE role IN ('ketua', 'bendahara', 'sekretaris');
--> statement-breakpoint
UPDATE memberships SET role = 'pemeriksa' WHERE role = 'auditor';
--> statement-breakpoint
-- A punia can never be verified by the person who sent it (checked by account and by email).
-- Verified punia keep their amount, date and temple; only anonymisation is allowed afterwards.
CREATE OR REPLACE FUNCTION pura_guard_donation() RETURNS trigger AS $$
DECLARE verifier_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'verified' THEN RAISE EXCEPTION 'Punia terverifikasi tidak boleh dihapus'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN
    IF NEW.verified_by IS NULL THEN RAISE EXCEPTION 'Verifikasi punia harus mencatat siapa yang memverifikasi'; END IF;
    SELECT email INTO verifier_email FROM users WHERE id = NEW.verified_by;
    IF NEW.verified_by = NEW.submitted_by
       OR (NEW.submitter_email IS NOT NULL AND lower(NEW.submitter_email) = lower(coalesce(verifier_email, ''))) THEN
      RAISE EXCEPTION 'Pengurus tidak boleh memverifikasi punia yang dikirim oleh dirinya sendiri';
    END IF;
  END IF;
  IF OLD.status = 'verified' AND (
    NEW.status IS DISTINCT FROM OLD.status OR NEW.amount IS DISTINCT FROM OLD.amount OR
    NEW.temple_id IS DISTINCT FROM OLD.temple_id OR NEW.transfer_date IS DISTINCT FROM OLD.transfer_date OR
    NEW.transaction_id IS DISTINCT FROM OLD.transaction_id OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
  ) THEN
    RAISE EXCEPTION 'Punia terverifikasi tidak boleh diubah';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER donations_guard BEFORE UPDATE OR DELETE ON donations
  FOR EACH ROW EXECUTE FUNCTION pura_guard_donation();
