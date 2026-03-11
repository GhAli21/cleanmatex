# CleanMateX — Order Preferences: Deep Analysis, Improvements & Enhancement Plan

**Document Type**: Architecture & Feature Design Review  
**Date**: March 11, 2026  
**Version**: 2.0 (Updated with "Preferences" naming convention)  
**Scope**: Service Preferences, Packing Preferences, Assembly Integration, Customer Standing Preferences  
**Status**: Design Review with Enhancement Recommendations

---

## NAMING CONVENTION DECISION

After deep analysis considering code readability, Arabic translation, GCC market fit, semantic precision, and namespace collision avoidance, we adopted **"Preferences"** as the universal term with qualifiers:

| Layer | Code Term | UI English | UI Arabic |
|-------|-----------|------------|-----------|
| Processing options (starch, perfume...) | `service_preference` | Service Preferences | تفضيلات الخدمة |
| Packing options (hang, fold...) | `packing_preference` | Packing Preferences | تفضيلات التغليف |
| Customer standing config | `customer_service_prefs` | My Preferences | تفضيلاتي |
| App settings (language, theme...) | `user_preferences` | Settings | الإعدادات |

**Umbrella feature name**: "Order Preferences" / "تفضيلات الطلب"

**Rationale**: "Preferences" is customer-centric, sounds premium in Arabic (تفضيلات), avoids the "optional/might-not-happen" tone of "request," and works naturally in all contexts (counter, customer app, invoice, assembly). Qualified with "service_" and "packing_" to prevent namespace collision with app settings.

---

## 1. EXECUTIVE SUMMARY

The original analysis document (`Order_Special_Requests_Jh_01.md`) provides an excellent foundation covering processing requests, packing methods, assembly station design, tagging, and garment identity. The core architectural decisions are sound — particularly the separation of **processing preferences** from **packing preferences**, and the distinction between **garment identity** (permanent) and **order pieces** (temporary).

After cross-referencing with the existing `schema_06.sql`, the Unified Requirements Pack, and architecture documents, this review identifies **critical gaps, missing tables, enhancement opportunities, and practical implementation concerns** that will make this feature production-ready for CleanMateX as a SaaS platform.

**Key findings:**

- The current schema has **NONE** of the service preference or packing preference tables yet — they need to be designed and added
- The original design is strong but missing **tenant-level customization**, **customer-level standing preferences**, and **pricing engine integration**
- The three-scope model (Order → Item → Piece) should expand to **five scopes** to cover customer preferences and service category defaults
- Assembly and packing need tighter integration with the existing workflow engine (`sys_workflow_template_cd`)
- Several real-world GCC laundry scenarios aren't covered (B2B contract defaults, express service overrides, seasonal preferences)

---

## 2. WHAT THE ORIGINAL DOCUMENT GETS RIGHT (Keep These Decisions)

### 2.1 Separation of Processing Preferences from Packing Preferences

This is the single most important architectural decision and it stands unchanged.

**Why it matters**: In a real laundry plant, the **washing/processing team** and the **assembly/packing team** are different people, at different stations, at different times. If you mix "Starch Heavy" (a processing instruction) with "Hang" (a packing instruction) in the same table, every screen must filter by context. This creates confusion and bugs.

**The correct model:**

```
Processing Instructions  →  sys_service_preference_cd     (starch, perfume, delicate)
Packing Instructions     →  sys_packing_preference_cd     (hang, fold, box)
```

Processing team sees only service preferences. Assembly team sees only packing preferences. Clean separation.

### 2.2 Catalog + Optional Notes (Not Free Text)

Standardized catalog entries with optional notes rather than free-text fields. Critical for:

- **Analytics**: Count how many orders used "Starch Heavy" vs "Starch Light"
- **Automation**: Workflow routing rules match on preference codes, not parse free text
- **i18n**: Each catalog entry has name (English) and name2 (Arabic) — essential for GCC
- **Pricing**: Structured codes have price add-ons; free text cannot

### 2.3 Three-Layer Packing Hierarchy

Packing at three layers (Item default → Piece override → Package grouping) matches real laundry operations. Per-item packing alone is insufficient for assembly.

### 2.4 Garment vs Order Piece Separation

A **garment** is a persistent customer asset while an **order piece** is a temporary processing record. This enables garment history, damage tracking, and repeat-order intelligence.

---

## 3. CRITICAL GAPS IDENTIFIED

### 3.1 GAP: No Customer-Level Standing Preferences

**Problem**: The original document only covers Order, Item, and Piece levels. But in real GCC laundries, customers have **standing preferences** that should auto-apply to every order.

**Real-world examples:**

- "Mr. Ahmed always wants his thobes starched heavily and hung"
- "Al Hilton Hotel contract: all bed sheets folded, all towels rolled"  
- "Mrs. Fatima: perfume on all items, wooden hangers only"

**Enhancement — 5-level hierarchy:**

```
PREFERENCE RESOLUTION HIERARCHY (5 levels):

1. Tenant Default              →  "All dry clean items hang by default"
2. Service Category Default    →  "Express laundry: fold by default"
3. Customer Standing Prefs     →  "Ahmed: always starch heavy"
4. Order Item Level            →  "This order: 5 shirts, fold"
5. Piece Level                 →  "Shirt #3: hang instead of fold"

Resolution Rule: Most specific wins (piece > item > customer > service > tenant)
```

---

### 3.2 GAP: No Tenant-Level Customization of the Catalog

**Problem**: `sys_service_preference_cd` is system-wide. But in multi-tenant SaaS, different laundries need to:

