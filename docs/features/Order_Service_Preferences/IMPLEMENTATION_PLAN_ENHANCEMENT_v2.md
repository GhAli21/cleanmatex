---
version: v2.0.0
last_updated: 2026-03-14
author: CleanMateX Team
source: suggesstion_decisions.md + Suggested_Services_Preferences_and_Note_Tables.sql
---

# Order Service Preferences — Comprehensive Implementation Plan (Enhancement v2)

## Document Purpose

This plan implements the enhancements and decisions from `suggesstion_decisions.md`, integrates the suggested schema from `Suggested_Services_Preferences_and_Note_Tables.sql`, and follows best-practices for production-ready SaaS. **Do NOT apply database migrations** — create migration files only; the user applies them manually.

---

## 1. Key Decisions Summary

| Decision | Source | Implementation |
|----------|--------|----------------|
| Configuration in SaaS HQ first | 1.1 | System catalogs in cleanmatexsaas; tenant can edit/create if allowed |
| Applies to service category, products, fabric types | 1.1 | Detail tables sys_* then org_* |
| SERVICE_PREF_ENFORCE_COMPATIBILITY per service category | 1.1 | Add enforce_compatibility to service-category–pref mapping |
| Unified org_order_prefs_dtl with prefs_owner_type, prefs_source, prefs_level | 1.2 | Adopt suggested table; migrate from org_order_item_service_prefs |
| Branch-level optional | 1.3 | branch_id nullable; resolution respects branch when present |
| Seasonal templates: tenant or branch level | 1.4 | Add branch_id (nullable) to org_seasonal_pref_templates_cf |
| B2B contract preferences | 1.5 | org_contract_service_prefs; best UI/UX |
| Plan limit enforcement | 4.2 | **Do NOT enforce** — keep all open with defaults; future consideration |
| GCC enhancements | 5.1 | Create `GCC_Market_Laundry-Specific_Enhancements.md` only |
| changelog_audit | 3.2 | Document how to enable via feature flag + tenant setting |

---

## 2. Schema Strategy: Current vs Suggested

### 2.1 Current CleanMateX Schema (0139+)

- `sys_service_preference_cd` — flat service prefs (STARCH_LIGHT, PERFUME, etc.)
- `sys_packing_preference_cd` — flat packing prefs (HANG, FOLD, etc.)
- `org_service_preference_cf`, `org_packing_preference_cf` — tenant overrides
- `org_order_item_service_prefs` — item-level service prefs
- `org_order_item_pc_prefs` — piece-level service prefs
- `org_order_items_dtl.packing_pref_code` — packing on item

### 2.2 Suggested Schema (from SQL file)

- `sys_preference_ctg_cd` — preference categories (pressing_method, packaging, starch_level, fragrance, etc.)
- `sys_preference_options_cd` — options per category
- `sys_prefs_ctg_service_ctg_cf` — prefs by service category
- `sys_prefs_option_service_ctg_cf` — pref options by service category
- `org_preference_ctg_cf`, `org_preference_options_cf` — tenant config
- `org_prefs_option_service_ctg_cf` — tenant prefs by service category
- `org_prefs_option_sctg_items_cf` — tenant prefs by service category + product
- `org_order_prefs_dtl` — unified ORDER/ITEM/PIECE preferences
- Notes: `sys_item_notes_cd`, `sys_item_notes_ctg_cd`, `org_item_notes_cf`, `org_item_notes_ctg_cf`, `org_order_notes_dtl`

### 2.3 Recommended Approach: Phased Integration

**Phase A (Immediate):** Extend current schema — add service-category and product applicability, adopt `org_order_prefs_dtl` as the unified order-prefs table, keep backward compatibility.

**Phase B (Later):** Introduce category-based model (`sys_preference_ctg_cd`, `sys_preference_options_cd`) in cleanmatexsaas for HQ-first configuration; map existing service/packing prefs to categories.

This plan focuses on **Phase A** for production readiness, with Phase B as a follow-on.

---

## 3. Implementation Phases

