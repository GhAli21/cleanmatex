# CleanMateX — Order Special Preferences: Deep Analysis, Improvements & Enhancement Plan

**Document Type**: Architecture & Feature Design Review  
**Date**: March 11, 2026  
**Version**: 1.0  
**Scope**: Special Requests, Packing Preferences, Assembly Integration, Customer Preferences  
**Status**: Design Review with Enhancement Recommendations

---

## 1. EXECUTIVE SUMMARY

Your document (`Order_Special_Requests_Jh_01.md`) is an excellent foundational analysis that covers special requests, packing methods, assembly station design, tagging, and garment identity. The core architectural decisions are sound — particularly the separation of **processing requests** from **packing rules**, and the distinction between **garment identity** (permanent) and **order pieces** (temporary).

However, after cross-referencing with your existing `schema_06.sql`, your Unified Requirements Pack, and your architecture documents, I've identified **critical gaps, missing tables, enhancement opportunities, and practical implementation concerns** that will make this feature production-ready for CleanMateX as a SaaS platform.

**Key findings:**

- Your current schema has **NONE** of the special request or packing method tables yet — they need to be designed and added
- The document's design is strong but missing **tenant-level customization**, **customer-level preferences**, and **pricing engine integration**
- The three-scope model (Order → Item → Piece) should expand to **five scopes** to cover customer preferences and service category defaults
- Assembly and packing need tighter integration with your existing workflow engine (`sys_workflow_template_cd`)
- Several real-world GCC laundry scenarios aren't covered (B2B contract defaults, express service overrides, seasonal preferences)

---

## 2. WHAT THE DOCUMENT GETS RIGHT (Keep These Decisions)

### 2.1 Separation of Processing Requests from Packing Rules

This is the single most important architectural decision in the document and I fully agree with it.

**Why it matters**: In a real laundry plant, the **washing/processing team** and the **assembly/packing team** are different people, at different stations, at different times. If you mix "Starch Heavy" (a processing instruction) with "Hang" (a packing instruction) in the same table, every screen that shows instructions to operators must filter by context. This creates confusion and bugs.

**The correct model (which the document proposes):**

```
Processing Instructions  →  sys_special_request_cd
Packing Instructions     →  sys_packing_method_cd
```

Processing team sees only their relevant requests. Assembly team sees only packing rules. Clean separation.

### 2.2 Catalog + Optional Notes (Not Free Text)

The document correctly recommends standardized catalog entries with optional notes rather than free-text fields. This is critical for:

- **Analytics**: You can count how many orders requested "Starch Heavy" vs "Starch Light"
- **Automation**: Workflow routing rules can match on request codes, not parse free text
- **i18n**: Each catalog entry has name (English) and name2 (Arabic) — essential for your GCC market
- **Pricing**: Structured codes can have price add-ons; free text cannot

### 2.3 Three-Layer Packing Hierarchy

The document's recognition that packing happens at three layers (Item default → Piece override → Package grouping) is correct and matches how real laundries operate. The document correctly identifies that per-item packing alone is insufficient for assembly.

### 2.4 Garment vs Order Piece Separation

This is an advanced concept that most laundry software gets wrong. The document correctly identifies that a **garment** is a persistent customer asset while an **order piece** is a temporary processing record. This enables garment history, damage tracking, and repeat-order intelligence.

---

## 3. CRITICAL GAPS IN THE DOCUMENT

### 3.1 GAP: No Customer-Level Preferences

**Problem**: The document only discusses preferences at Order, Item, and Piece levels. But in real GCC laundries, customers often have **standing preferences** that should auto-apply to every order.

**Real-world examples:**

- "Mr. Ahmed always wants his thobes starched heavily and hung"
- "Al Hilton Hotel contract: all bed sheets folded, all towels rolled"  
- "Mrs. Fatima: perfume on all items, wooden hangers only"

**Enhancement — Add Customer Preference Level:**

```
HIERARCHY (5 levels, not 3):

1. Tenant Default         → "All dry clean items hang by default"
2. Service Category Default → "Express laundry: fold by default"
3. Customer Preference     → "Ahmed: always starch heavy"
4. Order Item Level       → "This order: 5 shirts, fold"
5. Piece Level            → "Shirt #3: hang instead of fold"

Resolution: Most specific wins (piece > item > customer > service > tenant)
```

**New table needed:**

```sql
org_customer_preferences (
    id UUID PRIMARY KEY,
    tenant_org_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    preference_type VARCHAR(20) NOT NULL,  -- 'special_request' | 'packing_method'
    code VARCHAR(50) NOT NULL,             -- references sys_special_request_cd or sys_packing_method_cd
    scope VARCHAR(30),                     -- 'all' | specific service_category_code | specific product_code
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    UNIQUE(tenant_org_id, customer_id, preference_type, code, scope)
);
```

**Operational benefit**: When the cashier creates a new order for Ahmed, the system auto-fills his preferences. The cashier just confirms or overrides. This saves time at the counter (aligns with your KPI: "Intake→receipt < 5 min").

