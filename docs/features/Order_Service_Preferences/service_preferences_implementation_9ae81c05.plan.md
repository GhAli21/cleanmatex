---
name: Service Preferences Implementation
overview: "Implement the Order Service Preferences feature end-to-end: database schema (migration 0139), tenant configuration, order-level and piece-level preferences, service_pref_charge aggregation, customer standing prefs, feature flags, API/services, UI integration (new order, assembly, receipt), and full documentation."
todos:
  - id: migration-0139
    content: Create migration 0139 (catalogs, tenant config, org_order_item_pc_prefs ≤30 chars, functions, RLS)
    status: completed
  - id: feature-flags-settings
    content: Add feature flags, plan mappings, tenant settings (SERVICE_PREF_*), SERVICE_PREF stng category
    status: completed
  - id: constants-types
    content: Create lib/constants/service-preferences.ts, lib/types/service-preferences.ts, Zod schemas
    status: completed
  - id: api-services
    content: Implement API routes and services with Zod validation; extend feature-flag service for plan-bound flags
    status: completed
  - id: order-calc-creation
    content: Extend order-calculation.service with servicePrefCharge; OrderService.createOrder with prefs
    status: completed
  - id: new-order-ui
    content: Add ServicePreferenceSelector, PackingPreferenceSelector, CarePackageBundles, RepeatLastOrderPanel
    status: completed
  - id: edit-order-ui
    content: Add ServicePreferenceSelector and PackingPreferenceSelector to edit order flow
    status: completed
  - id: per-piece-ui
    content: Implement per-piece packing and service pref UI (Enterprise-gated)
    status: completed
  - id: receipt-readyby-invoice
    content: Receipt placeholders, calculate_ready_by_with_preferences, invoice line for service_pref_charge
    status: completed
  - id: assembly-updates
    content: Update assembly screen to display prefs and processing confirmation
    status: completed
  - id: admin-config-nav
    content: Admin config UI, navigation tree (Preferences catalog, customer prefs tab)
    status: completed
  - id: permissions-i18n-tests
    content: Permissions, i18n keys, unit/integration tests (80% coverage for business logic)
    status: completed
  - id: documentation
    content: Create full feature documentation per documentation skill
    status: completed
isProject: false
---

# Service Preferences Feature Implementation Plan

## Production Readiness Summary

| Check                   | Status                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Best practice alignment | Yes — CLAUDE.md, PRD rules, database conventions                                            |
| Gaps addressed          | Yes — DB naming (≤30 chars), order calc, invoice, edit order, validation, testing, nav tree |
| Tenant isolation        | Yes — RLS, composite FKs, tenant*org_id on all org*\* tables                                |
| Feature documentation   | Yes — Full structure per documentation skill                                                |
| No hidden code          | Yes — All services, APIs, UI flows documented                                               |

**Verdict:** Plan is production-ready after incorporating the Best Practice Audit section below.

---

## Context

The plan is based on [IMPLEMENTATION_PLAN_COMPLETE.md](docs/features/Order_Service_Preferences/IMPLEMENTATION_PLAN_COMPLETE.md) and [IMPLEMENTATION_PLAN_ADDENDUM.md](docs/features/Order_Service_Preferences/IMPLEMENTATION_PLAN_ADDENDUM.md). Core architectural decision: **Processing vs Packing separation** — Service preferences (starch, perfume, delicate) are processing; Packing preferences (hang, fold, box) are assembly-stage only.

---

## Phase 1: Database Migration (Create Only — Do NOT Apply)

**File:** `supabase/migrations/0139_order_service_preferences_schema.sql`

### 1.1 System Catalogs

- **`sys_service_preference_cd`** — 10 seed rows (STARCH_LIGHT, STARCH_HEAVY, STEAM_PRESS, PERFUME, DELICATE, SEPARATE_WASH, etc.) with `preference_category`, `applies_to_fabric_types`, `is_incompatible_with`, `extra_turnaround_minutes`, `default_extra_price`
- **`sys_packing_preference_cd`** — 7 seed rows (HANG, FOLD, BOX, FOLD_TISSUE, GARMENT_BAG, VACUUM_SEAL, ROLL) with `maps_to_packaging_type` aligned to existing [sys_pck_packaging_type_cd](supabase/migrations/0063_org_asm_assembly_qa_system.sql) (BOX, HANGER, BAG, ROLL, MIXED)

