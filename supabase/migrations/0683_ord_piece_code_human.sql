--
-- Migration 0683_ord_piece_code_human.sql
-- Human-Friendly Codes, P3 (order item and piece codes), migration 2 of 2.
--
-- Purpose: org_order_item_pieces_dtl.piece_code becomes a human-readable code <order_item_srno>-<piece_seq>
--   (e.g. ORD-20261101-0007-2-3) instead of the 0073 GENERATED column built from three UUIDs; the external
--   heat-seal / clip tag stays in barcode, is normalised (trim + upper-case) and becomes unique per tenant among
--   live pieces whose order is still open. Tag decisions A-35..A-38 (plan section 20).
--   1. LOCK the pieces table (ACCESS EXCLUSIVE: DROP EXPRESSION needs it; a few ms on a normal table).
--   2. Pre-checks (fail with a clear message, nothing changed): 0682 applied, piece_code still generated, every piece
--      has its line in the same tenant/order with a serial, piece_seq set, the new codes are unique; tags of live
--      pieces after trim + upper-case are well formed (A-Z 0-9 - _ . /, 1..64), not shaped like one of our codes, and
--      unique per tenant among live pieces of open orders. Report counts and dependent views (NOTICE).
--      Helpers created first (same transaction): fn_ord_tag_releasing_status, fn_ord_piece_tag_code_re.
--   3. ALTER COLUMN piece_code DROP EXPRESSION (values stay; dependent views keep working: same name and type).
--   4. Backfill with every user trigger on the table switched off for the backfill only (decision A-34): piece_code
--      = line serial || '-' || piece_seq; tags of live pieces trimmed + upper-cased, blank -> NULL (old value in
--      metadata.hfc_p3_old_barcode); removed (history) pieces are not touched (0548: immutable facts). New column
--      tag_released_at set for tagged live pieces of delivered / closed / cancelled orders (A-35).
--      The old UUID code is not kept: it is order_id-order_item_id-piece_seq and can be rebuilt any time.
--   5. piece_code NOT NULL DEFAULT '' + ck_ord_piece_code_set (not blank). The default only exists so inserts may
--      omit the column (Prisma String @default("")); trg_ord_piece_code_set always overwrites it.
--   6. fn_ord_piece_code_set() BEFORE INSERT: piece_code := line serial || '-' || piece_seq (a supplied value is
--      ignored). Raises ORD_PIECE_ITEM_NOT_FOUND / ORD_PIECE_SEQ_MISSING (P0002 / 23502).
--   7. uq_ord_piece_code UNIQUE (tenant_org_id, piece_code); trg_ord_piece_code_guard (immutable).
--   8. Tag (A-35..A-37):
--      - idx_order_pieces_barcode (barcode) -> idx_ord_piece_tenant_barcode (tenant_org_id, barcode) for lookups and
--        tracing old scans (all pieces).
--      - uq_ord_piece_barcode UNIQUE (tenant_org_id, barcode) WHERE barcode IS NOT NULL AND deleted_order_change_id
--        IS NULL AND tag_released_at IS NULL: a tag is freed when its piece is removed or its order is delivered,
--        closed or cancelled; the piece keeps the tag as history.
--      - ck_ord_piece_barcode_fmt: live tag matches ^[A-Z0-9._/-]{1,64}$ (web-admin externalTagSchema).
--      - ck_ord_piece_barcode_not_code: static backstop, a live tag never starts ORD / ITM / PEC + digit.
--      - trg_ord_piece_tag_rules (BEFORE INSERT OR UPDATE OF barcode): trims + upper-cases, refuses a tag shaped like
--        any code of sys_doc_seq_type_cd (prefix or type_prefix, optional - _ . /, then a digit:
--        PIECE_TAG_LOOKS_LIKE_CODE, 23514) and sets tag_released_at from the order status.
--      - trg_ord_piece_tag_release on org_orders_mst (AFTER UPDATE OF status, current_status): when the order becomes
--        delivered / closed / cancelled, its live tagged pieces get tag_released_at = now(). Reopening an order does
--        not take a tag back (saving the tag again re-checks it).
--   9. sys_doc_seq_type_cd ORDER_PIECE: managed_by_object = public.fn_ord_piece_code_set(), description refreshed.
--
-- Affected: org_order_item_pieces_dtl (piece_code no longer generated, NOT NULL DEFAULT ''; new column
--           tag_released_at; data in piece_code, barcode, metadata, tag_released_at; 2 unique indexes, 1 index
--           replaced, 3 checks, 3 triggers), org_orders_mst (1 trigger), 5 new functions, sys_doc_seq_type_cd (1 row).
--           Regenerate Supabase types (piece_code insertable, tag_released_at) and Prisma (piece_code String
--           @default("") instead of dbgenerated; tag_released_at DateTime? @db.Timestamptz(6)).
-- Related:  0073 (pieces table), 0548 (oc_piece_removed_guard), 0667 (ORDER_PIECE row), 0670, 0682 ord_item_srno_barcode.
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.10; decisions A-34..A-38.
-- APPLY ORDER: 2 of 2 in P3. Requires 0682. Web-admin P3 code deployed first (it reads the tag from barcode and
--              never writes piece_code). Pre-checks: DEV_GUIDE_DOC_SEQ_ENGINE.md section 17 (queries Q-P5..Q-P7,
--              repairs R3 duplicate tags, R4 malformed or code-shaped tags).
-- ROLLBACK PLAN (forward-only repo; write a new migration). piece_code cannot become GENERATED again without
--   rewriting the column; roll forward instead. To relax only the tag rules:
--   DROP INDEX public.uq_ord_piece_barcode; ALTER TABLE public.org_order_item_pieces_dtl DROP CONSTRAINT ck_ord_piece_barcode_fmt;
--   ALTER TABLE public.org_order_item_pieces_dtl DROP CONSTRAINT ck_ord_piece_barcode_not_code;
--   DROP TRIGGER trg_ord_piece_tag_rules ON public.org_order_item_pieces_dtl;
--   DROP TRIGGER trg_ord_piece_tag_release ON public.org_orders_mst;
--   (keep tag_released_at and the helper functions; dropping the column needs the index dropped first).
--   To stop the code trigger/guard: DROP TRIGGER trg_ord_piece_code_set / trg_ord_piece_code_guard ON public.org_order_item_pieces_dtl
--   (then inserts must supply piece_code because of ck_ord_piece_code_set).
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- 1. Lock ---------------------------------------------------------------------------------------------------------
LOCK TABLE public.org_order_item_pieces_dtl IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.org_order_items_dtl IN SHARE MODE;

