-- =============================================================================
-- Migration: 0781_ntf_outbox_due_notify.sql
-- Purpose:   I11 WP2 wake bell. A due outbox row notifies channel ntf_outbox_due
--            with the job code only. No recipient, body, or tenant id is sent.
-- Affected:  fn_ntf_outbox_due_notify, trg_ntf_obx_due_ntf on org_ntf_outbox_dtl
-- Safety:    DRAFT ONLY. Review and apply manually. Does not claim or send.
--            The HQ API LISTEN client uses a session-mode URL (PLATFORM_BG_DB_URL).
--            Without that URL the 15-minute sweep is the only wake.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.fn_ntf_outbox_due_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- The payload is the job code. The row's tenant stays in the table, not on the channel.
  IF NEW.tenant_org_id IS NOT NULL
     AND NEW.rec_status = 1
     AND NEW.is_active
     AND NEW.claim_token IS NULL
     AND NEW.reconcile_state IS NULL
     AND NEW.status IN ('QUEUED', 'FAILED_TEMPORARY') THEN
    PERFORM pg_notify('ntf_outbox_due', 'ntf-outbox-dispatch');
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_outbox_due_notify() IS
  'Wake bell for a claim-eligible notification outbox row. Payload is the job code only. Does not claim or send.';

DROP TRIGGER IF EXISTS trg_ntf_obx_due_ntf ON public.org_ntf_outbox_dtl;
CREATE TRIGGER trg_ntf_obx_due_ntf
  AFTER INSERT OR UPDATE OF status, scheduled_at, next_retry_at, claim_token, reconcile_state
  ON public.org_ntf_outbox_dtl
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ntf_outbox_due_notify();

COMMENT ON TRIGGER trg_ntf_obx_due_ntf ON public.org_ntf_outbox_dtl IS
  'Notifies ntf_outbox_due when a row becomes claim-eligible. The channel payload is not customer data.';

REVOKE ALL ON FUNCTION public.fn_ntf_outbox_due_notify() FROM PUBLIC, anon, authenticated;

COMMIT;