- **Enable/disable** specific preferences (a small laundry doesn't offer "Separate Wash")
- **Set custom prices** per preference (Starch costs 0.100 OMR at one laundry, 0.200 at another)
- **Add custom preferences** unique to their business ("Eco Wash", "Sanitize")

**Enhancement — Two-tier catalog (System + Tenant override):**

```
sys_service_preference_cd       →  System-wide catalog (CleanMateX seeds it)
org_service_preference_cf       →  Tenant overrides (enable/disable, custom price, custom entries)
```

This follows the existing schema pattern:

```
sys_service_category_cd         →  System catalog
org_service_category_cf         →  Tenant configuration
```

---

### 3.3 GAP: Missing from Current Schema (`schema_06.sql`)

| Table / Column | Status | Action |
|----------------|--------|--------|
| `sys_pck_packaging_type_cd` | ✅ EXISTS | Already has BOX, HANGER, BAG (delivery package types) |
| `sys_service_preference_cd` | ❌ MISSING | Must create |
| `sys_packing_preference_cd` | ❌ MISSING | Must create |
| `org_service_preference_cf` | ❌ MISSING | Must create |
| `org_packing_preference_cf` | ❌ MISSING | Must create |
| `org_order_item_service_prefs` | ❌ MISSING | Must create |
| `org_customer_service_prefs` | ❌ MISSING | Must create |
| `org_order_packages` | ❌ MISSING | Must create (future, for assembly) |
| `org_package_pieces` | ❌ MISSING | Must create (future, for assembly) |
| `org_customer_garments_mst` | ❌ MISSING | Must create (future, for garment identity) |
| `org_order_items_dtl.packing_pref_code` | ❌ MISSING column | Must add |
| `org_order_item_pieces_dtl.packing_pref_code` | ❌ MISSING column | Must add |
| `org_product_data_mst.default_packing_pref` | ❌ MISSING column | Must add |

**Important distinction between two existing/new concepts:**

```
Packing Preference (per garment)  =  How individual item is prepared (HANG, FOLD)
                                      NEW: sys_packing_preference_cd

Packaging Type (per package)      =  Container type for delivery (BAG, BOX, HANGER_RACK)
                                      EXISTS: sys_pck_packaging_type_cd
```

A FOLD packing preference goes into a BAG packaging type. A HANG packing preference goes onto a HANGER_RACK packaging type. Two different layers.

---

### 3.4 GAP: No Pricing Engine Integration

**Current pricing flow:**

```
org_product_data_mst.default_sell_price  →  org_order_items_dtl.price_per_unit
```

**Enhanced pricing flow with service preferences:**

```
Base price (from product catalog)
  + Service preference add-ons (from org_order_item_service_prefs)
  + Packing surcharge (if applicable)
  × Express multiplier (if express service)
  - Discounts / Promotions
  = Final item price
```

**Critical rule**: The `org_order_item_service_prefs` table must store the **effective price at order time** (immutable), because catalog prices change but order prices must not.

---

### 3.5 GAP: No Conflict Resolution Rules

**Example conflicts:**

| Scenario | Resolution |
|----------|------------|
| Customer pref: "All items HANG" + Order item: "FOLD" | Order item wins (most specific) |
| "Delicate Handling" + "Heavy Starch" | System should WARN (contradictory) |
| "Separate Wash" + "Express Service" | Warn operator, may violate express SLA |
| "Heavy Starch" + Item: "Silk Dress" | WARN — starch could damage silk |

---

### 3.6 GAP: No B2B Contract Defaults

B2B contracts (hotels, corporate) have **contractual default preferences** that auto-apply:

Example: "Al Hilton contract: all towels folded + banded, all sheets folded, all uniforms hung + light starch."

---

## 4. ENHANCED DATA MODEL (Complete Specification)

### 4.1 System Catalog Tables (Seeded by CleanMateX)

#### `sys_service_preference_cd` — Service Preference Catalog

```sql
CREATE TABLE sys_service_preference_cd (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),                           -- Arabic
    description TEXT,
    description2 TEXT,                             -- Arabic
    preference_category VARCHAR(30) NOT NULL,      -- 'washing','processing','finishing'
    applies_to_fabric_types TEXT[],                -- NULL = all, or {'cotton','polyester'}
    is_incompatible_with TEXT[],                   -- codes that conflict
    default_extra_price NUMERIC(10,3) DEFAULT 0,
    workflow_impact TEXT,                          -- 'separate_batch','add_step','route_to_station'
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
  'System-wide service preference catalog (processing instructions). 
   Tenant overrides stored in org_service_preference_cf.
   These represent HOW to process items: starch, perfume, delicate handling, etc.';

COMMENT ON COLUMN sys_service_preference_cd.preference_category IS 
  'Category determines which operational team sees this preference:
   washing = affects wash cycle (separate wash, delicate, hand wash)
   processing = pre/post treatment (starch, anti-bacterial)
   finishing = final touches (steam press, perfume)';

COMMENT ON COLUMN sys_service_preference_cd.applies_to_fabric_types IS 
  'PostgreSQL text array. NULL means applies to all fabrics.
   Example: ARRAY[''cotton'',''polyester'',''linen'']
   Used for validation: warn if preference is applied to incompatible fabric.';

COMMENT ON COLUMN sys_service_preference_cd.is_incompatible_with IS 
  'Codes that conflict with this preference.
   Example: STARCH_HEAVY.is_incompatible_with = ARRAY[''STARCH_LIGHT'',''DELICATE'']
   System shows warning when incompatible preferences selected together.';

COMMENT ON COLUMN sys_service_preference_cd.workflow_impact IS 
  'How this preference affects workflow routing:
   separate_batch = item must be washed in its own batch
   add_step = additional processing step injected into workflow
   route_to_station = item routed to specific workstation
   NULL = no workflow impact (informational only)';
```

> **LEARNING — PostgreSQL TEXT[] Arrays:**
> `TEXT[]` is a PostgreSQL array column. Instead of creating a junction table for simple lists, you store them directly.
>
> **How to store:** `ARRAY['cotton','polyester','linen']`
>
> **How to query:** `WHERE 'cotton' = ANY(applies_to_fabric_types)`
>
> **How to check overlap:** `WHERE applies_to_fabric_types && ARRAY['cotton','silk']` (the `&&` operator means "arrays overlap")
>
> **When to use arrays vs junction tables:**
> - Use arrays for simple lookup lists that don't need their own relationships
> - Use junction tables when the related items are full entities with their own attributes
>
> In Prisma ORM (your NestJS backend), you'd define this as:
> ```prisma
> model SysServicePreference {
>   code                  String   @id
>   appliesToFabricTypes  String[] @map("applies_to_fabric_types")
>   isIncompatibleWith    String[] @map("is_incompatible_with")
> }
> ```

**Seed data:**

```sql
INSERT INTO sys_service_preference_cd 
  (code, name, name2, preference_category, default_extra_price, workflow_impact, display_order, is_incompatible_with) 
VALUES
  ('STARCH_LIGHT',   'Light Starch',          'نشا خفيف',              'processing', 0.200, 'add_step',         1,  ARRAY['STARCH_HEAVY']),
  ('STARCH_HEAVY',   'Heavy Starch',          'نشا قوي',               'processing', 0.300, 'add_step',         2,  ARRAY['STARCH_LIGHT','DELICATE']),
  ('PERFUME',        'Perfume',               'عطر',                   'finishing',  0.100, 'add_step',         3,  NULL),
  ('SEPARATE_WASH',  'Separate Wash',         'غسيل منفصل',            'washing',    0.500, 'separate_batch',   4,  NULL),
  ('DELICATE',       'Delicate Handling',     'عناية خاصة',            'washing',    0.300, 'route_to_station', 5,  ARRAY['STARCH_HEAVY']),
  ('STEAM_PRESS',    'Steam Press',           'كوي بالبخار',           'finishing',  0.200, 'route_to_station', 6,  NULL),
  ('ANTI_BACTERIAL', 'Anti-Bacterial Wash',   'غسيل مضاد للبكتيريا',   'washing',    0.400, 'add_step',         7,  NULL),
  ('HAND_WASH',      'Hand Wash Only',        'غسيل يدوي فقط',         'washing',    0.500, 'route_to_station', 8,  ARRAY['SEPARATE_WASH']),
  ('BLEACH_FREE',    'No Bleach',             'بدون مبيض',             'washing',    0.000, NULL,               9,  NULL),
  ('ECO_WASH',       'Eco-Friendly Wash',     'غسيل صديق للبيئة',      'washing',    0.300, 'route_to_station', 10, NULL);
```

---

#### `sys_packing_preference_cd` — Packing Preference Catalog

```sql
CREATE TABLE sys_packing_preference_cd (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),                           -- Arabic
    description TEXT,
    description2 TEXT,
    requires_equipment TEXT,                       -- 'hanger','garment_bag','box','tissue_paper'
    maps_to_packaging_type VARCHAR(50),            -- FK to sys_pck_packaging_type_cd (which container)
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

COMMENT ON TABLE sys_packing_preference_cd IS 
  'System-wide packing preferences for individual garments.
   DIFFERENT from sys_pck_packaging_type_cd which defines delivery container types.
   
   Packing Preference = how a SINGLE garment is prepared (HANG, FOLD)
   Packaging Type     = what CONTAINER groups of garments go into (BAG, BOX, HANGER_RACK)
   
   A garment with packing_pref=FOLD goes into packaging_type=BAG.
   A garment with packing_pref=HANG goes into packaging_type=HANGER_RACK.';

COMMENT ON COLUMN sys_packing_preference_cd.maps_to_packaging_type IS 
  'Which delivery packaging type this packing preference typically maps to.
   Used by assembly automation: when piece is HANG, auto-suggest HANGER_RACK package.
   References sys_pck_packaging_type_cd.code.';
```

**Seed data:**

```sql
INSERT INTO sys_packing_preference_cd 
  (code, name, name2, requires_equipment, maps_to_packaging_type, display_order) 
VALUES
  ('HANG',        'Hang on Hanger',    'تعليق على شماعة',      'hanger',        'HANGER',  1),
  ('FOLD',        'Fold',              'طي',                    NULL,            'BAG',     2),
  ('FOLD_TISSUE', 'Fold with Tissue',  'طي مع ورق حرير',       'tissue_paper',  'BAG',     3),
  ('BOX',         'Box',               'تعبئة في صندوق',       'box',           'BOX',     4),
  ('GARMENT_BAG', 'Garment Bag',       'كيس ملابس',            'garment_bag',   'BAG',     5),
  ('VACUUM_SEAL', 'Vacuum Seal',       'تغليف بالتفريغ',       'vacuum_machine','BAG',     6),
  ('ROLL',        'Roll',              'لف',                    NULL,            'BAG',     7);
```

---

### 4.2 Tenant Configuration Tables

#### `org_service_preference_cf` — Tenant Service Preference Overrides

```sql
CREATE TABLE org_service_preference_cf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    preference_code VARCHAR(50) NOT NULL,
    is_system_code BOOLEAN DEFAULT true,          -- true = overriding system code, false = tenant custom
    name VARCHAR(250),                            -- override name (NULL = use system name)
    name2 VARCHAR(250),                           -- override Arabic name
    extra_price NUMERIC(10,3) DEFAULT 0,          -- tenant-specific price
    is_included_in_base BOOLEAN DEFAULT false,    -- true = no extra charge (included in service price)
    applies_to_services TEXT[],                   -- service_category_codes, NULL = all
    applies_to_products TEXT[],                   -- product_codes, NULL = all
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

CREATE POLICY rls_org_service_preference_cf ON org_service_preference_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_service_preference_cf IS 
  'Tenant-level overrides for service preferences.
   Tenants can: enable/disable system preferences, set custom prices,
   add their own custom preferences (is_system_code = false).
   
   If a preference_code exists in sys_service_preference_cd AND here:
     - This table''s values override the system defaults
     - name/name2 override only if not NULL (NULL = use system name)
   
   If is_system_code = false:
     - This is a tenant-created custom preference
     - No matching row in sys_service_preference_cd';

COMMENT ON COLUMN org_service_preference_cf.is_included_in_base IS 
  'If true, this preference has no extra charge — it is included in the base service price.
   Example: A premium laundry might include steam press for free with dry cleaning.
   UI shows: "Steam Press — Included ✓" instead of "+0.200 OMR"';

COMMENT ON COLUMN org_service_preference_cf.applies_to_services IS 
  'Restrict this preference to specific service categories.
   NULL = available for all services.
   Example: ARRAY[''DRY_CLEAN''] means only available for dry cleaning orders.';

CREATE INDEX idx_org_svc_pref_cf_tenant ON org_service_preference_cf(tenant_org_id);
```

> **LEARNING — Row Level Security (RLS):**
> 
> RLS is a PostgreSQL feature that **automatically filters rows** based on the current user's context. Here's how it works step by step:
>
> 1. Your NestJS middleware extracts `tenant_org_id` from the JWT token
> 2. Before running any query, it sets: `SET app.tenant_id = '<uuid>'`
> 3. The RLS policy `USING (tenant_org_id = current_setting('app.tenant_id'))` is automatically appended to every SELECT, UPDATE, DELETE
> 4. Even if your application code forgets `WHERE tenant_org_id = ...`, RLS prevents data leakage
>
> **Why this matters for SaaS**: Without RLS, one bug in your code could show Laundry A's preferences to Laundry B. With RLS, the database itself prevents this — it's your safety net.
>
> In your existing schema, you already have RLS on tables like `org_orders_mst`. Every new `org_*` table must have it too.

#### `org_packing_preference_cf` — Tenant Packing Preference Overrides

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

CREATE POLICY rls_org_packing_preference_cf ON org_packing_preference_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_packing_preference_cf IS 
  'Tenant-level overrides for packing preferences.
   Same pattern as org_service_preference_cf.';

CREATE INDEX idx_org_pck_pref_cf_tenant ON org_packing_preference_cf(tenant_org_id);
```

---

### 4.3 Order-Level Tables

#### `org_order_item_service_prefs` — Applied Service Preferences Per Order Item

```sql
CREATE TABLE org_order_item_service_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL,
    preference_code VARCHAR(50) NOT NULL,
    preference_category VARCHAR(30),               -- denormalized: 'washing','processing','finishing'
    source VARCHAR(30) DEFAULT 'manual',           -- how this was applied
    extra_price NUMERIC(10,3) DEFAULT 0,           -- IMMUTABLE: price at time of order
    is_price_included BOOLEAN DEFAULT false,        -- was it included in base price?
    applied_by UUID,                               -- user who applied/confirmed
    processing_confirmed BOOLEAN DEFAULT false,     -- plant confirmed they did it
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

CREATE POLICY rls_org_order_item_service_prefs ON org_order_item_service_prefs
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_order_item_service_prefs IS 
  'Service preferences applied to order items. 
   Each row = one preference applied to one order item.
   
   CRITICAL: extra_price is captured at order creation time and is IMMUTABLE.
   Even if the catalog price changes later, this order keeps its original price.
   This is called point-in-time pricing and is essential for accounting accuracy.';

COMMENT ON COLUMN org_order_item_service_prefs.source IS 
  'How this preference was applied:
   manual           = cashier explicitly selected it at counter
   customer_pref    = auto-applied from customer standing preferences
   contract_default = auto-applied from B2B contract terms
   auto_rule        = auto-applied by system rule (e.g., "all silk items get delicate")
   
   Source tracking enables analytics: "What % of starch preferences are auto-applied vs manual?"';

COMMENT ON COLUMN org_order_item_service_prefs.processing_confirmed IS 
  'Plant operator confirms this preference was actually applied during processing.
   Creates audit trail: "Heavy starch was requested AND confirmed applied by Ali at 10:32 AM."
   Used for quality control and dispute resolution.';

CREATE INDEX idx_oisp_order_item ON org_order_item_service_prefs(order_item_id);
CREATE INDEX idx_oisp_order ON org_order_item_service_prefs(order_id);
CREATE INDEX idx_oisp_tenant ON org_order_item_service_prefs(tenant_org_id);
CREATE INDEX idx_oisp_pref_code ON org_order_item_service_prefs(preference_code);
```

> **LEARNING — Immutable Pricing (Point-in-Time):**
>
> When you create an order, you capture the price at that moment. If the laundry changes "Heavy Starch" from 0.300 to 0.500 OMR tomorrow, orders placed today must still show 0.300.
>
> This is why `extra_price` is stored on the order table, NOT looked up from the catalog at display time.
>
> **Wrong approach:**
> ```sql
> -- ❌ BAD: Price changes affect historical orders
> SELECT s.default_extra_price FROM sys_service_preference_cd s 
> WHERE s.code = oisp.preference_code;
> ```
>
> **Correct approach:**
> ```sql
> -- ✅ GOOD: Price captured at order creation, never changes
> SELECT oisp.extra_price FROM org_order_item_service_prefs oisp 
> WHERE oisp.order_item_id = $1;
> ```
>
> In your NestJS service, when creating an order, you'd do:
> ```typescript
> // At order creation time, capture the current price
> const catalogPref = await this.getCatalogPreference(tenantId, prefCode);
> await this.prisma.orgOrderItemServicePrefs.create({
>   data: {
>     preference_code: prefCode,
>     extra_price: catalogPref.extra_price,  // Snapshot the price NOW
>     // ... other fields
>   }
> });
> ```

#### Column Additions to Existing Tables

```sql
-- ═══════════════════════════════════════════════════════
-- ADD PACKING PREFERENCE TO ORDER ITEMS
-- ═══════════════════════════════════════════════════════

ALTER TABLE org_order_items_dtl
ADD COLUMN packing_pref_code VARCHAR(50),
ADD COLUMN packing_pref_is_override BOOLEAN DEFAULT false,
ADD COLUMN packing_pref_source VARCHAR(30) DEFAULT 'product_default';

COMMENT ON COLUMN org_order_items_dtl.packing_pref_code IS 
  'Default packing preference for all pieces of this item (HANG, FOLD, etc.).
   NULL means no preference set — use product default or tenant default.';

COMMENT ON COLUMN org_order_items_dtl.packing_pref_is_override IS 
  'True if this was explicitly changed from the default.
   Helps assembly team identify items where customer specifically requested different packing.
   Assembly screen shows: "⚠ Customer requested fold (default was hang)"';

COMMENT ON COLUMN org_order_items_dtl.packing_pref_source IS 
  'Where this packing preference came from:
   product_default  = from org_product_data_mst.default_packing_pref
   customer_pref    = from customer standing preferences
   manual           = cashier explicitly selected
   contract_default = from B2B contract terms';


-- ═══════════════════════════════════════════════════════
-- ADD PACKING PREFERENCE TO PIECES (PER-PIECE OVERRIDE)
-- ═══════════════════════════════════════════════════════

ALTER TABLE org_order_item_pieces_dtl
ADD COLUMN packing_pref_code VARCHAR(50);

COMMENT ON COLUMN org_order_item_pieces_dtl.packing_pref_code IS 
  'Per-piece packing override. NULL = use the parent order item default.
   Used when customer wants mixed packing: "3 shirts hang, 2 shirts fold."
   Only populated when piece packing differs from item default.';


-- ═══════════════════════════════════════════════════════
-- ADD DEFAULT PACKING PREFERENCE TO PRODUCT CATALOG
-- ═══════════════════════════════════════════════════════

ALTER TABLE org_product_data_mst
ADD COLUMN default_packing_pref VARCHAR(50);

COMMENT ON COLUMN org_product_data_mst.default_packing_pref IS 
  'Default packing preference for this product.
   Examples: Shirts default to HANG, Towels default to FOLD, Suits default to GARMENT_BAG.
   Used at order creation: auto-fills packing preference so cashier doesn''t select every time.
   Can be overridden per order item or per piece.';
```

---

### 4.4 Customer Standing Preferences

```sql
CREATE TABLE org_customer_service_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    pref_type VARCHAR(20) NOT NULL,                -- 'service' | 'packing'
    pref_code VARCHAR(50) NOT NULL,                -- preference code
    scope_type VARCHAR(20) DEFAULT 'all',           -- 'all' | 'service_category' | 'product'
    scope_code VARCHAR(120),                        -- the specific code when scope is not 'all'
    priority INTEGER DEFAULT 0,                     -- ordering when multiple preferences match
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

CREATE POLICY rls_org_customer_service_prefs ON org_customer_service_prefs
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_customer_service_prefs IS 
  'Customer standing preferences that auto-apply to every new order.
   
   When a cashier creates an order for this customer, the system:
   1. Loads all active standing preferences for this customer
   2. Matches them against the items being added (by scope)
   3. Auto-applies matching preferences to order items
   4. Shows them in UI with "Auto: Customer preference" indicator
   5. Cashier can override or remove any auto-applied preference
   
   Examples:
     Ahmed: pref_type=service, pref_code=STARCH_HEAVY, scope=all
            (all items get heavy starch)
     Ahmed: pref_type=packing, pref_code=HANG, scope_type=product, scope_code=shirt
            (shirts specifically should be hung)
     Ahmed: pref_type=packing, pref_code=FOLD, scope_type=product, scope_code=towel
            (towels specifically should be folded)';

COMMENT ON COLUMN org_customer_service_prefs.scope_type IS 
  'Determines what this preference applies to:
   all              = every item in every order
   service_category = only items in a specific service (e.g., only dry cleaning)
   product          = only a specific product type (e.g., only shirts)';

COMMENT ON COLUMN org_customer_service_prefs.scope_code IS 
  'The specific code when scope_type is not ''all''.
   For service_category: references sys_service_category_cd.code (e.g., ''DRY_CLEAN'')
   For product: references org_product_data_mst.product_code (e.g., ''shirt'')
   For all: this column is NULL';

CREATE INDEX idx_ocsp_customer ON org_customer_service_prefs(tenant_org_id, customer_id);
CREATE INDEX idx_ocsp_active ON org_customer_service_prefs(tenant_org_id, customer_id, is_active) 
    WHERE is_active = true;
```

> **LEARNING — Partial Index (`WHERE is_active = true`):**
>
> The last index above is a **partial index** — it only indexes rows where `is_active = true`. Since most queries will filter for active preferences, this index is smaller and faster than indexing all rows.
>
> PostgreSQL supports this but MySQL does not. It's one of PostgreSQL's advantages for SaaS applications where you frequently have soft-delete patterns (`is_active`, `rec_status`).

---

### 4.5 B2B Contract Preferences (Future — Phase D)

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

CREATE POLICY rls_org_contract_service_prefs ON org_contract_service_prefs
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_contract_service_prefs IS 
  'B2B contract-level standing preferences. 
   Applies to all orders under this contract.
   Priority: Contract → Customer → Order Item → Piece';
```

---

### 4.6 Compatibility Rules (Future — Phase D)

```sql
CREATE TABLE sys_preference_compatibility_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pref_code_a VARCHAR(50) NOT NULL,
    pref_code_b VARCHAR(50) NOT NULL,
    rule_type VARCHAR(20) NOT NULL,                -- 'incompatible' | 'warning' | 'requires'
    message TEXT,                                   -- English warning message
    message2 TEXT,                                  -- Arabic warning message
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sys_preference_compatibility_rules IS 
  'Rules for preference conflicts.
   incompatible = cannot select both (system blocks)
   warning      = can select both but shows warning to operator
   requires     = selecting A requires B to also be selected';
```

---

## 5. PREFERENCE RESOLUTION ENGINE

### 5.1 Resolution Hierarchy

When a cashier adds an item to an order, the system resolves preferences in this priority:

```
┌─────────────────────────────────────────────────────────┐
│           PREFERENCE RESOLUTION ORDER                    │
│                                                          │
│  1. Piece-level override      (most specific, WINS)      │
│  2. Order item explicit       (cashier selected)         │
│  3. Customer standing prefs   (auto-applied)             │
│  4. Contract default          (B2B only)                 │
│  5. Service category default  (tenant config)            │
│  6. Product catalog default   (product master)           │
│  7. Tenant global default     (tenant settings)          │
│                                                          │
│  Rule: Most specific level wins.                         │
│  Auto-applied preferences are shown but remain editable. │
└─────────────────────────────────────────────────────────┘
```

### 5.2 PostgreSQL Function: Resolve Preferences

```sql
CREATE OR REPLACE FUNCTION resolve_item_preferences(
    p_tenant_org_id UUID,
    p_customer_id UUID,
    p_product_code TEXT,
    p_service_category_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::JSONB;
    v_packing_pref TEXT;
    v_packing_source TEXT := 'system_default';
    v_service_prefs JSONB := '[]'::JSONB;
BEGIN
    -- ═══════════════════════════════════════════════
    -- RESOLVE PACKING PREFERENCE (most specific wins)
    -- ═══════════════════════════════════════════════
    
    -- Level 6: Product catalog default
    SELECT default_packing_pref INTO v_packing_pref
    FROM org_product_data_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND product_code = p_product_code
      AND is_active = true;
    
    IF v_packing_pref IS NOT NULL THEN
        v_packing_source := 'product_default';
    END IF;

    -- Level 3: Customer standing preference (overrides product default)
    DECLARE v_customer_packing TEXT;
    BEGIN
        SELECT pref_code INTO v_customer_packing
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
            CASE scope_type 
                WHEN 'product' THEN 1 
                WHEN 'service_category' THEN 2 
                WHEN 'all' THEN 3 
            END,
            priority DESC
        LIMIT 1;
        
        IF v_customer_packing IS NOT NULL THEN
            v_packing_pref := v_customer_packing;
            v_packing_source := 'customer_pref';
        END IF;
    END;

    -- ═══════════════════════════════════════════════
    -- RESOLVE SERVICE PREFERENCES (gather all applicable)
    -- ═══════════════════════════════════════════════
    
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', cp.pref_code,
        'source', 'customer_pref',
        'extra_price', COALESCE(osp.extra_price, ssp.default_extra_price, 0),
        'is_included', COALESCE(osp.is_included_in_base, false),
        'category', ssp.preference_category
    )), '[]'::JSONB)
    INTO v_service_prefs
    FROM org_customer_service_prefs cp
    LEFT JOIN org_service_preference_cf osp 
        ON osp.tenant_org_id = p_tenant_org_id 
        AND osp.preference_code = cp.pref_code
        AND osp.is_active = true
    LEFT JOIN sys_service_preference_cd ssp
        ON ssp.code = cp.pref_code
    WHERE cp.tenant_org_id = p_tenant_org_id
      AND cp.customer_id = p_customer_id
      AND cp.pref_type = 'service'
      AND cp.is_active = true
      AND (
          (cp.scope_type = 'product' AND cp.scope_code = p_product_code)
          OR (cp.scope_type = 'service_category' AND cp.scope_code = p_service_category_code)
          OR cp.scope_type = 'all'
      );

    -- ═══════════════════════════════════════════════
    -- BUILD RESULT
    -- ═══════════════════════════════════════════════
    
    v_result := jsonb_build_object(
        'packing_pref', COALESCE(v_packing_pref, 'FOLD'),
        'packing_source', v_packing_source,
        'service_preferences', v_service_prefs,
        'resolved_at', NOW()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION resolve_item_preferences IS 
  'Resolves all applicable preferences for an order item based on:
   customer standing preferences, product defaults, and tenant config.
   Returns JSON with packing preference + all service preferences.
   Called at order creation time to auto-fill preferences.
   
   Usage: SELECT resolve_item_preferences(tenant_id, customer_id, ''shirt'', ''LAUNDRY'')
   
   Returns: {
     "packing_pref": "HANG",
     "packing_source": "customer_pref", 
     "service_preferences": [
       {"code": "STARCH_HEAVY", "source": "customer_pref", "extra_price": 0.300, ...}
     ]
   }';
```

> **LEARNING — PostgreSQL Function Volatility (`STABLE`):**
>
> The `STABLE` keyword tells PostgreSQL this function always returns the same result for the same arguments within a single transaction. This allows the query optimizer to cache results and avoid re-executing the function unnecessarily.
>
> Three volatility levels:
> - `VOLATILE` (default) — result can change anytime, even within same transaction
> - `STABLE` — same result within one transaction (our case: reads data, no writes)
> - `IMMUTABLE` — same result forever for same args (e.g., math functions)
>
> Using the right level improves query performance significantly.

---

## 6. UI/UX DESIGN

### 6.1 Counter Screen (Order Creation)

```
┌──────────────────────────────────────────────────────────┐
│  ORDER #1052        Customer: Ahmed Al-Rashidi ⭐ VIP    │
│  Service: Wash & Iron (غسيل وكوي)                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─ Item: Shirt (قميص) ─────────── Qty: [5] ──────────┐ │
│  │                                                      │ │
│  │  📦 Packing Preference:                              │ │
│  │  (•) Hang  ( ) Fold  ( ) Box  ( ) Garment Bag       │ │
│  │  ℹ️ Auto: Customer preference                        │ │
│  │                                                      │ │
│  │  🔧 Service Preferences:          Price Impact:      │ │
│  │  [✓] Heavy Starch                 +0.300 OMR        │ │
│  │      ℹ️ Auto: Customer preference                    │ │
│  │  [ ] Light Starch                  +0.200 OMR        │ │
│  │  [ ] Steam Press                   +0.200 OMR        │ │
│  │  [ ] Perfume                       Included ✓        │ │
│  │  [ ] Separate Wash                 +0.500 OMR        │ │
│  │  [ ] Delicate                      +0.300 OMR        │ │
│  │                                                      │ │
│  │  📝 Note: [Use wooden hangers               ]       │ │
│  │                                                      │ │
│  │  💰 Subtotal: 5 × 2.500 + 1.500 = 14.000 OMR      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  [+ Add Item]    [📄 Per-Piece Details]                  │
│                                                           │
│  ──────────────────────────────────────────────────────── │
│  ORDER TOTAL:  14.000 OMR + 0.700 VAT = 14.700 OMR      │
│  [💾 Save Draft]  [🖨️ Save & Print]  [✅ Confirm Order]  │
└──────────────────────────────────────────────────────────┘
```

**Key UX principles:**

1. **Auto-applied preferences shown with source** — "ℹ️ Auto: Customer preference"
2. **Price impact visible immediately** — cashier sees real-time total change
3. **Included preferences marked clearly** — "Perfume: Included ✓" vs "Starch: +0.300"
4. **Per-Piece Details optional** — accessible but not mandatory for every order
5. **RTL-ready** — layout mirrors for Arabic UI

### 6.2 Assembly Station — Preferences Display

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
│  │                                                      │ │
│  │  📦 PACKING PREFERENCE:                              │ │
│  │     Default: HANG                                    │ │
│  │     Override: FOLD  ⚠ Customer requested fold        │ │
│  │                                                      │ │
│  │  → Package: [PKG2 - Folded Items]  [+ New]          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  PACKAGES:                                                │
│  ┌─ PKG1 (Hanger Rack) ─────────────────────────────┐   │
│  │  Shirt #1 ✓  Shirt #2 ✓  Shirt #5 ✓             │   │
│  └───────────────────────────────────────────────────┘   │
│  ┌─ PKG2 (Plastic Bag) ─────────────────────────────┐   │
│  │  Shirt #3 ✓  Shirt #4 ⏳                         │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  [F1: Hang] [F2: Fold] [F3: New Package] [F5: Close]    │
└──────────────────────────────────────────────────────────┘
```

---

## 7. WORKFLOW ENGINE INTEGRATION

### 7.1 How Service Preferences Affect Workflow Routing

Service preferences **influence** workflow routing but don't **replace** the pipeline:

```
Normal Flow:
  INTAKE → SORTING → WASHING → DRYING → FINISHING → ASSEMBLY → QA → READY

With "Separate Wash" preference:
  INTAKE → SORTING → [SEPARATE_BATCH] → WASHING → DRYING → FINISHING → ASSEMBLY

With "Delicate" preference:
  INTAKE → SORTING → [DELICATE_STATION] → DRYING → FINISHING → ASSEMBLY
```

**NestJS implementation approach:**

```typescript
// apps/api/src/modules/orders/services/preference-routing.service.ts

@Injectable()
export class PreferenceRoutingService {
  
  /**
   * Check service preferences and determine routing.
   * Called by the workflow step handler when processing begins.
   */
  async resolveRouting(
    orderItemId: string, 
    currentStep: string
  ): Promise<RoutingDecision> {
    
    // Fetch active service preferences for this item
    const prefs = await this.prisma.orgOrderItemServicePrefs.findMany({
      where: { 
        order_item_id: orderItemId,
        rec_status: 1 
      }
    });

    const prefCodes = prefs.map(p => p.preference_code);

    // Determine routing based on preferences
    if (prefCodes.includes('SEPARATE_WASH')) {
      return { queue: 'separate_wash', priority: 'high' };
    }
    
    if (prefCodes.includes('DELICATE')) {
      return { queue: 'delicate_station', priority: 'normal' };
    }
    
    if (prefCodes.includes('HAND_WASH')) {
      return { queue: 'hand_wash_station', priority: 'normal' };
    }

    // Default: standard batch processing
    return { queue: 'standard_wash', priority: 'normal' };
  }
}
```

> **LEARNING — NestJS Services with @Injectable():**
>
> In NestJS, `@Injectable()` marks a class as a **service** that can be injected into controllers or other services. This is called **Dependency Injection (DI)**.
>
> **Why it matters:** Instead of creating instances manually (`new PreferenceRoutingService()`), NestJS creates ONE instance and shares it. This ensures all parts of your app use the same service with the same database connection.
>
> **How it works:**
> ```typescript
> // 1. Define the service
> @Injectable()
> export class PreferenceRoutingService { ... }
> 
> // 2. Register in module
> @Module({
>   providers: [PreferenceRoutingService],
>   exports: [PreferenceRoutingService],
> })
> export class OrdersModule {}
> 
> // 3. Inject wherever needed
> @Injectable()
> export class WorkflowStepHandler {
>   constructor(
>     private readonly preferenceRouting: PreferenceRoutingService,
>   ) {}
>   
>   async handleStep(orderItemId: string) {
>     const routing = await this.preferenceRouting.resolveRouting(orderItemId, 'washing');
>     // ...
>   }
> }
> ```

---

## 8. API ENDPOINTS

```
# ═══════════════════════════════════════════════════════
# CATALOG (Read by all, configured by admin)
# ═══════════════════════════════════════════════════════

GET    /v1/catalog/service-preferences
       # Returns merged catalog: system defaults + tenant overrides
       # Filters: ?category=washing&active=true
       # Response includes: code, name, name2, extra_price, is_included, category

GET    /v1/catalog/packing-preferences
       # Returns merged catalog: system defaults + tenant overrides
       # Response includes: code, name, name2, maps_to_packaging_type

# ═══════════════════════════════════════════════════════
# TENANT CONFIGURATION (Admin only)
# ═══════════════════════════════════════════════════════

PUT    /v1/config/service-preferences/:code
       # Enable/disable, set price, override name
       # Body: { extra_price: 0.300, is_active: true, is_included_in_base: false }

PUT    /v1/config/packing-preferences/:code
       # Enable/disable, set price
       # Body: { is_active: true, extra_price: 0 }

POST   /v1/config/service-preferences
       # Create custom tenant-specific preference
       # Body: { code: "SANITIZE", name: "Sanitize", name2: "تعقيم", ... }

# ═══════════════════════════════════════════════════════
# ORDER OPERATIONS
# ═══════════════════════════════════════════════════════

POST   /v1/orders/:orderId/items/:itemId/service-prefs
       # Add service preference to order item
       # Body: { preference_code: "STARCH_HEAVY", notes: "Use wooden hangers" }

DELETE /v1/orders/:orderId/items/:itemId/service-prefs/:prefId
       # Remove service preference from order item

PATCH  /v1/orders/:orderId/items/:itemId/packing-pref
       # Set/change packing preference for order item
       # Body: { packing_pref_code: "HANG" }

GET    /v1/orders/:orderId/preferences-summary
       # Full preferences summary for entire order (all items)

# ═══════════════════════════════════════════════════════
# PREFERENCE RESOLUTION (Called at order creation)
# ═══════════════════════════════════════════════════════

GET    /v1/resolve-preferences
       # ?customer_id=X&product_code=Y&service_category_code=Z
       # Returns resolved preferences from all sources
       # Used by counter screen to auto-fill preferences

# ═══════════════════════════════════════════════════════
# CUSTOMER STANDING PREFERENCES
# ═══════════════════════════════════════════════════════

GET    /v1/customers/:customerId/service-prefs
       # Get all standing preferences for customer

POST   /v1/customers/:customerId/service-prefs
       # Add standing preference
       # Body: { pref_type: "service", pref_code: "STARCH_HEAVY", scope_type: "all" }

DELETE /v1/customers/:customerId/service-prefs/:prefId
       # Remove standing preference

# ═══════════════════════════════════════════════════════
# PROCESSING CONFIRMATION (Plant operations)
# ═══════════════════════════════════════════════════════

POST   /v1/orders/:orderId/items/:itemId/service-prefs/:prefId/confirm
       # Plant operator confirms preference was applied
       # Body: { confirmed: true }
```

---

## 9. ANALYTICS & REPORTING

### 9.1 Metrics Enabled by Preferences

```
Popular Preferences Report:
  - Top 5 service preferences by tenant (by count and revenue)
  - Revenue from add-on preferences (sum of extra_price)
  - Preference-to-complaint correlation

Customer Intelligence:
  - Customers with standing preferences (auto-apply rate)
  - High-value preference customers (extra spend from preferences)
  - Preference change patterns over time

Operational Efficiency:
  - Separate wash batch utilization
  - Delicate station load vs capacity
  - Assembly time impact by packing complexity
  - Confirmation rate (% of preferences actually confirmed by plant)
```

### 9.2 Daily Metrics Table

```sql
CREATE TABLE org_daily_preference_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    metric_date DATE NOT NULL,
    preference_code VARCHAR(50) NOT NULL,
    pref_type VARCHAR(20) NOT NULL,               -- 'service' | 'packing'
    usage_count INTEGER DEFAULT 0,
    revenue_from_prefs NUMERIC(10,3) DEFAULT 0,
    auto_applied_count INTEGER DEFAULT 0,          -- from customer standing prefs
    manual_count INTEGER DEFAULT 0,                -- cashier selected manually
    confirmation_rate NUMERIC(5,2),                -- % confirmed by plant
    UNIQUE(tenant_org_id, metric_date, preference_code)
);

