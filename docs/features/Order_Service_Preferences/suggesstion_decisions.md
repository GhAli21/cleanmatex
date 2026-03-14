
Yes study this file content and then after that build a concrete comprehensive implementation plan
- All Implementation should follow approach of best-practices, no gap, ready for production
- include task of create/update documentations in the plan
- Check and Study the Suggested table for Services Preferences and Notes Tables in the sql file at F:\JhApps_doc\CleanMateX_Jh\Dev\Order Service Preferences\Suggested_Services_Preferences_and_Note_Tables.sql

## 1. Business & Laundry Domain Enhancements

### 1.1.

configuration should be first in SAAS HQ Back-office cleanmatexsaas to easily copy those in tenant imitation/creation and maintenance
, and then for tenant client app can if allowed to edit or create new...etc

check codebase of cleanmatex and cleanmatex and Query tables structure and data to understand about what table for:
sys_items_data_list_cd
sys_service_prod_templates_cd
sys_item_type_cd
sys_service_category_cd
org_service_category_cf
org_product_data_mst

study to add this features:
- applies to service category such as, a service category can have multi preferences, in detailed table in sys_* first then in org_*
SERVICE_PREF_ENFORCE_COMPATIBILITY is for service category, either block or only warn
- applies to products such as, a product can have multi preferences, in detailed table in sys_* first then in org_*
- applies to fabric types also

### 1.2.
- Preference Attribution:
prefs_owner_type, Who Own this Prefs  CUSTOMER, USER, SYSTEM
prefs_source, From where this prefs come: ORDER_CREATE, LAST_ORDER, CUSTOMER_SAVED, SYSTEM, "Auto: Customer preference", "From bundle: Premium Care", "Repeat: Last order", manual, customer_pref, bundle, repeat_order, etc.
prefs_level, From which level this prefs come, ORDER, ITEM, PIECE

Study this suggestion of the order Preference table that can have Order Preferences Or Order Items Preferences Or Order Item Pieces Preferences
table org_order_prefs_dtl (
   id                   UUID                 not null default 'gen_random_uuid()',
   branch_id            UUID                 not null,
   order_id             UUID                 not null,
   tenant_org_id        UUID                 not null,
   record_source        TEXT                 not null, -- ORDER or ITEM or PIECE, if ITEM so order_item_id required, if PIECE so piece_id required
   order_item_id        UUID                 null,
   piece_id             UUID                 null,
   prefs_owner_type     TEXT                 null,
   prefs_source         TEXT                 null,
   prefs_level          TEXT                 null,
   org_prefs_ctg_code   TEXT                 not null,
   org_prefs_option_code TEXT                 not null,
   processing_confirmed BOOLEAN              null default 'false',
   confirmed_by         TEXT                 null,
   confirmed_at         TIMESTAMP            null,
   option_price         DECIMAL(19,4)        null,
   option_desc          TEXT                 null,
   option_customer_notes TEXT                 null,
   option_internal_notes TEXT                 null,
   is_done              BOOLEAN              not null default 'false',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
)
which:
prefs_owner_type, Who Own this Prefs  CUSTOMER, USER, SYSTEM, AUTO
prefs_source, From where this prefs come: ORDER_CREATE, LAST_ORDER, CUSTOMER_SAVED, SYSTEM, "Auto: Customer preference", "From bundle: Premium Care", "Repeat: Last order", manual, customer_pref, bundle, repeat_order, etc.
prefs_level, From which level this prefs come, ORDER, ITEM, PIECE

-

### 1.3 Branch-Level Preference Overrides : 
**Spec:** `org_service_preference_cf` has `branch_id` for branch-specific config.

My decision is: 
- branch-level is optional so if needed to be Tenant-Level only or branch-level for each
- Use branch-level overrides for multi-branch tenants (e.g. different starch prices per branch).
- Ensure resolution logic respects branch context if branch id exist.

### 1.4 Seasonal Templates (Enterprise)

**Spec:** `org_seasonal_pref_templates_cf` in V3.

**Gap:** Not implemented yet.

**Recommendation:**
- Add migrations and APIs for seasonal templates.
- Support date ranges (e.g. Ramadan, Eid) and auto-apply rules.
- UI for creating and managing templates.

**My decision:**
- Accept your Recommendations also
- can be Tenant-Level or branch-level as optional to if want to make seasonal for specific branches

-

### 1.5 B2B Contract Preferences

**Spec:** `org_contract_service_prefs` for B2B defaults.

**Gap:** Not implemented.

**Recommendation:**
- Add contract-level preference defaults.
- When order is linked to a contract, auto-apply contract prefs with `source=contract_default`.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

-

## 2. UI/UX Enhancements

### 2.1 Preference Selector UX

**Current:** Checkboxes for service prefs; dropdown for packing.