### Phase 1 — Foundation & Schema (Weeks 1–2)

#### 1.1 Documentation

| Task ID | Task | Output |
|---------|------|--------|
| DOC-1.1 | Create `GCC_Market_Laundry-Specific_Enhancements.md` | `docs/features/Order_Service_Preferences/GCC_Market_Laundry-Specific_Enhancements.md` |
| DOC-1.2 | Document how to enable `changelog_audit` | Add section to `implementation_requirements.md` |
| DOC-1.3 | Update `tech_data_model.md` with new tables and columns | Technical docs |
| DOC-1.4 | Update `Order_Service_Preferences_lookup.md` with new docs | Lookup index |

#### 1.2 Database Migrations (create files only; do NOT apply)

make sure of take the last seq for file name

| Task ID | Migration | Purpose |
|---------|------------|---------|
| MIG-1.1 | `0149_order_prefs_service_category_product_applicability.sql` | Add sys_* and org_* tables for prefs by service category and product |
| MIG-1.2 | `0150_order_prefs_unified_org_order_prefs_dtl.sql` | Create `org_order_prefs_dtl`; add branch_id to org_service_preference_cf (nullable) |
| MIG-1.3 | `0151_order_prefs_item_notes_tables.sql` | Create sys_item_notes_cd, sys_item_notes_ctg_cd, org_item_notes_cf, org_item_notes_ctg_cf, org_order_notes_dtl |
| MIG-1.4 | `0152_order_prefs_missing_settings.sql` | Add 11 missing SERVICE_PREF_* settings to sys_tenant_settings_cd |
| MIG-1.5 | `0153_order_prefs_seasonal_b2b.sql` | org_seasonal_pref_templates_cf (branch_id nullable), org_contract_service_prefs |

**Migration 0149 details:**

- `sys_svc_pref_service_ctg_cf` — service prefs applicable to service categories (tenant_org_id NULL = system/HQ)
- `sys_svc_pref_product_cf` — service prefs applicable to products (via product_code or product_id)
- `org_svc_pref_service_ctg_cf` — tenant overrides for prefs by service category
- `org_svc_pref_product_cf` — tenant overrides for prefs by product
- Add `enforce_compatibility` to service-category mapping (SERVICE_PREF_ENFORCE_COMPATIBILITY can be per category)
- Add `fabric_type` to org_product_data_mst if missing; add `applies_to_fabric_types` validation support

**Migration 0150 details:**

- Create `org_order_prefs_dtl` per suggested schema (adapt to CleanMateX naming: max 30 chars where required)
- Columns: branch_id, order_id, record_source (ORDER/ITEM/PIECE), order_item_id, piece_id, prefs_owner_type, prefs_source, prefs_level, org_prefs_ctg_code, org_prefs_option_code, processing_confirmed, option_price, option_desc, option_customer_notes, option_internal_notes, is_done, etc.
- Map org_prefs_ctg_code to SERVICE/PACKING; org_prefs_option_code to existing preference codes
- Add RLS, indexes, FKs to org_orders_mst, org_order_items_dtl, org_order_item_pieces_dtl
- Data migration: copy from org_order_item_service_prefs and org_order_items_dtl.packing_pref_code into org_order_prefs_dtl (run as separate migration step; can be deferred)

#### 1.3 TenantSettingsService

| Task ID | Task | Details |
|---------|------|---------|
| SVC-1.1 | Extend SETTING_CODES | Add all SERVICE_PREF_* codes from MIG-1.4 |
| SVC-1.2 | Extend TenantProcessingSettings or equivalent | Include new preference-related settings |

---

### Phase 2 — HQ-First Configuration & Resolution (Weeks 2–3)

#### 2.1 HQ Back-Office (cleanmatexsaas)

| Task ID | Task | Details |
|---------|------|---------|
| HQ-2.1 | Document HQ preference catalog flow | Where sys_* tables are managed; how tenant init copies them |
| HQ-2.2 | Preference catalog management UI (if cleanmatexsaas exists) | CRUD for sys_service_preference_cd, sys_packing_preference_cd; service-category and product applicability |
| HQ-2.3 | Tenant imitation/creation | Copy preference config from template or HQ defaults |

