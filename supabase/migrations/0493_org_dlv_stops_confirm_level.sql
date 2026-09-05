-- ============================================================================
-- Migration: 0493_org_dlv_stops_confirm_level.sql
-- Purpose: Track WHO confirmed a delivery stop as delivered.
--
--   Real gap found: the customer-facing public tracking "confirm received"
--   link (out_for_delivery branch) called the workflow engine's
--   CONFIRM_DELIVERY action directly, with no awareness of an open route
--   stop. The order flipped to `delivered` while its stop stayed
--   `pending`/`in_transit` forever -- orphaned, since no other path ever
--   revisits a stop once the order itself is already `delivered`.
--
--   Decision (operator): a customer's own "I received it" confirmation IS a
--   valid delivery confirmation. When an open stop exists at that moment, the
--   stop is now marked `delivered` too (not cancelled) as part of the same
--   command, and `confirm_level` records that this particular confirmation
--   came from the customer rather than staff/driver/system -- distinct from
--   `stop_status_code`, which only ever tracked *what* happened, never *who*
--   attested it.
--
--   'sys_user' covers every existing staff/driver-channel stop completion
--   (delivery-completion.service.ts's completeDelivery). 'customer' is new,
--   used only by the public-tracking auto-resolve path. Nullable and never
--   backfilled -- historical rows predate this distinction and get no value
--   invented for them.
--
--   confirm_notes: a customer may add a short comment when self-confirming via
--   the public link (e.g. "left with neighbor"). Kept separate from the
--   existing `notes` column, which is dispatcher-set stop instructions
--   established before delivery -- reusing it would risk a customer's comment
--   silently overwriting or being confused with that unrelated data.
--
--   No separate confirm-timestamp column: `actual_time` already records the
--   exact moment every completion path (staff or customer) marks a stop
--   delivered -- a second column would just duplicate it.
-- ============================================================================
-- Do not apply automatically. Operator reviews and applies.

BEGIN;

ALTER TABLE public.org_dlv_stops_dtl
  ADD COLUMN confirm_level TEXT,
  ADD COLUMN confirm_notes TEXT;

ALTER TABLE public.org_dlv_stops_dtl
  ADD CONSTRAINT chk_dlv_stops_confirm_level
    CHECK (confirm_level IS NULL OR confirm_level IN ('sys_user', 'customer'));

COMMENT ON COLUMN public.org_dlv_stops_dtl.confirm_level IS
  'Who confirmed this stop as delivered: sys_user (staff/driver completion) or customer (public tracking link self-confirm). Null until delivered, and null on rows predating this column.';
COMMENT ON COLUMN public.org_dlv_stops_dtl.confirm_notes IS
  'Optional comment the customer added when self-confirming delivery via the public tracking link. Distinct from `notes` (dispatcher-set stop instructions).';

COMMIT;
