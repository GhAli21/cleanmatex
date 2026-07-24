-- =============================================================================
-- 0426_b08_gateway_lifecycle_integration.sql
-- B08 — Gateway Lifecycle Integration
-- (Order Fin Remediation, Remediation_Work_Packages)
--
-- Purpose:
--   1. Add dedicated actor-audit columns (captured_by/at, settled_by/at) to
--      org_order_payments_dtl for the two new CAPTURE (AUTHORIZED->CAPTURED)
--      and SETTLE (CAPTURED->SETTLED) back-office/webhook-driven transitions
--      — mirrors migration 0415/0421's verified_by/voided_by precedent.
--      Nullable: a webhook-driven transition has no interactive human actor
--      (the provenance is the linked sys_gw_webhook_events_tr row instead);
--      a manual re-sync via the shared transition dialog still writes a real
--      actor id.
--   2. Create sys_gw_webhook_events_tr — the inbound gateway-webhook event
--      log + dedup ledger (D010 "job/outbox handlers keyed by event id").
--      System-level (sys_ prefix, no tenant_org_id NOT NULL / no RLS): the
--      route receives one event stream per gateway TYPE across potentially
--      many tenants, and the tenant is only knowable AFTER the event is
--      matched to a payment leg by gateway_transaction_id/gateway_reference
--      — genuinely unresolved for UNMATCHED/REJECTED_SIGNATURE events.
--   3. Extend chk_history_action_type with PAYMENT_CAPTURED / PAYMENT_SETTLED
--      so the outbox-driven history consumer can persist the two new
--      transition outcomes (mirrors 0421's PAYMENT_VOIDED/PAYMENT_REVERSED
--      addition).
--
-- No new permission codes: per B08's own doc, the manual re-sync path (an
-- operator manually applying CAPTURE/SETTLE when no webhook arrives) reuses
-- the existing `orders:verify_payment` code — both are "confirm gateway
-- progress" actions in the same spirit as VERIFY, not a distinct capability.
--
-- Where the per-tenant, per-gateway webhook signing secret lives: NOT a new
-- table. `org_payment_methods_cf.gateway_config` JSONB (migration 0269)
-- already documents the `*_webhook_secret`-suffixed key convention for
-- exactly this purpose — reused as `webhook_secret` there. `org_payment_gateway_cf`
-- does not exist anywhere in this codebase (confirmed by repo-wide grep); a
-- few stale JSDoc comments and one dead Jest mock reference it, corrected in
-- the same commit as this migration's application code, not here.
--
-- Decisions: D001 (transition graph — AUTHORIZED -> CAPTURED -> SETTLED),
--            D009 (gateway failure before confirmation -> RETRY_TENDER,
--            reuses the existing FAIL_BOUNCE action unchanged), D010
--            (idempotency/event-dedup keyed by provider event id).
-- Dependencies:
--   0421_b10_payment_reversal_and_void.sql              — actor-audit column + chk_history_action_type precedent
--   0410_b07_financial_outbox_processor.sql              — sys_*_runtime-config-table precedent (pattern reference only; this table is a log, not secrets)
-- Work packages:
--   docs/features/Order_Fin/Remediation_Work_Packages/B08_Gateway_Lifecycle_Integration.md
--
-- WHY this migration is safe:
--   • New columns are nullable, additive — no backfill, no existing-row impact.
--   • New table is additive; nothing reads/writes it before this migration.
--   • CHECK constraint dropped with RESTRICT and re-added in the same
--     transaction (proves no dependent objects); new values are additive
--     so every existing row still satisfies the new constraint.
--
-- Dormant-by-design note: no gateway configuration in this codebase creates
-- a leg at AUTHORIZED today (order-settlement-planner.service.ts's
-- resolveDefaultStatus only ever returns PENDING/PROCESSING/COMPLETED for a
-- gateway leg) — so CAPTURE/SETTLE cannot fire from any live path yet. They
-- are real, tested, reachable capability (D001's approved graph explicitly
-- assigns this "gateway sub-lifecycle mapping" to B08) reserved for when an
-- auth-then-capture gateway configuration is introduced — same "reserve the
-- room, ship no dead branch on the live path" precedent as B03's
-- SV_FUNDING PROCESSING status. Today's only real gateway path (PROCESSING)
-- is driven by this package's webhook straight through the EXISTING
-- VERIFY/FAIL_BOUNCE actions.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Actor-audit columns on org_order_payments_dtl (CAPTURE / SETTLE)
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS captured_by UUID NULL,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS settled_by  UUID NULL,
  ADD COLUMN IF NOT EXISTS settled_at  TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.org_order_payments_dtl.captured_by IS
  'B08 — actor who transitioned this leg AUTHORIZED -> CAPTURED via the back-office/webhook transition service (payment-transition.service.ts). NULL when the transition was driven by a verified gateway webhook (system actor) rather than a manual re-sync — provenance in that case is the linked sys_gw_webhook_events_tr row, not a human actor id.';
