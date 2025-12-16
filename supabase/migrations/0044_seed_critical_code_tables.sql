-- ==================================================================
-- 0043_seed_critical_code_tables.sql
-- Purpose: Seed data for critical system code tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration populates the critical code tables with initial data:
-- 1. sys_order_status_cd - Complete order lifecycle
-- 2. sys_payment_status_cd - Payment statuses
-- 3. sys_payment_gateway_cd - Payment gateways
-- 4. sys_service_type_cd - Service types
-- ==================================================================

BEGIN;

-- ==================================================================
-- SEED: sys_order_status_cd
-- Complete order lifecycle statuses
-- ==================================================================

INSERT INTO sys_order_status_cd (
  code,
  name,
  name2,
  display_order,
  color,
  icon,
  is_initial_status,
  is_final_status,
  allowed_next_statuses,
  default_sla_hours,
  is_system,
  metadata
) VALUES
  -- Initial/Draft
  (
    'DRAFT',
    'Draft',
    'مسودة',
    1,
    '#9CA3AF',
    'file-text',
    true,                                          -- Is initial status
    false,
    ARRAY['INTAKE', 'CANCELLED'],
    NULL,
    true,
    '{"stage": "draft"}'::jsonb
  ),

  -- Intake
  (
    'INTAKE',
    'Intake',
    'استلام',
    2,
    '#3B82F6',
    'clipboard-list',
    false,
    false,
    ARRAY['PREPARATION', 'CANCELLED'],
    2,
    true,
    '{"stage": "intake", "sends_notification": true, "notification_template": "order_received"}'::jsonb
  ),

  -- Preparation
  (
    'PREPARATION',
    'Preparation',
    'تحضير',
    3,
    '#8B5CF6',
    'package-check',
    false,
    false,
    ARRAY['SORTING'],
    4,
    true,
    '{"stage": "processing"}'::jsonb
  ),

  -- Sorting
  (
    'SORTING',
    'Sorting',
    'فرز',
    4,
    '#6366F1',
    'filter',
    false,
    false,
    ARRAY['WASHING'],
    2,
    true,
    '{"stage": "processing"}'::jsonb
  ),

  -- Washing
  (
    'WASHING',
    'Washing',
    'غسيل',
    5,
    '#06B6D4',
    'droplet',
    false,
    false,
    ARRAY['DRYING', 'QUALITY_HOLD'],
    6,
    true,
    '{"stage": "processing"}'::jsonb
  ),

  -- Drying
  (
    'DRYING',
    'Drying',
    'تجفيف',
    6,
    '#14B8A6',
    'wind',
    false,
    false,
    ARRAY['FINISHING'],
    4,
    true,
    '{"stage": "processing"}'::jsonb
  ),

  -- Finishing (Ironing)
  (
    'FINISHING',
    'Finishing',
    'كوي',
    7,
    '#10B981',
    'iron',
    false,
    false,
    ARRAY['ASSEMBLY'],
    6,
    true,
    '{"stage": "processing"}'::jsonb
  ),

  -- Assembly
  (
    'ASSEMBLY',
    'Assembly',
    'تجميع',
    8,
    '#22C55E',
    'package',
    false,
    false,
    ARRAY['QA'],
    2,
    true,
    '{"stage": "processing"}'::jsonb
  ),

  -- Quality Check
  (
    'QA',
    'Quality Check',
    'فحص الجودة',
    9,
    '#84CC16',
    'check-circle',
    false,
    false,
    ARRAY['PACKING', 'WASHING', 'QUALITY_HOLD'],
    2,
    true,
    '{"stage": "quality", "requires_qa": true}'::jsonb
  ),

  -- Quality Hold (for issues)
  (
    'QUALITY_HOLD',
    'Quality Hold',
    'تعليق الجودة',
    10,
    '#F59E0B',
    'alert-circle',
    false,
    false,
    ARRAY['QA', 'WASHING', 'CANCELLED'],
    NULL,
    true,
    '{"stage": "quality", "requires_qa": true, "sends_notification": true}'::jsonb
  ),

  -- Packing
  (
    'PACKING',
    'Packing',
    'تغليف',
    11,
    '#EAB308',
    'box',
    false,
    false,
    ARRAY['READY'],
    2,
    true,
    '{"stage": "packaging"}'::jsonb
  ),

  -- Ready for Pickup/Delivery
  (
    'READY',
    'Ready',
    'جاهز',
    12,
    '#F97316',
    'check-square',
    false,
    false,
    ARRAY['OUT_FOR_DELIVERY', 'DELIVERED'],
    NULL,
    true,
    '{"stage": "delivery", "sends_notification": true, "notification_template": "order_ready"}'::jsonb
  ),

  -- Out for Delivery
  (
    'OUT_FOR_DELIVERY',
    'Out for Delivery',
    'قيد التوصيل',
    13,
    '#FB923C',
    'truck',
    false,
    false,
    ARRAY['DELIVERED', 'READY'],
    4,
    true,
    '{"stage": "delivery", "sends_notification": true}'::jsonb
  ),

  -- Delivered
  (
    'DELIVERED',
    'Delivered',
    'تم التسليم',
    14,
    '#10B981',
    'package-check',
    false,
    false,
    ARRAY['CLOSED'],
    NULL,
    true,
    '{"stage": "completed", "sends_notification": true, "notification_template": "order_delivered"}'::jsonb
  ),

  -- Closed
  (
    'CLOSED',
    'Closed',
    'مغلق',
    15,
    '#6B7280',
    'archive',
    false,
    true,                                          -- Is final status
    ARRAY[]::VARCHAR[],
    NULL,
    true,
    '{"stage": "completed"}'::jsonb
  ),

  -- Cancelled
  (
    'CANCELLED',
    'Cancelled',
    'ملغي',
    16,
    '#EF4444',
    'x-circle',
    false,
    true,                                          -- Is final status
    ARRAY[]::VARCHAR[],
    NULL,
    true,
    '{"stage": "cancelled", "sends_notification": true}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  is_initial_status = EXCLUDED.is_initial_status,
  is_final_status = EXCLUDED.is_final_status,
  allowed_next_statuses = EXCLUDED.allowed_next_statuses,
  default_sla_hours = EXCLUDED.default_sla_hours,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED: sys_payment_status_cd
-- Payment processing statuses
-- ==================================================================

INSERT INTO sys_payment_status_cd (
  code,
  name,
  name2,
  display_order,
  color,
  icon,
  is_final,
  is_successful,
  is_failed,
  allows_retry,
  is_system,
  metadata
) VALUES
  (
    'PENDING',
    'Pending',
    'قيد الانتظار',
    1,
    '#F59E0B',
    'clock',
    false,
    false,
    false,
    true,
    true,
    '{"webhook_event": "payment.pending"}'::jsonb
  ),
  (
    'PROCESSING',
    'Processing',
    'قيد المعالجة',
    2,
    '#3B82F6',
    'loader',
    false,
    false,
    false,
    false,
    true,
    '{"webhook_event": "payment.processing"}'::jsonb
  ),
  (
    'AUTHORIZED',
    'Authorized',
    'مفوض',
    3,
    '#8B5CF6',
    'shield-check',
    false,
    false,
    false,
    false,
    true,
    '{"webhook_event": "payment.authorized"}'::jsonb
  ),
  (
    'COMPLETED',
    'Completed',
    'مكتمل',
    4,
    '#10B981',
    'check-circle',
    true,
    true,
    false,
    false,
    true,
    '{"webhook_event": "payment.succeeded", "sends_notification": true, "notification_template": "payment_confirmed"}'::jsonb
  ),
  (
    'FAILED',
    'Failed',
    'فشل',
    5,
    '#EF4444',
    'x-circle',
    true,
    false,
    true,
    true,
    true,
    '{"webhook_event": "payment.failed", "sends_notification": true}'::jsonb
  ),
  (
    'CANCELLED',
    'Cancelled',
    'ملغي',
    6,
    '#6B7280',
    'ban',
    true,
    false,
    false,
    false,
    true,
    '{"webhook_event": "payment.cancelled"}'::jsonb
  ),
  (
    'REFUNDED',
    'Refunded',
    'مسترد',
    7,
    '#8B5CF6',
    'corner-up-left',
    true,
    false,
    false,
    false,
    true,
    '{"webhook_event": "payment.refunded", "sends_notification": true}'::jsonb
  ),
  (
    'PARTIALLY_REFUNDED',
    'Partially Refunded',
    'مسترد جزئياً',
    8,
    '#A855F7',
    'corner-up-left',
    false,
    false,
    false,
    false,
    true,
    '{"webhook_event": "payment.partially_refunded"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  is_final = EXCLUDED.is_final,
  is_successful = EXCLUDED.is_successful,
  is_failed = EXCLUDED.is_failed,
  allows_retry = EXCLUDED.allows_retry,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED: sys_payment_gateway_cd
-- Payment gateways
-- ==================================================================

INSERT INTO sys_payment_gateway_cd (
  code,
  name,
  name2,
  display_order,
  icon,
  gateway_type,
  is_online,
  requires_api_key,
  supported_payment_methods,
  supported_currencies,
  has_transaction_fee,
  fee_percentage,
  fee_fixed_amount,
  is_system,
  metadata
) VALUES
  (
    'STRIPE',
    'Stripe',
    'سترايب',
    1,
    'credit-card',
    'stripe',
    true,
    true,
    ARRAY['CARD', 'ONLINE', 'WALLET'],
    ARRAY['SAR', 'USD', 'EUR', 'GBP'],
    true,
    2.90,
    0.30,
    true,
    '{
      "api_endpoint": "https://api.stripe.com/v1",
      "docs_url": "https://stripe.com/docs/api",
      "logo": "/images/gateways/stripe.svg",
      "config_schema": {
        "required": ["publishable_key", "secret_key"],
        "optional": ["webhook_secret"]
      }
    }'::jsonb
  ),
  (
    'HYPERPAY',
    'HyperPay',
    'هايبر باي',
    2,
    'credit-card',
    'hyperpay',
    true,
    true,
    ARRAY['CARD', 'ONLINE', 'WALLET'],
    ARRAY['SAR', 'AED', 'EGP'],
    true,
    2.50,
    0.00,
    true,
    '{
      "api_endpoint": "https://eu-prod.oppwa.com/v1",
      "docs_url": "https://docs.hyperpay.com",
      "logo": "/images/gateways/hyperpay.svg",
      "config_schema": {
        "required": ["entity_id", "access_token"],
        "optional": ["webhook_url"]
      }
    }'::jsonb
  ),
  (
    'PAYTABS',
    'PayTabs',
    'باي تابس',
    3,
    'credit-card',
    'paytabs',
    true,
    true,
    ARRAY['CARD', 'ONLINE'],
    ARRAY['SAR', 'AED', 'EGP', 'USD'],
    true,
    2.85,
    0.00,
    true,
    '{
      "api_endpoint": "https://secure.paytabs.sa",
      "docs_url": "https://dev.paytabs.com",
      "logo": "/images/gateways/paytabs.svg",
      "config_schema": {
        "required": ["profile_id", "server_key"],
        "optional": ["client_key"]
      }
    }'::jsonb
  ),
  (
    'MANUAL',
    'Manual Payment',
    'دفع يدوي',
    4,
    'hand',
    'manual',
    false,
    false,
    ARRAY['CASH', 'INVOICE'],
    ARRAY['SAR'],
    false,
    NULL,
    NULL,
    true,
    '{
      "description": "Manual cash or invoice payment processing",
      "requires_verification": true
    }'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  gateway_type = EXCLUDED.gateway_type,
  is_online = EXCLUDED.is_online,
  requires_api_key = EXCLUDED.requires_api_key,
  supported_payment_methods = EXCLUDED.supported_payment_methods,
  supported_currencies = EXCLUDED.supported_currencies,
  has_transaction_fee = EXCLUDED.has_transaction_fee,
  fee_percentage = EXCLUDED.fee_percentage,
  fee_fixed_amount = EXCLUDED.fee_fixed_amount,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED: sys_service_category_cd (Additional categories)
