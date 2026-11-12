-- =============================================================================
-- 0726_tax_health_kit_updates.sql
-- Tax Engine T8 (M8 + kit updates) — docs/features/Tax_Config/TAX_ENGINE_PLAN.md §9, Setup_Health/PLAN.md
--
-- 1. Setup Health TAX checks (functions + registry rows): TAX_SETUP_NOT_CONFIRMED (blocker, banner),
--    TAX_REG_NO_MISSING, TAX_PRODUCTS_NO_CLASS, TAX_DOC_TYPE_NO_RULE (Advanced only),
--    TAX_EXEMPTION_EXPIRED, TAX_KIT_UPDATE_PENDING, TAX_KIT_FACT_UNVERIFIED (HQ only).
-- 2. Kit versions: published content becomes immutable (trigger); HQ copies a version to a
--    DRAFT, edits it, and publishes it after its worked examples pass (SQL checker mirroring
--    the engine's rule choice); a draft can be discarded.
-- 3. Kit updates: fn_tax_kit_apply gains an update mode that keeps the organization's status;
--    fn_tax_kit_update / fn_tax_kit_update_all move organizations to the newest published
--    version in effect, nightly at 02:05 (pg_cron), failures recorded for Setup Health.
--
-- Rollback (forward-only, manual): unschedule 'tax-kit-update'; DROP the new functions RESTRICT;
-- DROP TRIGGER trg_tax_kit_lock on the six kit tables; DELETE the 7 TAX check rows;
-- re-create fn_tax_kit_apply from 0718.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Setup Health: TAX checks (M8) ───────────────────────────────────────
-- Each returns {status OK|FAIL|NA, count, sample_ids, details}; tenant-filtered, read-only.

CREATE OR REPLACE FUNCTION public.fn_shc_tax_setup_not_confirmed(p_tenant UUID, p_branch UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_status TEXT;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT c.status INTO v_status FROM org_tax_config_cf c WHERE c.tenant_org_id = p_tenant AND c.rec_status = 1;
  RETURN jsonb_build_object(
    'status',     CASE WHEN v_status = 'ACTIVE' THEN 'OK' ELSE 'FAIL' END,
    'count',      CASE WHEN v_status = 'ACTIVE' THEN 0 ELSE 1 END,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('status', COALESCE(v_status, 'NO_KIT')));
END $$;
COMMENT ON FUNCTION public.fn_shc_tax_setup_not_confirmed(UUID, UUID) IS
  'Setup Health TAX_SETUP_NOT_CONFIRMED: FAIL until org_tax_config_cf is ACTIVE (no kit applied, or applied and waiting for confirmation). Orders carry no tax until then (ADR-061).';

CREATE OR REPLACE FUNCTION public.fn_shc_tax_reg_no_missing(p_tenant UUID, p_branch UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_ids UUID[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  IF NOT EXISTS (SELECT 1 FROM org_tax_config_cf c WHERE c.tenant_org_id = p_tenant AND c.status = 'ACTIVE' AND c.tax_enabled AND c.rec_status = 1) THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb, 'details', jsonb_build_object('reason', 'TAX_NOT_ACTIVE'));
  END IF;
  -- A branch is covered by its own number or by the organization's.
  SELECT array_agg(b.id ORDER BY b.id) INTO v_ids
    FROM org_branches_mst b
    JOIN org_tenants_mst t ON t.id = b.tenant_org_id
   WHERE b.tenant_org_id = p_tenant AND (p_branch IS NULL OR b.id = p_branch)
     AND b.is_active AND b.rec_status = 1
     AND NULLIF(btrim(b.tax_registration_no), '') IS NULL
     AND NULLIF(btrim(t.tax_registration_no), '') IS NULL;
  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    '{}'::jsonb);
END $$;
COMMENT ON FUNCTION public.fn_shc_tax_reg_no_missing(UUID, UUID) IS
  'Setup Health TAX_REG_NO_MISSING: with tax active and enabled, FAIL for each active branch with no tax registration number of its own and none on the organization. NA while tax is not active. sample_ids = branch ids.';

CREATE OR REPLACE FUNCTION public.fn_shc_tax_products_no_class(p_tenant UUID, p_branch UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_ids UUID[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  IF NOT EXISTS (SELECT 1 FROM org_tax_config_cf c WHERE c.tenant_org_id = p_tenant AND c.rec_status = 1) THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb, 'details', jsonb_build_object('reason', 'NO_KIT'));
  END IF;
  SELECT array_agg(p.id ORDER BY p.id) INTO v_ids
    FROM org_product_data_mst p
   WHERE p.tenant_org_id = p_tenant AND p.is_active AND p.rec_status = 1
     AND NOT EXISTS (SELECT 1 FROM org_tax_item_classes_cf k
                      WHERE k.tenant_org_id = p.tenant_org_id AND k.class_code = p.tax_item_class_code
                        AND k.tax_flow_code = 'OUTPUT' AND k.is_active AND k.rec_status = 1);
  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    '{}'::jsonb);
END $$;
COMMENT ON FUNCTION public.fn_shc_tax_products_no_class(UUID, UUID) IS
  'Setup Health TAX_PRODUCTS_NO_CLASS: FAIL for active products whose tax_item_class_code is empty or not an active sales class of the organization. NA before any kit is applied. sample_ids = product ids.';

CREATE OR REPLACE FUNCTION public.fn_shc_tax_doc_type_no_rule(p_tenant UUID, p_branch UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_missing TEXT[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  IF NOT EXISTS (SELECT 1 FROM org_tax_config_cf c
                  WHERE c.tenant_org_id = p_tenant AND c.status = 'ACTIVE' AND c.tax_enabled
                    AND c.setup_mode = 'ADVANCED' AND c.rec_status = 1) THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb, 'details', jsonb_build_object('reason', 'NOT_ADVANCED_ACTIVE'));
  END IF;
  -- The documents the engine decides by rule (sales order, purchases, supplier payment withholding).
  SELECT array_agg(d.doc || ':' || d.flow ORDER BY d.doc) INTO v_missing
    FROM (VALUES ('ORDER', 'OUTPUT'), ('ERP_EXPENSE', 'INPUT'), ('ERP_AP_INVOICE', 'INPUT'),
                 ('ERP_PETTY_CASH_TXN', 'INPUT'), ('ERP_AP_PAYMENT', 'WITHHOLDING')) AS d(doc, flow)
   WHERE NOT EXISTS (SELECT 1 FROM org_tax_rules_cf r
                      WHERE r.tenant_org_id = p_tenant AND r.is_active AND r.rec_status = 1
                        AND (r.tax_flow_code IS NULL OR r.tax_flow_code = d.flow)
                        AND (r.doc_type_code IS NULL OR r.doc_type_code = d.doc)
                        AND r.effective_from <= CURRENT_DATE
                        AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE));
  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_missing), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_missing), 0),
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('missing', to_jsonb(COALESCE(v_missing, '{}'::text[]))));
END $$;
COMMENT ON FUNCTION public.fn_shc_tax_doc_type_no_rule(UUID, UUID) IS
  'Setup Health TAX_DOC_TYPE_NO_RULE (Advanced mode only): FAIL for each document type and flow the engine decides by rule (ORDER sales; expense, AP invoice, petty cash purchases; AP payment withholding) with no active rule in effect today. details.missing = doc:flow pairs. NA unless tax is active, enabled and Advanced.';

