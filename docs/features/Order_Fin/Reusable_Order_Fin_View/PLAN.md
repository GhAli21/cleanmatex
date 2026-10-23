# Reusable Order Financial View — Implementation Plan

**Status:** DRAFT — awaiting owner review. No code is written until the owner approves this plan.
**Created:** 2026-10-22
**Owner decisions captured:** 2026-10-22 rounds 1–3, 2026-10-23 round 4 (see §2)
**Revision:** v6, 2026-10-23: production-readiness review (§13, PR-01…PR-26). Added D36 (domain-agnostic statement primitives), the Extend Order Edit Policy coordination, the HQ impact, the API standards, concurrency, lifecycle states, timezone, accessibility, observability, E2E, cleanup and the release readiness checklist. v5, 2026-10-23: external review (Cursor) evaluated. Accepted items were folded in as D29–D35: the release split, with public and edit in Release 1 (owner); the line contract; one meaning per header metric; reconciliation wording; no money on the Review button; loyalty not a gate; no polishing of old panels. Corrected BF-04, BF-09 and BF-11. Removed the permission-tier leftovers. Folder `order-fin-view`. `items` and `charges` replace `valueBreakdown`. Added §12 Releases. v4.1, 2026-10-23: added D26 (item price confirmation) and D27 (loyalty earn on every settle path), P1B-14 and P1B-15. v4 added D21–D25 (Order Edit calculation decisions; one shared commercial calculator is mandatory) and Phase 1B. v3, 2026-10-22: added D10–D13 (permission-agnostic component, public tender totals, modal preset, customer portal) and BF-17/BF-18. v2 added D6–D9. Structure and UI design under discussion in [DESIGN.md](DESIGN.md).
**Tracking:** [STATUS.md](STATUS.md)
**Next migration seq at time of writing:** `0637` (re-check `supabase/migrations/` before creating any file)

---

## 1. Goal

One reusable, tenant-safe, bilingual (EN/AR + RTL) **Order Financial View** that any screen can drop in to show an order's money story **correctly and completely**. The caller chooses how much to show:

- **The whole view:** a preset such as badge, totals, summary, detailed, full or audit.
- **Each section:** hidden, total only, total with expandable details, or always detailed.
- **The summary header:** which metrics to show (total, paid, balance, refunded and so on), which one is emphasized, and which badges appear.

The view must be correct before it is reused. **Phase 1 fixes every known bug in the existing stack first.**

### Non-goals

- No change to how money is **written** by payment, refund and settlement services; they stay frozen. The **one exception** is Phase 1B (owner D25): the commercial calculation is extracted into one shared calculator so Create, Edit Preview, Edit Apply and the live quote agree. Create's figures must come out **identical** (characterization tests, P1B-01). Apart from Phase 1B, the program is read and display only.
- The payment modal's engine (`payment-modal-v4`) is not replaced or changed. It gets an **additional** button that opens the read-only view (D8, P6-09). The existing modal components stay exactly as they are.
- No actions inside the view (collect, refund, void). The view is display-only. Host screens pass action buttons through slots.

---

## 2. Owner decisions (2026-10-22)

| # | Decision |
|---|---|
| D1 | **Full scope.** Cover every order-related financial source, including overpayment dispositions, loyalty, AR invoices and allocations, vouchers, order-change deltas, tax documents and the rest (§5). |
| D2 | **Fully configurable display:** a preset level, plus per-section display mode, plus a configurable summary header (§6). |
| D3 | **Bugs first.** Phase 1 fixes every known defect before any new component is built. The result must have no bugs or gaps. |
| D4 | The plan covers every layer: database, backend services, APIs and endpoints, server actions, frontend component, pages and screens, tests, rules or skill, and documentation. |
| D5 | The program ends with a new Order Fin rules file (plus a skill and Cursor rule), and an update of all related documentation. |
| D6 | **No new permission code.** Superseded in detail by D10. |
| D10 | **The component and service do no permission checks (for now).** The host screen or entry point decides whether to call or show the view, and which preset or sections to request. Entry points still authenticate and take the tenant from the session (§6.1). |
| D11 | **Public view shows payment totals by method label** (for example "Cash 5.000, Card 3.000"), with no references. |
| D12 | **payment-modal-v4 summary preset = `detailed`.** |
| D13 | **Customer portal** (`/api/v1/public/customer/orders`) reuses the public projection **now** (in scope). |
| D20 | **Order Edit live card** (owner request, 2026-10-23): a compact financial card or badge under the Review button in Order Edit, showing the **current, projected total** and updating as items are added or removed. Delivered as a fourth source, `edit` (§6.4). |
| D7 | **Public-safe version** in the **same domain** (same component, same mapper, same config contract), so any future change reaches it automatically. Only a server-side public projection and a `public` preset differ. |
| D8 | **payment-modal-v4:** add a button that opens the reusable Order Fin summary **read-only**, in addition to the current modal components and without replacing any. |
| D9 | **Order detail page:** default preset `detailed`, with an in-view switch to `full`. |
| D21 | **Recorded discounts on edit** (2026-10-23): manual percent re-applies its recorded rate to the new base; manual fixed amount is kept, capped at the new base; an automatic rule re-applies **the same recorded rule** (never "best rule today"); a promo is never redeemed twice, percent re-applies within its cap, fixed is kept and capped. A rule or promo that no longer qualifies is removed **only after the cashier acknowledges** a Review warning, and the promo use is given back at Apply. Stacking order is the same as Create. |
| D22 | **Tax rate on edit = the rate recorded on the order** (tax profiles and CUSTOM taxes included), not today's tenant rate. Untouched items never change tax because a rate changed later. |
| D23 | **One pricing rule for new lines:** an item added during an edit gets exactly the price it would get at Create. The price-list discount applies **in both places**. P0-08 checks which side differs today before anything changes. |
| D24 | **Loyalty points earned are adjusted at Apply.** Points are earned once, when the order is fully paid at checkout (`settleOrderTx` → `queueEarnPoints`), so "at completion" does not exist. If the order already earned points, Apply posts one idempotent delta (per change ID) to the loyalty ledger. If it never earned, nothing is posted. |
| D26 | **Item price confirmation** (owner delegated, 2026-10-23). The server is the only price authority, and the cashier is never charged a price they were not shown. Each submitted line carries the `confirmedUnitPrice` the cashier saw. If the server's price differs, the submit is rejected with `PRICE_CHANGED` and a per-line list, nothing is saved, and the cashier chooses to use the current prices (then submits again) or go back. Details in §6.5. |
| D27 | **Loyalty earn on every path that settles an order** (owner, 2026-10-23). One loyalty reconciliation call is used by checkout settlement, later payment collection, Order Edit Apply (D24), refunds and cancellation. This closes LE-01. Details in §6.5. |
| D28 | **No cash-handling section** (owner, 2026-10-23). Cash drawer and session data stay in the POS and cash drawer screens, not in the Order Financial View. `cashHandling` is removed from the section keys, the presets, the sources and P0. |
| D29 | **Two releases, one component** (owner, 2026-10-23). Release 1 includes the `public` preset and the `edit` source. See §12. D1 (every source) is still the end state, at the end of Release 2. |
| D30 | **Line contract** (review, decided by Claude). Each line carries `unit` (`money` or `points`), `role` (`additive`, `included` or `informational`), `countsInTotal`, and `previousAmount` for edit lines. The view carries `sourceKind` (`saved`, `draft` or `edit`). Points never enter a money sum. Informational amounts (document totals, voucher face values, order-change deltas, base-currency equivalents) never share the settlement amount column (§6.6). |
| D31 | **One meaning per header metric** (§6.6). `collected` is dropped, because it double-counts credits. `payOnCollection` is dropped as a separate number: a pay-on-collection order shows its balance as "Due at collection" plus the settlement badge. The same applies to invoices. This order's share of an AR invoice normally **equals** the balance (the existing reconciliation check warns when it doesn't), so the header shows the balance as "Due on invoice" rather than a copied `receivable` number. The Receivable section carries the invoice facts as informational lines: invoice number, whole-invoice outstanding, this order's share, due date and allocations. `receivable` stays available as an opt-in metric, not in any default preset. Every header, `full` and `audit` included, shows the hero plus at most three metrics; other figures live in the statement. |
| D32 | **Reconciliation wording:** "Reconciled", "Figures differ" or "Recalculating". Never "Balanced", which reads as "the customer owes nothing". |
| D33 | **The Review button carries no money.** It is labelled "Review", and the live card is the only total on the edit screen. This replaces the earlier "bind the button to the quote" recommendation: during the debounce the two would disagree, and the button text would move while the cashier edits (BF-19). New Order gets the same treatment. The button carries no money, and the summary panel shows a total only if it is the real total (VAT, discounts and rounding included) from the shared calculator. Otherwise it is honestly labelled "Items subtotal" (P0-08(g) decides which). |
| D34 | **The loyalty writer is not a gate** for the calculator, the view or the live card. A loyalty migration can never hold them back. Refund and cancellation clawback is **confirmed** (owner delegated to Claude). |
| D35 | **No polishing of panels that will be deleted.** BF-12, BF-15, BF-17 and BF-18 are fixed in the new view, not in the old `order-financial/*` panels. One folder name: `order-fin-view`. |
| D36 | **Domain-agnostic statement primitives** (production review PR-01). The money-statement layout (group, row, line, subtotal, states, line cap) is built once as generic `src/ui` components with no order knowledge. `order-fin-view` maps order data onto them, so AR invoice statements, customer account statements or B2B statements can reuse them later without copying UI. |
| D25 | **One shared commercial calculator is mandatory** (owner: "this must be fixed"). It is extracted from Create and reused by Create, Edit Preview, Edit Apply and the live quote. There is no second calculator. Delivered as Phase 1B. |

Standing constraints from project memory and CLAUDE.md: tenant filter in every query, no silent money mutation, Cmx components only, `cmxMessage` for feedback, no maker-checker, migrations created and then **stop and wait**, remote DB MCP for read-only discovery, constants mirror DB values exactly, and a STATUS and docs refresh at every step.

---

## 3. What exists today (verified 2026-10-22)

| Layer | Artifact | Notes |
|---|---|---|
| Read model | `web-admin/lib/services/order-financial-summary.service.ts` → `getOrderFinancialSummary(tenantId, orderId)` | 8 parallel tenant-filtered queries: order snapshot, charges, taxes, payments, credit applications, refunds, discount lines, tax documents. Adjustments are read via raw SQL. Also builds `buildEffectiveOrderFinancialSnapshot`, voucher refs and the audit timeline. |
| Canonical math | `web-admin/lib/services/order-financial-aggregation.ts` | `computeOutstanding` (D005, the single outstanding formula), `computeOverpaidAmount` and the effective sums. |
| Effective snapshot | `web-admin/lib/utils/order-financial-effective-snapshot.ts` | Read fallback when the snapshot is stale. |
| View model | `web-admin/src/features/orders/model/order-financial-summary-view.ts` | `OrderFinancialSummaryViewModel`. |
| Mapper | `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts` | Pure mapper that also builds warnings. **Has bugs (§4).** |
| UI panels | `web-admin/src/features/orders/ui/order-financial/*` | Summary cards, value breakdown, settlement, receivable, tax-document panel, tax base buckets, payments and credits tables, warning banner, debug panel, lifecycle timeline, refund dialog. |
| Server action | `web-admin/app/actions/orders/get-order-financial.ts` | `getOrderFinancialAction(tenantId, orderId)` and `getOrderFinancialForReceiptAction(orderId)`. **Security issue (§4, BF-09).** |
| API | `GET /api/v1/orders/[id]/financial-summary` | Requires `orders:view_financial_breakdown`. Returns the raw read model. **Error handling issue (§4, BF-10).** |
| Permissions | `orders:read`, `orders:view_financial_breakdown` in `lib/constants/permissions/orders-perm.ts` | Till users may legitimately lack the breakdown permission (see the comment in `order-collect-payment-modal.tsx`). |
| Consumers | Order detail (`app/dashboard/orders/[id]/order-detail-client.tsx`) assembles the view model **inside the page**. The full page (`.../full/order-details-full-client.tsx` + `orders-financial-tab-rprt.tsx`) computes its own numbers from a legacy-shaped shim. Pickup, delivery, ready, collect-payment, workspace and public tracking each read raw `outstanding*` fields themselves. | Duplication causes drift (§4, BF-08 and BF-12). |