-- 2a. Tag helpers (used by the pre-checks, backfill and triggers) ------------------------------------------------
CREATE FUNCTION public.fn_ord_tag_releasing_status(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT COALESCE(lower(btrim(p_status)) IN ('delivered', 'closed', 'cancelled'), false) $$;
COMMENT ON FUNCTION public.fn_ord_tag_releasing_status(TEXT) IS
  'True for order statuses that free the external tags of the order''s pieces: delivered, closed, cancelled (any case). Decision A-35; web-admin TAG_RELEASING_ORDER_STATUSES. Migration ord_piece_code_human (P3).';

CREATE FUNCTION public.fn_ord_piece_tag_code_re()
RETURNS TEXT
LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT '^(' || string_agg(p, '|' ORDER BY length(p) DESC, p) || ')[-_./]?[0-9]'
    FROM (SELECT DISTINCT upper(btrim(v)) AS p
            FROM (SELECT unnest(ARRAY[t.prefix, t.type_prefix]) AS v FROM public.sys_doc_seq_type_cd t
                  UNION ALL SELECT unnest(ARRAY['ORD', 'ITM', 'PEC'])) a
           WHERE v IS NOT NULL AND upper(btrim(v)) ~ '^[A-Z0-9]+$') x
$$;
COMMENT ON FUNCTION public.fn_ord_piece_tag_code_re() IS
  'Regex of values shaped like one of our codes: any sys_doc_seq_type_cd prefix or type_prefix (plus ORD, ITM, PEC), an optional - _ . /, then a digit. An external tag must not match (decision A-37; web-admin codeLookalikePattern). Migration ord_piece_code_human (P3).';
REVOKE ALL ON FUNCTION public.fn_ord_piece_tag_code_re() FROM PUBLIC, anon;

-- 2. Pre-checks + report ----------------------------------------------------------------------------------------------
DO $pre$
DECLARE
  v_total BIGINT; v_removed BIGINT; v_tags BIGINT; v_blank BIGINT; v_trim BIGINT; v_views TEXT;
  v_noitem BIGINT; v_dupcode BIGINT; v_duptag BIGINT; v_badtag BIGINT; v_codetag BIGINT;
BEGIN
  IF to_regclass('public.uq_ord_item_srno') IS NULL THEN
    RAISE EXCEPTION 'ORD_PIECE_PRECHECK: apply 0682_ord_item_srno_barcode first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.org_order_item_pieces_dtl'::regclass
                    AND attname = 'piece_code' AND attgenerated = 's') THEN
    RAISE EXCEPTION 'ORD_PIECE_PRECHECK: piece_code is not a generated column any more (already applied?)';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE deleted_order_change_id IS NOT NULL),
         count(*) FILTER (WHERE barcode IS NOT NULL),
         count(*) FILTER (WHERE barcode IS NOT NULL AND btrim(barcode) = ''),
         count(*) FILTER (WHERE barcode IS NOT NULL AND btrim(barcode) <> '' AND deleted_order_change_id IS NULL
                            AND barcode <> upper(btrim(barcode)))
    INTO v_total, v_removed, v_tags, v_blank, v_trim
    FROM public.org_order_item_pieces_dtl;
  SELECT string_agg(DISTINCT v.oid::regclass::text, ', ') INTO v_views
    FROM pg_depend d JOIN pg_rewrite rw ON rw.oid = d.objid JOIN pg_class v ON v.oid = rw.ev_class
   WHERE d.refobjid = 'public.org_order_item_pieces_dtl'::regclass AND d.classid = 'pg_rewrite'::regclass
     AND v.oid <> 'public.org_order_item_pieces_dtl'::regclass;
  RAISE NOTICE 'ord_piece_code_human: pieces %, removed (history) %, with tag %, blank tags -> NULL %, live tags to trim / upper-case %, dependent views: %',
    v_total, v_removed, v_tags, v_blank, v_trim, COALESCE(v_views, 'none');

  SELECT count(*) INTO v_noitem
    FROM public.org_order_item_pieces_dtl p
    LEFT JOIN public.org_order_items_dtl i
      ON i.id = p.order_item_id AND i.tenant_org_id = p.tenant_org_id AND i.order_id = p.order_id
   WHERE i.id IS NULL OR i.order_item_srno IS NULL OR btrim(i.order_item_srno) = '' OR p.piece_seq IS NULL;
  IF v_noitem > 0 THEN
    RAISE EXCEPTION 'ORD_PIECE_PRECHECK: % piece(s) without a line in the same tenant and order (or without piece_seq); see DEV_GUIDE section 17 query Q-P3', v_noitem;
  END IF;

  SELECT COALESCE(sum(c - 1), 0) INTO v_dupcode
    FROM (SELECT count(*) AS c FROM public.org_order_item_pieces_dtl p
            JOIN public.org_order_items_dtl i ON i.id = p.order_item_id AND i.tenant_org_id = p.tenant_org_id
           GROUP BY p.tenant_org_id, i.order_item_srno || '-' || p.piece_seq::text HAVING count(*) > 1) d;
  IF v_dupcode > 0 THEN
    RAISE EXCEPTION 'ORD_PIECE_PRECHECK: % new piece code(s) would collide; see DEV_GUIDE section 17 query Q-P4', v_dupcode;
  END IF;

  -- Tags as they will be stored: N = upper(btrim(barcode)). Removed (history) pieces are not checked or changed.
  SELECT COALESCE(sum(c - 1), 0) INTO v_duptag
    FROM (SELECT count(*) AS c
            FROM public.org_order_item_pieces_dtl p
            JOIN public.org_orders_mst o ON o.id = p.order_id AND o.tenant_org_id = p.tenant_org_id
           WHERE p.barcode IS NOT NULL AND btrim(p.barcode) <> '' AND p.deleted_order_change_id IS NULL
             AND NOT (public.fn_ord_tag_releasing_status(o.status) OR public.fn_ord_tag_releasing_status(o.current_status))
           GROUP BY p.tenant_org_id, upper(btrim(p.barcode)) HAVING count(*) > 1) d;
  SELECT count(*) FILTER (WHERE upper(btrim(barcode)) !~ '^[A-Z0-9._/-]{1,64}$'),
         count(*) FILTER (WHERE upper(btrim(barcode)) ~ public.fn_ord_piece_tag_code_re())
    INTO v_badtag, v_codetag
    FROM public.org_order_item_pieces_dtl
   WHERE barcode IS NOT NULL AND btrim(barcode) <> '' AND deleted_order_change_id IS NULL;
  IF v_duptag > 0 OR v_badtag > 0 OR v_codetag > 0 THEN
    RAISE EXCEPTION 'ORD_PIECE_PRECHECK: tags need repair, nothing was changed: % duplicate live tag(s) per tenant after trim + upper-case (query Q-P7, repair R3); % tag(s) with characters outside A-Z 0-9 - _ . / or over 64 characters (query Q-P5, repair R4); % tag(s) shaped like one of our codes (query Q-P6, repair R4). See DEV_GUIDE_DOC_SEQ_ENGINE.md section 17, then apply again',
      v_duptag, v_badtag, v_codetag;
  END IF;