### 1.2 Tenant Config Tables

- **`org_service_preference_cf`** — enable/disable, custom prices, `is_included_in_base`, `branch_id` (nullable)
- **`org_packing_preference_cf`** — enable/disable per tenant
- **`org_preference_bundles_cf`** — Care packages (Growth+), bundle_code, preference_codes, discount

### 1.3 Order Item / Piece Tables

- **`org_order_item_service_prefs`** — FK to `org_order_items_dtl.id`, `preference_code`, `source` (manual/customer/product/bundle), `extra_price` DECIMAL(19,4), `branch_id`, audit fields
- **`org_order_item_pc_prefs`** — FK to `org_order_item_pieces_dtl.id` as `order_item_piece_id`; same structure as item-level. (Name shortened to ≤30 chars per database conventions; alternative: add `pref` to feature-abbreviations and use `org_pref_order_pc_prefs`)
- **ALTER `org_order_items_dtl`**: add `packing_pref_code`, `packing_pref_is_override`, `packing_pref_source`, `service_pref_charge` DECIMAL(19,4) DEFAULT 0
- **ALTER `org_order_item_pieces_dtl`**: add `packing_pref_code`, `service_pref_charge` DECIMAL(19,4) DEFAULT 0

### 1.4 Product Catalog

- **ALTER `org_product_data_mst`**: add `default_packing_pref` (FK to sys_packing_preference_cd.code)

### 1.5 Customer Level

- **`org_customer_service_prefs`** — standing prefs: `tenant_org_id`, `customer_id` (FK org_customers_mst), `preference_code`, `source`, `is_active`; UNIQUE(tenant_org_id, customer_id, preference_code)
- **`org_customer_pref_changelog`** — audit trail (trigger `fn_log_customer_pref_change`)

### 1.6 Database Functions

- `resolve_item_preferences(p_tenant_org_id, p_customer_id, p_product_code, p_service_category_code)` — STABLE
- `suggest_preferences_from_history(...)`, `get_last_order_preferences(...)`
- `calculate_ready_by_with_preferences(p_order_id, p_tenant_org_id, p_base_turnaround_hours)` — integrates `extra_turnaround_minutes`
- Triggers or application-layer logic to recalc `service_pref_charge` on pref add/remove. Prefer application-layer (service) for clarity and testability.

### 1.7 RLS

Use `tenant_isolation_{table_name}` pattern per [0061](supabase/migrations/0061_fix_all_rls_policies_current_tenant_id.sql) and [0081](supabase/migrations/0081_comprehensive_rls_policies.sql).

---

## Phase 2: Feature Flags and Tenant Settings

### 2.1 Feature Flags (hq_ff_feature_flags_mst + sys_ff_pln_flag_mappings_dtl)

Add flags and plan mappings for:

- `service_pref.service_preferences_enabled`, `service_pref.packing_preferences_enabled`
- `service_pref.per_piece_packing`, `service_pref.per_piece_service_prefs` (Enterprise)
- `service_pref.customer_standing_prefs`, `service_pref.bundles_enabled`, `service_pref.smart_suggestions`
- `service_pref.sla_adjustment`, `service_pref.repeat_last_order`
- Numeric limits: `max_service_prefs_per_item`, `max_service_prefs_per_piece`, `max_bundles`, etc.

### 2.2 Tenant Settings (sys_tenant_settings_cd)

Add category `SERVICE_PREF` and settings:

- `SERVICE_PREF_DEFAULT_PACKING`, `SERVICE_PREF_SHOW_PRICE_ON_COUNTER`
- `SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS`, `SERVICE_PREF_ALLOW_NOTES`
- `SERVICE_PREF_ENFORCE_COMPATIBILITY`, `SERVICE_PREF_REQUIRE_CONFIRMATION`
- `SERVICE_PREF_PACKING_PER_PIECE_ENABLED`, `SERVICE_PREF_BUNDLES_SHOW_SAVINGS`

