-- ==================================================================
-- 0441_public_order_tracking_tokens.sql
-- Purpose: add opaque public tracking tokens for customer-facing order
--          links so URLs no longer expose tenant UUIDs + readable
--          order numbers by default.
--
-- Design:
-- - Keep legacy /public/orders/{tenantId}/{orderNo} links working during
--   rollout, but introduce a canonical /track/{token} path.
-- - Store one token on org_orders_mst for direct lookup without extra joins.
-- - Backfill existing rows and default future inserts to a random hex token.
-- - Optional expiry/revocation fields allow future rotation or link disable.
--
-- Author: CleanMateX Development Team
-- Created: 2026-07-25
-- Dependencies: none
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS public_tracking_token TEXT;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS public_tracking_token_expires_at TIMESTAMPTZ;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS public_tracking_token_revoked_at TIMESTAMPTZ;

ALTER TABLE public.org_orders_mst
  ALTER COLUMN public_tracking_token
  SET DEFAULT lower(encode(gen_random_bytes(16), 'hex'));

UPDATE public.org_orders_mst
SET public_tracking_token = lower(encode(gen_random_bytes(16), 'hex'))
WHERE public_tracking_token IS NULL
   OR btrim(public_tracking_token) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ord_pubtrk_tok
  ON public.org_orders_mst (public_tracking_token)
  WHERE public_tracking_token IS NOT NULL;

COMMENT ON COLUMN public.org_orders_mst.public_tracking_token IS
  'Opaque customer-facing token for the canonical /track/{token} public order link. Keeps tenant UUID and order number out of the URL by default.';

COMMENT ON COLUMN public.org_orders_mst.public_tracking_token_expires_at IS
  'Optional expiry for the public tracking token. NULL means the token does not expire automatically.';

COMMENT ON COLUMN public.org_orders_mst.public_tracking_token_revoked_at IS
  'Optional revocation timestamp for the public tracking token. Non-NULL disables /track/{token} resolution without deleting order history.';

COMMIT;

