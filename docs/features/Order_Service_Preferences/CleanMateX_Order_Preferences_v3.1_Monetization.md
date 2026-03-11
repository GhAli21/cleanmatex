# CleanMateX — Order Preferences: Monetization, Feature Flags & Settings

**Document Type**: Feature Monetization & Gating Specification  
**Date**: March 11, 2026  
**Version**: 3.1 (Companion to V3 Complete Specification)  
**Scope**: Feature flags, plan limits, tenant settings, and monetization strategy for Order Preferences  
**Implementation**: Single-phase — ALL features built at once, gated by flags/plans

---

## 1. IMPLEMENTATION STRATEGY CHANGE

**Previous approach**: 4 phases (MVP → B → C → D)  
**New approach**: Build everything in ONE phase. Gate features behind feature flags and plan limits. All code exists from day one — plans control what each tenant can access.

**Why this is actually better for a solo developer:**

- You write ALL the code once, with no refactoring between phases
- Feature flags are just `if` checks — the code is the same whether the flag is on or off
- You can test everything end-to-end before launch
- When a tenant upgrades their plan, features unlock instantly — no deployment needed
- You can offer free trials of premium features to convert customers

---

## 2. MONETIZATION STRATEGY

### 2.1 The Pricing Psychology

The key insight: **basic preferences are expected by every laundry customer** — you can't charge for "hang my shirt." But **intelligence, automation, and customization** are premium value.

```
FREE = What a laundry MUST do           (select preferences at counter)
PAID = What makes a laundry SMARTER     (auto-apply, suggest, analyze, bundle)
```

### 2.2 Feature Tiering

```
┌────────────────────────────────────────────────────────────────────┐
│                    ORDER PREFERENCES TIERS                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🆓 FREE (All Plans)                                               │
│  ├── Select service preferences per item (from system catalog)      │
│  ├── Select packing preferences per item (HANG, FOLD only)          │
│  ├── Product default packing preference                             │
│  ├── Preferences shown on receipt                                   │
│  ├── Preferences visible in assembly screen                         │
│  ├── Max 3 service preferences per order item                       │
│  └── Max 5 system catalog preferences active                        │
│                                                                     │
│  ⭐ STARTER (Basic Paid Plan)                                      │
│  ├── Everything in Free, PLUS:                                      │
│  ├── All packing methods (BOX, GARMENT_BAG, VACUUM, ROLL, etc.)    │
│  ├── Max 6 service preferences per order item                       │
│  ├── All system catalog preferences active (unlimited)              │
│  ├── Ready-By SLA adjustment for preferences                        │
│  ├── Preferences on WhatsApp notifications                          │
│  ├── Fabric compatibility warnings                                  │
│  └── Repeat Last Order button                                       │
│                                                                     │
│  🚀 GROWTH (Mid-Tier Plan)                                         │
│  ├── Everything in Starter, PLUS:                                   │
│  ├── Custom preferences (tenant creates own codes)                  │
│  ├── Tenant price overrides per preference                          │
│  ├── Customer standing preferences (auto-apply)                     │
│  ├── Customer self-service preferences in app                       │
│  ├── Preference bundles / Care Packages (up to 5 bundles)           │
│  ├── Smart suggestions from order history                           │
│  ├── Preferences in customer order tracking                         │
│  ├── Preference changelog / audit trail                             │
│  └── Max 10 custom preferences                                     │
│                                                                     │
│  🏢 ENTERPRISE                                                     │
│  ├── Everything in Growth, PLUS:                                    │
│  ├── Unlimited custom preferences                                   │
│  ├── Unlimited preference bundles                                   │
│  ├── B2B contract default preferences                               │
│  ├── Per-piece packing overrides                                    │
│  ├── Seasonal preference templates                                  │
│  ├── Preference-based campaign targeting                            │
│  ├── Preference fulfillment rating / feedback                       │
│  ├── Eco/sustainability scoring & badges                            │
│  ├── Inventory forecasting from preferences                         │
│  ├── Preference analytics dashboard                                 │
│  ├── WhatsApp preference parsing (NLP keywords)                     │
│  └── Processing confirmation workflow                               │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 Why This Tiering Works for GCC Market

**Free tier**: A small مغسلة (laundry) in a neighborhood gets basic preferences for free. They can serve customers without paying. This gets them on the platform.

**Starter tier**: Once they see the value (repeat orders, SLA accuracy), they'll upgrade for operational improvements. Low price, high value.

**Growth tier**: Multi-branch laundries, laundries with VIP customers, and laundries competing on service quality need customer intelligence (auto-apply, bundles, smart suggestions). This is where most GCC laundries should land.

**Enterprise tier**: Hotel laundries, industrial plants, chains with B2B contracts. They need everything. They pay premium.

---

## 3. FEATURE FLAGS DEFINITION

All flags follow your existing `hq_ff_feature_flags_mst` pattern.

### 3.1 Boolean Feature Flags (On/Off)

```sql
-- ═══════════════════════════════════════════════════════
-- PREFERENCES: BOOLEAN FEATURE FLAGS
-- ═══════════════════════════════════════════════════════

