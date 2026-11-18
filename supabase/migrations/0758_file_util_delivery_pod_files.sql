-- =============================================================================
-- 0758_file_util_delivery_pod_files.sql
-- Feature: File Util, task 6.4 (docs/features/File_Util/PLAN.md §6.4, approved 2026-11-17).
--
-- Delivery proof of delivery (photos, signature) moves onto File Util:
--   * the driver uploads through File Util (org_file_mst, category ORDER_FILE,
--     purposes DELIVERY_PROOF / SIGNATURE, ref DELIVERY_STOP = the stop);
--   * delivery completion LOCKS exactly the files it accepts, in its own
--     transaction. A locked file is proof: it cannot be edited or deleted, and a
--     locked file cannot be used for a second completion ("consumed").
--
-- This replaces the receipt table org_dlv_ev_uploads_tr (0451/0452), the
-- object-key / URL columns on org_dlv_pod_tr, and the private bucket
-- delivery-pod-evidence. Checked on remote 2026-11-17: all of them are empty
-- (0 rows, 0 objects); no cron or ops job uses them; HQ code does not use them.
--
-- The HQ tenant-order cleanup function deletes the receipt rows, so it is
-- patched here (same live-definition transform as 0551/0659, every edit
-- asserted). It now soft-deletes the File Util rows of the orders it removes,
-- so the HQ purge job (file-util-purge) removes their bytes; before this, those
-- files were left behind for deleted orders.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Lock marker on File Util rows
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_file_mst
  ADD COLUMN IF NOT EXISTS locked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS locked_by text NULL;

COMMENT ON COLUMN public.org_file_mst.locked_at IS
  'When the file became proof of a completed record (e.g. delivery completion); NULL = editable. A locked file cannot be edited, deleted or used as proof again.';
COMMENT ON COLUMN public.org_file_mst.locked_by IS
  'User who locked the file (the user completing the record). Set together with locked_at.';

-- A file can only be locked while READY, so proof can never be deleted or purged.
ALTER TABLE public.org_file_mst
  ADD CONSTRAINT ck_ofm_locked_ready CHECK (locked_at IS NULL OR status_code = 'READY');
COMMENT ON CONSTRAINT ck_ofm_locked_ready ON public.org_file_mst IS
  'Only READY files can be locked; a locked file cannot move to DELETED (unlock first, which only system maintenance does).';

-- locked_at and locked_by are set and cleared together.
ALTER TABLE public.org_file_mst
  ADD CONSTRAINT ck_ofm_locked_pair CHECK ((locked_at IS NULL) = (locked_by IS NULL));
COMMENT ON CONSTRAINT ck_ofm_locked_pair ON public.org_file_mst IS
  'locked_at and locked_by are both set or both NULL.';

-- -----------------------------------------------------------------------------
-- 2. HQ tenant-order cleanup: drop the receipt DELETE, soft-delete order files
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_oid oid;
  v_def text;
  v_pos int;
  -- Exact live text (remote, 2026-11-17) of the receipt block, with its trailing blank line.
  v_old CONSTANT text :=
    E'    -- org_dlv_ev_uploads_tr RESTRICTs org_dlv_stops_dtl; org_dlv_pod_tr\n' ||
    E'    -- cascades but is removed explicitly for the same reason.\n' ||
    E'    DELETE FROM public.org_dlv_ev_uploads_tr AS x\n' ||
    E'    WHERE x.tenant_org_id = p_tenant_org_id\n' ||
    E'      AND x.stop_id IN (\n' ||
    E'        SELECT sub.id FROM public.org_dlv_stops_dtl AS sub\n' ||
    E'        WHERE sub.tenant_org_id = p_tenant_org_id\n' ||
    E'          AND sub.order_id IN (SELECT order_id FROM tmp_cto_target_orders)\n' ||
    E'      );\n\n';
  -- Files have no FK to orders (entity_id is generic), so they are retired explicitly.
  -- Locks are cleared first: ck_ofm_locked_ready forbids DELETED while locked.
  v_new_text CONSTANT text :=
    E'    -- File Util files of the removed orders: soft-delete (locks cleared) so the HQ\n' ||
    E'    -- file-util-purge job removes their bytes; no FK ties them to the order.\n' ||
    E'    UPDATE public.org_file_mst AS x\n' ||
    E'    SET status_code = ''DELETED'', locked_at = NULL, locked_by = NULL,\n' ||
    E'        deleted_at = now(), deleted_by = ''hq-maintenance'', deleted_info = ''hq_mntnc_cleanup_tenant_orders'',\n' ||
    E'        rec_status = 0, is_active = false, updated_by = ''hq-maintenance''\n' ||
    E'    WHERE x.tenant_org_id = p_tenant_org_id\n' ||
    E'      AND x.category_code = ''ORDER_FILE''\n' ||
    E'      AND x.status_code <> ''DELETED''\n' ||
    E'      AND x.entity_id IN (SELECT order_id FROM tmp_cto_target_orders);\n\n';
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'hq_mntnc_cleanup_tenant_orders';
  IF v_oid IS NULL THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders not found - nothing to redefine';
    RETURN;
  END IF;

  v_def := pg_get_functiondef(v_oid);
  IF position('UPDATE public.org_file_mst AS x' IN v_def) > 0 THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders already patched by 0758';
    RETURN;
  END IF;

  v_pos := position(v_old IN v_def);
  IF v_pos = 0 OR position(v_old IN substring(v_def FROM v_pos + 1)) > 0 THEN
    RAISE EXCEPTION '0758: receipt DELETE block not found exactly once';
  END IF;
  EXECUTE left(v_def, v_pos - 1) || v_new_text || substring(v_def FROM v_pos + length(v_old));
