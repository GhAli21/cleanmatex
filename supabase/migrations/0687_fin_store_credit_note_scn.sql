--
-- Migration 0687_fin_store_credit_note_scn.sql
-- Human-Friendly Codes, P5 (store credit note numbering cutover), migration 1 of 1.
--
-- Purpose: org_credit_notes_mst.credit_note_no moves from the app COUNT+1 generator
--          (stored-value.service.ts: CN-<first 8 chars of tenant id>-<count+1 pad 5>) to the shared engine.
--   0. Pre-checks (raise and change nothing when they fail): config row present and still DOMAIN, target table,
--      column and tenant unique index present, no NULL/blank credit_note_no, printed prefix SCN free.
--   1. LOCK org_credit_notes_mst (SHARE ROW EXCLUSIVE: reads go on, inserts/updates wait for this migration only).
--   2. Seed org_doc_seq_mst (doc type STORE_CREDIT_NOTE) from any existing SCN-YYYY-<n> rows (normally none).
--   3. sys_doc_seq_type_cd row STORE_CREDIT_NOTE: DOMAIN -> GENERAL, printed prefix CN -> SCN, parts RAND-SEQ -> YYYY-SEQ,
--      pad 5 -> 6, reset NEVER -> YEARLY (same transaction as the seed and the triggers).
--   4. credit_note_no DEFAULT '' + CHECK ck_fin_cn_no_set (never stored empty: the trigger fills it first).
--   5. Generic assign trigger trg_fin_cn_no_assign (fills an empty credit_note_no) + guard trg_fin_cn_no_guard (immutable).
--
-- Format: SCN-<YYYY in the tenant time zone>-<seq pad 6, grows past 999999>, yearly reset, row-locked counter
--         (gap-free on rollback). Example: SCN-2026-000001.
-- Legacy CN-<tenant8>-<n> rows are kept as they are (no backfill): they never match the SCN- pattern, so they can
-- not collide with new numbers and fn_doc_seq_consistency_data() ignores them for counter_behind.
-- Why the generic trigger (fn_doc_seq_assign_code) and not a typed one: store credit notes are a low-volume table
-- (one row per refund / goodwill / overpayment disposition), the case the 0670 header reserves the generic one for.
--
-- Writers (all verified 2026-10-31): only web-admin lib/services/stored-value.service.ts inserts rows
--   (issueCreditNoteTx, issueCreditNote). No DB function inserts into this table (0296 pg_cron and 0465 only
--   update status). org_order_credit_apps_dtl.credit_note_no (0283) is a snapshot copy, not a generator.
-- Affected: org_credit_notes_mst (DEFAULT, CHECK, 2 triggers, column comment), org_doc_seq_mst (seed rows, if any),
--           sys_doc_seq_type_cd (STORE_CREDIT_NOTE row). No new function.
--           Prisma: credit_note_no gains @default("") on the next pull (optional; the app passes '' explicitly).
--           Supabase types: no change (column type and nullability unchanged).
-- Related:  0286 (table, uq_credit_note_no), 0667 doc_seq_type_config (row seeded DOMAIN), 0669 doc_seq_counters,
--           0670 doc_seq_engine_fns (fn_doc_seq_assign_code, fn_doc_seq_guard_immutable), 0671 doc_seq_consistency,
--           0674 ord_order_no_engine (same cutover pattern).
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.11, D6, T5.1;
--           decisions A-50..A-53.
-- APPLY ORDER: 1 of 1 in P5. Requires 0667-0671 (P1). Apply this migration BEFORE deploying the web-admin P5 code.
--              The old app code keeps working after the apply (a supplied CN-... value is kept by the trigger);
--              the new app code (ENGINE mode) needs this migration, otherwise it stops with
--              STORE_CREDIT_NOTE_NO_NOT_ASSIGNED and rolls back (no credit note is issued without a number).
--              Pre-checks: DEV_GUIDE_DOC_SEQ_ENGINE.md section 20 (P5 pre-apply checks).
-- ROLLBACK PLAN (forward-only repo; write a new migration). Data is untouched, so it is safe at any time:
--   1. Set STORE_CREDIT_NOTE_NUMBERING = 'LEGACY' in web-admin lib/constants/doc-seq.ts and deploy (first).
--   2. DROP TRIGGER trg_fin_cn_no_assign ON public.org_credit_notes_mst;
--      DROP TRIGGER trg_fin_cn_no_guard ON public.org_credit_notes_mst;
--      ALTER TABLE public.org_credit_notes_mst DROP CONSTRAINT ck_fin_cn_no_set;
--      ALTER TABLE public.org_credit_notes_mst ALTER COLUMN credit_note_no DROP DEFAULT;
--      UPDATE public.sys_doc_seq_type_cd SET manage_by_level = 'DOMAIN', prefix = 'CN', parts_format = 'RAND-SEQ',
--        seq_pad_length = 5, reset_policy = 'NEVER', managed_by_object = 'app:web-admin/lib/services/stored-value.service.ts'
--        WHERE doc_type_code = 'STORE_CREDIT_NOTE';
--   Issued SCN numbers stay valid (keep the org_doc_seq_mst rows so a later re-cutover continues the sequence).
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- 0. Pre-checks ------------------------------------------------------------------------------------------------
DO $pre$
DECLARE
  r     public.sys_doc_seq_type_cd%ROWTYPE;
  v_bad BIGINT;