#### 2.2 Preference Resolution APIs

| Task ID | Task | Endpoint | Details |
|---------|------|----------|---------|
| API-2.1 | Implement resolve API | `GET /api/v1/preferences/resolve` | Query params: customer_id, product_code?, service_category_code?, branch_id? |
| API-2.2 | Implement last-order API | `GET /api/v1/preferences/last-order` | Query params: customer_id, limit? |
| API-2.3 | Implement suggest API | `GET /api/v1/preferences/suggest` | Query params: customer_id, product_code?, service_category_code? |
| API-2.4 | Wire resolution to new order | Use resolve + last-order + suggest when creating order |

#### 2.3 Resolution Logic

- Respect branch_id when provided (branch-level overrides)
- Apply service-category and product applicability when resolving available prefs
- Fabric validation: check applies_to_fabric_types vs product fabric_type; warn or block per SERVICE_PREF_ENFORCE_COMPATIBILITY

---

### Phase 3 — UI/UX Enhancements (Weeks 3–4)

#### 3.1 ServicePreferenceSelector

| Task ID | Task | Details |
|---------|------|---------|
| UI-3.1 | Group by preference_category | washing, processing, finishing |
| UI-3.2 | Show extra_turnaround_minutes | e.g. "+3h" for SEPARATE_WASH |
| UI-3.3 | Show sustainability_score | When SERVICE_PREF_ECO_SHOW_SCORE |
| UI-3.4 | Use icons from catalog | sys_service_preference_cd.icon |
| UI-3.5 | Respect SERVICE_PREF_SHOW_PRICE_ON_COUNTER | Default true |
| UI-3.6 | Add preference source badges | "Auto: Customer preference", "From bundle: Premium Care", "Repeat: Last order" |

#### 3.2 PackingPreferenceSelector

| Task ID | Task | Details |
|---------|------|---------|
| UI-3.7 | Use CmxSelect | Replace plain `<select>` |
| UI-3.8 | Add icons per packing type | From sys_packing_preference_cd.icon |
| UI-3.9 | Show sustainability hints | FOLD vs HANG |
| UI-3.10 | Radio-group layout option | For better visibility |

#### 3.3 CarePackageBundles

| Task ID | Task | Details |
|---------|------|---------|
| UI-3.11 | Show savings when SERVICE_PREF_BUNDLES_SHOW_SAVINGS | Bundle price vs sum of individual |
| UI-3.12 | Show bundle contents before applying | Modal or expandable |
| UI-3.13 | "Apply to all items" | Single action |
| UI-3.14 | Bundle icon and description | From catalog |

#### 3.4 Smart Suggestions & Repeat Last Order

| Task ID | Task | Details |
|---------|------|---------|
| UI-3.15 | Contextual suggestions | Per product/category |
| UI-3.16 | Show confidence | e.g. "Used in 80% of Shirt orders" |
| UI-3.17 | One-click Apply | Clear feedback |
| UI-3.18 | Repeat Last Order: order date + item summary | |
| UI-3.19 | "Apply to current item" vs "Apply to all items" | |

#### 3.5 Empty, Loading, Mobile, RTL

| Task ID | Task | Details |
|---------|------|---------|
| UI-3.20 | Empty state | When no prefs enabled |
| UI-3.21 | Skeleton/loading | Catalog and suggestions |
| UI-3.22 | Plan-gated messaging | When feature locked |
| UI-3.23 | Mobile responsiveness | Preference selectors |
| UI-3.24 | RTL layout | All preference components |
| UI-3.25 | Collapsible sections | Long preference lists |

---

### Phase 4 — Customer & Admin (Weeks 4–5)

#### 4.1 Customer Preferences Tab

