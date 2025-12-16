-- ==================================================================
-- 0053_notifications_tables.sql
-- Purpose: Create Notifications code tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates code tables for notifications:
-- 1. sys_notification_type_cd - Notification types
-- 2. sys_notification_channel_cd - Notification channels
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_notification_type_cd
-- Purpose: Notification type codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_notification_type_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Notification Configuration
  notification_category VARCHAR(50),                -- 'order', 'payment', 'system', 'marketing', 'reminder'
  priority VARCHAR(20),                             -- 'low', 'normal', 'high', 'urgent'
  requires_action BOOLEAN DEFAULT false,             -- Requires user action?
  auto_send BOOLEAN DEFAULT true,                   -- Auto-send or manual?

  -- Template
  default_template_code VARCHAR(50),                -- Reference to notification template
  default_subject TEXT,                             -- Default subject line
  default_body_template TEXT,                       -- Default body template

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System notification types cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "channels": ["EMAIL", "SMS", "PUSH"],
      "delay_minutes": 0,
      "retry_attempts": 3,
      "expires_hours": 24,
      "requires_read_receipt": false
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_notification_type_active
  ON sys_notification_type_cd(is_active, display_order);

CREATE INDEX idx_notification_type_category
  ON sys_notification_type_cd(notification_category, is_active);

CREATE INDEX idx_notification_type_priority
  ON sys_notification_type_cd(priority, is_active);

-- Comments
COMMENT ON TABLE sys_notification_type_cd IS
  'Notification type codes (ORDER_READY, PAYMENT_RECEIVED, etc.)';

COMMENT ON COLUMN sys_notification_type_cd.code IS
  'Unique notification type code (e.g., ORDER_READY, PAYMENT_RECEIVED)';

COMMENT ON COLUMN sys_notification_type_cd.priority IS
  'Notification priority (low, normal, high, urgent)';

-- ==================================================================
-- TABLE: sys_notification_channel_cd
-- Purpose: Notification channel codes
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_notification_channel_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Channel Configuration
  channel_type VARCHAR(20),                        -- 'email', 'sms', 'push', 'whatsapp', 'in_app'
  requires_configuration BOOLEAN DEFAULT true,     -- Requires external service config?
  supports_rich_content BOOLEAN DEFAULT false,    -- Supports HTML/rich content?
  supports_attachments BOOLEAN DEFAULT false,      -- Supports file attachments?
  max_length INTEGER,                               -- Maximum message length (for SMS, etc.)

  -- Cost & Limits
  cost_per_message DECIMAL(10,4),                  -- Cost per message (if applicable)
  daily_limit INTEGER,                              -- Daily sending limit (NULL = unlimited)
  rate_limit_per_minute INTEGER,                   -- Rate limit per minute

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System channels cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "provider": "twilio" | "sendgrid" | "firebase",
      "api_endpoint": "https://api.example.com/send",
      "webhook_url": "https://platform.cleanmatex.com/webhooks/notifications",
      "delivery_tracking": true,
      "read_receipt_supported": false
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_notification_channel_active
  ON sys_notification_channel_cd(is_active, display_order);

CREATE INDEX idx_notification_channel_type
  ON sys_notification_channel_cd(channel_type, is_active);

-- Comments
COMMENT ON TABLE sys_notification_channel_cd IS
  'Notification channel codes (EMAIL, SMS, WHATSAPP, PUSH, IN_APP)';

COMMENT ON COLUMN sys_notification_channel_cd.code IS
  'Unique channel code (e.g., EMAIL, SMS, WHATSAPP, PUSH, IN_APP)';

COMMENT ON COLUMN sys_notification_channel_cd.channel_type IS
  'Channel type (email, sms, push, whatsapp, in_app)';

-- ==================================================================
-- SEED DATA: sys_notification_type_cd
-- ==================================================================

