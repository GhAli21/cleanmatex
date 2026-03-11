# Service Preferences — Consolidated Implementation Plan

**Document:** Complete implementation plan  
**Date:** March 11, 2026  
**Status:** Ready for implementation  
**Source documents:**
- Order Special Requests_Jh_01 First Idea Draft.md
- CleanMateX_Order_Preferences_v3_Complete.md
- CleanMateX_Order_Preferences_v3.1_Monetization.md
- CleanMateX_Order_Preferences_Analysis_v2.md
- CleanMateX_Order_Special_Request_Analysis.md

---

## Implementation Rules

- **Migrations:** Create migration file(s) only. **Do NOT apply** — user runs migrations manually.
- **Best practice:** No gaps; production-ready; follow CLAUDE.md, database conventions, PRD implementation rules.
- **Documentation:** Create/update full feature documentation per documentation skill and PRD checklist.

---

## Executive Summary

Implement the **Order Service Preferences** feature end-to-end: database schema, tenant configuration, order-level and **piece-level** preferences, **service_pref_charge** on items and pieces, customer standing prefs, preference resolution, feature flags, UI integration (new order, assembly, receipt), and monetization gating. Build all tiers at once with feature-flag gating for production readiness.

**Core architectural decision (from First Idea Draft):** Hang/Fold are **Packing Rules**, not Special Requests. Processing team sees service preferences; assembly team sees packing preferences. Never mix them.

**Enhancements:**
- **Piece-level service preferences** — Same as item-level; piece overrides item when both exist.
- **service_pref_charge** — Aggregated charge on `org_order_items_dtl` and `org_order_item_pieces_dtl` for reporting and totals.

---

## Part A: Foundational Design (from First Idea Draft)

### A.1 Processing vs Packing Separation

| Type | Catalog | Examples |
|------|---------|----------|
| Service preferences | `sys_service_preference_cd` | Starch, perfume, delicate, separate wash |
| Packing preferences | `sys_packing_preference_cd` | Hang, fold, box |

### A.2 Service Preference Hierarchy (Item + Piece)

| Layer | Table | Purpose |
|-------|-------|---------|
| Item level | `org_order_item_service_prefs` (order_item_id) | Default prefs for all pieces of item |
| Piece level | `org_order_item_piece_service_prefs` (piece_id) | Override per piece (Enterprise) |

**Resolution:** Piece-level prefs override item-level for that piece. When no piece prefs, use item prefs.

### A.3 Packing Hierarchy

| Layer | Table | Purpose |
|-------|-------|---------|
| Item default | `org_order_items_dtl.packing_pref_code` | Quick order entry |
| Piece override | `org_order_item_pieces_dtl.packing_pref_code` | High-end laundries (Enterprise) |
| Package/Bag | `org_order_packages`, `org_package_pieces` | Phase D / future |

**Rule:** Never allow READY unless `assembled_pieces = expected_pieces` (when assembly/package mode enabled).

### A.4 Packing vs Packaging Distinction

```
Packing Preference (per garment)  = How individual item is prepared (HANG, FOLD)
                                    sys_packing_preference_cd

Packaging Type (per package)      = Container type for delivery (BAG, BOX, HANGER_RACK)
                                    sys_pck_packaging_type_cd (EXISTS)
```

Align `maps_to_packaging_type` with `sys_pck_packaging_type_cd` codes: HANGER, BAG, BOX, ROLL, MIXED.

### A.5 Real-World Request Set (8 Most Common)

Steam Press, Light Starch, Heavy Starch, Hang, Fold, Separate Wash, Delicate, Perfume.

### A.6 Assembly Station Design

- **Flow:** Scan → Verify → Pack → Package → Close
- **Shortcuts:** F1=Hang, F2=Fold, F3=New Package
- **Package types:** hanger rack, plastic bag, suit cover, box

---

## Part B: Naming Convention

| Layer | Code Term | UI English | UI Arabic |
|-------|-----------|------------|-----------|
| Processing options | `service_preference` | Service Preferences | تفضيلات الخدمة |
| Packing options | `packing_preference` | Packing Preferences | تفضيلات التغليف |
| Customer standing | `customer_service_prefs` | My Preferences | تفضيلاتي |
| Preference bundles | `preference_bundle` | Care Packages | باقات العناية |
| Invoice line | — | Service Preferences / Additional Services | تفضيلات الخدمة / خدمات إضافية |
| Admin settings | — | Preferences Catalog | كتالوج التفضيلات |

**Final naming:** Use `packing_pref_code`, `default_packing_pref` (not packing_method).

---

## Part C: Database Schema

**Migration instruction:** Create migration file(s) only. **Do NOT run `supabase db push` or apply migrations.** User applies migrations manually after review.

