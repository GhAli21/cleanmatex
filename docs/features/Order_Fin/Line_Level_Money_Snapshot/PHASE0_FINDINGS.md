# Phase 0 Findings — Line-Level Money Snapshot + Reusable Order Fin View (combined)

**Date:** 2026-10-23 · **Scope:** Phase 0 of both plans, run as one pass (execution step 2) · **Method:** code reading (4 read-only discovery passes with file:line evidence) + remote DB reads (read-only) + web research for fiscal rules.
**Decisions taken from these findings:** [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md).
**Plans:** [Line-Level PLAN](PLAN.md) · [Reusable View PLAN](../Reusable_Order_Fin_View/PLAN.md)

Severity: **H** = wrong money stored or charged, or a security gap · **M** = wrong in some cases, or misleading · **L** = hygiene.
Owner: **NOW** = fix immediately as a security or correctness hotfix (execution step 2b) · **LL-Px** = Line-Level phase · **RV-Px** = Reusable View phase.

## 1. Money correctness and security findings

| ID | Sev | Finding (evidence) | Owner |
|---|---|---|---|
| PF-01 | **H** | **Price override is not enforced on the server for Create.** The submit-order route checks only `orders:create` (`app/api/v1/orders/submit-order/route.ts:91`). `calculateOrderTotals` accepts `priceOverride` with no permission check (`lib/services/order-calculation.service.ts:196`), and so does `/api/v1/orders/preview-payment`. Any cashier can set a price by sending a crafted request. Create also writes no `price_override` / `override_reason` / `override_by` (`lib/services/order-service.ts:1493-1519`). The legacy `lib/db/orders.ts:209-229` did enforce `pricing:override`. | **NOW** |
| PF-02 | **H** | **Create stores browser-sent line prices.** `price_per_unit` / `total_price` come from the client (`order-service.ts:1504-1505`). The server checks only order-level totals (`order-submit-orchestrator.service.ts:321-342`), and the header snapshot is then rebuilt from item rows (`order-financial-write.service.ts:567,689`). So the stored total can differ from the `saleTotal` that was charged, for example with a price-list discount, because the cart uses the product default price (`new-order-content.tsx:370-373`). | LL-P5 (server is the price authority) + RV D26 |
| PF-03 | **H** | **Price-list discount is applied twice in Edit.** SQL `get_product_price` returns `price*(1-discount_percent/100)` (verified on the remote DB). `PricingService.getPriceForOrderItem` then applies the percentage again to get `finalPrice` (`pricing.service.ts:217`). Edit uses `finalPrice` (`order-change-calculation.service.ts:158`). Create uses `basePrice`, which is discounted once. The TypeScript price-list lookup also ignores effective dates and priority (`pricing.service.ts:167-192`), so it can pick a different row than the RPC. | LL-P4-01 |
| PF-04 | **H** | **A tax-exempt order is still taxed.** On an exemption match the engine returns no lines (`tax-engine.service.ts:147-149`). `calculateOrderTotals` then treats "no lines" as "no profiles" and falls back to the tenant VAT setting (`order-calculation.service.ts:347-353`). | **NOW** |
| PF-05 | M | Exemption scope: one exempt service category on **any** line exempts the **whole** order (`orchestrator:311` + `tax-engine.service.ts:108-111`). | LL-P4-04 (per line) |
| PF-06 | M | `applies_to` on tax profiles is **never read** in any calculation. All `is_default` profiles stack (`tax-engine.service.ts:76-86`). Remote data: the defaults have empty `applies_to`; only non-default special profiles (exempt / zero-rated / tobacco) carry values. | LL-P4-04 (rule in ADR-060 §6) |
| PF-07 | **H** | **Order Edit money is not Create's money.** Edit uses today's single tenant VAT rate (no profiles, not the recorded rows: `order-change-preview-reads.ts:262`), passes no discounts, promotion or charges to the calculator (`order-change-preview.service.ts:414-430`), and has no rounding. Confirmed: EC-01, EC-02 (charges), EC-03/04 (tax), EC-08 (a notes or ready-by edit is rejected with `COMMERCIAL_TOTAL_CHANGED` at `order-change-apply.service.ts:830` on any order with delivery, a discount or a rate change). | RV-P1B (on LL-P4) |
| PF-08 | M | **B2B/VIP express orders lose the express price.** `determinePriceListType` replaces `express` with the customer's `b2b`/`vip` list (`pricing.service.ts:55-68`). | LL-P4-02: the speed premium is independent of the customer list (ADR-060 §5). A bug fix; disclosed in P1-01 sign-off. |
| PF-09 | M | **Three "is express" signals:** `priority === 'express'` (`app/api/v1/orders/[id]/route.ts:145`), `priority_multiplier === 0.5` (`order-service.ts:748,1419,…`), and `service_speed` (Edit only). **Create never sets `service_speed`.** | LL-P5 (one source: `service_speed`), M6 backfill from `priority`, LL-P8 readers |
| PF-10 | **H** (display) | **The Ready-order page and its two prints show 0 for every line total.** `ORDER_ITEM_STATE_SELECT` omits `total_price`/`price_per_unit` (`app/api/v1/orders/[id]/state/route.ts:60-81`), and the mapper defaults to 0 (`ready-order-types.ts:122`). Affects `app/dashboard/ready/[id]/page.tsx:163`, `order-receipt-print.tsx:140`, `order-details-print.tsx:91`. | RV-P1 (BF-21) |
| PF-11 | M | **The public booking API stores `total_price` with a different meaning from the web.** Booking excludes extras from `total_price` and adds `servicePrefCharge` separately (`app/api/v1/public/customer/booking/route.ts:896-933`). The web includes extras. Booking also has no express support. | LL-P5 (booking uses the same calculator) |
| PF-12 | M | Piece money is inconsistent. Create sets piece price = `item.totalPrice / qty` (item extras spread evenly; `order-service.ts:1567,1593`). Edit ADD_PIECE uses the unit price without extras (`order-change-structural-write.ts:278`). A piece-preference edit **replaces** the item `servicePrefCharge` instead of adding to it (`use-new-order-piece-preferences.ts:26-30,64-65`): suspected bug. | LL-P4-05 allocation; verify the replace bug in LL-P1-01 |
| PF-13 | M | **Ready-by does not use product turnaround fields.** It uses `sys_service_category_cd.turnaround_hh` / `_express`, then multiplies by 0.5 again for express (`order-service.ts:1838-1870`). Create stores the client's estimate (`order-service.ts:1382-1392`). Preparation completion uses category `turnaround_hh` (default 48). | LL-P5; owner item Q1 (§4) |
| PF-14 | M | Discount permissions and limits are **not enforced anywhere** (`orders:discount`, `orders:discount_threshold_override` are dormant: `orders-perm.ts:28-33`, migration 0411). | LL-P5 (line discounts gated by `orders:discount`); thresholds stay out of scope (no config) |
| PF-15 | M | **An auto-applied promo gets a discount row but no usage row.** Usage is logged only when `promoCodeId` was sent (`orchestrator:764-774`), so `max_uses` / `max_uses_per_customer` can be exceeded. Discount rows never set `promotion_id` / `stacking_group`. | LL-P5 |
| PF-16 | M | **Overpayment allocation to another order writes `outstanding_amount` / `total_paid_amount` directly**, with no snapshot recalculation and no `payment_status` update (`customer-receipt-excess-executor.service.ts:68-136`). | RV-P1 (BF-22) |
| PF-17 | M | Loyalty earn runs only at checkout (`order-settlement.service.ts:266-273`). The earn rate is not stored. There is no reversal or clawback type (`LOYALTY_TXN_TYPES` = EARN, REDEEM, EXPIRE, ADJUST, BONUS). This confirms LE-01. | RV-P1B-15 (unchanged) |
| PF-18 | L | The snapshot writer compares computed values with themselves (`order-financial-write.service.ts:297-323`), so `ORDER_TOTAL_COMPONENT_MISMATCH`, `DISCOUNT_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH` and `OUTSTANDING_MISMATCH` can never fire on a write. Three different outstanding formulas exist (reconciliation, writer, UI mapper). No check compares tax or discount rows with a recomputation. | RV-P1 (BF-14) |
| PF-19 | L | Order charges: the Create code adds ORDER charges after tax, untaxed (`order-calculation.service.ts:360-366`), while its header comment (`:63-68`) says they "participate in the tax base". | Pin with LL-P1-01 characterization; ADR-060 §6 sets the target |
| PF-20 | L | `org_order_taxes_dtl.metadata` is never written, and `exchange_rate` is left at 1. `CASH_TENDER` rounding context is defined but unused. | LL-P4/P5 hygiene |
| PF-21 | M | *(found in P1-01)* Clearing a price override in the New Order cart keeps the overridden unit price (`new-order-reducer.ts` `UPDATE_ITEM_PRICE_OVERRIDE` falls back to the already-overwritten `pricePerUnit`). The server prices the catalog price, so submit fails with `AMOUNT_MISMATCH`. Pinned by cart golden C03. | LL-P5 cart fix |
| PF-22 | M | *(found in P1-01)* `org_product_data_mst.price_type = 'FIXED'` (8 products on remote) and `min_sell_price` are stored but never read by pricing; a FIXED product is charged unit × quantity. Pinned by totals golden G04. | LL-P4-02; owner confirms FIXED meaning |
| PF-23 | L | *(found in P1-01)* Item `price_per_unit` / `total_price` are `numeric(10,3)`; pieces and charges are `numeric(19,4)`. Piece price = item total ÷ qty with no remainder, so 10 ÷ 3 stores 3 × 3.3333 = 9.9999 against an item total of 10.000 (FD-02). | LL-P3 M5 (widen) + P4-05 (largest remainder) |

