-- =============================================================================
-- 0346_ntf_templates_schema.sql
-- Purpose: Notification Hub – provider catalog and template system schema.
--          Creates sys_ntf_providers_cd, sys_ntf_templates_mst,
--          sys_ntf_template_ver_dtl, sys_ntf_template_chan_dtl.
--          Seeds provider records and Phase 1 IN_APP templates for
--          the 3 order events wired in Phase 1.
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-06
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. sys_ntf_providers_cd  (21 chars)
--    Global catalog of notification delivery providers.
--    No API keys or secrets stored here — only metadata.
--    Credentials live in environment variables / HQ secrets vault.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_ntf_providers_cd (
  code              TEXT PRIMARY KEY,             -- e.g. SENDGRID, FCM, INTERNAL
  channel_code      TEXT NOT NULL
                      REFERENCES sys_notification_channel_cd(code),
  name              TEXT NOT NULL,
  name2             TEXT,                          -- Arabic
  description       TEXT,
  description2      TEXT,                          -- Arabic
  api_endpoint      TEXT,                          -- Base URL for provider API (non-secret)
  webhook_path      TEXT,                          -- Path for delivery callbacks, e.g. /api/notifications/webhooks/sendgrid
  supports_delivery_tracking  BOOLEAN NOT NULL DEFAULT false,
  supports_read_receipt       BOOLEAN NOT NULL DEFAULT false,
  max_message_length          INTEGER,             -- NULL = unlimited
  display_order               INTEGER DEFAULT 0,

  -- Audit
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMP,
  updated_by    TEXT,
  updated_info  TEXT,
  rec_status    SMALLINT DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE sys_ntf_providers_cd IS
  'Notification delivery provider catalog. No secrets stored here — API keys live in env vars.';

COMMENT ON COLUMN sys_ntf_providers_cd.webhook_path IS
  'Relative path where this provider POSTs delivery/read callbacks, e.g. /api/notifications/webhooks/sendgrid';

-- Seed providers
INSERT INTO sys_ntf_providers_cd
  (code, channel_code, name, name2, description, description2,
   api_endpoint, webhook_path,
   supports_delivery_tracking, supports_read_receipt, max_message_length, display_order)
VALUES
  ('INTERNAL',
   'IN_APP',
   'Internal (In-App)', 'داخلي (داخل التطبيق)',
   'Direct database write to org_ntf_inbox_mst via Supabase Realtime',
   'كتابة مباشرة في قاعدة البيانات عبر Supabase Realtime',
   NULL, NULL, true, true, NULL, 1),

  ('SUPABASE_REALTIME',
   'WEB_SOCKET',
   'Supabase Realtime', 'Supabase Realtime',
   'Real-time browser push via Supabase Realtime postgres_changes subscription',
   'دفع فوري للمتصفح عبر Supabase Realtime',
   NULL, NULL, true, true, NULL, 2),

  ('SENDGRID',
   'EMAIL',
   'SendGrid', 'SendGrid',
   'Transactional and marketing email via SendGrid API v3',
   'بريد إلكتروني عبر SendGrid API v3',
   'https://api.sendgrid.com/v3/mail/send',
   '/api/notifications/webhooks/sendgrid',
   true, true, NULL, 3),

  ('TWILIO_SMS',
   'SMS',
   'Twilio SMS', 'Twilio SMS',
   'SMS delivery via Twilio Programmable Messaging API',
   'إرسال رسائل SMS عبر Twilio',
   'https://api.twilio.com/2010-04-01/Accounts',
   '/api/notifications/webhooks/twilio-sms',
   true, false, 160, 4),

  ('TWILIO_WHATSAPP',
   'WHATSAPP',
   'Twilio WhatsApp BSP', 'Twilio WhatsApp BSP',
   'WhatsApp Business messaging via Twilio as BSP (pre-approved templates only)',
   'رسائل WhatsApp عبر Twilio كمزود خدمة معتمد',
   'https://api.twilio.com/2010-04-01/Accounts',
   '/api/notifications/webhooks/twilio-whatsapp',
   true, true, 4096, 5),

  ('FCM',
   'PUSH',
   'Firebase Cloud Messaging', 'Firebase Cloud Messaging',
   'Mobile and web push notifications via FCM v1 HTTP API',
   'إشعارات فورية عبر Firebase Cloud Messaging',
   'https://fcm.googleapis.com/v1/projects',
   '/api/notifications/webhooks/fcm',
   true, false, 200, 6)

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

-- =============================================================================
-- 2. sys_ntf_templates_mst  (21 chars)
--    One template per event (the "envelope"). Versioned content lives in
--    sys_ntf_template_ver_dtl; channel-specific rendering in
--    sys_ntf_template_chan_dtl.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_ntf_templates_mst (
  template_code     TEXT PRIMARY KEY,             -- e.g. 'order.ready.default'
  event_code        TEXT NOT NULL
                      REFERENCES sys_ntf_events_cd(code),
  name              TEXT NOT NULL,
  name2             TEXT,                          -- Arabic
  description       TEXT,
  description2      TEXT,                          -- Arabic
  is_system         BOOLEAN NOT NULL DEFAULT true, -- system templates cannot be deleted

  -- Audit
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMP,
  updated_by    TEXT,
  updated_info  TEXT,
  rec_status    SMALLINT DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ntf_tmpl_event
  ON sys_ntf_templates_mst (event_code, is_active);

COMMENT ON TABLE sys_ntf_templates_mst IS
  'Notification template headers – one per event. Content versioned in sys_ntf_template_ver_dtl.';

-- =============================================================================
-- 3. sys_ntf_template_ver_dtl  (25 chars)
--    Versioned content for each template.
--    Only one APPROVED version should be active per template at a time.
--    Lifecycle: DRAFT → APPROVED → RETIRED
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_ntf_template_ver_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code   TEXT NOT NULL
                    REFERENCES sys_ntf_templates_mst(template_code),
  version_number  INTEGER NOT NULL DEFAULT 1,

  -- Template content (bilingual)
  subject         TEXT,                            -- EN subject line
  subject2        TEXT,                            -- Arabic subject line
  body            TEXT NOT NULL,                   -- EN body (Handlebars / plain text)
  body2           TEXT,                            -- Arabic body

  -- Versioning lifecycle
  status          TEXT NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','APPROVED','RETIRED')),
  approved_by     TEXT,
  approved_at     TIMESTAMP,
  retired_at      TIMESTAMP,

  -- Audit
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMP,
  updated_by    TEXT,
  updated_info  TEXT,
  rec_status    SMALLINT DEFAULT 1,
  rec_notes     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,

  UNIQUE (template_code, version_number)
);

CREATE INDEX IF NOT EXISTS idx_ntf_tver_template
  ON sys_ntf_template_ver_dtl (template_code, status, is_active);

COMMENT ON TABLE sys_ntf_template_ver_dtl IS
  'Versioned notification template content. DRAFT → APPROVED → RETIRED lifecycle.';

COMMENT ON COLUMN sys_ntf_template_ver_dtl.body IS
  'Template body using Handlebars syntax, e.g. "Your order {{order_number}} is ready."';

-- =============================================================================
-- 4. sys_ntf_template_chan_dtl  (25 chars)
--    Per-channel rendering overrides.
--    Some channels need different content (e.g. WhatsApp requires pre-approved
--    template names, SMS needs truncated text, email needs HTML).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys_ntf_template_chan_dtl (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID NOT NULL
                        REFERENCES sys_ntf_template_ver_dtl(id),
  channel_code        TEXT NOT NULL
                        REFERENCES sys_notification_channel_cd(code),

  -- Channel-specific content overrides (bilingual)
  rendered_subject    TEXT,
  rendered_subject2   TEXT,
  rendered_body       TEXT NOT NULL,               -- channel-formatted body
  rendered_body2      TEXT,

  -- Channel-specific metadata
  -- For WHATSAPP: {"template_name": "cmx_order_ready", "language": "en", "components": [...]}
  -- For EMAIL:    {"from_name": "CleanMateX", "reply_to": "support@cleanmatex.com"}
  -- For PUSH:     {"sound": "default", "badge": 1, "image_url": "..."}
  metadata            JSONB,

  -- Audit
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMP,
  updated_by    TEXT,
  updated_info  TEXT,
  rec_status    SMALLINT DEFAULT 1,
  rec_notes     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,

  UNIQUE (template_version_id, channel_code)
);

CREATE INDEX IF NOT EXISTS idx_ntf_tchan_version
  ON sys_ntf_template_chan_dtl (template_version_id, channel_code, is_active);

COMMENT ON TABLE sys_ntf_template_chan_dtl IS
  'Per-channel rendering overrides for a template version. WhatsApp needs approved template names; email needs HTML; SMS needs truncated text.';

-- =============================================================================
-- 5. Seed Phase 1 templates (IN_APP channel only)
--    Three system templates for the events wired in Phase 1:
--    order.created, order.ready, order.cancelled
-- =============================================================================

-- 5a. Template headers
INSERT INTO sys_ntf_templates_mst
  (template_code, event_code, name, name2, description, description2, is_system)
VALUES
  ('order.created.default',   'order.created',   'Order Created',   'تم إنشاء الطلب',   'Default in-app template for order.created event',   'قالب افتراضي لحدث إنشاء الطلب',   true),
  ('order.ready.default',     'order.ready',     'Order Ready',     'الطلب جاهز',       'Default in-app template for order.ready event',     'قالب افتراضي لحدث جاهزية الطلب',  true),
  ('order.cancelled.default', 'order.cancelled', 'Order Cancelled', 'الطلب ملغى',       'Default in-app template for order.cancelled event', 'قالب افتراضي لحدث إلغاء الطلب',   true)
ON CONFLICT (template_code) DO UPDATE SET
  name         = EXCLUDED.name,
  name2        = EXCLUDED.name2,
  description  = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  updated_at   = CURRENT_TIMESTAMP;

-- 5b. Template versions (v1, APPROVED)
INSERT INTO sys_ntf_template_ver_dtl
  (template_code, version_number,
   subject, subject2,
   body, body2,
   status, approved_by, approved_at)
VALUES
  ('order.created.default', 1,
   'New Order #{{order_number}}',
   'طلب جديد رقم #{{order_number}}',
   'Order #{{order_number}} has been created and will be ready by {{estimated_ready_at}}.',
   'تم إنشاء الطلب رقم #{{order_number}} وسيكون جاهزًا بحلول {{estimated_ready_at}}.',
   'APPROVED', 'system', CURRENT_TIMESTAMP),

  ('order.ready.default', 1,
   'Your Order #{{order_number}} is Ready',
   'طلبك رقم #{{order_number}} جاهز',
   'Order #{{order_number}} is ready for pickup at {{branch_name}}.',
   'الطلب رقم #{{order_number}} جاهز للاستلام من {{branch_name}}.',
   'APPROVED', 'system', CURRENT_TIMESTAMP),

  ('order.cancelled.default', 1,
   'Order #{{order_number}} Cancelled',
   'تم إلغاء الطلب رقم #{{order_number}}',
   'Order #{{order_number}} has been cancelled. {{#if refund_amount}}A refund of {{refund_amount}} {{currency}} will be processed.{{/if}}',
   'تم إلغاء الطلب رقم #{{order_number}}. {{#if refund_amount}}سيتم معالجة استرداد بقيمة {{refund_amount}} {{currency}}.{{/if}}',
   'APPROVED', 'system', CURRENT_TIMESTAMP)

ON CONFLICT (template_code, version_number) DO UPDATE SET
  subject      = EXCLUDED.subject,
  subject2     = EXCLUDED.subject2,
  body         = EXCLUDED.body,
  body2        = EXCLUDED.body2,
  status       = EXCLUDED.status,
  approved_at  = EXCLUDED.approved_at,
  updated_at   = CURRENT_TIMESTAMP;

-- 5c. IN_APP channel rendering for each template version
-- We reference version IDs via a sub-select to stay idempotent
INSERT INTO sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_body, rendered_body2, metadata)
SELECT
  v.id,
  'IN_APP',
  v.body,
  v.body2,
  '{"display_icon": true, "action_label": "View Order", "action_label2": "عرض الطلب"}'::jsonb
FROM sys_ntf_template_ver_dtl v
WHERE v.template_code IN (
  'order.created.default',
  'order.ready.default',
  'order.cancelled.default'
)
AND v.version_number = 1
ON CONFLICT (template_version_id, channel_code) DO UPDATE SET
  rendered_body  = EXCLUDED.rendered_body,
  rendered_body2 = EXCLUDED.rendered_body2,
  metadata       = EXCLUDED.metadata,
  updated_at     = CURRENT_TIMESTAMP;

COMMIT;