### C.1 Migration: 0139_order_service_preferences_schema.sql

**System catalogs:**
- `sys_service_preference_cd` — 10 seed rows (starch, perfume, delicate, etc.)
- `sys_packing_preference_cd` — 7 seed rows (hang, fold, box, etc.)

**Tenant config:**
- `org_service_preference_cf` — enable/disable, custom prices
- `org_packing_preference_cf` — enable/disable
- `org_preference_bundles_cf` — Care packages (Growth+)

**Order item level:**
- `org_order_item_service_prefs` — applied service prefs with `source`, `extra_price` (immutable), `branch_id`
- ALTER `org_order_items_dtl`: add `packing_pref_code`, `packing_pref_is_override`, `packing_pref_source`, **`service_pref_charge`** DECIMAL(19,4) DEFAULT 0
  - `service_pref_charge` = sum of `extra_price` from all prefs on this item; updated on add/remove pref

**Order piece level (Enterprise):**
- `org_order_item_piece_service_prefs` — piece-level service prefs (FK to `org_order_item_pieces_dtl.id` as `order_item_piece_id`; same structure as item-level: `preference_code`, `source`, `extra_price`, `branch_id`, etc.)
- ALTER `org_order_item_pieces_dtl`: add `packing_pref_code`, **`service_pref_charge`** DECIMAL(19,4) DEFAULT 0
  - `service_pref_charge` = sum of `extra_price` from piece prefs; when no piece prefs, inherits from item (not stored on piece)

**Product catalog:**
- ALTER `org_product_data_mst`: add `default_packing_pref`

**Customer level:**
- `org_customer_service_prefs` — standing prefs
- `org_customer_pref_changelog` — audit trail (trigger)

**Phase D / Enterprise:**
- `org_seasonal_pref_templates_cf`, `org_preference_fulfillment_ratings`, `org_daily_preference_metrics`
- `org_contract_service_prefs`, `sys_preference_compatibility_rules`

**Charge calculation:**
- `org_order_items_dtl.service_pref_charge` = SUM(`extra_price`) from `org_order_item_service_prefs` + SUM(`extra_price`) from `org_order_item_piece_service_prefs` for all pieces of that item. Updated on pref add/remove.
- `org_order_item_pieces_dtl.service_pref_charge` = SUM(`extra_price`) from `org_order_item_piece_service_prefs` for that piece. NULL when piece has no piece-level prefs (inherits from item).

**Money fields:** Use `DECIMAL(19, 4)` per CLAUDE.md.

**RLS:** Use `tenant_isolation_{table_name}` pattern (e.g. `tenant_isolation_org_service_preference_cf`).

### C.2 Database Functions

```sql
resolve_item_preferences(p_tenant_org_id, p_customer_id, p_product_code, p_service_category_code)
suggest_preferences_from_history(...)
get_last_order_preferences(...)
calculate_ready_by_with_preferences(p_order_id, p_tenant_org_id, p_base_turnaround_hours)
fn_log_customer_pref_change()  -- trigger on org_customer_service_prefs
```

**service_pref_charge recalculation:** Application layer (service) recalculates and updates on pref add/remove. Alternatively, trigger on `org_order_item_service_prefs` and `org_order_item_piece_service_prefs` to keep `service_pref_charge` in sync.

**PostgreSQL notes:** Use `STABLE` for resolution functions; partial index `WHERE is_active = true` on customer prefs; `TEXT[]` for `applies_to_fabric_types`, `is_incompatible_with`.

---

## Part D: Feature Flags and Plan Limits

**Plan codes:** FREE_TRIAL, STARTER, GROWTH, PRO, ENTERPRISE

**Boolean flags (27):** `service_pref.service_preferences_enabled`, `service_pref.packing_preferences_enabled`, `service_pref.all_packing_methods`, `service_pref.sla_adjustment`, `service_pref.repeat_last_order`, `service_pref.bundles_enabled`, `service_pref.smart_suggestions`, `service_pref.customer_standing_prefs`, `service_pref.per_piece_packing`, etc.

**Numeric limits:**
- `max_service_prefs_per_item`: FREE_TRIAL=3, STARTER=6, GROWTH/PRO=10, ENTERPRISE=-1
- `max_service_prefs_per_piece`: ENTERPRISE only; same as item limit or -1
- `max_active_catalog_items`: FREE_TRIAL=5, others=-1
- `max_custom_preferences`: FREE_TRIAL/STARTER=0, GROWTH/PRO=10, ENTERPRISE=-1
- `max_bundles`: FREE_TRIAL/STARTER=0, GROWTH/PRO=5, ENTERPRISE=-1