---

## Phase 3: Constants and Types

**Files:** [web-admin/lib/constants/service-preferences.ts](web-admin/lib/constants/), [web-admin/lib/types/service-preferences.ts](web-admin/lib/types/)

- `SERVICE_PREFERENCE_CODES`, `PACKING_PREFERENCE_CODES`, `PREFERENCE_CATEGORIES`, `PREFERENCE_SOURCES`
- Types: `ServicePreference`, `PackingPreference`, `OrderItemServicePref`, `OrderPieceServicePref`, `ResolvedPreferences`

---

## Phase 4: API Routes and Services

### 4.1 API Routes (web-admin/app/api/v1/...)

| Route                                                                           | Purpose                                                  |
| ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `GET /catalog/service-preferences`, `packing-preferences`, `preference-bundles` | Catalog fetch                                            |
| `GET/POST/DELETE /orders/[id]/items/[itemId]/service-prefs`                     | Item-level prefs                                         |
| `GET/POST/DELETE /orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs`    | Piece-level (Enterprise, table: org_order_item_pc_prefs) |
| `PATCH /orders/[id]/items/[itemId]/packing-pref`                                | Packing pref update                                      |
| `POST /orders/[id]/items/[itemId]/apply-bundle/[bundleCode]`                    | Apply Care Package                                       |
| `POST /orders/[id]/repeat-from/[sourceOrderId]`                                 | Repeat last order                                        |
| `GET /resolve-preferences`, `suggest-preferences`                               | Resolution/suggestion                                    |
| `GET/POST/DELETE /customers/[id]/service-prefs`                                 | Customer standing prefs                                  |

### 4.2 Services

- **PreferenceCatalogService** — fetch catalogs with tenant overrides
- **OrderItemPreferenceService** — CRUD item prefs, recalc `service_pref_charge`
- **OrderPiecePreferenceService** — CRUD piece prefs (Enterprise-gated)
- **PreferenceResolutionService** — call `resolve_item_preferences`, apply customer/product defaults
- **PreferenceLimitService** — enforce plan limits
- **ReadyByCalculationService** — integrate `calculate_ready_by_with_preferences`

---

## Phase 5: Order Creation Integration

**File:** [web-admin/lib/services/order-service.ts](web-admin/lib/services/order-service.ts)

- Extend `CreateOrderParams.items` with `servicePrefs`, `packingPrefCode`, `pieces[].servicePrefs` (when piece-level enabled)
- Before insert: call `resolve_item_preferences` for defaults; merge with explicit selections
- Insert into `org_order_item_service_prefs` and `org_order_item_pc_prefs`
- Set `packing_pref_code`, `service_pref_charge` on items and pieces
- **Order total** = sum of (item `total_price` + item `service_pref_charge`) for all items. Extend [order-calculation.service.ts](web-admin/lib/services/order-calculation.service.ts) to accept and include `servicePrefCharge` per item in subtotal.

---

## Phase 6: New Order UI

**Files:** [web-admin/src/features/orders/](web-admin/src/features/orders/)

- **ServicePreferenceSelector** — multi-select for service prefs (gated by `service_preferences_enabled`)
- **PackingPreferenceSelector** — single-select for packing (gated by `packing_preferences_enabled`)
- **CarePackageBundles** (Growth+), **RepeatLastOrderPanel** (Starter+), **SmartSuggestionsPanel** (Growth+)
- **PreferencePriceImpact**, SLA adjustment display
- Extend [new-order-types.ts](web-admin/src/features/orders/model/new-order-types.ts) `OrderItem` with `servicePrefs`, `packingPrefCode`; `PreSubmissionPiece` with `servicePrefs`
- Extend [new-order-form-schema.ts](web-admin/src/features/orders/model/new-order-form-schema.ts) and reducer

---

## Phase 7: Per-Piece UI (Enterprise)

- Gate by `service_pref.per_piece_packing` and `service_pref.per_piece_service_prefs`
- Per-piece detail modal: packing radio per piece, "Apply default to all", piece-level ServicePreferenceSelector when enabled
- Show `service_pref_charge` per piece when applicable

