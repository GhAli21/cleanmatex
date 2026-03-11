# CleanMateX — Order Preferences: Complete Feature Specification

**Document Type**: Architecture & Feature Design — Complete Specification  
**Date**: March 11, 2026  
**Version**: 3.0 (V2 + 15 Enhancement Suggestions Integrated)  
**Scope**: Service Preferences, Packing Preferences, Customer Intelligence, Assembly Integration, Revenue Features  
**Status**: Final Design Specification
**Attached Document**: CleanMateX_Order_Preferences_v3.1_Monetization.md

---

## DOCUMENT CHANGELOG

| Version | Changes |
|---------|---------|
| V1.0 | Initial analysis from original `Order_Special_Requests_Jh_01.md` |
| V2.0 | "Preferences" naming convention applied; 6 gap fixes; complete schema |
| V3.0 | 15 enhancement suggestions integrated: repeat-order, self-service, bundles, SLA impact, smart suggestions, campaigns, tracking visibility, fabric validation, eco scoring, inventory forecasting, fulfillment rating, seasonal templates, changelog audit, WhatsApp parsing, receipt integration |

---

## NAMING CONVENTION

| Layer | Code Term | UI English | UI Arabic |
|-------|-----------|------------|-----------|
| Processing options | `service_preference` | Service Preferences | تفضيلات الخدمة |
| Packing options | `packing_preference` | Packing Preferences | تفضيلات التغليف |
| Customer standing | `customer_service_prefs` | My Preferences | تفضيلاتي |
| Preference bundles | `preference_bundle` | Care Packages | باقات العناية |
| App settings (NO collision) | `user_preferences` | Settings | الإعدادات |
| Feature umbrella | `order_preferences` | Order Preferences | تفضيلات الطلب |

---

## 1. FEATURE OVERVIEW

Order Preferences is the system that allows customers and operators to specify **how items should be processed and packed**. It encompasses two branches:

**Service Preferences** — processing instructions that affect how items are cleaned: starch, perfume, delicate handling, separate wash, etc.

**Packing Preferences** — instructions that affect how items are packed after processing: hang, fold, box, garment bag, etc.

These preferences flow from **multiple sources** (customer standing prefs, product defaults, contract terms, manual selection) and affect **multiple downstream systems** (pricing, workflow routing, assembly, SLA calculation, receipts, notifications, analytics, inventory forecasting, campaigns).

---

## 2. CORE ARCHITECTURE DECISIONS

### 2.1 Processing vs Packing Separation

Processing team and assembly/packing team are different people, at different stations, at different times. Never mix them in the same table.

```
Service Preferences   →  sys_service_preference_cd    (starch, perfume, delicate)
Packing Preferences   →  sys_packing_preference_cd    (hang, fold, box)
```

### 2.2 Catalog + Optional Notes (Never Free Text)

All preferences are standardized catalog entries with bilingual names (EN/AR). Free text kills analytics, automation, and i18n.

### 2.3 Two-Tier Catalog (System + Tenant Override)

```
sys_service_preference_cd     →  CleanMateX seeds this (shared across all tenants)
org_service_preference_cf     →  Each tenant enables/disables, sets prices, adds custom entries
```

### 2.4 Five-Level Preference Hierarchy

```
1. Tenant Default              →  "All dry clean items hang by default"
2. Service Category Default    →  "Express laundry: fold by default"
3. Customer Standing Prefs     →  "Ahmed: always starch heavy"
4. Order Item Level            →  "This order: 5 shirts, fold"
5. Piece Level                 →  "Shirt #3: hang instead of fold"

Resolution: Most specific wins (piece > item > customer > service > tenant)
```

### 2.5 Immutable Pricing at Order Time

Price is captured when the order is created. Catalog price changes never affect historical orders.

---

## 3. COMPLETE DATA MODEL

### 3.1 System Catalogs (Seeded by CleanMateX)

#### `sys_service_preference_cd` — Service Preference Catalog

```sql
CREATE TABLE sys_service_preference_cd (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),                           -- Arabic
    description TEXT,
    description2 TEXT,
    preference_category VARCHAR(30) NOT NULL,      -- 'washing','processing','finishing'
    applies_to_fabric_types TEXT[],                -- NULL = all, or {'cotton','polyester'}
    is_incompatible_with TEXT[],                   -- codes that conflict
    default_extra_price NUMERIC(10,3) DEFAULT 0,
    workflow_impact TEXT,                          -- 'separate_batch','add_step','route_to_station'
    extra_turnaround_minutes INTEGER DEFAULT 0,   -- V3: SLA impact (Enhancement #4)
    sustainability_score INTEGER DEFAULT 0,        -- V3: Eco points (Enhancement #12)
    keywords TEXT[],                               -- V3: NLP aliases for WhatsApp (Enhancement #11)
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(100),
    is_active BOOLEAN DEFAULT true NOT NULL,
    rec_status SMALLINT DEFAULT 1,
    rec_order INTEGER,
    rec_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(120),
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_service_preference_cd IS 
  'System-wide service preference catalog. Tenant overrides in org_service_preference_cf.';

COMMENT ON COLUMN sys_service_preference_cd.preference_category IS 
  'washing = affects wash cycle, processing = pre/post treatment, finishing = final touches';

COMMENT ON COLUMN sys_service_preference_cd.extra_turnaround_minutes IS 
  'Additional time this preference adds to order processing.
   Used by Ready-By calculation to adjust SLA promises.
   Example: SEPARATE_WASH adds 180 min (3 hours) because item needs its own batch.';

COMMENT ON COLUMN sys_service_preference_cd.sustainability_score IS 
  'Eco points awarded when customer selects this preference.
   Positive = eco-friendly (ECO_WASH = +10), Negative = less eco (not used).
   Feeds into UC21 Sustainability Metrics and customer eco badges.';

COMMENT ON COLUMN sys_service_preference_cd.keywords IS 
  'Natural language aliases for WhatsApp/voice order parsing (UC20).
   Example: STARCH_HEAVY.keywords = {starch,heavy starch,نشا,نشا قوي,extra starch}
   The bot matches customer messages against these keywords.';
```

**Seed data:**