**New flag:** `service_pref.per_piece_service_prefs` — Allow service preferences per piece (Enterprise). Gate `org_order_item_piece_service_prefs` and piece-level pref UI.

---

## Part E: Tenant Settings

Add to `sys_tenant_settings_cd` (category SERVICE_PREF):
- `SERVICE_PREF_DEFAULT_PACKING`, `SERVICE_PREF_SHOW_PRICE_ON_COUNTER`
- `SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS`, `SERVICE_PREF_ALLOW_NOTES`
- `SERVICE_PREF_ENFORCE_COMPATIBILITY` — if true block incompatible prefs, if false warn only
- `SERVICE_PREF_REQUIRE_CONFIRMATION`, `SERVICE_PREF_PACKING_PER_PIECE_ENABLED`
- `SERVICE_PREF_BUNDLES_SHOW_SAVINGS`, `SERVICE_PREF_SUGGESTION_*`, etc.

---

## Part F: Constants and Types

**Location:** `web-admin/lib/constants/`, `web-admin/lib/types/`

- `service-preferences.ts`: `SERVICE_PREFERENCE_CODES`, `PACKING_PREFERENCE_CODES`, `PREFERENCE_CATEGORIES`, `PREFERENCE_SOURCES`
- `service-preferences.ts` (types): `ServicePreference`, `PackingPreference`, `OrderItemServicePref`, `OrderPieceServicePref`, `ResolvedPreferences`

---

## Part G: API and Services (web-admin)

**API routes:**
- `GET /api/v1/catalog/service-preferences`, `packing-preferences`, `preference-bundles`
- `GET/POST/DELETE /api/v1/orders/[id]/items/[itemId]/service-prefs`
- `GET/POST/DELETE /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs` (Enterprise)
- `PATCH /api/v1/orders/[id]/items/[itemId]/packing-pref`
- `POST /api/v1/orders/[id]/items/[itemId]/apply-bundle/[bundleCode]`
- `POST /api/v1/orders/[id]/repeat-from/[sourceOrderId]`
- `GET /api/v1/resolve-preferences`, `suggest-preferences`
- `GET/POST/DELETE /api/v1/customers/[id]/service-prefs`

**Services:** PreferenceCatalogService, OrderItemPreferenceService, OrderPiecePreferenceService (Enterprise), PreferenceResolutionService, PreferenceLimitService, ReadyByCalculationService. Recalculate `service_pref_charge` on item and piece when prefs change.

**Order creation:** Extend `CreateOrderParams.items` with `servicePrefs`, `packingPrefCode`, `pieces[].servicePrefs` (when piece-level enabled); call `resolve_item_preferences`; insert into `org_order_item_service_prefs` and `org_order_item_piece_service_prefs`; set `service_pref_charge` on items and pieces. **Order total** = sum of (item `total_price` + item `service_pref_charge`) for all items.

---

## Part H: UI Integration

**New order screen:**
- ServicePreferenceSelector, PackingPreferenceSelector
- CarePackageBundles (Growth+), RepeatLastOrderPanel (Starter+), SmartSuggestionsPanel (Growth+)
- PreferencePriceImpact, SLA adjustment display
- Display `service_pref_charge` per item and in order total

**Per-piece detail (Enterprise):** Gate by `service_pref.per_piece_packing` and `service_pref.per_piece_service_prefs`; include "Apply default to all" option. Piece-level ServicePreferenceSelector when `per_piece_service_prefs` enabled. Show `service_pref_charge` per piece when applicable.

**Assembly screen:** Display service prefs and packing prefs per piece; processing confirmation (Enterprise); override warning when packing differs from default.

**Receipt/WhatsApp:** Add `{{preferences_summary}}`, `{{eco_score}}`, `{{service_pref_charge}}` placeholders.

**Ready-by:** Integrate `calculate_ready_by_with_preferences` when `service_pref.sla_adjustment` enabled.

---

## Part I: Conflict Resolution

| Scenario | Action |
|----------|--------|
| Customer pref HANG + Order item FOLD | Order item wins |
| Delicate + Heavy Starch | WARN (use `is_incompatible_with`) |
| Separate Wash + Express | WARN (SLA) |
| Heavy Starch + Silk | WARN (fabric) |

Use `SERVICE_PREF_ENFORCE_COMPATIBILITY`: true = block, false = warn only.

---

## Part J: Permissions

- `orders.service_prefs.view`, `orders.service_prefs.edit`
- `config.preferences.manage`, `customers.preferences.manage`

---

## Part K: Implementation Order