---

## Phase 8: Assembly Screen Updates

**Files:** [web-admin/src/features/assembly/](web-admin/src/features/assembly/)

- Display service prefs and packing prefs per piece
- Processing confirmation (Enterprise, `service_pref.processing_confirmation`)
- Override warning when packing differs from default

---

## Phase 9: Receipt and Ready-By

- **Receipt/WhatsApp:** Add placeholders `{{preferences_summary}}`, `{{eco_score}}`, `{{service_pref_charge}}` in [receipt-service.ts](web-admin/lib/services/receipt-service.ts)
- **Ready-by:** Integrate `calculate_ready_by_with_preferences` in [ready-by-calculator.ts](web-admin/lib/utils/ready-by-calculator.ts) when `service_pref.sla_adjustment` enabled

---

## Phase 10: Permissions and RBAC

Per [add-new-permission](.cursor/commands/add-new-permission.md):

- `orders.service_prefs.view`, `orders.service_prefs.edit`
- `config.preferences.manage`, `customers.preferences.manage`
- Append to `docs/master_data/Permissions_To_InsertTo_DB.sql`

---

## Phase 11: i18n

- Search existing keys in `en.json`, `ar.json` before adding
- Add keys for: Service Preferences, Packing Preferences, My Preferences, Care Packages, Preferences Catalog, etc.
- Run `npm run check:i18n` after changes

---

## Phase 12: Admin Config UI

- Preferences catalog management (enable/disable, custom prices)
- Packing preference config
- Care package bundles (Growth+)

---

## Phase 13: Prisma Sync and Build

- Run `npx prisma generate` after migration (user applies migration first)
- Run `npm run build` in web-admin; fix ESLint/TypeScript until success

---

## Phase 14: Documentation

Per [.claude/skills/documentation/reference.md](.claude/skills/documentation/reference.md), create in `docs/features/Order_Service_Preferences/`:

| File                                                 | Purpose                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| README.md                                            | Overview, scope, navigation                                    |
| development_plan.md                                  | Roadmap, milestones                                            |
| progress_summary.md                                  | Completed work, outstanding items                              |
| current_status.md                                    | Implementation state                                           |
| developer_guide.md                                   | Code structure, services, API                                  |
| developer_guide_mermaid.md                           | Flowcharts                                                     |
| user_guide.md                                        | User workflows, UI walkthrough                                 |
| user_guide_mermaid.md                                | User flow diagrams                                             |
| testing_scenarios.md                                 | Test cases, acceptance criteria                                |
| deploy_guide.md                                      | Deploy steps                                                   |
| CHANGELOG.md                                         | Versioned changes                                              |
| version.txt                                          | e.g. v1.0.0                                                    |
| technical_docs/tech_data_model.md                    | Tables, columns                                                |
| technical_docs/tech_api_spec.md                      | API endpoints                                                  |
| implementation_requirements.md                       | Permissions, nav, settings, flags, i18n, API, migrations, RBAC |
| technical_docs/tech_preference_resolution_mermaid.md | Resolution flow diagram                                        |

Update `docs/folders_lookup.md`, `docs/documentation_map.md`, `docs/Database_Design/`.

---

## Implementation Order (from Plan Part K)

1. Migration 0139 (schema, seed, functions, flags, settings) — **create only**
2. Add SERVICE_PREF to sys_stng_categories_cd if missing
3. Constants and types (with Zod schemas aligned to constants)
4. API routes and services (including piece-level); Zod validation for inputs
5. Feature flag service extension (plan-bound flags for service_pref.\*)
6. Extend order-calculation.service with servicePrefCharge per item
7. Order creation integration
8. New order UI components
9. Edit order: add ServicePreferenceSelector, PackingPreferenceSelector to edit flow
10. Per-piece service pref UI (Enterprise)
11. Receipt/WhatsApp templates
12. Ready-by integration
13. Assembly screen updates
14. Invoice: service preferences line / additional services (when service_pref_charge > 0)
15. Admin config UI
16. Navigation tree: Preferences catalog, customer prefs tab
17. Permissions
18. i18n
19. Prisma sync
20. Unit and integration tests (80% coverage for business logic)
21. Documentation
22. Build and test