---

### 3.2 GAP: No Tenant-Level Customization of the Catalog

**Problem**: The document proposes `sys_special_request_cd` as a system-wide catalog. But in a multi-tenant SaaS, different laundries need to:

- **Enable/disable** specific requests (a small laundry doesn't offer "Separate Wash")
- **Set custom prices** per request (Starch costs 0.100 OMR at one laundry, 0.200 at another)
- **Add custom requests** unique to their business ("Eco Wash", "Sanitize", "Anti-Bacterial")

**Enhancement — Two-tier catalog (System + Tenant override):**

```
sys_special_request_cd         → System-wide catalog (you seed it)
org_special_request_cf         → Tenant overrides (enable/disable, custom price, custom entries)
```

This follows the same pattern you already use elsewhere in your schema:

```
sys_service_category_cd        → System catalog
org_service_category_cf        → Tenant configuration
```

**New table needed:**

```sql
org_special_request_cf (
    id UUID PRIMARY KEY,
    tenant_org_id UUID NOT NULL,
    request_code VARCHAR(50) NOT NULL,      -- FK to sys_special_request_cd OR custom code
    is_system_code BOOLEAN DEFAULT true,    -- true = overriding system code, false = tenant custom
    name VARCHAR(250),                      -- override name (NULL = use system name)
    name2 VARCHAR(250),                     -- override Arabic name
    extra_price NUMERIC(10,3) DEFAULT 0,    -- tenant-specific price add-on
    is_included_in_base BOOLEAN DEFAULT false, -- true = no extra charge
    applies_to_service_categories TEXT[],   -- NULL = all, or specific codes like {'DRY_CLEAN','LAUNDRY'}
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    UNIQUE(tenant_org_id, request_code)
);
```

Same pattern for packing methods:

```sql
org_packing_method_cf (
    id UUID PRIMARY KEY,
    tenant_org_id UUID NOT NULL,
    packing_method_code VARCHAR(50) NOT NULL,
    is_system_code BOOLEAN DEFAULT true,
    name VARCHAR(250),
    name2 VARCHAR(250),
    extra_price NUMERIC(10,3) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    UNIQUE(tenant_org_id, packing_method_code)
);
```

---

### 3.3 GAP: Missing from Current Schema

After reviewing your `schema_06.sql` (33,101 lines), here's what exists vs what's needed:

| Table | Status | Action |
|-------|--------|--------|
| `sys_pck_packaging_type_cd` | ✅ EXISTS | Already has BOX, HANGER, BAG, ROLL, MIXED |
| `sys_special_request_cd` | ❌ MISSING | Must create |
| `sys_packing_method_cd` | ❌ MISSING | Must create (or extend `sys_pck_packaging_type_cd`) |
| `org_special_request_cf` | ❌ MISSING | Must create |
| `org_packing_method_cf` | ❌ MISSING | Must create |
| `org_order_item_special_requests` | ❌ MISSING | Must create |
| `org_customer_preferences` | ❌ MISSING | Must create |
| `org_order_packages` | ❌ MISSING | Must create (future, for assembly packages) |
| `org_package_pieces` | ❌ MISSING | Must create (future, for assembly packages) |
| `org_customer_garments_mst` | ❌ MISSING | Must create (future, for garment identity) |
| `org_order_items_dtl.packing_method_code` | ❌ MISSING column | Must add |
| `org_order_item_pieces_dtl.packing_method_code` | ❌ MISSING column | Must add |
| `org_product_data_mst.default_packing_method` | ❌ MISSING column | Must add |

**Key observation**: Your existing `sys_pck_packaging_type_cd` table defines package-level types (BOX, HANGER, BAG) which is for the **delivery package/container**. This is different from the **packing method per garment** (HANG, FOLD). These are two separate concepts:

```
Packing Method (per garment)  = How individual item is prepared (HANG, FOLD)
Packaging Type (per package)  = Container type used for delivery (BAG, BOX, HANGER_RACK)
```

---

### 3.4 GAP: No Pricing Engine Integration

**Problem**: The document mentions special requests can have `extra_price` but doesn't address how this integrates with your existing pricing system.

**Your current pricing flow:**

```
org_product_data_mst.default_sell_price  →  org_order_items_dtl.price_per_unit
```

**Enhanced pricing flow with special requests:**

```
Base price (from product catalog)
  + Special request add-ons (from org_order_item_special_requests)
  + Packing surcharge (if applicable)
  × Express multiplier (if express service)
  - Discounts / Promotions
  = Final item price
```

**Implementation approach**: Your existing `calculate_order_total()` PostgreSQL function needs to sum special request prices. This means the `org_order_item_special_requests` table must store the **effective price at order time** (not just reference the catalog price), because catalog prices change but order prices should be immutable.

---

### 3.5 GAP: No Conflict Resolution Rules

**Problem**: What happens when preferences conflict?

**Example conflicts:**

| Scenario | Conflict | Resolution |
|----------|----------|------------|
| Customer pref: "All items HANG" + Order item: "FOLD" | Packing conflict | Order item wins (most specific) |
| Special request: "Separate Wash" + Service: "Express" | May violate express SLA | Warn operator, don't block |
| Customer pref: "Heavy Starch" + Item: "Silk Dress" | Starch could damage silk | System should WARN (fabric incompatibility) |
| "Delicate Handling" + "Heavy Starch" | Contradictory | System should WARN |

**Enhancement — Compatibility Matrix:**

```sql
sys_request_compatibility_rules (
    id UUID PRIMARY KEY,
    request_code_a VARCHAR(50) NOT NULL,
    request_code_b VARCHAR(50) NOT NULL,
    rule_type VARCHAR(20) NOT NULL,  -- 'incompatible' | 'warning' | 'requires'
    message TEXT,
    message2 TEXT,                    -- Arabic
    is_active BOOLEAN DEFAULT true
);
```

**Example seed data:**

```
('STARCH_HEAVY', 'DELICATE', 'incompatible', 'Heavy starch conflicts with delicate handling')
('SEPARATE_WASH', 'EXPRESS_SERVICE', 'warning', 'Separate wash may delay express delivery')
('STARCH_HEAVY', 'STARCH_LIGHT', 'incompatible', 'Cannot apply both starch levels')
```

---

### 3.6 GAP: No B2B Contract Defaults

**Problem**: Your Unified Requirements Pack mentions B2B contracts (hotels, corporate accounts). These customers often have **contractual default preferences** that should auto-apply.

**Example**: "Al Hilton Hotel contract: all towels folded + banded, all sheets folded, all uniforms hung + light starch."

**Enhancement**: Add preferences to the existing contract model:

```sql
org_contract_preferences (
    id UUID PRIMARY KEY,
    tenant_org_id UUID NOT NULL,
    contract_id UUID NOT NULL,
    preference_type VARCHAR(20) NOT NULL,
    code VARCHAR(50) NOT NULL,
    scope VARCHAR(30),               -- product_code or 'all'
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Priority resolution for B2B:**

```
Contract default → Customer preference → Order item → Piece override
```

---

## 4. ENHANCED DATA MODEL (Complete Recommendation)

### 4.1 System Catalog Tables (Seeded by CleanMateX)

#### `sys_special_request_cd` — Processing Request Catalog

```sql
CREATE TABLE sys_special_request_cd (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),                        -- Arabic
    description TEXT,
    description2 TEXT,
    request_category VARCHAR(30) NOT NULL,      -- 'washing','processing','finishing'
    applies_to_fabric_types TEXT[],             -- NULL = all, or {'cotton','polyester'}
    is_incompatible_with TEXT[],               -- codes that conflict
    default_extra_price NUMERIC(10,3) DEFAULT 0,
    workflow_impact TEXT,                       -- 'separate_batch','add_step','route_to_station'
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

COMMENT ON TABLE sys_special_request_cd IS 
  'System-wide processing special request catalog. Tenant overrides in org_special_request_cf.';
COMMENT ON COLUMN sys_special_request_cd.request_category IS 
  'Category: washing (affects wash cycle), processing (pre/post treatment), finishing (press/steam)';
COMMENT ON COLUMN sys_special_request_cd.workflow_impact IS 
  'How this request affects the workflow: separate_batch, add_step, route_to_station';
```

**Seed data:**

```sql
INSERT INTO sys_special_request_cd (code, name, name2, request_category, default_extra_price, workflow_impact, display_order) VALUES
('STARCH_LIGHT',   'Light Starch',       'نشا خفيف',     'processing', 0.200, 'add_step',         1),
('STARCH_HEAVY',   'Heavy Starch',       'نشا قوي',      'processing', 0.300, 'add_step',         2),
('PERFUME',        'Perfume',            'عطر',          'finishing',  0.100, 'add_step',         3),
('SEPARATE_WASH',  'Separate Wash',      'غسيل منفصل',   'washing',    0.500, 'separate_batch',   4),
('DELICATE',       'Delicate Handling',  'عناية خاصة',   'washing',    0.300, 'route_to_station', 5),
('STEAM_PRESS',    'Steam Press',        'كوي بالبخار',  'finishing',  0.200, 'route_to_station', 6),
('ANTI_BACTERIAL', 'Anti-Bacterial Wash','غسيل مضاد للبكتيريا','washing', 0.400, 'add_step',      7),
('HAND_WASH',      'Hand Wash Only',     'غسيل يدوي فقط','washing',    0.500, 'route_to_station', 8),
('BLEACH_FREE',    'No Bleach',          'بدون مبيض',    'washing',    0.000, NULL,               9),
('ECO_WASH',       'Eco-Friendly Wash',  'غسيل صديق للبيئة','washing', 0.300, 'route_to_station',10);
```

> **Learning note**: The `TEXT[]` type in PostgreSQL is an **array column**. Instead of creating a separate junction table for many-to-many relationships (like "which fabric types does this request apply to"), you can store a list directly. Example: `applies_to_fabric_types = ARRAY['cotton','polyester','linen']`. You query it with: `WHERE 'cotton' = ANY(applies_to_fabric_types)`. This is a PostgreSQL-specific feature not available in MySQL. It's great for lookup data that doesn't need its own relationships.

#### `sys_packing_method_cd` — Packing Method Catalog

```sql
CREATE TABLE sys_packing_method_cd (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    name2 VARCHAR(250),
    description TEXT,
    description2 TEXT,
    requires_equipment TEXT,                   -- 'hanger','garment_bag','box'
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

COMMENT ON TABLE sys_packing_method_cd IS 
  'System-wide packing methods for individual garments. Different from packaging types (container-level).';

INSERT INTO sys_packing_method_cd (code, name, name2, requires_equipment, display_order) VALUES
('HANG',        'Hang on Hanger',      'تعليق على شماعة',  'hanger',       1),
('FOLD',        'Fold',                'طي',               NULL,            2),
('FOLD_TISSUE', 'Fold with Tissue',    'طي مع ورق حرير',  'tissue_paper',  3),
('BOX',         'Box',                 'تعبئة في صندوق',   'box',           4),
('GARMENT_BAG', 'Garment Bag',         'كيس ملابس',       'garment_bag',   5),
('VACUUM_SEAL', 'Vacuum Seal',         'تغليف بالتفريغ',   'vacuum_machine',6),
('ROLL',        'Roll',                'لف',               NULL,            7);
```

> **Important distinction to understand**:
> - `sys_packing_method_cd` = How a single garment is prepared (HANG, FOLD) — **garment level**
> - `sys_pck_packaging_type_cd` = What container groups of garments go into (BAG, BOX, HANGER_RACK) — **delivery package level**
> 
> A FOLD packing method might go into a BAG packaging type. A HANG packing method goes onto a HANGER_RACK packaging type. These are two different layers.

---

### 4.2 Tenant Configuration Tables

#### `org_special_request_cf` — Tenant Special Request Overrides

```sql
CREATE TABLE org_special_request_cf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    request_code VARCHAR(50) NOT NULL,
    is_system_code BOOLEAN DEFAULT true,
    name VARCHAR(250),
    name2 VARCHAR(250),
    extra_price NUMERIC(10,3) DEFAULT 0,
    is_included_in_base BOOLEAN DEFAULT false,
    applies_to_services TEXT[],              -- service_category_codes
    applies_to_products TEXT[],              -- product_codes
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    UNIQUE(tenant_org_id, request_code)
);

-- RLS Policy (Critical for multi-tenancy!)
ALTER TABLE org_special_request_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON org_special_request_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);
```

> **Learning note about RLS (Row Level Security)**:
> RLS is a PostgreSQL feature that automatically filters rows based on the current user's context. When you set `app.tenant_id` in the connection (your JWT middleware does this), every query against this table automatically adds `WHERE tenant_org_id = <current_tenant>`. Even if your application code forgets the WHERE clause, RLS prevents data leakage between tenants. This is your most critical security layer in a multi-tenant SaaS.

#### `org_packing_method_cf` — Tenant Packing Method Overrides

```sql
CREATE TABLE org_packing_method_cf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    packing_method_code VARCHAR(50) NOT NULL,
    is_system_code BOOLEAN DEFAULT true,
    name VARCHAR(250),
    name2 VARCHAR(250),
    extra_price NUMERIC(10,3) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    UNIQUE(tenant_org_id, packing_method_code)
);