END $pre$;

-- 3. Stop generating ----------------------------------------------------------------------------------------------
ALTER TABLE public.org_order_item_pieces_dtl ALTER COLUMN piece_code DROP EXPRESSION;
ALTER TABLE public.org_order_item_pieces_dtl ADD COLUMN tag_released_at TIMESTAMPTZ;
COMMENT ON COLUMN public.org_order_item_pieces_dtl.tag_released_at IS
  'When the external tag (barcode) stopped counting as in use because the order was delivered, closed or cancelled (decision A-35). NULL = the tag is live (if the piece is not removed). The tag value itself stays on the piece for tracing old scans. Set by trg_ord_piece_tag_release (order status) and trg_ord_piece_tag_rules (tag written). Migration ord_piece_code_human (P3).';

-- 4. Backfill (A-34) -----------------------------------------------------------------------------------------------
DO $bf$
DECLARE r RECORD; v_name TEXT; v_trg TEXT[] := '{}'; v_code BIGINT; v_tag BIGINT; v_rel BIGINT;
BEGIN
  FOR r IN SELECT t.tgname FROM pg_trigger t
            WHERE t.tgrelid = 'public.org_order_item_pieces_dtl'::regclass AND NOT t.tgisinternal AND t.tgenabled <> 'D'
            ORDER BY t.tgname LOOP
    EXECUTE format('ALTER TABLE public.org_order_item_pieces_dtl DISABLE TRIGGER %I', r.tgname);
    v_trg := v_trg || r.tgname::text;
  END LOOP;
  RAISE NOTICE 'ord_piece_code_human: triggers switched off for the backfill: %', v_trg;

  UPDATE public.org_order_item_pieces_dtl p
     SET piece_code = i.order_item_srno || '-' || p.piece_seq::text
    FROM public.org_order_items_dtl i
   WHERE i.id = p.order_item_id AND i.tenant_org_id = p.tenant_org_id;
  GET DIAGNOSTICS v_code = ROW_COUNT;

  UPDATE public.org_order_item_pieces_dtl
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('hfc_p3_old_barcode', barcode),
         barcode = NULLIF(upper(btrim(barcode)), '')
   WHERE barcode IS NOT NULL AND deleted_order_change_id IS NULL
     AND barcode IS DISTINCT FROM NULLIF(upper(btrim(barcode)), '');
  GET DIAGNOSTICS v_tag = ROW_COUNT;

  UPDATE public.org_order_item_pieces_dtl p
     SET tag_released_at = now()
    FROM public.org_orders_mst o
   WHERE o.id = p.order_id AND o.tenant_org_id = p.tenant_org_id
     AND p.barcode IS NOT NULL AND p.deleted_order_change_id IS NULL
     AND (public.fn_ord_tag_releasing_status(o.status) OR public.fn_ord_tag_releasing_status(o.current_status));
  GET DIAGNOSTICS v_rel = ROW_COUNT;

  FOREACH v_name IN ARRAY v_trg LOOP
    EXECUTE format('ALTER TABLE public.org_order_item_pieces_dtl ENABLE TRIGGER %I', v_name);
  END LOOP;
  RAISE NOTICE 'ord_piece_code_human: piece codes set %, tags normalised or cleared %, tags released (order delivered/closed/cancelled) %; triggers switched back on', v_code, v_tag, v_rel;