COMMENT ON COLUMN public.org_order_payments_dtl.settled_at IS
  'B08 — actor/timestamp of the transition CAPTURED -> SETTLED (funds settlement confirmation). NULL actor for webhook-driven transitions — see captured_by comment.';

-- -----------------------------------------------------------------------------
-- 2. Gateway webhook event log + dedup ledger
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sys_gw_webhook_events_tr (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_code        TEXT NOT NULL REFERENCES public.sys_payment_gateway_cd (code),
  provider_event_id   TEXT NOT NULL,
  event_type          TEXT NOT NULL,
  raw_payload         JSONB NOT NULL,
  signature_valid     BOOLEAN NOT NULL DEFAULT FALSE,
  -- Unresolved until the event is matched to a payment leg (see header note).
  tenant_org_id       UUID NULL,
  order_id            UUID NULL,
  payment_id          UUID NULL REFERENCES public.org_order_payments_dtl (id) ON DELETE SET NULL,
  transition_action   TEXT NULL,
  processing_status   TEXT NOT NULL DEFAULT 'RECEIVED',
  error_message       TEXT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at        TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          TEXT NULL,
  updated_at          TIMESTAMPTZ NULL,
  updated_by          TEXT NULL,
  CONSTRAINT uq_gw_webhook_event UNIQUE (gateway_code, provider_event_id),
  CONSTRAINT chk_gw_webhook_processing_status CHECK (processing_status IN (
    'RECEIVED', 'MATCHED', 'TRANSITIONED', 'UNMATCHED',
    'REJECTED_SIGNATURE', 'REJECTED_SCHEMA', 'DUPLICATE', 'ERROR'
  ))
);

COMMENT ON TABLE public.sys_gw_webhook_events_tr IS
  'B08 — audit/dedup log of every inbound gateway webhook event, one row per (gateway_code, provider_event_id). tenant_org_id/order_id/payment_id populated once the event is matched to a leg via gateway_transaction_id/gateway_reference; stays NULL for UNMATCHED/REJECTED_SIGNATURE/REJECTED_SCHEMA events, which by construction cannot be tenant-attributed (the tenant is discovered FROM the match, not before it). System-level (sys_ prefix, no RLS) precisely because a single webhook endpoint per gateway_code serves every tenant configured on that gateway.';
COMMENT ON COLUMN public.sys_gw_webhook_events_tr.provider_event_id IS
  'The gateway-assigned event id from the payload. Unique per gateway_code — the dedup key (D010 "job/outbox handlers keyed by event id"). A replayed webhook with the same id is a no-op, never reprocessed.';
COMMENT ON COLUMN public.sys_gw_webhook_events_tr.processing_status IS
  'RECEIVED (row created) -> MATCHED (leg found) -> TRANSITIONED (transition applied) is the happy path. UNMATCHED = no leg found for the reference (cannot verify signature, logged for ops). REJECTED_SIGNATURE/REJECTED_SCHEMA = rejected before any DB effect. DUPLICATE = provider_event_id already existed (unique-violation caught). ERROR = matched but the transition threw.';