ALTER TABLE org_packing_method_cf ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON org_packing_method_cf
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);
```

---

### 4.3 Order-Level Tables

#### `org_order_item_special_requests` — Applied Special Requests

```sql
CREATE TABLE org_order_item_special_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL,
    request_code VARCHAR(50) NOT NULL,
    source VARCHAR(30) DEFAULT 'manual',       -- 'manual','customer_pref','contract_default','auto_rule'
    extra_price NUMERIC(10,3) DEFAULT 0,       -- Price AT TIME OF ORDER (immutable)
    is_price_included BOOLEAN DEFAULT false,   -- Was it included in base price?
    applied_by UUID,                           -- User who applied it
    notes TEXT,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    branch_id UUID
);

ALTER TABLE org_order_item_special_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON org_order_item_special_requests
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX idx_oisr_order_item ON org_order_item_special_requests(order_item_id);
CREATE INDEX idx_oisr_order ON org_order_item_special_requests(order_id);
CREATE INDEX idx_oisr_tenant ON org_order_item_special_requests(tenant_org_id);

COMMENT ON TABLE org_order_item_special_requests IS 
  'Special processing requests attached to order items. Price recorded at order time (immutable).';
COMMENT ON COLUMN org_order_item_special_requests.source IS 
  'How this request was applied: manual (cashier selected), customer_pref (auto from customer profile), contract_default (B2B contract), auto_rule (system rule)';
