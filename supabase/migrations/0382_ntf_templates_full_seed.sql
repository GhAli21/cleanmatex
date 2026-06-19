-- =============================================================================
-- 0382_ntf_templates_full_seed.sql
-- Purpose: (0) Complete sys_ntf_event_chan_map for all 115 events with
--          category-appropriate channels; (1–3) seed default templates and
--          per-channel rendering for every event × channel pair.
--          Extends Phase 1 seed in 0346 (order.created/ready/cancelled IN_APP).
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-18
-- Idempotent: ON CONFLICT DO UPDATE throughout.
-- Apply after: 0344, 0345, 0346
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. Complete sys_ntf_event_chan_map (0345 baseline + gap-fill)
--    Rules derive is_default / can_override from event priority and audience.
--    URGENT / CRITICAL events: can_override = false (tenant cannot silence).
-- =============================================================================

-- 0a. IN_APP — every active event (staff bell + in-app feed)
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
SELECT
  e.code,
  'IN_APP',
  true,
  CASE WHEN e.priority IN ('URGENT', 'CRITICAL') THEN false ELSE true END
FROM sys_ntf_events_cd e
WHERE e.is_active = true
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  is_active    = true,
  updated_at   = CURRENT_TIMESTAMP;

-- 0b. PUSH — operational alerts (exclude marketing recipient analytics)
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
SELECT
  e.code,
  'PUSH',
  true,
  CASE WHEN e.priority IN ('URGENT', 'CRITICAL') THEN false ELSE true END
FROM sys_ntf_events_cd e
WHERE e.is_active = true
  AND (
    e.category_code IN (
      'ORDER', 'ORDER_ITEM', 'PREPARATION', 'PROCESSING', 'ASSEMBLY', 'QA', 'PACKING',
      'PICKUP', 'DELIVERY', 'PAYMENT', 'REFUND', 'CUSTOMER', 'LOYALTY', 'WALLET',
      'GIFTCARD', 'MEMBERSHIP', 'WORKFLOW', 'STAFF', 'INVENTORY', 'MACHINE',
      'SUBSCRIPTION', 'PLAN_LIMIT', 'SECURITY', 'SYSTEM'
    )
    OR (
      e.category_code = 'MARKETING'
      AND e.code NOT LIKE 'campaign.recipient.%'
    )
  )
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  is_active    = true,
  updated_at   = CURRENT_TIMESTAMP;

-- 0c. WHATSAPP — customer / tenant transactional outbound (Meta template required)
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
SELECT
  e.code,
  'WHATSAPP',
  true,
  CASE
    WHEN e.priority IN ('URGENT', 'CRITICAL') THEN false
    WHEN e.requires_consent = true THEN false
    ELSE true
  END
FROM sys_ntf_events_cd e
WHERE e.is_active = true
  AND e.code NOT LIKE 'campaign.%'
  AND e.category_code NOT IN (
    'STAFF', 'INVENTORY', 'MACHINE', 'WORKFLOW',
    'PROCESSING', 'ASSEMBLY', 'QA', 'PACKING', 'PREPARATION',
    'MARKETING', 'SYSTEM', 'PLAN_LIMIT', 'SECURITY'
  )
  AND (
    'customer' = ANY (e.default_recipients)
    OR e.category_code IN ('SUBSCRIPTION', 'STATEMENT', 'INVOICE')
    OR e.code = 'credit_note.issued'
  )
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  is_active    = true,
  updated_at   = CURRENT_TIMESTAMP;

-- 0d. EMAIL — receipts, financial docs, security, tenant admin, customer lifecycle
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
SELECT
  e.code,
  'EMAIL',
  true,
  CASE WHEN e.priority IN ('URGENT', 'CRITICAL') THEN false ELSE true END
