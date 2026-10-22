# Reusable Order Financial View — Implementation Plan

**Status:** DRAFT — awaiting owner review. No code is written until the owner approves this plan.
**Created:** 2026-10-22
**Owner decisions captured:** 2026-10-22, rounds 1 and 2 (see §2)
**Revision:** v3, 2026-10-22: added D10–D13 (permission-agnostic component, public tender totals, modal preset, customer portal) and BF-17/BF-18. v2 added D6–D9. Structure and UI design under discussion in [DESIGN.md](DESIGN.md).
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

- No change to how money is **calculated or written**. The writers (`order-financial-write.service.ts`, payment, refund and settlement services) stay frozen. This program is read and display only.
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
| D7 | **Public-safe version** in the **same domain** (same component, same mapper, same config contract), so any future change reaches it automatically. Only a server-side public projection and a `public` preset differ. |
| D8 | **payment-modal-v4:** add a button that opens the reusable Order Fin summary **read-only**, in addition to the current modal components and without replacing any. |
| D9 | **Order detail page:** default preset `detailed`, with an in-view switch to `full`. |

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
| BF-04 | M | mapper L241 | Hardcoded tolerance `0.001`. Must use currency-aware `financial-tolerances.ts`. | Verified |
| BF-05 | M | mapper L84, L101 | `roundingAmount` comes from a page-supplied order prop, and `payOnCollectionAmount` is recomputed. The snapshot already holds both and must be the single source. | Verified |
| BF-06 | M | mapper / view model | Snapshot facts are dropped from the business view (only the debug raw snapshot has them): pending, authorized and failed payments, real-payment refunded, stored-value restored, customer credit issued, change returned, voucher references. | Verified |
| BF-07 | H | `invoice-service.getInvoicesForOrder` + detail client L163 | The AR invoice lookup uses only `org_invoice_mst.order_id` and the UI takes `orderInvoices[0]`. Multi-order or consolidated invoices linked through `org_invoice_orders_dtl` (which has a per-order `outstanding_amount`), and second invoices, are invisible. | Verified (link table exists). Behaviour to be confirmed with data in P0. |
| BF-08 | M | full client L548 + `full/page.tsx` shim | The gift-card sum ignores `application_status`, so reversed or failed gift cards count. The full page renders from a legacy-shaped shim (`total`, `paid_amount`, `service_charge`, `promo_discount_amount`) rebuilt in `page.tsx`; those columns no longer exist on `org_orders_mst`. | Verified |
| BF-09 | H | `app/actions/orders/get-order-financial.ts` | A `'use server'` export accepts a **caller-supplied `tenantId`**. Neither export performs a permission check. A server action is a callable endpoint, so tenant and permission must come from the session. | Verified (code). Exploitability to be confirmed in P1. Fix regardless. |
| BF-10 | M | `api/v1/orders/[id]/financial-summary` | Not-found (`findFirstOrThrow`) returns **500** and echoes raw internal error text. Expected: 404, plus a generic message with the error logged server-side. | Verified |
| BF-11 | H | service L629-686, mapper L43-74 | **Zero-is-falsy fallbacks:** `snapshot.x \|\| recompute()`. A legitimate snapshot `0` (overpaid after change returned, a charge voided to 0, refunded 0) falls through to a gross recomputation that can resurrect values. The mapper's own comment warns about this for overpaid, but the service still does it. Must use `??` with explicit `usedReadFallback` semantics. | Suspected H. Confirm with fixtures in P1. |
| BF-12 | M | `orders-financial-tab-rprt.tsx` vs the `order-financial/*` panels | Two parallel renderers of the same data, so they drift. Consolidated in P6. | Verified |
| BF-13 | L | detail client L200-225 | The view model carries only the newest tax document plus a legacy header fallback. The supersede chain (credit and debit notes) is not in the business view. | Verified |
| BF-14 | M | mapper `buildWarnings` vs `lib/services/reconciliation/*` | Display warnings are a separate rule set from the reconciliation checks, so they can drift. They must share one rule source. | To verify in P0 |
| BF-15 | M | consumers (pickup, delivery, ready, workspace, collect-payment) | Each surface reads `outstanding*` from different, possibly stale props. No shared header reader exists. | Verified (independent reads) |
| BF-17 | M | `order-financial-summary-cards.tsx` (payment status and type badges) | Raw DB codes are shown to users (`PAID`, `PAY_ON_COLLECTION` with `_` replaced by a space) instead of translated EN/AR labels. Breaks the bilingual rule (CRITICAL RULE #6). | Verified |
| BF-18 | M | summary cards + `order-financial-money-value.tsx` | Money is formatted with the **tenant** currency's decimal places even when the order uses a different currency (for example OMR 3 dp vs USD 2 dp). The money value also uses hardcoded Tailwind colors instead of theme tokens, and some states are shown by color alone. | Verified |
| BF-16 | H (if confirmed) | `app/public/orders/[tenantId]/[orderNo]` → `GET /api/v1/public/orders/[tenantId]/[orderNo]` | When no tracking token exists, the page falls back to a lookup by tenant ID and order number, and order numbers can be guessed. If that endpoint returns money figures (it already renders `outstandingAmount`) without a second check, anyone can read another customer's order balance. The public financial view must **never** be served on this path unless P0 proves it is guarded. | To verify in P0 |

Every BF item gets a regression test that fails before the fix and passes after it.

---

## 5. Data scope — the complete order financial picture

Rule: every number is **read**, never re-derived for display, except presentation-only grouping. Any derivation must call the canonical function (`computeOutstanding`, `computeOverpaidAmount`, the effective sums).

| Section key | Sources | Exists today? |
|---|---|---|
| `header` | `org_orders_mst` snapshot (totals, paid, credits, outstanding, overpaid, refunded, payment status, settlement type, snapshot status) | Yes |
| `valueBreakdown` | snapshot: items base, piece and preference extras, charge totals + `org_order_charges_dtl` (voided rows shown and marked, excluded from sums) | Yes (buggy, BF-01) |
| `discounts` | `org_order_discounts_dtl` (manual, rule, promo, promotion link, stacking group, voided) | Yes |
| `taxes` | `org_order_taxes_dtl` + snapshot tax-base buckets (taxable, non-taxable, exempt, zero-rated, out-of-scope) + tax pricing mode | Yes |
| `payments` | `org_order_payments_dtl` grouped by lifecycle (completed, pending, authorized, failed, reversed), method, gateway ref, voucher link | Yes |
| `credits` | `org_order_credit_apps_dtl` (wallet or stored value, gift card, loyalty redemption, credit note) with application status | Yes |
| `refunds` | `org_order_refunds_dtl` (source type, method, original payment or credit, reopens-due, processed vs pending) | Yes |
| `overpayment` | snapshot `overpaid_amount`, `change_returned_amount` + **`org_fin_overpay_disp_dtl`** (resolution code, amount, target ref, voucher) | **New** |
| `receivable` | **`org_invoice_orders_dtl`** + `org_invoice_mst` (all linked invoices, per-order invoiced and outstanding amounts) + `org_invoice_payments_dtl` / `org_ar_credit_allocs_dtl` (allocations, reversals) + pay-on-collection | **New** (partial today, BF-07) |
| `taxDocuments` | `org_tax_documents_mst`, full supersede chain | Partial (BF-13) |
| `vouchers` | **`org_fin_vouchers_mst`** for the order plus vouchers referenced by payments, refunds and credits (number, type, subtype, status, posting status, amount, reversal link) | **New** (IDs only today) |
| `loyalty` | **`org_loyalty_txn_dtl`** by `order_id` (earned, redeemed, reversed points, before and after balance, credit-app link) | **New** |
| `adjustments` | `org_order_adjustments_dtl` | Yes |
| `orderChanges` | **`org_order_changes_mst`** (`financial_before`, `financial_after`, `commercial_delta`, `financial_outcome`, actor, time) | **New** |
| `currency` | snapshot base-currency fields and exchange rate | Yes |
| `receipts` | **`org_rcpt_receipts_mst`** (receipt type, channel, delivery status, voucher link). Optional and low priority. | **New** |
| `cashHandling` | Cash drawer or session per cash payment. **The link column is to be verified in P0** (`org_cash_drawer_trx_mst` has no `order_id`). Include only if a reliable link exists. | To verify |
| `timeline` | Unified, time-ordered events from all sections above | Partial |
| `reconciliation` | Snapshot status, engine version, mismatch count, warnings (shared rule source, BF-14) | Partial |
| `debug` | Raw snapshot, calculation hash, trace ID | Yes |

---

## 6. Display configuration contract (owner D2)

The types live in `web-admin/src/features/orders/model/order-financial-view-config.ts`. Section keys and preset names are UI configuration, not DB values. Any **DB-backed code** shown (statuses, types) uses the exact DB string (CRITICAL RULE #12).

```ts
type OrderFinSectionKey =
  | 'valueBreakdown' | 'discounts' | 'taxes' | 'payments' | 'credits' | 'refunds'
  | 'overpayment' | 'receivable' | 'taxDocuments' | 'vouchers' | 'loyalty'
  | 'adjustments' | 'orderChanges' | 'currency' | 'receipts' | 'cashHandling'
  | 'timeline' | 'reconciliation' | 'debug';

/** How one section renders. */
type OrderFinSectionMode =
  | 'hidden'      // not rendered, and its data is not fetched
  | 'total'       // one total line only, no details
  | 'expandable'  // total line + toggle, collapsed by default
  | 'expanded'    // total line + toggle, open by default
  | 'detail';     // details always visible, no toggle

type OrderFinHeaderMetric =
  | 'total' | 'paid' | 'credits' | 'collected' | 'balance' | 'refunded'
  | 'netCollected' | 'overpaid' | 'changeReturned' | 'receivable'
  | 'payOnCollection' | 'discount' | 'tax';

type OrderFinPreset = 'badge' | 'totals' | 'summary' | 'detailed' | 'full' | 'audit' | 'public';

/** Where the figures come from. One component, three sources, one view-model shape. */
type OrderFinSource =
  | { kind: 'order'; orderId: string }              // saved order: fetched via hook (tenant from session)
  | { kind: 'data'; view: OrderFinancialView }      // pre-fetched on a server page, or the public projection
  | { kind: 'draft'; draft: OrderFinDraftInput };   // unsaved order (payment-modal-v4): engine outputs, no fetch

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
  layout?: 'card' | 'plain' | 'sheet' | 'print';
  columns?: 1 | 2 | 'auto';
  density?: 'comfortable' | 'compact';
  showEmptySections?: boolean;             // default false
  showWarnings?: boolean;                  // default true
  forbiddenSectionBehavior?: 'hide' | 'lockNote'; // default 'hide'
  /** In-view preset switch (D9), e.g. ['detailed', 'full']. Remembered per viewer
   *  in localStorage (wrapped in try/catch) and also readable from a `?fin=` URL param. */
  presetSwitcher?: OrderFinPreset[];
}
```

**Preset matrix** (each cell can be overridden per section):

| Section | badge | totals | summary | detailed | full | audit |
|---|---|---|---|---|---|---|
| header metrics | balance | total, paid, balance | total, paid, credits, balance, refunded | + overpaid, receivable | all non-zero | all |
| valueBreakdown | hidden | total | expandable | expanded | detail | detail |
| discounts / taxes | hidden | total | expandable | expandable | detail | detail |
| payments / credits / refunds | hidden | total | expandable | expanded | detail | detail |
| overpayment / receivable | hidden | hidden | total if non-zero | expandable | detail | detail |
| taxDocuments / vouchers / loyalty | hidden | hidden | hidden | expandable | detail | detail |
| adjustments / orderChanges / currency | hidden | hidden | hidden | expandable | detail | detail |
| receipts / cashHandling | hidden | hidden | hidden | hidden | expandable | detail |
| timeline | hidden | hidden | hidden | hidden | expandable | detail |
| reconciliation | hidden | hidden | badge only | badge only | expandable | detail |
| debug | hidden | hidden | hidden | hidden | hidden | expandable |

The `public` preset is defined in §6.2, because its data is a server-side projection rather than a display choice.

Resolution is a pure, unit-tested function: `resolveOrderFinDisplayConfig(config) → ResolvedConfig`. It also produces the **required data sources** (`hidden` sections are never fetched) and the **required permission tier** per section.

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
2. **A `public` preset:** header (total, paid, balance), plus `valueBreakdown`, `discounts`, `taxes` and `payments` as `total`/`expandable`. All other sections are forced to `hidden`, and the caller cannot override this.

**Access:** served only through the tracking-token path (`/track/[token]` → `GET /api/v1/public/track/[token]/financial-view`), and only after the same token validation the existing track route uses. The `tenantId/orderNo` fallback path gets **no** financial view until BF-16 is resolved in P0. The **customer portal** (`/api/v1/public/customer/orders`) reuses the same projection and the `public` preset, scoped to the logged-in customer's own orders (D13, P4-07, P6-12).

### 6.3 Draft source: payment-modal-v4 (D8)

payment-modal-v4 is used only in the new-order flow (`new-order-modals.tsx`), so **the order does not exist yet** and there is no `orderId` to fetch. The button therefore opens the view with `source = { kind: 'draft', draft }`:

- `OrderFinDraftInput` is built from figures **the modal and its engine have already computed**: items, extras, charges, discount lines, tax lines, total, planned tenders, credits, change due and balance. **The draft adapter does no arithmetic of its own.** This avoids a second source of truth for unsaved money.
- `mapOrderFinDraftToView(draft)` produces the same `OrderFinancialView` shape. Sections with no meaning before submission (refunds, receivable, vouchers, tax documents, order changes, timeline, reconciliation) are forced to `hidden`.
- The view shows a clear **"Preview — not yet saved"** badge (EN/AR).
- It is read-only. It opens from an **additional** button in the modal (a CmxDialog or side sheet) and closes back to the modal **without changing any modal state or entered amounts** (CRITICAL RULE #15).
- If payment-modal-v4 is later used for a saved order (for example Order Edit V2 settlement), the same button switches to `source = { kind: 'order' }`, with no new code.

---

## 7. Target architecture

```
DB (snapshot + fact tables, tenant-filtered)
  └─ lib/services/order-financial-view/                (server-only)
       ├─ sources/*.loader.ts          one loader per source; every query has an explicit tenant_org_id filter
       ├─ order-financial-view.service.ts   getOrderFinancialView(tenantId, orderId, {include, tier})
       ├─ order-financial-headers.service.ts getOrderFinancialHeaders(tenantId, orderIds[])   (batch, lists)
       └─ reuses: getOrderFinancialSummary (read model), order-financial-aggregation (math),
                  reconciliation order checks (warnings, BF-14)
       ├─ order-financial-view.public.ts    projectOrderFinancialViewForPublic (allowlist, D7)
  └─ src/features/orders/lib/map-order-financial-view.ts   pure mapper (Phase 1 fixed), shared server+client
  └─ src/features/orders/lib/map-order-fin-draft-to-view.ts  draft adapter for payment-modal-v4 (no arithmetic, D8)
  └─ Entry points (session tenant + permission tier):
       ├─ GET  /api/v1/orders/[id]/financial-view?preset=&sections=   (new)
       ├─ POST /api/v1/orders/financial-headers  {orderIds}           (new, batch ≤ 100)
       ├─ server action getOrderFinancialViewAction(orderId, config)  (new)
       ├─ GET  /api/v1/public/track/[token]/financial-view            (new, public projection only, D7)
       └─ GET  /api/v1/orders/[id]/financial-summary                  (kept, contract unchanged, BF-10 fixed)
  └─ src/features/orders/ui/order-financial-view/                (client)
       ├─ order-financial-view.tsx        <OrderFinancialView orderId | data  config />
       ├─ order-fin-header.tsx            configurable header (CmxKpiStatCard / badge)
       ├─ order-fin-section.tsx           section shell implementing the 5 modes
       ├─ sections/*.tsx                  one renderer per section (reuses existing panels)
       ├─ use-order-financial-view.ts     TanStack Query hook
       └─ invalidate-order-financial.ts   one helper called after payment, refund, edit or void
```

Principles:
- **Thin routes, logic in services** (Hard Truth #1 and #3). Loaders are independent, so each new source is one file.
- **One mapper, one formula.** No UI component does money arithmetic. Components format and lay out only.
- **Failure isolation.** If a non-header source fails, only that section shows an error. The header depends only on the snapshot. A stale or `RECALCULATION_REQUIRED` snapshot shows a banner and never shows silently wrong numbers.
- **Server or client.** Server pages can pass pre-fetched `data`. Client surfaces pass `orderId`, and the hook fetches with an include set derived from the config.

---

## 8. Phases and tasks

Every phase ends with three tasks: **(S)** update [STATUS.md](STATUS.md), **(D)** refresh the affected docs, **(Q)** add owner-runnable scenarios to the QA guide. Phase ends also invoke the `/documentation` skill. Required skills are loaded **before** writing (CLAUDE.md hard stop).

### Phase 0 — Discovery and decision freeze (no code)

| ID | Task |
|---|---|
| P0-01 | Remote DB MCP (read-only): confirm columns, FK paths and indexes for every §5 source. Especially `org_invoice_orders_dtl`, `org_fin_overpay_disp_dtl`, `org_loyalty_txn_dtl`, `org_fin_vouchers_mst`, `org_order_changes_mst`, `org_rcpt_receipts_mst`, and the cash-handling link. |
| P0-02 | Sample real data shapes: orders with multi-order invoices, a voided charge, a refund that reopens the balance, an overpayment disposition, loyalty redemption, an order change with a delta. These become the **golden fixtures**. |
| P0-03 | Inventory every UI surface that shows order money. Search `outstanding`, `total_paid`, `paid_amount` and the `financial` panels across `src/features` and `app/`. Classify each as migrate, keep (engine-owned) or out of scope (for example public tracking). |
| P0-04 | Compare mapper warnings with `lib/services/reconciliation/order-*-checks.ts` and decide the shared rule source (BF-14). |
| P0-05 | Public routes: read `GET /api/v1/public/track/[token]` (token validation, expiry, rate limiting) and `GET /api/v1/public/orders/[tenantId]/[orderNo]` (the guessable fallback). Confirm or close BF-16. Freeze the public allowlist (§6.2). |
| P0-07 | payment-modal-v4: list the engine outputs available for `OrderFinDraftInput` (§6.3), confirm the modal is only reachable pre-submit, and choose the button placement. Settles D8's shape. |
| P0-06 | Write ADR `ADR_Reusable_Order_Financial_View.md` (read-only scope, single mapper, tiered redaction, config contract). (S)(D) |

### Phase 1 — Fix existing bugs (the stack must be correct before reuse)

Skills: `/backend`, `/multitenancy`, `/frontend`, `/testing`.

| ID | Task |
|---|---|
| P1-01 | Write failing regression fixtures for BF-01, 02, 05, 08 and 11 using the P0-02 data shapes. |
| P1-02 | BF-11: replace every `snapshot.x \|\| fallback` with `??`, gated on `usedReadFallback`, in the service and mapper. |
| P1-03 | BF-01: use the snapshot charge fields first. Row fallbacks exclude voided rows. Voided rows stay visible as voided. |
| P1-04 | BF-02: compute `expectedOutstanding` through `computeOutstanding` with refund reopens. Add an equality test against the aggregation module. |
| P1-05 | BF-03 and BF-04: remove the `'OMR'` default (show an explicit "currency unknown" state). Use the currency-aware tolerance from `financial-tolerances.ts`. |
| P1-06 | BF-05 and BF-06: read rounding and pay-on-collection from the snapshot. Add the dropped facts to the view model (additive and backward compatible). |
| P1-07 | BF-07: add a service `getOrderArInvoices(tenantId, orderId)` that unions `org_invoice_orders_dtl` links with the legacy `order_id`, de-duplicated, and returns the per-order outstanding. The detail page shows all of them. |
| P1-08 | BF-08: filter gift cards by applied status. Remove the full page's own arithmetic in favor of the fixed mapper. The page itself is replaced in P6. |
| P1-09 | BF-09: make the read a server-only function. Pages call the service directly. The client-callable action resolves the tenant from the session and checks `orders:view_financial_breakdown`. Confirm whether `getOrderFinancialForReceiptAction` has any caller, then gate it or remove it. |
| P1-10 | BF-10: the route returns 404 for not-found and a generic message on 500, with the error logged server-side. |
| P1-11 | BF-13: carry the full tax-document chain in the view model (additive). |
| P1-14 | BF-17: translate payment status and settlement type through i18n keys that mirror the DB codes exactly (EN/AR). BF-18: use the order currency's decimal places (from the currency catalog) and theme tokens; pair every state color with text or an icon. |
| P1-13 | BF-16, if confirmed in P0: guard the public `tenantId/orderNo` fallback (require a token or a second factor, or strip money from its response) with a regression test. |
| P1-12 | Gates: `npx eslint . --quiet`, `tsc`, targeted jest, `npm run build`, `npm run check:i18n`. (S)(D)(Q) |

### Phase 2 — Database

Skills: `/database`, `/multitenancy`, `/code-documentation`.

| ID | Task |
|---|---|
| P2-01 | Using the P0-01 results, add any missing tenant-first indexes needed by the new loaders, for example `(tenant_org_id, order_id)` on link or fact tables. **No schema change is expected.** If none is needed, record "no migration" in STATUS. |
| P2-02 | ~~T3 permission seed~~. Not needed: no new permission code (D6). Kept as a placeholder so the task numbers stay stable. |
| P2-03 | Migration files are fully documented (`COMMENT ON` for every object), use the next seq, and use `RESTRICT` (never CASCADE). **Then stop and wait for the owner to apply and confirm.** |
| P2-04 | After the owner applies: `npm run prisma:pull` (`/pull-prisma`) if the schema changed. (S)(D) |

### Phase 3 — Backend read model

Skills: `/backend`, `/multitenancy`, `/architecture`.

| ID | Task |
|---|---|
| P3-01 | Contract types `OrderFinancialView` and `OrderFinSectionPayload<T>` (`ok` / `forbidden` / `error` / `empty`) in `lib/types/`. Constants in `lib/constants/` mirror DB codes exactly. |
| P3-02 | One loader per new source (overpayment, receivable, vouchers, loyalty, orderChanges, receipts, cashHandling if confirmed). Each query has an explicit `tenant_org_id` filter, including joins. |
| P3-03 | `getOrderFinancialView`: run only the loaders in the include set, in parallel; no permission logic (D10); build the timeline; produce warnings from the shared rule source (P0-04). |
| P3-04 | `getOrderFinancialHeaders(tenantId, orderIds)`: snapshot columns only, one query, cap of 100, for list and handover surfaces (BF-15). |
| P3-06 | `projectOrderFinancialViewForPublic` (§6.2): allowlist projection with a snapshot test of the exact allowed fields. A new view-model field must fail the test until it is explicitly classified as public or private. |
| P3-07 | `mapOrderFinDraftToView` (§6.3): maps engine outputs only. Tests prove draft totals equal the modal's own displayed totals for the same inputs. |
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
| P4-04 | `financial-summary` route keeps its contract unchanged (BF-10 fix only) and is marked "prefer financial-view" in the docs. |
| P4-05 | Update `orders-access.ts` apiDependencies, then run the golden path: `scaffold` → `derive --apply` → `wire --fix` → `check --wire` → `sync`. Then `/rebuild-platform-info-inventories` with surface=api. (S)(D) |

### Phase 5 — Frontend reusable component

Skills: `/frontend`, `/i18n`, `/storybook`, `/code-documentation`.

| ID | Task |
|---|---|
| P5-01 | Config types plus `resolveOrderFinDisplayConfig` with the preset matrix (§6), with unit tests. |
| P5-02 | Shared Cmx gap: no collapsible section exists in `src/ui`. Add `CmxCollapsibleSection` (accessible: `aria-expanded`, keyboard, RTL chevron) to `src/ui/data-display` with a story and a `.clauderc` snippet (CRITICAL RULE #17). |
| P5-03 | `OrderFinHeader`: metrics, emphasis, layouts (cards via `CmxKpiStatCard`, inline, compact, badge) and badges. |
| P5-04 | `OrderFinSection` shell implementing the 5 modes. One renderer per section, reusing the existing `order-financial/*` panels, which are refactored to take section payloads. |
| P5-05 | `OrderFinancialView` (accepts `orderId` or pre-fetched `data`), plus the `useOrderFinancialView` hook and `invalidateOrderFinancial(queryClient, orderId)`. Loading uses skeletons; errors are per section; empty and forbidden states are handled. Money is formatted with the existing currency-aware formatters, with no arithmetic. |
| P5-06 | i18n: EN and AR keys for every label, metric, mode toggle and state (reuse `orders.detail.financial.*` and `common.*` first). Verify RTL. Run `npm run check:i18n`. |
| P5-09 | `presetSwitcher` control (D9): a segmented control (for example Detailed / Full) that is accessible and RTL-safe, remembered per viewer in try/catch localStorage, with `?fin=` URL param support. |
| P5-10 | `source` handling (§6, `OrderFinSource`): `order` uses the hook, `data` renders directly, `draft` renders with the "Preview — not yet saved" badge and no fetch. The `public` preset ignores caller overrides that would reveal hidden sections. |
| P5-07 | Print layout (`layout='print'`) for report use, following the `*-rprt.tsx` naming. |
| P5-08 | Stories: every preset, mode, layout, RTL and dark mode, plus forbidden and error states. (S)(D)(Q) |

### Phase 6 — Pages and screens migration

Skills: `/frontend`, `/i18n`, `/navigation` (only if a route or menu changes).

| ID | Task |
|---|---|
| P6-01 | Order detail (`/dashboard/orders/[id]`): the financial tabs and summary cards use `<OrderFinancialView preset="detailed" presetSwitcher={['detailed','full']}>` (D9). Delete the page-level view-model assembly. |
| P6-02 | Full order page (`/dashboard/orders/[id]/full`): `preset="full"`. Retire `orders-financial-tab-rprt.tsx` arithmetic and the legacy shim in `full/page.tsx` (BF-08, BF-12). |
| P6-03 | Print reports (`order-payments-print-rprt`, `order-invoices-payments-print-rprt`) use `layout='print'`. |
| P6-04 | Pickup handover, delivery handover and the ready detail use `preset="totals"` from the batch or single reader (BF-15). |
| P6-05 | Collect-payment modal: header in badge or totals form (the host chooses the preset, D10), so till screens stay simple. |
| P6-06 | Order workspace screen and the delivery list or detail. |
| P6-07 | AR invoice detail: a linked-orders section uses `preset="summary"` per order. |
| P6-08 | Wire `invalidateOrderFinancial` after payment, refund, charge void, order edit apply and tax-document issue. |
| P6-09 | **payment-modal-v4 (D8):** add an additional "Order financial summary" button that opens `<OrderFinancialView source={{kind:'draft'}} preset="detailed">` read-only in a CmxDialog or side sheet. The engine, the existing sections and all entered amounts stay untouched. Closing returns to the modal with its state intact. Add an i18n label and a keyboard shortcut only if it does not clash with `use-payment-shortcuts.ts`. |
| P6-12 | **Customer portal (D13):** the customer's order screens render `<OrderFinancialView preset="public">` from the P4-07 endpoint. |
| P6-11 | **Public tracking (D7):** `order-tracking-page.tsx` replaces its own totals block with `<OrderFinancialView source={{kind:'data'}} preset="public">`, fed from the P4-06 endpoint on the token path. The `tenantId/orderNo` fallback follows the BF-16 outcome. |
| P6-10 | `npm run build`, `npx eslint . --quiet`, `tsc`, and a browser smoke test of each migrated surface in EN and AR. (S)(D)(Q) |

### Phase 7 — Verification and hardening

Skills: `/testing`, `/debugging`.

| ID | Task |
|---|---|
| P7-01 | Golden-fixture suite: for each P0-02 order, every displayed figure equals the snapshot, which equals the reconciliation result. |
| P7-02 | DB-integration tests on the local harness: tenant isolation for every loader, and the batch-header cap. |
| P7-03 | Performance: each preset fetches only its sources (assert the include set). The detail view loads in under 300 ms p95 on remote sample data. |
| P7-04 | Accessibility and RTL pass. Number direction and currency placement in AR. |
| P7-05 | Full owner QA run of the QA guide scenarios. (S)(D)(Q) |

### Phase 8 — Order Fin rules file, skill and Cursor rule (owner D5)

| ID | Task |
|---|---|
| P8-01 | Create `docs/dev/rules/order-fin-rules.md`. **Canonical rules for any Order Fin work:** the snapshot is the source of truth; one outstanding formula (D005, `computeOutstanding`); no UI arithmetic; `??` and never `\|\|` for money fallbacks; voided rows excluded from sums but visible; currency and tolerance come from the B15 sources and are never hardcoded; tenant filter in every query including joins; tier redaction on the server; the AR link goes through `org_invoice_orders_dtl`; no silent money mutation (#15); no maker-checker; constants mirror DB values; reuse `OrderFinancialView` and never build a new financial panel; invalidate after every money mutation; golden-fixture tests are required. |
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

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fixing BF-11 changes figures users have seen | That is intended: the old figures were wrong. Golden fixtures prove the correct values. Note it in the CHANGELOG and the QA guide. |
| Snapshot stale or `RECALCULATION_REQUIRED` | Show a banner. Never present fallback figures as final. |
| Too many queries in list surfaces | Batch header reader (P3-04). Hidden sections are never fetched. |
| Breakdown reachable by any `orders:read` user through the API | Accepted for now (D10, §6.1). Tiers can be added at the entry points later; the contract already reserves `forbidden` sections. |
| Public data leak | Allowlist projection applied at the public entry points regardless of config, plus snapshot tests (P3-06). |
| Migrating the full page breaks print output | P6-03 print layout plus a QA print scenario. |
| Scope creep into calculation changes | Non-goal (§1). Any calculation defect found is logged as a separate remediation package. |

## 10. Open items for owner review

Resolved: D6–D9 (round 2) and D10–D13 (round 3).

Still open: the service structure and the UI design choices in [DESIGN.md](DESIGN.md) §4.

## 11. Definition of done

- Every BF item is fixed with a regression test.
- Every §5 source is loaded, tenant-filtered and covered by tests.
- Every surface in the P0-03 inventory is migrated or explicitly excluded.
- lint, tsc, jest, build and i18n checks are green, and inventories are in sync.
- The rules file, skill and Cursor rule exist, and CLAUDE.md is updated.
- All P9 docs are updated, and the owner has completed QA.