INSERT INTO hq_ff_feature_flags_mst 
  (flag_key, flag_name, flag_name2, flag_description,
   governance_category, data_type, default_value,
   plan_binding_type, enabled_plan_codes,
   is_billable, allows_tenant_override, ui_group, comp_code, ui_display_order)
VALUES

-- ── FREE TIER FLAGS (enabled for all plans) ──

('service_pref.service_preferences_enabled',
 'Service Preferences', 'تفضيلات الخدمة',
 'Allow selecting service preferences (starch, perfume, etc.) on order items',
 'tenant_feature', 'boolean', 'true',
 'plan_bound', '["free","starter","growth","enterprise"]',
 false, true, 'Order Preferences', 'SERVICE_PREF', 100),

('service_pref.packing_preferences_enabled',
 'Packing Preferences', 'تفضيلات التغليف',
 'Allow selecting packing preferences (hang, fold) on order items',
 'tenant_feature', 'boolean', 'true',
 'plan_bound', '["free","starter","growth","enterprise"]',
 false, true, 'Order Preferences', 'SERVICE_PREF', 110),

('service_pref.show_on_receipt',
 'SERVICE_PREFerences on Receipt', 'التفضيلات على الإيصال',
 'Show selected preferences on printed receipt and digital receipt',
 'tenant_feature', 'boolean', 'true',
 'plan_bound', '["free","starter","growth","enterprise"]',
 false, true, 'Order Preferences', 'SERVICE_PREF', 120),

('service_pref.product_default_packing',
 'Product Default Packing', 'تغليف افتراضي للمنتج',
 'Auto-fill packing preference from product catalog defaults',
 'tenant_feature', 'boolean', 'true',
 'plan_bound', '["free","starter","growth","enterprise"]',
 false, true, 'Order Preferences', 'SERVICE_PREF', 130),

-- ── STARTER TIER FLAGS ──

