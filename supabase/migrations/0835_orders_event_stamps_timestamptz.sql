-- Order, piece, and receipt event stamps become timestamptz.
-- Each naive value is a UTC wall. ready_by_at and ready_at are already timestamptz and are not altered.

BEGIN;

DROP VIEW IF EXISTS public.org_order_status_history_legacy RESTRICT;
-- org_order_item_pieces_dtl.last_step_at
ALTER TABLE public.org_order_item_pieces_dtl ALTER COLUMN last_step_at TYPE timestamptz USING last_step_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_item_pieces_dtl.last_step_at IS 'UTC instant (last_step_at). Converted from a naive stamp written while the database session was UTC.';

-- org_order_status_history.changed_at
ALTER TABLE public.org_order_status_history ALTER COLUMN changed_at TYPE timestamptz USING changed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_order_status_history.changed_at IS 'UTC instant (changed_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_order_status_history ALTER COLUMN changed_at SET DEFAULT now();

-- org_orders_mst.credit_limit_override_at
ALTER TABLE public.org_orders_mst ALTER COLUMN credit_limit_override_at TYPE timestamptz USING credit_limit_override_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_orders_mst.credit_limit_override_at IS 'UTC instant (credit_limit_override_at). Converted from a naive stamp written while the database session was UTC.';

-- org_orders_mst.delivered_at
ALTER TABLE public.org_orders_mst ALTER COLUMN delivered_at TYPE timestamptz USING delivered_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_orders_mst.delivered_at IS 'UTC instant (delivered_at). Converted from a naive stamp written while the database session was UTC.';

-- org_orders_mst.paid_at
ALTER TABLE public.org_orders_mst ALTER COLUMN paid_at TYPE timestamptz USING paid_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_orders_mst.paid_at IS 'UTC instant (paid_at). Converted from a naive stamp written while the database session was UTC.';

-- org_orders_mst.prepared_at
ALTER TABLE public.org_orders_mst ALTER COLUMN prepared_at TYPE timestamptz USING prepared_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_orders_mst.prepared_at IS 'UTC instant (prepared_at). Converted from a naive stamp written while the database session was UTC.';

-- org_orders_mst.received_at
ALTER TABLE public.org_orders_mst ALTER COLUMN received_at TYPE timestamptz USING received_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_orders_mst.received_at IS 'UTC instant (received_at). Converted from a naive stamp written while the database session was UTC.';

-- org_rcpt_receipts_mst.delivered_at
ALTER TABLE public.org_rcpt_receipts_mst ALTER COLUMN delivered_at TYPE timestamptz USING delivered_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_rcpt_receipts_mst.delivered_at IS 'UTC instant (delivered_at). Converted from a naive stamp written while the database session was UTC.';

-- org_rcpt_receipts_mst.sent_at
ALTER TABLE public.org_rcpt_receipts_mst ALTER COLUMN sent_at TYPE timestamptz USING sent_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_rcpt_receipts_mst.sent_at IS 'UTC instant (sent_at). Converted from a naive stamp written while the database session was UTC.';

CREATE VIEW public.org_order_status_history_legacy AS
 SELECT id,
    order_id,
    tenant_org_id,
    from_status AS from_value,
    to_status AS to_value,
    changed_by AS done_by,
    changed_at AS done_at,
    notes,
    metadata AS payload
   FROM org_order_status_history;;
COMMENT ON VIEW public.org_order_status_history_legacy IS 'Legacy view for backward compatibility. Maps old org_order_status_history to new structure Runs as the caller (security_invoker). Closed to anon and authenticated.';
REVOKE ALL ON TABLE public.org_order_status_history_legacy FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.org_order_status_history_legacy TO service_role;

COMMIT;
