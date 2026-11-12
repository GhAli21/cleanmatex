-- =============================================================================
-- 0731_tax_kits_purchase_reverse_charge.sql
-- Purpose:   Correct the purchase (INPUT) rules of the four GCC VAT kits
--            (OM_VAT, SA_VAT, AE_VAT, BH_VAT) and publish them as a new kit
--            version through the normal path: clone -> edit draft -> publish.
--            Organizations move to it with the nightly kit update
--            (fn_tax_kit_update re-applies the starter package).
--
-- Tax facts (adviser review 2026-11-13):
--   * Until the GCC electronic services system is live, each GCC state treats
--     the other GCC states as outside its VAT area. A service bought from a
--     supplier in another GCC state is therefore reverse-charged like any
--     import of services. Before this migration such a purchase (scope GCC)
--     fell to the catch-all IN_ANY rule and was taxed as local input VAT.
--   * v1 applied the foreign reverse-charge rule (IN_FOREIGN_RC) only to the
--     ENTERPRISE segment, so SME and FRANCHISE_BASE organizations were charged
--     local input VAT on imported services. Reverse charge applies to every
--     VAT-registered business; packages of not-registered businesses use the
--     NO_VAT kit, so the rule now covers every segment.
--   * Reverse charge on a purchase whose input tax is not reclaimable: the tax
--     is still due (output side of the return) but cannot be recovered. A new
--     code VAT_IN_RC_NONREC (standard rate, 0 % recoverable, reverse charge)
--     covers it; the return maps (INPUT + STANDARD + reverse charge) already
--     count its TAX on the due side and its RECOVERABLE (0) on the input side.
--
-- Engine fix: rules are picked by specificity, then lowest priority; a tie is
--   AMBIGUOUS and the purchase is refused. IN_FOREIGN_RC (flow + scope) and
--   IN_STANDARD / IN_NON_REC / IN_NO_VAT (flow + class) tied at priority 100,
--   so a foreign purchase with an item class could not be taxed. New order:
--     IN_NO_VAT 40  -> an explicit "no VAT" purchase always wins
--     IN_FOREIGN_RC / IN_GCC_RC 50 -> reverse charge beats the class rules
--     IN_*_RC_NONREC (flow + class + scope) -> more specific, wins outright
--
-- Kit check: fn_tax_kit_version_check now reads optional "flow" (default
--   OUTPUT) and "country_scope" (default DOMESTIC) from each worked example, so
--   purchase rules can be proven before publishing. Existing examples, which
--   carry neither key, behave exactly as before.
--
-- Objects:   fn_tax_kit_version_check (replaced); kit data (new versions).
-- Rollback (manual): a published version cannot be deleted; publish a further
--   version restoring the previous rules if needed.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Kit check: worked examples may name the flow and the country scope ──
CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_check(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
  v_flow    TEXT;
  v_scope   TEXT;
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
    -- Sales examples omit both keys; purchase examples name them.
    v_flow  := COALESCE(x.input ->> 'flow', 'OUTPUT');
    v_scope := COALESCE(x.input ->> 'country_scope', 'DOMESTIC');
    -- Same choice as the engine (lib/tax/determine.ts): matching rules, most specific first, then lowest priority;
    -- examples use the all-segments rules.
    SELECT r.*, num_nonnulls(r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope) AS spec
      INTO v_rule
      FROM public.sys_tax_kit_rules_dtl r
     WHERE r.kit_version_id = p_version_id AND r.is_active AND r.rec_status = 1 AND r.segment_codes IS NULL
       AND (r.tax_flow_code IS NULL OR r.tax_flow_code = v_flow)
       AND (r.doc_type_code IS NULL OR r.doc_type_code = x.input ->> 'doc_type')
       AND (r.tax_item_class_code IS NULL OR r.tax_item_class_code = x.input ->> 'item_class')
       AND (r.party_tax_class_code IS NULL OR r.party_tax_class_code = x.input ->> 'party_class')
       AND (r.party_country_scope IS NULL OR r.party_country_scope = v_scope)
     ORDER BY spec DESC, r.priority, r.rule_code
     LIMIT 1;
    IF v_rule.id IS NULL THEN
      v_reason := 'NO_TAX_RULE';
    ELSE
      SELECT r2.id INTO v_next
        FROM public.sys_tax_kit_rules_dtl r2
       WHERE r2.kit_version_id = p_version_id AND r2.is_active AND r2.rec_status = 1 AND r2.segment_codes IS NULL AND r2.id <> v_rule.id
         AND (r2.tax_flow_code IS NULL OR r2.tax_flow_code = v_flow)
         AND (r2.doc_type_code IS NULL OR r2.doc_type_code = x.input ->> 'doc_type')
         AND (r2.tax_item_class_code IS NULL OR r2.tax_item_class_code = x.input ->> 'item_class')
         AND (r2.party_tax_class_code IS NULL OR r2.party_tax_class_code = x.input ->> 'party_class')
         AND (r2.party_country_scope IS NULL OR r2.party_country_scope = v_scope)
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
END $function$;

COMMENT ON FUNCTION public.fn_tax_kit_version_check(uuid) IS
  'Runs a kit version''s worked examples with the engine''s rule choice (most specific, then lowest priority; a tie is AMBIGUOUS). '
  'Example input: amount, pricing_mode, doc_type, item_class, party_class, and optional flow (default OUTPUT) and country_scope (default DOMESTIC). '
  'Returns {ok, examples, results[]}; publishing refuses a version whose examples fail.';

-- ─── 2. New version per GCC kit: GCC reverse charge + rule precedence ───────
DO $mig$
DECLARE
  k        RECORD;
  v_pub    UUID;
  v_new    UUID;
  v_dec    INTEGER;
  v_rule   UUID;
  v_actor  CONSTANT TEXT := 'migration_0731';
  v_info   CONSTANT TEXT := '0731 GCC reverse charge + purchase rule precedence';
  v_amount NUMERIC;
  e        RECORD;
BEGIN
  FOR k IN SELECT unnest(ARRAY['OM_VAT', 'SA_VAT', 'AE_VAT', 'BH_VAT']) AS kit_code LOOP
    SELECT id INTO v_pub FROM public.sys_tax_kit_versions_mst
     WHERE kit_code = k.kit_code AND status = 'PUBLISHED' AND rec_status = 1
     ORDER BY version_no DESC LIMIT 1;
    IF v_pub IS NULL THEN
      RAISE EXCEPTION '0731: kit % has no published version', k.kit_code;
    END IF;
    -- Starts tomorrow; the version in effect today ends today when this one is published.
    v_new := public.fn_tax_kit_version_clone(v_pub, v_actor);

    -- New code: reverse charge on a purchase whose input tax is not reclaimable.
    INSERT INTO public.sys_tax_kit_codes_dtl
      (kit_version_id, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, fixed_amount,
       calc_level, recoverable_pct, is_reverse_charge, priority, compound_base, display_order, is_active, rec_status,
       created_by, created_info)
    SELECT v_new, 'VAT_IN_RC_NONREC', 'Reverse charge VAT (not reclaimable)', 'ضريبة الاحتساب العكسي (غير قابلة للاسترداد)',
           c.tax_type, c.tax_category_code, c.tax_flow_code, c.amount_kind, c.rate, c.fixed_amount,
           c.calc_level, 0, true, c.priority, c.compound_base, 85, true, 1, v_actor, v_info
      FROM public.sys_tax_kit_codes_dtl c
     WHERE c.kit_version_id = v_new AND c.tax_code = 'VAT_IN_RC';
    IF NOT FOUND THEN
      RAISE EXCEPTION '0731: kit % has no VAT_IN_RC code', k.kit_code;
    END IF;

    -- Precedence: explicit "no VAT" first, then reverse charge, then the class rules (100).
    UPDATE public.sys_tax_kit_rules_dtl SET priority = 40, updated_by = v_actor, updated_info = v_info
     WHERE kit_version_id = v_new AND rule_code = 'IN_NO_VAT';
    -- v1 limited this rule to the ENTERPRISE segment (a plan illustration, not a tax fact).
    -- Every package on a VAT kit is VAT-registered (NOT_VAT_REGISTERED packages use NO_VAT),
    -- and every registered business self-accounts for imported services: all segments.
    UPDATE public.sys_tax_kit_rules_dtl SET priority = 50, segment_codes = NULL, updated_by = v_actor, updated_info = v_info
     WHERE kit_version_id = v_new AND rule_code = 'IN_FOREIGN_RC';

    -- New rules. Names match the existing rule style (EN/AR).
    FOR e IN
      SELECT * FROM (VALUES
        ('IN_GCC_RC',           NULL::TEXT,          'GCC',     50::SMALLINT, 'VAT_IN_RC',
         'Services bought from another GCC state: reverse charge.', 'خدمات مشتراة من دولة خليجية أخرى: احتساب عكسي.'),
        ('IN_FOREIGN_RC_NONREC', 'PURCHASE_NON_REC', 'FOREIGN', 50::SMALLINT, 'VAT_IN_RC_NONREC',
         'Services bought from abroad, tax not reclaimable: reverse charge.', 'خدمات مشتراة من الخارج وضريبتها غير قابلة للاسترداد: احتساب عكسي.'),
        ('IN_GCC_RC_NONREC',    'PURCHASE_NON_REC', 'GCC',     50::SMALLINT, 'VAT_IN_RC_NONREC',
         'Services bought from another GCC state, tax not reclaimable: reverse charge.', 'خدمات مشتراة من دولة خليجية أخرى وضريبتها غير قابلة للاسترداد: احتساب عكسي.')
      ) AS t(rule_code, item_class, scope, priority, tax_code, name, name2)
    LOOP
      INSERT INTO public.sys_tax_kit_rules_dtl
        (kit_version_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code,
         party_country_scope, segment_codes, priority, name, name2, is_active, rec_status, created_by, created_info)
      VALUES
        (v_new, e.rule_code, NULL, 'INPUT', e.item_class, NULL, e.scope, NULL, e.priority, e.name, e.name2, true, 1, v_actor, v_info)
      RETURNING id INTO v_rule;
      INSERT INTO public.sys_tax_kit_rule_codes_dtl
        (rule_id, kit_version_id, seq_no, tax_code, is_active, rec_status, created_by, created_info)
      VALUES (v_rule, v_new, 1, e.tax_code, true, 1, v_actor, v_info);
    END LOOP;

    -- Worked examples for every purchase case (exclusive amounts of 100 in the kit currency).
    SELECT COALESCE(cur.minor_unit, 2) INTO v_dec
      FROM public.sys_tax_kit_versions_mst v LEFT JOIN public.sys_currency_cd cur ON cur.code = v.currency_code
     WHERE v.id = v_new;
    v_amount := round(100::NUMERIC, v_dec);
    INSERT INTO public.sys_tax_kit_vectors_dtl
      (kit_version_id, vector_code, description, description2, input, expected, is_active, rec_status, created_by, created_info)
    SELECT v_new, t.vector_code, t.description, t.description2,
           jsonb_build_object('amount', v_amount::TEXT, 'pricing_mode', 'EXCLUSIVE', 'flow', 'INPUT',
                              'country_scope', t.scope, 'item_class', t.item_class),
           jsonb_build_object('tax_code', t.tax_code, 'taxable', v_amount::TEXT,
                              'tax', round(v_amount * c.rate / 100, v_dec)::TEXT),
           true, 1, v_actor, v_info
      FROM (VALUES
        ('IN_DOMESTIC_STD',     'DOMESTIC', 'PURCHASE_STANDARD', 'VAT_IN_STD',
         'Local purchase, standard rate.', 'شراء محلي بالنسبة الأساسية.'),
        ('IN_FOREIGN_RC',       'FOREIGN',  'PURCHASE_STANDARD', 'VAT_IN_RC',
         'Service from abroad: reverse charge.', 'خدمة من الخارج: احتساب عكسي.'),
        ('IN_GCC_RC',           'GCC',      'PURCHASE_STANDARD', 'VAT_IN_RC',
         'Service from another GCC state: reverse charge.', 'خدمة من دولة خليجية أخرى: احتساب عكسي.'),
        ('IN_GCC_RC_NONREC',    'GCC',      'PURCHASE_NON_REC',  'VAT_IN_RC_NONREC',
         'Service from another GCC state, not reclaimable: reverse charge.', 'خدمة من دولة خليجية أخرى غير قابلة للاسترداد: احتساب عكسي.'),
        ('IN_FOREIGN_NO_VAT',   'FOREIGN',  'PURCHASE_NO_VAT',   'VAT_IN_NONE',
         'Purchase from abroad marked "no VAT" (e.g. VAT paid at customs).', 'شراء من الخارج بدون ضريبة (مثل ضريبة مدفوعة في الجمارك).')
      ) AS t(vector_code, scope, item_class, tax_code, description, description2)
      JOIN public.sys_tax_kit_codes_dtl c ON c.kit_version_id = v_new AND c.tax_code = t.tax_code;

    UPDATE public.sys_tax_kit_versions_mst
       SET is_verified = true, checked_on = CURRENT_DATE,
           review_notes = concat_ws(E'\n', review_notes,
             '0731: GCC suppliers reverse-charged (GCC states treat each other as outside the VAT area until the GCC electronic services system is live); purchase rule precedence fixed; non-reclaimable reverse charge code.'),
           updated_by = v_actor, updated_info = v_info
     WHERE id = v_new;

    -- Runs the worked examples and refuses to publish if any fails.
    PERFORM public.fn_tax_kit_version_publish(v_new, v_actor);
  END LOOP;
END
$mig$;

COMMIT;
