-- =============================================================================
-- 0851_bg_jobs_fin_tenant_run_now.sql
-- Background Jobs step 6g (docs/features/Background_Jobs/STEP6_PLAN.md):
-- "run now" for ONE Organization from its own screens (gift cards, credit notes, loyalty).
--
-- Purpose:   The daily expiries run for every Organization (6a). An Organization closing a month
--            wants its expired cards, notes and points posted before then. The three due/run
--            functions get an optional Organization filter so the tenant app can run the same
--            rules for that Organization only. NULL keeps today's behaviour (every Organization).
-- Affected:  fn_fin_gift_card_exp_due, fn_fin_loyalty_exp_due, fn_fin_credit_note_expiry_run
--            (signature + filter); sys_auth_permissions + sys_auth_role_default_permissions
--            (stored_value:expire_credit_notes, loyalty:expire_points).
-- Callers:   web-admin finance-expiry-jobs.service.ts (gift card, loyalty: `fn(100::int)` still
--            resolves to the new signature through the default); pg_cron fin-credit-note-expiry
--            (`fn_fin_credit_note_expiry_run()` still resolves through the default).
-- Bodies:    copied from the live definitions (0805 / 0823 / 0840 / 0846) with one added predicate.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- The old one-argument versions are dropped, not overloaded: with both present a call such as
-- fn_fin_gift_card_exp_due(100) would be ambiguous. RESTRICT: nothing in the schema depends on them.
DROP FUNCTION IF EXISTS public.fn_fin_gift_card_exp_due(INTEGER) RESTRICT;
DROP FUNCTION IF EXISTS public.fn_fin_loyalty_exp_due(INTEGER) RESTRICT;
DROP FUNCTION IF EXISTS public.fn_fin_credit_note_expiry_run() RESTRICT;

-- -----------------------------------------------------------------------------
-- Gift cards: due card identities, optionally for one Organization.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.fn_fin_gift_card_exp_due(
  p_limit         INTEGER DEFAULT 100,
  p_tenant_org_id UUID    DEFAULT NULL
)
RETURNS TABLE (tenant_org_id UUID, gift_card_id UUID)
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
    AND (p_tenant_org_id IS NULL OR g.tenant_org_id = p_tenant_org_id)
    AND g.is_active
    AND g.rec_status = 1
    AND g.status IN ('ACTIVE', 'PARTIALLY_REDEEMED', 'GENERATED')
    AND g.expiry_date IS NOT NULL
    AND g.expiry_date <= pg_catalog.now()
  ORDER BY g.expiry_date, g.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

COMMENT ON FUNCTION public.fn_fin_gift_card_exp_due(INTEGER, UUID) IS
  'Service-role-only: up to 100 due gift-card identities (active Organizations, expiry_date passed) for the expireGiftCard poster. p_tenant_org_id NULL = every Organization (daily fin.gift_card_expiry.sweep); set = that Organization only (its Gift cards screen, step 6g). Changes nothing itself.';