CREATE INDEX IF NOT EXISTS idx_gw_webhook_events_payment
  ON public.sys_gw_webhook_events_tr (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gw_webhook_events_unmatched
  ON public.sys_gw_webhook_events_tr (gateway_code, received_at)
  WHERE processing_status = 'UNMATCHED';

REVOKE ALL ON public.sys_gw_webhook_events_tr FROM anon;

-- -----------------------------------------------------------------------------
-- 3. Extend chk_history_action_type with PAYMENT_CAPTURED / PAYMENT_SETTLED
-- -----------------------------------------------------------------------------

ALTER TABLE public.org_order_history DROP CONSTRAINT IF EXISTS chk_history_action_type RESTRICT;

ALTER TABLE public.org_order_history
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
    -- BVM Phase 5 (outbox-driven)
    'ORDER_COMPLETED',
    'VOUCHER_POSTED_AND_WIRED',
    'AR_INVOICE_ISSUED',
    -- BVM Phase 6 Sub-item 1 (outbox-driven)
    'PAYMENT_VERIFIED',
    -- B30 (migration 0415; outbox-driven)
    'PAYMENT_CANCELLED',
    'PAYMENT_FAILED',
    -- B10 (migration 0421; outbox-driven)
    'PAYMENT_VOIDED',
    'PAYMENT_REVERSED',
    -- B08 (this migration; outbox-driven)
    'PAYMENT_CAPTURED',
    'PAYMENT_SETTLED'
  ));

COMMENT ON COLUMN public.org_order_history.action_type IS
  'Action type. Legacy: ORDER_CREATED, STATUS_CHANGE, FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED, ORDER_CANCELLED, CUSTOMER_RETURN. BVM Phase 5 (outbox-driven): ORDER_COMPLETED, VOUCHER_POSTED_AND_WIRED, AR_INVOICE_ISSUED. BVM Phase 6: PAYMENT_VERIFIED. B30: PAYMENT_CANCELLED, PAYMENT_FAILED. B10: PAYMENT_VOIDED, PAYMENT_REVERSED. B08: PAYMENT_CAPTURED, PAYMENT_SETTLED.';

-- -----------------------------------------------------------------------------
-- 4. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'org_order_payments_dtl' AND column_name IN ('captured_by', 'captured_at', 'settled_by', 'settled_at');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'org_order_payments_dtl actor-audit columns not fully created (found % of 4)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_name = 'sys_gw_webhook_events_tr';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'sys_gw_webhook_events_tr table was not created';
  END IF;

  SELECT COUNT(*) INTO v_count FROM information_schema.check_constraints
  WHERE constraint_name = 'chk_history_action_type'
    AND check_clause LIKE '%PAYMENT_CAPTURED%'
    AND check_clause LIKE '%PAYMENT_SETTLED%';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'chk_history_action_type missing PAYMENT_CAPTURED/PAYMENT_SETTLED';
  END IF;

  RAISE NOTICE '✓ Migration 0426 validation passed';
  RAISE NOTICE '  - captured_by/at + settled_by/at added to org_order_payments_dtl';
  RAISE NOTICE '  - sys_gw_webhook_events_tr created (event log + dedup)';
  RAISE NOTICE '  - chk_history_action_type extended with PAYMENT_CAPTURED, PAYMENT_SETTLED';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Prisma schema.prisma must be hand-updated to mirror the 4 new columns on
--    org_order_payments_dtl and the new sys_gw_webhook_events_tr model (this
--    project maintains schema.prisma by hand, not via `prisma db pull`), then
--    `npx prisma generate` re-run.
-- 2. The transition service (extended, not new) lives at
--    lib/services/payment-transition.service.ts; same routes as B30/B10:
--      GET  /api/v1/finance/pending-payments
--      POST /api/v1/finance/pending-payments/[paymentId]/transition
--    (action: CAPTURE | SETTLE, alongside VERIFY/CANCEL/FAIL_BOUNCE/VOID/REVERSE)
-- 3. New public webhook route: POST /api/v1/payments/gateway/[gatewayCode]/webhook
--    (signature-authenticated, not session-authenticated — see B08's own
--    Completion evidence for the full request/verification flow).
-- 4. Per-tenant webhook secret setup (operator task, not a migration step):
--    add a `webhook_secret` key inside the tenant's
--    `org_payment_methods_cf.gateway_config` JSONB for the
--    (tenant_org_id, payment_method_code, gateway_code) row that should
--    receive live webhook traffic.
-- 5. To rollback: revert chk_history_action_type to the 0421 form, drop
--    sys_gw_webhook_events_tr (+ its 2 indexes), drop the 4 new
--    org_order_payments_dtl columns (all additive/nullable — safe to drop).
-- =============================================================================