| Task ID | Task | Details |
|---------|------|---------|
| UI-4.1 | Add Preferences tab to customer detail | List standing prefs |
| UI-4.2 | Add/remove standing prefs | Scope: all, service_category, product |
| UI-4.3 | Changelog view | When changelog_audit enabled |
| UI-4.4 | Document changelog_audit enablement | Feature flag + tenant setting |

**changelog_audit enablement:** Add `SERVICE_PREF_CHANGELOG_AUDIT` tenant setting (BOOLEAN, default false). When true, show changelog tab. Feature flag `service_pref.changelog_audit` (Growth+) gates the UI. Wire to org_customer_pref_changelog.

#### 4.2 Admin Catalog Page

| Task ID | Task | Details |
|---------|------|---------|
| UI-4.5 | Single Preferences catalog page | Service prefs, packing prefs, bundles |
| UI-4.6 | Edit all editable fields | Enable/disable, pricing, display order |
| UI-4.7 | Custom preferences | Tenant-created (Growth+) |
| UI-4.8 | Preview on counter | How prefs appear |

#### 4.3 Validation & Error Handling

| Task ID | Task | Details |
|---------|------|---------|
| SVC-4.1 | Validate incompatible combinations | Before submit; use is_incompatible_with |
| SVC-4.2 | Clear error messages | Limit and compatibility |
| SVC-4.3 | Optional optimistic UI with rollback | On API failure |
| SVC-4.4 | **Do NOT enforce maxPrefs** | Per user decision 4.2 |

---

### Phase 5 — Enterprise & Advanced (Weeks 5–7)

#### 5.1 Seasonal Templates

| Task ID | Task | Details |
|---------|------|---------|
| MIG-5.1 | org_seasonal_pref_templates_cf | branch_id nullable (tenant or branch level) |
| API-5.1 | Seasonal template CRUD | Create, update, list |
| UI-5.1 | Seasonal template management | Date ranges, auto-apply, service/product filters |

#### 5.2 B2B Contract Preferences

| Task ID | Task | Details |
|---------|------|---------|
| MIG-5.2 | org_contract_service_prefs | Contract-level defaults |
| API-5.2 | Contract prefs CRUD | |
| UI-5.2 | Contract prefs in contract form | Best UI/UX |
| SVC-5.1 | Auto-apply on order | When order linked to contract; source=contract_default |

#### 5.3 Fulfillment Feedback & Eco Scoring

| Task ID | Task | Details |
|---------|------|---------|
| MIG-5.3 | org_preference_fulfillment_ratings | Post-delivery feedback |
| API-5.3 | Feedback API | POST order feedback |
| UI-5.3 | Eco score on receipt and app | Badges: Seedling, Green, Tree, Planet |

#### 5.4 Analytics & Inventory Forecasting

| Task ID | Task | Details |
|---------|------|---------|
| MIG-5.4 | org_daily_preference_metrics | Aggregation |
| SVC-5.2 | Daily aggregation job | Or trigger-based |
| UI-5.4 | Analytics dashboard | Popular prefs, revenue, fulfillment |
| SVC-5.3 | Inventory forecasting | consumes_inventory_item; hangers, tissue, bags |

---

### Phase 6 — Polish & Testing (Week 7–8)

#### 6.1 Upgrade Prompts

| Task ID | Task | Details |
|---------|------|---------|
| UI-6.1 | Gray out locked features | Tooltip |
| UI-6.2 | UpgradePromptCard | Bundles, smart suggestions, etc. |
| UI-6.3 | Link to upgrade/subscription | |

#### 6.2 E2E Tests

| Task ID | Task | Details |
|---------|------|---------|
| TEST-6.1 | Add/remove prefs | |
| TEST-6.2 | Apply bundle | |
| TEST-6.3 | Repeat Last Order | |
| TEST-6.4 | Incompatibility (enforce vs warn) | |
| TEST-6.5 | Resolution API | |
| TEST-6.6 | Add `npm run test:preferences` | Runs preference E2E tests |

#### 6.3 Processing Workflow

