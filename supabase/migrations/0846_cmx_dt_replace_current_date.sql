-- =============================================================================
-- Migration: 0846_cmx_dt_replace_current_date.sql   (S5, pack 0.1.46)
-- Purpose:   G3: live SQL that reads the database session day (CURRENT_DATE,
--            now()::date) now reads the operations zone day through the SQL
--            time API (fn_cmx_dt_*). G21: fn_tenant_general_value('timezone')
--            no longer falls back to the HQ zone for a tenant. G22: credit-note
--            expiry (0840) no longer calls fn_ops_zone directly and handles a
--            missing zone on purpose (skip + CLOCK_ZONE_MISSING), and
--            fn_fin_credit_note_expire_one(.., p_only_if_due => true) can no
--            longer expire a dated note when the zone is missing (it did: the
--            NULL "is_due" fell through). Catalog: active canonical zones the
--            server tzdata does not know (America/Coyhaique, IANA 2025b) and that
--            nobody uses are deactivated.
--
-- How:       Each body is re-read from the LIVE catalog (pg_get_functiondef /
--            pg_get_viewdef), rewritten by the rules below, and re-created with
--            CREATE OR REPLACE. Signature, owner, grants, SECURITY mode,
--            volatility, search_path and comments are kept because they come
--            from the live definition. Every rule states how many matches it
--            expects (counted from the latest migration that defines the
--            object). Any difference = the live body drifted from the files:
--            the migration stops before changing anything and names the object.
--
-- Day rules (D25/D26; §1.2 no fallback):
--   Operational writes/reads  fn_cmx_dt_today(tenant, op, NULL)  -> raises
--                             TIMEZONE_NOT_CONFIGURED when the zone is missing.
--   Health checks and views   fn_cmx_dt_today_or_null(...)       -> a missing
--                             zone leaves date windows open (nothing "expired",
--                             nothing "missing"); CLOCK_ZONE_MISSING reports it.
--   Platform catalogs (HQ)    fn_cmx_dt_today_in(fn_cmx_dt_hq_zone()).
--   now()                     fn_cmx_dt_now() (same transaction instant).
--
-- Objects (latest defining file -> new day source):
--   get_order_number_prefix()            0012  deprecated, unused (A-06): explicit UTC day, unchanged result
--   sys_bill_generate_invoice_number()   0041  HQ zone
--   sys_bill_update_invoice_amount_due() 0041  HQ zone (trigger)
--   seed_tenant_erp_lite_defaults        0197  ledger
--   resolve_fin_tpl_for_tnt              0201  ledger
--   apply_fin_tpl_for_tnt                0222  ledger
--   fn_expire_credit_notes()             0296  ledger or null (orphan since 0505; not scheduled)
--   generate_cash_drawer_sess_no         0519  pos_session DAY key
--   generate_cash_drawer_trx_no          0527  pos_session DAY key
--   seed_product_speed_rules             0720  accept_order
--   fn_shc_speed_no_rules                0709  accept_order (branch) or null
--   fn_shc_cal_holidays_estimated        0716  accept_order (branch) or null
--   fn_shc_cal_holidays_missing          0739  accept_order (branch) or null
--   fn_shc_tax_doc_type_no_rule          0726  invoice or null
--   fn_shc_tax_exemption_expired         0726  invoice or null
--   fn_shc_tax_kit_update_pending        0726  invoice or null
--   fn_tax_kit_apply                     0727  invoice
--   fn_tax_kit_update                    0726  invoice
--   fn_tax_kit_update_all()              0726  HQ zone (kit catalog)
--   fn_tax_kit_version_publish           0726  HQ zone
--   fn_tax_kit_version_clone             0728  HQ zone
--   get_product_price                    0814  p_effective_date DEFAULT NULL -> accept_order day
--   vw_fin_missing_required_usage        0215  ledger or null (per row tenant)
--   vw_fin_coa_explorer                  0834  ledger or null (per row tenant)
--   fn_fin_credit_note_expire_one        0840  G22 (new outcome ZONE_MISSING)
--   fn_fin_credit_note_expiry_run        0840  G22 (result gains zone_missing)
--   fn_tenant_general_value              0668  G21
--   org_speed_price_rules_cf.effective_from   0640  DROP DEFAULT (the writer supplies the civil date)
-- Not changed here: fn_doc_seq_next_by_row / fn_shc_speed_no_express (0831, correct
--   already: zone door + fail closed); hq_* tables (HQ plan H2); get_product_price_with_tax
--   (dropped in 0700); generate_session_no (renamed in 0519).
--
-- Requires:  0842, 0843, 0844 applied; PostgreSQL 15+ (regexp_count). Run as the
--            owner of the objects (postgres), like every migration.
-- Apply:     by the user (D17). Plan: docs/features/Time_and_Timezone/MASTER_PLAN_v2.md §7.1.3.
--            After apply: npm run prisma:pull (org_speed_price_rules_cf.effective_from
--            loses @default) and regenerate the Supabase types (function args unchanged).
--
-- ROLLBACK (manual; only if S5 must be undone):
--   1. BEFORE applying, optionally save the current bodies:
--      docs/features/Time_and_Timezone/technical_docs/s5/0846_preimage.sql prints one
--      CREATE OR REPLACE per object; running that output restores them exactly.
--      Without it, re-run each object's definition from the file named above (and
--      re-apply later ALTERs on it, e.g. 0674 made get_order_number_prefix STABLE).
--   2. ALTER TABLE public.org_speed_price_rules_cf ALTER COLUMN effective_from SET DEFAULT CURRENT_DATE;  -- CLOCK-OK: rollback text
--   3. Re-activate the catalog rows this file switched off:
--      UPDATE public.sys_timezone_cd SET is_active = true, metadata = metadata - 'deactivated_by' - 'deactivated_reason'
--       WHERE metadata ->> 'deactivated_by' = '0846';
-- RE-ACTIVATION RULE (not a rollback): when the server tzdata learns a zone
--   (it appears in pg_timezone_names), run the UPDATE of step 3 restricted to
--   iana_name IN (SELECT name FROM pg_timezone_names). The S13 catalog refresh does this.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. Rewrite rules: (object, kind f=function v=view, step, ARE pattern, replacement, expected matches)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE s5_rule (obj TEXT, kind CHAR(1), step INT, pat TEXT, rep TEXT, expect INT) ON COMMIT DROP;
INSERT INTO s5_rule (obj, kind, step, pat, rep, expect) VALUES
  ('get_order_number_prefix', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_in(''UTC'')', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0012_order_intake_enhancements.sql
  ('sys_bill_generate_invoice_number', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_in(public.fn_cmx_dt_hq_zone())', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0041_sys_bill_billing_subscriptions_complete.sql
  ('sys_bill_update_invoice_amount_due', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_in(public.fn_cmx_dt_hq_zone())', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0041_sys_bill_billing_subscriptions_complete.sql
  ('seed_tenant_erp_lite_defaults', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today(p_tenant_id, ''ledger'', NULL)', 3),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0197_erp_lite_default_seed.sql
  ('resolve_fin_tpl_for_tnt', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today(p_tenant_id, ''ledger'', NULL)', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0201_erp_lite_tpl_apply.sql
  ('apply_fin_tpl_for_tnt', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today(p_tenant_id, ''ledger'', NULL)', 4),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0222_erp_lite_tpl_mat_lineage_wire.sql
  ('fn_expire_credit_notes', 'f', 1, 'now\(\)\s*::\s*date', 'public.fn_cmx_dt_today_or_null(tenant_org_id, ''ledger'', NULL)', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0296_pg_cron_jobs.sql
  ('fn_expire_credit_notes', 'f', 2, '([^.A-Za-z0-9_])now\(\)', '\1public.fn_cmx_dt_now()', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0296_pg_cron_jobs.sql
  ('generate_cash_drawer_sess_no', 'f', 1, 'TO_CHAR\(\s*CURRENT_DATE\s*,\s*''YYYYMMDD''\s*\)', 'public.fn_cmx_dt_period_key(p_tenant_org_id, ''pos_session'', NULL, ''DAY'')', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0519_a1_harden_session_number_generator.sql
  ('generate_cash_drawer_trx_no', 'f', 1, 'TO_CHAR\(\s*CURRENT_DATE\s*,\s*''YYYYMMDD''\s*\)', 'public.fn_cmx_dt_period_key(p_tenant_org_id, ''pos_session'', NULL, ''DAY'')', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0527_clf_drawer_trx_tables.sql
  ('seed_product_speed_rules', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today(p_tenant_org_id, ''accept_order'', NULL)', 3),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0720_seed_speed_rules_units.sql
  ('fn_shc_speed_no_rules', 'f', 1, '([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)(\s*)(<=|>=|<|>)(\s*)CURRENT_DATE\M', '\1\2\3\4COALESCE(public.fn_cmx_dt_today_or_null(p_tenant, ''accept_order'', p_branch), \1)', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0709_setup_health_registry.sql
  ('fn_shc_cal_holidays_estimated', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_or_null(p_tenant, ''accept_order'', p_branch)', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0716_setup_health_cal_holidays.sql
  ('fn_shc_cal_holidays_missing', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_or_null(p_tenant, ''accept_order'', p_branch)', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0739_setup_health_express_and_holiday_coverage.sql
  ('fn_shc_tax_doc_type_no_rule', 'f', 1, '([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)(\s*)(<=|>=|<|>)(\s*)CURRENT_DATE\M', '\1\2\3\4COALESCE(public.fn_cmx_dt_today_or_null(p_tenant, ''invoice'', NULL), \1)', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_shc_tax_exemption_expired', 'f', 1, '([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)(\s*)(<=|>=|<|>)(\s*)CURRENT_DATE\M', '\1\2\3\4COALESCE(public.fn_cmx_dt_today_or_null(p_tenant, ''invoice'', NULL), \1)', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_shc_tax_kit_update_pending', 'f', 1, '([A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*)(\s*)(<=|>=|<|>)(\s*)CURRENT_DATE\M', '\1\2\3\4COALESCE(public.fn_cmx_dt_today_or_null(p_tenant, ''invoice'', NULL), \1)', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_tax_kit_apply', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today(p_tenant, ''invoice'', NULL)', 4),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0727_tax_drop_legacy_columns.sql
  ('fn_tax_kit_apply', 'f', 2, '([^.A-Za-z0-9_])now\(\)', '\1public.fn_cmx_dt_now()', 3),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0727_tax_drop_legacy_columns.sql
  ('fn_tax_kit_update', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today(p_tenant, ''invoice'', NULL)', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_tax_kit_update_all', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_in(public.fn_cmx_dt_hq_zone())', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_tax_kit_update_all', 'f', 2, '([^.A-Za-z0-9_])now\(\)', '\1public.fn_cmx_dt_now()', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_tax_kit_version_publish', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_in(public.fn_cmx_dt_hq_zone())', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_tax_kit_version_publish', 'f', 2, '([^.A-Za-z0-9_])now\(\)', '\1public.fn_cmx_dt_now()', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0726_tax_health_kit_updates.sql
  ('fn_tax_kit_version_clone', 'f', 1, '\mCURRENT_DATE\M', 'public.fn_cmx_dt_today_in(public.fn_cmx_dt_hq_zone())', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0728_tax_kit_facts_verified.sql
  ('get_product_price', 'f', 1, 'DEFAULT\s+CURRENT_DATE\M', 'DEFAULT NULL::date', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0814_uom_measured_pricing_cols.sql
  ('get_product_price', 'f', 2, '([<>]=)\s*p_effective_date\)', '\1 COALESCE(p_effective_date, public.fn_cmx_dt_today(p_tenant_org_id, ''accept_order'', NULL)))', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0814_uom_measured_pricing_cols.sql
  ('vw_fin_missing_required_usage', 'v', 1, '([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(\s*)(<=|>=|<|>)(\s*)CURRENT_DATE\M', '\1.\2\3\4\5COALESCE(public.fn_cmx_dt_today_or_null(\1.tenant_org_id, ''ledger'', NULL), \1.\2)', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0215_erp_lite_readiness_views.sql
  ('vw_fin_coa_explorer', 'v', 1, '([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(\s*)(<=|>=|<|>)(\s*)CURRENT_DATE\M', '\1.\2\3\4\5COALESCE(public.fn_cmx_dt_today_or_null(\1.tenant_org_id, ''ledger'', NULL), \1.\2)', 3),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0834_org_audit_stamps_timestamptz.sql
  ('fn_fin_credit_note_expire_one', 'f', 1, '\(n\.expires_at IS NOT NULL AND n\.expires_at < \(now\(\) AT TIME ZONE public\.fn_ops_zone\(p_tenant_org_id, ''ledger'', NULL\)\)::date\) AS is_due', 'CASE WHEN n.expires_at IS NULL THEN false ELSE n.expires_at < public.fn_cmx_dt_today_or_null(p_tenant_org_id, ''ledger'', NULL) END AS is_due', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0840_credit_note_day_and_claim_instant.sql
  ('fn_fin_credit_note_expire_one', 'f', 2, 'IF p_only_if_due AND NOT v_note\.is_due THEN', 'IF p_only_if_due AND v_note.is_due IS NULL THEN  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call)
    RAISE WARNING ''CLOCK_ZONE_MISSING: credit note % of organization % was not expired: the ledger zone is not configured'', p_credit_note_id, p_tenant_org_id;
    RETURN ''ZONE_MISSING'';
  END IF;
  IF p_only_if_due AND NOT v_note.is_due THEN', 1),
  ('fn_fin_credit_note_expire_one', 'f', 3, '([^.A-Za-z0-9_])now\(\)', '\1public.fn_cmx_dt_now()', 2),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0840_credit_note_day_and_claim_instant.sql
  ('fn_fin_credit_note_expiry_run', 'f', 1, 'n\.expires_at < \(now\(\) AT TIME ZONE public\.fn_ops_zone\(n\.tenant_org_id, ''ledger'', NULL\)\)::date', 'n.expires_at < public.fn_cmx_dt_today_or_null(n.tenant_org_id, ''ledger'', NULL)', 1),  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0840_credit_note_day_and_claim_instant.sql
  ('fn_fin_credit_note_expiry_run', 'f', 2, '(v_failed\s+INTEGER\s*:=\s*0;)', '\1  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call)
  v_zone_missing INTEGER := 0;', 1),
  ('fn_fin_credit_note_expiry_run', 'f', 3, 'RETURN jsonb_build_object\(''expired'', v_expired, ''skipped'', v_skipped, ''failed'', v_failed\);', 'SELECT count(DISTINCT n.tenant_org_id)::INTEGER INTO v_zone_missing  -- CLOCK-OK: S5 rewrite rule (pattern text, not a call)
    FROM public.org_credit_notes_mst n
    JOIN public.org_tenants_mst t ON t.id = n.tenant_org_id AND t.is_active AND t.rec_status = 1
   WHERE n.status = ''ACTIVE'' AND n.is_active AND n.rec_status = 1 AND n.expires_at IS NOT NULL
     AND public.fn_cmx_dt_zone(n.tenant_org_id, ''ledger'', NULL) IS NULL;
  IF v_zone_missing > 0 THEN
    RAISE WARNING ''CLOCK_ZONE_MISSING: % organizations have dated credit notes and no ledger zone; their notes were not checked'', v_zone_missing;
  END IF;
  RETURN jsonb_build_object(''expired'', v_expired, ''skipped'', v_skipped, ''failed'', v_failed, ''zone_missing'', v_zone_missing);', 1),
  ('fn_tenant_general_value', 'f', 1, 'COALESCE\(NULLIF\(t\.timezone, ''''\), h\.timezone\)', 'CASE WHEN p_tenant_id IS NULL THEN h.timezone ELSE NULLIF(t.timezone, '''') END', 1)   -- CLOCK-OK: S5 rewrite rule (pattern text, not a call); source 0668_hq_general_config.sql
;

-- -----------------------------------------------------------------------------
-- 2. Read live definitions, apply the rules, stop on any drift (nothing changed yet).
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE s5_obj (obj TEXT PRIMARY KEY, kind CHAR(1), oid OID, old_def TEXT, new_def TEXT,
                          sec BOOLEAN, cfg TEXT[], vol "char", acl TEXT, relopt TEXT[]) ON COMMIT DROP;

DO $read$
DECLARE
  o       RECORD;
  r       RECORD;
  v_oid   OID;
  v_n     INTEGER;
  v_def   TEXT;
  v_got   INTEGER;
  v_drift TEXT[] := '{}';
BEGIN
  FOR o IN SELECT DISTINCT obj, kind FROM s5_rule ORDER BY obj LOOP
    IF o.kind = 'f' THEN
      SELECT count(*), min(p.oid) INTO v_n, v_oid
        FROM pg_catalog.pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace AND p.proname = o.obj;
      IF v_n <> 1 THEN
        v_drift := v_drift || format('%s: %s functions with this name in public (expected 1)', o.obj, v_n);
        CONTINUE;
      END IF;
      v_def := pg_catalog.pg_get_functiondef(v_oid);
      INSERT INTO s5_obj (obj, kind, oid, old_def, sec, cfg, vol, acl)
      SELECT o.obj, 'f', p.oid, v_def, p.prosecdef, p.proconfig, p.provolatile, p.proacl::TEXT
        FROM pg_catalog.pg_proc p WHERE p.oid = v_oid;
    ELSE
      SELECT c.oid INTO v_oid FROM pg_catalog.pg_class c
       WHERE c.relnamespace = 'public'::regnamespace AND c.relname = o.obj AND c.relkind = 'v';
      IF v_oid IS NULL THEN
        v_drift := v_drift || format('%s: view not found', o.obj);
        CONTINUE;
      END IF;
      SELECT format('CREATE OR REPLACE VIEW public.%I%s AS%s', c.relname,
                    CASE WHEN c.reloptions IS NULL THEN '' ELSE ' WITH (' || array_to_string(c.reloptions, ', ') || ')' END,
                    E'\n' || pg_catalog.pg_get_viewdef(c.oid, false))
        INTO v_def FROM pg_catalog.pg_class c WHERE c.oid = v_oid;
      INSERT INTO s5_obj (obj, kind, oid, old_def, acl, relopt)
      SELECT o.obj, 'v', c.oid, v_def, c.relacl::TEXT, c.reloptions FROM pg_catalog.pg_class c WHERE c.oid = v_oid;
    END IF;
    FOR r IN SELECT * FROM s5_rule WHERE obj = o.obj ORDER BY step LOOP
      v_got := regexp_count(v_def, r.pat, 1, 'i');
      IF v_got <> r.expect THEN
        v_drift := v_drift || format('%s step %s: expected %s match(es), found %s', o.obj, r.step, r.expect, v_got);
      END IF;
      v_def := regexp_replace(v_def, r.pat, r.rep, 'gi');
    END LOOP;
    -- Nothing of the banned family may remain (CLOCK-OK: the pattern names the banned calls).
    IF v_def ~* '\mcurrent_date\M|\mcurrent_time\M|\mlocaltime|now\(\)\s*::\s*(date|time)\M|fn_ops_zone\s*\(' THEN  -- CLOCK-OK: residual check pattern
      v_drift := v_drift || format('%s: a banned call remains after the rewrite', o.obj);
    END IF;
    UPDATE s5_obj SET new_def = v_def WHERE obj = o.obj;
  END LOOP;
  IF cardinality(v_drift) > 0 THEN
    RAISE EXCEPTION '0846 stopped, live definitions differ from the migration files: %', array_to_string(v_drift, '; ')
      USING HINT = 'Nothing was changed. Send this message to the developer; the rule counts are adjusted to the live bodies.';
  END IF;
END
$read$;

-- -----------------------------------------------------------------------------
-- 3. Re-create the objects.
-- -----------------------------------------------------------------------------
DO $apply$
DECLARE
  o RECORD;
BEGIN
  FOR o IN SELECT obj, new_def FROM s5_obj ORDER BY kind, obj LOOP
    EXECUTE o.new_def;
  END LOOP;
END
$apply$;

COMMENT ON FUNCTION public.fn_tenant_general_value(UUID, TEXT) IS
  'Resolution rule for general values: the tenant value (org_tenants_mst) if set, otherwise hq_general_config. Keys: current_fiscal_year, fiscal_year_start_month, date_format, time_format, first_day_of_week, language, locale_code, timezone; unknown key returns NULL. Exception (G21, 0846): timezone returns the tenant value only (NULL when unset; never the HQ zone); with p_tenant_id NULL it returns the HQ zone. A signed-in user may read only their own tenant (DOC_SEQ_TENANT_MISMATCH, 42501). Does not validate the time zone (the engine does).';

COMMENT ON FUNCTION public.fn_fin_credit_note_expire_one(UUID, UUID, BOOLEAN, TEXT) IS
  'Expire one credit note (row lock, EXPIRED + zero balance, one EXPIRY ledger row keyed cn-expiry-<id>). Outcomes: EXPIRED, ALREADY_EXPIRED, NOT_FOUND, NOT_ACTIVE, NOT_DUE, ZONE_MISSING (p_only_if_due and the ledger zone is not configured; nothing changes; 0846, G22). Due = expires_at before the ledger civil day (fn_cmx_dt_today_or_null).';

COMMENT ON FUNCTION public.fn_fin_credit_note_expiry_run() IS
  'Daily credit-note expiry: notes whose expires_at is before the ledger civil day of their organization. Organizations without a ledger zone are skipped and counted (zone_missing, WARNING CLOCK_ZONE_MISSING; 0846, G22). Returns {expired, skipped, failed, zone_missing}.';

-- -----------------------------------------------------------------------------
-- 4. Speed rules: no database default day (the writer supplies the organization civil date).
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_speed_price_rules_cf ALTER COLUMN effective_from DROP DEFAULT;
COMMENT ON COLUMN public.org_speed_price_rules_cf.effective_from IS
  'First civil day (organization accept_order zone) the rule applies. No default since 0846: the writer supplies it (speed-rules.service, seed_product_speed_rules).';

-- -----------------------------------------------------------------------------
-- 5. Catalog: deactivate active canonical zones the server tzdata does not know and nobody uses.
-- -----------------------------------------------------------------------------
DO $catalog$
DECLARE
  v_off  TEXT;
  v_kept TEXT;
BEGIN
  CREATE TEMP TABLE s5_unknown ON COMMIT DROP AS
  SELECT z.code,
         (EXISTS (SELECT 1 FROM public.org_tenants_mst t WHERE t.timezone = z.code)
          OR EXISTS (SELECT 1 FROM public.org_branches_mst b WHERE b.timezone_code = z.code)
          OR EXISTS (SELECT 1 FROM public.hq_general_config h WHERE h.timezone = z.code)) AS in_use
    FROM public.sys_timezone_cd z
   WHERE z.is_canonical AND z.is_active IS TRUE
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names n WHERE n.name = z.iana_name);

  WITH upd AS (
    UPDATE public.sys_timezone_cd z
       SET is_active = false,
           metadata  = coalesce(z.metadata, '{}'::jsonb)
                       || jsonb_build_object('deactivated_by', '0846', 'deactivated_reason', 'unknown to the server tzdata (pg_timezone_names)')
     WHERE z.code IN (SELECT u.code FROM s5_unknown u WHERE NOT u.in_use)
    RETURNING z.code)
  SELECT string_agg(code, ', ' ORDER BY code) INTO v_off FROM upd;
  SELECT string_agg(code, ', ' ORDER BY code) INTO v_kept FROM s5_unknown WHERE in_use;

  RAISE NOTICE '0846 catalog: deactivated %', coalesce(v_off, 'none');
  IF v_kept IS NOT NULL THEN
    RAISE WARNING '0846 catalog: unknown to the server tzdata but in use, left active (health CLOCK_CATALOG_UNKNOWN): %', v_kept;
  END IF;
END
$catalog$;

-- -----------------------------------------------------------------------------
-- 6. Verification (fails the migration) and live scan (reports only).
-- -----------------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad  TEXT;
  v_n    INTEGER;
  v_list TEXT;
  v_t    RECORD;
BEGIN
  -- a. Attributes and grants unchanged; definitions free of the banned family.
  SELECT string_agg(o.obj, ', ') INTO v_bad
    FROM s5_obj o
    LEFT JOIN pg_catalog.pg_proc p ON o.kind = 'f' AND p.oid = o.oid
    LEFT JOIN pg_catalog.pg_class c ON o.kind = 'v' AND c.oid = o.oid
   WHERE (o.kind = 'f' AND (p.oid IS NULL OR p.prosecdef IS DISTINCT FROM o.sec OR p.proconfig IS DISTINCT FROM o.cfg
                            OR p.provolatile IS DISTINCT FROM o.vol OR p.proacl::TEXT IS DISTINCT FROM o.acl
                            OR pg_catalog.pg_get_functiondef(p.oid) ~* '\mcurrent_date\M|now\(\)\s*::\s*date'))  -- CLOCK-OK: verification pattern
      OR (o.kind = 'v' AND (c.oid IS NULL OR c.relacl::TEXT IS DISTINCT FROM o.acl OR c.reloptions IS DISTINCT FROM o.relopt
                            OR pg_catalog.pg_get_viewdef(c.oid, false) ~* '\mcurrent_date\M'));  -- CLOCK-OK: verification pattern
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '0846 verification failed (attributes, grants or a banned call): %', v_bad;
  END IF;
  SELECT count(*) INTO v_n FROM s5_obj;
  IF v_n <> 27 THEN
    RAISE EXCEPTION '0846 verification failed: % objects rewritten, expected 27', v_n;
  END IF;

  -- b. G21: no HQ fallback for a tenant without a zone; the platform call still gets the HQ zone.
  IF public.fn_tenant_general_value(NULL, 'timezone') IS DISTINCT FROM (SELECT h.timezone FROM public.hq_general_config h WHERE h.config_id) THEN
    RAISE EXCEPTION '0846 verification failed: fn_tenant_general_value(NULL, timezone) must return the HQ zone';
  END IF;
  IF EXISTS (SELECT 1 FROM public.org_tenants_mst t
              WHERE NULLIF(t.timezone, '') IS NULL AND public.fn_tenant_general_value(t.id, 'timezone') IS NOT NULL) THEN
    RAISE EXCEPTION '0846 verification failed: a tenant without a zone still gets one from fn_tenant_general_value';
  END IF;

  -- c. Speed rule default gone.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attrdef d JOIN pg_catalog.pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
              WHERE d.adrelid = 'public.org_speed_price_rules_cf'::regclass AND a.attname = 'effective_from') THEN
    RAISE EXCEPTION '0846 verification failed: org_speed_price_rules_cf.effective_from still has a default';
  END IF;

  -- d. The rewritten health checks run for every active organization without an error.
  FOR v_t IN SELECT o.id FROM public.org_tenants_mst o WHERE o.is_active IS TRUE AND coalesce(o.rec_status, 1) = 1 LOOP
    PERFORM public.fn_shc_speed_no_rules(v_t.id, NULL), public.fn_shc_cal_holidays_estimated(v_t.id, NULL),
            public.fn_shc_cal_holidays_missing(v_t.id, NULL), public.fn_shc_tax_doc_type_no_rule(v_t.id, NULL),
            public.fn_shc_tax_exemption_expired(v_t.id, NULL), public.fn_shc_tax_kit_update_pending(v_t.id, NULL);
  END LOOP;
  PERFORM 1 FROM public.vw_fin_coa_explorer LIMIT 1;
  PERFORM 1 FROM public.vw_fin_missing_required_usage LIMIT 1;

  -- e. Catalog: no active canonical zone unknown to the server unless it is in use.
  IF EXISTS (SELECT 1 FROM s5_unknown u JOIN public.sys_timezone_cd z ON z.code = u.code
              WHERE z.is_active IS TRUE AND NOT u.in_use) THEN
    RAISE EXCEPTION '0846 verification failed: an unused unknown zone is still active';
  END IF;

  -- f. Live scan (report only): other public SQL still reading the session day.
  SELECT string_agg(p.oid::regprocedure::TEXT, ', ' ORDER BY p.oid::regprocedure::TEXT) INTO v_list
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p') AND p.proname !~ '^fn_cmx_dt'
     AND p.prosrc ~* '\mcurrent_date\M|\mcurrent_time\M|\mlocaltime|now\(\)\s*::\s*(date|time)\M|to_char\(\s*now\(\)|date_trunc\([^)]*now\(\)\s*\)';  -- CLOCK-OK: live scan pattern
  IF v_list IS NOT NULL THEN
    RAISE WARNING '0846 live scan, functions still reading the session day (send to the developer): %', v_list;
  END IF;
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_list
    FROM pg_catalog.pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('v', 'm')
     AND pg_catalog.pg_get_viewdef(c.oid, false) ~* '\mcurrent_date\M|now\(\)\s*::\s*date';  -- CLOCK-OK: live scan pattern
  IF v_list IS NOT NULL THEN
    RAISE WARNING '0846 live scan, views still reading the session day: %', v_list;
  END IF;
  SELECT string_agg(format('%s.%s', c.relname, a.attname), ', ' ORDER BY c.relname, a.attname) INTO v_list
    FROM pg_catalog.pg_attrdef d
    JOIN pg_catalog.pg_class c ON c.oid = d.adrelid AND c.relnamespace = 'public'::regnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
   WHERE pg_catalog.pg_get_expr(d.adbin, d.adrelid) ~* '\mcurrent_date\M|now\(\)\s*::\s*date'  -- CLOCK-OK: live scan pattern
     AND c.relname ~ '^org_';
  IF v_list IS NOT NULL THEN
    RAISE WARNING '0846 live scan, organization columns with a session-day default: %', v_list;
  END IF;

  RAISE NOTICE '0846: % objects re-read from the live catalog and rewritten to fn_cmx_dt_*; speed rule default dropped', v_n;
END
$verify$;

COMMIT;
