-- =============================================================================
-- Migration: 0805_fin_gift_card_expiry_due.sql
-- Purpose:   S1 due-row claim for gift-card expiry. Returns identity only.
--            The existing expireGiftCard poster writes the EXPIRE ledger row
--            and the GL journal. This migration does not expire a card.
-- Affected:  fn_fin_gift_card_exp_due; sys_ops_job_cf row fin-gift-card-expiry
-- Related:   0296 status-only fn_expire_gift_cards stays unused.
--            0792 left the job desired off. It stays desired off.
-- Safety:    DRAFT ONLY. Review and apply manually. No cron schedule.
--            No new index until EXPLAIN on the due predicate.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- Due cards only. A second call after the poster runs returns the next batch.
-- Cap is 100 so one pass cannot scan the whole table into the application.
CREATE FUNCTION public.fn_fin_gift_card_exp_due(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  tenant_org_id UUID,
  gift_card_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT g.tenant_org_id, g.id
  FROM public.org_gift_cards_mst g
  JOIN public.org_tenants_mst t
    ON t.id = g.tenant_org_id
   AND t.is_active
   AND t.rec_status = 1
  WHERE g.tenant_org_id = t.id
    AND g.is_active
    AND g.rec_status = 1
    AND g.status IN ('ACTIVE', 'PARTIALLY_REDEEMED', 'GENERATED')
    AND g.expiry_date IS NOT NULL
    AND g.expiry_date <= pg_catalog.now()
  ORDER BY g.expiry_date, g.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

COMMENT ON FUNCTION public.fn_fin_gift_card_exp_due(INTEGER) IS
  'Due gift-card identities for the existing expireGiftCard poster. Does not change status, write a ledger row, or post a journal. service_role only. Batch cap 100.';

REVOKE ALL ON FUNCTION public.fn_fin_gift_card_exp_due(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fin_gift_card_exp_due(INTEGER) TO service_role;

UPDATE public.sys_ops_job_cf
SET notes = '0805 due claim is fn_fin_gift_card_exp_due. The poster is expireGiftCard (ledger plus GL). Desired off. Do not call the tenant app. Do not run fn_expire_gift_cards.',
    updated_at = pg_catalog.now(),
    updated_info = '0805 gift-card due claim'
WHERE job_code = 'fin-gift-card-expiry'
  AND rec_status = 1;

COMMIT;
