-- =============================================================================
-- Migration: 0364_ntf_unify_table_names.sql
-- Purpose:   Unify all notification table names to the _ntf_ abbreviation.
--            Three patterns existed: _ntf_ (correct), _notif_, _notification_.
--            This migration renames all 7 inconsistent tables, their indexes,
--            and the one RLS policy that embedded the old table name.
--            The pg_cron sweep function is recreated to update its table ref.
-- Affected:  org_notif_push_subs_dtl, org_notif_campaign_targets_dtl,
--            org_notification_campaigns_mst, org_notification_audit_dtl,
--            org_notification_usage_daily,
--            sys_notification_channel_cd, sys_notification_type_cd
-- FK note:   PostgreSQL auto-updates all FK constraints on table rename.
-- Seq:       0364 (next after 0363_nav_marketing_campaigns.sql)
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. RENAME TABLES (7)
-- ============================================================

-- New hub tables (created in migrations 0351, 0361)
ALTER TABLE org_notif_push_subs_dtl       RENAME TO org_ntf_push_subs_dtl;
ALTER TABLE org_notif_campaign_targets_dtl RENAME TO org_ntf_camp_targets_dtl;
ALTER TABLE org_notification_campaigns_mst RENAME TO org_ntf_campaigns_mst;
ALTER TABLE org_notification_audit_dtl     RENAME TO org_ntf_audit_dtl;
ALTER TABLE org_notification_usage_daily   RENAME TO org_ntf_usage_daily;

-- Legacy 0053 tables (sys_* global catalogs, no tenant_org_id, no RLS)
ALTER TABLE sys_notification_channel_cd    RENAME TO sys_ntf_channel_cd;
ALTER TABLE sys_notification_type_cd       RENAME TO sys_ntf_type_cd;

-- ============================================================
-- 2. RENAME INDEXES (9)
--    ALTER TABLE RENAME auto-updates FK refs but not index names.
-- ============================================================

-- Push subscription indexes (from 0351_notif_push_subscriptions.sql)
ALTER INDEX uq_notif_push_subs_device_provider RENAME TO uq_ntf_push_subs_device_provider;
ALTER INDEX idx_notif_push_user_active          RENAME TO idx_ntf_push_user_active;
ALTER INDEX idx_notif_push_stale_sweep          RENAME TO idx_ntf_push_stale_sweep;
ALTER INDEX idx_notif_push_tenant               RENAME TO idx_ntf_push_tenant;

-- Legacy 0053 indexes (sys_notification_channel_cd)
ALTER INDEX idx_notification_channel_active     RENAME TO idx_ntf_channel_active;
ALTER INDEX idx_notification_channel_type       RENAME TO idx_ntf_channel_type;

-- Legacy 0053 indexes (sys_notification_type_cd)
ALTER INDEX idx_notification_type_active        RENAME TO idx_ntf_type_active;
ALTER INDEX idx_notification_type_category      RENAME TO idx_ntf_type_category;
ALTER INDEX idx_notification_type_priority      RENAME TO idx_ntf_type_priority;

-- Note: campaign, audit, and usage indexes were created with idx_ntf_* names
-- in 0361_ntf_campaign_engine_tables.sql — no rename needed for those.

-- ============================================================
-- 3. RENAME RLS POLICY (1)
--    Only push subs had the old table name embedded in the policy name.
--    The other 4 org_* tables used already-abbreviated names in 0361:
--      tenant_isolation_ntf_campaigns, tenant_isolation_ntf_camp_tgt,
--      tenant_isolation_ntf_audit_select/insert, tenant_isolation_ntf_usage
-- ============================================================
ALTER POLICY tenant_isolation_org_notif_push_subs
  ON org_ntf_push_subs_dtl
  RENAME TO tenant_isolation_org_ntf_push_subs;

-- ============================================================
-- 4. RECREATE SWEEP FUNCTION
--    Updates the hard-coded table reference in the function body.
--    Source: 0353_notif_push_sweep_cron.sql — full body preserved.
--    The pg_cron job references this function by name; no cron change needed.
-- ============================================================
CREATE OR REPLACE FUNCTION ntf_sweep_stale_push_subs()
RETURNS TABLE(deactivated_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  UPDATE org_ntf_push_subs_dtl        -- renamed from org_notif_push_subs_dtl
  SET
    is_active  = false,
    updated_at = NOW(),
    updated_by = 'pg_cron:ntf_sweep_stale_push_subs',
    rec_notes  = 'Deactivated by stale-subscription sweep: failure_count > 3 or last_verified_at older than 90 days'
  WHERE
    is_active = true
    AND (
      failure_count > 3
      OR last_verified_at < NOW() - INTERVAL '90 days'
      OR (last_verified_at IS NULL AND created_at < NOW() - INTERVAL '90 days')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$;

COMMIT;