FROM sys_ntf_events_cd e
WHERE e.is_active = true
  AND (
    e.category_code IN (
      'PAYMENT', 'REFUND', 'INVOICE', 'STATEMENT',
      'SECURITY', 'SYSTEM', 'SUBSCRIPTION', 'PLAN_LIMIT',
      'STAFF', 'INVENTORY', 'MACHINE'
    )
    OR e.category_code IN ('CUSTOMER', 'LOYALTY', 'WALLET', 'GIFTCARD', 'MEMBERSHIP')
    OR e.code = 'credit_note.issued'
    OR (
      e.category_code IN ('ORDER', 'ORDER_ITEM', 'PICKUP', 'DELIVERY', 'PREPARATION')
      AND 'customer' = ANY (e.default_recipients)
    )
    OR (
      e.category_code = 'MARKETING'
      AND e.code IN (
        'campaign.approved', 'campaign.launched',
        'campaign.completed', 'campaign.failed'
      )
    )
  )
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  is_active    = true,
  updated_at   = CURRENT_TIMESTAMP;

-- 0e. SMS — high-urgency customer touchpoints only (cost-sensitive channel)
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
SELECT
  e.code,
  'SMS',
  true,
  false
FROM sys_ntf_events_cd e
WHERE e.is_active = true
  AND e.code IN (
    'order.created',
    'order.ready',
    'order.delayed',
    'order.item.missing',
    'pickup.scheduled',
    'pickup.reminder',
    'delivery.assigned',
    'delivery.out_for_delivery',
    'delivery.otp_generated',
    'delivery.arrived',
    'delivery.failed',
    'payment.requested',
    'payment.failed',
    'payment.collection_due',
    'statement.overdue',
    'customer.stub.created',
    'membership.renewal_due'
  )
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  is_active    = true,
  updated_at   = CURRENT_TIMESTAMP;

-- =============================================================================
-- 1. Template headers — one default template per event
-- =============================================================================

INSERT INTO sys_ntf_templates_mst
  (template_code, event_code, name, name2, description, description2, is_system)
SELECT
  e.code || '.default',
  e.code,
  e.name,
  e.name2,
  'Default system template for ' || e.code,
  'قالب افتراضي لحدث ' || e.code,
  true
FROM sys_ntf_events_cd e
WHERE e.is_active = true
ON CONFLICT (template_code) DO UPDATE SET
  name         = EXCLUDED.name,
  name2        = EXCLUDED.name2,
  description  = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  updated_at   = CURRENT_TIMESTAMP;

-- =============================================================================
-- 2. Template versions (v1 APPROVED) — skip events already seeded in 0346
-- =============================================================================

INSERT INTO sys_ntf_template_ver_dtl
  (template_code, version_number, subject, subject2, body, body2, status, approved_by, approved_at)
