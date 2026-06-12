-- Migration 0360: Phase 6 legacy overpayment cleanup (single migration)
-- Approved_By_Jh
--
-- Part A — Align applied 0354 audit table to ADR-047 target:
--   org_order_overpay_disp_dtl + disposition_type  →  org_fin_overpay_disp_dtl + resolution_code
--   (Skipped when org_fin_overpay_disp_dtl already exists, e.g. fresh 0354 from current repo file.)
--
-- Part B — Backfill org_orders_mst.overpaid_amount:
--   max(gross_overpay - change_returned - disposed_overpayment, 0)
--
-- Catalog note: RETURN_CHANGE (sys_fin_rcpt_fb_dest_cd) is allocation fallback;
-- RETURN_CASH_CHANGE (sys_fin_overpay_res_cd) is checkout overpayment resolution.

BEGIN;

COMMENT ON COLUMN public.org_orders_mst.overpaid_amount IS
  'Unresolved applied excess only: max(gross_overpay - change_returned - disposed_overpayment, 0). Phase 6 backfill 0360.';

COMMENT ON TABLE public.sys_fin_rcpt_fb_dest_cd IS
  'Receipt allocation fallback destinations. RETURN_CHANGE here is allocation fallback, not sys_fin_overpay_res_cd RETURN_CASH_CHANGE.';

COMMENT ON TABLE public.sys_fin_overpay_res_cd IS
  'Checkout overpayment resolution catalog. Canonical cash change code is RETURN_CASH_CHANGE (ADR-047).';