END $$;

-- Verification: no reference to the receipt table remains; the file soft-delete is present.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'hq_mntnc_cleanup_tenant_orders';
  IF v_def IS NULL THEN
    RETURN;
  END IF;
  IF position('org_dlv_ev_uploads_tr' IN v_def) > 0 THEN
    RAISE EXCEPTION '0758 verification failed: cleanup still references org_dlv_ev_uploads_tr';
  END IF;
  IF position('UPDATE public.org_file_mst AS x' IN v_def) = 0 THEN
    RAISE EXCEPTION '0758 verification failed: order file soft-delete missing';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Retire the receipt table (empty; replaced by locked File Util rows)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.org_dlv_ev_uploads_tr RESTRICT;

-- -----------------------------------------------------------------------------
-- 4. Retire the evidence columns on the POD row (empty). The proof is now the
--    stop's locked files: org_file_mst WHERE ref_type_code = 'DELIVERY_STOP'
--    AND ref_id = stop_id AND locked_at IS NOT NULL.
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_dlv_pod_tr DROP CONSTRAINT IF EXISTS ck_dlv_pod_photo_keys;
ALTER TABLE public.org_dlv_pod_tr DROP COLUMN IF EXISTS photo_object_keys RESTRICT;
ALTER TABLE public.org_dlv_pod_tr DROP COLUMN IF EXISTS signature_object_key RESTRICT;
ALTER TABLE public.org_dlv_pod_tr DROP COLUMN IF EXISTS photo_urls RESTRICT;
ALTER TABLE public.org_dlv_pod_tr DROP COLUMN IF EXISTS signature_url RESTRICT;

COMMENT ON TABLE public.org_dlv_pod_tr IS
  'Proof of delivery per stop: method, notes, who verified it and when. Photos and signature are File Util files of the order (ORDER_FILE, ref DELIVERY_STOP = stop_id) locked by the completion (org_file_mst.locked_at).';

-- -----------------------------------------------------------------------------
-- 5. Lock the old private bucket (empty). Its 4 storage.objects policies cannot
--    be dropped here (storage.objects is owned by supabase_storage_admin), so
--    every upload is refused instead; the owner deletes the bucket and its
--    policies in the Supabase dashboard. Same approach as 0750.
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false,
    file_size_limit = 1,
    allowed_mime_types = ARRAY['application/x-cmx-retired-bucket']::text[],
    updated_at = now()
WHERE id = 'delivery-pod-evidence';

COMMIT;

-- =============================================================================
-- After apply (owner): regenerate types + Prisma (org_dlv_ev_uploads_tr and four
-- org_dlv_pod_tr columns are gone; org_file_mst gains locked_at/locked_by), then
-- delete bucket delivery-pod-evidence and its policies dlv_pod_evidence_* in the
-- dashboard.
-- =============================================================================