CREATE OR REPLACE FUNCTION public.fn_shc_tax_exemption_expired(p_tenant UUID, p_branch UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_ids UUID[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT array_agg(e.id ORDER BY e.valid_to) INTO v_ids
    FROM org_tax_exemptions_cf e
   WHERE e.tenant_org_id = p_tenant AND e.is_active AND e.rec_status = 1
     AND e.valid_to IS NOT NULL AND e.valid_to < CURRENT_DATE;
  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    '{}'::jsonb);
END $$;
COMMENT ON FUNCTION public.fn_shc_tax_exemption_expired(UUID, UUID) IS
  'Setup Health TAX_EXEMPTION_EXPIRED: FAIL for active customer tax exemptions whose valid_to has passed. sample_ids = exemption ids.';

CREATE OR REPLACE FUNCTION public.fn_shc_tax_kit_update_pending(p_tenant UUID, p_branch UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_cfg      RECORD;
  v_latest   RECORD;
  v_conflicts INTEGER;
  v_behind   BOOLEAN;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT c.kit_code, c.kit_version_id, c.last_apply_summary INTO v_cfg
    FROM org_tax_config_cf c WHERE c.tenant_org_id = p_tenant AND c.rec_status = 1;
  IF NOT FOUND OR v_cfg.kit_code IS NULL THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb, 'details', jsonb_build_object('reason', 'NO_KIT'));
  END IF;
  SELECT v.id, v.version_no INTO v_latest
    FROM sys_tax_kit_versions_mst v
   WHERE v.kit_code = v_cfg.kit_code AND v.status = 'PUBLISHED' AND v.rec_status = 1
     AND v.effective_from <= CURRENT_DATE AND (v.effective_to IS NULL OR v.effective_to >= CURRENT_DATE)
   ORDER BY v.version_no DESC LIMIT 1;
  v_behind := v_latest.id IS NOT NULL AND v_latest.id IS DISTINCT FROM v_cfg.kit_version_id;
  v_conflicts := COALESCE(jsonb_array_length(v_cfg.last_apply_summary -> 'conflicts'), 0);
  RETURN jsonb_build_object(
    'status',     CASE WHEN v_behind OR v_conflicts > 0 OR v_cfg.last_apply_summary ? 'update_error' THEN 'FAIL' ELSE 'OK' END,
    'count',      (CASE WHEN v_behind THEN 1 ELSE 0 END) + v_conflicts,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('behind', v_behind, 'latest_version_no', v_latest.version_no,
                                     'conflicts', COALESCE(v_cfg.last_apply_summary -> 'conflicts', '[]'::jsonb),
                                     'update_error', v_cfg.last_apply_summary -> 'update_error'));
END $$;
COMMENT ON FUNCTION public.fn_shc_tax_kit_update_pending(UUID, UUID) IS
  'Setup Health TAX_KIT_UPDATE_PENDING: FAIL when the organization is not on the newest published kit version in effect, when the last apply/update left conflicts (rows the organization changed itself), or when the nightly kit update failed (last_apply_summary.update_error). NA without a kit.';

CREATE OR REPLACE FUNCTION public.fn_shc_tax_kit_fact_unverified(p_tenant UUID, p_branch UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_cfg     RECORD;
  v_version BOOLEAN;
  v_boxes   INTEGER;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT c.kit_code, c.kit_version_id INTO v_cfg FROM org_tax_config_cf c WHERE c.tenant_org_id = p_tenant AND c.rec_status = 1;
  IF NOT FOUND OR v_cfg.kit_version_id IS NULL THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb, 'details', jsonb_build_object('reason', 'NO_KIT'));
  END IF;
  SELECT NOT v.is_verified INTO v_version FROM sys_tax_kit_versions_mst v WHERE v.id = v_cfg.kit_version_id;
  SELECT count(*) INTO v_boxes FROM sys_tax_return_box_cd b
   WHERE b.kit_code = v_cfg.kit_code AND NOT b.is_verified AND b.is_active AND b.rec_status = 1;
  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(v_version, false) OR v_boxes > 0 THEN 'FAIL' ELSE 'OK' END,
    'count',      (CASE WHEN COALESCE(v_version, false) THEN 1 ELSE 0 END) + v_boxes,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('kit_code', v_cfg.kit_code, 'version_unverified', COALESCE(v_version, false),
                                     'unverified_return_boxes', v_boxes));
END $$;
COMMENT ON FUNCTION public.fn_shc_tax_kit_fact_unverified(UUID, UUID) IS
  'Setup Health TAX_KIT_FACT_UNVERIFIED (HQ only): FAIL when the organization''s kit version is not verified or its VAT return layout has unverified boxes (KIT_FACTS §5). count = unverified items.';

DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['fn_shc_tax_setup_not_confirmed', 'fn_shc_tax_reg_no_missing', 'fn_shc_tax_products_no_class',
                           'fn_shc_tax_doc_type_no_rule', 'fn_shc_tax_exemption_expired', 'fn_shc_tax_kit_update_pending',
                           'fn_shc_tax_kit_fact_unverified'] LOOP
    -- Callers: the Setup Health dispatcher (as the calling role). Never anonymous.
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(UUID, UUID) FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(UUID, UUID) TO authenticated, service_role', f);
  END LOOP;
END $$;

INSERT INTO public.sys_setup_health_check_cd (
  check_code, domain_code, severity, name, name2, description, description2,
  fix_route, hq_fix_route, fix_permission, feature_flag_key,
  shows_banner, is_hq_only, fn_name, display_order, created_by, created_info
)
VALUES
  ('TAX_SETUP_NOT_CONFIRMED', 'TAX', 'BLOCKER',
   'Orders are not taxed: tax setup is not confirmed', 'الطلبات لا تُحتسب عليها ضريبة: إعداد الضريبة غير مؤكد',
   'No tax is charged until the tax setup is confirmed. Review the ready-made setup and confirm it, or ask support to apply it.',
   'لا تُحتسب أي ضريبة حتى يتم تأكيد إعداد الضريبة. راجع الإعداد الجاهز وأكّده، أو اطلب من الدعم تطبيقه.',
   '/dashboard/settings/tax/setup', '/tenants/{tenantId}/tax-kit', 'tax:manage_config', NULL,
   TRUE, FALSE, 'fn_shc_tax_setup_not_confirmed', 10, 'system_admin', '0726 tax engine T8'),
  ('TAX_REG_NO_MISSING', 'TAX', 'WARNING',
   'Tax registration number missing', 'رقم التسجيل الضريبي غير موجود',
   'Tax invoices must show your tax registration number. Add it for the organization or for each branch.',
   'يجب أن تظهر الفواتير الضريبية رقم تسجيلك الضريبي. أضفه للمنشأة أو لكل فرع.',
   '/dashboard/settings/tax', '/tenants/{tenantId}/tax-kit', 'tax:manage_config', NULL,
   FALSE, FALSE, 'fn_shc_tax_reg_no_missing', 20, 'system_admin', '0726 tax engine T8'),
  ('TAX_PRODUCTS_NO_CLASS', 'TAX', 'WARNING',
   'Products without a tax class', 'منتجات بلا فئة ضريبية',
   'These products have no item tax class (or an inactive one), so the tax rules cannot decide their tax. Choose a class on each product.',
   'هذه المنتجات ليس لها فئة ضريبية للصنف (أو لها فئة غير فعّالة)، فلا تستطيع القواعد الضريبية تحديد ضريبتها. اختر فئة لكل منتج.',
   '/dashboard/catalog/services', '/tenants/{tenantId}/catalog', 'tax:manage_config', NULL,
   FALSE, FALSE, 'fn_shc_tax_products_no_class', 30, 'system_admin', '0726 tax engine T8'),
  ('TAX_DOC_TYPE_NO_RULE', 'TAX', 'BLOCKER',
   'Documents with no tax rule', 'مستندات بلا قاعدة ضريبية',
   'Some documents have no active tax rule, so saving them is refused ("No tax rule"). Add or reactivate a rule for them.',
   'بعض المستندات ليس لها قاعدة ضريبية فعّالة، لذلك يُرفض حفظها ("لا توجد قاعدة ضريبية"). أضف قاعدة لها أو أعد تفعيلها.',
   '/dashboard/settings/tax', '/tenants/{tenantId}/tax-kit', 'tax:manage_config', NULL,
   FALSE, FALSE, 'fn_shc_tax_doc_type_no_rule', 40, 'system_admin', '0726 tax engine T8'),
  ('TAX_EXEMPTION_EXPIRED', 'TAX', 'INFO',
   'Expired tax exemptions', 'إعفاءات ضريبية منتهية',
   'Some customer tax exemptions have passed their end date. Renew them with the new certificate, or turn them off.',
   'بعض الإعفاءات الضريبية للعملاء انتهى تاريخها. جدّدها بالشهادة الجديدة أو أوقفها.',
   '/dashboard/settings/tax', NULL, 'tax:manage_config', NULL,
   FALSE, FALSE, 'fn_shc_tax_exemption_expired', 50, 'system_admin', '0726 tax engine T8'),
  ('TAX_KIT_UPDATE_PENDING', 'TAX', 'WARNING',
   'Tax setup update needs review', 'تحديث إعداد الضريبة يحتاج إلى مراجعة',
   'A newer version of your ready-made tax setup exists, or parts you changed yourself were not updated. Review the tax setup.',
   'يوجد إصدار أحدث من إعدادك الضريبي الجاهز، أو أن أجزاء غيّرتها بنفسك لم تُحدَّث. راجع إعداد الضريبة.',
   '/dashboard/settings/tax/setup', '/tenants/{tenantId}/tax-kit', 'tax:manage_config', NULL,
   FALSE, FALSE, 'fn_shc_tax_kit_update_pending', 60, 'system_admin', '0726 tax engine T8'),
  ('TAX_KIT_FACT_UNVERIFIED', 'TAX', 'INFO',
   'Tax kit facts not verified', 'معلومات الإعداد الضريبي غير موثّقة',
   'The tax kit this organization uses, or its VAT return layout, has facts HQ has not yet checked against the tax authority.',
   'الإعداد الضريبي الذي تستخدمه هذه المنشأة، أو نموذج إقراره، يحتوي معلومات لم تتحقق منها إدارة المنصة بعد مقابل الجهة الضريبية.',
   NULL, '/system-codes/tax-kits', NULL, NULL,
   FALSE, TRUE, 'fn_shc_tax_kit_fact_unverified', 70, 'system_admin', '0726 tax engine T8')