```sql
INSERT INTO sys_service_preference_cd 
  (code, name, name2, preference_category, default_extra_price, 
   workflow_impact, extra_turnaround_minutes, sustainability_score, 
   keywords, display_order, is_incompatible_with) 
VALUES
  ('STARCH_LIGHT',   'Light Starch',          'نشا خفيف',
   'processing', 0.200, 'add_step', 0, 0,
   ARRAY['light starch','نشا خفيف','little starch'], 1, ARRAY['STARCH_HEAVY']),

  ('STARCH_HEAVY',   'Heavy Starch',          'نشا قوي',
   'processing', 0.300, 'add_step', 0, 0,
   ARRAY['heavy starch','نشا قوي','extra starch','more starch'], 2, ARRAY['STARCH_LIGHT','DELICATE']),

  ('PERFUME',        'Perfume',               'عطر',
   'finishing', 0.100, 'add_step', 0, -2,
   ARRAY['perfume','fragrance','عطر','smell nice'], 3, NULL),

  ('SEPARATE_WASH',  'Separate Wash',         'غسيل منفصل',
   'washing', 0.500, 'separate_batch', 180, 0,
   ARRAY['separate wash','wash alone','غسيل منفصل','wash separately','لوحده'], 4, NULL),

  ('DELICATE',       'Delicate Handling',     'عناية خاصة',
   'washing', 0.300, 'route_to_station', 60, 0,
   ARRAY['delicate','gentle','عناية خاصة','careful','be careful'], 5, ARRAY['STARCH_HEAVY']),

  ('STEAM_PRESS',    'Steam Press',           'كوي بالبخار',
   'finishing', 0.200, 'route_to_station', 0, 0,
   ARRAY['steam press','steam iron','كوي بالبخار','steam'], 6, NULL),

  ('ANTI_BACTERIAL', 'Anti-Bacterial Wash',   'غسيل مضاد للبكتيريا',
   'washing', 0.400, 'add_step', 30, 0,
   ARRAY['anti bacterial','antibacterial','sanitize','مضاد للبكتيريا','تعقيم'], 7, NULL),

  ('HAND_WASH',      'Hand Wash Only',        'غسيل يدوي فقط',
   'washing', 0.500, 'route_to_station', 120, 5,
   ARRAY['hand wash','wash by hand','غسيل يدوي','يدوي'], 8, ARRAY['SEPARATE_WASH']),

  ('BLEACH_FREE',    'No Bleach',             'بدون مبيض',
   'washing', 0.000, NULL, 0, 3,
   ARRAY['no bleach','bleach free','بدون مبيض','without bleach'], 9, NULL),

  ('ECO_WASH',       'Eco-Friendly Wash',     'غسيل صديق للبيئة',
   'washing', 0.300, 'route_to_station', 30, 10,
   ARRAY['eco wash','eco friendly','صديق للبيئة','green wash','organic'], 10, NULL);
```

---

#### `sys_packing_preference_cd` — Packing Preference Catalog

```sql
CREATE TABLE sys_packing_preference_cd (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),
    description TEXT,
    description2 TEXT,
    requires_equipment TEXT,                       -- 'hanger','garment_bag','box','tissue_paper'
    maps_to_packaging_type VARCHAR(50),            -- FK to sys_pck_packaging_type_cd
    sustainability_score INTEGER DEFAULT 0,        -- V3: Eco points (Enhancement #12)
    consumes_inventory_item TEXT,                  -- V3: Inventory link (Enhancement #13)
    keywords TEXT[],                               -- V3: NLP aliases (Enhancement #11)
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(100),
    is_active BOOLEAN DEFAULT true NOT NULL,
    rec_status SMALLINT DEFAULT 1,
    rec_order INTEGER,
    rec_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(120),
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(120)
);

COMMENT ON COLUMN sys_packing_preference_cd.consumes_inventory_item IS 
  'Links to inventory item consumed by this packing method.
   Example: HANG consumes "hanger" from org_inv_stock_by_branch.
   Used for inventory forecasting: preference usage count × 1 = predicted hanger demand.';

COMMENT ON COLUMN sys_packing_preference_cd.sustainability_score IS 
  'FOLD scores higher than HANG (no plastic hanger waste).
   VACUUM_SEAL scores lowest (uses plastic + energy).';
```

**Seed data:**

```sql
INSERT INTO sys_packing_preference_cd 
  (code, name, name2, requires_equipment, maps_to_packaging_type, 
   sustainability_score, consumes_inventory_item, keywords, display_order) 
VALUES
  ('HANG',        'Hang on Hanger',    'تعليق على شماعة',
   'hanger', 'HANGER', -2, 'hanger',
   ARRAY['hang','hanger','علق','تعليق','شماعة'], 1),

  ('FOLD',        'Fold',              'طي',
   NULL, 'BAG', 5, NULL,
   ARRAY['fold','طي','اطوي'], 2),

  ('FOLD_TISSUE', 'Fold with Tissue',  'طي مع ورق حرير',
   'tissue_paper', 'BAG', 3, 'tissue_paper',
   ARRAY['fold tissue','tissue paper','ورق حرير'], 3),

  ('BOX',         'Box',               'تعبئة في صندوق',
   'box', 'BOX', -3, 'box',
   ARRAY['box','صندوق','in a box'], 4),

  ('GARMENT_BAG', 'Garment Bag',       'كيس ملابس',
   'garment_bag', 'BAG', -1, 'garment_bag',
   ARRAY['garment bag','suit bag','كيس ملابس','cover'], 5),

  ('VACUUM_SEAL', 'Vacuum Seal',       'تغليف بالتفريغ',
   'vacuum_machine', 'BAG', -5, 'vacuum_bag',
   ARRAY['vacuum','vacuum seal','تفريغ'], 6),

  ('ROLL',        'Roll',              'لف',
   NULL, 'BAG', 5, NULL,
   ARRAY['roll','لف'], 7);
```

---

### 3.2 Tenant Configuration Tables

#### `org_service_preference_cf`

```sql
CREATE TABLE org_service_preference_cf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    preference_code VARCHAR(50) NOT NULL,
    is_system_code BOOLEAN DEFAULT true,
    name VARCHAR(250),
    name2 VARCHAR(250),
    extra_price NUMERIC(10,3) DEFAULT 0,
    is_included_in_base BOOLEAN DEFAULT false,
    extra_turnaround_minutes INTEGER,             -- tenant override for SLA impact
    applies_to_services TEXT[],
    applies_to_products TEXT[],
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    rec_status SMALLINT DEFAULT 1,
    rec_order INTEGER,
    rec_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    created_info TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    updated_info TEXT,
    UNIQUE(tenant_org_id, preference_code)
);

ALTER TABLE org_service_preference_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_org_svc_pref_cf ON org_service_preference_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);
CREATE INDEX idx_org_svc_pref_cf_tenant ON org_service_preference_cf(tenant_org_id);
```

#### `org_packing_preference_cf`

```sql
CREATE TABLE org_packing_preference_cf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    packing_pref_code VARCHAR(50) NOT NULL,
    is_system_code BOOLEAN DEFAULT true,
    name VARCHAR(250),
    name2 VARCHAR(250),
    extra_price NUMERIC(10,3) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    rec_status SMALLINT DEFAULT 1,
    rec_order INTEGER,
    rec_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    created_info TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    updated_info TEXT,
    UNIQUE(tenant_org_id, packing_pref_code)
);

ALTER TABLE org_packing_preference_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_org_pck_pref_cf ON org_packing_preference_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);
CREATE INDEX idx_org_pck_pref_cf_tenant ON org_packing_preference_cf(tenant_org_id);
```

---

### 3.3 Order-Level Tables

#### `org_order_item_service_prefs` — Applied Service Preferences

```sql
CREATE TABLE org_order_item_service_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL,
    preference_code VARCHAR(50) NOT NULL,
    preference_category VARCHAR(30),
    source VARCHAR(30) DEFAULT 'manual',           -- 'manual','customer_pref','contract_default',
                                                   -- 'auto_rule','repeat_order','bundle','app_self_service'
    bundle_code VARCHAR(50),                       -- V3: which bundle this came from (Enhancement #7)
    extra_price NUMERIC(10,3) DEFAULT 0,           -- IMMUTABLE: price at time of order
    is_price_included BOOLEAN DEFAULT false,
    applied_by UUID,
    processing_confirmed BOOLEAN DEFAULT false,
    confirmed_by UUID,
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    rec_status SMALLINT DEFAULT 1,
    rec_order INTEGER,
    rec_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    created_info TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    updated_info TEXT,
    branch_id UUID
);

ALTER TABLE org_order_item_service_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_oisp ON org_order_item_service_prefs
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON COLUMN org_order_item_service_prefs.source IS 
  'How this preference was applied:
   manual           = cashier explicitly selected at counter
   customer_pref    = auto-applied from customer standing preferences
   contract_default = auto-applied from B2B contract terms
   auto_rule        = auto-applied by system rule
   repeat_order     = copied from a previous order (Enhancement #1)
   bundle           = applied as part of a care package bundle (Enhancement #7)
   app_self_service = set by customer in the Flutter app (Enhancement #2)';

CREATE INDEX idx_oisp_order_item ON org_order_item_service_prefs(order_item_id);
CREATE INDEX idx_oisp_order ON org_order_item_service_prefs(order_id);
CREATE INDEX idx_oisp_tenant ON org_order_item_service_prefs(tenant_org_id);
CREATE INDEX idx_oisp_pref_code ON org_order_item_service_prefs(preference_code);
```

