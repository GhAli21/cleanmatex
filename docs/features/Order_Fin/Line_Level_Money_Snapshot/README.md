# Line-Level Money Snapshot

Every order line (item, and piece when the organization prices per piece) stores its own money:
list price, speed premium, line discount, share of the order discount, net, tax category, tax and
line total. The order header is the sum of its lines. One pure calculator (`web-admin/lib/commercial/`)
prices New Order, the cart quote, the payment modal, Create, booking and Order Edit, so a Preview,
a saved order and an edited order always agree.

| Doc | What it is |
|---|---|
| [PLAN.md](PLAN.md) | Approved plan (v2.1), phases P0–P11, decisions L1–L25 |
| [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md) | The architecture decision |
| [STATUS.md](STATUS.md) | Progress log per increment, remaining work |
| [developer_guide.md](developer_guide.md) | Calculator contract, `lib/commercial/` boundary, how to extend |
| [user_guide.md](user_guide.md) | Speeds, Speed Pricing, line discounts, tax categories, rounding (EN/AR) |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Owner-runnable scenarios |
| [followups_by_user.md](followups_by_user.md) | Everything left for the owner (QA, HQ rules, commit) |
| [CHANGELOG.md](CHANGELOG.md) · [version.txt](version.txt) | Release notes |
| Background | [PHASE0_FINDINGS.md](PHASE0_FINDINGS.md) · [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md) · [VAT_Settings_Fallback_Retirement_Plan.md](VAT_Settings_Fallback_Retirement_Plan.md) · [DISCUSSION.md](DISCUSSION.md) |
| Rules | [`docs/dev/rules/order-fin-rules.md`](../../../dev/rules/order-fin-rules.md) · skill `/order-fin` · [`no-silent-money-mutation.md`](../../../dev/rules/no-silent-money-mutation.md) |

Runs as one sequence with [Reusable Order Fin View](../Reusable_Order_Fin_View/README.md), which shows these figures,
and [Order Edit V2](../../Order_Edit_V2/CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_ACTIVE_ONLY/Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md), which edits them.

## Implementation checklist

| Area | This feature |
|---|---|
| Permissions | **None new.** Speed Pricing reuses `pricing:read/create/update/delete/bulk`; line discount `orders:discount`; price override `pricing:override`; Edit `orders:edit`, `orders:edit_override`. |
| Navigation | Catalog › **Speed Pricing** `/dashboard/catalog/speed-pricing` (`navigation.ts` + `sys_components_cd` row `catalog_speed_pricing`, migration 0691). |
| Tenant settings (HQ-owned) | `org_tenants_mst.commercial_level` (`ITEM` / `PIECE`), `disc_alloc_mode`, `disc_alloc_basis`, `tax_pricing_mode`, `extra_price_pricing_mode`; branch overrides. Written by HQ only: the tenant app answers `403 FIELD_MANAGED_BY_HQ`. `TENANT_VAT_RATE` and the other VAT settings are retired (0673). |
| Feature flags / plan limits | None. |
| API routes (new) | `app/api/v1/catalog/speed-rules` (list, create, `[id]`, `bulk`, `resolve`). Create, payment quote, booking and Order Edit routes keep their paths and now run on the calculator. |
| API routes (removed) | `POST /api/v1/pricing/calculate`, `PATCH /api/v1/orders/[id]/update`, the legacy preparation item routes (no callers left). |
| Migrations | 0639–0645 (M1–M7: speed and tax-category codes, speed rules, commercial settings, tax rounding, line money on items / pieces / preferences / discounts / charges, fiscal item lines), 0646 (exempt reasons), 0661, 0662, 0664 (Edit line targets), 0665, 0673 (VAT setting retirement), 0691 (Speed Pricing nav + audit), 0692 (piece speed / discount in Edit), 0694 (zero rules retired), 0698 (demo catalog fix), 0699 (M10 NOT NULL + CHECKs), 0700 (M11 retired product Express columns). All applied local + remote. |
| Constants / types | `lib/constants/commercial.ts` (`SERVICE_SPEEDS`, `TAX_CATEGORIES`, `SPEED_PRICE_TYPES`, `COMMERCIAL_LEVELS`, `DISC_ALLOC_MODES`, `PRICE_SOURCES`, `MONEY_BASIS`, `TAX_EXEMPT_REASONS`…), `lib/validations/speed-rule-schemas.ts`, `lib/validations/tax-profile-rounding-schema.ts`, `OrderCalculationResult` in `lib/types/order-financial.ts`. |
| i18n | `messages/{en,ar}/catalog.json` (Speed Pricing), `newOrder/lineBreakdown.json`, `orders/edit.json` (Edit codes such as `LINE_SPEED_LOCKED`, `ORDER_NEEDS_RECOMPUTE`), `orders/finView.json`. |
| Shared UI | `CmxListOfValuesDialog` gained optional `onSearchChange` (server search). |
| Env vars | None. |
| HQ (`cleanmatexsaas`) | Tax & Pricing card (commercial level incl. `PIECE`, allocation), branch Pricing overrides, catalog seeders call `seed_product_speed_rules`. Owner: Edit policy rules for line / piece speed, discount and price. |
| Mobile | `cmx_mobile_apps` customer app: booking error codes, server total (P6-04). |
