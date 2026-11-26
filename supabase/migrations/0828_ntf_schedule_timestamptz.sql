-- Notification schedule instants become timestamptz.
-- Provenance: docs/features/Time_and_Timezone/technical_docs/provenance-class-a.md
-- Sampled 2026-11-25. org_ntf_outbox_dtl.scheduled_at matches finalized_at as a UTC wall.
-- next_retry_at and org_ntf_campaigns_mst.scheduled_at had no stored rows.
-- Lockout columns are not in this migration: they have no external instant.
-- After this migration is applied, request.service.ts must stop wrapping these
-- columns in AT TIME ZONE 'UTC'. That cast is correct only while they are naive.

BEGIN;

-- PostgreSQL refuses to change a column type while a trigger lists that column in UPDATE OF.
-- The trigger only notifies; it does not read the column type. It is recreated after the change.
DROP TRIGGER trg_ntf_obx_due_ntf ON public.org_ntf_outbox_dtl;

-- scheduled_at: when the outbox row may be sent. UTC instant. Quiet hours may set a future instant.
ALTER TABLE public.org_ntf_outbox_dtl
  ALTER COLUMN scheduled_at TYPE timestamptz
  USING scheduled_at AT TIME ZONE 'UTC';

COMMENT ON COLUMN public.org_ntf_outbox_dtl.scheduled_at IS
  'UTC instant when the outbox row may be sent. Quiet hours may set a future instant. Converted from a naive UTC wall on 2026-11-25.';

-- next_retry_at: when a temporary failure may be sent again. Null until a retry is scheduled.
ALTER TABLE public.org_ntf_outbox_dtl
  ALTER COLUMN next_retry_at TYPE timestamptz
  USING next_retry_at AT TIME ZONE 'UTC';

COMMENT ON COLUMN public.org_ntf_outbox_dtl.next_retry_at IS
  'UTC instant when a temporary failure may be sent again. Null until a retry is scheduled. No stored rows existed at conversion.';

-- scheduled_at: when a campaign may start. Null means the campaign is not scheduled.
ALTER TABLE public.org_ntf_campaigns_mst
  ALTER COLUMN scheduled_at TYPE timestamptz
  USING scheduled_at AT TIME ZONE 'UTC';

COMMENT ON COLUMN public.org_ntf_campaigns_mst.scheduled_at IS
  'UTC instant when the campaign may start. Null means it is not scheduled. No stored rows existed at conversion.';

CREATE TRIGGER trg_ntf_obx_due_ntf
  AFTER INSERT OR UPDATE OF status, scheduled_at, next_retry_at, claim_token, reconcile_state
  ON public.org_ntf_outbox_dtl
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ntf_outbox_due_notify();

COMMENT ON TRIGGER trg_ntf_obx_due_ntf ON public.org_ntf_outbox_dtl IS
  'Notifies ntf_outbox_due when a sendable outbox row is inserted or its schedule, status, claim, or reconcile state changes.';

COMMIT;