ON CONFLICT (check_code) DO UPDATE
SET domain_code = EXCLUDED.domain_code, severity = EXCLUDED.severity,
    name = EXCLUDED.name, name2 = EXCLUDED.name2,
    description = EXCLUDED.description, description2 = EXCLUDED.description2,
    fix_route = EXCLUDED.fix_route, hq_fix_route = EXCLUDED.hq_fix_route,
    fix_permission = EXCLUDED.fix_permission, feature_flag_key = EXCLUDED.feature_flag_key,
    shows_banner = EXCLUDED.shows_banner, is_hq_only = EXCLUDED.is_hq_only,
    fn_name = EXCLUDED.fn_name, display_order = EXCLUDED.display_order,
    updated_at = NOW(), updated_by = 'system_admin', updated_info = '0726 tax engine T8';

-- ─── 2. Kit versions: draft, check, publish, discard; published content is locked ───

-- Published / retired kit versions are what organizations were taxed with: their content
-- never changes. HQ edits a DRAFT copy and publishes it. A data-fix migration may set
-- app.tax_kit_seed = 'on' (transaction-local) to bypass the lock.
CREATE OR REPLACE FUNCTION public.fn_tax_kit_lock_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE
  v_version UUID;
  v_status  TEXT;
  -- Header fields that may change after publishing: verification notes, the end date, retirement.
  v_free    TEXT[] := ARRAY['is_verified', 'source_url', 'checked_on', 'review_notes', 'effective_to', 'status',
                            'updated_at', 'updated_by', 'updated_info', 'updated_count', 'rec_order', 'rec_notes'];