**Recommendations:**
- Group service prefs by `preference_category` (washing, processing, finishing).
- Show `extra_turnaround_minutes` (e.g. "+3h" for SEPARATE_WASH).
- Show `sustainability_score` (eco points) when relevant.
- Use icons from `sys_service_preference_cd.icon` for faster recognition.
- Respect `SERVICE_PREF_SHOW_PRICE_ON_COUNTER` consistently and default should be true.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

-

### 2.2 PackingPreferenceSelector

**Current:** Plain `<select>`.

**Recommendations:**
- Use Cmx design system components (e.g. `CmxSelect`).
- Add icons per packing type.
- Show sustainability hints (e.g. FOLD vs HANG).
- Consider radio-group layout for better visibility.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX
-

-

### 2.3 Care Package Bundles UX

**Recommendations:**
- Show savings vs individual prefs when `SERVICE_PREF_BUNDLES_SHOW_SAVINGS` is on.
- Show bundle contents before applying.
- Allow "Apply to all items" for bundles.
- Show bundle icon and short description.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

-

### 2.4 Smart Suggestions & Repeat Last Order

**Recommendations:**
- Make suggestions contextual (per product/category).
- Show confidence (e.g. "Used in 80% of Shirt orders").
- One-click "Apply suggestion" with clear feedback.
- Repeat Last Order: show order date and item summary.
- Support "Apply to current item" vs "Apply to all items".

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

-

### 2.5 Empty & Loading States

**Recommendations:**
- Empty state when no prefs are enabled.
- Skeleton/loading for catalog and suggestions.
- Clear messaging when features are plan-gated.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

### 2.6 Mobile & RTL

**Recommendations:**
- Ensure preference selectors work well on small screens.
- Test RTL layout for all preference components.
- Consider collapsible sections for long preference lists.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

---

## 3. Technical & Architecture Enhancements

### 3.1 Preference Resolution APIs

**Spec:** `GET /api/v1/preferences/resolve`, `/last-order`, `/suggest`.

**Gap:** These may not be fully implemented or wired to the UI.

**Recommendation:**
- Implement and expose these APIs.
- Use resolution when creating a new order (customer + product).
- Use last-order and suggest APIs for Repeat Last Order and Smart Suggestions.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

### 3.2 Customer Preferences Tab

**Spec:** Customer detail → Preferences tab.

**Gap:** Implementation status unclear.

**Recommendation:**
- Add Customer Preferences tab with:
  - List of standing prefs
  - Add/remove
  - Scope (all, service category, product)
  - Changelog view when `changelog_audit` is enabled

**My decision:**
- Accept your Recommendations also
- make it best UI/UX
- how to enable `changelog_audit`

### 3.3 Admin Catalog Page

**Spec:** Dashboard → Catalog → Preferences.

**Recommendations:**
- Single page for service prefs, packing prefs, and bundles.
- Edit ability of all fields that can be edited.
- Enable/disable, pricing, display order.
- Custom preferences .
- Preview of how prefs appear on counter.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

### 3.4 Validation & Error Handling

**Recommendations:**
- Validate `maxPrefs` from plan limits.
- Validate incompatible combinations before submit.
- Clear error messages for limit and compatibility issues.
- Optional: optimistic UI with rollback on API failure.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

### 3.5 E2E Test Coverage

**Recommendation:**
- Add E2E tests for all such as and not limited to:
  - Add/remove prefs
  - Apply bundle
  - Repeat Last Order
  - Incompatibility (enforce vs warn)
  - Plan limit enforcement

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

---

## 4. SaaS & Monetization Enhancements

### 4.1 Upgrade Prompts

**Spec:** Show locked features with upgrade prompts.

**Recommendation:**
- Gray out locked features with tooltip.
- Use `UpgradePromptCard` for bundles, smart suggestions, etc.
- Link to upgrade/subscription page.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

### 4.2 Plan Limit Enforcement

**Recommendations:**
- Enforce `max_service_prefs_per_item` in UI and API.
- Enforce `max_active_catalog_items` when enabling prefs.
- Enforce `max_bundles` when creating bundles.
- Return clear error codes for limit violations.

**My decision:**
- Don't Enforce keep all open with default open for now let it open, maybe in the future

### 4.3 Analytics & Reporting

**Spec:** `org_daily_preference_metrics`, analytics dashboard (Enterprise).

**Recommendations:**
- Implement daily aggregation job for preference metrics.
- Dashboard: popular prefs, revenue from add-ons, fulfillment rates.
- Use for upsell and plan recommendations.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

---

## 5. Laundry-Specific Enhancements

### 5.1 GCC Market

**Recommendations:**
- Thobe/formal wear presets (e.g. Heavy Starch + Hang).
- Ramadan/Eid seasonal bundles.
- Arabic-first labels and descriptions.
- Currency and locale (OMR, SAR, AED, etc.).