**P1-01 update (2026-10-23):** PF-12 is **confirmed** in both directions (cart goldens C04, C05); the full sign-off list is in [P1_01_CHARACTERIZATION.md](P1_01_CHARACTERIZATION.md).

## 2. Data and DB facts (remote, 2026-10-23)

- **Volumes:**

  | Data | Count |
  |---|---|
  | Orders | 6 (all with tax rows) |
  | Payments | 10 |
  | Order changes | 4 |
  | Charges, discounts, refunds, credit applications, tax documents | **0** |

  **The golden fixtures (G1, G2, E1) cannot be sampled from real data.** They are built as synthetic fixtures in the local DB-integration harness and in unit fixtures (RV-P0-02 → LL-P1-01).
- **Read-model sources:** all have tenant-first `(tenant_org_id, order_id)` indexes except `org_rcpt_receipts_mst` (`order_id` only). `org_loyalty_txn_dtl.account_id` has a single-column FK. Both go to RV-P2.
- **Composite-FK targets:** `(id, tenant_org_id)` unique keys exist on items, pieces and preferences. Charges, discounts and taxes have only `id` as their key.
- **Tax profiles:** tenant `1111…` has default VAT 5% + CUSTOM municipal 2% (stacking); tenant `c9ac…` has default VAT 15%. Exempt / zero-rated / tobacco profiles are non-default and carry `applies_to`.
- **Products:** `multiplier_express` values are 1.00 / 1.36 / 1.50 / 1.80 / 2.00 (written as factors). 95 products have an express price.