ALTER TABLE org_daily_preference_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_org_daily_pref_metrics ON org_daily_preference_metrics
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 10. IMPLEMENTATION ROADMAP (Phased for Solo Developer)

### Phase A: MVP Foundation (2-3 days)

**Create tables:**
1. `sys_service_preference_cd` + seed data
2. `sys_packing_preference_cd` + seed data
3. `org_order_item_service_prefs`
4. ALTER `org_order_items_dtl` ADD `packing_pref_code`, `packing_pref_is_override`, `packing_pref_source`
5. ALTER `org_product_data_mst` ADD `default_packing_pref`

**Features delivered:**
- ✅ Cashier can select service preferences per item
- ✅ Cashier can select packing preference per item
- ✅ Product has default packing preference (auto-fills)
- ✅ Service preferences add to order total
- ✅ Assembly screen shows packing preferences

### Phase B: Tenant Customization (1-2 days)

**Create tables:**
1. `org_service_preference_cf`
2. `org_packing_preference_cf`

**Features delivered:**
- ✅ Tenant admin enables/disables preferences
- ✅ Tenant admin sets custom prices
- ✅ Tenant admin adds custom preferences

### Phase C: Customer Intelligence (2-3 days)

**Create tables:**
1. `org_customer_service_prefs`
2. `resolve_item_preferences()` function

