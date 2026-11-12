-- =============================================================================
-- 0732_tax_kit_draft_rule_class_save.sql
-- Purpose:   Let HQ (the SaaS Backoffice) add and change the rules and the item
--            tax classes of a DRAFT tax kit version. Before this, a draft could
--            only change its header, tax codes and worked examples; a rule or
--            class change needed a migration.
--            Each save is one function call = one transaction, so a rule and its
--            ordered tax codes never disagree.
-- Objects:   fn_tax_kit_draft_rule_save(uuid, jsonb, text)  (new)
--            fn_tax_kit_draft_class_save(uuid, jsonb, text) (new)
-- Called by: HQ platform-api tax-setup module (service role) only.
-- Already enforced elsewhere and relied on here: kit lock (fn_tax_kit_lock_guard:
--            content changes only in a DRAFT), FKs (doc type, party class, item
--            class, tax codes), uq_stkr_criteria, the segments trigger. Publishing
--            re-runs the worked examples (fn_tax_kit_version_check).
-- Errors:    TAX_KIT_* codes in the message ("CODE: text"), surfaced by HQ as is.
-- Rollback (manual): DROP FUNCTION ... RESTRICT for both functions.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Rule save ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_tax_kit_draft_rule_save(p_version_id uuid, p_rule jsonb, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_ver      public.sys_tax_kit_versions_mst%ROWTYPE;
  v_code     TEXT := p_rule ->> 'rule_code';
  v_flow     TEXT := NULLIF(btrim(p_rule ->> 'tax_flow_code'), '');
  v_doc      TEXT := NULLIF(btrim(p_rule ->> 'doc_type_code'), '');
  v_class    TEXT := NULLIF(btrim(p_rule ->> 'tax_item_class_code'), '');
  v_party    TEXT := NULLIF(btrim(p_rule ->> 'party_tax_class_code'), '');
  v_scope    TEXT := NULLIF(btrim(p_rule ->> 'party_country_scope'), '');
  v_segments TEXT[];
  v_priority INTEGER := COALESCE((p_rule ->> 'priority')::INTEGER, 100);
  v_name     TEXT := NULLIF(btrim(p_rule ->> 'name'), '');
  v_name2    TEXT := NULLIF(btrim(p_rule ->> 'name2'), '');
  v_active   BOOLEAN := COALESCE((p_rule ->> 'is_active')::BOOLEAN, true);
  v_codes    TEXT[];
  v_bad      TEXT;
  v_rule_id  UUID;
  v_spec     INTEGER;
  v_conflict TEXT;
  v_info     CONSTANT TEXT := 'HQ tax setup: draft rule saved';
BEGIN
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: actor is required' USING ERRCODE = '22023';
  END IF;
  -- Serializes saves on one draft (two HQ users never interleave a rule and its codes).
  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id AND rec_status = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  IF v_ver.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TAX_KIT_NOT_DRAFT: only a draft version can be changed' USING ERRCODE = '55000';
  END IF;

  -- Shape checks (text codes stay in the DB-mirror format of the seeds).
  IF v_code IS NULL OR v_code !~ '^[A-Z][A-Z0-9_]{1,39}$' THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: rule_code must be 2-40 capital letters, digits or _' USING ERRCODE = '22023';
  END IF;
  IF v_flow IS NULL OR v_flow NOT IN ('OUTPUT', 'INPUT', 'WITHHOLDING') THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: tax_flow_code must be OUTPUT, INPUT or WITHHOLDING' USING ERRCODE = '22023';
  END IF;
  IF v_scope IS NOT NULL AND v_scope NOT IN ('DOMESTIC', 'GCC', 'FOREIGN') THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: party_country_scope must be DOMESTIC, GCC or FOREIGN' USING ERRCODE = '22023';
  END IF;
  IF v_priority < 1 OR v_priority > 32767 THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: priority must be between 1 and 32767' USING ERRCODE = '22023';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: name is required' USING ERRCODE = '22023';
  END IF;
  -- Empty segment list = every segment (NULL), as the CHECK requires.
  IF jsonb_typeof(p_rule -> 'segment_codes') = 'array' AND jsonb_array_length(p_rule -> 'segment_codes') > 0 THEN
    SELECT array_agg(DISTINCT s ORDER BY s) INTO v_segments FROM jsonb_array_elements_text(p_rule -> 'segment_codes') AS s;
  END IF;
  IF COALESCE(jsonb_typeof(p_rule -> 'tax_codes'), '') <> 'array' OR jsonb_array_length(p_rule -> 'tax_codes') = 0 THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: tax_codes must list at least one tax code' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(c ORDER BY ord) INTO v_codes FROM jsonb_array_elements_text(p_rule -> 'tax_codes') WITH ORDINALITY AS t(c, ord);
  IF cardinality(v_codes) <> (SELECT count(DISTINCT c) FROM unnest(v_codes) AS c) THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: a tax code is listed twice' USING ERRCODE = '22023';
  END IF;

  -- Every code must be an active code of this version with the rule's flow.
  SELECT c INTO v_bad FROM unnest(v_codes) AS c
   WHERE NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_codes_dtl k
                      WHERE k.kit_version_id = p_version_id AND k.tax_code = c AND k.is_active AND k.rec_status = 1
                        AND k.tax_flow_code = v_flow)
   LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: tax code % is not an active % code of this version', v_bad, v_flow USING ERRCODE = '22023';
  END IF;
  -- An item class belongs to one flow (OUTPUT or INPUT).
  IF v_class IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.sys_tax_kit_item_classes_dtl k
        WHERE k.kit_version_id = p_version_id AND k.class_code = v_class AND k.is_active AND k.rec_status = 1
          AND k.tax_flow_code = v_flow) THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: item class % is not an active % class of this version', v_class, v_flow USING ERRCODE = '22023';
  END IF;

  -- Same tie test as the engine's save check (lib/tax/determine.ts findTaxRuleConflict):
  -- equal specificity and priority, no criterion that tells them apart, overlapping segments.
  IF v_active THEN
    v_spec := num_nonnulls(v_doc, v_flow, v_class, v_party, v_scope);
    SELECT r.rule_code INTO v_conflict
      FROM public.sys_tax_kit_rules_dtl r
     WHERE r.kit_version_id = p_version_id AND r.rule_code <> v_code AND r.is_active AND r.rec_status = 1
       AND r.priority = v_priority
       AND num_nonnulls(r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope) = v_spec
       AND (r.doc_type_code IS NULL OR v_doc IS NULL OR r.doc_type_code = v_doc)
       AND (r.tax_flow_code = v_flow)
       AND (r.tax_item_class_code IS NULL OR v_class IS NULL OR r.tax_item_class_code = v_class)
       AND (r.party_tax_class_code IS NULL OR v_party IS NULL OR r.party_tax_class_code = v_party)
       AND (r.party_country_scope IS NULL OR v_scope IS NULL OR r.party_country_scope = v_scope)
       AND (r.segment_codes IS NULL OR v_segments IS NULL OR r.segment_codes && v_segments)
     ORDER BY r.rule_code
     LIMIT 1;
    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION 'TAX_KIT_RULE_CONFLICT: rule % can tie with rule % (same specificity and priority); change the priority or a criterion', v_code, v_conflict
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.sys_tax_kit_rules_dtl
    (kit_version_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code,
     party_country_scope, segment_codes, priority, name, name2, is_active, rec_status, created_by, created_info)
  VALUES
    (p_version_id, v_code, v_doc, v_flow, v_class, v_party, v_scope, v_segments, v_priority, v_name, v_name2,
     v_active, 1, p_actor, v_info)
  ON CONFLICT (kit_version_id, rule_code) DO UPDATE SET
    doc_type_code = EXCLUDED.doc_type_code, tax_flow_code = EXCLUDED.tax_flow_code,
    tax_item_class_code = EXCLUDED.tax_item_class_code, party_tax_class_code = EXCLUDED.party_tax_class_code,
    party_country_scope = EXCLUDED.party_country_scope, segment_codes = EXCLUDED.segment_codes,
    priority = EXCLUDED.priority, name = EXCLUDED.name, name2 = EXCLUDED.name2, is_active = EXCLUDED.is_active,
    updated_by = p_actor, updated_info = v_info
  RETURNING id INTO v_rule_id;

  -- The ordered code list is replaced as a whole.
  DELETE FROM public.sys_tax_kit_rule_codes_dtl WHERE rule_id = v_rule_id AND kit_version_id = p_version_id;
  INSERT INTO public.sys_tax_kit_rule_codes_dtl
    (rule_id, kit_version_id, seq_no, tax_code, is_active, rec_status, created_by, created_info)
  SELECT v_rule_id, p_version_id, ord, c, true, 1, p_actor, v_info
    FROM unnest(v_codes) WITH ORDINALITY AS t(c, ord);

  RETURN (SELECT to_jsonb(r) || jsonb_build_object('tax_codes', to_jsonb(v_codes))
            FROM public.sys_tax_kit_rules_dtl r WHERE r.id = v_rule_id);
