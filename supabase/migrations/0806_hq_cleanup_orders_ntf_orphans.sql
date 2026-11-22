-- =============================================================================
-- 0806_hq_cleanup_orders_ntf_orphans.sql
-- HQ tenant maintenance "Remove orders" (hq_mntnc_cleanup_tenant_orders) left
-- notification rows behind: org_ntf_inbox_mst / org_ntf_outbox_dtl point at the
-- order through a generic (source_entity_type, source_entity_id) pair with no
-- FK, and org_ntf_delivery_log_dtl / org_ntf_receipts_tr hang off the outbox.
-- This migration (1) teaches the function to remove them with the orders and
-- (2) sweeps the order/credit-note notification rows already orphaned.
-- Patches the live function text in place (same technique as 0758).
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Patch the cleanup function: delete the order's notification rows just
--    before org_orders_mst itself is deleted (execute branch only).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_oid oid;
  v_def text;
  v_pos int;
  -- Anchor: the single DELETE of the order headers in the live function text.
  v_old CONSTANT text := E'    DELETE FROM public.org_orders_mst AS x\n';
  -- Notification rows have no FK to orders, so they are removed explicitly,
  -- children first (receipts -> delivery log -> outbox -> inbox).
  v_new_text CONSTANT text := $blk$
    -- Notification rows of the removed orders (and of their credit notes). They
    -- reference the source record by (source_entity_type, source_entity_id) with
    -- no FK, so they would otherwise stay behind pointing at deleted records.
    DROP TABLE IF EXISTS tmp_cto_target_ntf_inbox;
    DROP TABLE IF EXISTS tmp_cto_target_ntf_outbox;

    CREATE TEMP TABLE tmp_cto_target_ntf_inbox ON COMMIT DROP AS
    SELECT i.id AS inbox_id
    FROM public.org_ntf_inbox_mst AS i
    WHERE i.tenant_org_id = p_tenant_org_id
      AND (
        (i.source_entity_type = 'order'
          AND i.source_entity_id IN (SELECT order_id::text FROM tmp_cto_target_orders))
        OR (i.source_entity_type = 'credit_note'
          AND i.source_entity_id IN (SELECT credit_note_id::text FROM tmp_cto_target_credit_notes))
      );

    CREATE TEMP TABLE tmp_cto_target_ntf_outbox ON COMMIT DROP AS
    SELECT ob.id AS outbox_id
    FROM public.org_ntf_outbox_dtl AS ob
    WHERE ob.tenant_org_id = p_tenant_org_id
      AND (
        (ob.source_entity_type = 'order'
          AND ob.source_entity_id IN (SELECT order_id::text FROM tmp_cto_target_orders))
        OR (ob.source_entity_type = 'credit_note'
          AND ob.source_entity_id IN (SELECT credit_note_id::text FROM tmp_cto_target_credit_notes))
        -- outbox rows fan out from a targeted inbox row (FK inbox_id, NO ACTION)
        OR ob.inbox_id IN (SELECT inbox_id FROM tmp_cto_target_ntf_inbox)
      );

    DELETE FROM public.org_ntf_receipts_tr AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.delivery_id IN (SELECT outbox_id FROM tmp_cto_target_ntf_outbox);

    DELETE FROM public.org_ntf_delivery_log_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.outbox_id IN (SELECT outbox_id FROM tmp_cto_target_ntf_outbox);

    DELETE FROM public.org_ntf_outbox_dtl AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT outbox_id FROM tmp_cto_target_ntf_outbox);

    DELETE FROM public.org_ntf_inbox_mst AS x
    WHERE x.tenant_org_id = p_tenant_org_id
      AND x.id IN (SELECT inbox_id FROM tmp_cto_target_ntf_inbox);

$blk$;
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
  IF position('tmp_cto_target_ntf_inbox' IN v_def) > 0 THEN
    RAISE NOTICE 'hq_mntnc_cleanup_tenant_orders already patched by 0806';
    RETURN;
  END IF;

  v_pos := position(v_old IN v_def);
  IF v_pos = 0 OR position(v_old IN substring(v_def FROM v_pos + 1)) > 0 THEN
    RAISE EXCEPTION '0806: org_orders_mst DELETE not found exactly once';
  END IF;
  EXECUTE left(v_def, v_pos - 1) || v_new_text || substring(v_def FROM v_pos);
END $$;

-- Verification: the patched function now deletes the notification rows.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'hq_mntnc_cleanup_tenant_orders';
  IF v_def IS NOT NULL AND position('DELETE FROM public.org_ntf_inbox_mst AS x' IN v_def) = 0 THEN
    RAISE EXCEPTION '0806 verification failed: notification cleanup missing';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. One-time sweep of notification rows already orphaned by earlier cleanups:
--    source order / credit note no longer exists in the same tenant.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_0806_orphan_inbox ON COMMIT DROP AS
SELECT i.tenant_org_id, i.id AS inbox_id
FROM public.org_ntf_inbox_mst AS i
WHERE (i.source_entity_type = 'order'
        AND NOT EXISTS (SELECT 1 FROM public.org_orders_mst o
                         WHERE o.tenant_org_id = i.tenant_org_id AND o.id::text = i.source_entity_id))
   OR (i.source_entity_type = 'credit_note'
        AND NOT EXISTS (SELECT 1 FROM public.org_credit_notes_mst n
                         WHERE n.tenant_org_id = i.tenant_org_id AND n.id::text = i.source_entity_id));

CREATE TEMP TABLE tmp_0806_orphan_outbox ON COMMIT DROP AS
SELECT ob.tenant_org_id, ob.id AS outbox_id
FROM public.org_ntf_outbox_dtl AS ob
WHERE (ob.source_entity_type = 'order'
        AND NOT EXISTS (SELECT 1 FROM public.org_orders_mst o
                         WHERE o.tenant_org_id = ob.tenant_org_id AND o.id::text = ob.source_entity_id))
   OR (ob.source_entity_type = 'credit_note'
        AND NOT EXISTS (SELECT 1 FROM public.org_credit_notes_mst n
                         WHERE n.tenant_org_id = ob.tenant_org_id AND n.id::text = ob.source_entity_id))
   OR EXISTS (SELECT 1 FROM tmp_0806_orphan_inbox oi
               WHERE oi.tenant_org_id = ob.tenant_org_id AND oi.inbox_id = ob.inbox_id);

DELETE FROM public.org_ntf_receipts_tr AS x
USING tmp_0806_orphan_outbox AS t
WHERE x.tenant_org_id = t.tenant_org_id AND x.delivery_id = t.outbox_id;

DELETE FROM public.org_ntf_delivery_log_dtl AS x
USING tmp_0806_orphan_outbox AS t
WHERE x.tenant_org_id = t.tenant_org_id AND x.outbox_id = t.outbox_id;

DELETE FROM public.org_ntf_outbox_dtl AS x
USING tmp_0806_orphan_outbox AS t
WHERE x.tenant_org_id = t.tenant_org_id AND x.id = t.outbox_id;

DELETE FROM public.org_ntf_inbox_mst AS x
USING tmp_0806_orphan_inbox AS t
WHERE x.tenant_org_id = t.tenant_org_id AND x.id = t.inbox_id;

COMMIT;