-- Service role only: the tenant app calls it from a permission-checked server action.
REVOKE ALL ON FUNCTION public.fn_fin_gift_card_exp_due(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fin_gift_card_exp_due(INTEGER, UUID) TO service_role;

-- -----------------------------------------------------------------------------
-- Loyalty: (Organization, account) pairs holding expired open points.
-- Uses idx_loyalty_txn_open_lots (tenant_org_id, account_id, created_at) WHERE remaining_points > 0.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.fn_fin_loyalty_exp_due(
  p_limit         INTEGER DEFAULT 100,
  p_tenant_org_id UUID    DEFAULT NULL
)
RETURNS TABLE (tenant_org_id UUID, account_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT l.tenant_org_id, l.account_id
  FROM public.org_loyalty_txn_dtl l
  JOIN public.org_loyalty_programs_cf p
    ON p.tenant_org_id = l.tenant_org_id
   AND p.is_active
   AND p.rec_status = 1
   AND p.points_expiry_days > 0
  JOIN public.org_tenants_mst t
    ON t.id = l.tenant_org_id
   AND t.is_active
   AND t.rec_status = 1
  WHERE l.remaining_points > 0
    AND (p_tenant_org_id IS NULL OR l.tenant_org_id = p_tenant_org_id)
    AND l.created_at < pg_catalog.now() - pg_catalog.make_interval(days => p.points_expiry_days)
  GROUP BY l.tenant_org_id, l.account_id
  ORDER BY l.tenant_org_id, l.account_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

COMMENT ON FUNCTION public.fn_fin_loyalty_exp_due(INTEGER, UUID) IS
  'Service-role-only: up to 100 (Organization, loyalty account) pairs holding open points older than the program''s points_expiry_days, active Organizations and programs only. p_tenant_org_id NULL = every Organization (daily fin.loyalty_expiry.sweep); set = that Organization only (its Loyalty screen, step 6g).';
-- Service role only, as above.
REVOKE ALL ON FUNCTION public.fn_fin_loyalty_exp_due(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fin_loyalty_exp_due(INTEGER, UUID) TO service_role;

-- -----------------------------------------------------------------------------
-- Credit notes: the run itself (pure database), optionally for one Organization.
-- One savepoint per note; a note that fails is counted and left for the next run.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.fn_fin_credit_note_expiry_run(p_tenant_org_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE
  r              RECORD;
  v_outcome      TEXT;
  v_expired      INTEGER := 0;
  v_skipped      INTEGER := 0;
  v_failed       INTEGER := 0;  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call)
  v_zone_missing INTEGER := 0;
BEGIN
  FOR r IN
    SELECT n.tenant_org_id, n.id
      FROM public.org_credit_notes_mst n
      JOIN public.org_tenants_mst t
        ON t.id = n.tenant_org_id
       AND t.is_active
       AND t.rec_status = 1
     WHERE n.tenant_org_id = t.id
       AND (p_tenant_org_id IS NULL OR n.tenant_org_id = p_tenant_org_id)
       AND n.status = 'ACTIVE'
       AND n.is_active
       AND n.rec_status = 1
       AND n.expires_at IS NOT NULL
       AND n.expires_at < public.fn_cmx_dt_today_or_null(n.tenant_org_id, 'ledger', NULL)
     ORDER BY n.expires_at, n.id
     LIMIT 5000
  LOOP
    BEGIN
      v_outcome := public.fn_fin_credit_note_expire_one(r.tenant_org_id, r.id, true, 'system/credit-note-expiry');
      IF v_outcome IN ('EXPIRED', 'ALREADY_EXPIRED') THEN
        v_expired := v_expired + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'fn_fin_credit_note_expiry_run: credit note % (tenant %) failed: %', r.id, r.tenant_org_id, SQLERRM;
    END;
  END LOOP;
  -- Organizations with dated notes but no ledger zone: their notes cannot be judged due.
  SELECT count(DISTINCT n.tenant_org_id)::INTEGER INTO v_zone_missing  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call)
    FROM public.org_credit_notes_mst n
    JOIN public.org_tenants_mst t ON t.id = n.tenant_org_id AND t.is_active AND t.rec_status = 1
   WHERE n.status = 'ACTIVE' AND n.is_active AND n.rec_status = 1 AND n.expires_at IS NOT NULL
     AND (p_tenant_org_id IS NULL OR n.tenant_org_id = p_tenant_org_id)
     AND public.fn_cmx_dt_zone(n.tenant_org_id, 'ledger', NULL) IS NULL;
  IF v_zone_missing > 0 THEN
    RAISE WARNING 'CLOCK_ZONE_MISSING: % organizations have dated credit notes and no ledger zone; their notes were not checked', v_zone_missing;
  END IF;
  RETURN jsonb_build_object('expired', v_expired, 'skipped', v_skipped, 'failed', v_failed, 'zone_missing', v_zone_missing);
END;
$$;

COMMENT ON FUNCTION public.fn_fin_credit_note_expiry_run(UUID) IS
  'Service-role-only credit note expiry: every ACTIVE note whose expires_at is before the Organization''s ledger-zone today, up to 5,000 a run, each in its own savepoint through fn_fin_credit_note_expire_one. p_tenant_org_id NULL = every Organization (pg_cron fin-credit-note-expiry); set = that Organization only (its Stored value screen, step 6g). Returns {expired, skipped, failed, zone_missing}.';
-- Service role only, as above.
REVOKE ALL ON FUNCTION public.fn_fin_credit_note_expiry_run(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fin_credit_note_expiry_run(UUID) TO service_role;

-- -----------------------------------------------------------------------------
-- Permissions for the two new buttons. Gift cards reuse gift_cards:expire and ERP
-- "Retry all" reuses erp_lite_exceptions:retry (the same actions, done in bulk).
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('stored_value:expire_credit_notes', 'Expire Due Credit Notes', 'إنهاء إشعارات الدائن المستحقة', 'actions',
   'Expire this Organization''s credit notes that are past their expiry date now, instead of waiting for the nightly run',
   'إنهاء إشعارات الدائن لهذه المنشأة التي تجاوزت تاريخ انتهائها الآن بدل انتظار التشغيل الليلي',
   'StoredValue', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('loyalty:expire_points', 'Expire Due Loyalty Points', 'إنهاء نقاط الولاء المستحقة', 'actions',
   'Expire this Organization''s loyalty points that are past the program''s expiry period now, instead of waiting for the nightly run',
   'إنهاء نقاط الولاء لهذه المنشأة التي تجاوزت مدة صلاحية البرنامج الآن بدل انتظار التشغيل الليلي',
   'Loyalty', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status,
  updated_at    = CURRENT_TIMESTAMP;

-- Re-enable any existing default rows for the base admin roles.
UPDATE public.sys_auth_role_default_permissions
SET is_enabled = true,
    is_active  = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code IN ('stored_value:expire_credit_notes', 'loyalty:expire_points');

-- Insert the missing default rows (no rows when a role does not exist).
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code IN ('stored_value:expire_credit_notes', 'loyalty:expire_points')
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- Rebuild the effective-permission cache of users who hold those roles, so the buttons show
-- without waiting for their next role change (same pattern as 0815).
DO $$
DECLARE
  v_user RECORD;
  v_n    INTEGER := 0;
BEGIN
  FOR v_user IN
    SELECT DISTINCT ur.user_id, ur.tenant_org_id
      FROM public.org_auth_user_roles ur
     WHERE ur.role_code IN ('super_admin', 'tenant_admin', 'admin')
       AND ur.is_active = TRUE
       AND COALESCE(ur.rec_status, 1) = 1
  LOOP
    PERFORM public.cmx_rebuild_user_permissions(v_user.user_id, v_user.tenant_org_id);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE '0851: effective permissions rebuilt for % user/tenant rows', v_n;
END $$;

COMMIT;