**Features delivered:**
- ✅ Customer standing preferences auto-apply
- ✅ Cashier sees auto-applied prefs and can override
- ✅ Customer profile shows their preferences

### Phase D: Advanced (Future — Post-MVP)

- Per-piece packing overrides (ALTER `org_order_item_pieces_dtl`)
- Package/bag grouping (`org_order_packages`, `org_package_pieces`)
- Garment identity (`org_customer_garments_mst`)
- B2B contract preferences (`org_contract_service_prefs`)
- Compatibility rules (`sys_preference_compatibility_rules`)
- Processing confirmation flow
- Analytics dashboards
- Daily metrics aggregation

---

## 11. COMPLETE TABLE MAP

```
SYSTEM CATALOGS (seeded by CleanMateX)
├── sys_service_preference_cd        ← NEW: starch, perfume, delicate...
├── sys_packing_preference_cd        ← NEW: hang, fold, box...
├── sys_pck_packaging_type_cd        ← EXISTS: delivery container types
└── sys_preference_compatibility_rules  ← FUTURE: conflict rules

TENANT CONFIGURATION
├── org_service_preference_cf        ← NEW: enable/disable, custom prices
└── org_packing_preference_cf        ← NEW: enable/disable

CUSTOMER LEVEL
├── org_customer_service_prefs       ← NEW: standing preferences
└── org_contract_service_prefs       ← FUTURE: B2B contract defaults

ORDER LEVEL
├── org_order_items_dtl              ← MODIFY: add packing_pref_code columns
│   └── org_order_item_service_prefs ← NEW: applied service preferences
├── org_order_item_pieces_dtl        ← MODIFY: add packing_pref_code column
└── org_order_packages               ← FUTURE: assembly packages
    └── org_package_pieces           ← FUTURE: pieces in packages

ANALYTICS
└── org_daily_preference_metrics     ← NEW: aggregated metrics
```

