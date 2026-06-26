-- ==================================================================
-- Migration: 0387_refund_doc_seq_numbering.sql
-- Purpose: Seed a concurrency-safe document sequence for refund numbers
--          so refunds stop using the racy `count(*)+1` scheme.
--
-- Problem (F-R3): order-refund.service.ts minted `refund_no` from
--   `count(org_order_refunds_dtl) + 1`. Two concurrent refunds for the
--   same tenant read the same count and produced the SAME REF- number
--   (and could collide / mis-number under load).
--
-- Fix: route refund numbering through the existing atomic helper
--   `public.fn_next_fin_doc_no(tenant, doc_type)` (added in 0214) which
--   takes a row-level FOR UPDATE lock on `org_fin_doc_seq_mst` and
--   returns the formatted number — same mechanism AR invoices use.
--
-- This migration seeds (upserts) the per-tenant REFUND sequence row with
--   prefix 'REF-' and back-fills `last_no` to the current maximum issued
--   refund number so newly minted numbers never collide with existing
--   `REF-NNNNNN` values. Idempotent (ON CONFLICT DO UPDATE, GREATEST guard).
--
-- Tables touched: public.org_fin_doc_seq_mst (data only — no DDL).
-- No new objects. Additive + idempotent. Tenant-scoped.
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- Seed / correct the REFUND document sequence for every tenant.
-- last_no starts at the highest numeric suffix of any existing REF- number
-- for that tenant (0 if the tenant has no refunds yet), so fn_next_fin_doc_no
-- returns the next free number on first call.
INSERT INTO public.org_fin_doc_seq_mst (
  tenant_org_id, doc_type_code, prefix, last_no, padding_len,
  created_at, created_by, created_info, rec_status, is_active
)
SELECT
  t.id,
  'REFUND',
  'REF-',
  COALESCE(r.max_no, 0),
  6,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Refund numbering seed (0387, F-R3)',
  1,
  true
FROM public.org_tenants_mst t
LEFT JOIN LATERAL (
  -- Highest numeric suffix among this tenant's existing refund numbers
  -- that match the canonical 'REF-<digits>' format.
  SELECT MAX((substring(d.refund_no FROM '^REF-(\d+)$'))::bigint) AS max_no
  FROM public.org_order_refunds_dtl d
  WHERE d.tenant_org_id = t.id
    AND d.refund_no ~ '^REF-\d+$'
) r ON true
ON CONFLICT (tenant_org_id, doc_type_code) DO UPDATE
SET prefix      = 'REF-',
    padding_len = 6,
    -- Never move the counter backwards: keep the larger of the existing
    -- value (e.g. an auto-created row from a pre-seed code path) and the
    -- back-filled maximum.
    last_no     = GREATEST(public.org_fin_doc_seq_mst.last_no, EXCLUDED.last_no),
    is_active   = true,
    rec_status  = 1,
    updated_at  = CURRENT_TIMESTAMP,
    updated_by  = 'system_admin',
    updated_info = 'Refund numbering seed (0387, F-R3)';

COMMIT;