INSERT INTO sys_notification_type_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  notification_category,
  priority,
  requires_action,
  auto_send,
  default_subject,
  default_body_template,
  is_system,
  is_active,
  metadata
) VALUES
  -- Order Notifications
  (
    'ORDER_READY',
    'Order Ready',
    'الطلب جاهز',
    'Notification when order is ready for pickup',
    'إشعار عندما يكون الطلب جاهزاً للاستلام',
    1,
    'package-check',
    '#10B981',
    'order',
    'high',
    true,
    true,
    'Your order is ready for pickup',
    'Your order #{order_number} is ready for pickup at {branch_name}.',
    true,
    true,
    '{"channels": ["EMAIL", "SMS", "PUSH"], "delay_minutes": 0, "retry_attempts": 3, "expires_hours": 24, "requires_read_receipt": false}'::jsonb
  ),
  (
    'ORDER_DELIVERED',
    'Order Delivered',
    'تم تسليم الطلب',
    'Notification when order is delivered',
    'إشعار عند تسليم الطلب',
    2,
    'truck',
    '#10B981',
    'order',
    'normal',
    false,
    true,
    'Your order has been delivered',
    'Your order #{order_number} has been delivered successfully.',
    true,
    true,
    '{"channels": ["EMAIL", "SMS"], "delay_minutes": 0, "retry_attempts": 2, "expires_hours": 48, "requires_read_receipt": false}'::jsonb
  ),
  (
    'ORDER_DELAYED',
    'Order Delayed',
    'تأخر الطلب',
    'Notification when order is delayed',
    'إشعار عند تأخر الطلب',
    3,
    'clock',
    '#F59E0B',
    'order',
    'high',
    true,
    true,
    'Your order is delayed',
    'Your order #{order_number} is delayed. New estimated ready time: {estimated_time}.',
    true,
    true,
    '{"channels": ["EMAIL", "SMS", "PUSH"], "delay_minutes": 0, "retry_attempts": 2, "expires_hours": 24, "requires_read_receipt": false}'::jsonb
  ),
  (
    'ORDER_CANCELLED',
    'Order Cancelled',
    'تم إلغاء الطلب',
    'Notification when order is cancelled',
    'إشعار عند إلغاء الطلب',
    4,
    'x-circle',
    '#EF4444',
    'order',
    'high',
    true,
    true,
    'Your order has been cancelled',
    'Your order #{order_number} has been cancelled. Refund will be processed if applicable.',
    true,
    true,
    '{"channels": ["EMAIL", "SMS"], "delay_minutes": 0, "retry_attempts": 2, "expires_hours": 48, "requires_read_receipt": true}'::jsonb
  ),
  -- Payment Notifications
  (
    'PAYMENT_RECEIVED',
    'Payment Received',
    'تم استلام الدفع',
    'Notification when payment is received',
    'إشعار عند استلام الدفع',
    10,
    'dollar-sign',
    '#10B981',
    'payment',
    'normal',
    false,
    true,
    'Payment received',
    'Payment of {amount} {currency} has been received for order #{order_number}.',
    true,
    true,
    '{"channels": ["EMAIL", "SMS"], "delay_minutes": 0, "retry_attempts": 2, "expires_hours": 24, "requires_read_receipt": false}'::jsonb
  ),
  (
    'PAYMENT_FAILED',
    'Payment Failed',
    'فشل الدفع',
    'Notification when payment fails',
    'إشعار عند فشل الدفع',
    11,
    'alert-circle',
    '#EF4444',
    'payment',
    'urgent',
    true,
    true,
    'Payment failed',
    'Payment for order #{order_number} failed. Please update your payment method.',
    true,
    true,
    '{"channels": ["EMAIL", "SMS", "PUSH"], "delay_minutes": 0, "retry_attempts": 5, "expires_hours": 72, "requires_read_receipt": true}'::jsonb
  ),
  (
    'PAYMENT_REMINDER',
    'Payment Reminder',
    'تذكير بالدفع',
    'Reminder for pending payment',
    'تذكير بالدفع المعلق',
    12,
    'bell',
    '#F59E0B',
    'payment',
    'normal',
    true,
    true,
    'Payment reminder',
    'Reminder: Payment of {amount} {currency} is pending for order #{order_number}.',
    true,
    true,
    '{"channels": ["EMAIL", "SMS"], "delay_minutes": 1440, "retry_attempts": 2, "expires_hours": 48, "requires_read_receipt": false}'::jsonb
  ),
  -- System Notifications
  (
    'SYSTEM_UPDATE',
    'System Update',
    'تحديث النظام',
    'System update notification',
    'إشعار تحديث النظام',
    20,
    'info',
    '#3B82F6',
    'system',
    'normal',
    false,
    true,
    'System update',
    'System update: {message}',
    true,
    true,
    '{"channels": ["EMAIL", "IN_APP"], "delay_minutes": 0, "retry_attempts": 1, "expires_hours": 168, "requires_read_receipt": false}'::jsonb
  ),
  (
    'ACCOUNT_ACTIVATED',
    'Account Activated',
    'تم تفعيل الحساب',
    'Notification when account is activated',
    'إشعار عند تفعيل الحساب',
    21,
    'check-circle',
    '#10B981',
    'system',
    'normal',
    false,
    true,
    'Account activated',
    'Your account has been activated. Welcome to CleanMateX!',
    true,
    true,
    '{"channels": ["EMAIL"], "delay_minutes": 0, "retry_attempts": 2, "expires_hours": 24, "requires_read_receipt": false}'::jsonb
  ),
  (
    'PASSWORD_RESET',
    'Password Reset',
    'إعادة تعيين كلمة المرور',
    'Password reset notification',
    'إشعار إعادة تعيين كلمة المرور',
    22,
    'key',
    '#8B5CF6',
    'system',
    'high',
    true,
    true,
    'Password reset requested',
    'A password reset has been requested for your account. Use this code: {reset_code}',
    true,
    true,
    '{"channels": ["EMAIL", "SMS"], "delay_minutes": 0, "retry_attempts": 3, "expires_hours": 1, "requires_read_receipt": false}'::jsonb
  ),
  -- Marketing Notifications
  (
    'PROMOTION',
    'Promotion',
    'عرض ترويجي',
    'Promotional notification',
    'إشعار ترويجي',
    30,
    'tag',
    '#EC4899',
    'marketing',
    'low',
    false,
    false,
    'Special promotion',
    'Special promotion: {promotion_message}',
    true,
    true,
    '{"channels": ["EMAIL", "SMS", "PUSH"], "delay_minutes": 0, "retry_attempts": 1, "expires_hours": 168, "requires_read_receipt": false}'::jsonb
  ),
  (
    'LOYALTY_REWARD',
    'Loyalty Reward',
    'مكافأة الولاء',
    'Loyalty reward notification',
    'إشعار مكافأة الولاء',
    31,
    'award',
    '#F59E0B',
    'marketing',
    'normal',
    false,
    true,
    'Loyalty reward earned',
    'You have earned {points} loyalty points! Total points: {total_points}.',
    true,
    true,
    '{"channels": ["EMAIL", "PUSH"], "delay_minutes": 0, "retry_attempts": 1, "expires_hours": 72, "requires_read_receipt": false}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  notification_category = EXCLUDED.notification_category,
  priority = EXCLUDED.priority,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_notification_channel_cd
-- ==================================================================

INSERT INTO sys_notification_channel_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  channel_type,
  requires_configuration,
  supports_rich_content,
  supports_attachments,
  max_length,
  cost_per_message,
  daily_limit,
  rate_limit_per_minute,
  is_system,
  is_active,
  metadata
) VALUES
  (
    'EMAIL',
    'Email',
    'البريد الإلكتروني',
    'Email notifications',
    'إشعارات البريد الإلكتروني',
    1,
    'mail',
    '#3B82F6',
    'email',
    true,
    true,
    true,
    NULL,
    0.001,
    NULL,
    100,
    true,
    true,
    '{"provider": "sendgrid", "api_endpoint": "https://api.sendgrid.com/v3/mail/send", "delivery_tracking": true, "read_receipt_supported": true}'::jsonb
  ),
  (
    'SMS',
    'SMS',
    'رسالة نصية',
    'SMS text messages',
    'الرسائل النصية',
    2,
    'message-square',
    '#10B981',
    'sms',
    true,
    false,
    false,
    160,
    0.05,
    1000,
    10,
    true,
    true,
    '{"provider": "twilio", "api_endpoint": "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json", "delivery_tracking": true, "read_receipt_supported": false}'::jsonb
  ),
  (
    'WHATSAPP',
    'WhatsApp',
    'واتساب',
    'WhatsApp messages',
    'رسائل واتساب',
    3,
    'message-circle',
    '#25D366',
    'whatsapp',
    true,
    true,
    true,
    4096,
    0.02,
    1000,
    20,
    true,
    true,
    '{"provider": "twilio", "api_endpoint": "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json", "delivery_tracking": true, "read_receipt_supported": true}'::jsonb
  ),
  (
    'PUSH',
    'Push Notification',
    'إشعار فوري',
    'Mobile push notifications',
    'الإشعارات الفورية للجوال',
    4,
    'bell',
    '#F59E0B',
    'push',
    true,
    true,
    false,
    200,
    0,
    NULL,
    100,
    true,
    true,
    '{"provider": "firebase", "api_endpoint": "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send", "delivery_tracking": true, "read_receipt_supported": false}'::jsonb
  ),
  (
    'IN_APP',
    'In-App Notification',
    'إشعار داخل التطبيق',
    'In-app notifications',
    'الإشعارات داخل التطبيق',
    5,
    'bell-ring',
    '#8B5CF6',
    'in_app',
    false,
    true,
    false,
    NULL,
    0,
    NULL,
    NULL,
    true,
    true,
    '{"provider": "internal", "delivery_tracking": true, "read_receipt_supported": true}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  channel_type = EXCLUDED.channel_type,
  max_length = EXCLUDED.max_length,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- REGISTER TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  description,
  description2,
  category,
  display_order,
  is_editable,
  is_extensible,
  supports_tenant_override,
  requires_unique_name,
  metadata
) VALUES
  (
    'sys_notification_type_cd',
    'Notification Types',
    'أنواع الإشعارات',
    'Notification type codes',
    'رموز أنواع الإشعارات',
    'Notifications',
    1,
    true,
    true,
    false,
    true,
    '{"icon": "bell", "color": "#3B82F6", "help_text": "Manage notification type codes"}'::jsonb
  ),
  (
    'sys_notification_channel_cd',
    'Notification Channels',
    'قنوات الإشعارات',
    'Notification channel codes',
    'رموز قنوات الإشعارات',
    'Notifications',
    2,
    true,
    true,
    false,
    true,
    '{"icon": "radio", "color": "#10B981", "help_text": "Manage notification channel codes"}'::jsonb
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