---

## 12. NAMING REFERENCE (Quick Lookup)

| Context | Code / DB | UI English | UI Arabic |
|---------|-----------|------------|-----------|
| Feature name | `order_preferences` | Order Preferences | تفضيلات الطلب |
| Processing options | `service_preference` | Service Preferences | تفضيلات الخدمة |
| Packing options | `packing_preference` | Packing Preferences | تفضيلات التغليف |
| System catalog (service) | `sys_service_preference_cd` | — | — |
| System catalog (packing) | `sys_packing_preference_cd` | — | — |
| Tenant config (service) | `org_service_preference_cf` | — | — |
| Tenant config (packing) | `org_packing_preference_cf` | — | — |
| Order linkage | `org_order_item_service_prefs` | — | — |
| Customer standing | `org_customer_service_prefs` | My Preferences | تفضيلاتي |
| Counter screen header | — | Service Preferences | تفضيلات الخدمة |
| Customer app section | — | My Preferences | تفضيلاتي الدائمة |
| Assembly screen | — | Processing Preferences | تفضيلات المعالجة |
| Invoice line | — | Additional Services | خدمات إضافية |
| Admin settings page | — | Preferences Catalog | كتالوج التفضيلات |
| App settings (NO collision) | `user_preferences` | Settings | الإعدادات |

---

*End of Document — Version 2.0 with "Preferences" naming convention applied throughout.*