BEGIN
  IF COALESCE(current_setting('app.tax_kit_seed', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_TABLE_NAME = 'sys_tax_kit_versions_mst' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'TAX_KIT_VERSION_LOCKED: a published kit version cannot be deleted' USING ERRCODE = '55000';
      END IF;
      RETURN OLD;
    END IF;
    IF OLD.status <> 'DRAFT' AND (to_jsonb(NEW) - v_free) IS DISTINCT FROM (to_jsonb(OLD) - v_free) THEN
      RAISE EXCEPTION 'TAX_KIT_VERSION_LOCKED: kit % version % is published; copy it to a draft to change it', OLD.kit_code, OLD.version_no
        USING ERRCODE = '55000';
    END IF;
    IF OLD.status = 'RETIRED' AND NEW.status <> 'RETIRED' THEN
      RAISE EXCEPTION 'TAX_KIT_VERSION_LOCKED: a retired kit version stays retired' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  v_version := CASE WHEN TG_OP = 'DELETE' THEN OLD.kit_version_id ELSE NEW.kit_version_id END;
  SELECT status INTO v_status FROM public.sys_tax_kit_versions_mst WHERE id = v_version;
  IF v_status IS DISTINCT FROM 'DRAFT'
     OR (TG_OP = 'UPDATE' AND OLD.kit_version_id IS DISTINCT FROM NEW.kit_version_id) THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_LOCKED: kit content can only change in a draft version' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_lock_guard() IS
  'BEFORE trigger on kit versions and their content (codes, item classes, rules, rule codes, examples): only DRAFT versions change; a published version may only change its verification notes, end date and retirement. Bypass for data-fix migrations: SET LOCAL app.tax_kit_seed = ''on''.';

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_tax_kit_versions_mst', 'sys_tax_kit_codes_dtl', 'sys_tax_kit_item_classes_dtl',
                           'sys_tax_kit_rules_dtl', 'sys_tax_kit_rule_codes_dtl', 'sys_tax_kit_vectors_dtl'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_tax_kit_lock ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_tax_kit_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_tax_kit_lock_guard()', t);
    EXECUTE format('COMMENT ON TRIGGER trg_tax_kit_lock ON public.%I IS %L', t, 'Published kit content is immutable; edit a draft version (fn_tax_kit_lock_guard).');
  END LOOP;
END $$;

-- The versions table only guards UPDATE/DELETE: a new DRAFT row is always allowed.
DROP TRIGGER IF EXISTS trg_tax_kit_lock ON public.sys_tax_kit_versions_mst;
CREATE TRIGGER trg_tax_kit_lock BEFORE UPDATE OR DELETE ON public.sys_tax_kit_versions_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_tax_kit_lock_guard();
COMMENT ON TRIGGER trg_tax_kit_lock ON public.sys_tax_kit_versions_mst IS
  'A published kit version only changes its verification notes, end date or retirement (fn_tax_kit_lock_guard).';

CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_clone(p_version_id UUID, p_actor TEXT)
RETURNS UUID LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE
  v_src  public.sys_tax_kit_versions_mst%ROWTYPE;
  v_new  UUID;
  v_no   INTEGER;
  v_info TEXT := 'fn_tax_kit_version_clone';
BEGIN
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: actor is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_src FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id AND rec_status = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  -- One draft per kit, so two HQ users never edit competing drafts.
  PERFORM 1 FROM public.sys_tax_kits_mst WHERE kit_code = v_src.kit_code FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst WHERE kit_code = v_src.kit_code AND status = 'DRAFT' AND rec_status = 1) THEN
    RAISE EXCEPTION 'TAX_KIT_DRAFT_EXISTS: kit % already has a draft version', v_src.kit_code USING ERRCODE = '55000';
  END IF;
  SELECT COALESCE(max(version_no), 0) + 1 INTO v_no FROM public.sys_tax_kit_versions_mst WHERE kit_code = v_src.kit_code;

  INSERT INTO public.sys_tax_kit_versions_mst
    (kit_code, version_no, status, effective_from, effective_to, currency_code, mandatory_reg_threshold, voluntary_reg_threshold,
     simplified_max_amount, rounding_level, rounding_mode, tax_on_advance, is_verified, source_url, checked_on, review_notes,
     created_by, created_info)
  VALUES
    (v_src.kit_code, v_no, 'DRAFT', GREATEST(CURRENT_DATE + 1, v_src.effective_from), NULL, v_src.currency_code,
     v_src.mandatory_reg_threshold, v_src.voluntary_reg_threshold, v_src.simplified_max_amount, v_src.rounding_level,
     v_src.rounding_mode, v_src.tax_on_advance, false, v_src.source_url, NULL, v_src.review_notes, p_actor, v_info)
  RETURNING id INTO v_new;

  INSERT INTO public.sys_tax_kit_codes_dtl
    (kit_version_id, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, fixed_amount,
     calc_level, recoverable_pct, is_reverse_charge, priority, compound_base, display_order, is_active, rec_status, created_by, created_info)
  SELECT v_new, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, fixed_amount,
         calc_level, recoverable_pct, is_reverse_charge, priority, compound_base, display_order, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_codes_dtl WHERE kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_item_classes_dtl
    (kit_version_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
     is_active, rec_status, created_by, created_info)
  SELECT v_new, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
         is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_item_classes_dtl WHERE kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_rules_dtl
    (kit_version_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
     segment_codes, priority, name, name2, is_active, rec_status, created_by, created_info)
  SELECT v_new, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
         segment_codes, priority, name, name2, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_rules_dtl WHERE kit_version_id = p_version_id;

  -- Rule codes follow their rule by rule_code (rule ids are new).
  INSERT INTO public.sys_tax_kit_rule_codes_dtl
    (rule_id, kit_version_id, seq_no, tax_code, is_active, rec_status, created_by, created_info)
  SELECT nr.id, v_new, rc.seq_no, rc.tax_code, rc.is_active, rc.rec_status, p_actor, v_info
    FROM public.sys_tax_kit_rule_codes_dtl rc
    JOIN public.sys_tax_kit_rules_dtl orl ON orl.id = rc.rule_id AND orl.kit_version_id = p_version_id
    JOIN public.sys_tax_kit_rules_dtl nr  ON nr.kit_version_id = v_new AND nr.rule_code = orl.rule_code
   WHERE rc.kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_vectors_dtl
    (kit_version_id, vector_code, description, description2, input, expected, is_active, rec_status, created_by, created_info)
  SELECT v_new, vector_code, description, description2, input, expected, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_vectors_dtl WHERE kit_version_id = p_version_id;

  RETURN v_new;
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_version_clone(UUID, TEXT) IS
  'HQ: copies a kit version (codes, item classes, rules + rule codes, examples) into a new DRAFT version (next version_no, effective from tomorrow at the earliest, not verified). One draft per kit (TAX_KIT_DRAFT_EXISTS). Returns the draft id. Caller checks permission and writes the audit log.';

CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_check(p_version_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE
  v_ver     public.sys_tax_kit_versions_mst%ROWTYPE;
  v_dec     INTEGER;
  x         RECORD;
  v_rule    RECORD;
  v_next    RECORD;
  v_rate    NUMERIC;
  v_fixed   NUMERIC;
  v_first   TEXT;
  v_amount  NUMERIC;
  v_tax     NUMERIC;
  v_taxable NUMERIC;
  v_ok      BOOLEAN;
  v_all_ok  BOOLEAN := true;
  v_results JSONB := '[]'::jsonb;
  v_reason  TEXT;
BEGIN
  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(minor_unit, 2) INTO v_dec FROM public.sys_currency_cd WHERE code = v_ver.currency_code;
  v_dec := COALESCE(v_dec, 2);

  FOR x IN SELECT * FROM public.sys_tax_kit_vectors_dtl WHERE kit_version_id = p_version_id AND is_active AND rec_status = 1 ORDER BY vector_code LOOP
    v_reason := NULL; v_tax := NULL; v_taxable := NULL; v_first := NULL;
    v_amount := (x.input ->> 'amount')::NUMERIC;
    -- Same choice as the engine (lib/tax/determine.ts): matching rules, most specific first, then lowest priority;
    -- examples use the all-segments rules, a domestic consumer-style party unless the example names a class.
    SELECT r.*, num_nonnulls(r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope) AS spec
      INTO v_rule
      FROM public.sys_tax_kit_rules_dtl r
     WHERE r.kit_version_id = p_version_id AND r.is_active AND r.rec_status = 1 AND r.segment_codes IS NULL
       AND (r.tax_flow_code IS NULL OR r.tax_flow_code = 'OUTPUT')
       AND (r.doc_type_code IS NULL OR r.doc_type_code = x.input ->> 'doc_type')
       AND (r.tax_item_class_code IS NULL OR r.tax_item_class_code = x.input ->> 'item_class')
       AND (r.party_tax_class_code IS NULL OR r.party_tax_class_code = x.input ->> 'party_class')
       AND (r.party_country_scope IS NULL OR r.party_country_scope = 'DOMESTIC')
     ORDER BY spec DESC, r.priority, r.rule_code
     LIMIT 1;
    IF v_rule.id IS NULL THEN
      v_reason := 'NO_TAX_RULE';
    ELSE
      SELECT r2.id INTO v_next
        FROM public.sys_tax_kit_rules_dtl r2
       WHERE r2.kit_version_id = p_version_id AND r2.is_active AND r2.rec_status = 1 AND r2.segment_codes IS NULL AND r2.id <> v_rule.id
         AND (r2.tax_flow_code IS NULL OR r2.tax_flow_code = 'OUTPUT')
         AND (r2.doc_type_code IS NULL OR r2.doc_type_code = x.input ->> 'doc_type')
         AND (r2.tax_item_class_code IS NULL OR r2.tax_item_class_code = x.input ->> 'item_class')
         AND (r2.party_tax_class_code IS NULL OR r2.party_tax_class_code = x.input ->> 'party_class')
         AND (r2.party_country_scope IS NULL OR r2.party_country_scope = 'DOMESTIC')
         AND num_nonnulls(r2.doc_type_code, r2.tax_flow_code, r2.tax_item_class_code, r2.party_tax_class_code, r2.party_country_scope) = v_rule.spec
         AND r2.priority = v_rule.priority
       LIMIT 1;
      IF v_next.id IS NOT NULL THEN
        v_reason := 'AMBIGUOUS';
      ELSE
        SELECT COALESCE(sum(c.rate) FILTER (WHERE c.amount_kind = 'PERCENT'), 0),
               COALESCE(sum(c.fixed_amount) FILTER (WHERE c.amount_kind = 'FIXED'), 0),
               (array_agg(c.tax_code ORDER BY rc.seq_no))[1]
          INTO v_rate, v_fixed, v_first
          FROM public.sys_tax_kit_rule_codes_dtl rc
          JOIN public.sys_tax_kit_codes_dtl c ON c.kit_version_id = rc.kit_version_id AND c.tax_code = rc.tax_code
         WHERE rc.rule_id = v_rule.id AND rc.kit_version_id = p_version_id AND rc.is_active AND rc.rec_status = 1;
        IF v_first IS NULL THEN
          v_reason := 'RULE_HAS_NO_CODE';
        ELSIF upper(x.input ->> 'pricing_mode') = 'INCLUSIVE' THEN
          v_tax := round((v_amount - v_fixed) * v_rate / (100 + v_rate), v_dec) + v_fixed;
          v_taxable := v_amount - v_tax;
        ELSE
          v_taxable := v_amount;
          v_tax := round(v_amount * v_rate / 100, v_dec) + v_fixed;
        END IF;
      END IF;
    END IF;
    v_ok := v_reason IS NULL
            AND v_first = x.expected ->> 'tax_code'
            AND v_tax = (x.expected ->> 'tax')::NUMERIC
            AND v_taxable = (x.expected ->> 'taxable')::NUMERIC;
    v_all_ok := v_all_ok AND v_ok;
    v_results := v_results || jsonb_build_object(
      'vector_code', x.vector_code, 'ok', v_ok, 'reason', v_reason, 'expected', x.expected,
      'actual', jsonb_build_object('tax_code', v_first, 'tax', v_tax::TEXT, 'taxable', v_taxable::TEXT));
  END LOOP;
  RETURN jsonb_build_object('ok', v_all_ok, 'examples', jsonb_array_length(v_results), 'results', v_results);
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_version_check(UUID) IS
  'Runs a kit version''s worked examples (sys_tax_kit_vectors_dtl) with the engine''s rule choice (most specific, then lowest priority; ties = AMBIGUOUS) on the all-segments rules, percent and fixed codes, rounding to the version currency''s minor unit. Returns {ok, examples, results[]}. Read-only.';

CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_publish(p_version_id UUID, p_actor TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE
  v_ver   public.sys_tax_kit_versions_mst%ROWTYPE;
  v_check JSONB;
  v_ended INTEGER;
BEGIN
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: actor is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  IF v_ver.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TAX_KIT_NOT_DRAFT: only a draft version can be published' USING ERRCODE = '55000';
  END IF;
  -- Orders already taxed must never change: a new version starts today at the earliest.
  IF v_ver.effective_from < CURRENT_DATE THEN
    RAISE EXCEPTION 'TAX_KIT_EFFECTIVE_PAST: the effective date % is in the past', v_ver.effective_from USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_codes_dtl WHERE kit_version_id = p_version_id AND is_active AND rec_status = 1) THEN
    RAISE EXCEPTION 'TAX_KIT_EMPTY: the version has no active tax code' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst
              WHERE kit_code = v_ver.kit_code AND status = 'PUBLISHED' AND rec_status = 1 AND effective_from >= v_ver.effective_from) THEN
    RAISE EXCEPTION 'TAX_KIT_EFFECTIVE_OVERLAP: a published version already starts on or after %', v_ver.effective_from USING ERRCODE = '22023';
  END IF;
  v_check := public.fn_tax_kit_version_check(p_version_id);
  IF NOT (v_check ->> 'ok')::BOOLEAN THEN
    RAISE EXCEPTION 'TAX_KIT_EXAMPLES_FAILED: %', v_check -> 'results' USING ERRCODE = '22023';
  END IF;

  -- The version in effect until now ends the day before.
  UPDATE public.sys_tax_kit_versions_mst
     SET effective_to = v_ver.effective_from - 1, updated_by = p_actor, updated_info = 'fn_tax_kit_version_publish'
   WHERE kit_code = v_ver.kit_code AND status = 'PUBLISHED' AND rec_status = 1
     AND (effective_to IS NULL OR effective_to >= v_ver.effective_from);
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  UPDATE public.sys_tax_kit_versions_mst
     SET status = 'PUBLISHED', published_at = now(), published_by = p_actor,
         updated_by = p_actor, updated_info = 'fn_tax_kit_version_publish'
   WHERE id = p_version_id;

  RETURN jsonb_build_object('ok', true, 'kit_code', v_ver.kit_code, 'version_no', v_ver.version_no,
                            'effective_from', v_ver.effective_from, 'previous_ended', v_ended, 'check', v_check);
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_version_publish(UUID, TEXT) IS
  'HQ: publishes a DRAFT kit version after its worked examples pass (TAX_KIT_EXAMPLES_FAILED otherwise); effective date today or later, after every published version; the previous version ends the day before. Organizations move to it with the nightly kit update (fn_tax_kit_update_all) once it is in effect. Caller checks permission and writes the audit log.';

CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_discard(p_version_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id AND status = 'DRAFT') THEN
    RAISE EXCEPTION 'TAX_KIT_NOT_DRAFT: only a draft version can be discarded' USING ERRCODE = '55000';
  END IF;
  DELETE FROM public.sys_tax_kit_vectors_dtl     WHERE kit_version_id = p_version_id;
  DELETE FROM public.sys_tax_kit_rule_codes_dtl  WHERE kit_version_id = p_version_id;
  DELETE FROM public.sys_tax_kit_rules_dtl       WHERE kit_version_id = p_version_id;
  DELETE FROM public.sys_tax_kit_codes_dtl       WHERE kit_version_id = p_version_id;
  DELETE FROM public.sys_tax_kit_item_classes_dtl WHERE kit_version_id = p_version_id;
  DELETE FROM public.sys_tax_kit_versions_mst    WHERE id = p_version_id;
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_version_discard(UUID) IS
  'HQ: deletes a DRAFT kit version and its content (never used by any organization: only published versions are applied).';

DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.fn_tax_kit_version_clone(UUID, TEXT)', 'public.fn_tax_kit_version_check(UUID)',
                           'public.fn_tax_kit_version_publish(UUID, TEXT)', 'public.fn_tax_kit_version_discard(UUID)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || f || ' FROM PUBLIC, anon, authenticated';   -- HQ server only
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || f || ' TO service_role';
  END LOOP;
END $$;

-- ─── 3. Kit apply keeps the organization's status when called by the kit update ───

CREATE OR REPLACE FUNCTION public.fn_tax_kit_apply(
  p_tenant   UUID,
  p_pkg_code TEXT,
  p_actor    TEXT,
  p_activate BOOLEAN DEFAULT false,
  p_note     TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  v_pkg       public.sys_starter_pkg_mst%ROWTYPE;
  v_ver       public.sys_tax_kit_versions_mst%ROWTYPE;
  v_cfg       public.org_tax_config_cf%ROWTYPE;
  v_cfg_found BOOLEAN;
  v_country   TEXT;
  v_info      TEXT := 'fn_tax_kit_apply ' || p_pkg_code;
  v_conflicts JSONB := '[]'::jsonb;
  v_n         JSONB;
  v_summary   JSONB;
  v_confirm   JSONB;
  r           RECORD;
  v_code      public.org_tax_profiles_cf%ROWTYPE;
  v_cls       public.org_tax_item_classes_cf%ROWTYPE;
  v_rule      public.org_tax_rules_cf%ROWTYPE;
  v_rule_found BOOLEAN;
  v_rule_id   UUID;
  v_default   TEXT;
  n_code_new INT := 0; n_code_upd INT := 0; n_code_ver INT := 0; n_code_off INT := 0;
  n_cls_new  INT := 0; n_cls_upd  INT := 0; n_cls_off  INT := 0;
  n_rule_new INT := 0; n_rule_upd INT := 0; n_rule_off INT := 0;
  n_prod     INT := 0;
  -- Set only by fn_tax_kit_update: move to the new kit version, keep the organization's status.
  v_update   BOOLEAN := COALESCE(current_setting('app.tax_kit_update', true), '') = 'on';
BEGIN
  -- ─── Input validation ───────────────────────────────────────────────────
  IF p_tenant IS NULL OR NULLIF(btrim(p_pkg_code), '') IS NULL OR NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_APPLY_BAD_INPUT: tenant, package and actor are required' USING ERRCODE = '22023';
  END IF;

  SELECT upper(country) INTO v_country FROM public.org_tenants_mst WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_TENANT_NOT_FOUND: organization % does not exist', p_tenant USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_pkg FROM public.sys_starter_pkg_mst WHERE pkg_code = p_pkg_code AND is_active AND rec_status = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_PACKAGE_NOT_FOUND: package % is missing or inactive', p_pkg_code USING ERRCODE = 'P0002';
  END IF;
  IF v_pkg.country_code IS NOT NULL AND v_pkg.country_code IS DISTINCT FROM v_country THEN
    RAISE EXCEPTION 'TAX_APPLY_COUNTRY_MISMATCH: package % is for %, the organization is in %', p_pkg_code, v_pkg.country_code, COALESCE(v_country, '?')
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst
   WHERE kit_code = v_pkg.tax_kit_code AND status = 'PUBLISHED' AND rec_status = 1
     AND effective_from <= current_date AND (effective_to IS NULL OR effective_to >= current_date)
   ORDER BY version_no DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_NO_PUBLISHED_VERSION: kit % has no published version in effect', v_pkg.tax_kit_code USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cfg FROM public.org_tax_config_cf WHERE tenant_org_id = p_tenant FOR UPDATE;
  v_cfg_found := FOUND;
  -- An active organization is never dropped back to pending (orders would stop
  -- being taxed): re-applying it must confirm in the same call.
  IF v_cfg_found AND v_cfg.status = 'ACTIVE' AND NOT p_activate AND NOT v_update THEN
    RAISE EXCEPTION 'TAX_APPLY_ACTIVE_NEEDS_ACTIVATE: the tax setup is active; re-apply with activation' USING ERRCODE = '55000';
  END IF;

  -- Our own writes do not count as organization changes (fn_tax_mark_modified).
  PERFORM set_config('app.tax_kit_apply', 'on', true);

  -- ─── Item classes ───────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_item_classes_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1 ORDER BY display_order LOOP
    SELECT * INTO v_cls FROM public.org_tax_item_classes_cf WHERE tenant_org_id = p_tenant AND class_code = r.class_code;
    IF NOT FOUND THEN
      INSERT INTO public.org_tax_item_classes_cf
        (tenant_org_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
         source, kit_version_id, created_by, created_info)
      VALUES
        (p_tenant, r.class_code, r.tax_flow_code, r.name, r.name2, r.description, r.description2,
         r.is_default AND NOT EXISTS (SELECT 1 FROM public.org_tax_item_classes_cf d
                                       WHERE d.tenant_org_id = p_tenant AND d.tax_flow_code = r.tax_flow_code
                                         AND d.is_default AND d.is_active AND d.rec_status = 1),
         r.display_order, 'HQ_KIT', v_ver.id, p_actor, v_info);
      n_cls_new := n_cls_new + 1;
    ELSIF v_cls.source = 'TENANT' OR v_cls.is_tenant_modified THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'ITEM_CLASS', 'code', r.class_code,
                                                       'reason', CASE WHEN v_cls.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
    ELSIF (v_cls.tax_flow_code, v_cls.name, v_cls.name2, v_cls.description, v_cls.description2, v_cls.display_order,
           v_cls.kit_version_id, v_cls.is_active, v_cls.rec_status)
          IS DISTINCT FROM
          (r.tax_flow_code, r.name, r.name2, r.description, r.description2, r.display_order, v_ver.id, true, 1::SMALLINT) THEN
      UPDATE public.org_tax_item_classes_cf
         SET tax_flow_code = r.tax_flow_code, name = r.name, name2 = r.name2, description = r.description,
             description2 = r.description2, display_order = r.display_order, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_cls.id;
      n_cls_upd := n_cls_upd + 1;
    END IF;
  END LOOP;

  UPDATE public.org_tax_item_classes_cf c
     SET is_active = false, is_default = false, updated_by = p_actor, updated_info = v_info
   WHERE c.tenant_org_id = p_tenant AND c.source = 'HQ_KIT' AND NOT c.is_tenant_modified AND c.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_item_classes_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.class_code = c.class_code AND k.is_active AND k.rec_status = 1);
  GET DIAGNOSTICS n_cls_off = ROW_COUNT;

  -- ─── Tax codes ──────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_codes_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1 ORDER BY display_order LOOP
    SELECT * INTO v_code FROM public.org_tax_profiles_cf
     WHERE tenant_org_id = p_tenant AND tax_code = r.tax_code ORDER BY version_no DESC LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.org_tax_profiles_cf
        (tenant_org_id, tax_code, version_no, name, name2, tax_type, rate, amount_kind, fixed_amount, calc_level,
         tax_category_code, tax_flow_code, recoverable_pct, is_reverse_charge, priority, is_compound,
         effective_from, is_default, applies_to, rounding_level, rounding_mode, source, kit_version_id, display_order,
         created_by, created_info)
      VALUES
        (p_tenant, r.tax_code, 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
         r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
         v_ver.effective_from, false, NULL, v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id, r.display_order,
         p_actor, v_info);
      n_code_new := n_code_new + 1;
    ELSIF v_code.source = 'TENANT' OR v_code.is_tenant_modified THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_CODE', 'code', r.tax_code,
                                                       'reason', CASE WHEN v_code.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
    ELSIF (v_code.tax_type, v_code.rate, v_code.amount_kind, v_code.fixed_amount, v_code.calc_level, v_code.tax_category_code,
           v_code.tax_flow_code, v_code.recoverable_pct, v_code.is_reverse_charge, v_code.priority, v_code.is_compound,
           v_code.rounding_level, v_code.rounding_mode)
          IS DISTINCT FROM
          (r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level, r.tax_category_code,
           r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
           v_ver.rounding_level, v_ver.rounding_mode) THEN
      IF public.fn_tax_profile_is_used(p_tenant, v_code.id) THEN
        -- Used version is frozen: end it yesterday and start a new version today.
        UPDATE public.org_tax_profiles_cf
           SET effective_to = GREATEST(effective_from, current_date - 1), updated_by = p_actor, updated_info = v_info
         WHERE tenant_org_id = p_tenant AND id = v_code.id;
        INSERT INTO public.org_tax_profiles_cf
          (tenant_org_id, tax_code, version_no, name, name2, tax_type, rate, amount_kind, fixed_amount, calc_level,
           tax_category_code, tax_flow_code, recoverable_pct, is_reverse_charge, priority, is_compound,
           effective_from, is_default, applies_to, rounding_level, rounding_mode, source, kit_version_id, display_order,
           created_by, created_info)
        VALUES
          (p_tenant, r.tax_code, v_code.version_no + 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
           r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
           GREATEST(current_date, v_ver.effective_from), false, NULL, v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id,
           r.display_order, p_actor, v_info);
        n_code_ver := n_code_ver + 1;
      ELSE
        UPDATE public.org_tax_profiles_cf
           SET name = r.name, name2 = r.name2, tax_type = r.tax_type, rate = r.rate, amount_kind = r.amount_kind,
               fixed_amount = r.fixed_amount, calc_level = r.calc_level, tax_category_code = r.tax_category_code,
               tax_flow_code = r.tax_flow_code, recoverable_pct = r.recoverable_pct, is_reverse_charge = r.is_reverse_charge,
               priority = r.priority, is_compound = r.compound_base, rounding_level = v_ver.rounding_level,
               rounding_mode = v_ver.rounding_mode, kit_version_id = v_ver.id, display_order = r.display_order,
               is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
         WHERE tenant_org_id = p_tenant AND id = v_code.id;
        n_code_upd := n_code_upd + 1;
      END IF;
    ELSIF (v_code.name, v_code.name2, v_code.display_order, v_code.kit_version_id, v_code.is_active, v_code.rec_status, v_code.effective_to)
          IS DISTINCT FROM (r.name, r.name2, r.display_order, v_ver.id, true, 1::SMALLINT, NULL::DATE) THEN
      UPDATE public.org_tax_profiles_cf
         SET name = r.name, name2 = r.name2, display_order = r.display_order, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_code.id;
      n_code_upd := n_code_upd + 1;
    END IF;
  END LOOP;

  UPDATE public.org_tax_profiles_cf p
     SET is_active = false, updated_by = p_actor, updated_info = v_info
   WHERE p.tenant_org_id = p_tenant AND p.source = 'HQ_KIT' AND NOT p.is_tenant_modified AND p.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_codes_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.tax_code = p.tax_code AND k.is_active AND k.rec_status = 1);
  GET DIAGNOSTICS n_code_off = ROW_COUNT;

  -- ─── Rules (kit rules for this package's segment) ───────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_rules_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1
              AND (segment_codes IS NULL OR v_pkg.segment_code = ANY (segment_codes))
            ORDER BY priority, rule_code LOOP
    SELECT * INTO v_rule FROM public.org_tax_rules_cf WHERE tenant_org_id = p_tenant AND rule_code = r.rule_code;
    v_rule_found := FOUND;
    IF v_rule_found AND (v_rule.source = 'TENANT' OR v_rule.is_tenant_modified) THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_RULE', 'code', r.rule_code,
                                                       'reason', CASE WHEN v_rule.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
      CONTINUE;
    END IF;

    -- An organization rule with the same criteria already decides these lines.
    IF EXISTS (SELECT 1 FROM public.org_tax_rules_cf o
                WHERE o.tenant_org_id = p_tenant AND o.is_active AND o.rec_status = 1
                  AND o.rule_code <> r.rule_code
                  AND o.doc_type_code IS NOT DISTINCT FROM r.doc_type_code
                  AND o.tax_flow_code IS NOT DISTINCT FROM r.tax_flow_code
                  AND o.branch_id IS NULL AND o.place_of_supply_country IS NULL AND o.service_category_code IS NULL
                  AND o.tax_item_class_code IS NOT DISTINCT FROM r.tax_item_class_code
                  AND o.party_tax_class_code IS NOT DISTINCT FROM r.party_tax_class_code
                  AND o.party_country_scope IS NOT DISTINCT FROM r.party_country_scope
                  AND o.effective_from = v_ver.effective_from) THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_RULE', 'code', r.rule_code, 'reason', 'SAME_CRITERIA');
      CONTINUE;
    END IF;

    IF NOT v_rule_found THEN
      INSERT INTO public.org_tax_rules_cf
        (tenant_org_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
         effective_from, priority, name, name2, source, kit_version_id, created_by, created_info)
      VALUES
        (p_tenant, r.rule_code, r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope,
         v_ver.effective_from, r.priority, r.name, r.name2, 'HQ_KIT', v_ver.id, p_actor, v_info)
      RETURNING id INTO v_rule_id;
      n_rule_new := n_rule_new + 1;
    ELSE
      v_rule_id := v_rule.id;
      UPDATE public.org_tax_rules_cf
         SET doc_type_code = r.doc_type_code, tax_flow_code = r.tax_flow_code, tax_item_class_code = r.tax_item_class_code,
             party_tax_class_code = r.party_tax_class_code, party_country_scope = r.party_country_scope,
             priority = r.priority, name = r.name, name2 = r.name2, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_rule_id
         AND (doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope, priority,
              name, name2, kit_version_id, is_active, rec_status, effective_to)
             IS DISTINCT FROM
             (r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope, r.priority,
              r.name, r.name2, v_ver.id, true, 1::SMALLINT, NULL::DATE);
      IF FOUND THEN n_rule_upd := n_rule_upd + 1; END IF;
      DELETE FROM public.org_tax_rule_codes_dtl WHERE tenant_org_id = p_tenant AND rule_id = v_rule_id;
    END IF;

    INSERT INTO public.org_tax_rule_codes_dtl (tenant_org_id, rule_id, seq_no, tax_code, created_by, created_info)
    SELECT p_tenant, v_rule_id, k.seq_no, k.tax_code, p_actor, v_info
      FROM public.sys_tax_kit_rule_codes_dtl k
     WHERE k.rule_id = r.id AND k.kit_version_id = v_ver.id AND k.is_active AND k.rec_status = 1;
  END LOOP;

  UPDATE public.org_tax_rules_cf o
     SET is_active = false, updated_by = p_actor, updated_info = v_info
   WHERE o.tenant_org_id = p_tenant AND o.source = 'HQ_KIT' AND NOT o.is_tenant_modified AND o.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_rules_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.rule_code = o.rule_code AND k.is_active AND k.rec_status = 1
                        AND (k.segment_codes IS NULL OR v_pkg.segment_code = ANY (k.segment_codes)));
  GET DIAGNOSTICS n_rule_off = ROW_COUNT;

  -- ─── Products without a class get the default sales class ───────────────
  SELECT class_code INTO v_default FROM public.org_tax_item_classes_cf
   WHERE tenant_org_id = p_tenant AND tax_flow_code = 'OUTPUT' AND is_default AND is_active AND rec_status = 1;
  IF v_default IS NOT NULL THEN
    UPDATE public.org_product_data_mst
       SET tax_item_class_code = v_default, updated_at = now(), updated_by = p_actor, updated_info = v_info
     WHERE tenant_org_id = p_tenant AND tax_item_class_code IS NULL;
    GET DIAGNOSTICS n_prod = ROW_COUNT;
  END IF;

  PERFORM set_config('app.tax_kit_apply', '', true);

  -- ─── Config: pending candidate ──────────────────────────────────────────
  v_n := jsonb_build_object(
    'codes',   jsonb_build_object('added', n_code_new, 'updated', n_code_upd, 'new_versions', n_code_ver, 'deactivated', n_code_off),
    'classes', jsonb_build_object('added', n_cls_new, 'updated', n_cls_upd, 'deactivated', n_cls_off),
    'rules',   jsonb_build_object('added', n_rule_new, 'updated', n_rule_upd, 'deactivated', n_rule_off),
    'products_classified', n_prod);
  v_summary := jsonb_build_object('pkg_code', p_pkg_code, 'kit_code', v_pkg.tax_kit_code, 'kit_version_no', v_ver.version_no,
                                  'segment_code', v_pkg.segment_code, 'counts', v_n, 'conflicts', v_conflicts,
                                  'mode', CASE WHEN v_update THEN 'UPDATE' ELSE 'APPLY' END);

  INSERT INTO public.org_tax_config_cf
    (tenant_org_id, starter_pkg_code, kit_code, kit_version_id, segment_code, setup_mode, status, tax_enabled,
     applied_at, applied_by, last_apply_summary, created_by, created_info)
  VALUES
    (p_tenant, p_pkg_code, v_pkg.tax_kit_code, v_ver.id, v_pkg.segment_code, v_pkg.tax_setup_mode, 'PENDING_CONFIRMATION', false,
     now(), p_actor, v_summary, p_actor, v_info)
  ON CONFLICT (tenant_org_id) DO UPDATE
     SET starter_pkg_code = EXCLUDED.starter_pkg_code, kit_code = EXCLUDED.kit_code, kit_version_id = EXCLUDED.kit_version_id,
         segment_code = EXCLUDED.segment_code,
         status = CASE WHEN v_update THEN org_tax_config_cf.status ELSE 'PENDING_CONFIRMATION' END,
         tax_enabled = CASE WHEN v_update THEN org_tax_config_cf.tax_enabled ELSE false END,
         applied_at = now(), applied_by = p_actor, last_apply_summary = EXCLUDED.last_apply_summary,
         updated_by = p_actor, updated_info = v_info;

  IF p_activate THEN
    v_confirm := public.fn_tax_config_confirm(p_tenant, p_actor, p_note);
    IF NOT (v_confirm ->> 'ok')::BOOLEAN THEN
      -- Roll back the whole apply: an active setup is never left pending.
      RAISE EXCEPTION 'TAX_ACTIVATE_NOT_READY: %', v_confirm -> 'errors' USING ERRCODE = '55000';
    END IF;
    v_summary := v_summary || jsonb_build_object('confirm', v_confirm);
  END IF;

  RETURN v_summary;