SELECT
  e.code || '.default',
  1,
  -- EN subject
  CASE
    WHEN e.code LIKE 'order.%'
      OR e.code LIKE 'order.item.%'
      OR e.code LIKE 'workflow.%'
      OR e.code LIKE 'delivery.%'
      OR e.code LIKE 'pickup.%'
      OR e.code LIKE 'payment.%'
      OR e.code LIKE 'refund.%'
      THEN e.name || ' #{{order_number}}'
    WHEN e.code LIKE 'invoice.%' OR e.code = 'credit_note.issued'
      THEN e.name || ' #{{invoice_number}}'
    WHEN e.code LIKE 'statement.%'
      THEN e.name || ' #{{statement_number}}'
    WHEN e.code LIKE 'campaign.%'
      THEN e.name || ' — {{campaign_name}}'
    ELSE e.name
  END,
  -- AR subject
  CASE
    WHEN e.code LIKE 'order.%'
      OR e.code LIKE 'order.item.%'
      OR e.code LIKE 'workflow.%'
      OR e.code LIKE 'delivery.%'
      OR e.code LIKE 'pickup.%'
      OR e.code LIKE 'payment.%'
      OR e.code LIKE 'refund.%'
      THEN e.name2 || ' #{{order_number}}'
    WHEN e.code LIKE 'invoice.%' OR e.code = 'credit_note.issued'
      THEN e.name2 || ' #{{invoice_number}}'
    WHEN e.code LIKE 'statement.%'
      THEN e.name2 || ' #{{statement_number}}'
    WHEN e.code LIKE 'campaign.%'
      THEN e.name2 || ' — {{campaign_name}}'
    ELSE e.name2
  END,
  -- EN body — event-specific overrides, then category fallback
  COALESCE(
    CASE e.code
      WHEN 'order.quick_drop.created' THEN
        'Quick-drop order #{{order_number}} accepted. We will itemize your items shortly.'
      WHEN 'order.preparation.required' THEN
        'Order #{{order_number}} needs itemization before processing can begin.'
      WHEN 'order.prepared' THEN
        'Order #{{order_number}} has been itemized and is ready for processing.'
      WHEN 'order.processing.started' THEN
        'Order #{{order_number}} has entered processing at {{branch_name}}.'
      WHEN 'order.delayed' THEN
        'Update on order #{{order_number}}: there is a delay. New estimated ready time: {{estimated_ready_at}}.'
      WHEN 'order.closed' THEN
        'Order #{{order_number}} is now closed. Thank you for choosing CleanMateX.'
      WHEN 'order.priority.changed' THEN
        'Priority for order #{{order_number}} has been updated to {{priority}}.'
      WHEN 'order.split.created' THEN
        'Order #{{order_number}} was split. New sub-order: #{{sub_order_number}}.'
      WHEN 'order.issue.created' THEN
        'An issue was logged for order #{{order_number}}: {{issue_summary}}.'
      WHEN 'order.issue.resolved' THEN
        'The issue on order #{{order_number}} has been resolved.'
      WHEN 'delivery.otp_generated' THEN
        'Your delivery OTP for order #{{order_number}} is {{otp_code}}. Share it with the driver upon delivery.'
      WHEN 'delivery.arrived' THEN
        'Your driver has arrived for order #{{order_number}}.'
      WHEN 'delivery.out_for_delivery' THEN
        'Order #{{order_number}} is out for delivery.'
      WHEN 'delivery.delivered' THEN
        'Order #{{order_number}} has been delivered. Thank you!'
      WHEN 'delivery.failed' THEN
        'Delivery attempt for order #{{order_number}} failed. Reason: {{failure_reason}}.'
      WHEN 'pickup.reminder' THEN
        'Reminder: pickup for order #{{order_number}} is scheduled at {{pickup_time}}.'
      WHEN 'payment.received' THEN
        'Payment confirmed for order #{{order_number}}. Amount: {{amount}} {{currency}}.'
      WHEN 'payment.failed' THEN
        'Payment for order #{{order_number}} failed. Please try again or contact us.'
      WHEN 'payment.partial_received' THEN
        'Partial payment received for order #{{order_number}}. Amount: {{amount}} {{currency}}.'
      WHEN 'payment.collection_due' THEN
        'Payment of {{amount}} {{currency}} for order #{{order_number}} is due on collection.'
      WHEN 'refund.processed' THEN
        'Refund of {{refund_amount}} {{currency}} for order #{{order_number}} has been processed.'
      WHEN 'statement.overdue' THEN
        'Statement #{{statement_number}} is overdue. Amount due: {{amount_due}} {{currency}}.'
      WHEN 'security.suspicious_activity' THEN
        'Suspicious activity detected on your account. Please review recent activity immediately.'
      ELSE NULL
    END,
    CASE e.category_code
      WHEN 'ORDER' THEN 'Order #{{order_number}}: ' || e.description
      WHEN 'ORDER_ITEM' THEN 'Order #{{order_number}} item update: ' || e.description
      WHEN 'PREPARATION' THEN 'Order #{{order_number}}: ' || e.description
      WHEN 'PROCESSING' THEN 'Order #{{order_number}}: ' || e.description
      WHEN 'ASSEMBLY' THEN 'Order #{{order_number}} assembly: ' || e.description
      WHEN 'QA' THEN 'Order #{{order_number}} QA: ' || e.description
      WHEN 'PACKING' THEN 'Order #{{order_number}}: ' || e.description
      WHEN 'PICKUP' THEN 'Order #{{order_number}} pickup: ' || e.description
      WHEN 'DELIVERY' THEN 'Order #{{order_number}} delivery: ' || e.description
      WHEN 'PAYMENT' THEN 'Order #{{order_number}} payment: ' || e.description || ' Amount: {{amount}} {{currency}}.'
      WHEN 'REFUND' THEN 'Order #{{order_number}} refund: ' || e.description
      WHEN 'INVOICE' THEN e.description || ' Document #{{invoice_number}}.'
      WHEN 'STATEMENT' THEN e.description || ' Statement #{{statement_number}}.'
      WHEN 'LOYALTY' THEN e.description || ' Points: {{points}}.'
      WHEN 'WALLET' THEN e.description || ' Balance: {{balance}} {{currency}}.'
      WHEN 'GIFTCARD' THEN e.description || ' Code: {{gift_card_code}}.'
      WHEN 'INVENTORY' THEN e.description || ' Item: {{item_name}}.'
      WHEN 'MACHINE' THEN e.description || ' Machine: {{machine_name}}.'
      WHEN 'MARKETING' THEN e.description || ' Campaign: {{campaign_name}}.'
      WHEN 'WORKFLOW' THEN 'Order #{{order_number}} workflow: ' || e.description
      ELSE e.description
    END
  ),
  -- AR body
  COALESCE(
    CASE e.code
      WHEN 'order.quick_drop.created' THEN
        'تم قبول الطلب السريع رقم #{{order_number}}. سنجرد العناصر قريبًا.'
      WHEN 'order.preparation.required' THEN
        'الطلب رقم #{{order_number}} يحتاج إلى جرد قبل بدء المعالجة.'
      WHEN 'order.prepared' THEN
        'تم جرد الطلب رقم #{{order_number}} وهو جاهز للمعالجة.'
      WHEN 'order.processing.started' THEN
        'دخل الطلب رقم #{{order_number}} مرحلة المعالجة في {{branch_name}}.'
      WHEN 'order.delayed' THEN
        'تحديث بشأن طلبك رقم #{{order_number}}: هناك تأخير. الموعد الجديد المتوقع: {{estimated_ready_at}}.'
      WHEN 'order.closed' THEN
        'تم إغلاق الطلب رقم #{{order_number}}. شكرًا لاختيارك CleanMateX.'
      WHEN 'order.priority.changed' THEN
        'تم تحديث أولوية الطلب رقم #{{order_number}} إلى {{priority}}.'
      WHEN 'order.split.created' THEN
        'تم تقسيم الطلب رقم #{{order_number}}. الطلب الفرعي الجديد: #{{sub_order_number}}.'
      WHEN 'order.issue.created' THEN
        'تم تسجيل مشكلة للطلب رقم #{{order_number}}: {{issue_summary}}.'
      WHEN 'order.issue.resolved' THEN
        'تم حل المشكلة على الطلب رقم #{{order_number}}.'
      WHEN 'delivery.otp_generated' THEN
        'رمز التحقق للتوصيل للطلب رقم #{{order_number}} هو {{otp_code}}.'
      WHEN 'delivery.arrived' THEN
        'وصل السائق لتوصيل الطلب رقم #{{order_number}}.'
      WHEN 'delivery.out_for_delivery' THEN
        'الطلب رقم #{{order_number}} في طريق التوصيل.'
      WHEN 'delivery.delivered' THEN
        'تم تسليم الطلب رقم #{{order_number}}. شكرًا لك!'
      WHEN 'delivery.failed' THEN
        'فشلت محاولة توصيل الطلب رقم #{{order_number}}. السبب: {{failure_reason}}.'
      WHEN 'pickup.reminder' THEN
        'تذكير: استلام الطلب رقم #{{order_number}} مجدول في {{pickup_time}}.'
      WHEN 'payment.received' THEN
        'تم تأكيد الدفع للطلب رقم #{{order_number}}. المبلغ: {{amount}} {{currency}}.'
      WHEN 'payment.failed' THEN
        'فشل الدفع للطلب رقم #{{order_number}}. يرجى المحاولة مرة أخرى أو التواصل معنا.'
      WHEN 'payment.partial_received' THEN
        'تم استلام دفع جزئي للطلب رقم #{{order_number}}. المبلغ: {{amount}} {{currency}}.'
      WHEN 'payment.collection_due' THEN
        'مبلغ {{amount}} {{currency}} للطلب رقم #{{order_number}} مستحق عند الاستلام.'
      WHEN 'refund.processed' THEN
        'تمت معالجة استرداد {{refund_amount}} {{currency}} للطلب رقم #{{order_number}}.'
      WHEN 'statement.overdue' THEN
        'كشف الحساب رقم #{{statement_number}} متأخر. المبلغ المستحق: {{amount_due}} {{currency}}.'
      WHEN 'security.suspicious_activity' THEN
        'تم اكتشاف نشاط مشبوه على حسابك. يرجى مراجعة النشاط الأخير فورًا.'
      ELSE NULL
    END,
    CASE e.category_code
      WHEN 'ORDER' THEN 'الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'ORDER_ITEM' THEN 'تحديث عنصر للطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'PREPARATION' THEN 'الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'PROCESSING' THEN 'الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'ASSEMBLY' THEN 'تجميع الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'QA' THEN 'جودة الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'PACKING' THEN 'الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'PICKUP' THEN 'استلام الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'DELIVERY' THEN 'توصيل الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'PAYMENT' THEN 'دفع الطلب رقم #{{order_number}}: ' || e.description2 || ' المبلغ: {{amount}} {{currency}}.'
      WHEN 'REFUND' THEN 'استرداد الطلب رقم #{{order_number}}: ' || e.description2
      WHEN 'INVOICE' THEN e.description2 || ' المستند رقم #{{invoice_number}}.'
      WHEN 'STATEMENT' THEN e.description2 || ' الكشف رقم #{{statement_number}}.'
      WHEN 'LOYALTY' THEN e.description2 || ' النقاط: {{points}}.'
      WHEN 'WALLET' THEN e.description2 || ' الرصيد: {{balance}} {{currency}}.'
      WHEN 'GIFTCARD' THEN e.description2 || ' الرمز: {{gift_card_code}}.'
      WHEN 'INVENTORY' THEN e.description2 || ' العنصر: {{item_name}}.'
      WHEN 'MACHINE' THEN e.description2 || ' الآلة: {{machine_name}}.'
      WHEN 'MARKETING' THEN e.description2 || ' الحملة: {{campaign_name}}.'
      WHEN 'WORKFLOW' THEN 'مسار الطلب رقم #{{order_number}}: ' || e.description2
      ELSE e.description2
    END
  ),
  'APPROVED',
  'system',
  CURRENT_TIMESTAMP
