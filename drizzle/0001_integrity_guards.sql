-- 1) Activity log is append-only: no UPDATE, DELETE or TRUNCATE, ever.
CREATE OR REPLACE FUNCTION pura_block_log_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Log aktivitas tidak boleh diubah atau dihapus';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER activity_log_no_update BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION pura_block_log_changes();
--> statement-breakpoint
CREATE TRIGGER activity_log_no_truncate BEFORE TRUNCATE ON activity_log
  FOR EACH STATEMENT EXECUTE FUNCTION pura_block_log_changes();
--> statement-breakpoint
-- 2) The Admin Utama account can never be deleted, demoted or deactivated.
CREATE OR REPLACE FUNCTION pura_protect_super_admin() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_super_admin THEN RAISE EXCEPTION 'Akun Admin Utama tidak boleh dihapus'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_super_admin AND (NOT NEW.is_super_admin OR NEW.status <> 'active') THEN
    RAISE EXCEPTION 'Akun Admin Utama tidak boleh diturunkan atau dinonaktifkan';
  END IF;
  IF NOT OLD.is_super_admin AND NEW.is_super_admin THEN
    RAISE EXCEPTION 'Admin Utama hanya dapat dibuat melalui langkah setup';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER users_protect_super_admin BEFORE UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION pura_protect_super_admin();
--> statement-breakpoint
-- 3) Confirmed ledger entries are immutable (only the reversal link may be set) and never deleted.
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
    NEW.description IS DISTINCT FROM OLD.description OR NEW.status IS DISTINCT FROM OLD.status OR
    NEW.temple_id IS DISTINCT FROM OLD.temple_id OR NEW.reversal_of IS DISTINCT FROM OLD.reversal_of OR
    NEW.donation_id IS DISTINCT FROM OLD.donation_id OR NEW.activity_id IS DISTINCT FROM OLD.activity_id OR
    NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR (OLD.reversed_by IS NOT NULL AND NEW.reversed_by IS DISTINCT FROM OLD.reversed_by)
  ) THEN
    RAISE EXCEPTION 'Transaksi terkonfirmasi tidak boleh diubah. Gunakan entri koreksi.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER transactions_protect_confirmed BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION pura_protect_confirmed_tx();