('service_pref.all_packing_methods',
 'All Packing Methods', 'جميع طرق التغليف',
 'Access to all packing methods: BOX, GARMENT_BAG, VACUUM_SEAL, ROLL, FOLD_TISSUE. Free plan only has HANG and FOLD.',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["starter","growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 200),

('service_pref.sla_adjustment',
 'Ready-By SLA Adjustment', 'تعديل وقت الجاهزية',
 'Automatically adjust Ready-By time based on preference processing requirements',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["starter","growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 210),

('service_pref.whatsapp_notification',
 'SERVICE_PREFerences on WhatsApp', 'التفضيلات على واتساب',
 'Include preference summary in WhatsApp order notifications',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["starter","growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 220),

('service_pref.fabric_validation',
 'Fabric Compatibility Warnings', 'تحذيرات توافق القماش',
 'Show warnings when preferences conflict with fabric type',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["starter","growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 230),

('service_pref.repeat_last_order',
 'Repeat Last Order', 'تكرار الطلب السابق',
 'Show recent orders with preferences for one-tap reorder at counter',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["starter","growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 240),

-- ── GROWTH TIER FLAGS ──

('service_pref.custom_preferences',
 'Custom Preferences', 'تفضيلات مخصصة',
 'Tenant can create their own custom service preferences beyond system catalog',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 300),

('service_pref.tenant_price_overrides',
 'SERVICE_PREFerence Price Overrides', 'تعديل أسعار التفضيلات',
 'Tenant can set custom prices for preferences different from system defaults',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 310),

('service_pref.customer_standing_prefs',
 'Customer Standing Preferences', 'تفضيلات العملاء الدائمة',
 'Customers can have standing preferences that auto-apply to new orders',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 320),

('service_pref.customer_self_service',
 'Customer Self-Service Preferences', 'التفضيلات ذاتية الخدمة',
 'Customers can manage their own preferences in the mobile app',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 330),

('service_pref.bundles_enabled',
 'SERVICE_PREFerence Bundles (Care Packages)', 'باقات التفضيلات',
 'Create pre-built preference combinations for one-tap application',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 340),

('service_pref.smart_suggestions',
 'Smart Suggestions', 'اقتراحات ذكية',
 'Suggest preferences based on customer order history patterns',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 350),

('service_pref.tracking_visibility',
 'SERVICE_PREFerences in Order Tracking', 'التفضيلات في تتبع الطلب',
 'Show preference confirmation status in customer order tracking screen',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 360),

('service_pref.changelog_audit',
 'SERVICE_PREFerence Changelog', 'سجل تغييرات التفضيلات',
 'Track all changes to customer preferences with full audit trail',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["growth","enterprise"]',
 true, true, 'Order Preferences', 'SERVICE_PREF', 370),

-- ── ENTERPRISE TIER FLAGS ──

('service_pref.b2b_contract_defaults',
 'B2B Contract Preferences', 'تفضيلات عقود الشركات',
 'Set default preferences per B2B contract that auto-apply to all contract orders',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 400),

('service_pref.per_piece_packing',
 'Per-Piece Packing Override', 'تغليف لكل قطعة',
 'Override packing preference for individual pieces within an order item',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 410),

('service_pref.seasonal_templates',
 'Seasonal Preference Templates', 'قوالب التفضيلات الموسمية',
 'Date-activated preference templates for Ramadan, Eid, seasons, etc.',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 420),

('service_pref.campaign_targeting',
 'SERVICE_PREFerence-Based Campaigns', 'حملات مبنية على التفضيلات',
 'Target marketing campaigns based on customer preference usage patterns',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 430),

('service_pref.fulfillment_rating',
 'SERVICE_PREFerence Fulfillment Rating', 'تقييم تنفيذ التفضيلات',
 'Post-delivery micro-feedback on whether preferences were met',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 440),

('service_pref.eco_scoring',
 'Eco/Sustainability Scoring', 'نقاط الاستدامة',
 'Calculate and display eco scores based on preference choices',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 450),

('service_pref.inventory_forecasting',
 'Inventory Forecasting from Preferences', 'توقعات المخزون من التفضيلات',
 'Predict consumable demand (hangers, bags, starch) from preference usage trends',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 460),

('service_pref.analytics_dashboard',
 'SERVICE_PREFerence Analytics Dashboard', 'لوحة تحليلات التفضيلات',
 'Detailed analytics: popular preferences, revenue from add-ons, fulfillment rates',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 470),

('service_pref.whatsapp_parsing',
 'WhatsApp Preference Parsing', 'تحليل التفضيلات من واتساب',
 'Automatically extract preferences from WhatsApp order messages using NLP keywords',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 480),

('service_pref.processing_confirmation',
 'Processing Confirmation Workflow', 'سير عمل تأكيد المعالجة',
 'Plant operators confirm each preference was applied during processing',
 'tenant_feature', 'boolean', 'false',
 'plan_bound', '["enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 490);
```

### 3.2 Numeric Limit Flags

```sql
-- ═══════════════════════════════════════════════════════
-- PREFERENCES: NUMERIC LIMIT FLAGS
-- ═══════════════════════════════════════════════════════

INSERT INTO hq_ff_feature_flags_mst 
  (flag_key, flag_name, flag_name2, flag_description,
   governance_category, data_type, default_value,
   plan_binding_type, enabled_plan_codes,
   is_billable, allows_tenant_override, ui_group, comp_code, ui_display_order,
   min_value, max_value, validation_rules)
VALUES

('service_pref.max_service_prefs_per_item',
 'Max Service Preferences Per Item', 'الحد الأقصى لتفضيلات الخدمة لكل منتج',
 'Maximum number of service preferences that can be applied to a single order item',
 'tenant_limit', 'integer', '3',
 'plan_bound', '["free","starter","growth","enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 500,
 1, 20, '{"min": 1, "max": 20}'),

('service_pref.max_active_catalog_items',
 'Max Active Catalog Preferences', 'الحد الأقصى للتفضيلات النشطة',
 'Maximum number of system catalog preferences that can be active simultaneously. -1 = unlimited.',
 'tenant_limit', 'integer', '5',
 'plan_bound', '["free","starter","growth","enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 510,
 1, -1, '{"min": 1, "max": -1}'),

('service_pref.max_custom_preferences',
 'Max Custom Preferences', 'الحد الأقصى للتفضيلات المخصصة',
 'Maximum number of tenant-created custom preferences. 0 = not allowed. -1 = unlimited.',
 'tenant_limit', 'integer', '0',
 'plan_bound', '["free","starter","growth","enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 520,
 0, -1, '{"min": 0, "max": -1}'),

('service_pref.max_bundles',
 'Max Preference Bundles', 'الحد الأقصى للباقات',
 'Maximum number of preference bundles (Care Packages). 0 = not allowed. -1 = unlimited.',
 'tenant_limit', 'integer', '0',
 'plan_bound', '["free","starter","growth","enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 530,
 0, -1, '{"min": 0, "max": -1}'),

('service_pref.max_seasonal_templates',
 'Max Seasonal Templates', 'الحد الأقصى للقوالب الموسمية',
 'Maximum number of seasonal preference templates. 0 = not allowed. -1 = unlimited.',
 'tenant_limit', 'integer', '0',
 'plan_bound', '["free","starter","growth","enterprise"]',
 true, false, 'Order Preferences', 'SERVICE_PREF', 540,
 0, -1, '{"min": 0, "max": -1}');
```

### 3.3 Plan-Specific Values (Mappings)

```sql
-- ═══════════════════════════════════════════════════════
-- PLAN-SPECIFIC VALUES FOR NUMERIC LIMITS
-- ═══════════════════════════════════════════════════════

INSERT INTO sys_ff_pln_flag_mappings_dtl 
  (plan_code, flag_key, plan_specific_value, is_enabled, notes)
VALUES

-- ── pref.max_service_prefs_per_item ──
('free',       'service_pref.max_service_prefs_per_item', '3',   true, 'Free: max 3 preferences per item'),
('starter',    'service_pref.max_service_prefs_per_item', '6',   true, 'Starter: max 6 preferences per item'),
('growth',     'service_pref.max_service_prefs_per_item', '10',  true, 'Growth: max 10 preferences per item'),
('enterprise', 'service_pref.max_service_prefs_per_item', '-1',  true, 'Enterprise: unlimited'),

-- ── pref.max_active_catalog_items ──
('free',       'service_pref.max_active_catalog_items', '5',     true, 'Free: only 5 from system catalog'),
('starter',    'service_pref.max_active_catalog_items', '-1',    true, 'Starter: all system catalog items'),
('growth',     'service_pref.max_active_catalog_items', '-1',    true, 'Growth: all system catalog items'),
('enterprise', 'service_pref.max_active_catalog_items', '-1',    true, 'Enterprise: all system catalog items'),

-- ── pref.max_custom_preferences ──
('free',       'service_pref.max_custom_preferences', '0',       true, 'Free: cannot create custom'),
('starter',    'service_pref.max_custom_preferences', '0',       true, 'Starter: cannot create custom'),
('growth',     'service_pref.max_custom_preferences', '10',      true, 'Growth: up to 10 custom prefs'),
('enterprise', 'service_pref.max_custom_preferences', '-1',      true, 'Enterprise: unlimited custom prefs'),

-- ── pref.max_bundles ──
('free',       'service_pref.max_bundles', '0',                  true, 'Free: no bundles'),
('starter',    'service_pref.max_bundles', '0',                  true, 'Starter: no bundles'),
('growth',     'service_pref.max_bundles', '5',                  true, 'Growth: up to 5 bundles'),
('enterprise', 'service_pref.max_bundles', '-1',                 true, 'Enterprise: unlimited bundles'),

-- ── pref.max_seasonal_templates ──
('free',       'service_pref.max_seasonal_templates', '0',       true, 'Free: no seasonal templates'),
('starter',    'service_pref.max_seasonal_templates', '0',       true, 'Starter: no seasonal templates'),
('growth',     'service_pref.max_seasonal_templates', '0',       true, 'Growth: no seasonal templates'),
('enterprise', 'service_pref.max_seasonal_templates', '-1',      true, 'Enterprise: unlimited seasonal templates');
```

---

## 4. TENANT SETTINGS FOR PREFERENCES

These go into `org_tenant_settings_cf` — operational settings that tenants can configure within their plan's allowed features.

```sql
-- ═══════════════════════════════════════════════════════
-- SYSTEM SETTINGS DEFINITIONS
-- (What settings exist and their defaults)
-- ═══════════════════════════════════════════════════════

INSERT INTO sys_stng_settings_cd
  (stng_code, stng_name, stng_name2, stng_description,
   stng_data_type, stng_default_value, stng_category,
   stng_scope, is_active, display_order)
VALUES

-- ── GENERAL PREFERENCE SETTINGS ──

('SERVICE_PREF_DEFAULT_PACKING',
 'Default Packing Preference', 'تفضيل التغليف الافتراضي',
 'Global default packing preference when no product default and no customer preference exists',
 'TEXT', 'FOLD', 'SERVICE_PREFerences', 'TENANT', true, 1),

('SERVICE_PREF_SHOW_PRICE_ON_COUNTER',
 'Show Preference Prices at Counter', 'عرض أسعار التفضيلات في الكاونتر',
 'Whether to show the extra price for each preference on the counter screen',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 2),

('SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS',
 'Auto-Apply Customer Preferences', 'تطبيق تفضيلات العميل تلقائياً',
 'Automatically apply customer standing preferences when creating a new order. If false, show them as suggestions only.',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 3),

('SERVICE_PREF_ALLOW_NOTES',
 'Allow Notes on Preferences', 'السماح بالملاحظات على التفضيلات',
 'Allow operators to add free-text notes alongside catalog preferences (e.g., "use wooden hangers")',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 4),

('SERVICE_PREF_REQUIRE_CONFIRMATION',
 'Require Processing Confirmation', 'طلب تأكيد المعالجة',
 'Require plant operators to confirm each service preference was applied',
 'BOOLEAN', 'false', 'SERVICE_PREFerences', 'TENANT', true, 5),

-- ── PACKING SETTINGS ──

('SERVICE_PREF_PACKING_PER_PIECE_ENABLED',
 'Per-Piece Packing Enabled', 'تغليف لكل قطعة مُفعّل',
 'Allow different packing preferences per individual piece (e.g., 3 shirts hang, 2 shirts fold)',
 'BOOLEAN', 'false', 'SERVICE_PREFerences', 'TENANT', true, 10),

('SERVICE_PREF_PACKING_SHOW_OVERRIDE_WARNING',
 'Show Packing Override Warning', 'عرض تحذير تجاوز التغليف',
 'Show a visual indicator in assembly when packing preference differs from product default',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 11),

-- ── BUNDLE SETTINGS ──

('SERVICE_PREF_BUNDLES_SHOW_SAVINGS',
 'Show Bundle Savings', 'عرض توفير الباقة',
 'Show how much customer saves when selecting a bundle vs individual preferences',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 20),

('SERVICE_PREF_BUNDLES_SHOW_ON_COUNTER',
 'Show Bundles on Counter Screen', 'عرض الباقات على شاشة الكاونتر',
 'Display care package bundles prominently on the counter order creation screen',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 21),

-- ── SUGGESTION SETTINGS ──

('SERVICE_PREF_SUGGESTION_MIN_ORDERS',
 'Suggestion Minimum Orders', 'الحد الأدنى للطلبات للاقتراح',
 'Minimum number of past orders before showing smart preference suggestions',
 'NUMBER', '3', 'SERVICE_PREFerences', 'TENANT', true, 30),

('SERVICE_PREF_SUGGESTION_MIN_FREQUENCY_PCT',
 'Suggestion Minimum Frequency %', 'نسبة التكرار الأدنى للاقتراح',
 'Minimum percentage of orders where preference appeared before suggesting (e.g., 60 = 60%)',
 'NUMBER', '60', 'SERVICE_PREFerences', 'TENANT', true, 31),

('SERVICE_PREF_SUGGESTION_LOOKBACK_DAYS',
 'Suggestion Lookback Days', 'أيام المراجعة للاقتراح',
 'How many days of order history to analyze for suggestions',
 'NUMBER', '90', 'SERVICE_PREFerences', 'TENANT', true, 32),

-- ── REPEAT ORDER SETTINGS ──

('SERVICE_PREF_REPEAT_ORDER_COUNT',
 'Repeat Order History Count', 'عدد الطلبات السابقة المعروضة',
 'How many recent orders to show in the Repeat Order panel',
 'NUMBER', '3', 'SERVICE_PREFerences', 'TENANT', true, 40),

-- ── ECO SETTINGS ──

('SERVICE_PREF_ECO_SHOW_SCORE',
 'Show Eco Score', 'عرض نقاط البيئة',
 'Display sustainability score on receipts and customer app',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 50),

('SERVICE_PREF_ECO_BADGE_THRESHOLDS',
 'Eco Badge Thresholds', 'حدود شارات البيئة',
 'JSON: monthly eco score thresholds for badges {"seedling":0,"green":21,"tree":51,"planet":101}',
 'TEXT', '{"seedling":0,"green":21,"tree":51,"planet":101}', 'SERVICE_PREFerences', 'TENANT', true, 51),

-- ── FEEDBACK SETTINGS ──

('SERVICE_PREF_FEEDBACK_ENABLED',
 'Post-Delivery Feedback', 'التعليقات بعد التوصيل',
 'Show preference fulfillment question after delivery',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 60),

('SERVICE_PREF_FEEDBACK_DELAY_HOURS',
 'Feedback Delay Hours', 'تأخير التعليقات بالساعات',
 'Hours after delivery before sending feedback request',
 'NUMBER', '2', 'SERVICE_PREFerences', 'TENANT', true, 61),

-- ── COMPATIBILITY SETTINGS ──

('SERVICE_PREF_ENFORCE_COMPATIBILITY',
 'Enforce Compatibility Rules', 'فرض قواعد التوافق',
 'If true, incompatible preferences are blocked. If false, only a warning is shown.',
 'BOOLEAN', 'false', 'SERVICE_PREFerences', 'TENANT', true, 70),

-- ── SEASONAL SETTINGS ──

('SERVICE_PREF_SEASONAL_AUTO_APPLY',
 'Auto-Apply Seasonal Templates', 'تطبيق القوالب الموسمية تلقائياً',
 'Automatically apply matching seasonal templates to orders within active date ranges',
 'BOOLEAN', 'true', 'SERVICE_PREFerences', 'TENANT', true, 80);
```

---

## 5. HOW FEATURE FLAGS GATE THE CODE

### 5.1 NestJS Guard / Middleware Pattern

Every API endpoint and every UI component checks the feature flag before executing. Here's the pattern:

```typescript
// ═══════════════════════════════════════════════════
// NestJS: Feature Flag Guard for Preferences
// ═══════════════════════════════════════════════════

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PreferenceFeatureGuard implements CanActivate {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;
    const flagKey = Reflect.getMetadata('requiredFlag', context.getHandler());
    
    if (!flagKey) return true; // No flag required
    
    const isEnabled = await this.featureFlagService.isEnabled(tenantId, flagKey);
    
    if (!isEnabled) {
      throw new ForbiddenException({
        code: 'FEATURE_NOT_AVAILABLE',
        message: `This feature requires a plan upgrade`,
        flag: flagKey,
        upgradeUrl: '/settings/subscription/upgrade',
      });
    }
    
    return true;
  }
}

// ═══════════════════════════════════════════════════
// Custom Decorator
// ═══════════════════════════════════════════════════

import { SetMetadata } from '@nestjs/common';

export const RequiresFeature = (flagKey: string) => SetMetadata('requiredFlag', flagKey);

// ═══════════════════════════════════════════════════
// Usage in Controller
// ═══════════════════════════════════════════════════

@Controller('v1/orders/:orderId/items/:itemId')
@UseGuards(PreferenceFeatureGuard)
export class OrderItemPreferencesController {

  // FREE: Anyone can add basic service preferences
  @Post('service-prefs')
  @RequiresFeature('service_pref.service_preferences_enabled')
  async addServicePreference(@Body() dto: AddServicePrefDto) {
    // Also check numeric limit inside the service:
    // await this.checkLimit(tenantId, 'service_pref.max_service_prefs_per_item', currentCount);
    return this.service.addServicePreference(dto);
  }

  // GROWTH: Bundles require Growth plan
  @Post('apply-bundle/:bundleCode')
  @RequiresFeature('service_pref.bundles_enabled')
  async applyBundle(@Param('bundleCode') bundleCode: string) {
    return this.service.applyBundle(bundleCode);
  }

  // ENTERPRISE: Per-piece packing requires Enterprise
  @Patch('pieces/:pieceId/packing-pref')
  @RequiresFeature('service_pref.per_piece_packing')
  async setPiecePacking(@Body() dto: SetPiecePackingDto) {
    return this.service.setPiecePacking(dto);
  }
}
```

### 5.2 Numeric Limit Check Pattern

```typescript
// ═══════════════════════════════════════════════════
// Checking numeric limits before allowing actions
// ═══════════════════════════════════════════════════

@Injectable()
export class PreferenceLimitService {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly prisma: PrismaService,
  ) {}

  async checkServicePrefsPerItemLimit(
    tenantId: string, 
    orderItemId: string
  ): Promise<void> {
    // Get the limit for this tenant's plan
    const limit = await this.featureFlagService.getNumericValue(
      tenantId, 
      'service_pref.max_service_prefs_per_item'
    );
    
    // -1 means unlimited
    if (limit === -1) return;
    
    // Count current preferences on this item
    const currentCount = await this.prisma.orgOrderItemServicePrefs.count({
      where: { 
        order_item_id: orderItemId, 
        rec_status: 1 
      },
    });
    
    if (currentCount >= limit) {
      throw new ForbiddenException({
        code: 'LIMIT_REACHED',
        message: `Maximum ${limit} service preferences per item. Upgrade your plan for more.`,
        currentCount,
        limit,
        upgradeUrl: '/settings/subscription/upgrade',
      });
    }
  }

  async checkCustomPreferencesLimit(tenantId: string): Promise<void> {
    const limit = await this.featureFlagService.getNumericValue(
      tenantId, 
      'service_pref.max_custom_preferences'
    );
    
    if (limit === 0) {
      throw new ForbiddenException({
        code: 'FEATURE_NOT_AVAILABLE',
        message: 'Custom preferences require Growth plan or higher.',
        upgradeUrl: '/settings/subscription/upgrade',
      });
    }
    
    if (limit === -1) return; // unlimited
    
    const currentCount = await this.prisma.orgServicePreferenceCf.count({
      where: { 
        tenant_org_id: tenantId, 
        is_system_code: false, 
        is_active: true 
      },
    });
    
    if (currentCount >= limit) {
      throw new ForbiddenException({
        code: 'LIMIT_REACHED',
        message: `Maximum ${limit} custom preferences. Upgrade to Enterprise for unlimited.`,
        currentCount,
        limit,
      });
    }
  }
}
```

### 5.3 Flutter UI Gating Pattern

```dart
// ═══════════════════════════════════════════════════
// Flutter: Conditionally show/hide preference features
// ═══════════════════════════════════════════════════

class OrderPreferencesWidget extends StatelessWidget {
  final FeatureFlagService flags;
  final OrderItem item;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── ALWAYS SHOWN (Free) ──
        if (flags.isEnabled('service_pref.service_preferences_enabled'))
          ServicePreferencesSelector(
            item: item,
            maxSelections: flags.getNumericValue('service_pref.max_service_prefs_per_item'),
          ),

        if (flags.isEnabled('service_pref.packing_preferences_enabled'))
          PackingPreferenceSelector(
            item: item,
            showAllMethods: flags.isEnabled('service_pref.all_packing_methods'),
            // Free = only HANG/FOLD, Paid = all methods
          ),

        // ── STARTER+ ──
        if (flags.isEnabled('service_pref.repeat_last_order'))
          RepeatLastOrderPanel(customerId: item.order.customerId),

        // ── GROWTH+ ──
        if (flags.isEnabled('service_pref.bundles_enabled'))
          CarePackageBundles(itemId: item.id),

        if (flags.isEnabled('service_pref.smart_suggestions'))
          SmartSuggestionsPanel(
            customerId: item.order.customerId,
            productCode: item.productCode,
          ),

        // ── UPGRADE PROMPT (shown when feature is locked) ──
        if (!flags.isEnabled('service_pref.bundles_enabled'))
          UpgradePromptCard(
            title: 'Care Packages',
            titleAr: 'باقات العناية',
            description: 'Create one-tap preference bundles. Upgrade to Growth.',
            featureIcon: Icons.card_giftcard,
          ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════
// Upgrade Prompt Widget — Shown for locked features
// ═══════════════════════════════════════════════════

class UpgradePromptCard extends StatelessWidget {
  final String title;
  final String titleAr;
  final String description;
  final IconData featureIcon;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.amber.shade50,
      child: ListTile(
        leading: Icon(featureIcon, color: Colors.amber.shade700),
        title: Text(title),
        subtitle: Text(description),
        trailing: TextButton(
          onPressed: () => Navigator.pushNamed(context, '/settings/upgrade'),
          child: Text('Upgrade'),
        ),
      ),
    );
  }
}
```

---

## 6. COMPLETE FEATURE FLAG MATRIX

| Flag Key | Free | Starter | Growth | Enterprise |
|----------|------|---------|--------|------------|
| **Boolean Flags** | | | | |
| `service_pref..service_preferences_enabled` | ✅ | ✅ | ✅ | ✅ |
| `service_pref..packing_preferences_enabled` | ✅ | ✅ | ✅ | ✅ |
| `service_pref..show_on_receipt` | ✅ | ✅ | ✅ | ✅ |
| `service_pref..product_default_packing` | ✅ | ✅ | ✅ | ✅ |
| `service_pref..all_packing_methods` | ❌ | ✅ | ✅ | ✅ |
| `service_pref..sla_adjustment` | ❌ | ✅ | ✅ | ✅ |
| `service_pref..whatsapp_notification` | ❌ | ✅ | ✅ | ✅ |
| `service_pref..fabric_validation` | ❌ | ✅ | ✅ | ✅ |
| `service_pref..repeat_last_order` | ❌ | ✅ | ✅ | ✅ |
| `service_pref..custom_preferences` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..tenant_price_overrides` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..customer_standing_prefs` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..customer_self_service` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..bundles_enabled` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..smart_suggestions` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..tracking_visibility` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..changelog_audit` | ❌ | ❌ | ✅ | ✅ |
| `service_pref..b2b_contract_defaults` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..per_piece_packing` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..seasonal_templates` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..campaign_targeting` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..fulfillment_rating` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..eco_scoring` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..inventory_forecasting` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..analytics_dashboard` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..whatsapp_parsing` | ❌ | ❌ | ❌ | ✅ |
| `service_pref..processing_confirmation` | ❌ | ❌ | ❌ | ✅ |
| **Numeric Limits** | | | | |
| `service_pref..max_service_prefs_per_item` | 3 | 6 | 10 | ∞ |
| `service_pref..max_active_catalog_items` | 5 | ∞ | ∞ | ∞ |
| `service_pref..max_custom_preferences` | 0 | 0 | 10 | ∞ |
| `service_pref..max_bundles` | 0 | 0 | 5 | ∞ |
| `service_pref..max_seasonal_templates` | 0 | 0 | 0 | ∞ |

---

## 7. UPGRADE TRIGGERS (How You Make Money)

These are the moments when a tenant hits a wall and sees the upgrade prompt:

| Moment | What Happens | Upgrade To |
|--------|-------------|------------|
| Cashier tries to add 4th preference on free plan | "Max 3 preferences per item. Upgrade for more." | Starter |
| Admin tries to enable 6th catalog item on free plan | "Max 5 active preferences. Upgrade for unlimited." | Starter |
| Cashier tries to select GARMENT_BAG on free plan | "Premium packing methods available on Starter plan." | Starter |
| Admin tries to create a custom preference | "Custom preferences available on Growth plan." | Growth |
| Admin tries to create a bundle | "Care Packages available on Growth plan." | Growth |
| Admin tries to set custom price for starch | "Price overrides available on Growth plan." | Growth |
| Cashier notices "Smart Suggestions" is grayed out | "Unlock AI suggestions. Upgrade to Growth." | Growth |
| Customer sees "Manage Preferences" locked in app | "Self-service preferences available on Growth." | Growth |
| Admin tries to create B2B contract preferences | "Contract preferences available on Enterprise." | Enterprise |
| Admin tries to create seasonal template | "Seasonal templates available on Enterprise." | Enterprise |
| Admin wants preference analytics dashboard | "Analytics dashboard available on Enterprise." | Enterprise |

**Key principle:** Never hide the feature entirely. Show it grayed out with an upgrade prompt. This creates desire and shows the tenant what they're missing.

---

## 8. SINGLE-PHASE IMPLEMENTATION CHECKLIST

Since everything is built at once, here's the complete task list:

### Database (All at once)

```
[ ] Create sys_service_preference_cd + seed data (10 rows)
[ ] Create sys_packing_preference_cd + seed data (7 rows)
[ ] Create org_service_preference_cf + RLS
[ ] Create org_packing_preference_cf + RLS
[ ] Create org_order_item_service_prefs + RLS + indexes
[ ] Create org_customer_service_prefs + RLS + indexes
[ ] Create org_customer_pref_changelog + RLS + trigger
[ ] Create org_preference_bundles_cf + RLS
[ ] Create org_seasonal_pref_templates_cf + RLS
[ ] Create org_preference_fulfillment_ratings + RLS
[ ] Create org_daily_preference_metrics + RLS
[ ] Create org_contract_service_prefs + RLS
[ ] Create sys_preference_compatibility_rules
[ ] ALTER org_order_items_dtl: add packing_pref_code, packing_pref_is_override, packing_pref_source
[ ] ALTER org_order_item_pieces_dtl: add packing_pref_code
[ ] ALTER org_product_data_mst: add default_packing_pref
[ ] Create function resolve_item_preferences()
[ ] Create function suggest_preferences_from_history()
[ ] Create function get_last_order_preferences()
[ ] Create function calculate_ready_by_with_preferences()
[ ] Insert feature flags into hq_ff_feature_flags_mst (27 flags)
[ ] Insert plan mappings into sys_ff_pln_flag_mappings_dtl (20 mappings)
[ ] Insert settings into sys_stng_settings_cd (16 settings)
```

### NestJS Backend (All at once)

```
[ ] PreferenceModule (NestJS module registration)
[ ] PreferenceFeatureGuard (feature flag checking)
[ ] PreferenceLimitService (numeric limit checking)
[ ] ServicePreferenceCatalogService (merged system+tenant catalog)
[ ] PackingPreferenceCatalogService
[ ] OrderItemServicePrefsService (CRUD + pricing)
[ ] CustomerServicePrefsService (standing prefs CRUD)
[ ] PreferenceResolutionService (5-level hierarchy resolver)
[ ] PreferenceSuggestionService (history-based suggestions)
[ ] RepeatOrderService (clone preferences from past orders)
[ ] PreferenceBundleService (care packages)
[ ] ReadyByCalculationService (SLA adjustment)
[ ] FabricValidationService (compatibility checks)
[ ] SeasonalTemplateService
[ ] FulfillmentRatingService
[ ] PreferenceAnalyticsService
[ ] EcoScoringService
[ ] InventoryForecastService
[ ] Controllers for all API endpoints
[ ] Receipt template integration
[ ] WhatsApp notification template integration
```

### Next.js Admin Dashboard (All at once)

```
[ ] Preferences Catalog management page
[ ] Custom preferences CRUD
[ ] Preference bundles CRUD
[ ] Preference price overrides
[ ] Seasonal templates management
[ ] Customer preferences view in customer profile
[ ] Preference changelog view
[ ] Preference analytics dashboard
[ ] Settings page for all PREF_ settings
[ ] Feature flag indicators (locked/unlocked badges)
[ ] Upgrade prompts for locked features
```

### Flutter Apps (All at once)

```
[ ] Counter: Service preference selector (with flag gating)
[ ] Counter: Packing preference selector (with all_methods gating)
[ ] Counter: Care package bundles panel (with flag gating)
[ ] Counter: Repeat Last Order panel (with flag gating)
[ ] Counter: Smart suggestions panel (with flag gating)
[ ] Counter: Fabric validation warnings
[ ] Counter: Price impact display
[ ] Counter: SLA adjustment display
[ ] Customer App: My Preferences screen (self-service)
[ ] Customer App: Order tracking with preference status
[ ] Customer App: Eco score display
[ ] Customer App: Post-delivery feedback prompt
[ ] Assembly App: Preference display per piece
[ ] Assembly App: Processing confirmation buttons
[ ] All: Upgrade prompt cards for locked features
[ ] All: Feature flag service integration
```

---

*End of Document — V3.1 Monetization, Feature Flags & Settings Specification*