FROM sys_ntf_events_cd e
WHERE e.is_active = true
  AND e.code NOT IN ('order.created', 'order.ready', 'order.cancelled')
ON CONFLICT (template_code, version_number) DO UPDATE SET
  subject     = EXCLUDED.subject,
  subject2    = EXCLUDED.subject2,
  body        = EXCLUDED.body,
  body2       = EXCLUDED.body2,
  status      = EXCLUDED.status,
  approved_at = EXCLUDED.approved_at,
  updated_at  = CURRENT_TIMESTAMP;

-- =============================================================================
-- 3. Per-channel rendering — all event × channel mappings from catalog
-- =============================================================================

INSERT INTO sys_ntf_template_chan_dtl
  (template_version_id, channel_code, rendered_subject, rendered_subject2, rendered_body, rendered_body2, metadata)
SELECT
  v.id,
  m.channel_code,
  v.subject,
  v.subject2,
  CASE m.channel_code
    WHEN 'WHATSAPP' THEN
      COALESCE(
        CASE t.event_code
          WHEN 'order.ready' THEN
            'Your order #{{order_number}} is ready for pickup at {{branch_name}}.'
          WHEN 'order.cancelled' THEN
            'Your order #{{order_number}} has been cancelled. Reason: {{cancellation_reason}}'
          WHEN 'order.delayed' THEN
            'Update on your order #{{order_number}}: There is a delay. New estimated ready time: {{estimated_ready_at}}'
          WHEN 'payment.received' THEN
            'Payment confirmed. Amount: {{currency}} {{amount}}. Order: #{{order_number}}.'
          WHEN 'payment.requested' THEN
            'Friendly reminder: Your payment of {{currency}} {{amount}} for order #{{order_number}} is due.'
          WHEN 'payment.collection_due' THEN
            'Friendly reminder: Your payment of {{currency}} {{amount}} for order #{{order_number}} is due.'
          WHEN 'order.created' THEN
            'Order #{{order_number}} tracking update. Estimated ready: {{date}}.'
          ELSE NULL
        END,
        v.body
      )
    WHEN 'SMS' THEN LEFT(v.body, 160)
    ELSE v.body
  END,
  CASE m.channel_code
    WHEN 'WHATSAPP' THEN
      COALESCE(
        CASE t.event_code
          WHEN 'order.ready' THEN
            'طلبك رقم #{{order_number}} جاهز للاستلام في {{branch_name}}.'
          WHEN 'order.cancelled' THEN
            'تم إلغاء طلبك رقم #{{order_number}}. السبب: {{cancellation_reason}}'
          WHEN 'order.delayed' THEN
            'تحديث بشأن طلبك رقم #{{order_number}}: هناك تأخير. الموعد الجديد: {{estimated_ready_at}}'
          WHEN 'payment.received' THEN
            'تم تأكيد الدفع. المبلغ: {{currency}} {{amount}}. الطلب: #{{order_number}}.'
          WHEN 'payment.requested' THEN
            'تذكير: دفعتك {{currency}} {{amount}} للطلب رقم #{{order_number}} مستحقة.'
          WHEN 'payment.collection_due' THEN
            'تذكير: دفعتك {{currency}} {{amount}} للطلب رقم #{{order_number}} مستحقة.'
          WHEN 'order.created' THEN
            'تحديث تتبع الطلب رقم #{{order_number}}. الجاهزية المتوقعة: {{date}}.'
          ELSE NULL
        END,
        v.body2
      )
    WHEN 'SMS' THEN LEFT(COALESCE(v.body2, v.body), 160)
    ELSE COALESCE(v.body2, v.body)
  END,
  CASE m.channel_code
    WHEN 'IN_APP' THEN
      jsonb_build_object(
        'display_icon', true,
        'action_label', 'View',
        'action_label2', 'عرض'
      )
    WHEN 'EMAIL' THEN
      jsonb_build_object(
        'from_name', 'CleanMateX',
        'reply_to', 'support@cleanmatex.com'
      )
    WHEN 'PUSH' THEN
      jsonb_build_object(
        'sound', 'default',
        'badge', 1
      )
    WHEN 'WHATSAPP' THEN
      CASE t.event_code
        WHEN 'order.ready' THEN
          '{"template_name":"cmx_order_ready","language":"en","variable_map":{"1":"order_number","2":"branch_name"}}'::jsonb
        WHEN 'order.cancelled' THEN
          '{"template_name":"cmx_order_cancelled","language":"en","variable_map":{"1":"order_number","2":"cancellation_reason"}}'::jsonb
        WHEN 'order.delayed' THEN
          '{"template_name":"cmx_order_delayed","language":"en","variable_map":{"1":"order_number","2":"estimated_ready_at"}}'::jsonb
        WHEN 'payment.received' THEN
          '{"template_name":"cmx_payment_received","language":"en","variable_map":{"1":"currency","2":"amount","3":"order_number"}}'::jsonb
        WHEN 'payment.requested' THEN
          '{"template_name":"cmx_payment_reminder","language":"en","variable_map":{"1":"currency","2":"amount","3":"order_number"}}'::jsonb
        WHEN 'payment.collection_due' THEN
          '{"template_name":"cmx_payment_reminder","language":"en","variable_map":{"1":"currency","2":"amount","3":"order_number"}}'::jsonb
        WHEN 'order.created' THEN
          '{"template_name":"notification_order_tracking","language":"en","content_variable_map":{"order_number":"$order_number","date":"$date"},"pending_meta_approval":true}'::jsonb
        ELSE
          '{"language":"en","pending_meta_approval":true}'::jsonb
      END
    WHEN 'SMS' THEN '{}'::jsonb
    ELSE '{}'::jsonb
  END
FROM sys_ntf_event_chan_map m
JOIN sys_ntf_templates_mst t
  ON t.event_code = m.event_code
 AND t.is_active = true
JOIN sys_ntf_template_ver_dtl v
  ON v.template_code = t.template_code
 AND v.version_number = 1
 AND v.status = 'APPROVED'
 AND v.is_active = true
WHERE m.is_active = true
  AND NOT (
    t.event_code IN ('order.created', 'order.ready', 'order.cancelled')
    AND m.channel_code = 'IN_APP'
  )
ON CONFLICT (template_version_id, channel_code) DO UPDATE SET
  rendered_subject  = EXCLUDED.rendered_subject,
  rendered_subject2 = EXCLUDED.rendered_subject2,
  rendered_body     = EXCLUDED.rendered_body,
  rendered_body2    = EXCLUDED.rendered_body2,
  metadata          = EXCLUDED.metadata,
  updated_at        = CURRENT_TIMESTAMP;

COMMIT;