#### Column Additions to Existing Tables

```sql
-- Packing preference on order items
ALTER TABLE org_order_items_dtl
ADD COLUMN packing_pref_code VARCHAR(50),
ADD COLUMN packing_pref_is_override BOOLEAN DEFAULT false,
ADD COLUMN packing_pref_source VARCHAR(30) DEFAULT 'product_default';

-- Per-piece packing override
ALTER TABLE org_order_item_pieces_dtl
ADD COLUMN packing_pref_code VARCHAR(50);

-- Product default packing
ALTER TABLE org_product_data_mst
ADD COLUMN default_packing_pref VARCHAR(50);
```

---

### 3.4 Customer Standing Preferences

```sql
CREATE TABLE org_customer_service_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    pref_type VARCHAR(20) NOT NULL,                -- 'service' | 'packing'
    pref_code VARCHAR(50) NOT NULL,
    scope_type VARCHAR(20) DEFAULT 'all',           -- 'all' | 'service_category' | 'product'
    scope_code VARCHAR(120),
    set_by VARCHAR(30) DEFAULT 'staff',            -- V3: 'staff' | 'customer_app' (Enhancement #2)
    priority INTEGER DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    rec_status SMALLINT DEFAULT 1,
    rec_order INTEGER,
    rec_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    created_info TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    updated_info TEXT
);

ALTER TABLE org_customer_service_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_ocsp ON org_customer_service_prefs
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON COLUMN org_customer_service_prefs.set_by IS 
  'Who created this standing preference:
   staff        = cashier/admin set it at the counter or in admin panel
   customer_app = customer set it themselves in the Flutter app (Enhancement #2)
   
   UI shows different indicators:
   "Auto: Set by staff" vs "Auto: Set by customer in app"';

CREATE INDEX idx_ocsp_customer ON org_customer_service_prefs(tenant_org_id, customer_id);
CREATE INDEX idx_ocsp_active ON org_customer_service_prefs(tenant_org_id, customer_id, is_active) 
    WHERE is_active = true;
```

---

### 3.5 V3 NEW: Preference Bundles / Care Packages (Enhancement #7)

```sql
CREATE TABLE org_preference_bundles_cf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    bundle_code VARCHAR(50) NOT NULL,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),                            -- Arabic
    description TEXT,
    description2 TEXT,
    bundle_price NUMERIC(10,3),                    -- fixed bundle price (NULL = sum of individual)
    service_pref_codes TEXT[] NOT NULL,             -- e.g. ARRAY['STARCH_HEAVY','PERFUME']
    packing_pref_code VARCHAR(50),                 -- optional packing included in bundle
    applies_to_services TEXT[],                    -- restrict to specific service categories
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(100),
    rec_status SMALLINT DEFAULT 1,
    rec_order INTEGER,
    rec_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    created_info TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    updated_info TEXT,
    UNIQUE(tenant_org_id, bundle_code)
);

ALTER TABLE org_preference_bundles_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_pref_bundles ON org_preference_bundles_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_preference_bundles_cf IS 
  'Pre-built preference combinations that can be applied with one tap.
   Example: "Premium Care" = Heavy Starch + Perfume + Hang at bundle price 0.500
   (individual prices would total 0.600, so customer saves 0.100).
   
   When applied, each individual preference is recorded in org_order_item_service_prefs
   with source=bundle and bundle_code referencing this table.
   
   Bundles can also be promoted in campaigns (Enhancement #6).';
```

**Example seed (tenant creates these in admin):**

```sql
-- Example: Tenant "Al-Noor Laundry" creates these bundles
INSERT INTO org_preference_bundles_cf 
  (tenant_org_id, bundle_code, name, name2, bundle_price, service_pref_codes, packing_pref_code, display_order)
VALUES
  ('tenant-uuid', 'PREMIUM_CARE', 'Premium Care', 'العناية المتميزة',
   0.500, ARRAY['STARCH_HEAVY','PERFUME'], 'HANG', 1),
  
  ('tenant-uuid', 'ECO_CARE', 'Eco Care', 'العناية الصديقة للبيئة',
   0.200, ARRAY['ECO_WASH','BLEACH_FREE'], 'FOLD', 2),
  
  ('tenant-uuid', 'GENTLE_CARE', 'Gentle Care', 'العناية اللطيفة',
   0.800, ARRAY['DELICATE','HAND_WASH'], 'FOLD_TISSUE', 3);
```

---

### 3.6 V3 NEW: Customer Preference Changelog (Enhancement #8)

```sql
CREATE TABLE org_customer_pref_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,                   -- 'added' | 'removed' | 'modified'
    pref_type VARCHAR(20) NOT NULL,                -- 'service' | 'packing'
    pref_code VARCHAR(50) NOT NULL,
    old_value JSONB,                               -- previous state (for modify/remove)
    new_value JSONB,                               -- new state (for add/modify)
    changed_by_type VARCHAR(20) NOT NULL,          -- 'staff' | 'customer_app' | 'system'
    changed_by UUID,                               -- user who made the change
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE org_customer_pref_changelog ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_pref_changelog ON org_customer_pref_changelog
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_customer_pref_changelog IS 
  'Audit trail for customer standing preference changes.
   Answers: "When did Ahmed change from Fold to Hang? Who changed it?"
   
   Populated by trigger on org_customer_service_prefs.
   Used in dispute resolution and customer profile history view.';

CREATE INDEX idx_pref_changelog_customer ON org_customer_pref_changelog(tenant_org_id, customer_id);

-- Trigger to auto-populate changelog
CREATE OR REPLACE FUNCTION fn_log_customer_pref_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO org_customer_pref_changelog 
            (tenant_org_id, customer_id, action, pref_type, pref_code,
             new_value, changed_by_type, changed_by)
        VALUES 
            (NEW.tenant_org_id, NEW.customer_id, 'added', NEW.pref_type, NEW.pref_code,
             to_jsonb(NEW), COALESCE(NEW.set_by, 'staff'), 
             NULLIF(NEW.created_by, '')::UUID);
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO org_customer_pref_changelog
            (tenant_org_id, customer_id, action, pref_type, pref_code,
             old_value, new_value, changed_by_type, changed_by)
        VALUES
            (NEW.tenant_org_id, NEW.customer_id, 'modified', NEW.pref_type, NEW.pref_code,
             to_jsonb(OLD), to_jsonb(NEW), COALESCE(NEW.set_by, 'staff'),
             NULLIF(NEW.updated_by, '')::UUID);
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO org_customer_pref_changelog
            (tenant_org_id, customer_id, action, pref_type, pref_code,
             old_value, changed_by_type)
        VALUES
            (OLD.tenant_org_id, OLD.customer_id, 'removed', OLD.pref_type, OLD.pref_code,
             to_jsonb(OLD), 'staff');
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_pref_changelog
    AFTER INSERT OR UPDATE OR DELETE ON org_customer_service_prefs
    FOR EACH ROW EXECUTE FUNCTION fn_log_customer_pref_change();
```

