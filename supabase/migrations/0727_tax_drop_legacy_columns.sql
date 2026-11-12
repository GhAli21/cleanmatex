-- 0727_tax_drop_legacy_columns.sql
-- Tax Engine M4b (ADR-061): drop the old tax-engine columns.
--
-- Orders are taxed by tax rules (org_tax_rules_cf) since T4. The old engine
-- chose tax profiles by these columns; no code reads them any more:
--   org_tax_profiles_cf.applies_to   supply codes a profile applied to
--   org_tax_profiles_cf.is_default   profile applied to every line
--   org_product_data_mst.tax_supply_code  the product's supply code
-- Data checked before writing: no product carries a supply code; old orders
-- keep their tax on their own tax lines (org_order_taxes_dtl), not on these columns.
--
-- Steps:
--   1. fn_tax_kit_apply no longer writes is_default / applies_to (same logic otherwise, from 0726).
--   2. The profile list index loses is_default.
--   3. Drop the three columns (RESTRICT: fails if anything still depends on them).
-- Not touched: org_tax_item_classes_cf.is_default (the default item class, still used).

BEGIN;

-- ─── 1. Kit apply without the old columns ─────────────────────────────────
-- Re-created from 0726 with only the two old columns removed from both INSERTs
-- into org_tax_profiles_cf. Grants are kept by CREATE OR REPLACE (service_role only).

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
         effective_from, rounding_level, rounding_mode, source, kit_version_id, display_order,
         created_by, created_info)
      VALUES
        (p_tenant, r.tax_code, 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
         r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
         v_ver.effective_from, v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id, r.display_order,
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
           effective_from, rounding_level, rounding_mode, source, kit_version_id, display_order,
           created_by, created_info)
        VALUES
          (p_tenant, r.tax_code, v_code.version_no + 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
           r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
           GREATEST(current_date, v_ver.effective_from), v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id,
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


-- ─── 2. Profile list index without is_default ─────────────────────────────
-- The old index (tenant_org_id, is_active, is_default) served the old default-profile lookup.
DROP INDEX IF EXISTS public.idx_tax_profiles_tenant RESTRICT;
CREATE INDEX IF NOT EXISTS idx_tax_profiles_tenant
  ON public.org_tax_profiles_cf (tenant_org_id, is_active);
COMMENT ON INDEX public.idx_tax_profiles_tenant IS
  'Active tax codes of an organization (tax setup screens, order tax loader).';

-- ─── 3. Drop the old columns ──────────────────────────────────────────────
-- Removal intent: replaced by tax rules (org_tax_rules_cf) and item tax classes (tax_item_class_code).
ALTER TABLE public.org_tax_profiles_cf DROP COLUMN IF EXISTS applies_to RESTRICT;
ALTER TABLE public.org_tax_profiles_cf DROP COLUMN IF EXISTS is_default RESTRICT;
ALTER TABLE public.org_product_data_mst DROP COLUMN IF EXISTS tax_supply_code RESTRICT;

COMMIT;
