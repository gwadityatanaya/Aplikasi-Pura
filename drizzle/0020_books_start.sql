CREATE TABLE "opening_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"temple_id" text NOT NULL,
	"account_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"witnesses" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" text PRIMARY KEY NOT NULL,
	"temple_id" text NOT NULL,
	"account_id" text NOT NULL,
	"month" text NOT NULL,
	"statement_balance" bigint NOT NULL,
	"app_balance" bigint NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "opening_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "opening_witnesses" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "opening_adjust" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "books_start_date" date;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "books_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "books_started_by" text;--> statement-breakpoint
ALTER TABLE "temples" ADD COLUMN "books_witnesses" text;--> statement-breakpoint
ALTER TABLE "opening_corrections" ADD CONSTRAINT "opening_corrections_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_corrections" ADD CONSTRAINT "opening_corrections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opening_corrections_account" ON "opening_corrections" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "reconciliations_temple_month" ON "reconciliations" USING btree ("temple_id","month");--> statement-breakpoint
-- The start date of the books is set once and never changed.
CREATE OR REPLACE FUNCTION pura_guard_books_start() RETURNS trigger AS $$
BEGIN
  IF OLD.books_start_date IS NOT NULL AND (
    NEW.books_start_date IS DISTINCT FROM OLD.books_start_date OR NEW.books_started_at IS DISTINCT FROM OLD.books_started_at
    OR NEW.books_started_by IS DISTINCT FROM OLD.books_started_by OR NEW.books_witnesses IS DISTINCT FROM OLD.books_witnesses
  ) THEN
    RAISE EXCEPTION 'Tanggal mulai pembukuan dan saksinya tidak boleh diubah';
  END IF;
  IF NEW.books_start_date IS NOT NULL AND OLD.books_start_date IS NULL AND (NEW.books_witnesses IS NULL OR length(trim(NEW.books_witnesses)) < 5) THEN
    RAISE EXCEPTION 'Mulai pembukuan harus mencatat dua pengurus yang menyaksikan';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_books_start ON temples;--> statement-breakpoint
CREATE TRIGGER pura_books_start BEFORE UPDATE ON temples FOR EACH ROW EXECUTE FUNCTION pura_guard_books_start();--> statement-breakpoint
-- A witnessed opening balance is locked; only a correction (below) may move it.
CREATE OR REPLACE FUNCTION pura_guard_opening() RETURNS trigger AS $$
BEGIN
  IF OLD.opening_set_at IS NOT NULL AND (
    NEW.opening_balance IS DISTINCT FROM OLD.opening_balance OR NEW.opening_date IS DISTINCT FROM OLD.opening_date
    OR NEW.opening_set_at IS DISTINCT FROM OLD.opening_set_at OR NEW.opening_witnesses IS DISTINCT FROM OLD.opening_witnesses
  ) THEN
    RAISE EXCEPTION 'Saldo awal yang sudah disaksikan tidak boleh diubah. Gunakan koreksi saldo awal.';
  END IF;
  IF NEW.opening_adjust IS DISTINCT FROM OLD.opening_adjust AND coalesce(current_setting('pura.opening_correction', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Koreksi saldo awal hanya lewat catatan koreksi';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_opening ON accounts;--> statement-breakpoint
CREATE TRIGGER pura_opening BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION pura_guard_opening();--> statement-breakpoint
-- Opening-balance corrections and monthly checks are append-only.
CREATE OR REPLACE FUNCTION pura_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Catatan ini tidak boleh diubah atau dihapus (% hanya bisa ditambah)', TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_opening_corrections_ro ON opening_corrections;--> statement-breakpoint
CREATE TRIGGER pura_opening_corrections_ro BEFORE UPDATE OR DELETE ON opening_corrections FOR EACH ROW EXECUTE FUNCTION pura_append_only();--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_reconciliations_ro ON reconciliations;--> statement-breakpoint
CREATE TRIGGER pura_reconciliations_ro BEFORE UPDATE OR DELETE ON reconciliations FOR EACH ROW EXECUTE FUNCTION pura_append_only();--> statement-breakpoint
CREATE OR REPLACE FUNCTION pura_apply_opening_correction() RETURNS trigger AS $$
BEGIN
  IF NEW.amount = 0 OR length(trim(NEW.reason)) < 5 OR length(trim(NEW.witnesses)) < 5 THEN
    RAISE EXCEPTION 'Koreksi saldo awal harus berisi nominal, alasan, dan dua saksi';
  END IF;
  PERFORM set_config('pura.opening_correction', 'on', true);
  UPDATE accounts SET opening_adjust = opening_adjust + NEW.amount WHERE id = NEW.account_id AND temple_id = NEW.temple_id;
  PERFORM set_config('pura.opening_correction', 'off', true);
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_opening_correction_apply ON opening_corrections;--> statement-breakpoint
CREATE TRIGGER pura_opening_correction_apply AFTER INSERT ON opening_corrections FOR EACH ROW EXECUTE FUNCTION pura_apply_opening_correction();--> statement-breakpoint
-- No transaction dated before the temple's start date (it belongs to the old books).
CREATE OR REPLACE FUNCTION pura_guard_tx_before_start() RETURNS trigger AS $$
DECLARE start_date date;
BEGIN
  SELECT books_start_date INTO start_date FROM temples WHERE id = NEW.temple_id;
  IF start_date IS NOT NULL AND NEW.date < start_date AND NEW.reversal_of IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi sebelum tanggal mulai pembukuan (%) — catatan itu termasuk buku lama', start_date;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS pura_tx_before_start ON transactions;--> statement-breakpoint
CREATE TRIGGER pura_tx_before_start BEFORE INSERT OR UPDATE OF date ON transactions FOR EACH ROW EXECUTE FUNCTION pura_guard_tx_before_start();