---

### 3.7 V3 NEW: Seasonal Preference Templates (Enhancement #15)

```sql
CREATE TABLE org_seasonal_pref_templates_cf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    template_code VARCHAR(50) NOT NULL,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),
    description TEXT,
    active_from DATE NOT NULL,
    active_to DATE NOT NULL,
    auto_apply BOOLEAN DEFAULT false,              -- true = auto-apply to matching orders
    applies_to_services TEXT[],
    applies_to_products TEXT[],
    service_pref_codes TEXT[],
    packing_pref_code VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    UNIQUE(tenant_org_id, template_code)
);

ALTER TABLE org_seasonal_pref_templates_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_seasonal_templates ON org_seasonal_pref_templates_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_seasonal_pref_templates_cf IS 
  'Date-activated preference templates for seasonal or occasion-based periods.
   Example: "Eid Premium" active Jun 15-25, auto-applies Perfume + Heavy Starch to formal wear.
   Example: "Ramadan Special" auto-applies Heavy Starch to thobes during Ramadan.
   
   When auto_apply=true, the preference resolution engine checks active templates
   and applies matching preferences with source=auto_rule.';
```

---

### 3.8 V3 NEW: Preference Fulfillment Feedback (Enhancement #14)

```sql
CREATE TABLE org_preference_fulfillment_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    order_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    rating SMALLINT NOT NULL,                      -- 1 = not fulfilled, 5 = perfectly fulfilled
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE org_preference_fulfillment_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_pref_ratings ON org_preference_fulfillment_ratings
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_preference_fulfillment_ratings IS 
  'Post-delivery micro-feedback: "Were your preferences met?"
   Single question, one tap (thumbs up/down or 1-5 scale).
   Aggregated per branch for quality dashboards.
   Links to UC25 Review system.';

CREATE INDEX idx_pref_ratings_branch ON org_preference_fulfillment_ratings(tenant_org_id, order_id);
```

---

### 3.9 V3 NEW: Daily Preference Metrics (Analytics)

```sql
CREATE TABLE org_daily_preference_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    branch_id UUID,
    metric_date DATE NOT NULL,
    preference_code VARCHAR(50) NOT NULL,
    pref_type VARCHAR(20) NOT NULL,                -- 'service' | 'packing'
    usage_count INTEGER DEFAULT 0,
    revenue_from_prefs NUMERIC(10,3) DEFAULT 0,
    auto_applied_count INTEGER DEFAULT 0,
    manual_count INTEGER DEFAULT 0,
    bundle_count INTEGER DEFAULT 0,                -- V3: from bundles
    repeat_order_count INTEGER DEFAULT 0,          -- V3: from repeat-order
    confirmation_rate NUMERIC(5,2),
    fulfillment_avg_rating NUMERIC(3,2),           -- V3: avg from feedback
    sustainability_points_total INTEGER DEFAULT 0, -- V3: eco tracking
    UNIQUE(tenant_org_id, branch_id, metric_date, preference_code)
);

ALTER TABLE org_daily_preference_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_daily_pref_metrics ON org_daily_preference_metrics
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);
```

---

### 3.10 Compatibility Rules (Phase D)

```sql
CREATE TABLE sys_preference_compatibility_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pref_code_a VARCHAR(50) NOT NULL,
    pref_code_b VARCHAR(50) NOT NULL,
    rule_type VARCHAR(20) NOT NULL,                -- 'incompatible' | 'warning' | 'requires'
    message TEXT,
    message2 TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.11 B2B Contract Preferences (Phase D)

```sql
CREATE TABLE org_contract_service_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    contract_id UUID NOT NULL,
    pref_type VARCHAR(20) NOT NULL,
    pref_code VARCHAR(50) NOT NULL,
    scope_type VARCHAR(20) DEFAULT 'all',
    scope_code VARCHAR(120),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE org_contract_service_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_contract_prefs ON org_contract_service_prefs
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 4. PREFERENCE RESOLUTION ENGINE

### 4.1 Resolution with SLA Impact (Enhancement #4)