BEGIN
  SELECT * INTO r FROM public.sys_doc_seq_type_cd WHERE doc_type_code = 'STORE_CREDIT_NOTE';
  IF NOT FOUND OR r.target_table IS DISTINCT FROM 'org_credit_notes_mst' OR r.target_column IS DISTINCT FROM 'credit_note_no' THEN
    RAISE EXCEPTION 'FIN_SCN_CFG_MISSING: sys_doc_seq_type_cd row STORE_CREDIT_NOTE for org_credit_notes_mst.credit_note_no not found';
  END IF;
  IF r.manage_by_level = 'GENERAL' THEN
    RAISE EXCEPTION 'FIN_SCN_ALREADY_GENERAL: STORE_CREDIT_NOTE is already GENERAL (migration applied twice?)';
  END IF;
  IF to_regclass('public.org_credit_notes_mst') IS NULL THEN
    RAISE EXCEPTION 'FIN_SCN_TABLE_MISSING: public.org_credit_notes_mst';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_index i
        WHERE i.indrelid = 'public.org_credit_notes_mst'::regclass AND i.indisunique AND i.indisvalid AND i.indpred IS NULL
          AND ARRAY(SELECT a.attname::TEXT FROM unnest(i.indkey) k(attnum)
                      JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY 1)
              = ARRAY['credit_note_no', 'tenant_org_id']) THEN
    RAISE EXCEPTION 'FIN_SCN_UNIQUE_MISSING: no unique index on org_credit_notes_mst (tenant_org_id, credit_note_no)';
  END IF;
  SELECT count(*) INTO v_bad FROM public.org_credit_notes_mst WHERE credit_note_no IS NULL OR btrim(credit_note_no) = '';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'FIN_SCN_EMPTY_ROWS: % credit note(s) have an empty credit_note_no; fix them first (DEV_GUIDE section 20)', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_doc_seq_type_cd
              WHERE doc_type_code <> 'STORE_CREDIT_NOTE' AND manage_by_level = 'GENERAL' AND prefix = 'SCN') THEN
    RAISE EXCEPTION 'FIN_SCN_PREFIX_TAKEN: another GENERAL doc type already prints prefix SCN';
  END IF;
END $pre$;

-- 1. Lock: no credit note insert or number change can slip between the seed and the trigger ---------------------
LOCK TABLE public.org_credit_notes_mst IN SHARE ROW EXCLUSIVE MODE;

-- 2. Seed the counters from any existing SCN-YYYY-<n> rows (period key = YYYY) ------------------------------------
INSERT INTO public.org_doc_seq_mst (tenant_org_id, doc_type_code, period_key, last_value, created_by, created_info)
SELECT n.tenant_org_id, 'STORE_CREDIT_NOTE', split_part(n.credit_note_no, '-', 2), MAX(split_part(n.credit_note_no, '-', 3)::BIGINT),
       'migration', 'fin_store_credit_note_scn seed'
  FROM public.org_credit_notes_mst n
 WHERE n.credit_note_no ~ '^SCN-[0-9]{4}-[0-9]{1,18}$'
 GROUP BY n.tenant_org_id, split_part(n.credit_note_no, '-', 2)
ON CONFLICT (tenant_org_id, doc_type_code, period_key)
DO UPDATE SET last_value = GREATEST(public.org_doc_seq_mst.last_value, EXCLUDED.last_value),
              updated_by = 'migration', updated_info = 'fin_store_credit_note_scn seed';