## 3. Architecture findings

- **Calculators to replace** (live): `calculateOrderTotals`, `PricingService.getPriceForOrderItem` + `determinePriceListType`, `get_product_price` (SQL), `createOrderInTransaction` price writes, `calculateOrderChangeTotals` + `sellingUnit` + `reviewedItemTotal`, the preview-reads quote and tax rate, the structural and commercial writers, `speedPriceUpdates`, and the client cart math (`new-order-reducer.ts` `itemLineBasePlusPrefCharges` / SET_EXPRESS, `use-order-totals`, `use-payment-totals` fallback). Legacy or dead: `lib/db/orders.ts` (`addOrderItems` is used only by the prepare page), `PricingService.calculateOrderTotals`, `pricing-calculator.ts`, `calculateTaxInTx`, `toFinancialBreakdownSnapshot`, `lib/db/orders.ts createOrder`.
- **Server engine for an unsaved cart already exists:** `POST /api/v1/orders/preview-payment` (wraps `calculateOrderTotals`). It is the natural base for the Create quote route.
- **Order Edit preview** is about 20-25 DB round trips plus N price quotes, and is tied to an edit session, capability checks and the review proof. A quote cannot be a flag on it, so it is a **sibling route** (ADR-060 §9). This corrects Reusable View PLAN §6.4 wording.
- **payment-modal-v4** opens only in New Order (blocked while `editSession` is set). `orderValueBreakdownModel` (`payment-full-view.tsx:1429-1524`) is the ready source for the draft view. Summary button: header, next to `PaymentModeToggle`.
- **Duplicate renderers** of the order financial snapshot: `orders-financial-tab-rprt.tsx`, `order-financial/*`, and the inline waterfall + sidebar in `full/order-details-full-client.tsx` (three in total). This confirms BF-12.
- **No report reads item-level speed or tax category today.** The only item-level aggregate is `dashboard.service.ts:490-497`. New indexes are needed only when such reports are added.

