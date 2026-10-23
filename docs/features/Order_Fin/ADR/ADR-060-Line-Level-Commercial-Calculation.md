# ADR-060: Line-Level Commercial Calculation (one calculator, line money on items and pieces)

**Status:** Accepted (owner-approved plans, 2026-10-23) · **Date:** 2026-10-23
**Covers:** Line-Level Money Snapshot plan (P0-06) and Reusable Order Fin View plan (P0-06, the commercial-calculator part).
**Evidence:** [PHASE0_FINDINGS.md](../Line_Level_Money_Snapshot/PHASE0_FINDINGS.md) · **Plans:** [Line-Level](../Line_Level_Money_Snapshot/PLAN.md), [Reusable View](../Reusable_Order_Fin_View/PLAN.md)

## Context

Order money is calculated in several places that disagree:
- Create (`calculateOrderTotals`)
- Edit (`calculateOrderChangeTotals`)
- the New Order cart (client math)
- the legacy prepare path
- SQL `get_product_price`

Create stores browser-sent line prices (PF-02). Edit discounts twice (PF-03) and uses a different tax model (PF-07). Exempt orders are taxed (PF-04). Line-level tax, discounts and speed are not stored at all, so the header buckets for exempt and zero-rated amounts, the fiscal item lines and piece-level money cannot be produced.

## Decisions

### 1. One pure, domain-agnostic calculator
- `web-admin/lib/commercial/`: no I/O, no Prisma, no Supabase, no i18n.
  - Vocabulary: `CommercialLine`, `SubUnit`, `ServiceLevel`, `PriceModifier` (placement `INCLUDED` / `SEPARATE`), `Adjustment` (scope `LINE` / `DOCUMENT`), `TaxContext`, `Charge`.
  - An ESLint `no-restricted-imports` rule enforces the boundary.
- `web-admin/lib/services/commercial/`:
  - `commercial-context.loader.ts` reads inputs, with an explicit `tenant_org_id` on every query.
  - `commercial-line.writer.ts` is the only writer of line-money columns.
  - `commercial-quote.service.ts` does loader → calculator, without writing.
- Use cases (Create orchestrator, Edit apply, booking, prepare) become thin: load → calculate → write → emit events.

### 2. The server is the only price authority
- Clients send **intents**:
  - product, quantity, speed
  - preference choices
  - override `{ price, reasonCode, reasonText }`
  - discount instructions
  - `confirmedUnitPrice` (D26)
- The server resolves every price and never stores a client price.
- A changed resolved price is rejected with `PRICE_CHANGED` (per line).
- An override requires `pricing:override` on **every** channel (Create, preview, Edit) and always writes `price_override`, `override_reason`, `override_by` (closes PF-01, PF-02).

### 3. Decimal arithmetic and versioning
- `Prisma.Decimal` end to end. Outputs are decimal strings, stored as `DECIMAL(19,4)`.
- The 7 `sys_rounding_mode_cd` modes plus an increment.
- `org_orders_mst.commercial_calc_version` records the version that wrote the order. Recompute and reconciliation are aware of it.

### 4. Line money on items and pieces
- Identical columns on items and pieces.
- `money_basis` = `PRICED` / `ALLOCATED` / `ROLLUP`. Both levels are always filled.
- Invariants I1–I6 (Line-Level PLAN §5.2), with largest-remainder allocation at output precision.
- Commercial level, tax mode, extra-price mode, discount allocation mode and the calc version are snapshotted on the order at Create. Edit never re-resolves them.

### 5. Price resolution
Order of resolution for each priced row:
1. **Standard price:** the customer list (b2b/vip) or the standard list, then the product default.
2. **Price-list discount:** `discount_percent` is a **line discount** with source `PRICE_LIST`, not hidden in the price. It is applied exactly once, which removes the double application (PF-03). `get_product_price` is replaced by a resolver that returns the list price and the discount separately, with effective dates and priority as today.
3. **Speed premium:** from `org_speed_price_rules_cf`, applied on top of the standard price whatever the customer list (PF-08 fixed). There is one speed signal, `service_speed`; `priority` stays a workflow priority only (PF-09).
4. **Preference extras:** by `extra_price_pricing_mode`.
5. Line discounts.
6. Document discount share or allowance.
7. Tax.