COMMENT ON COLUMN org_order_item_special_requests.extra_price IS 
  'Price captured at order creation time. Even if catalog price changes later, this order''s price stays fixed.';
```

> **Learning note about immutable pricing**: When you create an order, you capture the price at that moment. If the laundry changes their "Heavy Starch" price from 0.300 to 0.500 tomorrow, orders placed today should still show 0.300. This is why `extra_price` is stored on the order-level table, not looked up from the catalog. This principle is called **point-in-time pricing** and it's critical for accounting accuracy.

#### Column additions to existing tables:

```sql
-- Add packing method to order items
ALTER TABLE org_order_items_dtl
ADD COLUMN packing_method_code VARCHAR(50),
ADD COLUMN packing_method_is_override BOOLEAN DEFAULT false;

COMMENT ON COLUMN org_order_items_dtl.packing_method_code IS 
  'Default packing method for all pieces of this item (HANG, FOLD, etc.)';
COMMENT ON COLUMN org_order_items_dtl.packing_method_is_override IS 
  'True if customer explicitly requested this (overrides product default)';

-- Add packing method to pieces (for per-piece override)
ALTER TABLE org_order_item_pieces_dtl
ADD COLUMN packing_method_code VARCHAR(50);

COMMENT ON COLUMN org_order_item_pieces_dtl.packing_method_code IS 
  'Per-piece packing override. NULL = use order item default.';