END $bf$;

-- 5. Column rules ---------------------------------------------------------------------------------------------------
ALTER TABLE public.org_order_item_pieces_dtl ALTER COLUMN piece_code SET DEFAULT '';
ALTER TABLE public.org_order_item_pieces_dtl ALTER COLUMN piece_code SET NOT NULL;
ALTER TABLE public.org_order_item_pieces_dtl
  ADD CONSTRAINT ck_ord_piece_code_set CHECK (btrim(piece_code) <> ''),
  ADD CONSTRAINT ck_ord_piece_barcode_fmt CHECK (barcode IS NULL OR deleted_order_change_id IS NOT NULL
                                                 OR barcode ~ '^[A-Z0-9._/-]{1,64}$'),
  ADD CONSTRAINT ck_ord_piece_barcode_not_code CHECK (barcode IS NULL OR deleted_order_change_id IS NOT NULL
                                                      OR barcode !~ '^(ORD|ITM|PEC)[-_./]?[0-9]');
COMMENT ON CONSTRAINT ck_ord_piece_code_set ON public.org_order_item_pieces_dtl IS
  'piece_code is never blank (trg_ord_piece_code_set fills it at insert). Migration ord_piece_code_human (P3).';
COMMENT ON CONSTRAINT ck_ord_piece_barcode_fmt ON public.org_order_item_pieces_dtl IS
  'External tag rule (decision A-36): a live piece''s tag is 1..64 characters of A-Z 0-9 - _ . / (trg_ord_piece_tag_rules trims and upper-cases first; web-admin externalTagSchema, error PIECE_TAG_INVALID). Removed (history) pieces are exempt. Migration ord_piece_code_human (P3).';