END $$;

COMMENT ON FUNCTION public.fn_tax_kit_apply(UUID, TEXT, TEXT, BOOLEAN, TEXT) IS
  'Copies a starter package''s kit (codes, item classes, segment rules) into an organization as source HQ_KIT and records a PENDING_CONFIRMATION config. Idempotent: re-apply updates only unmodified HQ_KIT rows (a used code version gets a new version), deactivates kit rows no longer in the package, and reports organization-changed rows as conflicts. Products without a class get the default sales class. p_activate = true also confirms (fn_tax_config_confirm) and fails as a whole if not ready; an ACTIVE setup can only be re-applied that way. Inside fn_tax_kit_update (app.tax_kit_update = on) it keeps the current status and tax_enabled instead (summary mode = UPDATE). Callers check permission and write their audit log.';

CREATE OR REPLACE FUNCTION public.fn_tax_kit_update(p_tenant UUID, p_actor TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE
  v_cfg     public.org_tax_config_cf%ROWTYPE;
  v_latest  UUID;
  v_summary JSONB;
BEGIN
  SELECT * INTO v_cfg FROM public.org_tax_config_cf WHERE tenant_org_id = p_tenant AND rec_status = 1;
  IF NOT FOUND OR v_cfg.starter_pkg_code IS NULL THEN
    RETURN jsonb_build_object('status', 'SKIPPED', 'reason', 'NO_KIT');
  END IF;
  SELECT id INTO v_latest FROM public.sys_tax_kit_versions_mst
   WHERE kit_code = v_cfg.kit_code AND status = 'PUBLISHED' AND rec_status = 1
     AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
   ORDER BY version_no DESC LIMIT 1;
  IF v_latest IS NULL OR v_latest = v_cfg.kit_version_id THEN
    RETURN jsonb_build_object('status', 'UP_TO_DATE');
  END IF;
  PERFORM set_config('app.tax_kit_update', 'on', true);
  v_summary := public.fn_tax_kit_apply(p_tenant, v_cfg.starter_pkg_code, p_actor, false, NULL);
  PERFORM set_config('app.tax_kit_update', '', true);
  RETURN jsonb_build_object('status', 'UPDATED', 'summary', v_summary);
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_update(UUID, TEXT) IS
  'Moves one organization to the newest published version of its kit that is in effect, re-applying its starter package without changing its status (an active setup stays active, a pending one stays pending). Rows the organization changed itself are left alone and reported as conflicts (Setup Health TAX_KIT_UPDATE_PENDING). Returns SKIPPED / UP_TO_DATE / UPDATED.';

CREATE OR REPLACE FUNCTION public.fn_tax_kit_update_all()
RETURNS JSONB LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE
  t       RECORD;
  v_res   JSONB;
  n_upd   INTEGER := 0;
  n_fail  INTEGER := 0;
BEGIN
  FOR t IN
    SELECT c.tenant_org_id
      FROM public.org_tax_config_cf c
      JOIN public.org_tenants_mst o ON o.id = c.tenant_org_id AND o.is_active AND o.rec_status = 1
     WHERE c.rec_status = 1 AND c.starter_pkg_code IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst v
                    WHERE v.kit_code = c.kit_code AND v.status = 'PUBLISHED' AND v.rec_status = 1
                      AND v.effective_from <= CURRENT_DATE AND (v.effective_to IS NULL OR v.effective_to >= CURRENT_DATE)
                      AND v.id IS DISTINCT FROM c.kit_version_id)
  LOOP
    BEGIN
      v_res := public.fn_tax_kit_update(t.tenant_org_id, 'system:tax_kit_update');
      IF v_res ->> 'status' = 'UPDATED' THEN n_upd := n_upd + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      -- One organization's failure never stops the others; Setup Health shows it.
      n_fail := n_fail + 1;
      UPDATE public.org_tax_config_cf
         SET last_apply_summary = COALESCE(last_apply_summary, '{}'::jsonb)
                                  || jsonb_build_object('update_error', SQLERRM, 'update_failed_at', now()),
             updated_by = 'system:tax_kit_update', updated_info = 'fn_tax_kit_update_all'
       WHERE tenant_org_id = t.tenant_org_id;
    END;
  END LOOP;
  RETURN jsonb_build_object('updated', n_upd, 'failed', n_fail);