-- Add default packing method to product catalog
ALTER TABLE org_product_data_mst
ADD COLUMN default_packing_method VARCHAR(50);

COMMENT ON COLUMN org_product_data_mst.default_packing_method IS 
  'Default packing method for this product (e.g., HANG for shirts, FOLD for towels)';
```

---

### 4.4 Customer Preferences Table

```sql
CREATE TABLE org_customer_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    preference_type VARCHAR(20) NOT NULL,      -- 'special_request' | 'packing_method'
    code VARCHAR(50) NOT NULL,
    scope_type VARCHAR(20) DEFAULT 'all',      -- 'all' | 'service_category' | 'product'
    scope_code VARCHAR(120),                   -- service_category_code or product_code
    priority INTEGER DEFAULT 0,                -- for ordering when multiple prefs apply
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    rec_status SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    UNIQUE(tenant_org_id, customer_id, preference_type, code, scope_type, COALESCE(scope_code, '__ALL__'))
);

ALTER TABLE org_customer_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON org_customer_preferences
    FOR ALL USING (tenant_org_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE org_customer_preferences IS 
  'Standing customer preferences that auto-apply to new orders. Cashier can override per order.';
```

**Example data:**

```
Ahmed (customer):
  - preference_type: 'special_request', code: 'STARCH_HEAVY', scope: 'all'
  - preference_type: 'packing_method', code: 'HANG', scope_type: 'product', scope_code: 'shirt'
  - preference_type: 'packing_method', code: 'FOLD', scope_type: 'product', scope_code: 'towel'
```

---

## 5. PREFERENCE RESOLUTION ENGINE

This is where it all comes together. When a cashier adds an item to an order, the system must resolve which preferences apply, in this priority order:

```
┌─────────────────────────────────────────────────────┐
│              PREFERENCE RESOLUTION ORDER              │
│                                                       │
│  1. Piece-level override    (most specific, wins)     │
│  2. Order item explicit     (cashier selected)        │
│  3. Customer preference     (auto-applied)            │
│  4. Contract default        (B2B only)                │
│  5. Service category default(tenant config)           │
│  6. Product catalog default (product master)          │
│  7. Tenant global default   (tenant settings)         │
│                                                       │
│  Rule: Most specific level wins.                      │
│  Auto-applied prefs are shown but editable.           │
└─────────────────────────────────────────────────────┘
```

### PostgreSQL Function for Preference Resolution:

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
    v_packing_method TEXT;
    v_special_requests JSONB := '[]'::JSONB;
BEGIN
    -- 1. Start with product default packing method
    SELECT default_packing_method INTO v_packing_method
    FROM org_product_data_mst
    WHERE tenant_org_id = p_tenant_org_id
      AND product_code = p_product_code
      AND is_active = true;

    -- 2. Check customer packing preference for this product
    SELECT code INTO v_packing_method
    FROM org_customer_preferences
    WHERE tenant_org_id = p_tenant_org_id
      AND customer_id = p_customer_id
      AND preference_type = 'packing_method'
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
        END
    LIMIT 1;

    -- 3. Gather customer special requests
    SELECT jsonb_agg(jsonb_build_object(
        'code', cp.code,
        'source', 'customer_pref',
        'extra_price', COALESCE(osr.extra_price, 0)
    ))
    INTO v_special_requests
    FROM org_customer_preferences cp
    LEFT JOIN org_special_request_cf osr 
        ON osr.tenant_org_id = p_tenant_org_id 
        AND osr.request_code = cp.code
    WHERE cp.tenant_org_id = p_tenant_org_id
      AND cp.customer_id = p_customer_id
      AND cp.preference_type = 'special_request'
      AND cp.is_active = true;

    -- Build result
    v_result := jsonb_build_object(
        'packing_method', v_packing_method,
        'packing_source', CASE 
            WHEN v_packing_method IS NOT NULL THEN 'customer_pref'
            ELSE 'product_default'
        END,
        'special_requests', COALESCE(v_special_requests, '[]'::JSONB)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

> **Learning note about PostgreSQL Functions (plpgsql)**: This is server-side code that runs inside the database. Instead of making multiple API calls from NestJS to resolve preferences, you make ONE call to this function and it returns everything. This is faster because the data doesn't leave the database. In NestJS/Prisma, you'd call it like:
> ```typescript
> const result = await prisma.$queryRaw`
>   SELECT resolve_item_preferences(${tenantId}::uuid, ${customerId}::uuid, ${productCode}, ${serviceCode})
> `;
> ```

---

## 6. UI/UX DESIGN RECOMMENDATIONS

### 6.1 Counter Screen (Order Creation) — Enhanced Design

The document's UI example is functional but needs improvement for speed and GCC-specific UX.

```
┌──────────────────────────────────────────────────────────┐
│  ORDER #1052        Customer: Ahmed Al-Rashidi ⭐ VIP    │
│  Service: Wash & Iron                                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─ Item: Shirt (قميص) ─────────── Qty: [5] ──────────┐ │
│  │                                                      │ │
│  │  📦 Packing: (•) Hang  ( ) Fold  ( ) Box            │ │
│  │     ℹ️ Customer prefers: Hang (auto-applied)         │ │
│  │                                                      │ │
│  │  🔧 Special Requests:              Price Impact:     │ │
│  │  [✓] Heavy Starch                  +0.300 OMR       │ │
│  │      ℹ️ Auto: Customer preference                    │ │
│  │  [ ] Light Starch                   +0.200 OMR       │ │
│  │  [ ] Steam Press                    +0.200 OMR       │ │
│  │  [ ] Perfume                        Included ✓       │ │
│  │  [ ] Separate Wash                  +0.500 OMR       │ │
│  │  [ ] Delicate                       +0.300 OMR       │ │
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

1. **Auto-applied preferences shown with source indicator** ("Auto: Customer preference")
2. **Price impact visible immediately** — cashier sees real-time total change
3. **Included requests marked clearly** — "Perfume: Included ✓" vs "Starch: +0.300"
4. **Per-Piece Details available but NOT mandatory** — most orders use item-level defaults
5. **RTL-ready layout** — the layout should mirror for Arabic UI

### 6.2 Per-Piece Detail Popup (When Cashier Clicks "Per-Piece Details")

```
┌────────────────────────────────────────────────────┐
│  Shirt × 5 — Per-Piece Packing                     │
│                                                     │
│  Default: Hang                                      │
│  [ ] Apply default to all                           │
│                                                     │
│  Piece 1: (•) Hang  ( ) Fold  ( ) Box              │
│  Piece 2: (•) Hang  ( ) Fold  ( ) Box              │
│  Piece 3: ( ) Hang  (•) Fold  ( ) Box    ⚠ Override│
│  Piece 4: ( ) Hang  (•) Fold  ( ) Box    ⚠ Override│
│  Piece 5: (•) Hang  ( ) Fold  ( ) Box              │
│                                                     │
│  Summary: 3 Hang, 2 Fold                           │
│                                                     │
│  [Cancel]  [Apply]                                  │
└────────────────────────────────────────────────────┘
```

### 6.3 Assembly Station — Enhanced with Preferences Display

```
┌──────────────────────────────────────────────────────────┐
│  🔧 ASSEMBLY STATION — Plant MCT-01                      │
├──────────────────────────────────────────────────────────┤
│  ORDER: #1052        Customer: Ahmed                      │
│  Progress: ████████░░ 6 / 8 pieces                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  SCAN: [ ▌                                          ]     │
│                                                           │
│  Last Scanned: Shirt #3                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  ⚡ SPECIAL REQUESTS:                                │ │
│  │     • Heavy Starch ✓ (confirmed at processing)       │ │
│  │                                                      │ │
│  │  📦 PACKING:                                         │ │
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
│  ┌─ PKG3 (Suit Cover) ──────────────────────────────┐   │
│  │  (empty - waiting for suit)                       │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ⚠ MISSING: Shirt #4, Suit #1                           │
│                                                           │
│  [F1: Hang] [F2: Fold] [F3: New Package] [F5: Close]    │
└──────────────────────────────────────────────────────────┘
```

---

## 7. WORKFLOW ENGINE INTEGRATION

### 7.1 How Special Requests Affect Workflow Routing

Your existing `sys_workflow_template_stages` and `sys_workflow_template_transitions` tables define the processing pipeline. Special requests should **influence** but not **replace** this pipeline.

```
Normal Flow:
  INTAKE → SORTING → WASHING → DRYING → FINISHING → ASSEMBLY → QA → READY

With "Separate Wash":
  INTAKE → SORTING → [SEPARATE_BATCH] → WASHING → DRYING → FINISHING → ASSEMBLY → QA → READY

With "Delicate":
  INTAKE → SORTING → [DELICATE_STATION] → DRYING → FINISHING → ASSEMBLY → QA → READY
```

**Implementation approach**: Rather than modifying the workflow template dynamically (complex, fragile), add a **routing hints** concept:

```sql
-- Add to org_order_item_processing_steps or use metadata
-- The step worker checks for active special requests and routes accordingly
```

In your NestJS backend, the processing step handler would check:

```typescript
// Pseudo-code for the washing step handler
async handleWashingStep(orderItem: OrderItem) {
  const requests = await this.getActiveSpecialRequests(orderItem.id);
  
  if (requests.includes('SEPARATE_WASH')) {
    // Route to separate wash queue
    await this.assignToQueue('separate_wash', orderItem);
  } else if (requests.includes('DELICATE')) {
    // Route to delicate handling station
    await this.assignToQueue('delicate_station', orderItem);
  } else {
    // Normal batch processing
    await this.assignToQueue('standard_wash', orderItem);
  }
}
```

> **Learning note about NestJS**: NestJS is a Node.js framework that structures your backend code using modules, controllers, and services — similar to Angular's architecture. Each "module" (like OrdersModule) contains a controller (handles HTTP requests) and services (contains business logic). The code above would live in an `OrderProcessingService`. NestJS uses TypeScript, which gives you type safety and autocompletion in Cursor AI.

### 7.2 Special Request Confirmation at Processing

Processing team should **confirm** that special requests were applied:

```sql
ALTER TABLE org_order_item_special_requests
ADD COLUMN processing_confirmed BOOLEAN DEFAULT false,
ADD COLUMN confirmed_by UUID,
ADD COLUMN confirmed_at TIMESTAMPTZ;
```

This creates an audit trail: "Starch Heavy was requested AND confirmed applied by Operator Ali at 10:32 AM."

---

## 8. ANALYTICS & REPORTING ENHANCEMENTS

### 8.1 What Analytics Special Requests Enable

```
Popular Requests Report:
  - Top 5 special requests by tenant (by count)
  - Revenue from add-on services (extra_price sum)
  - Request-to-complaint correlation (do starch requests cause more issues?)

Customer Intelligence:
  - Customers with standing preferences (% of orders auto-applied)
  - Preference change patterns (customer stopped requesting starch)
  - High-value add-on customers (spend more on extras)

Operational Efficiency:
  - Separate wash batch utilization
  - Delicate station load vs capacity
  - Assembly time impact by packing complexity
```

### 8.2 Suggested Metrics Aggregation

Add to your existing `org_daily_metrics` pattern:

```sql
-- Daily special request metrics (for dashboards)
CREATE TABLE org_daily_request_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_org_id UUID NOT NULL,
    metric_date DATE NOT NULL,
    request_code VARCHAR(50) NOT NULL,
    request_count INTEGER DEFAULT 0,
    revenue_from_addons NUMERIC(10,3) DEFAULT 0,
    UNIQUE(tenant_org_id, metric_date, request_code)
);
```

---

## 9. IMPLEMENTATION ROADMAP (Phased Approach)

Given that you're solo and this is a SaaS product, here's the recommended implementation order:

### Phase A: MVP Foundation (Do First — Week X)

**Tables to create:**

1. `sys_special_request_cd` (system catalog with seed data)
2. `sys_packing_method_cd` (system catalog with seed data)
3. `org_order_item_special_requests` (order-level linkage)
4. ALTER `org_order_items_dtl` ADD `packing_method_code`
5. ALTER `org_product_data_mst` ADD `default_packing_method`

**Features:**

- Cashier can select special requests per item ✓
- Cashier can select packing method per item ✓
- Product has default packing method ✓
- Special requests add to order total ✓
- Assembly screen shows packing instructions ✓

**Effort estimate**: 2-3 days for schema + API + basic UI integration

### Phase B: Tenant Customization (Do Second — Week X+1)

**Tables to create:**

1. `org_special_request_cf` (tenant overrides)
2. `org_packing_method_cf` (tenant overrides)

**Features:**

- Tenant admin can enable/disable requests ✓
- Tenant admin can set custom prices ✓
- Tenant admin can add custom requests ✓

**Effort estimate**: 1-2 days

### Phase C: Customer Intelligence (Do Third — Week X+2)

**Tables to create:**

1. `org_customer_preferences`

**Features:**

- Customer standing preferences auto-apply ✓
- Cashier sees auto-applied prefs and can override ✓
- Customer profile shows their preferences ✓

**Effort estimate**: 2-3 days

### Phase D: Advanced (Future — Post-MVP)

- Per-piece packing overrides (ALTER pieces table)
- Package/bag grouping (`org_order_packages`, `org_package_pieces`)
- Garment identity (`org_customer_garments_mst`)
- B2B contract defaults
- Compatibility rules engine
- Analytics dashboards for preferences

**Effort estimate**: 1-2 weeks total

---

## 10. API ENDPOINTS TO ADD

```
# Special Request Management (Admin)
GET    /v1/catalog/special-requests          # Get available requests (merged system + tenant)
PUT    /v1/config/special-requests/:code     # Tenant: enable/disable/set price

# Packing Method Management (Admin)
GET    /v1/catalog/packing-methods           # Get available methods (merged system + tenant)
PUT    /v1/config/packing-methods/:code      # Tenant: enable/disable/set price

# Order Operations
POST   /v1/orders/:id/items/:itemId/requests # Add special request to order item
DELETE /v1/orders/:id/items/:itemId/requests/:requestId  # Remove request
GET    /v1/orders/:id/preferences            # Get all preferences for order (resolved)

# Customer Preferences
GET    /v1/customers/:id/preferences         # Get customer standing preferences
POST   /v1/customers/:id/preferences         # Add preference
DELETE /v1/customers/:id/preferences/:prefId # Remove preference

# Preference Resolution
GET    /v1/resolve-preferences?customerId=X&productCode=Y&serviceCode=Z
       # Returns resolved preferences for a given context
```

---

## 11. KEY TECHNICAL DECISIONS SUMMARY

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Processing vs Packing separation | **Yes, keep separate** | Different teams, different screens, different timing |
| Catalog approach | **Two-tier: System + Tenant override** | Matches existing pattern in your schema |
| Customer-level preferences | **Yes, add this** | Speeds up counter, reduces errors, increases customer satisfaction |
| Pricing | **Capture at order time** | Immutable for accounting; catalog prices can change independently |
| Per-piece packing | **Phase D (future)** | Most laundries don't need this at MVP |
| Package/bag grouping | **Phase D (future)** | Assembly packages are for industrial-grade operations |
| Garment identity | **Phase D (future)** | Enterprise feature, not needed for MVP revenue |
| Free text requests | **No, never** | Kills analytics, automation, and i18n |
| Compatibility rules | **Phase D (future)** | Nice to have but not blocking for launch |

---

## 12. FINAL ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM CATALOGS (Seeded)                  │
│  sys_special_request_cd    sys_packing_method_cd             │
│  sys_pck_packaging_type_cd                                   │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│               TENANT CONFIGURATION (Overrides)              │
│  org_special_request_cf    org_packing_method_cf             │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│               CUSTOMER PREFERENCES (Standing)               │
│  org_customer_preferences                                    │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼  (auto-apply at order creation)
┌─────────────────────────────────────────────────────────────┐
│                    ORDER LEVEL                               │
│                                                              │
│  org_order_items_dtl                                         │
│    ├── packing_method_code (default for all pieces)          │
│    ├── packing_method_is_override                            │
│    └── org_order_item_special_requests (1:many)              │
│         ├── request_code                                     │
│         ├── extra_price (captured at order time)             │
│         └── source (manual/customer_pref/contract/auto)      │
│                                                              │
│  org_order_item_pieces_dtl                                   │
│    └── packing_method_code (per-piece override, optional)    │
│                                                              │
│  [FUTURE] org_order_packages → org_package_pieces            │
└─────────────────────────────────────────────────────────────┘
              │
              ▼  (drives workflow)
┌─────────────────────────────────────────────────────────────┐
│               WORKFLOW & OPERATIONS                          │
│                                                              │
│  Processing team sees: Special Requests only                 │
│  Assembly team sees: Packing Methods only                    │
│  QA team sees: Both (verification)                           │
│  Driver sees: Package summary                                │
│  Customer sees: Simple status + preferences confirmed        │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. DOCUMENT vs ENHANCED MODEL COMPARISON

| Aspect | Original Document | Enhanced Model |
|--------|------------------|----------------|
| Request scope levels | 3 (Order, Item, Piece) | 5 (Tenant, Service, Customer, Item, Piece) |
| Catalog model | Single system table | Two-tier (System + Tenant override) |
| Customer preferences | Not covered | Full customer preference system |
| B2B contract defaults | Not covered | Contract-level preferences |
| Pricing integration | Mentioned but not designed | Full pricing pipeline with immutable capture |
| Conflict resolution | Not covered | Compatibility matrix + warnings |
| Source tracking | Not covered | Track where each preference came from |
| Analytics | Not covered | Daily metrics aggregation |
| Existing schema alignment | Independent design | Aligned with schema_06.sql patterns and naming |
| RLS/Multi-tenancy | Mentioned | Full RLS policies included |
| API design | Not covered | Complete endpoint list |
| Implementation phasing | Not covered | 4-phase roadmap for solo developer |

---

*This document should be used alongside the original `Order_Special_Requests_Jh_01.md` as the enhanced specification for implementing special preferences in CleanMateX.*