COMMENT ON CONSTRAINT ck_ord_piece_barcode_not_code ON public.org_order_item_pieces_dtl IS
  'Static backstop of decision A-37: a live piece''s tag never starts with ORD, ITM or PEC (optional - _ . /) then a digit, so it can never be read as an order, line or piece code. The full rule (every doc type prefix) is in trg_ord_piece_tag_rules; web-admin error PIECE_TAG_LOOKS_LIKE_CODE. Migration ord_piece_code_human (P3).';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.piece_code IS
  'Human-readable piece code <order_item_srno>-<piece_seq> (e.g. ORD-20261101-0007-2-3). Set by trg_ord_piece_code_set at insert (a supplied value is ignored), immutable afterwards (trg_ord_piece_code_guard), unique per tenant (uq_ord_piece_code). Doc type ORDER_PIECE. Was a GENERATED UUID code until P3.';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.barcode IS
  'External tag attached to the piece (heat-seal, clip or RFID label), entered or scanned by staff. Optional. Stored trimmed and upper-case, A-Z 0-9 - _ . /, 1..64 (ck_ord_piece_barcode_fmt); never shaped like one of our codes (trg_ord_piece_tag_rules, ck_ord_piece_barcode_not_code); unique per tenant among live pieces of open orders (uq_ord_piece_barcode, see tag_released_at). Kept after release for tracing. Not the piece code.';

-- 6. Code trigger -------------------------------------------------------------------------------------------------
CREATE FUNCTION public.fn_ord_piece_code_set()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_srno TEXT;
BEGIN
  IF NEW.piece_seq IS NULL THEN
    RAISE EXCEPTION 'ORD_PIECE_SEQ_MISSING: piece_seq is required to build piece_code' USING ERRCODE = '23502';
  END IF;
  SELECT i.order_item_srno INTO v_srno
    FROM public.org_order_items_dtl i
   WHERE i.id = NEW.order_item_id AND i.tenant_org_id = NEW.tenant_org_id;
  IF v_srno IS NULL OR btrim(v_srno) = '' THEN
    RAISE EXCEPTION 'ORD_PIECE_ITEM_NOT_FOUND: line % not found for tenant % (or it has no serial)', NEW.order_item_id, NEW.tenant_org_id
      USING ERRCODE = 'P0002';
  END IF;
  NEW.piece_code := v_srno || '-' || NEW.piece_seq::text;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_ord_piece_code_set() IS
  'BEFORE INSERT on org_order_item_pieces_dtl (trg_ord_piece_code_set): piece_code := line order_item_srno || ''-'' || piece_seq, ignoring any supplied value. Raises ORD_PIECE_SEQ_MISSING (23502) or ORD_PIECE_ITEM_NOT_FOUND (P0002). SECURITY INVOKER. Migration ord_piece_code_human (P3).';