1. **Create** migration 0139 (schema, seed, functions, flags, settings) — **do NOT apply**
2. Constants and types
3. API routes and services (including piece-level)
4. Feature flag service extension
5. Order creation integration (with `service_pref_charge` recalculation)
6. New order UI components
7. Per-piece service pref UI (Enterprise)
8. Receipt/WhatsApp templates
9. Ready-by integration
10. Assembly screen updates
11. Admin config UI
12. Permissions
13. i18n
14. Prisma sync
15. **Documentation** (Part N)
16. Build and test

---

## Part L: Key File References

| Area | Path |
|------|------|
| Order creation | `web-admin/lib/services/order-service.ts` |
| New order UI | `web-admin/src/features/orders/` |
| Feature flags | `web-admin/lib/services/feature-flags.service.ts` |
| Receipt | `web-admin/lib/services/receipt-service.ts` |
| Ready-by | `web-admin/lib/utils/ready-by-calculator.ts` |
| Migrations | `supabase/migrations/` |
| RLS pattern | `supabase/migrations/0081_comprehensive_rls_policies.sql` |

---

## Part M: Document Cross-Reference

| Topic | First Idea | v3 Complete | v3.1 Monetization | Analysis v2 | Special Request |
|-------|------------|-------------|-------------------|-------------|-----------------|
| Processing vs packing split | Yes | Yes | — | Yes | Yes |
| 3-level packing hierarchy | Yes | Yes | — | Yes | Yes |
| 8 real-world requests | Yes | Yes | — | Yes | Yes |
| Assembly: Scan→Verify→Pack | Yes | Yes | — | Yes | Yes |
| Two-tier catalog | — | Yes | — | Yes | Yes |
| Customer standing prefs | — | Yes | — | Yes | Yes |
| Immutable pricing | — | Yes | — | Yes | Yes |
| Feature flags / plan limits | Yes | — | Yes | — | — |
| RLS patterns | — | — | — | Yes | Yes |
| Per-piece popup | Yes | — | — | — | Yes |
| Compatibility rules | — | Yes | — | Yes | Yes |

---

## Part N: Documentation Tasks

Create and update documentation per `.claude/skills/documentation/reference.md` and PRD implementation rules. All documentation in `docs/features/Order_Service_Preferences/`.

### N.1 Feature Documentation Structure

| File | Purpose |
|------|---------|
| `README.md` | Overview, scope, navigation |
| `development_plan.md` | Roadmap, milestones (this plan) |
| `progress_summary.md` | Completed work, outstanding items |
| `current_status.md` | Implementation state, blockers |
| `developer_guide.md` | Code structure, services, API, flow |
| `developer_guide_mermaid.md` | Flowcharts for code flow |
| `user_guide.md` | User workflows, UI walkthrough, FAQs |
| `user_guide_mermaid.md` | Flowcharts for user flows |
| `testing_scenarios.md` | Test cases, edge cases, acceptance criteria |
| `deploy_guide.md` | Deploy details and steps and requirements |
| `CHANGELOG.md` | Versioned changes |
| `version.txt` | Current version (e.g. v1.0.0) |
| `Order_Service_Preferences_lookup.md` | Index of sub-component folders |

### N.2 Technical Documentation

| File | Purpose |
|------|---------|
| `technical_docs/tech_data_model.md` | Tables, columns, relationships |
| `technical_docs/tech_api_spec.md` | API endpoints, request/response |
| `technical_docs/tech_preference_resolution_mermaid.md` | Resolution flow diagram |

### N.3 Implementation Requirements Checklist (PRD)

Document in `implementation_requirements.md` or `README.md`:

- [ ] **Permissions** — `orders.service_prefs.view`, `orders.service_prefs.edit`, `config.preferences.manage`, `customers.preferences.manage`, piece-level permission if applicable
- [ ] **Navigation tree** — Preferences catalog, customer prefs tab, admin settings
- [ ] **Tenant settings** — All `SERVICE_PREF_*` codes
- [ ] **Feature flags** — All `service_pref.*` flags and plan mappings
- [ ] **i18n keys** — `en.json`, `ar.json`; search existing first
- [ ] **API routes** — Document all endpoints and versions
- [ ] **Database migrations** — 0139 and any follow-ups; **user applies manually**
- [ ] **Constants/types** — `lib/constants/service-preferences.ts`, `lib/types/service-preferences.ts`
- [ ] **RBAC** — Role assignments for new permissions

### N.4 Update Project-Level Docs

- [ ] **docs/folders_lookup.md** — Add Order Service Preferences row
- [ ] **docs/documentation_map.md** — Add feature if exists
- [ ] **docs/Database_Design/** — Update schema docs with new tables/columns

### N.5 Metadata Standards

Every markdown file: `version`, `last_updated`, `author` in frontmatter. Semantic versioning for features.

---

*Consolidated from main implementation plan and addendum. Ready for production implementation. Migrations: create only; user applies manually.*