END $$;
COMMENT ON FUNCTION public.fn_tax_kit_update_all() IS
  'Nightly (pg_cron tax-kit-update, 02:05, before setup-health-refresh): runs fn_tax_kit_update for every active organization not on the newest published version in effect of its kit; a failure is stored in last_apply_summary.update_error and the run continues.';

REVOKE ALL ON FUNCTION public.fn_tax_kit_update(UUID, TEXT) FROM PUBLIC, anon, authenticated;   -- HQ server and the job only
GRANT EXECUTE ON FUNCTION public.fn_tax_kit_update(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.fn_tax_kit_update_all() FROM PUBLIC, anon, authenticated;           -- the cron job (database owner) only
GRANT EXECUTE ON FUNCTION public.fn_tax_kit_update_all() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'tax-kit-update';
SELECT cron.schedule('tax-kit-update', '5 2 * * *', $$ SELECT public.fn_tax_kit_update_all() $$);

-- ─── 4. Verification ────────────────────────────────────────────────────────

DO $$
DECLARE
  v_checks INTEGER;
  v_bad    RECORD;
  k        RECORD;
  v_res    JSONB;
BEGIN
  IF (SELECT count(*) FROM public.sys_setup_health_check_cd WHERE domain_code = 'TAX' AND is_active AND rec_status = 1) <> 7 THEN
    RAISE EXCEPTION '0726: expected 7 TAX checks';
  END IF;

  SELECT count(*) INTO v_checks FROM public.sys_setup_health_check_cd WHERE is_active AND rec_status = 1;
  FOR v_bad IN
    SELECT t.id, x.check_code, x.details
      FROM public.org_tenants_mst t
      CROSS JOIN LATERAL public.fn_setup_health_run(t.id, NULL, NULL) x
     WHERE t.is_active AND t.rec_status = 1 AND x.status = 'ERROR'
     LIMIT 1
  LOOP
    RAISE EXCEPTION '0726: check % returned ERROR for tenant %: %', v_bad.check_code, v_bad.id, v_bad.details;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.org_tenants_mst t
              WHERE t.is_active AND t.rec_status = 1
                AND (SELECT count(*) FROM public.fn_setup_health_run(t.id, NULL, NULL)) <> v_checks) THEN
    RAISE EXCEPTION '0726: a tenant did not get one row per active check';
  END IF;

  -- Every published kit version still passes its own worked examples.
  FOR k IN SELECT id, kit_code, version_no FROM public.sys_tax_kit_versions_mst WHERE status = 'PUBLISHED' AND rec_status = 1 LOOP
    v_res := public.fn_tax_kit_version_check(k.id);
    IF NOT (v_res ->> 'ok')::BOOLEAN THEN
      RAISE EXCEPTION '0726: kit % v% fails its examples: %', k.kit_code, k.version_no, v_res -> 'results';
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tax-kit-update') THEN
    RAISE EXCEPTION '0726: cron job tax-kit-update was not scheduled';
  END IF;
END $$;

COMMIT;
