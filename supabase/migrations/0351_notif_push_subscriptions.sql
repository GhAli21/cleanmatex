-- =============================================================================
-- 0351_notif_push_subscriptions.sql
-- Purpose: Notification Hub – provider-agnostic push subscription registry.
--          Replaces the earlier FCM-only design. Stores push subscriptions for
--          any configured push provider: VAPID (Web Push), FCM, or OneSignal.
--
--          Table: org_notif_push_subs_dtl  (22 chars)
--
--          Provider-specific data is stored in subscription_data JSONB:
--            VAPID    → { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }
--            FCM      → { "token": "..." }
--            ONESIGNAL→ { "player_id": "..." }
--
--          The active provider for each channel is governed by
--          org_ntf_channel_provider_cf (migration 0352). The push adapter reads
--          that table to know which provider_code is currently active, then
--          fetches only matching subscriptions from this table.
--
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-11
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Push subscription registry (provider-agnostic)
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_notif_push_subs_dtl (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID      NOT NULL,

  -- Owner
  user_id           UUID      NOT NULL,

  -- Stable client-generated device or browser identifier (UUID or hardware ID).
  -- The client provides this; the API upserts on (tenant_org_id, user_id, device_id, provider_code).
  device_id         TEXT      NOT NULL,

  -- Which push provider this subscription belongs to.
  -- Determines how subscription_data is interpreted.
  provider_code     TEXT      NOT NULL
    CHECK (provider_code IN ('FCM', 'VAPID', 'ONESIGNAL')),

  -- Target platform; affects payload format chosen by the push adapter.
  platform          TEXT      NOT NULL
    CHECK (platform IN ('IOS', 'ANDROID', 'WEB', 'BROWSER')),

  -- Provider-specific payload (see header for shape per provider).
  -- Never stores API keys or secrets — those live in env vars.
  subscription_data JSONB     NOT NULL,

  -- Client app version at registration time; useful for targeting version-specific payloads.
  app_version       TEXT,

  -- Timestamp of last successful delivery or explicit re-registration.
  -- Subscriptions not verified within 90 days are deactivated by the cron sweep (Step 3.5).
  last_verified_at  TIMESTAMP,

  -- Consecutive delivery failures. Push adapter increments on each provider error.
  -- Set is_active = false when failure_count > 3 or on UNREGISTERED/INVALID provider error.
  failure_count     INTEGER   NOT NULL DEFAULT 0,

  -- Deactivated on UNREGISTERED/INVALID provider errors or 90-day inactivity sweep.
  is_active         BOOLEAN   NOT NULL DEFAULT true,

  -- Audit
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by        TEXT,
  created_info      TEXT,
  updated_at        TIMESTAMP,
  updated_by        TEXT,
  updated_info      TEXT,
  rec_status        SMALLINT  DEFAULT 1,
  rec_order         INTEGER,
  rec_notes         TEXT
);

-- =============================================================================
-- 2. Unique constraint — upsert target for subscription refresh
--    A device can register with multiple providers (e.g., VAPID for browser + FCM
--    for mobile app). One row per (tenant, user, device, provider).
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_push_subs_device_provider
  ON org_notif_push_subs_dtl (tenant_org_id, user_id, device_id, provider_code);

-- =============================================================================
-- 3. Performance indexes
-- =============================================================================

-- Primary push adapter query: active subscriptions for a user filtered by provider
CREATE INDEX IF NOT EXISTS idx_notif_push_user_active
  ON org_notif_push_subs_dtl (tenant_org_id, user_id, provider_code, is_active)
  WHERE is_active = true;

-- Stale-subscription sweep: find subscriptions to deactivate
CREATE INDEX IF NOT EXISTS idx_notif_push_stale_sweep
  ON org_notif_push_subs_dtl (tenant_org_id, is_active, last_verified_at);

-- General tenant filter for admin management queries
CREATE INDEX IF NOT EXISTS idx_notif_push_tenant
  ON org_notif_push_subs_dtl (tenant_org_id);

-- =============================================================================
-- 4. Row-Level Security
-- =============================================================================

ALTER TABLE org_notif_push_subs_dtl ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: all operations scoped to calling user's tenant.
-- Application layer additionally enforces user_id = current user for non-admin read/write.
CREATE POLICY tenant_isolation_org_notif_push_subs
  ON org_notif_push_subs_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- =============================================================================