| Task ID | Task | Details |
|---------|------|---------|
| UI-6.4 | workflow_impact routing | separate_batch, route_to_station |
| UI-6.5 | Prefs in processing/assembly | Clear display |
| UI-6.6 | processing_confirmed | QA confirmation |

---

## 4. Migration File Checklist (Create Only)

```
[ ] 0149_order_prefs_service_category_product_applicability.sql
[ ] 0150_order_prefs_unified_org_order_prefs_dtl.sql
[ ] 0151_order_prefs_item_notes_tables.sql
[ ] 0152_order_prefs_missing_settings.sql
[ ] 0153_order_prefs_seasonal_b2b.sql
```

---

## 5. Missing Settings to Add (0152)

| Setting Code | Purpose |
|--------------|---------|
| SERVICE_PREF_PACKING_SHOW_OVERRIDE_WARNING | Show override badge in assembly |
| SERVICE_PREF_BUNDLES_SHOW_ON_COUNTER | Show bundles on counter |
| SERVICE_PREF_SUGGESTION_MIN_ORDERS | Min orders for suggestions |
| SERVICE_PREF_SUGGESTION_MIN_FREQUENCY_PCT | Min frequency % for suggestions |
| SERVICE_PREF_SUGGESTION_LOOKBACK_DAYS | Lookback for suggestions |
| SERVICE_PREF_REPEAT_ORDER_COUNT | Number of recent orders to show |
| SERVICE_PREF_ECO_SHOW_SCORE | Show eco score |
| SERVICE_PREF_ECO_BADGE_THRESHOLDS | Eco badge thresholds (JSON) |
| SERVICE_PREF_FEEDBACK_ENABLED | Post-delivery feedback |
| SERVICE_PREF_FEEDBACK_DELAY_HOURS | Delay before feedback request |
| SERVICE_PREF_SEASONAL_AUTO_APPLY | Auto-apply seasonal templates |
| SERVICE_PREF_CHANGELOG_AUDIT | Enable preference changelog view |

---

## 6. Tables to Create/Modify (Summary)

| Table | Action |
|-------|--------|
| sys_svc_pref_service_ctg_cf | Create — prefs by service category |
| sys_svc_pref_product_cf | Create — prefs by product (or extend existing) |
| org_svc_pref_service_ctg_cf | Create — tenant overrides by service category |
| org_svc_pref_product_cf | Create — tenant overrides by product |
| org_order_prefs_dtl | Create — unified order prefs |
| org_service_preference_cf | Alter — add branch_id (nullable) |
| org_product_data_mst | Alter — add fabric_type if missing |
| sys_item_notes_cd | Create |
| sys_item_notes_ctg_cd | Create |
| org_item_notes_cf | Create |
| org_item_notes_ctg_cf | Create |
| org_order_notes_dtl | Create |
| org_seasonal_pref_templates_cf | Create |
| org_contract_service_prefs | Create |

---

## 7. Zero-Gap Checklist (Before Release)

- [ ] All migrations created (not applied by AI)
- [ ] RLS on all new org_* tables
- [ ] tenant_org_id filter on all tenant tables
- [ ] Bilingual (EN/AR) for all new UI
- [ ] i18n keys added and checked
- [ ] Permissions documented and inserted
- [ ] Navigation updated
- [ ] Feature flags documented
- [ ] Plan limits: **not enforced** per user decision
- [ ] Documentation updated (lookup, tech docs, implementation requirements)
- [ ] `npm run build` passes
- [ ] E2E tests for preferences

---

## 8. References

- [suggesstion_decisions.md](suggesstion_decisions.md) — User decisions
- [Suggested_Services_Preferences_and_Note_Tables.sql](F:\JhApps_doc\CleanMateX_Jh\Dev\Order Service Preferences\Suggested_Services_Preferences_and_Note_Tables.sql) — Suggested schema
- [implementation_requirements.md](implementation_requirements.md) — Current requirements
- [tech_data_model.md](technical_docs/tech_data_model.md) — Data model
- [CleanMateX_Order_Preferences_v3_Complete.md](CleanMateX_Order_Preferences_v3_Complete.md) — Full spec