-- 3. STORE_CREDIT_NOTE config row: DOMAIN -> GENERAL ---------------------------------------------------------------
DO $chk$
DECLARE v_rows INT;
BEGIN
  UPDATE public.sys_doc_seq_type_cd
     SET prefix          = 'SCN',
         type_prefix     = 'SCN',
         separator       = '-',
         parts_format    = 'YYYY-SEQ',
         seq_pad_length  = 6,
         reset_policy    = 'YEARLY',
         manage_by_level = 'GENERAL',
         managed_by_object = 'public.fn_doc_seq_assign_code() via trg_fin_cn_no_assign on org_credit_notes_mst',
         implement_description =
           'Engine-managed since P5 (migration fin_store_credit_note_scn): trigger trg_fin_cn_no_assign '
           || '(fn_doc_seq_assign_code(''STORE_CREDIT_NOTE'', ''credit_note_no'')) fills an empty credit_note_no with '
           || 'SCN-<YYYY in the tenant time zone>-<seq pad 6, grows>, yearly reset, row-locked counter in org_doc_seq_mst. '
           || 'web-admin lib/services/stored-value.service.ts (issueCreditNoteTx, issueCreditNote) inserts with '
           || 'credit_note_no = '''' and reads the number back from the INSERT ... RETURNING row. trg_fin_cn_no_guard keeps '
           || 'it immutable; ck_fin_cn_no_set forbids an empty value. Legacy CN-<tenant8>-<n> rows (before P5) are kept. '
           || 'org_order_credit_apps_dtl.credit_note_no is a snapshot copy, not a generator. Check: SELECT credit_note_no '
           || 'FROM org_credit_notes_mst WHERE tenant_org_id = $1 ORDER BY created_at DESC LIMIT 5; counters: SELECT * '
           || 'FROM org_doc_seq_mst WHERE tenant_org_id = $1 AND doc_type_code = ''STORE_CREDIT_NOTE'' ORDER BY '
           || 'period_key DESC LIMIT 5; Reserved type prefix SCN (scan payload CMX1:SCN:<code>).',
         updated_by   = 'migration',
         updated_info = 'fin_store_credit_note_scn'
   WHERE doc_type_code = 'STORE_CREDIT_NOTE'
     AND target_table = 'org_credit_notes_mst' AND target_column = 'credit_note_no'
     AND manage_by_level = 'DOMAIN';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'FIN_SCN_CFG_MISSING: sys_doc_seq_type_cd row STORE_CREDIT_NOTE (DOMAIN) for org_credit_notes_mst.credit_note_no not found';
  END IF;
END $chk$;

-- 4. Default '' (the trigger replaces it) and the never-empty CHECK --------------------------------------------------
ALTER TABLE public.org_credit_notes_mst ALTER COLUMN credit_note_no SET DEFAULT '';
ALTER TABLE public.org_credit_notes_mst
  ADD CONSTRAINT ck_fin_cn_no_set CHECK (btrim(credit_note_no) <> '');
COMMENT ON CONSTRAINT ck_fin_cn_no_set ON public.org_credit_notes_mst IS
  'credit_note_no is never stored empty: trg_fin_cn_no_assign fills an empty value before this check runs. Migration fin_store_credit_note_scn.';

-- 5. Assign trigger + guard (generic functions, low-volume table) ----------------------------------------------------
DROP TRIGGER IF EXISTS trg_fin_cn_no_assign ON public.org_credit_notes_mst;
CREATE TRIGGER trg_fin_cn_no_assign
  BEFORE INSERT ON public.org_credit_notes_mst
  FOR EACH ROW EXECUTE FUNCTION public.fn_doc_seq_assign_code('STORE_CREDIT_NOTE', 'credit_note_no');
COMMENT ON TRIGGER trg_fin_cn_no_assign ON public.org_credit_notes_mst IS
  'Fills an empty credit_note_no from the STORE_CREDIT_NOTE counter (SCN-YYYY-NNNNNN). A supplied value is kept. Migration fin_store_credit_note_scn.';

DROP TRIGGER IF EXISTS trg_fin_cn_no_guard ON public.org_credit_notes_mst;
CREATE TRIGGER trg_fin_cn_no_guard
  BEFORE UPDATE OF credit_note_no ON public.org_credit_notes_mst
  FOR EACH ROW WHEN (OLD.credit_note_no IS DISTINCT FROM NEW.credit_note_no)
  EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('credit_note_no');
COMMENT ON TRIGGER trg_fin_cn_no_guard ON public.org_credit_notes_mst IS
  'credit_note_no is immutable once set (fn_doc_seq_guard_immutable). The WHEN clause skips updates that do not change it. Migration fin_store_credit_note_scn.';

COMMENT ON COLUMN public.org_credit_notes_mst.credit_note_no IS
  'Store credit note number, unique per tenant. Since P5: SCN-<YYYY tenant time zone>-<seq pad 6, grows> from the STORE_CREDIT_NOTE counter (trg_fin_cn_no_assign; insert it empty). Before P5: CN-<tenant8>-<n> (kept). Immutable once set (trg_fin_cn_no_guard). Treat as an opaque string: do not parse fixed positions.';

COMMIT;