REVOKE ALL ON FUNCTION public.fn_ord_piece_code_set() FROM PUBLIC, anon;

CREATE TRIGGER trg_ord_piece_code_set
  BEFORE INSERT ON public.org_order_item_pieces_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_ord_piece_code_set();
COMMENT ON TRIGGER trg_ord_piece_code_set ON public.org_order_item_pieces_dtl IS
  'Builds piece_code at insert. See fn_ord_piece_code_set.';

-- 7. Unique code + guard --------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_ord_piece_code ON public.org_order_item_pieces_dtl (tenant_org_id, piece_code);
COMMENT ON INDEX public.uq_ord_piece_code IS 'One piece per code per tenant. Migration ord_piece_code_human (P3).';

CREATE TRIGGER trg_ord_piece_code_guard
  BEFORE UPDATE OF piece_code ON public.org_order_item_pieces_dtl
  FOR EACH ROW
  WHEN (OLD.piece_code IS DISTINCT FROM NEW.piece_code)
  EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('piece_code');
COMMENT ON TRIGGER trg_ord_piece_code_guard ON public.org_order_item_pieces_dtl IS
  'A set piece_code never changes (DOC_SEQ_CODE_IMMUTABLE). See fn_doc_seq_guard_immutable. Migration ord_piece_code_human (P3).';

-- 8. Tag indexes ----------------------------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_order_pieces_barcode RESTRICT;
CREATE INDEX idx_ord_piece_tenant_barcode ON public.org_order_item_pieces_dtl (tenant_org_id, barcode) WHERE barcode IS NOT NULL;
COMMENT ON INDEX public.idx_ord_piece_tenant_barcode IS
  'Tag lookup (scan) per tenant, removed pieces included. Replaces idx_order_pieces_barcode (0073). Migration ord_piece_code_human (P3).';
CREATE UNIQUE INDEX uq_ord_piece_barcode ON public.org_order_item_pieces_dtl (tenant_org_id, barcode)
  WHERE barcode IS NOT NULL AND deleted_order_change_id IS NULL AND tag_released_at IS NULL;
COMMENT ON INDEX public.uq_ord_piece_barcode IS
  'A tag is on at most one live piece per tenant (decision A-35): removed pieces and pieces whose order was delivered, closed or cancelled (tag_released_at set) keep their tag as history and do not block reuse. web-admin returns 409 PIECE_TAG_IN_USE. Migration ord_piece_code_human (P3).';

-- 8b. Tag rules trigger (A-35..A-37) ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_ord_piece_tag_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_released BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.deleted_order_change_id IS NOT NULL THEN
    RETURN NEW;  -- removed (history) piece: oc_piece_removed_guard decides; never normalise history
  END IF;
  NEW.barcode := NULLIF(upper(btrim(NEW.barcode)), '');
  IF NEW.barcode IS NULL THEN
    NEW.tag_released_at := NULL;
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.barcode IS DISTINCT FROM OLD.barcode)
     AND NEW.barcode ~ public.fn_ord_piece_tag_code_re() THEN
    RAISE EXCEPTION 'PIECE_TAG_LOOKS_LIKE_CODE: tag % is shaped like one of our codes (order, line, piece or a sys_doc_seq_type_cd prefix)', NEW.barcode
      USING ERRCODE = '23514', CONSTRAINT = 'ck_ord_piece_barcode_not_code';
  END IF;
  SELECT public.fn_ord_tag_releasing_status(o.status) OR public.fn_ord_tag_releasing_status(o.current_status)
    INTO v_released
    FROM public.org_orders_mst o
   WHERE o.id = NEW.order_id AND o.tenant_org_id = NEW.tenant_org_id;
  NEW.tag_released_at := CASE WHEN COALESCE(v_released, false) THEN COALESCE(NEW.tag_released_at, now()) ELSE NULL END;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_ord_piece_tag_rules() IS
  'BEFORE INSERT OR UPDATE OF barcode on org_order_item_pieces_dtl (trg_ord_piece_tag_rules): trims and upper-cases the tag (blank -> NULL), refuses a new tag shaped like one of our codes (PIECE_TAG_LOOKS_LIKE_CODE, 23514, fn_ord_piece_tag_code_re), and sets tag_released_at from the order status (open order -> NULL, so saving a tag again on a reopened order re-checks uniqueness). Removed pieces are skipped. SECURITY INVOKER. Decisions A-35..A-37. Migration ord_piece_code_human (P3).';
