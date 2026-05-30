-- ==================================================================
-- 0330_phase5_order_history_bvm_action_types.sql
-- Purpose: BVM Wiring Phase 5 — extend org_order_history to record BVM
--          outbox-driven events (ORDER_COMPLETED, VOUCHER_POSTED_AND_WIRED,
--          AR_INVOICE_ISSUED) and guarantee consumer idempotency.
-- Plan: docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md § Phase 5
-- PRD: CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md §22
-- Dependencies:
--   0022_order_history_canonical.sql        — base table + chk_history_action_type
--   0133_order_history_action_types_cancel_return.sql — extended action types
--   0292_outbox_idempotency.sql              — org_domain_events_outbox
-- ==================================================================
-- WHY this migration is safe (no DROP CASCADE, no data loss):
--   • We DROP a CHECK constraint with RESTRICT and re-add it in the same
--     transaction — no dependents exist on a CHECK constraint, so this is
--     a no-op for downstream objects.
--   • We add ONE nullable column (outbox_event_id) with a partial unique
--     index — additive only.
--   • Existing rows have outbox_event_id IS NULL by default and are not
--     subject to the unique constraint.
--   • The new action types are additive enum values; existing rows still
--     satisfy the new CHECK (their action_type was valid before).
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Step 1 — Extend chk_history_action_type with the 3 BVM action types
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE org_order_history DROP CONSTRAINT IF EXISTS chk_history_action_type;

ALTER TABLE org_order_history
  ADD CONSTRAINT chk_history_action_type
  CHECK (action_type IN (
    -- Legacy (mig 0022 + 0133)
    'ORDER_CREATED',
    'STATUS_CHANGE',
    'FIELD_UPDATE',
    'SPLIT',
    'QA_DECISION',
    'ITEM_STEP',
    'ISSUE_CREATED',
    'ISSUE_SOLVED',
    'ORDER_CANCELLED',
    'CUSTOMER_RETURN',
    -- BVM Phase 5 (outbox-driven, written asynchronously by
    -- order-history-consumer.service.ts after the order/voucher transaction
    -- commits; never inside the submit-order tx)
    'ORDER_COMPLETED',
    'VOUCHER_POSTED_AND_WIRED',
    'AR_INVOICE_ISSUED'
  ));

COMMENT ON COLUMN org_order_history.action_type IS
  'Action type. Legacy: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED, ORDER_CANCELLED, CUSTOMER_RETURN. BVM Phase 5 (outbox-driven): ORDER_COMPLETED, VOUCHER_POSTED_AND_WIRED, AR_INVOICE_ISSUED.';

-- ──────────────────────────────────────────────────────────────────
-- Step 2 — Add outbox_event_id for consumer idempotency
-- ──────────────────────────────────────────────────────────────────
-- The consumer (lib/services/order-history-consumer.service.ts) ingests
-- rows from org_domain_events_outbox. To survive retries (worker may
-- re-claim a FAILED row and re-process), the history insert MUST be
-- idempotent on (tenant_org_id, outbox_event_id). NULL allowed for
-- legacy / non-outbox sources (status-transition trigger, manual
-- log_order_action() calls, etc.).

ALTER TABLE org_order_history
  ADD COLUMN IF NOT EXISTS outbox_event_id UUID NULL;

COMMENT ON COLUMN org_order_history.outbox_event_id IS
  'When this history row was produced by the outbox-history consumer, the source org_domain_events_outbox.id. NULL for legacy / trigger / direct log_order_action() writes. Used together with tenant_org_id as the consumer idempotency key.';

-- FK to the outbox row (ON DELETE SET NULL — outbox rows are TTL-cleaned
-- by a background sweep; we must not orphan a history row when the
-- source event is reclaimed).
ALTER TABLE org_order_history
  ADD CONSTRAINT fk_history_outbox_event
  FOREIGN KEY (outbox_event_id)
  REFERENCES org_domain_events_outbox(id)
  ON DELETE SET NULL;

-- Partial unique index — only enforces uniqueness on rows that came from
-- the outbox consumer. Multiple legacy rows can have outbox_event_id =
-- NULL without conflict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_history_outbox_event
  ON org_order_history (tenant_org_id, outbox_event_id)
  WHERE outbox_event_id IS NOT NULL;

-- Lookup index for consumer fast-path (skip already-written events).
CREATE INDEX IF NOT EXISTS idx_history_outbox_event
  ON org_order_history (outbox_event_id)
  WHERE outbox_event_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- Step 3 — Validation
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_constraint_count INTEGER;
  v_column_exists BOOLEAN;
  v_unique_idx_exists BOOLEAN;
  v_fk_exists BOOLEAN;
BEGIN
  -- CHECK constraint must allow ORDER_COMPLETED
  SELECT COUNT(*) INTO v_constraint_count
  FROM information_schema.check_constraints
  WHERE constraint_name = 'chk_history_action_type'
    AND check_clause LIKE '%ORDER_COMPLETED%';

  IF v_constraint_count = 0 THEN
    RAISE EXCEPTION 'chk_history_action_type does not include ORDER_COMPLETED';
  END IF;

  -- Column must exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_order_history' AND column_name = 'outbox_event_id'
  ) INTO v_column_exists;

  IF NOT v_column_exists THEN
    RAISE EXCEPTION 'org_order_history.outbox_event_id column missing';
  END IF;

  -- Unique idx must exist
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'org_order_history'
      AND indexname = 'uq_history_outbox_event'
  ) INTO v_unique_idx_exists;

  IF NOT v_unique_idx_exists THEN
    RAISE EXCEPTION 'uq_history_outbox_event partial unique index missing';
  END IF;

  -- FK must exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_history_outbox_event'
      AND table_name = 'org_order_history'
  ) INTO v_fk_exists;

  IF NOT v_fk_exists THEN
    RAISE EXCEPTION 'fk_history_outbox_event constraint missing';
  END IF;

  RAISE NOTICE '✓ Migration 0330 validation passed';
  RAISE NOTICE '  - chk_history_action_type extended with 3 BVM types';
  RAISE NOTICE '  - outbox_event_id column added with FK + partial unique index';
END $$;

COMMIT;

-- ==================================================================
-- POST-MIGRATION NOTES
-- ==================================================================
-- 1. After applying, run:    cd web-admin && npx prisma db pull && npx prisma generate
--    to refresh the Prisma client with the new column.
-- 2. The consumer service is at lib/services/order-history-consumer.service.ts.
--    It can be invoked by:
--      - the outbox worker (cron job mig 0296) for normal processing;
--      - a manual replay API for back-fill.
-- 3. Legacy history rows continue to work unchanged (NULL outbox_event_id).
-- 4. To rollback: DROP COLUMN org_order_history.outbox_event_id (cascade
--    drops the partial unique idx and FK automatically) and re-issue the
--    pre-Phase-5 CHECK constraint from mig 0133.