-- Additional service categories required for service types
-- ==================================================================

INSERT INTO sys_service_category_cd (
  service_category_code,
  ctg_name,
  ctg_name2,
  ctg_desc,
  turnaround_hh,
  turnaround_hh_express,
  multiplier_express,
  is_builtin,
  has_fee,
  is_mandatory,
  is_active,
  rec_order,
  service_category_icon,
  created_at
) VALUES
  (
    'CURTAIN',
    'Curtain Cleaning',
    'تنظيف ستائر',
    'Professional curtain and drapery cleaning service',
    96.00,
    48.00,
    1.50,
    true,
    true,
    false,
    true,
    7,
    'align-justify',
    NOW()
  ),
  (
    'CARPET',
    'Carpet Cleaning',
    'تنظيف سجاد',
    'Professional carpet and rug cleaning service',
    96.00,
    72.00,
    1.50,
    true,
    true,
    false,
    true,
    8,
    'grid',
    NOW()
  ),
  (
    'LEATHER',
    'Leather Care',
    'عناية بالجلود',
    'Specialized leather cleaning and care service',
    96.00,
    72.00,
    2.00,
    true,
    true,
    false,
    true,
    9,
    'shield',
    NOW()
  )
ON CONFLICT (service_category_code) DO UPDATE SET
  ctg_name = EXCLUDED.ctg_name,
  ctg_name2 = EXCLUDED.ctg_name2,
  ctg_desc = EXCLUDED.ctg_desc,
  turnaround_hh = EXCLUDED.turnaround_hh,
  turnaround_hh_express = EXCLUDED.turnaround_hh_express,
  multiplier_express = EXCLUDED.multiplier_express,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ==================================================================
