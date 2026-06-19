-- ==================================================================
-- Migration: 0380_b2b_statement_payment_detail.sql
-- Purpose : F-04 / F-02 — dedicated audit + idempotency detail table for
--           B2B statement payments. Today B2B statement allocation mutates
--           org_b2b_statements_mst in place with NO detail row and NO
--           idempotency guard (the only non-idempotent allocation path;
--           AR uses org_idempotency_keys, order/wallet/advance/CN use
--           effect-table indexes). Decision D-04 (23_DECISIONS_ADDENDUM).
--
--           org_b2b_statement_payments_dtl (30 chars) gives B2B statement
--           payments the same audit/idempotency/reversal/reporting symmetry
--           AR invoices already have via org_invoice_payments_dtl.
--
-- Idempotency: uq_b2b_stmt_pay_idem (partial unique on non-null key) +
--           the service consumes idempotencyKey before mutating the
--           statement, so a replay cannot double-reduce the balance.
--
-- Naming  : table = 30 chars; all constraints/indexes <= 30 chars.
-- FKs     : voucher / voucher-line FKs are composite (id, tenant_org_id),
--           matching org_fin_vouchers_mst / org_fin_voucher_trx_lines_dtl
--           (confirmed). The statement FK is added in a guarded DO block
--           so apply does not fail if org_b2b_statements_mst PK shape
--           differs — VERIFY and keep it.
-- Safety  : additive, no data change, no destructive SQL. Create for review.
-- Do NOT apply via agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS org_b2b_statement_payments_dtl (
  -- Identity
  id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id       UUID        NOT NULL,
  branch_id           UUID,

  -- Target + party
  statement_id        UUID        NOT NULL,
  customer_id         UUID,

  -- Voucher linkage (authoritative posting stays on the voucher line)
  voucher_id          UUID,
  voucher_trx_line_id UUID,

  -- Amounts
  amount              DECIMAL(19, 4) NOT NULL,
  currency_code       TEXT,
  currency_ex_rate    DECIMAL(10, 6) DEFAULT 1.000000,
  
  -- Idempotency
  idempotency_key     TEXT,

  -- Descriptive
  notes               TEXT,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT,
  created_info        TEXT,
  updated_at          TIMESTAMPTZ,
  updated_by          TEXT,
  updated_info        TEXT,
  rec_status          SMALLINT    NOT NULL DEFAULT 1,
  rec_order           INTEGER,
  rec_notes           TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT true,

  CONSTRAINT pk_b2b_stmt_pay_dtl
    PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT chk_b2b_stmt_pay_amt
    CHECK (amount > 0),
  CONSTRAINT fk_b2b_stmt_pay_voucher
    FOREIGN KEY (voucher_id, tenant_org_id)
    REFERENCES org_fin_vouchers_mst (id, tenant_org_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_b2b_stmt_pay_vch_line
    FOREIGN KEY (voucher_trx_line_id, tenant_org_id)
    REFERENCES org_fin_voucher_trx_lines_dtl (id, tenant_org_id)
    ON DELETE SET NULL
);

-- Idempotency guard: one applied payment per (tenant, key). The service
-- checks this table by key before mutating the statement balance.
CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_stmt_pay_idem
  ON org_b2b_statement_payments_dtl (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_b2b_stmt_pay_stmt
  ON org_b2b_statement_payments_dtl (tenant_org_id, statement_id);

CREATE INDEX IF NOT EXISTS idx_b2b_stmt_pay_created
  ON org_b2b_statement_payments_dtl (tenant_org_id, created_at DESC);

-- Guarded statement FK (composite). Added only if org_b2b_statements_mst
-- exposes a unique on (id, tenant_org_id). VERIFY before apply and keep it.
DO $add_stmt_fk$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'org_b2b_statements_mst'
      AND c.contype IN ('p', 'u')
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attname::text)
        FROM unnest(c.conkey) k
        JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = k
      ) = ARRAY['id', 'tenant_org_id']::text[]
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_b2b_stmt_pay_statement'
  ) THEN
    ALTER TABLE org_b2b_statement_payments_dtl
      ADD CONSTRAINT fk_b2b_stmt_pay_statement
      FOREIGN KEY (statement_id, tenant_org_id)
      REFERENCES org_b2b_statements_mst (id, tenant_org_id)
      ON DELETE RESTRICT;
    RAISE NOTICE '0380: statement FK added (composite).';
  ELSE
    RAISE NOTICE '0380: statement FK skipped — verify org_b2b_statements_mst PK shape and add manually.';
  END IF;
END
$add_stmt_fk$;

-- RLS
ALTER TABLE org_b2b_statement_payments_dtl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_b2b_stmt_pay_dtl ON org_b2b_statement_payments_dtl;
CREATE POLICY tenant_isolation_org_b2b_stmt_pay_dtl ON org_b2b_statement_payments_dtl
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS service_role_org_b2b_stmt_pay_dtl ON org_b2b_statement_payments_dtl;
CREATE POLICY service_role_org_b2b_stmt_pay_dtl ON org_b2b_statement_payments_dtl
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE org_b2b_statement_payments_dtl IS
  'Audit + idempotency detail for B2B statement payments (F-04/F-02, mig 0380). One row per applied statement allocation; voucher line remains authoritative posting.';

COMMIT;

-- ------------------------------------------------------------------
-- Rollback (RESTRICT only — no CASCADE):
--   BEGIN;
--     DROP TABLE IF EXISTS org_b2b_statement_payments_dtl RESTRICT;
--   COMMIT;
-- ==================================================================