-- Notification event stamps become timestamptz.
-- scheduled_at, next_retry_at, and campaign scheduled_at are already timestamptz and are not altered.

BEGIN;


-- org_ntf_audit_dtl.performed_at
ALTER TABLE public.org_ntf_audit_dtl ALTER COLUMN performed_at TYPE timestamptz USING performed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_audit_dtl.performed_at IS 'UTC instant (performed_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_audit_dtl ALTER COLUMN performed_at SET DEFAULT now();

-- org_ntf_camp_targets_dtl.processed_at
ALTER TABLE public.org_ntf_camp_targets_dtl ALTER COLUMN processed_at TYPE timestamptz USING processed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_camp_targets_dtl.processed_at IS 'UTC instant (processed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_campaigns_mst.approved_at
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN approved_at TYPE timestamptz USING approved_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.approved_at IS 'UTC instant (approved_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_campaigns_mst.cancelled_at
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN cancelled_at TYPE timestamptz USING cancelled_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.cancelled_at IS 'UTC instant (cancelled_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_campaigns_mst.completed_at
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.completed_at IS 'UTC instant (completed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_campaigns_mst.paused_at
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN paused_at TYPE timestamptz USING paused_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.paused_at IS 'UTC instant (paused_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_campaigns_mst.started_at
ALTER TABLE public.org_ntf_campaigns_mst ALTER COLUMN started_at TYPE timestamptz USING started_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_campaigns_mst.started_at IS 'UTC instant (started_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_delivery_log_dtl.logged_at
ALTER TABLE public.org_ntf_delivery_log_dtl ALTER COLUMN logged_at TYPE timestamptz USING logged_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_delivery_log_dtl.logged_at IS 'UTC instant (logged_at). Converted from a naive stamp written while the database session was UTC.';
ALTER TABLE public.org_ntf_delivery_log_dtl ALTER COLUMN logged_at SET DEFAULT now();

-- org_ntf_inbox_mst.expires_at
ALTER TABLE public.org_ntf_inbox_mst ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_inbox_mst.expires_at IS 'UTC instant (expires_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_inbox_mst.read_at
ALTER TABLE public.org_ntf_inbox_mst ALTER COLUMN read_at TYPE timestamptz USING read_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_inbox_mst.read_at IS 'UTC instant (read_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_outbox_dtl.delivered_at
ALTER TABLE public.org_ntf_outbox_dtl ALTER COLUMN delivered_at TYPE timestamptz USING delivered_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_outbox_dtl.delivered_at IS 'UTC instant (delivered_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_outbox_dtl.read_at
ALTER TABLE public.org_ntf_outbox_dtl ALTER COLUMN read_at TYPE timestamptz USING read_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_outbox_dtl.read_at IS 'UTC instant (read_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_outbox_dtl.sent_at
ALTER TABLE public.org_ntf_outbox_dtl ALTER COLUMN sent_at TYPE timestamptz USING sent_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_outbox_dtl.sent_at IS 'UTC instant (sent_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_push_subs_dtl.last_verified_at
ALTER TABLE public.org_ntf_push_subs_dtl ALTER COLUMN last_verified_at TYPE timestamptz USING last_verified_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_push_subs_dtl.last_verified_at IS 'UTC instant (last_verified_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_user_prefs_dtl.consent_given_at
ALTER TABLE public.org_ntf_user_prefs_dtl ALTER COLUMN consent_given_at TYPE timestamptz USING consent_given_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_user_prefs_dtl.consent_given_at IS 'UTC instant (consent_given_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ntf_user_prefs_dtl.consent_withdrawn_at
ALTER TABLE public.org_ntf_user_prefs_dtl ALTER COLUMN consent_withdrawn_at TYPE timestamptz USING consent_withdrawn_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ntf_user_prefs_dtl.consent_withdrawn_at IS 'UTC instant (consent_withdrawn_at). Converted from a naive stamp written while the database session was UTC.';


COMMIT;
