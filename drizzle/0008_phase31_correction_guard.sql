-- Correcting a punia follows the same rule as sahkan: never by the person who sent it (by account
-- or email), and always with who + reason recorded. Previous rules are unchanged.
CREATE OR REPLACE FUNCTION pura_guard_donation() RETURNS trigger AS $$
DECLARE verifier_email text; corrector_email text;
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
    NEW.transaction_id IS DISTINCT FROM OLD.transaction_id OR NEW.verified_by IS DISTINCT FROM OLD.verified_by OR
    (NEW.privacy IS DISTINCT FROM OLD.privacy AND NEW.privacy = 'public')
  ) THEN
    RAISE EXCEPTION 'Punia terverifikasi tidak boleh diubah';
  END IF;
  IF NEW.corrected_at IS NOT NULL AND OLD.corrected_at IS NULL THEN
    IF NEW.corrected_by IS NULL OR NEW.correction_reason IS NULL OR length(trim(NEW.correction_reason)) < 5 THEN
      RAISE EXCEPTION 'Koreksi punia harus mencatat siapa yang mengoreksi dan alasannya';
    END IF;
    SELECT email INTO corrector_email FROM users WHERE id = NEW.corrected_by;
    IF NEW.corrected_by = NEW.submitted_by
       OR (NEW.submitter_email IS NOT NULL AND lower(NEW.submitter_email) = lower(coalesce(corrector_email, ''))) THEN
      RAISE EXCEPTION 'Punia tidak boleh dikoreksi oleh pengirimnya sendiri';
    END IF;
  END IF;
  IF OLD.corrected_at IS NOT NULL AND (
    NEW.corrected_at IS DISTINCT FROM OLD.corrected_at OR NEW.corrected_by IS DISTINCT FROM OLD.corrected_by OR
    NEW.correction_reason IS DISTINCT FROM OLD.correction_reason
  ) THEN
    RAISE EXCEPTION 'Koreksi punia tidak boleh dibatalkan atau diubah';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