**My decision:**
- Just create a documentation file name it GCC_Market_Laundry-Specific_Enhancements.md

### 5.2 Processing Workflow

**Recommendations:**
- Use `workflow_impact` for routing (e.g. `separate_batch`, `route_to_station`).
- Show prefs clearly in processing/assembly screens.
- Use `processing_confirmed` for quality assurance.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

### 5.3 Inventory Forecasting

**Spec:** `consumes_inventory_item` on packing prefs.

**Recommendations:**
- Use preference usage to forecast hangers, tissue, bags.
- Alerts when stock is low vs forecast.
- Reports for procurement.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

### 5.4 Eco/Sustainability

**Spec:** `sustainability_score` on catalogs.

**Recommendations:**
- Show eco score on receipt and in customer app.
- Eco badges (Seedling, Green, Tree, Planet).
- Optional: gamification (points, badges).

**My decision:**
- Accept your Recommendations also
- make it best UI/UX

---

## 6. Settings & Configuration Gaps

### 6.1 Missing Settings (from V3.1)

Compared to `Preferences_Settings_set.md`, these are not yet in settings:

| Setting | Purpose |
|--------|---------|
| `SERVICE_PREF_PACKING_SHOW_OVERRIDE_WARNING` | Show override badge in assembly |
| `SERVICE_PREF_BUNDLES_SHOW_ON_COUNTER` | Show bundles on counter |
| `SERVICE_PREF_SUGGESTION_MIN_ORDERS` | Min orders for suggestions |
| `SERVICE_PREF_SUGGESTION_MIN_FREQUENCY_PCT` | Min frequency % for suggestions |
| `SERVICE_PREF_SUGGESTION_LOOKBACK_DAYS` | Lookback for suggestions |
| `SERVICE_PREF_REPEAT_ORDER_COUNT` | Number of recent orders to show |
| `SERVICE_PREF_ECO_SHOW_SCORE` | Show eco score |
| `SERVICE_PREF_ECO_BADGE_THRESHOLDS` | Eco badge thresholds |
| `SERVICE_PREF_FEEDBACK_ENABLED` | Post-delivery feedback |
| `SERVICE_PREF_FEEDBACK_DELAY_HOURS` | Delay before feedback request |
| `SERVICE_PREF_SEASONAL_AUTO_APPLY` | Auto-apply seasonal templates |

**Recommendation:** Add these to `sys_tenant_settings_cd` and wire them into the UI and logic.

**My decision:**
- Accept your Recommendations also
- make it best UI/UX and best practice

### 6.2 TenantSettingsService

**Recommendation:** Extend `SETTING_CODES` and `TenantProcessingSettings` (or equivalent) to include all SERVICE_PREF settings used by the app.

**My decision:**
- Accept your Recommendations also

---

## 7. Prioritized Implementation Roadmap

**My decision:**
- Re-build the Prioritized Implementation Roadmap

### Phase 1 — Quick Wins (1–2 weeks)

1. Add preference source badges in UI.
2. Group service prefs by category.
3. Show SLA impact (e.g. "+3h") where relevant.
4. Use Cmx components for PackingPreferenceSelector.
5. Add missing tenant settings and wire them.
6. Enforce `maxPrefs` from plan in UI and API.

### Phase 2 — Customer & Resolution (2–3 weeks)

1. Implement preference resolution APIs.
2. Auto-apply resolved prefs on new order.
3. Add Customer Preferences tab.
4. Wire Smart Suggestions and Repeat Last Order to APIs.
5. Add fabric validation warnings.

### Phase 3 — Enterprise & Advanced (3–4 weeks)

1. Seasonal templates (schema, API, UI).
2. B2B contract preferences.
3. Fulfillment feedback and ratings.
4. Eco scoring and badges.
5. Preference analytics dashboard.
6. Inventory forecasting from preferences.

### Phase 4 — Polish & Scale

1. WhatsApp preference parsing (keywords).
2. Campaign targeting from preference usage.
3. E2E test suite for preferences.
4. Performance tuning for resolution and suggestions.

---

## 8. Gap Summary

| Area | Status | Priority |
|------|--------|----------|
| Preference resolution API integration | Partial | High |
| Customer Preferences tab | Unclear | High |
| Fabric validation | Not implemented | Medium |
| Source attribution in UI | Missing | High |
| Missing tenant settings | ~11 settings | Medium |
| Seasonal templates | Not implemented | Low (Enterprise) |
| B2B contract prefs | Not implemented | Low (Enterprise) |
| Eco scoring UI | Partial | Medium |
| Upgrade prompts for locked features | Partial | Medium |
| E2E tests | Minimal | High |

---

## 9. Single Validation Command

**Recommendation:** Add a dedicated script (e.g. `npm run test:preferences`) that runs preference-related E2E tests for faster validation.

**My decision:**
- Accept your Recommendations also

---