### 6. Tax per line
- **Profile selection:**
  - A profile with an **empty** `applies_to` is a default and applies to every line, as today.
  - A profile with values applies only to lines whose **supply code** is listed (for example `EXEMPT_SERVICE`, `EXPORT`).
  - A line with no supply code gets the defaults.
  - Today no product has a supply code, so results are unchanged (PF-06).
- **Category:**
  - Each line has `tax_category_code` (`STANDARD` / `ZERO_RATED` / `EXEMPT` / `OUT_OF_SCOPE`, mapped to UNCL5305 `S` / `Z` / `E` / `O`).
  - Non-standard lines carry a code from `sys_tax_exempt_reason_cd` (per country, bilingual).
- **Exemption:**
  - A customer exemption makes every line `EXEMPT` (reason `CUSTOMER_EXEMPTION`).
  - A service-type exemption applies **per line** (PF-05).
  - An exemption never falls back to the tenant VAT rate (PF-04).
- **Charges:**
  - ORDER-level charges are taxed by their own profile and category.
  - Until a charge has an explicit category, it reproduces today's treatment pinned by P1-01 (PF-19).
- **Rounding:** per profile (`rounding_level`, `rounding_mode`, decimals or increment), falling back to the currency `ACCOUNTING` rule.
- **Edit:** uses the **recorded** tax context of the order (profiles, rates, mode), never today's tenant rate (PF-07, D22).

### 7. Discounts
- Line discounts are rows with `discount_level` `ITEM` / `PIECE` and a target id. Entry requires `orders:discount` (PF-14). Thresholds stay out of scope until configuration exists.
- Order discounts follow `disc_alloc_mode`: `ALLOCATE_TO_LINES` or `DOCUMENT_LEVEL` (seeded, as today).
- `GIFT_CARD` is settlement only and never an adjustment (the calculator rejects it).
- Every applied promo, typed or automatic, records usage and `promotion_id` (PF-15).

### 8. Settings
- `commercial_level`, `disc_alloc_mode`, `disc_alloc_basis`, `tax_pricing_mode` and `extra_price_pricing_mode` are `org_tenants_mst` columns, with branch overrides for the two existing modes only.
- **HQ is the single writer** (L16, L18). The tenant app reads them; its APIs reject writes with `FIELD_MANAGED_BY_HQ`.
- This is a documented exception to "settings come from `sys_stng_*` via the HQ API", like cash-control settings. It is recorded in `docs/dev/rules/integration-contracts.md`.

### 9. Quotes
- One calculator, two thin quote routes:
  - `POST /api/v1/orders/quote`: an unsaved draft; replaces the cart's client math (closes BF-19); `orders:create`.
  - `POST /api/v1/orders/[id]/changes/quote`: Edit; reuses the change context and reads; no review proof, no lock, no write; `orders:edit`.
- The existing `preview-payment` route is moved onto the same quote service.

### 10. Security baseline
- Server actions never trust a caller tenant (`resolveActionTenant`, BF-20; `docs/dev/rules/server-action-tenant-guard.md`).
- External callers use API routes with proof: a mobile Bearer token verified for the tenant, an opaque tracking token, or an HQ service credential.

## Consequences

- **Positive:**
  - Create, Edit, the quote and booking agree by construction.
  - Line, piece and fiscal data exist.
  - Five live money defects close (PF-01…PF-05).
- **Changes in figures:** PF-03 / PF-04 / PF-08 are bug fixes that change figures toward the correct value. They are listed in the P1-01 sign-off and disclosed per rule #15.
- **Cost:** a larger, single, well-tested calculator; more columns per piece (writes are small).
- **Migration:** pre-launch, so demo orders are recomputed. No compatibility layers.

## Alternatives rejected

- **Patch each calculator separately:** keeps the drift that caused PF-02/03/07.
- **Store line money only at the commercial level:** readers would have to know the level, and piece refunds would need runtime allocation.
- **A quote flag on the Edit preview route:** it would bypass the session, capability and proof contracts.
- **Keep trusting client line prices and only add a total check:** the stored lines would still be wrong (PF-02).