-- SEED: sys_service_type_cd
-- Service types
-- ==================================================================

INSERT INTO sys_service_type_cd (
  code,
  name,
  name2,
  display_order,
  icon,
  color,
  service_category_code,
  requires_item_count,
  requires_weight,
  default_pricing_unit,
  express_multiplier,
  estimated_turnaround_hours,
  express_turnaround_hours,
  is_express_available,
  is_subscription_available,
  is_system,
  metadata
) VALUES
  (
    'WASH_AND_IRON',
    'Wash & Iron',
    'غسيل وكوي',
    1,
    'washing-machine',
    '#3B82F6',
    'WASH_AND_IRON',
    true,
    false,
    'per_item',
    1.5,
    48,
    24,
    true,
    true,
    true,
    '{"common_garments": ["SHIRT", "PANTS", "DRESS"], "damage_risk": "low"}'::jsonb
  ),
  (
    'DRY_CLEAN',
    'Dry Cleaning',
    'تنظيف جاف',
    2,
    'sparkles',
    '#8B5CF6',
    'DRY_CLEAN',
    true,
    false,
    'per_item',
    1.5,
    72,
    48,
    true,
    true,
    true,
    '{"common_garments": ["SUIT", "COAT", "DRESS"], "damage_risk": "medium", "special_handling": true}'::jsonb
  ),
  (
    'IRON_ONLY',
    'Iron Only',
    'كوي فقط',
    3,
    'iron',
    '#10B981',
    'IRON_ONLY',
    true,
    false,
    'per_item',
    1.5,
    24,
    12,
    true,
    true,
    true,
    '{"common_garments": ["SHIRT", "PANTS"], "damage_risk": "low"}'::jsonb
  ),
  (
    'ALTERATION',
    'Alterations',
    'تعديلات',
    4,
    'scissors',
    '#F59E0B',
    'ALTERATION',
    true,
    false,
    'per_item',
    2.0,
    96,
    48,
    true,
    false,
    true,
    '{"requires_inspection": true, "damage_risk": "low", "requires_measurements": true}'::jsonb
  ),
  (
    'REPAIR',
    'Repairs',
    'إصلاحات',
    5,
    'wrench',
    '#EF4444',
    'REPAIRS',
    true,
    false,
    'per_item',
    2.0,
    120,
    72,
    true,
    false,
    true,
    '{"requires_inspection": true, "damage_risk": "medium", "requires_assessment": true}'::jsonb
  ),
  (
    'CURTAIN_CLEAN',
    'Curtain Cleaning',
    'تنظيف ستائر',
    6,
    'align-justify',
    '#06B6D4',
    'CURTAIN',
    false,
    false,
    'per_sqm',
    1.5,
    96,
    48,
    true,
    false,
    true,
    '{"requires_dimensions": true, "damage_risk": "medium", "requires_pickup": true}'::jsonb
  ),
  (
    'CARPET_CLEAN',
    'Carpet Cleaning',
    'تنظيف سجاد',
    7,
    'grid',
    '#14B8A6',
    'CARPET',
    false,
    false,
    'per_sqm',
    1.5,
    120,
    72,
    true,
    false,
    true,
    '{"requires_dimensions": true, "damage_risk": "low", "requires_pickup": true}'::jsonb
  ),
  (
    'LEATHER_CARE',
    'Leather Care',
    'عناية بالجلود',
    8,
    'shield',
    '#A855F7',
    'LEATHER',
    true,
    false,
    'per_item',
    2.0,
    168,
    96,
    true,
    false,
    true,
    '{"special_handling": true, "damage_risk": "high", "requires_inspection": true}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  service_category_code = EXCLUDED.service_category_code,
  requires_item_count = EXCLUDED.requires_item_count,
  requires_weight = EXCLUDED.requires_weight,
  default_pricing_unit = EXCLUDED.default_pricing_unit,
  express_multiplier = EXCLUDED.express_multiplier,
  estimated_turnaround_hours = EXCLUDED.estimated_turnaround_hours,
  express_turnaround_hours = EXCLUDED.express_turnaround_hours,
  is_express_available = EXCLUDED.is_express_available,
  is_subscription_available = EXCLUDED.is_subscription_available,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- UPDATE REGISTRY: Mark tables as seeded
-- ==================================================================

UPDATE sys_code_tables_registry
SET
  last_seeded_at = CURRENT_TIMESTAMP,
  current_version = current_version + 1
WHERE table_name IN (
  'sys_order_status_cd',
  'sys_payment_status_cd',
  'sys_payment_gateway_cd',
  'sys_service_type_cd'
);

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================