```sql
CREATE OR REPLACE FUNCTION resolve_item_preferences(
    p_tenant_org_id UUID,
    p_customer_id UUID,
    p_product_code TEXT,
    p_service_category_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_packing_pref TEXT;
    v_packing_source TEXT := 'system_default';
    v_service_prefs JSONB := '[]'::JSONB;
    v_max_extra_turnaround INTEGER := 0;
    v_total_sustainability INTEGER := 0;
BEGIN
    -- ══════════════════════════════════
    -- RESOLVE PACKING PREFERENCE
    -- ══════════════════════════════════
    
    -- Level 6: Product catalog default
    SELECT default_packing_pref INTO v_packing_pref
    FROM org_product_data_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND product_code = p_product_code
      AND is_active = true;
    
    IF v_packing_pref IS NOT NULL THEN
        v_packing_source := 'product_default';
    END IF;

    -- Level 3: Customer standing preference (overrides product)
    DECLARE v_cust_pack TEXT;
    BEGIN
        SELECT pref_code INTO v_cust_pack
        FROM org_customer_service_prefs
        WHERE tenant_org_id = p_tenant_org_id
          AND customer_id = p_customer_id
          AND pref_type = 'packing'
          AND is_active = true
          AND (
              (scope_type = 'product' AND scope_code = p_product_code)
              OR (scope_type = 'service_category' AND scope_code = p_service_category_code)
              OR scope_type = 'all'
          )
        ORDER BY 
            CASE scope_type WHEN 'product' THEN 1 WHEN 'service_category' THEN 2 WHEN 'all' THEN 3 END,
            priority DESC
        LIMIT 1;
        
        IF v_cust_pack IS NOT NULL THEN
            v_packing_pref := v_cust_pack;
            v_packing_source := 'customer_pref';
        END IF;
    END;

    -- Get packing sustainability score
    SELECT COALESCE(sustainability_score, 0) INTO v_total_sustainability
    FROM sys_packing_preference_cd WHERE code = v_packing_pref;

    -- ══════════════════════════════════
    -- RESOLVE SERVICE PREFERENCES
    -- ══════════════════════════════════
    
    SELECT 
        COALESCE(jsonb_agg(jsonb_build_object(
            'code', cp.pref_code,
            'source', 'customer_pref',
            'extra_price', COALESCE(osp.extra_price, ssp.default_extra_price, 0),
            'is_included', COALESCE(osp.is_included_in_base, false),
            'category', ssp.preference_category,
            'extra_minutes', COALESCE(osp.extra_turnaround_minutes, ssp.extra_turnaround_minutes, 0),
            'sustainability', COALESCE(ssp.sustainability_score, 0)
        )), '[]'::JSONB),
        COALESCE(MAX(COALESCE(osp.extra_turnaround_minutes, ssp.extra_turnaround_minutes, 0)), 0),
        v_total_sustainability + COALESCE(SUM(ssp.sustainability_score), 0)
    INTO v_service_prefs, v_max_extra_turnaround, v_total_sustainability
    FROM org_customer_service_prefs cp
    LEFT JOIN org_service_preference_cf osp 
        ON osp.tenant_org_id = p_tenant_org_id AND osp.preference_code = cp.pref_code AND osp.is_active = true
    LEFT JOIN sys_service_preference_cd ssp ON ssp.code = cp.pref_code
    WHERE cp.tenant_org_id = p_tenant_org_id
      AND cp.customer_id = p_customer_id
      AND cp.pref_type = 'service'
      AND cp.is_active = true
      AND (
          (cp.scope_type = 'product' AND cp.scope_code = p_product_code)
          OR (cp.scope_type = 'service_category' AND cp.scope_code = p_service_category_code)
          OR cp.scope_type = 'all'
      );

    -- ══════════════════════════════════
    -- CHECK ACTIVE SEASONAL TEMPLATES (Enhancement #15)
    -- ══════════════════════════════════
    -- (Seasonal auto-apply preferences merged in if active and matching)

    -- ══════════════════════════════════
    -- BUILD RESULT
    -- ══════════════════════════════════
    
    v_result := jsonb_build_object(
        'packing_pref', COALESCE(v_packing_pref, 'FOLD'),
        'packing_source', v_packing_source,
        'service_preferences', v_service_prefs,
        'extra_turnaround_minutes', v_max_extra_turnaround,
        'sustainability_score', v_total_sustainability,
        'resolved_at', NOW()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 4.2 V3 NEW: Smart Suggestion Query (Enhancement #5)

```sql
CREATE OR REPLACE FUNCTION suggest_preferences_from_history(
    p_tenant_org_id UUID,
    p_customer_id UUID,
    p_product_code TEXT,
    p_min_frequency INTEGER DEFAULT 3,
    p_lookback_days INTEGER DEFAULT 90
)
RETURNS JSONB AS $$
DECLARE
    v_suggestions JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', sub.preference_code,
        'usage_count', sub.usage_count,
        'total_orders', sub.total_orders,
        'frequency_pct', ROUND((sub.usage_count::NUMERIC / sub.total_orders * 100), 0)
    )), '[]'::JSONB)
    INTO v_suggestions
    FROM (
        SELECT 
            oisp.preference_code,
            COUNT(*) as usage_count,
            (SELECT COUNT(DISTINCT o2.id) 
             FROM org_orders_mst o2 
             JOIN org_order_items_dtl oi2 ON oi2.order_id = o2.id
             JOIN org_product_data_mst p2 ON p2.id = oi2.product_id
             WHERE o2.customer_id = p_customer_id
               AND o2.tenant_org_id = p_tenant_org_id
               AND p2.product_code = p_product_code
               AND o2.created_at > NOW() - (p_lookback_days || ' days')::INTERVAL
            ) as total_orders
        FROM org_order_item_service_prefs oisp
        JOIN org_order_items_dtl oi ON oi.id = oisp.order_item_id
        JOIN org_product_data_mst p ON p.id = oi.product_id
        JOIN org_orders_mst o ON o.id = oi.order_id
        WHERE o.customer_id = p_customer_id
          AND o.tenant_org_id = p_tenant_org_id
          AND p.product_code = p_product_code
          AND o.created_at > NOW() - (p_lookback_days || ' days')::INTERVAL
          AND oisp.rec_status = 1
        GROUP BY oisp.preference_code
        HAVING COUNT(*) >= p_min_frequency
        ORDER BY COUNT(*) DESC
    ) sub
    WHERE sub.usage_count::NUMERIC / NULLIF(sub.total_orders, 0) > 0.6;

    RETURN v_suggestions;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION suggest_preferences_from_history IS 
  'Returns preferences that appear in >60% of recent orders for a customer+product.
   No ML/AI needed — pure frequency analysis.
   Used by counter screen: "Ahmed usually adds Heavy Starch for Shirts" [+ Apply]';
```

### 4.3 V3 NEW: Repeat Last Order Query (Enhancement #1)

```sql
CREATE OR REPLACE FUNCTION get_last_order_preferences(
    p_tenant_org_id UUID,
    p_customer_id UUID,
    p_limit INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(order_data), '[]'::JSONB)
        FROM (
            SELECT jsonb_build_object(
                'order_id', o.id,
                'order_number', o.order_number,
                'created_at', o.created_at,
                'items', (
                    SELECT jsonb_agg(jsonb_build_object(
                        'product_name', oi.product_name,
                        'product_name2', oi.product_name2,
                        'quantity', oi.quantity,
                        'packing_pref', oi.packing_pref_code,
                        'service_prefs', (
                            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                'code', sp.preference_code,
                                'extra_price', sp.extra_price
                            )), '[]'::JSONB)
                            FROM org_order_item_service_prefs sp
                            WHERE sp.order_item_id = oi.id AND sp.rec_status = 1
                        )
                    ))
                    FROM org_order_items_dtl oi
                    WHERE oi.order_id = o.id AND oi.rec_status = 1
                )
            ) as order_data
            FROM org_orders_mst o
            WHERE o.customer_id = p_customer_id
              AND o.tenant_org_id = p_tenant_org_id
              AND o.order_status NOT IN ('cancelled')
            ORDER BY o.created_at DESC
            LIMIT p_limit
        ) sub
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_last_order_preferences IS 
  'Returns the last N orders with their complete preferences.
   Used by counter screen "Repeat Last Order" button.
   Cashier sees recent orders and can clone any of them with one tap.';