## 4. Coordination (RV-P0-09)

- **Extend Order Edit Policy:** Phase 2 (tenant resolver, context, capability, Preview, Apply, review, UI) is **done**. The open work is Phase 1 residual acceptance and Phases 3-5 (HQ API, HQ screens, proof). It has **no open tenant-file work**.
- **Agreed order and ownership:** from now on, money-related changes to `order-change-preview.service.ts`, `order-change-preview-reads.ts`, `order-change-calculation.service.ts`, `order-change-apply.service.ts`, `order-change-structural-write.ts`, `order-change-commercial-write.ts` and `order-change-review-audit.ts` belong to these two programs (LL-P6 and RV-P1B). Policy-related code (resolver, capability, policy revalidation, policy UI) stays with Extend Order Edit Policy. Recorded in both STATUS files and in the Edit Policy STATUS.

## 5. Fiscal requirements (LL-P0-12)

- **Saudi Arabia (ZATCA):**
  - Each line carries a tax category from UNCL5305 (`S`, `Z`, `E`, `O`).
  - Every non-`S` category needs an exemption **reason code** (`VATEX-SA-…`, at line level) plus reason text.
- **Oman:** Decision 189/2026 sets mandatory structured e-invoices from 1 April 2027 (supplies over OMR 5M) and 1 October 2027 (others). The format is Peppol PINT Oman (UNCL5305 categories). The exact line-field list must be checked against the PINT OM specification before LL-P8-02.
- **Plan impact:**
  - `sys_tax_category_cd` gets a `uncl5305_code` column.
  - `tax_exempt_reason` becomes a code from a new **`sys_tax_exempt_reason_cd`** (country, code, bilingual name), never free text.

Sources:
- [Vertex: Saudi Arabia tax categories](https://developer.vertexinc.com/einvoicing/docs/saudi-arabia-tax-categories)
- [ZATCA developer forum: exemption reasons per category](https://zatca1.discourse.group/t/multiple-tax-exemption-reason-codes-for-the-same-tax-category/8940)
- [Qoyod: BT-121 reason codes at line level](https://www.qoyod.com/en/knowledge-base/e-invoicing/b2g-zero-rated-reason-bt121/)
- [peppol.nu: Oman Decision 189/2026](https://www.peppol.nu/en/news-items/e-invoicing-oman-decision-189-2026/)
- [e-invoice.app: Oman guide](https://www.e-invoice.app/guides/oman-e-invoicing)

## 6. Owner items raised by Phase 0

1. **Q1, express turnaround (PF-13):** ready-by uses **category** turnaround today; product `turnaround_hh_express` is never used. Seeding product turnaround into speed rules would start using it, which changes ready-by for about 120 products. **Recommendation:** seed the product turnaround into the rules (it is what the field means and what the owner moved), and disclose the change in the P1-01 sign-off. The alternative (strict L17) is to seed the turnaround only for products whose value equals the category's effective express turnaround today.
2. **Q2, bug fixes that change figures:** PF-04 (exempt orders taxed), PF-08 (B2B/VIP express) and PF-03 (Edit double discount) change money **toward the correct value**. **Recommendation:** fix them, listed in the P1-01 sign-off, with no compatibility code (pre-launch).
