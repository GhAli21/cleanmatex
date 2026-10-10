BEGIN;

-- =============================================================================
-- Migration 0601: Campaign processor correctness fixes
-- CMX-PRD-019 Notification & Communication Hub
-- Created: 2026-10-10
--
-- Backs the corrected POST /api/notifications/process-campaigns processor
-- (web-admin/app/api/notifications/process-campaigns/route.ts) and the new
-- terminal-status hookup in POST /api/notifications/process-outbox. Fixes,
-- in one migration:
--
--   1. 'campaign.send' event code did not exist in sys_ntf_events_cd, so
--      EVERY insert the processor made into org_ntf_inbox_mst (NOT NULL FK
--      on event_code) and org_ntf_outbox_dtl (nullable FK, but the column
--      was always populated with this literal) violated the foreign key and
--      failed outright. Campaign dispatch across every channel, including
--      IN_APP, was completely broken prior to this migration — not merely
--      miscounted. Seeded as a proper MARKETING-category, non-transactional,
--      consent-required event so the processor's inserts succeed.
--
--   2. org_ntf_camp_targets_dtl.outbox_id is a FOREIGN KEY to
--      org_ntf_outbox_dtl(id). The processor's IN_APP branch assigned the
--      org_ntf_inbox_mst row's id to this column, which also violates its
--      foreign key for any IN_APP target (the one case where the FK bug in
--      #1 did not already block the write). New nullable inbox_id column
--      added so IN_APP targets can record their actual linked row without
--      corrupting the outbox_id FK's meaning.
--
--   3. org_ntf_camp_targets_dtl had no uniqueness guard on
--      (campaign_id, recipient_user_id), so activateCampaign() (Phase A)
--      could insert duplicate target rows for the same recipient on a
--      pg_cron retry or overlapping invocation. New UNIQUE constraint lets
--      the processor use upsert(..., { ignoreDuplicates: true }) to make
--      target creation idempotent. Confirmed via read-only query against
--      the remote database before writing this migration: zero existing
--      (campaign_id, recipient_user_id) duplicates and zero existing rows
--      in org_ntf_campaigns_mst / org_ntf_camp_targets_dtl at all (feature
--      has not been exercised against real data yet) — no backfill is
--      required for either this constraint or the new counter column below.
--
--   4. org_ntf_campaigns_mst.sent_count was incremented the moment a target
--      was handed to the outbox/inbox (enqueued), not when the underlying
--      channel adapter actually confirmed delivery — conflating "queued"
--      with "sent" in a counter the UI (campaign-detail-page.tsx,
--      campaign-list-page.tsx) renders under an explicit "Sent" label in
--      success/emerald color. New queued_count column takes over the old
--      "enqueued so far" meaning; sent_count is corrected to mean exactly
--      what its UI label says. failed_count existed since migration 0361
--      but was never incremented by the processor at all; it is now
--      populated by the same terminal-resolution hookup.
--
--   5. New fn_ntf_camp_target_resolve() function: a single atomic UPDATE
--      that advances a campaign target from QUEUED to its terminal
--      SENT/FAILED/SKIPPED status (matched via outbox_id, tenant-scoped) and
--      increments the owning campaign's sent_count/failed_count in the same
--      statement. Guards on `status = 'QUEUED'` so a duplicate/redelivered
--      call for the same outbox_id is a safe no-op — this is the same
--      "atomic increment, immune to lost updates" shape migration 0598
--      established for org_ntf_usage_daily, reused here for the same class
--      of problem (multiple concurrent process-outbox rows resolving for
--      the same campaign must not lose an increment to a classic
--      read-then-write race). No advisory lock is needed here (unlike 0598):
--      a single UPDATE ... WHERE ... RETURNING is already atomic with no
--      prior SELECT round-trip.
--
-- Scope boundary (explicit): this migration does not touch campaign
-- authoring, approval workflow, targeting/segmentation, billing, plan
-- limits, feature flags, navigation, or permissions. It does not add a
-- Phase A/B claim-token system (unlike process-outbox's claim/lease model) —
-- the upsert(ignoreDuplicates) in #3 closes the specific duplicate-target
-- bug asked for; a full claim-token system for Phase B is a larger,
-- out-of-scope change and is reported as a residual limitation in
-- STATUS.md.
--
-- Prerequisite: migrations through 0600 applied.
-- Next seq: 0602
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Seed the 'campaign.send' event code (fixes the universal FK-violation
--    bug — see header #1). MARKETING category, matching the other
--    campaign.* lifecycle events already seeded under that category.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sys_ntf_events_cd
  (code, category_code, name, name2, description, description2,
   priority, is_transactional, requires_consent)
VALUES
  ('campaign.send',
   'MARKETING',
   'Campaign Message',
   'رسالة حملة تسويقية',
   'The actual recipient-facing marketing message dispatched by a campaign (POST /api/notifications/process-campaigns), as distinct from the campaign.* admin lifecycle notices (approved/launched/completed/...).',
   'الرسالة التسويقية الفعلية الموجهة للمستلم والتي يرسلها محرك الحملات، بخلاف إشعارات دورة حياة الحملة الإدارية.',
   'NORMAL', false, true)
ON CONFLICT (code) DO UPDATE SET
  category_code     = EXCLUDED.category_code,
  name               = EXCLUDED.name,
  name2              = EXCLUDED.name2,
  description        = EXCLUDED.description,
  description2       = EXCLUDED.description2,
  priority           = EXCLUDED.priority,
  is_transactional   = EXCLUDED.is_transactional,
  requires_consent   = EXCLUDED.requires_consent,
  updated_at         = CURRENT_TIMESTAMP;

COMMENT ON COLUMN public.sys_ntf_events_cd.code IS
  'Event code primary key, e.g. order.created, campaign.send. campaign.send (added 0601) is the recipient-facing marketing message itself; campaign.approved/launched/completed/... are separate admin lifecycle notices.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. org_ntf_camp_targets_dtl.inbox_id — new nullable link for IN_APP targets
--    (fixes header #2: outbox_id's FK to org_ntf_outbox_dtl must never be
--    assigned an org_ntf_inbox_mst row id).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.org_ntf_camp_targets_dtl
  ADD COLUMN IF NOT EXISTS inbox_id UUID REFERENCES public.org_ntf_inbox_mst(id);

COMMENT ON COLUMN public.org_ntf_camp_targets_dtl.inbox_id IS
  'Linked org_ntf_inbox_mst row for IN_APP-channel targets, populated by the processor once the inbox write succeeds. Added 0601 — IN_APP targets must never store an inbox row id in outbox_id (that column is a real FK to org_ntf_outbox_dtl). NULL for every other channel.';

COMMENT ON COLUMN public.org_ntf_camp_targets_dtl.outbox_id IS
  'Linked org_ntf_outbox_dtl row for EMAIL/SMS/WHATSAPP/PUSH targets. Always NULL for IN_APP targets as of 0601 — see inbox_id for that channel''s linkage.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Idempotent target creation — UNIQUE(campaign_id, recipient_user_id)
--    (fixes header #3). NULL recipient_user_id rows (external-address-only
--    targets, per the column's original comment in migration 0361) are
--    unaffected: Postgres treats NULLs as distinct for uniqueness, so this
--    constraint only ever dedupes rows that actually name a recipient user.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.org_ntf_camp_targets_dtl
  ADD CONSTRAINT uq_ntf_camp_tgt_camp_recip UNIQUE (campaign_id, recipient_user_id);

COMMENT ON CONSTRAINT uq_ntf_camp_tgt_camp_recip ON public.org_ntf_camp_targets_dtl IS
  'Added 0601. Makes Phase A target creation (activateCampaign) idempotent against a pg_cron retry or overlapping invocation via upsert(..., { onConflict: ''campaign_id,recipient_user_id'', ignoreDuplicates: true }). NULL recipient_user_id rows are never deduped by this constraint (NULL <> NULL) — only applies to real recipient users.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. org_ntf_campaigns_mst.queued_count — new "enqueued, pending terminal
--    resolution" counter (fixes header #4). sent_count/failed_count comments
--    updated to describe their corrected meaning; no historical values are
--    rewritten (none exist — confirmed empty table — and historical/applied
--    semantics are never retrofitted after the fact per CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.org_ntf_campaigns_mst
  ADD COLUMN IF NOT EXISTS queued_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_ntf_campaigns_mst.queued_count IS
  'Added 0601. Count of targets successfully handed to org_ntf_outbox_dtl/org_ntf_inbox_mst by Phase B (dispatchTargets), awaiting terminal delivery resolution for EMAIL/SMS/WHATSAPP/PUSH. This is the counter the processor incremented under the name sent_count before 0601 — see sent_count''s corrected comment below.';

COMMENT ON COLUMN public.org_ntf_campaigns_mst.sent_count IS
  'Count of targets whose underlying delivery (org_ntf_outbox_dtl row reaching SENT, or an IN_APP org_ntf_inbox_mst write, which is synchronous and immediately terminal) is CONFIRMED sent. Corrected by migration 0601 — before this migration the processor incremented this column at enqueue time (now queued_count''s meaning), which the UI (campaign-detail-page.tsx / campaign-list-page.tsx, labeled "Sent") rendered as if it meant confirmed delivery.';

COMMENT ON COLUMN public.org_ntf_campaigns_mst.failed_count IS
  'Count of targets whose underlying delivery reached a permanent FAILED outcome. Column existed since migration 0361 but was never incremented by the processor before migration 0601, which adds the terminal-resolution hookup (fn_ntf_camp_target_resolve, called from process-outbox''s finalizeClaim) that populates it.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_ntf_camp_target_resolve — atomic terminal-status hookup
--    (fixes header #5, the mechanism behind header #4's failed_count and the
--    corrected sent_count). Called once per outbox row, from
--    process-outbox's finalizeClaim(), only for rows with
--    source_entity_type = 'campaign'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ntf_camp_target_resolve(
  p_outbox_id      UUID,
  p_tenant_org_id  UUID,
  p_target_status  TEXT,
  p_skip_reason    TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign_id UUID;
BEGIN
  IF p_target_status NOT IN ('SENT', 'FAILED', 'SKIPPED') THEN
    RAISE EXCEPTION 'fn_ntf_camp_target_resolve: p_target_status must be SENT, FAILED or SKIPPED (got %)', p_target_status;
  END IF;

  -- Single atomic statement: only a target still QUEUED is advanced, so a
  -- duplicate/redelivered call for the same outbox_id is a safe no-op
  -- (RETURNING yields no row, v_campaign_id stays NULL, function returns
  -- false) instead of double-incrementing the campaign counters below.
  UPDATE public.org_ntf_camp_targets_dtl
  SET status       = p_target_status,
      skip_reason  = COALESCE(p_skip_reason, skip_reason),
      processed_at = CURRENT_TIMESTAMP,
      updated_at   = CURRENT_TIMESTAMP
  WHERE outbox_id     = p_outbox_id
    AND tenant_org_id = p_tenant_org_id
    AND status        = 'QUEUED'
  RETURNING campaign_id INTO v_campaign_id;

  IF v_campaign_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.org_ntf_campaigns_mst
  SET sent_count   = sent_count   + CASE WHEN p_target_status = 'SENT'   THEN 1 ELSE 0 END,
      failed_count = failed_count + CASE WHEN p_target_status = 'FAILED' THEN 1 ELSE 0 END,
      updated_at   = CURRENT_TIMESTAMP
  WHERE id = v_campaign_id
    AND tenant_org_id = p_tenant_org_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_camp_target_resolve(UUID, UUID, TEXT, TEXT) IS
  'Advances one org_ntf_camp_targets_dtl row (matched by outbox_id, tenant-scoped) from QUEUED to a terminal SENT/FAILED/SKIPPED status and atomically increments the owning org_ntf_campaigns_mst sent_count/failed_count in the same statement. Guards on status = ''QUEUED'' so a duplicate call for the same outbox_id is a no-op (returns false), immune to the lost-update race a separate SELECT-then-UPDATE would have. Called from POST /api/notifications/process-outbox''s finalizeClaim() only when the resolved outbox row has source_entity_type = ''campaign''. Does not touch skip_count (set directly by the campaign processor at enqueue time, since NO_MARKETING_CONSENT skips are already terminal at that point) or queued_count (Phase B''s own concern).';

COMMIT;