---

## 4. Known defects and gaps to fix first (Phase 1)

Severity: **H** = wrong money shown or a security issue · **M** = misleading or incomplete · **L** = hygiene.
"Verified" means read in code on 2026-10-22. "Suspected" means it needs a fixture to confirm in P1 before fixing.

| ID | Sev | Where | Defect | Status |
|---|---|---|---|---|
| BF-01 | H | mapper L43-60 | Delivery and express sum charge rows **including voided** ones (no `is_voided` filter), and ignore the snapshot's `deliveryChargeAmount` and `expressChargeAmount`. The service-charge fallback also includes voided rows. After a charge void, the breakdown no longer adds up to the total. | Verified |
| BF-02 | H | mapper L94 + warnings | `expectedOutstanding = total − paid − credits` duplicates the D005 formula **without refund reopens**. It can raise a false `OUTSTANDING_MISMATCH` warning. Must use `computeOutstanding`. | Verified |
| BF-03 | M | mapper L158 | Currency falls back to a hardcoded `'OMR'`. Violates B15 (no locale defaults). | Verified |
| BF-04 | M | mapper L287 | Hardcoded literal tolerance `0.001`. Must import `MONEY_COMPARISON_TOLERANCE` from `lib/constants/financial-tolerances.ts` (the ledger tolerance, deliberately 0.001). **Not** `varianceToleranceFor`, which is for counted cash only. | Verified |
| BF-05 | M | mapper L84, L101 | `roundingAmount` comes from a page-supplied order prop, and `payOnCollectionAmount` is recomputed. The snapshot already holds both and must be the single source. | Verified |
| BF-06 | M | mapper / view model | Snapshot facts are dropped from the business view (only the debug raw snapshot has them): pending, authorized and failed payments, real-payment refunded, stored-value restored, customer credit issued, change returned, voucher references. | Verified |
| BF-07 | H | `invoice-service.getInvoicesForOrder` + detail client L163 | The AR invoice lookup uses only `org_invoice_mst.order_id` and the UI takes `orderInvoices[0]`. Multi-order or consolidated invoices linked through `org_invoice_orders_dtl` (which has a per-order `outstanding_amount`), and second invoices, are invisible. | Verified (link table exists). Behaviour to be confirmed with data in P0. |
| BF-08 | M | full client L548 + `full/page.tsx` shim | The gift-card sum ignores `application_status`, so reversed or failed gift cards count. The full page renders from a legacy-shaped shim (`total`, `paid_amount`, `service_charge`, `promo_discount_amount`) rebuilt in `page.tsx`; those columns no longer exist on `org_orders_mst`. | Verified |
| BF-09 | H | `app/actions/orders/get-order-financial.ts` | A `'use server'` export accepts a **caller-supplied `tenantId`**. Neither export performs a permission check. A server action is a callable endpoint, so tenant and permission must come from the session. | Verified (code). Exploitability to be confirmed in P1. Fix regardless. |
| BF-10 | M | `api/v1/orders/[id]/financial-summary` | Not-found (`findFirstOrThrow`) returns **500** and echoes raw internal error text. Expected: 404, plus a generic message with the error logged server-side. | Verified |
| BF-11 | H | service L629-686, mapper L43-74 | **Zero-is-falsy fallbacks:** `snapshot.x \|\| recompute()`. A legitimate snapshot `0` (overpaid after change returned, a charge voided to 0, refunded 0) falls through to a gross recomputation that can resurrect values. The mapper's own comment warns about this for overpaid, but the service still does it. Must use `??` with explicit `usedReadFallback` semantics. The overpaid fallback `paid + credits − total` also ignores change returned and dispositions, so when a fallback is truly needed it must call `computeOverpaidAmount`. | Verified (service L629–686 uses `\|\|` for refunded, real-payment refunded, net collected and overpaid). Regression fixtures in P1. |
| BF-12 | M | `orders-financial-tab-rprt.tsx` vs the `order-financial/*` panels | Two parallel renderers of the same data, so they drift. Consolidated in P6. | Verified |
| BF-13 | L | detail client L200-225 | The view model carries only the newest tax document plus a legacy header fallback. The supersede chain (credit and debit notes) is not in the business view. | Verified |
| BF-14 | M | mapper `buildWarnings` vs `lib/services/reconciliation/*` | Display warnings are a separate rule set from the reconciliation checks, so they can drift. They must share one rule source. | To verify in P0 |
| BF-15 | M | consumers (pickup, delivery, ready, workspace, collect-payment) | Each surface reads `outstanding*` from different, possibly stale props. No shared header reader exists. | Verified (independent reads) |
| BF-17 | M | `order-financial-summary-cards.tsx` (payment status and type badges) | Raw DB codes are shown to users (`PAID`, `PAY_ON_COLLECTION` with `_` replaced by a space) instead of translated EN/AR labels. Breaks the bilingual rule (CRITICAL RULE #6). | Verified |
| BF-18 | M | summary cards + `order-financial-money-value.tsx` | Money is formatted with the **tenant** currency's decimal places even when the order uses a different currency (for example OMR 3 dp vs USD 2 dp). The money value also uses hardcoded Tailwind colors instead of theme tokens, and some states are shown by color alone. | Verified |
| BF-19 | M | `new-order-content.tsx` L200 (`summaryTotal = totals.subtotal + orderChargesTotal`) → `OrderSummaryPanel` "Total", shown on the Review button in both New Order and Order Edit | The number labelled **Total** is a client-side cart subtotal plus order charges. It **excludes VAT, discounts and rounding**. Example: an edit on a Saudi tenant shows "Total 48.80 SAR" = 23.00 + 15.30 + 10.50, with no 15% VAT. In Order Edit it also says nothing about what the customer already paid. Resolved by D33: the button carries no money; the live card (Order Edit) or a true engine total (New Order) is the only total. | Verified (code + owner screenshot 2026-10-23) |
| BF-16 | H (if confirmed) | `app/public/orders/[tenantId]/[orderNo]` → `GET /api/v1/public/orders/[tenantId]/[orderNo]` | When no tracking token exists, the page falls back to a lookup by tenant ID and order number, and order numbers can be guessed. If that endpoint returns money figures (it already renders `outstandingAmount`) without a second check, anyone can read another customer's order balance. The public financial view must **never** be served on this path unless P0 proves it is guarded. | To verify in P0 |

| BF-20 | H | `app/actions/**` (found 2026-10-23 while fixing BF-09) | The BF-09 defect class is systemic. These `'use server'` exports accept a caller-supplied tenant id with **no session check and no permission check**: `orders/get-order.ts` (`getOrder`, `getOrderByRef`, `getOrderForPrep`), `orders/add-order-items.ts`, `orders/list-orders.ts` (`listOrders`, `getStats`; reads auth but does not compare), `payments/invoice-actions.ts` (`createInvoiceAction`, `getInvoiceStatsAction`), `payments/validate-promo.ts`, `tenant/get-currency-config.ts`, `tenant/get-phone-country-code.ts`. `orders/delete-order.ts` is the correct pattern (session check + permission). The first-parameter scan may miss actions that take the tenant in a later parameter or an object, so a full sweep is part of the fix. | Verified (code). All callers are logged-in dashboard screens (checked 2026-10-23); none is public. **Proposed:** a dedicated package with a shared guard, one fix per action, tests, and a lint/test rule that fails on a `'use server'` export taking a tenant id.<br>**Guard rule:**<br>• staff session → session tenant; a passed tenant id must match or the call is rejected<br>• no session → rejected<br>**External callers** use API routes with proof for the tenant: mobile Bearer token verified for that tenant, opaque tracking token, or HQ service credential. Never a tenant id alone. **Fixed 2026-10-23**: see STATUS exec-2. |

| BF-21 | H | `app/api/v1/orders/[id]/state/route.ts:60-81` (`ORDER_ITEM_STATE_SELECT`) → `ready-order-types.ts:122` (found in combined Phase 0, PF-10) | The Ready-order page and its receipt and details prints show **0 for every line total**: the state route does not select `total_price` / `price_per_unit`, and the mapper defaults to 0. Affects `app/dashboard/ready/[id]/page.tsx:163`, `order-receipt-print.tsx:140`, `order-details-print.tsx:91`. | Verified (code) |
| BF-22 | M | `lib/services/customer-receipt-excess-executor.service.ts:68-136` (PF-16) | Overpayment allocation to another order writes `outstanding_amount` / `total_paid_amount` directly, with no snapshot recalculation and no `payment_status` update, so the snapshot drifts. Must call `recalculateOrderFinancialSnapshotTx`. | Verified (code) |

Every BF item gets a regression test that fails before the fix and passes after it.

> **Phase 0 outcome (2026-10-23):** see [PHASE0_FINDINGS.md](../Line_Level_Money_Snapshot/PHASE0_FINDINGS.md) and [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md).
> - **§6.4 correction:** the live Edit card uses a **sibling** route `POST /api/v1/orders/[id]/changes/quote` over the shared calculator, not a quote flag on the preview route, which is tied to the edit session, capability checks and the review proof (ADR-060 §9).
> - **Golden fixtures** G1/G2/E1 are synthetic: no charges, discounts, refunds, credits or tax documents exist in remote data.
> - **EC confirmations:** EC-01, EC-02, EC-03/04 and EC-08 are confirmed. The plan's EC-05 (ORDER-preference tax) is consistent with the code.

---

## 5. Data scope — the complete order financial picture

Rule: every number is **read**, never re-derived for display, except presentation-only grouping. Any derivation must call the canonical function (`computeOutstanding`, `computeOverpaidAmount`, the effective sums).

| Section key | Sources | Exists today? |
|---|---|---|
| `header` | `org_orders_mst` snapshot (totals, paid, credits, outstanding, overpaid, refunded, payment status, settlement type, snapshot status) | Yes |
| `items` | snapshot items base + piece and preference extras. Each extra line is `role: 'additive'` if it is added on top of the items base, or `'included'` if it already sits inside item `total_price` (P0-08(h) confirms which). The additive lines must sum to the section total. | Yes (inside today's value breakdown) |
| `charges` | snapshot charge fields + `org_order_charges_dtl` (delivery, express, service, other). Voided rows are shown and marked, with `countsInTotal: false`. | Yes (buggy, BF-01) |
| `discounts` | `org_order_discounts_dtl` (manual, rule, promo, promotion link, stacking group, voided) | Yes |
| `taxes` | `org_order_taxes_dtl` + snapshot tax-base buckets (taxable, non-taxable, exempt, zero-rated, out-of-scope) + tax pricing mode | Yes |
| `payments` | `org_order_payments_dtl` grouped by lifecycle (completed, pending, authorized, failed, reversed), method, gateway ref, voucher link | Yes |
| `credits` | `org_order_credit_apps_dtl` (wallet or stored value, gift card, loyalty redemption, credit note) with application status | Yes |
| `refunds` | `org_order_refunds_dtl` (source type, method, original payment or credit, reopens-due, processed vs pending) | Yes |
| `overpayment` | snapshot `overpaid_amount`, `change_returned_amount` + **`org_fin_overpay_disp_dtl`** (resolution code, amount, target ref, voucher) | **New** |
| `receivable` | **`org_invoice_orders_dtl`** + `org_invoice_mst` (all linked invoices, per-order invoiced and outstanding amounts) + `org_invoice_payments_dtl` / `org_ar_credit_allocs_dtl` (allocations, reversals). **AR invoices only.** Pay on collection is not a receivable: it is the order balance, worded "Due at collection" (D31). | **New** (partial today, BF-07) |
| `taxDocuments` | `org_tax_documents_mst`, full supersede chain | Partial (BF-13) |
| `vouchers` | **`org_fin_vouchers_mst`** for the order plus vouchers referenced by payments, refunds and credits (number, type, subtype, status, posting status, amount, reversal link) | **New** (IDs only today) |
| `loyalty` | **`org_loyalty_txn_dtl`** by `order_id` (earned, redeemed, reversed points, before and after balance, credit-app link) | **New** |
| `adjustments` | `org_order_adjustments_dtl` | Yes |
| `orderChanges` | **`org_order_changes_mst`** (`financial_before`, `financial_after`, `commercial_delta`, `financial_outcome`, actor, time) | **New** |
| `currency` | snapshot base-currency fields and exchange rate | Yes |
| `receipts` | **`org_rcpt_receipts_mst`** (receipt type, channel, delivery status, voucher link). Optional and low priority. | **New** |
| `timeline` | Unified, time-ordered events from all sections above. Built only when every event source for the preset was loaded; otherwise it is labelled **partial**. `audit` is the preset that promises the full history. | Partial |
| `reconciliation` | Snapshot status, engine version, mismatch count, warnings (shared rule source, BF-14) | Partial |
| `debug` | Raw snapshot, calculation hash, trace ID | Yes |

---

## 6. Display configuration contract (owner D2)

The types live in `web-admin/src/features/orders/order-fin-view/model/`. Section keys and preset names are UI configuration, not DB values. Any **DB-backed code** shown (statuses, types) uses the exact DB string (CRITICAL RULE #12).

```ts
type OrderFinSectionKey =
  | 'items' | 'charges' | 'discounts' | 'taxes'                    // group: value
  | 'payments' | 'credits' | 'refunds' | 'overpayment' | 'receivable' // group: settlement
  | 'taxDocuments' | 'vouchers' | 'loyalty' | 'adjustments'
  | 'orderChanges' | 'currency' | 'receipts' | 'timeline'           // group: records
  | 'reconciliation' | 'debug';                                     // group: control

type OrderFinGroupKey = 'value' | 'settlement' | 'records' | 'control';

/** How one section renders. */
type OrderFinSectionMode =
  | 'hidden'      // not rendered, and its data is not fetched
  | 'total'       // one total line only, no details
  | 'expandable'  // total line + toggle, collapsed by default
  | 'expanded'    // total line + toggle, open by default
  | 'detail';     // details always visible, no toggle

/** One meaning each (D31, §6.6). No 'collected', no 'payOnCollection'. */
type OrderFinHeaderMetric =
  | 'total' | 'paid' | 'credits' | 'balance' | 'refunded'
  | 'netCollected' | 'overpaid' | 'changeReturned' | 'receivable'
  | 'discount' | 'tax'
  | 'originalTotal' | 'projectedTotal' | 'totalDelta' | 'projectedBalance'; // edit source only

type OrderFinPreset = 'badge' | 'totals' | 'summary' | 'detailed' | 'full' | 'audit' | 'public';

/** Where the figures come from. One component, three sources, one view-model shape. */
type OrderFinSource =
  | { kind: 'order'; orderId: string }              // saved order: fetched via hook (tenant from session)
  | { kind: 'data'; view: OrderFinancialView }      // pre-fetched on a server page, or the public projection
  | { kind: 'draft'; draft: OrderFinDraftInput }    // unsaved order (payment-modal-v4): engine outputs, no fetch
  | { kind: 'edit'; orderId: string; quote: OrderFinEditQuoteState }; // saved order + pending edit (§6.4)

interface OrderFinHeaderConfig {
  visible?: boolean;                       // default true
  metrics?: OrderFinHeaderMetric[];        // order = render order
  emphasize?: OrderFinHeaderMetric;        // the hero number, e.g. 'balance'
  layout?: 'cards' | 'inline' | 'compact' | 'badge';
  showPaymentStatus?: boolean;
  showSettlementType?: boolean;
  showReconciliationBadge?: boolean;
  showBaseCurrency?: boolean;
  hideZeroMetrics?: boolean;               // never hides 'total' or 'balance'
}

interface OrderFinancialDisplayConfig {
  preset?: OrderFinPreset;                 // default 'summary'
  header?: OrderFinHeaderConfig;           // merged over the preset
  sections?: Partial<Record<OrderFinSectionKey, OrderFinSectionMode>>; // merged over the preset
  sectionOrder?: OrderFinSectionKey[];
  groupOrder?: OrderFinGroupKey[];
  lineCap?: number;                        // default 8; 'audit' and layout 'print' show all lines
  /** Reserved (D17), not built now: a heavy section may later switch to a table. */
  detailRenderer?: Partial<Record<OrderFinSectionKey, 'lines' | 'table'>>;
  layout?: 'card' | 'plain' | 'sheet' | 'print';
  columns?: 1 | 2 | 'auto';
  density?: 'comfortable' | 'compact';
  showEmptySections?: boolean;             // default false
  showWarnings?: boolean;                  // default true
  forbiddenSectionBehavior?: 'hide' | 'lockNote'; // default 'hide'
  /** In-view preset switch (D9), e.g. ['detailed', 'full']. Remembered per viewer and
   *  per route in localStorage (wrapped in try/catch). A `?fin=` URL param wins over storage. */
  presetSwitcher?: OrderFinPreset[];
}
```

**Preset matrix** (each cell can be overridden per section):

| Section | badge | totals | summary | detailed | full | audit |
|---|---|---|---|---|---|---|
| header metrics (hero = balance; at most 3 beside it) | balance | total, paid | total, paid, credits | total, paid, credits | same as detailed (D31: the header stays short) | same as detailed |
| items / charges | hidden | total | expandable | expanded | detail | detail |
| discounts / taxes | hidden | total | expandable | expandable | detail | detail |
| payments / credits / refunds | hidden | total | expandable | expanded | detail | detail |
| overpayment / receivable | hidden | hidden | total if non-zero | expandable | detail | detail |
| taxDocuments / vouchers / loyalty | hidden | hidden | hidden | expandable | detail | detail |
| adjustments / orderChanges / currency | hidden | hidden | hidden | expandable | detail | detail |
| receipts | hidden | hidden | hidden | hidden | expandable | detail |
| timeline | hidden | hidden | hidden | hidden | expandable | detail |
| reconciliation | hidden | hidden | badge only | badge only | expandable | detail |
| debug | hidden | hidden | hidden | hidden | hidden | expandable |

The `public` preset is defined in §6.2, because its data is a server-side projection rather than a display choice.

Resolution is a pure, unit-tested function: `resolveOrderFinDisplayConfig(config, sourceKind) → ResolvedConfig`. It also produces the **required data sources** (`hidden` sections are never fetched). Source constraints win over the preset and any caller override: for `draft`, the sections listed in §6.3 are always `hidden`; for the `public` preset, §6.2 applies. The resolver does no permission logic (D10).

### 6.1 Access model (D10)

- **Component and service: no permission logic.** `OrderFinancialView`, the config resolver, the section builders and `getOrderFinancialView` never check permissions. Whoever renders or calls them decides first (for example, a host page shows the view only if the user may see it, and a till screen passes `preset="totals"`).
- **Entry points (the only security boundary that stays):**
  - Staff API and server action: authenticated session; **tenant from the session only, never from input**; baseline `orders:read`, the permission to view an order at all (D6).
  - Public endpoints: valid tracking token, or an authenticated customer-portal session for that customer's own order. The public projection is **always** applied, whatever config is requested.
- **Known trade-off, accepted by the owner:** a staff user with `orders:read` can request breakdown sections through the API even if a screen hides them. `orders:view_financial_breakdown` keeps guarding the existing `financial-summary` route, unchanged. Section-level permission tiers can be added later in the entry points without changing the component.
- `forbiddenSectionBehavior` is kept in the contract (default `'hide'`), so that later change needs no UI rework.

### 6.2 Public-safe view (D7)

**Same domain, nothing forked:** the same `OrderFinancialView` component, the same mapper, the same section renderers and the same config contract. Only two things are public-specific:

1. **A server-side public projection** `projectOrderFinancialViewForPublic(view)`. It is an **allowlist** (new fields are hidden until someone explicitly adds them), and it is unit-tested against a snapshot of the allowed field list.
   - **Allowed:** order number, currency, items-base total, charges total, discount total, tax total, grand total, paid total, credits total, balance due, refunded total, payment status (customer-facing label), and **per-tender totals grouped by method label, bilingual, with no references (D11)**.
   - **Never allowed:** gateway or payment references, voucher and invoice IDs, staff names or IDs, internal statuses, warnings, reconciliation, debug, hashes, trace IDs, exchange-rate internals, loyalty internals, customer IDs.
2. **A `public` preset:** header (total, paid, balance), plus `items`, `charges`, `discounts`, `taxes`, `credits` and `refunds` as `total`, and `payments` as `expandable` (tender totals by method, D11). All other sections are forced to `hidden`, and the caller cannot override this.
3. **The browser preset is not the boundary.** The public route **always** projects on the server, even if the client asks for more. A new view-model field fails the allowlist snapshot test until it is explicitly classified public or private.

**Access:** served only through the tracking-token path (`/track/[token]` → `GET /api/v1/public/track/[token]/financial-view`), and only after the same token validation the existing track route uses. The `tenantId/orderNo` fallback path gets **no** financial view until BF-16 is resolved in P0. The **customer portal** (`/api/v1/public/customer/orders`) reuses the same projection and the `public` preset, scoped to the logged-in customer's own orders (D13, P4-07, P6-12).

### 6.3 Draft source: payment-modal-v4 (D8)

payment-modal-v4 is used only in the new-order flow (`new-order-modals.tsx`), so **the order does not exist yet** and there is no `orderId` to fetch. The button therefore opens the view with `source = { kind: 'draft', draft }`:

- `OrderFinDraftInput` is built from figures **the modal and its engine have already computed**: items, extras, charges, discount lines, tax lines, total, planned tenders, credits, change due and balance. **The draft adapter does no arithmetic of its own.** This avoids a second source of truth for unsaved money.
- `mapDraftToSourceSet(draft)` turns the engine outputs into the **same normalized section input** the saved-order sources produce. Then the same builders run (DESIGN §1). Builders never accept raw `org_order_*` rows or fake rows shaped like them. Sections with no meaning before submission are always `hidden`, whatever preset or override the caller passes: refunds, overpayment, receivable, vouchers, tax documents, loyalty, order changes, adjustments, receipts, timeline, reconciliation and debug.
- The view shows a clear **"Preview — not yet saved"** badge (EN/AR).
- It is read-only. It opens from an **additional** button in the modal (a CmxDialog or side sheet) and closes back to the modal **without changing any modal state or entered amounts** (CRITICAL RULE #15).
- If payment-modal-v4 is later used for a saved order (for example Order Edit V2 settlement), the same button switches to `source = { kind: 'order' }`, with no new code.

### 6.4 Edit source: Order Edit live card (D20)

**What the user sees:** under the Review button, a compact card (or a badge) that changes as items are added or removed. It shows: was → now total, the difference, already paid, the balance after the change, and what will happen (collect more, settled, refund or credit due).

**Where the numbers come from (verified 2026-10-23):**
- **Saved side** (paid, credits, current total): already loaded. `getOrderChangeContext` calls `getOrderFinancialSummary` and exposes `context.financial` to the edit workspace. No extra fetch.
- **Projected side** (new total, new tax, outcome): the existing **Order Edit preview** endpoint `POST /api/v1/orders/[id]/changes/preview`. It runs the same calculation the apply step uses (`order-change-calculation.service` + `projectOrderChangeFinancialResult`) and returns `originalTotal`, `projectedTotal`, `projectedTax` and `financial` = `{ outcome: SETTLED | OUTSTANDING | OVERPAYMENT | DENIED, outstandingAmount, overpaidAmount, unresolvedOverpayment, effectivePayments, effectiveCredits, … }`. The route writes nothing; it reads context and facts and calculates.
- Today the preview runs **only when Review is clicked**. The live card needs it to run as the cart changes.

**How it updates live (no client money math):**
1. A hook, `useOrderEditFinancialQuote(controller, orderId)`, watches the edit draft (the same operations `controller.buildOperations()` produces).
2. If the operation set changes no commercial money (notes, dates, header-only), it **does not call the server**: the card shows the saved total immediately (EC-08). Otherwise, after each change it waits **500 ms** (debounce), cancels any request still running (AbortController), and calls the preview endpoint in **quote mode**.
3. While a request is in flight, the card keeps showing the **last confirmed figures**, slightly dimmed, with an "Updating…" chip. It **never** shows a client-side estimate as the total.
4. If the quote fails or is denied, the card shows that state ("Can't calculate this change" plus the reason) and the Review flow handles it as today.
5. With no changes, the card shows the saved order (`kind: 'order'` figures) and no difference.

**Quote mode** (`?mode=quote`, or a sibling route `.../changes/quote`, decided in P0): the same calculation and financial classification, but it skips the review binding, proof key and audit facts, so it is cheap enough to call often. P0 measures the full preview's cost first; if it's already cheap, quote mode is just a flag that trims the response.

**Rendering:** the same `OrderFinancialView`, with the `edit` source and a compact preset:
- `badge`: a pill such as "New total SAR 56.12 (+6.80)".
- `totals` + `layout="sheet"` + `density="compact"`: the card under the Review button.
- "Details" link: opens the same view in a side sheet at `detailed`, with the projected value side, the saved settlement side and every discount change line by line (`previousAmount` → `amount`).
- **The Review button carries no money** (D33). The card is the only total on the screen. Card figures must equal the Review dialog's figures for the same operations.

New header metrics, available only with the `edit` source: `originalTotal`, `projectedTotal`, `totalDelta`, `projectedBalance`, plus an **outcome chip** mapped from `OrderChangeFinancialOutcome` codes **exactly as the service emits them** (CRITICAL RULE #12), translated in EN/AR.

**Must not:** recalculate in the browser, change any entered amount (CRITICAL RULE #15), or block editing while a quote is pending.

### 6.5 Dependency: Order Edit calculation parity (verified 2026-10-23)

The view never calculates; it shows whatever the Order Edit engine returns. **Today that engine does not account for several things already recorded on the order**, so the live card would faithfully show a wrong number. Fixing the engine is a **prerequisite** for P6-13, and the owner made it mandatory (D25). It is delivered here as **Phase 1B** and completes Order Edit V2 WP08 (whose own plan says "re-evaluate promos without double redemption … Preview = Apply = snapshot; no double tax/extra/discount" and "REUSE … not a second calculator").

**Findings (read in code):**

| ID | Sev | Where | What happens today |
|---|---|---|---|
| EC-01 | H | `order-change-preview.service.ts` L399–415 calls `calculateOrderChangeTotals` with **no discount or promotion input** | Recorded discounts (manual, automatic rule, promo code, auto-apply promo) are left out of the projected total, so it is **too high** by the discount. At Apply, `assertCommercialSnapshot` (`order-change-commercial-write.ts` L479) recomputes the snapshot, which **does** subtract the discount rows, so a money-changing edit on a discounted order is expected to fail with `FINANCIAL_SNAPSHOT_MISMATCH`. No test covers a discounted order. |
| EC-02 | H | same call, **no `charges` input** | Delivery, service and other order charges are left out, so the projected total is **too low**. Same Apply mismatch. |
| EC-03 | H | `order-change-calculation.service.ts` L189–216 vs `order-calculation.service.ts` L304–352 | Edit taxes items + extras + express **before** discounts; Create taxes **after** discounts. Apply then writes Edit's tax into `org_order_taxes_dtl` (`syncReviewedTaxLine`) and sets `taxable_amount = SUM(items)`, which overstates VAT on discounted orders. |
| EC-04 | M | `order-change-preview-reads.ts` L258 | Edit uses **today's** tenant VAT rate (`TaxService.getTaxRate`). Create uses **tax profiles** first (`calculateTax`, including CUSTOM taxes), then that fallback. Profiles and CUSTOM taxes are ignored, and a rate change since the order was created re-taxes untouched items. |
| EC-05 | M | calculation header comment vs `order-calculation.service.ts` L65–67 | ORDER-level preference extras are non-taxable in Edit but in the tax base at Create (per the Create comment; confirm in P0). |
| EC-06 | L | Create applies the currency cash-rounding rule (`rounding_adjustment_amount`); Edit does not recompute it | Drift once a rounding rule is active (no-op for currently seeded currencies). |
| EC-07 | M | Create prices with `basePrice`; Edit new lines use the quote `finalPrice` (price-list discount %) | The same product added at Create vs during Edit can get different prices. Documented in the Edit V2 plan (L901) as a known gap. |
| EC-08 | M | Preview runs the partial calculation even for header-only edits | The Review dialog can show a "projected total" that differs from the current total when no money changed. Confirm in P0. |

**What is already right:** gift cards, loyalty redemptions and wallet or stored-value use are **credit applications** (settlement, not discounts). The Edit financial result counts them as already applied (`effectiveCredits`) and never shrinks or re-prices them. Payments are immutable. Refund reopens are in the D005 outstanding formula. Unchanged lines keep their stored unit price, and a promotion is never redeemed twice (`alreadyRedeemedOnOrder`).

**Target rule ("re-price the commercial side, keep the settlement side"):** one pure commercial calculator, extracted from Create and used by Create, Edit Preview, Edit Apply and the quote, fed with the order's **recorded** instructions. Owner-approved 2026-10-23 (D21–D25):

| Component | Rule in Edit (approved) |
|---|---|
| Unchanged lines | Keep the stored unit price (as today). |
| New or changed lines | Same pricing as Create, with the price-list discount applied in both (D23). |
| Charges (delivery, service, other) | Carry the active (non-voided) rows; flat and non-taxable (B18), as in Create. |
| Manual discount | Percent: re-apply the recorded `discount_rate` to the new base, capped. Fixed amount: keep the amount, capped at the new base. |
| Automatic discount rule | Re-apply **the same recorded rule** (`source_id`) on the new base, not "best rule today". If it no longer qualifies: remove it, with a Review warning that must be acknowledged. |
| Promo code or auto-promo | Never redeem again. Percent: re-apply with its cap; fixed: keep, capped. If it no longer qualifies (for example minimum order): remove it with an acknowledged warning, and reverse usage at Apply (`reversePromoUsageTx`). |
| Stacking order | Identical to Create: manual → automatic rule → promo (honor `can_stack_with_promo`). |
| Tax | Base = after discounts (as Create); same profile and CUSTOM logic as Create; **the rate recorded on the order** (D22). |
| Cash rounding | Re-apply the currency rule to the new total. |
| Header-only edit (notes, dates) | No re-pricing: projected total = current total (EC-08). |
| Gift card, loyalty redemption, wallet | Settlement, unchanged. A lower total produces `OVERPAYMENT`, which goes to the existing overpayment or refund follow-up. Never auto-reverse a gift card. |
| Loyalty points earned | Adjusted at Apply by one idempotent delta, only if the order already earned (D24). |
| Issued tax document | A total change after issue goes through the credit or debit note path (B14 / `fiscalObligation`). |

Every automatic change to a recorded discount appears **line by line** in the Review dialog and in the card's Details ("Promo SPRING10: −0.500 → −0.700", "Rule 'Weekday 10%' removed: minimum not met"). That is CRITICAL RULE #15 (no silent money mutation).

**Owner decisions:** resolved 2026-10-23 as D21–D25 (§2). The `existingDiscountPolicy` slot already in the Edit context carries D21.

**Item price confirmation (D26).** Today Create already recalculates on the server and rejects a total-level difference with `AMOUNT_MISMATCH` (`order-submit-orchestrator.service.ts` L291–340; dialog in `use-order-submission.ts` L579). The gap is that the cashier only sees "totals differ", not which item changed or why. Target:

| Step | Rule |
|---|---|
| Cart display | Prices shown in the cart come from the **same price resolver** the calculator uses (P1B-07), so a difference happens only when something really changed between quote and submit (price list edited, a price-list discount expired). |
| Submit | Each line sends `confirmedUnitPrice` (what the cashier saw). The server never trusts it; it only compares. |
| Server check | Resolved price ≠ confirmed price (currency tolerance, B15) and no authorized override → reject `PRICE_CHANGED` with per line: product, shown price, current price, reason code. **Nothing is persisted.** |
| Cashier | The existing mismatch dialog gains the per-line list. "Use current prices" refreshes the cart and totals, and the cashier must press Submit again. There is **never an automatic resubmit** (rule #15). "Back" keeps the cart as it was. |
| Price override | An explicit `priceOverride` (permission-gated, as today) is honored as entered and audited. It is never a mismatch. |
| Order Edit | Added lines carry `confirmedUnitPrice` too. A price change after Preview makes the preview proof stale (existing fingerprint), and Review shows the same per-line list. |
| Final guard | The total-level `AMOUNT_MISMATCH` check stays as the last safety net. |
| Channels | Required on the web-admin submit. Other API clients without it keep the totals guard only. |

**Loyalty reconciliation (D27, closes LE-01).** Today points are queued only inside `settleOrderTx` at checkout when the order is fully paid there (`order-settlement.service.ts` L266). An order paid later through `collectPaymentTx` never earns. Target: one call, `reconcileOrderLoyaltyEarn` (name fixed in the ADR), replacing the direct `queueEarnPoints` call:

| Rule | Detail |
|---|---|
| Callers | Checkout settlement, later payment collection, Order Edit Apply (D24), refund, cancellation, and any other settle path the P0-08 inventory finds (for example AR allocation). |
| Eligibility | The order has a customer, the tenant has an active loyalty program, and the order is fully settled (outstanding ≤ 0, D005 formula). |
| Target points | `floor(earn base × rate)`. The earn base stays what it is today (order grand total); changing the base is out of scope. The first earn uses the current program rate (as today). Later deltas use the rate recorded at the first earn. |
| Delta | Target minus the points already earned for this order (earn plus adjustment rows). It posts an earn or a reversal, or nothing when the delta is 0. |
| Concurrency and idempotency | Computed inside the outbox consumer in one transaction, serialized per order, with idempotency key `<trigger>-<source id>`. A redelivery or double click never double-credits. |
| Refund and cancellation | A clawback lowers the points (confirmed, D34). The balance never goes below zero; any part that can't be reversed is recorded on the adjustment row for audit. |
| Backfill | None: pre-launch, demo data only (project memory). |

**BF-19 follow-through (D33):** the Review button shows no money. In Order Edit the live card is the only total. In New Order the summary panel shows the real engine total, or the honest label "Items subtotal" (P0-08(g)).

### 6.6 View contract: lines, units and header metrics (D30, D31)

```ts
type OrderFinSourceKind = 'saved' | 'draft' | 'edit';   // on the view (replaces isDraft)

interface OrderFinLine {
  id: string;
  labelKey?: string;                                     // i18n key for fixed words
  label?: { name: string | null; name2: string | null }; // catalog names as stored
  unit: 'money' | 'points';
  amount: number | null;
  previousAmount?: number | null;                        // edit source only: "−0.500 → −0.700"
  sign: 'plus' | 'minus' | 'neutral';
  role: 'additive' | 'included' | 'informational';
  state: 'normal' | 'pending' | 'failed' | 'voided' | 'reversed';
  countsInTotal: boolean;                                // false: shown, never summed
  meta?: { dateIso?: string; methodCode?: string; ref?: string; statusCode?: string };
}
```

| Rule | Meaning |
|---|---|
| `unit: 'points'` | Loyalty earn and reversal lines. Never summed with money; never passed to the currency formatter. A loyalty **redemption** that became a credit application stays in Credits as money. |
| `role: 'included'` | Already inside another amount (for example extras inside item prices). The UI prints "included" and does not add it again. |
| `role: 'informational'` | Tax-document totals, voucher face amounts, base-currency equivalents and order-change deltas. Shown in the line text ("document total 11.550", "was 10.550 → now 11.550"), **never in the amount column**. |
| `countsInTotal: false` | Voided, pending, failed and reversed lines. Visible, struck or chipped, never summed. |
| Consistency check | In the builder tests and in the warnings: additive money lines with `countsInTotal` must equal the snapshot's section total. The UI never sums. |
| Order-change rows | History only. They never render a second current total. |

| Header metric | One meaning |
|---|---|
| `total` | Snapshot grand total |
| `paid` | Completed real payments |
| `credits` | Applied credit applications only |
| `netCollected` | Real payments minus real-payment refunds |
| `refunded` | Snapshot refunded total |
| `balance` | Snapshot outstanding (D005). The hero carries a word: **Due**, **Due at collection** (pay on collection), **Due on invoice** (AR invoice), **Settled** or **Overpaid**. |
| `overpaid` / `changeReturned` | Snapshot values as stored |
| `receivable` | This order's outstanding on its AR invoice(s). Opt-in only, never in a default preset, because it normally equals `balance`. A difference is a reconciliation warning, not a second balance. |
| `discount` / `tax` | Available for callers; not in default presets (they live in the statement) |
| `originalTotal` / `projectedTotal` / `totalDelta` / `projectedBalance` | Edit source only, from the quote's financial result |

**Unknown currency** is a state ("Currency unknown"), never a default. **Labels:** the server returns i18n keys and `name`/`name2`, never translated sentences; status codes pass through as stored.

---

## 7. Target architecture

The pipeline and folders are detailed in [DESIGN.md](DESIGN.md) §1. One folder name everywhere: `order-fin-view` (D35).

```
DB (snapshot + fact tables, tenant-filtered)
  └─ web-admin/lib/services/order-fin-view/            (server-only)
       ├─ sources/registry.ts + sources/*.source.ts   one source per table group; core snapshot always first;
       │                                               every query (and join) has an explicit tenant_org_id filter
       ├─ order-fin-view.service.ts       getOrderFinancialView(tenantId, orderId, resolved)
       ├─ order-fin-headers.service.ts    getOrderFinancialHeaders(tenantId, orderIds[])  (batch ≤ 100, snapshot only)
       ├─ projections/public.projection.ts projectOrderFinancialViewForPublic (allowlist, D7)
       └─ reuses: buildEffectiveOrderFinancialSnapshot (inside the core source only),
                  order-financial-aggregation (computeOutstanding, computeOverpaidAmount),
                  reconciliation order checks (shared warning rules, BF-14)
  └─ getOrderFinancialSummary (existing)  becomes a thin compatibility wrapper over the sources (D18)
  └─ web-admin/src/features/orders/order-fin-view/     (isomorphic + UI)
       ├─ model/   view, line, section and config types (§6, §6.6)
       ├─ config/  presets, resolveOrderFinDisplayConfig, section → source map
       ├─ build/   one pure builder per section, header, timeline, assemble
       ├─ draft/   mapDraftToSourceSet (payment-modal-v4, no arithmetic)
       ├─ edit/    mapEditQuoteToSourceSet (saved context + quote, no arithmetic)
       ├─ hooks/   useOrderFinancialView, useOrderEditFinancialQuote, invalidateOrderFinancial
       └─ ui/      OrderFinancialView, header, section shell (5 modes), section renderers, print layout
  └─ Shared commercial calculator (Phase 1B, D25)   pure; location fixed in the ADR (P0-06)
  └─ Entry points (authenticated; tenant from the session only; orders:read; no section tiers, D10):
       ├─ GET  /api/v1/orders/[id]/financial-view?preset=&sections=        (new)
       ├─ POST /api/v1/orders/financial-headers  {orderIds}                (new, Release 2)
       ├─ server action getOrderFinancialViewAction(orderId, config)       (new)
       ├─ POST /api/v1/orders/[id]/changes/preview?mode=quote              (Order Edit quote, orders:edit, P4-08)
       ├─ GET  /api/v1/public/track/[token]/financial-view                 (new, public projection, D7)
       ├─ customer portal financial view                                   (public projection, own orders, D13)
       └─ GET  /api/v1/orders/[id]/financial-summary                       (kept, contract unchanged, BF-10 fixed)
```

Principles:
- **Thin routes, logic in services** (Hard Truth #1 and #3). Sources are independent, so each new source is one file plus one registry line.
- **One builder path, one formula.** Saved, draft and edit data all become the same normalized section input before the builders run. No UI component, builder or adapter does money arithmetic. Components format and lay out only.
- **Failure isolation.** If a non-header source fails, only that section shows an error. The header depends only on the snapshot. A stale or `RECALCULATION_REQUIRED` snapshot shows a banner and never shows silently wrong numbers.
- **Server or client.** Server pages can pass pre-fetched `data`. Client surfaces pass `orderId`, and the hook fetches with an include set derived from the config.

---

## 8. Phases and tasks

Every phase ends with three tasks: **(S)** update [STATUS.md](STATUS.md), **(D)** refresh the affected docs, **(Q)** add owner-runnable scenarios to the QA guide. Phase ends also invoke the `/documentation` skill. Required skills are loaded **before** writing (CLAUDE.md hard stop).

### Phase 0 — Discovery and decision freeze (no code)

| ID | Task |
|---|---|
| P0-01 | Remote DB MCP (read-only): confirm columns, FK paths and indexes for every §5 source. Especially `org_invoice_orders_dtl`, `org_fin_overpay_disp_dtl`, `org_loyalty_txn_dtl`, `org_fin_vouchers_mst`, `org_order_changes_mst`, and `org_rcpt_receipts_mst`. |
| P0-02 | Sample real data shapes: orders with multi-order invoices, a voided charge, a refund that reopens the balance, an overpayment disposition, loyalty redemption, an order change with a delta. These become the **golden fixtures**, and the mockup uses the same figures. Two must exist: **(G1)** partially paid, pay on collection: one balance, no receivable, no overpaid, no change returned, child lines that add up, and one voided charge that is visible but excluded; **(G2)** credit invoice: an order balance and an invoice outstanding that are different numbers, one pending payment (not counted), one applied credit and one reversed credit (not counted). Plus one edit sample **(E1)**: was → now, a re-rated discount with previous and new amount, and the exact `OrderChangeFinancialOutcome` code. |
| P0-03 | Inventory every UI surface that shows order money. Search `outstanding`, `total_paid`, `paid_amount` and the `financial` panels across `src/features` and `app/`. Classify each as migrate, keep (engine-owned) or out of scope (for example public tracking). |
| P0-04 | Compare mapper warnings with `lib/services/reconciliation/order-*-checks.ts` and decide the shared rule source (BF-14). |
| P0-05 | Public routes: read `GET /api/v1/public/track/[token]` (token validation, expiry, rate limiting) and `GET /api/v1/public/orders/[tenantId]/[orderNo]` (the guessable fallback). Confirm or close BF-16. Freeze the public allowlist (§6.2). |
| P0-07 | payment-modal-v4: list the engine outputs available for `OrderFinDraftInput` (§6.3), confirm the modal is only reachable pre-submit, and choose the button placement. Settles D8's shape. |
| P0-08 | **Calculation parity discovery (Phase 1B input):** (a) confirm EC-05 and EC-08; (b) for D22, find where the order's tax context is recorded (`org_order_taxes_dtl` rate, profile, CUSTOM rows) and count orders with no recorded tax rows (remote MCP, read-only); (c) for D23, check what price the New Order cart **shows** versus what Create **charges** for an item with a price-list discount, to know which side is wrong; (d) for D24 and D27, check the loyalty ledger's transaction types for an adjustment or reversal type (constants mirror DB), whether the earn row keeps the rate used, and how a reversal behaves against already-redeemed points; (e) list **every** path that can make an order fully settled (checkout, `collectPaymentTx`, AR allocation, credit application, edit, refund reopen, cancel) for D27; (f) for D26, confirm the price-override permission and audit fields, and how the New Order cart gets its prices today; (g) for D33, whether the New Order summary panel can show the real engine total (VAT, discounts, rounding) before the payment modal opens, or must be labelled "Items subtotal"; (h) for D30, whether piece and preference extras sit inside item `total_price` (`role: 'included'`) or on top of it (`'additive'`). Also measure the current Order Edit preview cost, which decides quote mode as a flag or a sibling route (P4-08). |
| P0-09 | **Coordinate with Extend Order Edit Policy** (Order_Edit_V2, PR-03): read its STATUS, list the files both programs change (Preview, Apply writer, review screen, context), agree the order of work and one owner per file, and record it in both STATUS files. Phase 1B does not start until this is agreed. |
| P0-06 | Write ADR `ADR_Reusable_Order_Financial_View.md` (read-only scope except Phase 1B, the pipeline and normalized section input, the line contract §6.6, the config contract, the public allowlist, the access model D10 with no tiers, the shared commercial calculator's location and name, and `reconcileOrderLoyaltyEarn`). (S)(D) |

### Phase 1 — Fix existing bugs (the stack must be correct before reuse)

Skills: `/backend`, `/multitenancy`, `/frontend`, `/testing`.

| ID | Task |
|---|---|
| P1-01 | Write failing regression fixtures for BF-01, 02, 05, 08 and 11 using the P0-02 data shapes. |
| P1-02 | BF-11: replace every `snapshot.x \|\| fallback` with `??`, gated on `usedReadFallback`, in the service and mapper. |
| P1-03 | BF-01: use the snapshot charge fields first. Row fallbacks exclude voided rows. Voided rows stay visible as voided. |
| P1-04 | BF-02: compute `expectedOutstanding` through `computeOutstanding` with refund reopens. Add an equality test against the aggregation module. |
| P1-05 | BF-03 and BF-04: remove the currency default (show an explicit "currency unknown" state). Replace the literal with `MONEY_COMPARISON_TOLERANCE` from `financial-tolerances.ts`. Never `varianceToleranceFor`, which is for counted cash. |
| P1-06 | BF-05 and BF-06: read rounding and pay-on-collection from the snapshot. Add the dropped facts to the view model (additive and backward compatible). |
| P1-07 | BF-07: add a service `getOrderArInvoices(tenantId, orderId)` that unions `org_invoice_orders_dtl` links with the legacy `order_id`, de-duplicated, and returns the per-order outstanding. The detail page shows all of them. |
| P1-08 | BF-08: count only `APPLIED` gift cards in the shared read path. The full page's own arithmetic is **deleted** when that page moves to the new view (P6-02), not fixed twice (D35). |
| P1-09 | BF-09: make the read a server-only function. Pages call the service directly. Any client-callable action resolves the tenant from the session and requires `orders:read` only (D10). Confirm whether `getOrderFinancialForReceiptAction` has any caller, then gate it or remove it. |
| P1-10 | BF-10: the route returns 404 for not-found and a generic message on 500, with the error logged server-side. |
| P1-11 | BF-13: carry the full tax-document chain in the view model (additive). |
| P1-14 | BF-12, BF-15, BF-17 and BF-18 are **not** patched in the old panels (D35). They are closed by the new view: BF-17 in P5-03 (translated badges), BF-18 in P5-12 (money text with order-currency decimals and theme tokens), BF-12 in P6-02 and BF-15 in P6-04. Their regression tests are written against the new view. |
| P1-13 | BF-16, if confirmed in P0: guard the public `tenantId/orderNo` fallback (require a token or a second factor, or strip money from its response) with a regression test. |
| P1-12 | Gates: `npx eslint . --quiet`, `tsc`, targeted jest, `npm run build`, `npm run check:i18n`. (S)(D)(Q) |

### Phase 1B — One shared commercial calculator and Order Edit parity (EC-01 … EC-08, owner D21–D25)

Skills: `/backend`, `/multitenancy`, `/business-logic`, `/testing`; `/frontend` and `/i18n` for P1B-11; `/database` only if P0-08 shows a migration is needed (then stop and wait).

**Depends on:** [Line_Level_Money_Snapshot/PLAN.md](../Line_Level_Money_Snapshot/PLAN.md) (owner, 2026-10-23). That plan owns P1B-01 (its P1-01) and the calculator extraction P1B-03 (its Phase 4, extended to line-level money for items and pieces), and writes line money on Create and Edit (its Phases 5–6). P1B-04…P1B-12 build on that calculator.

Goal: **Create = Edit Preview = Edit Apply = live quote = saved snapshot**, from one pure function. Phase 1B can run in parallel with Phase 1. **Gate for P3-08 and P6-13:** P1B-01…P1B-09, P1B-11, P1B-12 and P1B-14. **Not a gate (D34):** P1B-10 and P1B-15, the loyalty writer. They ship in the same program but never hold back the calculator, the view or the live card.

| ID | Task |
|---|---|
| P1B-01 | **Freeze Create first (characterization tests).** Golden cases through today's `order-calculation.service.ts`: manual percent and fixed, automatic rule, promo code, auto-promo, `can_stack_with_promo`, tax profiles and CUSTOM, inclusive and exclusive tax, charges, cash rounding, gift card as settlement. These must stay green, unchanged, through the whole phase. |
| P1B-02 | **Reproduce the bugs.** Failing tests for EC-01…EC-08, including a DB-integration test (local harness) where Apply on a discounted order and on an order with delivery is rejected with `FINANCIAL_SNAPSHOT_MISMATCH`. |
| P1B-03 | **Extract the calculator.** A pure function (no I/O, no Prisma) taking lines, charges, discount instructions, tax context and the currency rule. It returns the totals **and** a per-component breakdown (each discount, each tax line, rounding). Create calls it, and P1B-01 stays green with identical output. Location and name decided in the P0-06 ADR. Decimal helpers only, no float math; rounding once per the currency rule (PR-02). Framework-free, so `cmx-api` can reuse it (PR-24). |
| P1B-04 | **Recorded-instructions loader for Edit.** Reads the order's active discount rows (type, rate, amount, rule `source_id`, promo), active non-voided charges, the recorded tax context (D22) and the currency rule. Every query has an explicit `tenant_org_id` filter. |
| P1B-05 | **Discount re-evaluation (D21)** through `existingDiscountPolicy`. Output `discountChanges[]` with kept, changed or removed and a reason code for each. A removal needs an acknowledgment (it reuses the Review acknowledgment mechanism). |
| P1B-06 | **Tax (D22, EC-03, EC-04):** base after discounts, recorded rate and profiles. An order with no recorded tax context is not guessed: the behaviour follows the P0-08(b) count (owner confirms before coding). |
| P1B-07 | **New-line pricing (D23, EC-07):** one price resolver used by Create and Edit. If P0-08(c) shows Create charges a different price than the New Order cart shows, the fix is in Create too, and P1B-01 gets the corrected expectation **with owner sign-off**. |
| P1B-14 | **Item price confirmation (D26):** add `confirmedUnitPrice` per line to the Create and Edit schemas (Zod), compare it in the server after the shared resolver, reject with `PRICE_CHANGED` and per-line details, and extend the existing mismatch dialog with the line list and "Use current prices" / "Back" (EN/AR, Cmx, no auto-resubmit). Tests: changed price, expired price-list discount, authorized override, Edit stale proof. |
| P1B-15 | **Loyalty reconciliation (D27, D24):** one `reconcileOrderLoyaltyEarn` path replacing the direct `queueEarnPoints` call. It is invoked from every settle path in the P0-08(e) inventory plus Edit Apply, refund and cancellation. Delta computed in the outbox consumer, serialized per order, idempotent. A migration only if P0-08(d) shows a missing transaction type (then stop and wait). Tests: paid at checkout, paid later at collection (LE-01), edit up, edit down, refund clawback, redelivery, double click. |
| P1B-08 | **Wire Preview, quote and Apply** to the calculator (EC-01, 02, 05, 06). Apply writes the changed discount rows, the tax line with the correct taxable base and the rounding; it reverses promo usage for a removed promo (`reversePromoUsageTx`). `assertCommercialSnapshot` stays as the final guard. |
| P1B-09 | **Header-only edits (EC-08):** no re-pricing; projected total = current total. |
| P1B-10 | **Loyalty earned (D24):** Edit Apply calls the P1B-15 reconciliation with trigger `ORDER_EDIT` and the change ID as the source. |
| P1B-11 | **Review dialog disclosure (rule #15):** every discount change line by line ("Promo SPRING10: −1.000 → −1.400", "Rule removed: minimum not met"), an acknowledgment for removals, EN/AR, Cmx components, `cmxMessage` where applicable. |
| P1B-12 | **Parity suite and gates:** for each fixture, Preview = quote = Apply = snapshot, and Create is unchanged. Then `npx eslint . --quiet`, `tsc`, targeted jest, DB-integration tests, `npm run build`, `npm run check:i18n`. (S)(D)(Q) |
| P1B-13 | Update the Order Edit V2 docs: WP08 marked complete with a pointer here, the Open Decisions doc gets D21–D24, and the Test Guide gets the parity scenarios. (S)(D) |

### Phase 2 — Database

Skills: `/database`, `/multitenancy`, `/code-documentation`.

| ID | Task |
|---|---|
| P2-01 | Using the P0-01 results, add any missing tenant-first indexes needed by the new loaders, for example `(tenant_org_id, order_id)` on link or fact tables. **No schema change is expected.** If none is needed, record "no migration" in STATUS. |
| P2-02 | ~~T3 permission seed~~. Not needed: no new permission code (D6). Kept as a placeholder so the task numbers stay stable. |
| P2-03 | Migration files are fully documented (`COMMENT ON` for every object), use the next seq, and use `RESTRICT` (never CASCADE). **Then stop and wait for the owner to apply and confirm.** |
| P2-04 | After the owner applies: `npm run prisma:pull` (`/pull-prisma`) if the schema changed. (S)(D) |
| P2-05 | **HQ types (PR-23):** after any applied migration from this program (P2, P1B-15), regenerate the HQ database types (`platform-api` and `platform-web`) under the integration contract (`docs/dev/rules/integration-contracts.md`), and record it in the HQ docs. If no migration is needed, record "no HQ impact". |

### Phase 3 — Backend read model

Skills: `/backend`, `/multitenancy`, `/architecture`.

| ID | Task |
|---|---|
| P3-01 | Contract types `OrderFinancialView` and `OrderFinSectionPayload<T>` (`ok` / `forbidden` / `error` / `empty`) in `lib/types/`. Constants in `lib/constants/` mirror DB codes exactly. |
| P3-02 | One loader per new source (overpayment, receivable, vouchers, loyalty, orderChanges, receipts). Each query has an explicit `tenant_org_id` filter, including joins. |
| P3-03 | `getOrderFinancialView`: run only the loaders in the include set, in parallel; no permission logic (D10); build the timeline; produce warnings from the shared rule source (P0-04). |
| P3-04 | `getOrderFinancialHeaders(tenantId, orderIds)`: snapshot columns only, one query, cap of 100, for list and handover surfaces (BF-15). |
| P3-06 | `projectOrderFinancialViewForPublic` (§6.2): allowlist projection with a snapshot test of the exact allowed fields. A new view-model field must fail the test until it is explicitly classified as public or private. |
| P3-07 | `mapDraftToSourceSet` (§6.3): maps engine outputs only, into the normalized section input. Tests prove draft totals equal the modal's own displayed totals for the same inputs. |
| P3-08 | **Edit projection (§6.4):** `mapEditQuoteToSourceSet` maps `context.financial` (saved side) plus the preview/quote result (projected side, including the calculator's per-component breakdown and `discountChanges[]`) into the normalized section input, then the same builders run. Discount lines carry `previousAmount`. No new money math: delta and balance come from the quote's financial result. Test that card figures equal the Review dialog's figures for the same operations. |
| P3-09 | **Contract schema (PR-04):** Zod schemas for `OrderFinancialView` and the stricter public projection in `lib/types` (or the feature `model/`, per the ADR). They validate responses in tests and dev, and the public schema rejects unknown fields. `schemaVersion` is bumped on any breaking change. |
| P3-05 | Unit tests per loader and mapper section. Tenant-isolation tests (another tenant's order returns not-found). Public-projection tests (no private field ever leaks, whatever config is requested). Golden-fixture equality tests (view figures = snapshot = reconciliation). (S)(D) |

### Phase 4 — APIs, endpoints, server actions, access contracts

Skills: `/backend`, `/rebuild-ui-access-contract`, `/refill-ui-access-contract-permissions`.

| ID | Task |
|---|---|
| P4-01 | `GET /api/v1/orders/[id]/financial-view`: validates the query (Zod: preset, sections), requires `orders:read`, takes the tenant from the session, returns the view (§6.1). |
| P4-07 | Customer portal (D13): extend `/api/v1/public/customer/orders` (or add `/api/v1/public/customer/orders/[id]/financial-view`) to return the public projection, only for an order that belongs to the logged-in customer **and** tenant. |
| P4-02 | `POST /api/v1/orders/financial-headers`: Zod-validated array of 1 to 100 IDs; requires `orders:read`. |
| P4-03 | Server action `getOrderFinancialViewAction(orderId, config)`: session tenant only, flat `{ success, data?, error? }` result type (project memory). |
| P4-06 | `GET /api/v1/public/track/[token]/financial-view`: reuses the existing track-route token validation and rate limiting, resolves the tenant from the token (never from input), and returns the public projection only. Respond with 404 for any invalid or expired token, without telling the caller which. |
| P4-08 | **Edit quote mode (§6.4):** measure the current preview route's cost (P0). Add `mode=quote` (or a sibling `.../changes/quote` route) that reuses the same session, permission (`orders:edit`), CSRF and calculation path, and skips review binding, proof and audit work. The Review flow is unchanged. |
| P4-09 | **API standards (PR-05, PR-06, PR-22):** one error envelope and code table (§13 PR-05) shared by every new route and the server action; `Cache-Control: no-store` on every money response; Zod whitelists for `preset` and `sections`; a server-side per-user limit on the quote route; on the public routes, a uniform 404, a response size cap and no PII in logs; customer-portal ownership checked on tenant **and** customer. Thin routes: parse, authorize, call the service, map errors. |
| P4-04 | `financial-summary` route keeps its contract unchanged (BF-10 fix only) and is marked "prefer financial-view" in the docs. |
| P4-05 | Update `orders-access.ts` apiDependencies, then run the golden path: `scaffold` → `derive --apply` → `wire --fix` → `check --wire` → `sync`. Then `/rebuild-platform-info-inventories` with surface=api. (S)(D) |

### Phase 5 — Frontend reusable component

Skills: `/frontend`, `/i18n`, `/storybook`, `/code-documentation`.

| ID | Task |
|---|---|
| P5-01 | Config types plus `resolveOrderFinDisplayConfig` with the preset matrix (§6), with unit tests. |
| P5-02 | Shared Cmx gap: no collapsible section exists in `src/ui`. Add `CmxCollapsibleSection` (accessible: `aria-expanded`, keyboard, RTL chevron) to `src/ui/data-display` with a story and a `.clauderc` snippet (CRITICAL RULE #17). |
| P5-03 | `OrderFinHeader`: metrics with one meaning each (§6.6), a hero with a status word (Due, Due at collection, Settled, Overpaid), layouts (cards via `CmxKpiStatCard`, inline, compact, badge), translated status and settlement badges (BF-17), and the reconciliation badge worded "Reconciled", "Figures differ" or "Recalculating" (D32). |
| P5-04 | `OrderFinSection` shell implementing the 5 modes. One renderer per section, reusing the existing `order-financial/*` panels, which are refactored to take section payloads. |
| P5-05 | `OrderFinancialView` (accepts `orderId` or pre-fetched `data`), plus the `useOrderFinancialView` hook and `invalidateOrderFinancial(queryClient, orderId)`. Loading uses skeletons; errors are per section; empty and forbidden states are handled. Money is formatted with the existing currency-aware formatters, with no arithmetic. |
| P5-06 | i18n: EN and AR keys for every label, metric, mode toggle and state (reuse `orders.detail.financial.*` and `common.*` first). Verify RTL. Run `npm run check:i18n`. |
| P5-09 | `presetSwitcher` control (D9): a segmented control (for example Detailed / Full) that is accessible and RTL-safe, remembered per viewer in try/catch localStorage, with `?fin=` URL param support. |
| P5-10 | `source` handling (§6, `OrderFinSource`): `order` uses the hook, `data` renders directly, `draft` renders with the "Preview — not yet saved" badge and no fetch. The `public` preset ignores caller overrides that would reveal hidden sections. |
| P5-11 | `useOrderEditFinancialQuote`: 500 ms debounce, AbortController, keeps the last confirmed quote, `pending` / `error` / `denied` states. Header metrics `originalTotal`, `projectedTotal`, `totalDelta`, `projectedBalance` plus the outcome chip, all EN/AR. |
| P5-12 | **Shared money text (BF-18):** search `src/ui` first. If no component formats with an explicit currency code and decimal places, promote `order-financial-money-value.tsx` to a shared `CmxMoneyText` (theme tokens, order-currency decimals from the currency catalog, an unknown-currency state, tabular numerals, RTL), with a story and a `.clauderc` snippet. Line rendering follows §6.6: points never go through it, and informational amounts render in the line text. |
| P5-13 | **Statement primitives (D36, PR-01):** `CmxStatement`, `CmxStatementGroup`, `CmxStatementRow` (the 5 modes, chips, count, end-aligned amount) and `CmxStatementLine` (roles, states, informational text, was → now, line cap) in `src/ui/data-display`, built on `CmxCollapsibleSection` and `CmxMoneyText`. No order types. Stories (LTR, RTL, dark, print), a `.clauderc` snippet and the `/storybook` skill. |
| P5-14 | **Accessibility pass (PR-11):** a focus trap and focus return for the sheet and dialog; `aria-live` announcing confirmed quote figures only; spoken signs; reduced motion; contrast in light, dark and print; 44 px targets. Checked with the Storybook a11y addon plus a keyboard-only and screen-reader walkthrough (EN and AR). |
| P5-07 | Print layout (`layout='print'`) for report use, following the `*-rprt.tsx` naming. |
| P5-08 | Stories: every preset, mode, layout, RTL and dark mode, plus forbidden and error states. (S)(D)(Q) |

### Phase 6 — Pages and screens migration

Skills: `/frontend`, `/i18n`, `/navigation` (only if a route or menu changes).

| ID | Task |
|---|---|
| P6-01 | Order detail (`/dashboard/orders/[id]`): the financial tabs and summary cards use `<OrderFinancialView preset="detailed">` (Release 1). The `presetSwitcher={['detailed','full']}` (D9) is switched on in Release 2, when `full` exists. Delete the page-level view-model assembly. |
| P6-02 | Full order page (`/dashboard/orders/[id]/full`): `preset="full"`. Retire `orders-financial-tab-rprt.tsx` arithmetic and the legacy shim in `full/page.tsx` (BF-08, BF-12). |
| P6-03 | Print reports (`order-payments-print-rprt`, `order-invoices-payments-print-rprt`) use `layout='print'`. |
| P6-04 | Pickup handover, delivery handover and the ready detail use `preset="totals"` from the batch or single reader (BF-15). |
| P6-05 | Collect-payment modal: header in badge or totals form (the host chooses the preset, D10), so till screens stay simple. |
| P6-06 | Order workspace screen and the delivery list or detail. |
| P6-07 | AR invoice detail: a linked-orders section uses `preset="summary"` per order. |
| P6-08 | Wire `invalidateOrderFinancial` after payment, refund, charge void, order edit apply and tax-document issue. |
| P6-09 | **payment-modal-v4 (D8):** add an additional "Order financial summary" button that opens `<OrderFinancialView source={{kind:'draft'}} preset="detailed">` read-only in a CmxDialog or side sheet. The engine, the existing sections and all entered amounts stay untouched. Closing returns to the modal with its state intact. Add an i18n label and a keyboard shortcut only if it does not clash with `use-payment-shortcuts.ts`. |
| P6-13 | **Order Edit (D20):** add the compact card under the Review button in the edit summary panel (`edit-shared-workspace.tsx` → `NewOrderLayout` / `OrderSummaryPanel`), using the `edit` source, with a "Details" link to a side sheet at `detailed`. Fix BF-19 per D33: the Review button shows no money in Order Edit and in New Order; New Order's summary total follows P0-08(g). Editing must stay fully responsive while a quote is pending. |
| P6-12 | **Customer portal (D13):** the customer's order screens render `<OrderFinancialView preset="public">` from the P4-07 endpoint. |
| P6-11 | **Public tracking (D7):** `order-tracking-page.tsx` replaces its own totals block with `<OrderFinancialView source={{kind:'data'}} preset="public">`, fed from the P4-06 endpoint on the token path. The `tenantId/orderNo` fallback follows the BF-16 outcome. |
| P6-14 | **Cleanup (PR-20):** at the end of each release, delete what has no callers left: the legacy mapper, the old `order-financial/*` panels, the full-page shim and `getOrderFinancialForReceiptAction`. Proved by a search plus a green build. |
| P6-10 | `npm run build`, `npx eslint . --quiet`, `tsc`, and a browser smoke test of each migrated surface in EN and AR, at 360 px, tablet, desktop and A4 print (PR-12). (S)(D)(Q) |

### Phase 7 — Verification and hardening

Skills: `/testing`, `/debugging`.

| ID | Task |
|---|---|
| P7-01 | Golden-fixture suite: for each P0-02 order, every displayed figure equals the snapshot, which equals the reconciliation result. It also covers the PR-09 lifecycle states (cancelled, recalculation required, snapshot missing, unknown currency, zero total, fully discounted, overpaid, base-currency difference). New pure modules need ≥ 90% line and branch coverage (PR-26). |
| P7-02 | DB-integration tests on the local harness: tenant isolation for every loader, and the batch-header cap. Security cases (PR-15): a cross-tenant order ID returns 404 on every route and the action; a forged tenant is ignored; public field leaks; CSRF on the quote POST; the rate limit; the customer portal refuses another customer's order. |
| P7-03 | Performance: tests assert that each preset fetches only its sources. Timing (target: detail view under 300 ms p95 on remote sample data) is measured **after** the P2 indexes exist; it is not a gate before them. |
| P7-04 | Accessibility and RTL pass. Number direction and currency placement in AR. |
| P7-06 | **Observability (PR-13):** structured logs with tenant and order IDs and no PII; per-source load timing; quote latency; counters for `PRICE_CHANGED`, `ORDER_CHANGED`, `FINANCIAL_SNAPSHOT_MISMATCH` and "Figures differ"; the component error boundary logs. |
| P7-07 | **E2E (PR-17):** Playwright specs for order detail (EN and AR), the payment-modal summary (opens and closes with no state change), the Order Edit card (updates; a notes-only edit makes no request; no money on Review), public tracking by token, and the customer portal. Included in `npm run test:e2e`. |
| P7-05 | Full owner QA run of the QA guide scenarios. (S)(D)(Q) |

### Phase 8 — Order Fin rules file, skill and Cursor rule (owner D5)

| ID | Task |
|---|---|
| P8-01 | Create `docs/dev/rules/order-fin-rules.md`. **Canonical rules for any Order Fin work:** the snapshot is the source of truth; one outstanding formula (D005, `computeOutstanding`); no UI arithmetic; `??` and never `\|\|` for money fallbacks; voided rows excluded from sums but visible; currency and tolerance come from the B15 sources and are never hardcoded; tenant filter in every query including joins; tenant from the session only; public data only through the server allowlist projection (a browser preset is never the boundary); no section permission tiers (D10); points never summed or formatted as money, and informational amounts never in the amount column (§6.6); one meaning per header metric; "Reconciled", never "Balanced"; no money on the Review button (D33); builders take normalized section input only; the AR link goes through `org_invoice_orders_dtl`; no silent money mutation (#15); no maker-checker; constants mirror DB values; reuse `OrderFinancialView` and never build a new financial panel; **one commercial calculator**, never a second one (Create, Edit, quote all call it); on edit, re-price the commercial side and keep the settlement side; invalidate after every money mutation; golden-fixture tests are required. |
| P8-02 | Create the skill `.claude/skills/order-fin/SKILL.md`: when to load it, a pointer to the rules file, a component and config cheat-sheet, source table map, checklists (adding a source, adding a section, adding a metric), and common pitfalls (BF list as lessons). |
| P8-03 | Create `.cursor/rules/order-fin.mdc` (short and critical, applied on Order Fin paths). |
| P8-04 | Add a row to the CLAUDE.md mandatory skill table ("Any order financial read, display or calculation → `/order-fin`") and to the Skills Reference list. (S)(D) |

### Phase 9 — Documentation update (owner D5)

| ID | Task |
|---|---|
| P9-01 | This folder: `README.md`, `developer_guide.md` (config contract, presets, adding a section), `user_guide.md` (what each section means, EN and AR terms), `testing_guide_and_scenarios.md`, `CHANGELOG.md`, `version.txt`. Mark STATUS.md complete. |
| P9-02 | Order_Fin root: `README.md`, `current_status.md`, `IMPLEMENTATION_STATUS.md`, `developer_guide.md`, `CHANGELOG.md`, plus cross-links from `CleanMateX_Order_Details_Financial_Summary_Enhancement_Spec_v1_0.md` and the Remediation QA guide. |
| P9-03 | Feature docs checklist (implementation prd-rules): permissions, navigation (none expected), settings, feature flags (none expected), plan limits, i18n keys, API routes, migrations, constants and types, env vars. |
| P9-04 | `/rebuild-platform-info-inventories` (api, page) and `npm run check:platform-info-inventories`. |
| P9-05 | `docs/dev/i18n_docs/GLOSSARY.md`: EN and AR terms for the metrics (balance, net collected, overpaid, receivable and so on). |
| P9-06 | `web-admin/.clauderc` (`CmxCollapsibleSection` and the `OrderFinancialView` import line), and `src/ui` docs. |
| P9-07 | Project memory: record the program's status and pointer. |
| P9-08 | **HQ docs (PR-23):** a pointer in HQ `docs/features/Order_Edit_V2/WP05-B_HQ_PROGRESS.md` for the reserved D21 policy authoring; the HQ type-regeneration record (P2-05); and confirmation that no HQ settings, flags, permissions or screens changed. |

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fixing BF-11 changes figures users have seen | That is intended: the old figures were wrong. Golden fixtures prove the correct values. Note it in the CHANGELOG and the QA guide. |
| Snapshot stale or `RECALCULATION_REQUIRED` | Show a banner. Never present fallback figures as final. |
| Too many queries in list surfaces | Batch header reader (P3-04). Hidden sections are never fetched. |
| Breakdown reachable by any `orders:read` user through the API | Accepted for now (D10, §6.1). Tiers can be added at the entry points later; the contract already reserves `forbidden` sections. |
| Release 1 ships before every source exists | Release 1 is complete for what it shows: every Release 1 section is fully correct and tested. The sections not built yet are simply absent from the presets. They are never shown as empty or zero. |
| The edit card waits on Phase 1B | Release 1 tracks it explicitly; P6-13 cannot start until the Phase 1B gate is green. The rest of Release 1 does not wait. |
| Public data leak | Allowlist projection applied at the public entry points regardless of config, plus snapshot tests (P3-06). |
| Migrating the full page breaks print output | P6-03 print layout plus a QA print scenario. |
| Scope creep into calculation changes | Only Phase 1B (D25) changes calculation, and only to make Edit match Create. Any other calculation defect found is logged as a separate remediation package. |
| Extracting the calculator changes Create's figures | P1B-01 characterization tests are written **before** the extraction and must stay green. The only allowed Create change is a P1B-07 correction, with owner sign-off. |
| A price changes between the cart and submit | Server rejects with `PRICE_CHANGED` and the per-line list. The cashier confirms the current prices and submits again (D26). Never charged silently. |
| Loyalty clawback after points were already spent | Balance never goes below zero; any part that can't be reversed is recorded on the adjustment row (D27). |
| Re-evaluating discounts surprises the cashier | Nothing changes silently: line-by-line disclosure plus acknowledgment for removals (P1B-11, rule #15). |

## 10. Open items for owner review

Resolved: D6–D9 (round 2) and D10–D13 (round 3).

Structure and UI: decided as D14–D19 in [DESIGN.md](DESIGN.md) §4 (delegated by the owner). Interactive mockup: https://claude.ai/artifact/Kc2iHiAdb47pJFzn1mjXaC.

Resolved 2026-10-23: Order Edit calculation decisions D21–D25 (§2, §6.5). EC-01…EC-08 are fixed in Phase 1B before P6-13 ships.

Resolved 2026-10-23: item price confirmation (D26) and loyalty earn on every settle path (D27, closes LE-01), both delivered in Phase 1B (P1B-14, P1B-15).

Done 2026-10-23 (v5): the D15/D17 contract additions are folded into §5–§6 (`items` + `charges` replace the old value-breakdown section, plus `lineCap`, `groupOrder` and the reserved `detailRenderer`). The external review is evaluated and its accepted items are recorded as D29–D35.

**Still open: owner review of the corrected mockup, and the owner's clear go-ahead to start Phase 0.**

## 11. Definition of done

- Every BF item is fixed with a regression test.
- Every EC item is fixed. One commercial calculator serves Create, Edit Preview, Edit Apply and the quote, and the parity suite (P1B-12) is green.
- Every §5 source is loaded, tenant-filtered and covered by tests.
- Every surface in the P0-03 inventory is migrated or explicitly excluded.
- lint, tsc, jest, build and i18n checks are green, and inventories are in sync.
- The rules file, skill and Cursor rule exist, and CLAUDE.md is updated.
- All P9 docs are updated, and the owner has completed QA.
- Both releases (§12) are done, each with its readiness checklist satisfied. Release 1 alone is not "done" for the program.
- Every §13 production-review item is closed by its task.

## 12. Releases (D29)

One component and one contract. Release 2 only adds sections, presets and screens; it never changes Release 1's contract.

| | **Release 1: the money statement, everywhere it matters first** | **Release 2: the full record** |
|---|---|---|
| Sections | header, items, charges, discounts, taxes, payments, credits, refunds, overpayment, receivable, tax documents, warnings, and the reconciliation **badge** (from the snapshot status) | vouchers, loyalty, adjustments, order changes, currency, receipts, timeline, the reconciliation **section**, debug |
| Presets | `badge`, `totals`, `summary`, `detailed`, **`public`** (owner) | `full`, `audit`, plus the order-detail `presetSwitcher` (D9) |
| Sources | `order`, `data`, `draft`, **`edit`** (owner) | — |
| Prerequisites | P0, Phase 1 (all BF), Phase 1B gate (§8), P2 indexes if needed, the public allowlist test (P3-06), BF-16 outcome | — |
| Backend and API | P3-01/02/03/05/06/07/08; P4-01/03/04/05/06/07/08 | P3-04 + P4-02 (batch header reader, cap 100) |
| Frontend | P5-01…06, P5-08 (Release 1 scope), P5-10/11/12 | P5-07 (print), P5-09 (switcher), P5-08 (Release 2 stories) |
| Screens | order detail (`detailed`), payment-modal-v4 summary button, **Order Edit live card**, public tracking (token path only), customer portal, invalidation wiring (P6-08) | full order page (retires the duplicate renderer, BF-12), print reports, pickup/delivery/ready/workspace on the batch reader (BF-15), collect-payment modal, AR invoice detail |
| Loyalty writer (P1B-10/15) | In the program, **not a gate** (D34). It ships when ready, in either release. | — |
| Rules, skill, docs | P8 (rules file, skill, Cursor rule, CLAUDE.md row) at the end of Release 1, so later work follows them; P9 docs for Release 1 | P8 refresh plus P9 complete |
| Production review (§13) | P0-09, P2-05, P3-09, P4-09, P5-13, P5-14, P6-14, P7-06, P7-07 | P6-14 (Release 2 cleanup), P7-06/07 extended to Release 2 screens |
| Verification | P6-10 + P7 for Release 1 surfaces, owner QA | P7 complete, owner QA |

**Release readiness checklist** (every release, all must be true):
1. Every task in the release column is done, and STATUS.md is updated.
2. Gates are green: `npx eslint . --quiet`, `tsc`, jest, DB-integration, `npm run test:e2e` (release specs), `npm run build`, `npm run check:i18n`, `check:platform-info-inventories`.
3. Golden fixtures pass: G1, G2, E1, plus the PR-09 states.
4. Security cases pass (PR-15).
5. The smoke test passes at every width in EN and AR, plus A4 print (PR-12).
6. The QA guide scenarios are written, and the owner has run them.
7. Docs are refreshed: the P9 rows for this release, the ADR, and the HQ pointer if affected.
8. Migrations: none left unapplied; Prisma and HQ types regenerated if the schema changed.

## 13. Production-readiness review (v6, 2026-10-23)

A layer-by-layer review of this plan against production standards. Each gap has a resolution folded into a task. The new tasks are listed in §8.

| ID | Area | Gap found | Resolution | Task |
|---|---|---|---|---|
| PR-01 | Architecture, UI | The statement UI would be order-specific, so AR invoice statements or customer account statements would need a second copy. | **D36:** generic, domain-agnostic statement primitives in `src/ui` (`CmxStatement`, `CmxStatementGroup`, `CmxStatementRow`, `CmxStatementLine`). They know nothing about orders and take formatted money, roles and states. `order-fin-view` composes them. | P5-13 |
| PR-02 | Calculator | Float arithmetic risk in the shared calculator. | All calculator and builder money math uses the existing decimal helpers (`lib/money`, `addMoney` / `sumMoney`). Rounding happens once, per the currency rule (`sys_currency_rounding_rules_cf`). Amounts cross the API as numbers already rounded to 4 dp. Tests cover classic float traps (0.1 + 0.2, 3-dp halves). | P1B-03 |
| PR-03 | Coordination | The active **Extend Order Edit Policy** program (Order_Edit_V2) changes the same Preview, Apply writer and review screen as Phase 1B. | P0-09 agrees the order of work and the owner of each shared file before Phase 1B starts. D21 is the platform default carried in `existingDiscountPolicy`. Making it tenant-configurable through HQ policy authoring is reserved for the Edit Policy program and not built here. | P0-09 |
| PR-04 | Contract | No runtime guard on the view contract. | A Zod schema for `OrderFinancialView`, plus a stricter one for the public projection. It validates responses in tests and dev and rejects unknown public fields. API contract tests are added. `schemaVersion` is bumped on any breaking change. | P3-09 |
| PR-05 | APIs | Error and caching behaviour is not standardized. | One error envelope `{ success, error: { code, messageKey } }` with codes: 400 `VALIDATION_FAILED`, 401, 403 `PERMISSION_DENIED`, 404 `ORDER_NOT_FOUND`, 409 `PRICE_CHANGED` / `ORDER_CHANGED`, 429 `RATE_LIMITED`, 500 generic (real error logged server-side). Every money response is `Cache-Control: no-store`. `preset` and `sections` are whitelisted by Zod. | P4-09 |
| PR-06 | Public | Hardening is only partly specified. | Token path: the existing rate limit and expiry, a uniform 404 with no enumeration signal, no-store, no PII in logs, and a response size cap. Customer portal: the order must match **both** the session tenant and the session customer. | P4-06, P4-07 |
| PR-07 | Concurrency | The order can change between quote and Apply (another user collects a payment or applies an edit). | The quote carries the context fingerprint. A changed order returns `ORDER_CHANGED`. The card then shows "This order changed — figures refreshed" and requires a fresh Review. Apply already rejects a stale proof. | P1B-08, P5-11 |
| PR-08 | Freshness | Other users' changes are not pushed to an open view. | `staleTime: 0`, refetch on focus and reconnect, and local invalidation after every money action. Real-time push is out of scope, and the contract does not block it later. | P5-05 |
| PR-09 | States | Order lifecycle edge states are not designed. | Explicit states, each with a fixture and a story: **cancelled** (banner plus the ADR-053 disposition, never presented as a live balance); snapshot `RECALCULATION_REQUIRED`; **snapshot missing or legacy** ("Financial data unavailable", never zeros); unknown currency; zero total; fully discounted; overpaid; base-currency difference. | P5-05, P7-01 |
| PR-10 | Locale | Dates and times would be formatted in the browser's timezone. | Dates are formatted in the **tenant timezone** (existing tenant context) and the user locale, through the existing date formatter. Digits follow the existing money formatter. Sentences use ICU placeholders, never string concatenation. | P5-06, P5-12 |
| PR-11 | Accessibility | Only partly specified. | WCAG 2.2 AA: a focus trap in the sheet or dialog that returns focus to the opener; `aria-live="polite"` announcing only **confirmed** quote figures, not every keystroke; signs spoken ("minus 0.500"); reduced-motion support; contrast checked in light, dark and print; 44 px touch targets. | P5-14 |
| PR-12 | Responsive | No width targets. | 360 px phones (tracking, portal), tablet POS (payment modal sheet, Order Edit), desktop at 1024 px and up with two columns, and A4 print in EN and AR. Every target is checked in the P6-10 smoke. | P6-10 |
| PR-13 | Observability | No telemetry for money issues. | Structured logs (existing logger) with tenant and order IDs and no PII; per-source load timing; quote latency; counters for `PRICE_CHANGED`, `ORDER_CHANGED`, `FINANCIAL_SNAPSHOT_MISMATCH` and "Figures differ". The component error boundary logs and shows the error state. | P7-06 |
| PR-14 | Performance | Budgets are vague. | A query budget per preset, asserted in tests. Heavy sources (timeline, vouchers) are capped server-side for every preset except `audit`, with "Show all" fetching the rest. Quote target p95 < 300 ms and view target p95 < 300 ms, both measured after P2. The batch headers reader is a single query. | P7-03 |
| PR-15 | Security tests | Not enumerated. | Cross-tenant order ID returns 404 for every route and the server action; a forged tenant in the action is ignored; public field-leak tests; CSRF on the quote POST; rate-limit test; the customer portal refuses another customer's order. | P7-02 |
| PR-16 | Audit | Price confirmations and discount removals leave no trail. | `PRICE_CHANGED` shown and accepted is recorded in the order audit, with old and new unit prices. Discount-removal acknowledgments use the existing order-change acknowledgment facts. Loyalty adjustments carry trigger, source ID and idempotency key. | P1B-11, P1B-14, P1B-15 |
| PR-17 | E2E | Playwright exists in web-admin but is not planned. | Specs: order detail (Release 1 view, EN and AR); payment-modal summary opens and closes with no state change; Order Edit card updates, a notes-only edit makes no request, and the Review button shows no money; public tracking token page; customer portal. Added to `test:e2e`. | P7-07 |
| PR-18 | i18n | Namespace not fixed. | Namespace `orders.finView.*` (reusing `common.*` first). Keys for every state, chip, outcome and error code; EN/AR parity enforced by `npm run check:i18n`; glossary terms (P9-05). | P5-06 |
| PR-19 | Error UX | Not specified. | If the core source fails, the whole view shows an error state with Retry and **no partial figures**. Other sources fail only their own section. Quote failures stay inline on the card, not as a toast. `PRICE_CHANGED` uses a `CmxDialog`. `cmxMessage` is used only for action feedback (rule #16). | P5-05 |
| PR-20 | Cleanup | Dead code could linger after migration. | At the end of each release, delete the legacy mapper, the old panels, the full-page shim and `getOrderFinancialForReceiptAction` once they have no callers, and prove it with a search plus a green build. | P6-14 |
| PR-21 | Query cache | Cache keys could collide across tenants after a tenant switch. | Query key `['order-fin-view', tenantId, orderId, sourceKind, requiredSourcesKey]`, following the existing tenant-switch cache-clear pattern (verified in P0-03). | P5-05 |
| PR-22 | Quote abuse | Fast typing could flood the quote route. | Client 500 ms debounce plus abort, and a server-side per-user limit on the quote route (429 → the card keeps its last figures with "Try again"). | P4-08 |
| PR-23 | HQ repo | Cross-repo effects are not stated. | Verified 2026-10-23: HQ references these tables only through generated DB types. Any migration from this program (P2 indexes, P1B-15 loyalty type) triggers an HQ type regeneration under the integration contract (`platform-api` and `platform-web` database types), recorded in HQ docs. No HQ settings, flags, permissions or screens are needed. A pointer goes into HQ `docs/features/Order_Edit_V2/WP05-B_HQ_PROGRESS.md` for the reserved D21 policy authoring. | P2-05, P9-08 |
| PR-24 | cmx-api | Future reuse not ensured. | Contract types live in `lib/types`. Builders, the resolver and the calculator are framework-free pure modules with the tenant passed explicitly, so `cmx-api` (Phase 2) can reuse them without Next.js. Recorded in the ADR. | P0-06 |
| PR-25 | Rollout | Not stated. | Pre-launch, so no rollout feature flag (project memory). Migrations are additive only. Rollback is a code revert. Each release has a readiness checklist (§12). | §12 |
| PR-26 | Test quality | No coverage bar. | New pure modules (resolver, builders, calculator, projections) must have ≥ 90% line and branch coverage, and money paths need golden fixtures. A test may not assert on its own recomputation of the figures; it asserts on fixtures. | P7-01 |