REVOKE ALL ON FUNCTION public.fn_ord_piece_tag_rules() FROM PUBLIC, anon;

CREATE TRIGGER trg_ord_piece_tag_rules
  BEFORE INSERT OR UPDATE OF barcode ON public.org_order_item_pieces_dtl
  FOR EACH ROW EXECUTE FUNCTION public.fn_ord_piece_tag_rules();
COMMENT ON TRIGGER trg_ord_piece_tag_rules ON public.org_order_item_pieces_dtl IS
  'Normalises and checks the external tag. See fn_ord_piece_tag_rules. Migration ord_piece_code_human (P3).';

-- 8c. Release tags when the order is delivered, closed or cancelled (A-35) --------------------------------------
CREATE FUNCTION public.fn_ord_piece_tag_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  UPDATE public.org_order_item_pieces_dtl p
     SET tag_released_at = now()
   WHERE p.tenant_org_id = NEW.tenant_org_id
     AND p.order_id = NEW.id
     AND p.barcode IS NOT NULL
     AND p.tag_released_at IS NULL
     AND p.deleted_order_change_id IS NULL;
  RETURN NULL;
END $$;
COMMENT ON FUNCTION public.fn_ord_piece_tag_release() IS
  'AFTER UPDATE OF status, current_status on org_orders_mst (trg_ord_piece_tag_release): when the order becomes delivered, closed or cancelled, its live tagged pieces get tag_released_at = now(), so the tags can be reused (decision A-35). Touches only pieces of the same tenant and order as the updated row. SECURITY DEFINER so the release does not depend on the caller''s piece privileges; fixed search_path; not callable directly. Migration ord_piece_code_human (P3).';
REVOKE ALL ON FUNCTION public.fn_ord_piece_tag_release() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ord_piece_tag_release
  AFTER UPDATE OF status, current_status ON public.org_orders_mst
  FOR EACH ROW
  WHEN ((public.fn_ord_tag_releasing_status(NEW.status) OR public.fn_ord_tag_releasing_status(NEW.current_status))
        AND NOT (public.fn_ord_tag_releasing_status(OLD.status) OR public.fn_ord_tag_releasing_status(OLD.current_status)))
  EXECUTE FUNCTION public.fn_ord_piece_tag_release();
COMMENT ON TRIGGER trg_ord_piece_tag_release ON public.org_orders_mst IS
  'Frees the external tags of an order''s pieces when it becomes delivered, closed or cancelled. See fn_ord_piece_tag_release. Migration ord_piece_code_human (P3).';

-- 9. Registry --------------------------------------------------------------------------------------------------------
DO $reg$
DECLARE v_rows INT;
BEGIN
  UPDATE public.sys_doc_seq_type_cd
     SET managed_by_object = 'public.fn_ord_piece_code_set()',
         implement_description =
           'Child code since P3 (migration ord_piece_code_human): <order_item_srno>-<piece_seq>, no printed prefix (PEC '
           || 'reserved for scan payloads). Set only by trigger trg_ord_piece_code_set -> fn_ord_piece_code_set() at '
           || 'insert (web-admin never writes it); uq_ord_piece_code; trg_ord_piece_code_guard (immutable). The external '
           || 'tag lives in barcode: trimmed + upper-case A-Z 0-9 - _ . / 1..64 (ck_ord_piece_barcode_fmt), never shaped '
           || 'like one of our codes (trg_ord_piece_tag_rules, ck_ord_piece_barcode_not_code), unique per tenant among '
           || 'live pieces of open orders (uq_ord_piece_barcode; tag_released_at set by trg_ord_piece_tag_release). '
           || 'Check: SELECT piece_code, barcode FROM org_order_item_pieces_dtl WHERE tenant_org_id = $1 AND order_id = $2 '
           || 'ORDER BY piece_code;',
         updated_by = 'migration', updated_info = 'ord_piece_code_human'
   WHERE doc_type_code = 'ORDER_PIECE';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ord_piece_code_human: sys_doc_seq_type_cd row ORDER_PIECE not found (apply 0667 first)';
  END IF;
END $reg$;

COMMIT;