END $function$;

COMMENT ON FUNCTION public.fn_tax_kit_draft_rule_save(uuid, jsonb, text) IS
  'HQ: creates or replaces one rule of a DRAFT kit version (by rule_code) with its ordered tax codes, in one transaction. '
  'p_rule: rule_code, tax_flow_code (required), doc_type_code, tax_item_class_code, party_tax_class_code, party_country_scope, '
  'segment_codes[], priority (default 100), name (required), name2, is_active (default true), tax_codes[] (>= 1, same flow). '
  'Refuses a tie with another active rule (TAX_KIT_RULE_CONFLICT). Returns the rule row plus tax_codes.';

REVOKE ALL ON FUNCTION public.fn_tax_kit_draft_rule_save(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
-- Only HQ's server (service role) edits the global kit catalog.
GRANT EXECUTE ON FUNCTION public.fn_tax_kit_draft_rule_save(uuid, jsonb, text) TO service_role;

-- ─── 2. Item class save ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_tax_kit_draft_class_save(p_version_id uuid, p_class jsonb, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_ver      public.sys_tax_kit_versions_mst%ROWTYPE;
  v_old      public.sys_tax_kit_item_classes_dtl%ROWTYPE;
  v_code     TEXT := p_class ->> 'class_code';
  v_flow     TEXT := NULLIF(btrim(p_class ->> 'tax_flow_code'), '');
  v_name     TEXT := NULLIF(btrim(p_class ->> 'name'), '');
  v_default  BOOLEAN := COALESCE((p_class ->> 'is_default')::BOOLEAN, false);
  v_active   BOOLEAN := COALESCE((p_class ->> 'is_active')::BOOLEAN, true);
  v_order    INTEGER := COALESCE((p_class ->> 'display_order')::INTEGER, 100);
  v_used     TEXT;
  v_info     CONSTANT TEXT := 'HQ tax setup: draft item class saved';
BEGIN
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: actor is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id AND rec_status = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  IF v_ver.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TAX_KIT_NOT_DRAFT: only a draft version can be changed' USING ERRCODE = '55000';
  END IF;
  IF v_code IS NULL OR v_code !~ '^[A-Z][A-Z0-9_]{1,39}$' THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: class_code must be 2-40 capital letters, digits or _' USING ERRCODE = '22023';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: name is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.sys_tax_kit_item_classes_dtl WHERE kit_version_id = p_version_id AND class_code = v_code;
  IF FOUND THEN
    -- Rules and organization items point at the class within its flow: the flow never changes.
    IF v_flow IS NOT NULL AND v_flow <> v_old.tax_flow_code THEN
      RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: the flow of class % cannot change', v_code USING ERRCODE = '22023';
    END IF;
    v_flow := v_old.tax_flow_code;
  ELSIF v_flow IS NULL OR v_flow NOT IN ('OUTPUT', 'INPUT') THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: tax_flow_code must be OUTPUT or INPUT' USING ERRCODE = '22023';
  END IF;

  IF v_default AND NOT v_active THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: the default class must be active' USING ERRCODE = '22023';
  END IF;
  -- The current default stays until another class of the flow becomes the default.
  IF v_old.is_default AND NOT v_default THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: class % is the default of its flow; make another class the default instead', v_code
      USING ERRCODE = '22023';
  END IF;
  IF NOT v_active THEN
    SELECT r.rule_code INTO v_used FROM public.sys_tax_kit_rules_dtl r
     WHERE r.kit_version_id = p_version_id AND r.tax_item_class_code = v_code AND r.is_active AND r.rec_status = 1
     ORDER BY r.rule_code LIMIT 1;
    IF v_used IS NOT NULL THEN
      RAISE EXCEPTION 'TAX_KIT_CLASS_IN_USE: class % is used by active rule %', v_code, v_used USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_default THEN
    UPDATE public.sys_tax_kit_item_classes_dtl
       SET is_default = false, updated_by = p_actor, updated_info = v_info
     WHERE kit_version_id = p_version_id AND tax_flow_code = v_flow AND class_code <> v_code AND is_default;
  END IF;

  INSERT INTO public.sys_tax_kit_item_classes_dtl
    (kit_version_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
     is_active, rec_status, created_by, created_info)
  VALUES
    (p_version_id, v_code, v_flow, v_name, NULLIF(btrim(p_class ->> 'name2'), ''),
     NULLIF(btrim(p_class ->> 'description'), ''), NULLIF(btrim(p_class ->> 'description2'), ''),
     v_default, v_order, v_active, 1, p_actor, v_info)
  ON CONFLICT (kit_version_id, class_code) DO UPDATE SET
    name = EXCLUDED.name, name2 = EXCLUDED.name2, description = EXCLUDED.description,
    description2 = EXCLUDED.description2, is_default = EXCLUDED.is_default, display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active, updated_by = p_actor, updated_info = v_info;

  RETURN (SELECT to_jsonb(c) FROM public.sys_tax_kit_item_classes_dtl c WHERE c.kit_version_id = p_version_id AND c.class_code = v_code);
END $function$;

COMMENT ON FUNCTION public.fn_tax_kit_draft_class_save(uuid, jsonb, text) IS
  'HQ: creates or replaces one item tax class of a DRAFT kit version (by class_code). '
  'p_class: class_code, tax_flow_code (OUTPUT/INPUT, required on create, never changes), name (required), name2, '
  'description, description2, is_default (moves the flow default here), display_order, is_active. '
  'Refuses to deactivate a class used by an active rule (TAX_KIT_CLASS_IN_USE) or to leave a flow without its default.';

REVOKE ALL ON FUNCTION public.fn_tax_kit_draft_class_save(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
-- Only HQ's server (service role) edits the global kit catalog.
GRANT EXECUTE ON FUNCTION public.fn_tax_kit_draft_class_save(uuid, jsonb, text) TO service_role;

COMMIT;
