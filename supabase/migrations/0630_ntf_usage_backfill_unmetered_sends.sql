-- Notification Hub: back-fill usage for sends that were delivered but never metered.
--
-- Until migration 0623, fn_ntf_meter_usage_atomic failed on every call (an ambiguous column reference), so HQ
-- sends delivered before that fix left no row in org_ntf_usage_daily. The usage reconciliation report
-- (fn_ntf_usage_reconcile, 0625) lists them: on the live database 3 demo sends (SMS on 2026-10-10, SMS and
-- WhatsApp on 2026-10-14). This migration meters them through the SAME function the dispatcher uses, so:
--   * it is idempotent per command: fn_ntf_meter_usage_atomic claims the command's idempotency key in
--     org_ntf_usage_apply_evt, so running this migration twice (or racing a worker) can never count a send twice;
--   * counters, the idempotency ledger and (if any) the quota reservation are settled exactly as for a live send;
--   * the cost is the catalog cost per unit in effect when the message was sent (0 when no price exists, the
--     same fallback the dispatcher uses).
-- Only SENT, non-test commands older than one hour are touched (a younger command may still be metered by the
-- worker that sent it). Nothing is ever deleted or decreased.
--
-- Affected: org_ntf_usage_apply_evt and org_ntf_usage_daily (rows added through fn_ntf_meter_usage_atomic).
-- Related:  0598_ntf_usage_metering_atomic_idempotent.sql, 0623_ntf_quota_reservation_ledger.sql,
--           0625_ntf_operational_safety.sql (fn_ntf_usage_reconcile)
BEGIN;

DO $$
DECLARE
  r        RECORD;
  v_cost   DECIMAL(19,4);
  v_done   INTEGER := 0;
BEGIN
  FOR r IN
    SELECT l.idempotency_key, l.tenant_org_id, l.channel_code, l.provider_code, l.dispatched_at
      FROM public.hq_ntf_dispatch_log l
     WHERE l.status = 'SENT'
       AND l.is_test = false
       AND l.dispatched_at IS NOT NULL
       AND l.dispatched_at < now() - interval '1 hour'
       -- not yet metered: no idempotency-ledger row for this command in this tenant
       AND NOT EXISTS (
         SELECT 1 FROM public.org_ntf_usage_apply_evt a
          WHERE a.tenant_org_id = l.tenant_org_id AND a.idempotency_key = l.idempotency_key
       )
     ORDER BY l.dispatched_at
  LOOP
    -- Catalog cost per unit in effect at send time (USD, the dispatcher's default currency); 0 when none.
    SELECT p.cost_per_unit INTO v_cost
      FROM public.sys_ntf_pricing_cf p
     WHERE p.channel_code = r.channel_code AND p.provider_code = r.provider_code AND p.currency_code = 'USD'
       AND p.is_active AND p.rec_status = 1
       AND p.effective_from <= r.dispatched_at AND (p.effective_to IS NULL OR p.effective_to > r.dispatched_at)
     ORDER BY p.effective_from DESC
     LIMIT 1;

    PERFORM public.fn_ntf_meter_usage_atomic(
      r.idempotency_key, r.tenant_org_id, r.channel_code, r.provider_code,
      'USD', (r.dispatched_at AT TIME ZONE 'UTC')::DATE,   -- same UTC day the reconciliation report uses
      'SENT', 1, 0, COALESCE(v_cost, 0)
    );
    v_done := v_done + 1;
  END LOOP;

  RAISE NOTICE '0630: back-filled usage for % unmetered sent command(s)', v_done;
END $$;

COMMIT;