---

## Key Constraints

- **Migrations:** Create file only; user applies manually
- **Money fields:** DECIMAL(19, 4) per CLAUDE.md
- **RLS:** All `org_*` tables filter by `tenant_org_id` (use `current_tenant_id()` per 0061)
- **UI:** Cmx design system only; imports from `web-admin/.clauderc`
- **Conflict resolution:** Use `SERVICE_PREF_ENFORCE_COMPATIBILITY` — true = block incompatible prefs, false = warn only

---

## Best Practice Audit and Gap Fixes

### Database Conventions (CRITICAL)

- **Max 30 chars for all DB objects** per [database SKILL](.claude/skills/database/SKILL.md). `org_order_item_piece_service_prefs` = 33 chars — **exceeds limit**. Use `org_order_item_pc_prefs` (24 chars) or add `pref` abbreviation to [feature-abbreviations.md](.claude/skills/database/feature-abbreviations.md) and use `org_pref_order_pc_prefs`.
- **Fix typo:** `default_dacking_pref` → `default_packing_pref` (already noted in plan).

### Tenant Isolation

- **`org_customer_service_prefs`** must include `tenant_org_id` and FK to `org_customers_mst` (tenant-scoped customer). Use composite `(tenant_org_id, customer_id)` for uniqueness.
- **Composite FKs:** `org_service_preference_cf` and `org_packing_preference_cf` need `(tenant_org_id, preference_code)` unique; FK to sys catalog where applicable.

### Order Total and Calculation

- **Extend [order-calculation.service.ts](web-admin/lib/services/order-calculation.service.ts):** Add `servicePrefCharge?: number` per item to `OrderCalculationParams.items`; include in subtotal before discounts/tax.
- **Order creation:** Ensure `calculateOrderTotals` is called with `service_pref_charge` per item so final total is correct.

### Invoice Integration (Gap)

- **Invoice line:** Per IMPLEMENTATION_PLAN Part B, add "Service Preferences / Additional Services" as invoice line when `service_pref_charge > 0`. Document whether this is a separate invoice line or rolled into item lines; implement accordingly.

### Edit Order Flow (Gap)

- **Edit order screen** must support add/remove service prefs and packing pref. API routes already support it; ensure [edit order UI](web-admin/src/features/orders/) includes ServicePreferenceSelector and PackingPreferenceSelector when in edit mode.

### Navigation Tree (PRD Checklist)

- **Add to sys tree:** Preferences catalog screen, customer prefs tab (in customer detail), admin settings for SERVICE_PREF. Document in implementation_requirements.md.

### Validation and Error Handling

- **Zod schemas:** Create validation schemas for API inputs (add pref, apply bundle, etc.) aligned with constants. Per CLAUDE.md: "Validation (Zod) should align with the same constants."
- **Error handling:** Use logger utility; include tenantId in all logs. Handle compatibility conflicts (block vs warn per setting).

### Feature Flag Resolution

- **Extend feature flag service:** Service pref flags (`service_pref.*`) live in `hq_ff_feature_flags_mst` / plan mappings. Ensure [feature-flags.service.ts](web-admin/lib/services/feature-flags.service.ts) or a plan-flag resolver can return these for UI gating. Document how plan-bound flags are resolved (tenant plan → enabled_plan_codes → flag value).

### Settings Category

- **sys_stng_categories_cd:** Add `SERVICE_PREF` category if not present before inserting `SERVICE_PREF_*` settings.

### Testing (PRD Requirement)

- **Unit tests:** PreferenceResolutionService, PreferenceLimitService, service_pref_charge calculation, conflict resolution (block vs warn).
- **Integration tests:** Order creation with prefs, edit order add/remove prefs.
- **Target:** 80% coverage for business logic per PRD implementation rules.

### Documentation Metadata

- **Frontmatter:** Every markdown file needs `version`, `last_updated`, `author` per Part N.5 of IMPLEMENTATION_PLAN_COMPLETE.
