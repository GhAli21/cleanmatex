# Service Preferences Implementation Plan — Addendum

**Date:** March 11, 2026  
**Purpose:** Incorporate findings from all documents in `docs/features/Order_Service_Preferences/`  
**Documents studied:**
- **Order Special Requests_Jh_01 First Idea Draft.md** (original foundational document)
- CleanMateX_Order_Preferences_v3_Complete.md
- CleanMateX_Order_Preferences_v3.1_Monetization.md
- CleanMateX_Order_Preferences_Analysis_v2.md
- CleanMateX_Order_Special_Request_Analysis.md

---

## 0. Original First Idea Draft — Key Contributions

The **Order Special Requests_Jh_01 First Idea Draft** is the foundational document. Key decisions that shaped the final design:

### 0.1 Critical Architectural Decision: Processing vs Packing

> **Hang/Fold should be a Packing Rule, not a Special Request.**

- **Special requests** change processing (starch, steam press, separate wash, delicate)
- **Hang/Fold** happens after processing, at assembly/packing stage
- **Result:** Two catalogs — `sys_service_preference_cd` (processing) and `sys_packing_preference_cd` (packing)

### 0.2 Packing Hierarchy (3 Layers)

| Layer | Table | Purpose |
|-------|-------|---------|
| Item default | `org_order_items_dtl.packing_pref_code` | Quick order entry |
| Piece override | `org_order_item_pieces_dtl.packing_pref_code` | High-end laundries, piece tagging |
| Package/Bag | `org_order_packages`, `org_package_pieces` | Final delivery units |

**Rule:** If assembly use enabled from setting so Never allow READY unless `assembled_pieces = expected_pieces`.

### 0.3 Real-World Request Set (8 Most Common)

1. Steam Press  
2. Light Starch  
3. Heavy Starch  
4. Hang  
5. Fold  
6. Separate Wash  
7. Delicate  
8. Perfume  

### 0.4 Catalog Structure by Category

```
WASHING_REQUESTS   → Separate Wash, Delicate
PROCESSING_REQUESTS → Starch
FINISHING_REQUESTS  → Steam Press, Perfume
PACKING_REQUESTS    → Hang, Fold (later split to packing_preference)
```

**Action:** Use `preference_category` (washing, processing, finishing) for service prefs; packing is separate catalog.

### 0.5 Assembly Station Design

- **Flow:** Scan → Verify → Pack → Package → Close
- **Speed:** Barcode scanning, keyboard shortcuts (F1=Hang, F2=Fold, F3=New Package)
- **Package types:** hanger rack, plastic bag, suit cover, box
- **Missing piece detection:** Cannot close order until all pieces assembled

### 0.6 Garment vs Order Piece (Future)

- **Garment** = persistent customer asset (`org_customer_garments_mst`)
- **Order Piece** = temporary processing instance
- Phase D / Enterprise feature

### 0.7 Feature Flags from Original

- `track_individual_piece` — piece-level packing override
- `assembly_package_mode` — package/bag grouping

**Action:** Align with `service_pref.per_piece_packing` and future package tables.

### 0.8 Tag Content (Barcode/Tagging)

Tag can include: `Order | Item | Req: Hang + Starch`

### 0.9 Pricing Strategy

- **Model A:** Free (included)
- **Model B:** Extra charge per preference
- **Action:** Support both via `is_included_in_base` on tenant config

---

## 1. Naming Convention (from Analysis v2)

| Layer | Code Term | UI English | UI Arabic |
|-------|-----------|------------|-----------|
| Processing options | `service_preference` | Service Preferences | تفضيلات الخدمة |
| Packing options | `packing_preference` | Packing Preferences | تفضيلات التغليف |
| Customer standing | `customer_service_prefs` | My Preferences | تفضيلاتي |
| Invoice line | — | Additional Services | خدمات إضافية |
| Admin settings | — | Preferences Catalog | كتالوج التفضيلات |

**Note:** Analysis v2 uses "Additional Services" for invoice line; v3 uses "Service Preferences". Prefer v3 for consistency; document both in i18n for context-specific use.

---

## 2. Packing vs Packaging Distinction (Critical)

```
Packing Preference (per garment)  = How individual item is prepared (HANG, FOLD)
                                    sys_packing_preference_cd

Packaging Type (per package)      = Container type for delivery (BAG, BOX, HANGER_RACK)
                                    sys_pck_packaging_type_cd (EXISTS)
```

**Action:** Verify `sys_pck_packaging_type_cd` seed values match `maps_to_packaging_type` in packing preference seed:
- HANG → HANGER
- FOLD, FOLD_TISSUE, GARMENT_BAG, VACUUM_SEAL, ROLL → BAG
- BOX → BOX

Migration 0063 creates `sys_pck_packaging_type_cd` with BOX, HANGER, BAG, ROLL, MIXED. Align packing preference `maps_to_packaging_type` with these codes.

---

## 3. RLS Policy Naming Alignment