```

---

## 5. READY-BY TIME ADJUSTMENT (Enhancement #4)

When preferences are applied, the Ready-By calculation must account for extra processing time:

```sql
CREATE OR REPLACE FUNCTION calculate_ready_by_with_preferences(
    p_order_id UUID,
    p_tenant_org_id UUID,
    p_base_turnaround_hours NUMERIC
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_max_extra_minutes INTEGER;
    v_total_hours NUMERIC;
BEGIN
    -- Find the maximum extra turnaround from all service preferences on this order
    SELECT COALESCE(MAX(
        COALESCE(osc.extra_turnaround_minutes, ssp.extra_turnaround_minutes, 0)
    ), 0)
    INTO v_max_extra_minutes
    FROM org_order_item_service_prefs oisp
    LEFT JOIN org_service_preference_cf osc 
        ON osc.tenant_org_id = p_tenant_org_id AND osc.preference_code = oisp.preference_code
    LEFT JOIN sys_service_preference_cd ssp ON ssp.code = oisp.preference_code
    WHERE oisp.order_id = p_order_id
      AND oisp.tenant_org_id = p_tenant_org_id
      AND oisp.rec_status = 1;

    -- Total = base turnaround + max preference extra (not sum — they overlap)
    v_total_hours := p_base_turnaround_hours + (v_max_extra_minutes::NUMERIC / 60);

    RETURN NOW() + (v_total_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_ready_by_with_preferences IS 
  'Adjusts Ready-By time based on service preference SLA impact.
   Uses MAX (not SUM) of extra minutes because preferences overlap in processing.
   Example: Separate Wash (+180 min) + Delicate (+60 min) = +180 min total (not 240).
   Prevents false SLA promises when preferences extend processing time.';
```

---

## 6. UI/UX DESIGN

### 6.1 Counter Screen — Full Design with All Enhancements

```
┌──────────────────────────────────────────────────────────────┐
│  ORDER #1052        Customer: Ahmed Al-Rashidi ⭐ VIP        │
│  Service: Wash & Iron (غسيل وكوي)                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📋 RECENT ORDERS:                            [Enhancement #1]│
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Mar 6 — 5 Shirts, 2 Pants (Starch, Hang) [🔄 Repeat]   ││
│  │ Feb 28 — 3 Shirts, 1 Suit (Light Starch)  [🔄 Repeat]   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  📦 CARE PACKAGES:                            [Enhancement #7]│
│  [⭐ Premium Care +0.500] [🌿 Eco Care +0.200] [👶 Gentle]  │
│                                                               │
│  ┌─ Item: Shirt (قميص) ──────────── Qty: [5] ─────────────┐ │
│  │                                                          │ │
│  │  📦 Packing Preference:                                  │ │
│  │  (•) Hang  ( ) Fold  ( ) Box  ( ) Garment Bag           │ │
│  │  ℹ️ Auto: Customer preference (set in app)               │ │
│  │                                                          │ │
│  │  🔧 Service Preferences:            Price Impact:        │ │
│  │  [✓] Heavy Starch                   +0.300 OMR          │ │
│  │      ℹ️ Auto: Customer preference                        │ │
│  │  [ ] Light Starch                    +0.200 OMR          │ │
│  │  [ ] Steam Press                     +0.200 OMR          │ │
│  │  [✓] Perfume                         Included ✓          │ │
│  │      ℹ️ Auto: Bundle "Premium Care"                      │ │
│  │  [ ] Separate Wash                   +0.500 OMR ⏱+3h    │ │
│  │  [ ] Delicate                        +0.300 OMR ⏱+1h    │ │
│  │                                                          │ │
│  │  💡 SUGGESTION:                        [Enhancement #5]  │ │
│  │  "Ahmed usually adds Steam Press for Shirts (80%)"       │ │
│  │  [+ Apply]  [Dismiss]                                    │ │
│  │                                                          │ │
│  │  ⚠️ Fabric check: OK                  [Enhancement #10] │ │
│  │                                                          │ │
│  │  📝 Note: [Use wooden hangers               ]           │ │
│  │  💰 Subtotal: 5 × 2.500 + 1.500 = 14.000 OMR          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  [+ Add Item]    [📄 Per-Piece Details]                      │
│                                                               │
│  ──────────────────────────────────────────────────────────── │
│  Ready By: Today 3:00 PM (adjusted +0h for preferences)      │
│  🌿 Eco Score: +8 points                  [Enhancement #12]  │
│  ORDER TOTAL:  14.000 OMR + 0.700 VAT = 14.700 OMR          │
│  [💾 Save Draft]  [🖨️ Save & Print]  [✅ Confirm Order]      │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Customer App — Self-Service Preferences (Enhancement #2)

```
┌──────────────────────────────────────────────────┐
│  ⚙️ My Preferences  (تفضيلاتي)                   │
│                                                   │
│  📦 Default Packing:                              │
│  (•) Hang    ( ) Fold    ( ) No preference        │
│                                                   │
│  🔧 Always Apply:                                 │
│  [✓] Heavy Starch            for all items        │
│  [✓] Perfume                 for all items        │
│  [ ] Separate Wash                                │
│  [ ] Delicate                                     │
│                                                   │
│  👔 Per-Item Defaults:                             │
│  Shirts     → Hang + Heavy Starch        [Edit]  │
│  Thobes     → Hang + Heavy Starch        [Edit]  │
│  Towels     → Fold                        [Edit]  │
│  [+ Add item preference]                          │
│                                                   │
│  📋 Preference History:           [Enhancement #8]│
│  Mar 10: Added Perfume (you, in app)              │
│  Feb 15: Changed Fold → Hang (you, in app)        │
│  Jan 20: Added Heavy Starch (staff)               │
│                                                   │
│  [Save Preferences]                               │
└──────────────────────────────────────────────────┘
```

### 6.3 Customer App — Order Tracking with Preference Status (Enhancement #9)

```
┌──────────────────────────────────────────────────┐
│  Order #1052                                      │
│                                                   │
│  ● Received           10:30 AM  ✓                │
│  ● Processing         10:45 AM  ✓                │
│    └ Heavy Starch: Applied ✓                     │
│    └ Perfume: Applied ✓                          │
│  ● Finishing          11:30 AM  In Progress      │
│  ○ Assembly           ~12:00 PM                  │
│    └ Packing: Hang                               │
│  ○ Ready              ~1:00 PM                   │
│  ○ Delivery           ~2:30 PM                   │
│                                                   │
│  ✅ Your preferences confirmed:                   │
│  Heavy Starch ✓  Perfume ✓  Hang (pending)       │
│                                                   │
│  🌿 Eco Score: +8 points       [Enhancement #12] │
└──────────────────────────────────────────────────┘
```

### 6.4 Customer App — Post-Delivery Feedback (Enhancement #14)

```
┌──────────────────────────────────────────────────┐
│  Order #1052 — Delivered ✓                        │
│                                                   │
│  Were your preferences met?                       │
│  (Heavy Starch, Perfume, Hang)                    │
│                                                   │
│  [👍 Yes, perfect]     [👎 Not quite]             │
│                                                   │
│  🌿 You earned +8 eco points this order!          │
│  Total eco points: 142                            │
└──────────────────────────────────────────────────┘
```

### 6.5 Receipt / WhatsApp Notification (Enhancement #3)

```
Order #1052 — Ahmed Al-Rashidi
────────────────────────────────
5× Shirt (Wash & Iron)         12.500
   Preferences: Heavy Starch    +1.500
   Packing: Hang
2× Pants (Wash & Iron)          6.000
   Packing: Fold
────────────────────────────────
Subtotal                        20.000
VAT (5%)                         1.000
Total                           21.000
Ready By: Today 3:00 PM
────────────────────────────────
✅ Your preferences confirmed:
   Heavy Starch | Perfume | Hang (Shirts) | Fold (Pants)
🌿 Eco Score: +8 points
```

### 6.6 Assembly Station — Enhanced

```
┌──────────────────────────────────────────────────────────┐
│  🔧 ASSEMBLY STATION                                     │
├──────────────────────────────────────────────────────────┤
│  ORDER: #1052        Customer: Ahmed                      │
│  Progress: ████████░░ 6 / 8 pieces                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  SCAN: [ ▌                                          ]     │
│                                                           │
│  Last Scanned: Shirt #3                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  ⚡ SERVICE PREFERENCES:                             │ │
│  │     • Heavy Starch ✓ (confirmed at processing)       │ │
│  │     • Perfume ✓ (confirmed)                          │ │
│  │                                                      │ │
│  │  📦 PACKING PREFERENCE:                              │ │
│  │     Default: HANG                                    │ │
│  │     Override: FOLD  ⚠ Customer requested fold        │ │
│  │                                                      │ │
│  │  → Package: [PKG2 - Folded Items]  [+ New]          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  [F1: Hang] [F2: Fold] [F3: New Package] [F5: Close]    │
└──────────────────────────────────────────────────────────┘
```

---

## 7. WORKFLOW & SYSTEM INTEGRATION

### 7.1 Workflow Routing Based on Preferences

Service preferences influence workflow routing without replacing the pipeline:

```typescript
// NestJS: PreferenceRoutingService
async resolveRouting(orderItemId: string, currentStep: string): Promise<RoutingDecision> {
    const prefs = await this.getActiveServicePrefs(orderItemId);
    const prefCodes = prefs.map(p => p.preference_code);

    if (prefCodes.includes('SEPARATE_WASH'))  return { queue: 'separate_wash' };
    if (prefCodes.includes('DELICATE'))       return { queue: 'delicate_station' };
    if (prefCodes.includes('HAND_WASH'))      return { queue: 'hand_wash_station' };
    if (prefCodes.includes('ECO_WASH'))       return { queue: 'eco_wash_station' };
    return { queue: 'standard_wash' };
}
```

### 7.2 Inventory Forecasting from Preferences (Enhancement #13)

```sql
-- Weekly hanger demand forecast based on preference usage trends
SELECT 
    pp.consumes_inventory_item AS inventory_item,
    COUNT(*) AS usage_last_7_days,
    ROUND(COUNT(*) * 1.1) AS forecast_next_7_days  -- 10% buffer
FROM org_order_items_dtl oi
JOIN sys_packing_preference_cd pp ON pp.code = oi.packing_pref_code
JOIN org_orders_mst o ON o.id = oi.order_id
WHERE o.tenant_org_id = $1
  AND o.created_at > NOW() - INTERVAL '7 days'
  AND pp.consumes_inventory_item IS NOT NULL
GROUP BY pp.consumes_inventory_item;

-- Result example:
-- hanger       | 342 last week | forecast 376 next week
-- tissue_paper |  89 last week | forecast  98 next week
-- garment_bag  |  45 last week | forecast  50 next week
```

### 7.3 Campaign Targeting from Preferences (Enhancement #6)

```sql
-- Find customers who use starch (for "20% off Heavy Starch" campaign)
SELECT DISTINCT o.customer_id
FROM org_order_item_service_prefs oisp
JOIN org_orders_mst o ON o.id = oisp.order_id
WHERE o.tenant_org_id = $1
  AND oisp.preference_code = 'STARCH_HEAVY'
  AND o.created_at > NOW() - INTERVAL '60 days';

-- Find customers who NEVER used perfume (for "Try Perfume Free" campaign)
SELECT c.id AS customer_id
FROM org_customers_mst c
WHERE c.tenant_org_id = $1
  AND c.id NOT IN (
      SELECT DISTINCT o.customer_id
      FROM org_order_item_service_prefs oisp
      JOIN org_orders_mst o ON o.id = oisp.order_id
      WHERE oisp.preference_code = 'PERFUME'
        AND o.tenant_org_id = $1
  );

-- Find high-value preference customers (for VIP membership invite)
SELECT o.customer_id, SUM(oisp.extra_price) AS total_pref_spend
FROM org_order_item_service_prefs oisp
JOIN org_orders_mst o ON o.id = oisp.order_id
WHERE o.tenant_org_id = $1
  AND o.created_at > NOW() - INTERVAL '90 days'
GROUP BY o.customer_id
HAVING SUM(oisp.extra_price) > 5.000
ORDER BY total_pref_spend DESC;
```

### 7.4 Sustainability / Eco Badge (Enhancement #12)

```sql
-- Monthly eco score per customer
SELECT 
    o.customer_id,
    SUM(COALESCE(ssp.sustainability_score, 0)) + 
    SUM(COALESCE(spp.sustainability_score, 0)) AS monthly_eco_score
FROM org_orders_mst o
JOIN org_order_items_dtl oi ON oi.order_id = o.id
LEFT JOIN org_order_item_service_prefs oisp ON oisp.order_item_id = oi.id
LEFT JOIN sys_service_preference_cd ssp ON ssp.code = oisp.preference_code
LEFT JOIN sys_packing_preference_cd spp ON spp.code = oi.packing_pref_code
WHERE o.tenant_org_id = $1
  AND o.created_at > DATE_TRUNC('month', NOW())
GROUP BY o.customer_id;

-- Eco badge thresholds:
-- 0-20:   🌱 Seedling
-- 21-50:  🌿 Green
-- 51-100: 🌳 Tree
-- 100+:   🌍 Planet Saver
```

---

## 8. API ENDPOINTS (Complete)

```
# ═══════════════════════════════════════
# CATALOG
# ═══════════════════════════════════════
GET    /v1/catalog/service-preferences            # Merged system + tenant
GET    /v1/catalog/packing-preferences            # Merged system + tenant
GET    /v1/catalog/preference-bundles             # V3: Care packages

# ═══════════════════════════════════════
# TENANT CONFIGURATION (Admin)
# ═══════════════════════════════════════
PUT    /v1/config/service-preferences/:code       # Enable/disable, set price
PUT    /v1/config/packing-preferences/:code       # Enable/disable
POST   /v1/config/service-preferences             # Create custom preference
POST   /v1/config/preference-bundles              # V3: Create care package
PUT    /v1/config/preference-bundles/:code        # V3: Update care package
POST   /v1/config/seasonal-templates              # V3: Create seasonal template
PUT    /v1/config/seasonal-templates/:code        # V3: Update seasonal template

# ═══════════════════════════════════════
# ORDER OPERATIONS
# ═══════════════════════════════════════
POST   /v1/orders/:id/items/:itemId/service-prefs             # Add preference
DELETE /v1/orders/:id/items/:itemId/service-prefs/:prefId     # Remove preference
PATCH  /v1/orders/:id/items/:itemId/packing-pref              # Set packing
POST   /v1/orders/:id/items/:itemId/apply-bundle/:bundleCode  # V3: Apply care package
POST   /v1/orders/:id/repeat-from/:sourceOrderId              # V3: Repeat order
GET    /v1/orders/:id/preferences-summary                     # Full summary

# ═══════════════════════════════════════
# PREFERENCE RESOLUTION
# ═══════════════════════════════════════
GET    /v1/resolve-preferences                    # ?customer_id&product_code&service_code
GET    /v1/suggest-preferences                    # V3: History-based suggestions
GET    /v1/customers/:id/recent-order-prefs       # V3: Last N orders with prefs

# ═══════════════════════════════════════
# CUSTOMER PREFERENCES
# ═══════════════════════════════════════
GET    /v1/customers/:id/service-prefs            # Standing preferences
POST   /v1/customers/:id/service-prefs            # Add standing preference
DELETE /v1/customers/:id/service-prefs/:prefId    # Remove standing preference
GET    /v1/customers/:id/pref-changelog           # V3: Preference history

# ═══════════════════════════════════════
# CUSTOMER APP (Self-Service)                      V3: Enhancement #2
# ═══════════════════════════════════════
GET    /v1/me/preferences                          # My standing preferences
PUT    /v1/me/preferences                          # Update my preferences
GET    /v1/me/eco-score                            # V3: My sustainability score

# ═══════════════════════════════════════
# PROCESSING CONFIRMATION
# ═══════════════════════════════════════
POST   /v1/orders/:id/items/:itemId/service-prefs/:prefId/confirm

# ═══════════════════════════════════════
# FEEDBACK                                         V3: Enhancement #14
# ═══════════════════════════════════════
POST   /v1/orders/:id/preference-feedback          # Post-delivery rating
GET    /v1/analytics/preference-fulfillment        # Fulfillment score by branch
```

---

## 9. IMPLEMENTATION ROADMAP

### Phase A: MVP Foundation (2-3 days)

**Create:**
1. `sys_service_preference_cd` + seed data
2. `sys_packing_preference_cd` + seed data
3. `org_order_item_service_prefs`
4. ALTER `org_order_items_dtl` ADD packing columns
5. ALTER `org_product_data_mst` ADD `default_packing_pref`

**Also in MVP (low-effort, high-impact from V3):**
6. Enhancement #1: "Repeat Last Order" query (just a SQL function)
7. Enhancement #3: Preferences on receipts (template modification)
8. Enhancement #4: `extra_turnaround_minutes` column + Ready-By adjustment

**Features delivered:**
- ✅ Cashier selects service preferences per item
- ✅ Cashier selects packing preference per item
- ✅ Product defaults auto-fill
- ✅ Preferences add to order total
- ✅ Ready-By adjusts for preference SLA impact
- ✅ Repeat Last Order button at counter
- ✅ Preferences shown on receipt and WhatsApp notification

---

### Phase B: Tenant Config + Bundles (1-2 days)

**Create:**
1. `org_service_preference_cf`
2. `org_packing_preference_cf`
3. `org_preference_bundles_cf` (Enhancement #7)

**Also in Phase B:**
4. Enhancement #8: Preference changelog (trigger on customer prefs table)
5. Enhancement #10: Fabric validation warnings

**Features delivered:**
- ✅ Tenant admin enables/disables preferences
- ✅ Tenant admin sets custom prices
- ✅ Tenant admin adds custom preferences
- ✅ Care Package bundles (Premium Care, Eco Care, Gentle Care)
- ✅ Preference changelog audit trail
- ✅ Fabric compatibility warnings

---

### Phase C: Customer Intelligence (2-3 days)

**Create:**
1. `org_customer_service_prefs`
2. `org_customer_pref_changelog` + trigger
3. `resolve_item_preferences()` function
4. `suggest_preferences_from_history()` function

**Also in Phase C:**
5. Enhancement #2: Customer self-service prefs in Flutter app
6. Enhancement #5: Smart suggestions at counter
7. Enhancement #9: Preferences visible in customer order tracking

**Features delivered:**
- ✅ Customer standing preferences auto-apply
- ✅ Customer manages own preferences in app
- ✅ Smart suggestions from order history
- ✅ Preferences visible in order tracking with confirmation checkmarks
- ✅ Changelog shows who changed what and when

---

### Phase D: Advanced + Revenue Features (Post-MVP)

**Create:**
1. `org_seasonal_pref_templates_cf` (Enhancement #15)
2. `org_preference_fulfillment_ratings` (Enhancement #14)
3. `org_daily_preference_metrics`
4. `org_contract_service_prefs`
5. `sys_preference_compatibility_rules`
6. Per-piece packing overrides (ALTER pieces table)
7. Package/bag grouping tables

**Also in Phase D:**
8. Enhancement #6: Campaign targeting queries
9. Enhancement #11: WhatsApp preference parsing (keywords)
10. Enhancement #12: Eco score + sustainability badges
11. Enhancement #13: Inventory forecasting from preferences
12. Enhancement #14: Post-delivery fulfillment rating
13. Enhancement #15: Seasonal templates (Ramadan, Eid)
14. Garment identity (`org_customer_garments_mst`)

---

## 10. COMPLETE TABLE MAP

```
SYSTEM CATALOGS (seeded by CleanMateX)
├── sys_service_preference_cd          ← starch, perfume, delicate...
├── sys_packing_preference_cd          ← hang, fold, box...
├── sys_pck_packaging_type_cd          ← EXISTS: delivery container types
└── sys_preference_compatibility_rules ← FUTURE: conflict rules

TENANT CONFIGURATION
├── org_service_preference_cf          ← enable/disable, custom prices
├── org_packing_preference_cf          ← enable/disable
├── org_preference_bundles_cf          ← V3: care packages
└── org_seasonal_pref_templates_cf     ← V3: seasonal auto-apply

CUSTOMER LEVEL
├── org_customer_service_prefs         ← standing preferences
├── org_customer_pref_changelog        ← V3: audit trail
└── org_contract_service_prefs         ← FUTURE: B2B contract defaults

ORDER LEVEL
├── org_order_items_dtl                ← MODIFY: add packing_pref columns
│   └── org_order_item_service_prefs   ← applied service preferences
├── org_order_item_pieces_dtl          ← MODIFY: add packing_pref column
└── org_order_packages                 ← FUTURE: assembly packages
    └── org_package_pieces             ← FUTURE: pieces in packages

FEEDBACK & ANALYTICS
├── org_preference_fulfillment_ratings ← V3: post-delivery feedback
└── org_daily_preference_metrics       ← V3: aggregated analytics

FUNCTIONS
├── resolve_item_preferences()         ← auto-fill at order creation
├── suggest_preferences_from_history() ← V3: smart suggestions
├── get_last_order_preferences()       ← V3: repeat order
├── calculate_ready_by_with_preferences() ← V3: SLA adjustment
└── fn_log_customer_pref_change()      ← V3: changelog trigger
```

---

## 11. ENHANCEMENT CROSS-REFERENCE

| # | Enhancement | Tables/Functions Affected | Phase |
|---|------------|--------------------------|-------|
| 1 | Repeat Last Order | `get_last_order_preferences()` function | MVP |
| 2 | Customer Self-Service in App | `org_customer_service_prefs.set_by` column | C |
| 3 | Preferences on Receipts/WhatsApp | Receipt template modification | MVP |
| 4 | Ready-By SLA Adjustment | `extra_turnaround_minutes` column + function | MVP |
| 5 | Smart Suggestions from History | `suggest_preferences_from_history()` function | C |
| 6 | Preference-Based Campaigns | Query patterns on existing tables | D |
| 7 | Care Package Bundles | `org_preference_bundles_cf` table | B |
| 8 | Preference Changelog | `org_customer_pref_changelog` + trigger | B |
| 9 | Prefs in Order Tracking | `processing_confirmed` column (already in V2) | C |
| 10 | Fabric Validation | Validation logic using `applies_to_fabric_types` | B |
| 11 | WhatsApp Preference Parsing | `keywords` column on catalog tables | D |
| 12 | Eco/Sustainability Scoring | `sustainability_score` column on catalogs | D |
| 13 | Inventory Forecasting | `consumes_inventory_item` column + query | D |
| 14 | Fulfillment Rating | `org_preference_fulfillment_ratings` table | D |
| 15 | Seasonal Templates | `org_seasonal_pref_templates_cf` table | D |

---

## 12. NAMING REFERENCE (Quick Lookup)

| Context | Code / DB | UI English | UI Arabic |
|---------|-----------|------------|-----------|
| Feature name | `order_preferences` | Order Preferences | تفضيلات الطلب |
| Processing options | `service_preference` | Service Preferences | تفضيلات الخدمة |
| Packing options | `packing_preference` | Packing Preferences | تفضيلات التغليف |
| Care packages | `preference_bundle` | Care Packages | باقات العناية |
| System catalog (service) | `sys_service_preference_cd` | — | — |
| System catalog (packing) | `sys_packing_preference_cd` | — | — |
| Tenant config (service) | `org_service_preference_cf` | — | — |
| Tenant config (packing) | `org_packing_preference_cf` | — | — |
| Order linkage | `org_order_item_service_prefs` | — | — |
| Customer standing | `org_customer_service_prefs` | My Preferences | تفضيلاتي |
| Counter screen header | — | Service Preferences | تفضيلات الخدمة |
| Customer app section | — | My Preferences | تفضيلاتي الدائمة |
| Assembly screen | — | Processing Preferences | تفضيلات المعالجة |
| Invoice line | — | Service Preferences | تفضيلات الخدمة |
| Admin settings | — | Preferences Catalog | كتالوج التفضيلات |
| Seasonal templates | — | Seasonal Packages | الباقات الموسمية |
| Eco score | — | Eco Score | نقاط البيئة |
| App settings (NO collision) | `user_preferences` | Settings | الإعدادات |

---

*End of Document — Version 3.0 — Complete Feature Specification with 15 Enhancements*