DO $migration$
BEGIN
  -- ------------------------------------------------------------------
  -- Part A: legacy 0354 schema align
  -- ------------------------------------------------------------------
  IF to_regclass('public.org_fin_overpay_disp_dtl') IS NULL
     AND to_regclass('public.org_order_overpay_disp_dtl') IS NOT NULL THEN

    ALTER TABLE public.org_order_overpay_disp_dtl
      RENAME TO org_fin_overpay_disp_dtl;

    ALTER TABLE public.org_fin_overpay_disp_dtl
      RENAME COLUMN disposition_type TO resolution_code;

    UPDATE public.org_fin_overpay_disp_dtl
    SET resolution_code = CASE resolution_code
      WHEN 'RETURN_CHANGE' THEN 'RETURN_CASH_CHANGE'
      WHEN 'TO_WALLET' THEN 'RESTORE_STORED_VALUE'
      WHEN 'TO_ADVANCE' THEN 'SAVE_AS_CUSTOMER_ADVANCE'
      WHEN 'TO_CREDIT_NOTE' THEN 'SAVE_AS_CUSTOMER_CREDIT'
      ELSE resolution_code
    END;

    ALTER TABLE public.org_fin_overpay_disp_dtl
      DROP CONSTRAINT IF EXISTS org_order_overpay_disp_dtl_type_chk RESTRICT;

    ALTER TABLE public.org_fin_overpay_disp_dtl
      ADD CONSTRAINT org_fin_overpay_disp_res_chk
      CHECK (resolution_code IN (
        'REDUCE_PAYMENT',
        'RETURN_CASH_CHANGE',
        'VOID_OR_REFUND_EXCESS',
        'SAVE_AS_CUSTOMER_ADVANCE',
        'SAVE_AS_CUSTOMER_CREDIT',
        'RESTORE_STORED_VALUE',
        'ALLOCATE_TO_CUSTOMER_BALANCES',
        'AUTO_ALLOCATE_TO_CUSTOMER_BALANCES'
      ));

    ALTER TABLE public.org_fin_overpay_disp_dtl
      ADD COLUMN IF NOT EXISTS voucher_trx_line_id UUID;

    DROP INDEX IF EXISTS public.uq_ord_overpay_disp_idempotency RESTRICT;
    DROP INDEX IF EXISTS public.uq_ord_overpay_disp_idempotency_simple RESTRICT;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_overpay_disp_idempotency
      ON public.org_fin_overpay_disp_dtl (tenant_org_id, idempotency_key, resolution_code, cash_leg_ref)
      WHERE idempotency_key IS NOT NULL AND resolution_code = 'RETURN_CASH_CHANGE';

    CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_overpay_disp_idempotency_simple
      ON public.org_fin_overpay_disp_dtl (tenant_org_id, idempotency_key, resolution_code)
      WHERE idempotency_key IS NOT NULL AND resolution_code <> 'RETURN_CASH_CHANGE';

    ALTER INDEX IF EXISTS idx_ord_overpay_disp_tenant
      RENAME TO idx_fin_overpay_disp_tenant;
    ALTER INDEX IF EXISTS idx_ord_overpay_disp_tenant_order
      RENAME TO idx_fin_overpay_disp_tenant_order;
    ALTER INDEX IF EXISTS idx_ord_overpay_disp_tenant_created
      RENAME TO idx_fin_overpay_disp_tenant_created;

    DROP POLICY IF EXISTS tenant_isolation_org_order_overpay_disp_dtl ON public.org_fin_overpay_disp_dtl;
    DROP POLICY IF EXISTS service_role_org_order_overpay_disp_dtl ON public.org_fin_overpay_disp_dtl;

    DROP POLICY IF EXISTS tenant_isolation_org_fin_overpay_disp_dtl ON public.org_fin_overpay_disp_dtl;
    CREATE POLICY tenant_isolation_org_fin_overpay_disp_dtl ON public.org_fin_overpay_disp_dtl
      FOR ALL
      USING (tenant_org_id = current_tenant_id())
      WITH CHECK (tenant_org_id = current_tenant_id());

    DROP POLICY IF EXISTS service_role_org_fin_overpay_disp_dtl ON public.org_fin_overpay_disp_dtl;
    CREATE POLICY service_role_org_fin_overpay_disp_dtl ON public.org_fin_overpay_disp_dtl
      FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role')
      WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

    COMMENT ON TABLE public.org_fin_overpay_disp_dtl IS
      'Audit/index for checkout excess resolution. Authoritative posting is on org_fin_voucher_trx_lines_dtl.';
    COMMENT ON COLUMN public.org_fin_overpay_disp_dtl.resolution_code IS
      'sys_fin_overpay_res_cd.resolution_code — how excess was resolved at checkout.';
    COMMENT ON COLUMN public.org_fin_overpay_disp_dtl.voucher_trx_line_id IS
      'Optional link to the BVM line that posted this resolution effect.';

    RAISE NOTICE '0360 Part A: aligned org_order_overpay_disp_dtl → org_fin_overpay_disp_dtl.';
  ELSIF to_regclass('public.org_fin_overpay_disp_dtl') IS NOT NULL THEN
    RAISE NOTICE '0360 Part A: org_fin_overpay_disp_dtl already present — align skipped.';
  ELSE
    RAISE NOTICE '0360 Part A: no disposition audit table — align skipped.';
  END IF;

  -- ------------------------------------------------------------------
  -- Part B: overpaid_amount backfill (always runs)
  -- ------------------------------------------------------------------
  IF to_regclass('public.org_fin_overpay_disp_dtl') IS NOT NULL THEN
    EXECUTE $sql$
      WITH payment_totals AS (
        SELECT
          p.tenant_org_id,
          p.order_id,
          COALESCE(SUM(p.amount) FILTER (
            WHERE UPPER(COALESCE(p.payment_status, '')) IN ('COMPLETED', 'CAPTURED', 'SETTLED')
          ), 0)::numeric(19,4) AS total_paid_amount,
          COALESCE(SUM(p.change_returned_amount), 0)::numeric(19,4) AS change_returned_amount
        FROM public.org_order_payments_dtl p
        WHERE COALESCE(p.is_active, true) = true
        GROUP BY p.tenant_org_id, p.order_id
      ),
      credit_totals AS (
        SELECT
          c.tenant_org_id,
          c.order_id,
          COALESCE(SUM(c.applied_amount) FILTER (
            WHERE UPPER(COALESCE(c.application_status, 'APPLIED')) = 'APPLIED'
          ), 0)::numeric(19,4) AS total_credit_applied_amount
        FROM public.org_order_credit_apps_dtl c
        WHERE COALESCE(c.is_active, true) = true
        GROUP BY c.tenant_org_id, c.order_id
      ),
      disposition_totals AS (
        SELECT
          d.tenant_org_id,
          d.order_id,
          COALESCE(SUM(d.amount), 0)::numeric(19,4) AS disposed_overpayment_amount
        FROM public.org_fin_overpay_disp_dtl d
        WHERE COALESCE(d.is_active, true) = true
        GROUP BY d.tenant_org_id, d.order_id
      ),
      recalc AS (
        SELECT
          o.id AS order_id,
          o.tenant_org_id,
          ROUND(
            GREATEST(
              GREATEST(
                COALESCE(pt.total_paid_amount, 0) + COALESCE(ct.total_credit_applied_amount, 0)
                - COALESCE(o.total_amount, 0),
                0
              )
              - COALESCE(pt.change_returned_amount, 0)
              - COALESCE(dt.disposed_overpayment_amount, 0),
              0
            ),
            4
          ) AS new_overpaid_amount
        FROM public.org_orders_mst o
        LEFT JOIN payment_totals pt
          ON pt.tenant_org_id = o.tenant_org_id AND pt.order_id = o.id
        LEFT JOIN credit_totals ct
          ON ct.tenant_org_id = o.tenant_org_id AND ct.order_id = o.id
        LEFT JOIN disposition_totals dt
          ON dt.tenant_org_id = o.tenant_org_id AND dt.order_id = o.id
        WHERE COALESCE(o.rec_status, 1) = 1
      )
      UPDATE public.org_orders_mst o
      SET
        overpaid_amount = r.new_overpaid_amount,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = 'migration_0360'
      FROM recalc r
      WHERE o.id = r.order_id
        AND o.tenant_org_id = r.tenant_org_id
        AND ABS(COALESCE(o.overpaid_amount, 0) - r.new_overpaid_amount) > 0.001
    $sql$;

    RAISE NOTICE '0360 Part B: backfill complete (with disposition offsets).';
  ELSE
    EXECUTE $sql$
      WITH payment_totals AS (
        SELECT
          p.tenant_org_id,
          p.order_id,
          COALESCE(SUM(p.amount) FILTER (
            WHERE UPPER(COALESCE(p.payment_status, '')) IN ('COMPLETED', 'CAPTURED', 'SETTLED')
          ), 0)::numeric(19,4) AS total_paid_amount,
          COALESCE(SUM(p.change_returned_amount), 0)::numeric(19,4) AS change_returned_amount
        FROM public.org_order_payments_dtl p
        WHERE COALESCE(p.is_active, true) = true
        GROUP BY p.tenant_org_id, p.order_id
      ),
      credit_totals AS (
        SELECT
          c.tenant_org_id,
          c.order_id,
          COALESCE(SUM(c.applied_amount) FILTER (
            WHERE UPPER(COALESCE(c.application_status, 'APPLIED')) = 'APPLIED'
          ), 0)::numeric(19,4) AS total_credit_applied_amount
        FROM public.org_order_credit_apps_dtl c
        WHERE COALESCE(c.is_active, true) = true
        GROUP BY c.tenant_org_id, c.order_id
      ),
      recalc AS (
        SELECT
          o.id AS order_id,
          o.tenant_org_id,
          ROUND(
            GREATEST(
              GREATEST(
                COALESCE(pt.total_paid_amount, 0) + COALESCE(ct.total_credit_applied_amount, 0)
                - COALESCE(o.total_amount, 0),
                0
              )
              - COALESCE(pt.change_returned_amount, 0),
              0
            ),
            4
          ) AS new_overpaid_amount
        FROM public.org_orders_mst o
        LEFT JOIN payment_totals pt
          ON pt.tenant_org_id = o.tenant_org_id AND pt.order_id = o.id
        LEFT JOIN credit_totals ct
          ON ct.tenant_org_id = o.tenant_org_id AND ct.order_id = o.id
        WHERE COALESCE(o.rec_status, 1) = 1
      )
      UPDATE public.org_orders_mst o
      SET
        overpaid_amount = r.new_overpaid_amount,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = 'migration_0360'
      FROM recalc r
      WHERE o.id = r.order_id
        AND o.tenant_org_id = r.tenant_org_id
        AND ABS(COALESCE(o.overpaid_amount, 0) - r.new_overpaid_amount) > 0.001
    $sql$;

    RAISE NOTICE '0360 Part B: backfill complete (no disposition table).';
  END IF;
END $migration$;

COMMIT;