**Existing pattern:** `tenant_isolation_{table_name}` (from 0081_comprehensive_rls_policies.sql)

**Examples:**
- `tenant_isolation_org_order_items_dtl`
- `tenant_isolation_org_product_data_mst`

**Action:** Use `tenant_isolation_org_service_preference_cf`, `tenant_isolation_org_packing_preference_cf`, etc. instead of `rls_org_*` from the spec docs.

**Tenant resolution:** Use `current_tenant_id()` if available; otherwise `current_setting('app.tenant_id', true)::uuid`. Check 0061/0081 for actual function used.

---

## 4. Per-Piece Detail UX (from Special Request Analysis)

When cashier clicks "Per-Piece Details":

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
│  ...                                                │
│                                                     │
│  Summary: 3 Hang, 2 Fold                           │
│                                                     │
│  [Cancel]  [Apply]                                  │
└────────────────────────────────────────────────────┘
```

**Action:** Gate per-piece detail by `service_pref.per_piece_packing` (Enterprise). Include "Apply default to all" option.

---

## 5. Processing Confirmation (from Special Request Analysis)

Columns already in v3 spec: `processing_confirmed`, `confirmed_by`, `confirmed_at` on `org_order_item_service_prefs`.

**Action:** Enterprise-only feature flag `service_pref.processing_confirmation`. Assembly screen shows confirm buttons when enabled.

---

## 6. PostgreSQL Implementation Notes (from Analysis v2)

| Topic | Notes |
|-------|-------|
| **TEXT[] arrays** | `applies_to_fabric_types`, `is_incompatible_with` — use `ARRAY['cotton','polyester']`, query with `WHERE 'cotton' = ANY(applies_to_fabric_types)` |
| **Partial index** | `CREATE INDEX ... WHERE is_active = true` for `org_customer_service_prefs` — smaller, faster for active-only queries |
| **Function volatility** | Use `STABLE` for `resolve_item_preferences()` — same result within transaction |
| **Immutable pricing** | `extra_price` on order table — never lookup from catalog at display time |

---

## 7. Conflict Resolution (from Special Request Analysis)

| Scenario | Resolution |
|----------|------------|
| Customer pref HANG + Order item FOLD | Order item wins (most specific) |
| Delicate + Heavy Starch | WARN (contradictory) |
| Separate Wash + Express Service | WARN (may violate SLA) |
| Heavy Starch + Silk Dress | WARN (fabric incompatibility) |

**Action:** Use `is_incompatible_with` on catalog; `SERVICE_PREF_ENFORCE_COMPATIBILITY` setting: if true block, if false warn only.

---

## 8. Evolution from Original Naming

| Original (Special Request) | Final (Preferences) |
|----------------------------|---------------------|
| sys_special_request_cd | sys_service_preference_cd |
| sys_packing_method_cd | sys_packing_preference_cd |
| org_order_item_special_requests | org_order_item_service_prefs |
| packing_method_code | packing_pref_code |
| default_packing_method | default_packing_pref |

**Action:** Use final naming consistently throughout migration and code.

---

## 9. Invoice Line Naming

- **Analysis v2:** "Additional Services" / "خدمات إضافية"
- **v3 Complete:** "Service Preferences" / "تفضيلات الخدمة"

**Recommendation:** Use "Service Preferences" for consistency with feature naming. Add "Additional Services" as alternative key if needed for invoice context.

---

## 10. Document Cross-Reference

| Topic | First Idea | v3 Complete | v3.1 Monetization | Analysis v2 | Special Request |
|-------|------------|-------------|-------------------|-------------|-----------------|
| Processing vs packing split | Yes (core decision) | Yes | — | Yes | Yes |
| 3-level packing hierarchy | Yes | Yes (5-level pref) | — | Yes | Yes |
| Item + piece + package | Yes | Yes (Phase D) | — | Yes | Yes |
| 8 real-world requests | Yes | Yes (10 service + 7 packing) | — | Yes | Yes |
| Catalog by category | Yes | Yes | — | Yes | Yes |
| Assembly: Scan→Verify→Pack | Yes | Yes | — | Yes | Yes |
| Garment vs order piece | Yes | Phase D | — | Yes | Yes |
| Feature flags | Yes (track_individual_piece) | — | Yes (full) | — | — |
| Two-tier catalog | — | Yes | — | Yes | Yes |
| Customer standing prefs | — | Yes | — | Yes | Yes |
| Immutable pricing | — | Yes | — | Yes | Yes |
| Plan limits | — | — | Yes | — | — |
| RLS patterns | — | — | — | Yes | Yes |
| Per-piece popup | Yes (piece-level packing) | — | — | — | Yes |
| Packaging vs packing | Yes | — | — | Yes | Yes |
| Compatibility rules | — | Yes | — | Yes | Yes |

---

*This addendum should be used alongside the main Service Preferences Implementation Plan to ensure no gaps from the preparation documents.*