-- 5. Comments
-- =============================================================================

COMMENT ON TABLE org_notif_push_subs_dtl IS
  'Provider-agnostic push subscription registry. One row per (tenant, user, device, provider). Upsert on unique key to handle token rotation.';

COMMENT ON COLUMN org_notif_push_subs_dtl.provider_code IS
  'FCM | VAPID | ONESIGNAL. Matches the active provider in org_ntf_channel_provider_cf for the PUSH channel.';

COMMENT ON COLUMN org_notif_push_subs_dtl.subscription_data IS
  'Provider-specific payload. VAPID: {endpoint, keys:{p256dh,auth}}. FCM: {token}. ONESIGNAL: {player_id}. Never contains API keys.';

COMMENT ON COLUMN org_notif_push_subs_dtl.failure_count IS
  'Consecutive provider errors. Push adapter sets is_active=false when >3 or on UNREGISTERED/INVALID error.';

-- =============================================================================
-- 6. Seed additional providers into sys_ntf_providers_cd
--    These were introduced alongside the provider-agnostic push design.
--    ON CONFLICT DO UPDATE makes this migration safe to re-run.
-- =============================================================================

INSERT INTO sys_ntf_providers_cd
  (code, channel_code, name, name2, description, description2,
   api_endpoint, webhook_path,
   supports_delivery_tracking, supports_read_receipt, max_message_length, display_order)
VALUES

  -- RESEND — email provider already in use by Phase 2 email adapter (RESEND_API_KEY)
  ('RESEND',
   'EMAIL',
   'Resend', 'Resend',
   'Transactional email via Resend API. Already integrated in Phase 2 email adapter.',
   'بريد إلكتروني عبر Resend API — مدمج في المرحلة الثانية',
   'https://api.resend.com/emails',
   '/api/notifications/webhooks/resend',
   true, false, NULL, 7),

  -- VAPID — browser Web Push API, no vendor account required
  -- subscription_data shape: { endpoint, keys: { p256dh, auth } }
  ('VAPID',
   'PUSH',
   'Web Push (VAPID)', 'Web Push (VAPID)',
   'Browser push notifications via the W3C Web Push standard (VAPID keys). No vendor dependency. Supported in Chrome, Firefox, Edge, and Safari (iOS 16.4+).',
   'إشعارات المتصفح عبر معيار Web Push (مفاتيح VAPID). بدون اعتماد على مزود خارجي.',
   NULL,
   '/api/notifications/webhooks/vapid',
   false, false, NULL, 8),

  -- ONESIGNAL — free tier push (web + mobile); REST API only on server side
  -- subscription_data shape: { player_id }
  ('ONESIGNAL',
   'PUSH',
   'OneSignal', 'OneSignal',
   'Cross-platform push notifications via OneSignal REST API. Free tier supports up to 10,000 subscribers with unlimited sends.',
   'إشعارات فورية عبر OneSignal. الطبقة المجانية تدعم حتى 10,000 مشترك.',
   'https://onesignal.com/api/v1/notifications',
   '/api/notifications/webhooks/onesignal',
   true, true, NULL, 9),

  -- META_WHATSAPP — direct Meta Cloud API (alternative to Twilio BSP)
  -- Use this when the tenant has their own Meta Business App credentials
  ('META_WHATSAPP',
   'WHATSAPP',
   'Meta WhatsApp Cloud API', 'واتساب Cloud API من Meta',
   'WhatsApp Business messaging via Meta Cloud API directly. Requires a Meta Business App with approved phone number.',
   'رسائل WhatsApp عبر Meta Cloud API مباشرة. يتطلب تطبيق Meta Business معتمد.',
   'https://graph.facebook.com/v18.0',
   '/api/notifications/webhooks/meta-whatsapp',
   true, true, 4096, 10)

ON CONFLICT (code) DO UPDATE SET
  name                       = EXCLUDED.name,
  name2                      = EXCLUDED.name2,
  description                = EXCLUDED.description,
  description2               = EXCLUDED.description2,
  api_endpoint               = EXCLUDED.api_endpoint,
  webhook_path               = EXCLUDED.webhook_path,
  supports_delivery_tracking = EXCLUDED.supports_delivery_tracking,
  supports_read_receipt      = EXCLUDED.supports_read_receipt,
  max_message_length         = EXCLUDED.max_message_length,
  updated_at                 = CURRENT_TIMESTAMP;

COMMIT;
