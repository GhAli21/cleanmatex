# Changelog — Line-Level Money Snapshot

## 1.0.0 — 2026-11-07

Plan complete in code (P0–P10, P11 gates and docs). Owner QA ([QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)) and HQ Edit policy rules remain.

### Added
- One pure commercial calculator `lib/commercial/` (ADR-060): standard price, speed premium, modifiers, override, line and order discounts (largest-remainder allocation), tax per row (inclusive / exclusive, `LINE` / `DOCUMENT` rounding), `ITEM` / `PIECE` levels, ready-by, invariants I1–I6.
- Line money on items, pieces, preferences, discounts and charges; fiscal item lines `org_tax_doc_items_dtl` (M1–M7, 0639–0645).
- Service speeds and tax categories as code tables; Speed Pricing rules `org_speed_price_rules_cf` and the screen Catalog › Speed Pricing (0691).
- New Order: quote-driven cart, per-line speed, line discount with reason, `PRICE_CHANGED` confirmation, custom items.
- Order Edit on the calculator: per-line and per-piece speed, line price, line and piece discount, custom lines, price confirmation in Review (0662, 0664, 0692).
- HQ: commercial level (`ITEM` / `PIECE`), discount allocation, branch pricing overrides; tenant app refuses those fields (`FIELD_MANAGED_BY_HQ`).
- DB constraints on line money (0699): NOT NULL, net / line-total identities, speed-rule and price-list links.
- Committed-order column guard for data-API roles (0702, Order Edit V2 WP17).

### Changed
- Create, booking, payment quote and Edit all write the calculator's rows; the header is the sum of the rows.
- Tax comes only from tax profiles; `TENANT_VAT_RATE` and the VAT settings fallback are retired (0665, 0673).
- The snapshot writer locks the order row before reading, so settlement writers and Edit Apply never overwrite each other's totals (OC-CON-005).
- Edit preview counts cash change returned and disposed overpayment like the saved order.
- Products are unique on (organization, service category, product code); retired product Express columns (0700); seeders create Express speed rules.

### Removed
- Legacy money paths with no caller: `POST /api/v1/pricing/calculate`, `pricing.service`, `order-calculation.service` (`calculateOrderTotals`), `tax.service`, the legacy order update route, legacy preparation item routes, the `lib/db/orders.ts` totals writer, `EXPRESS` order charges.
