-- Confirmed ledger entries stay immutable. The ONE allowed change: when an umat deletes their
-- account, the description and source of a punia entry may be replaced by the fixed anonymous
-- text below (the amount, date, account and everything else stay untouched).
CREATE OR REPLACE FUNCTION pura_protect_confirmed_tx() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'confirmed' THEN RAISE EXCEPTION 'Transaksi terkonfirmasi tidak boleh dihapus'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'confirmed' AND (
    NEW.amount IS DISTINCT FROM OLD.amount OR NEW.type IS DISTINCT FROM OLD.type OR
    NEW.date IS DISTINCT FROM OLD.date OR NEW.account_id IS DISTINCT FROM OLD.account_id OR
    NEW.to_account_id IS DISTINCT FROM OLD.to_account_id OR NEW.category_id IS DISTINCT FROM OLD.category_id OR
    (NEW.description IS DISTINCT FROM OLD.description AND NOT (OLD.donation_id IS NOT NULL AND NEW.description = 'Punia: Anonim (akun dihapus)')) OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.temple_id IS DISTINCT FROM OLD.temple_id OR NEW.reversal_of IS DISTINCT FROM OLD.reversal_of OR
    NEW.donation_id IS DISTINCT FROM OLD.donation_id OR NEW.activity_id IS DISTINCT FROM OLD.activity_id OR
    NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR (OLD.reversed_by IS NOT NULL AND NEW.reversed_by IS DISTINCT FROM OLD.reversed_by)
  ) THEN
    RAISE EXCEPTION 'Transaksi terkonfirmasi tidak boleh diubah. Gunakan entri koreksi.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
