# Reusable Order Financial View — STATUS

**Plan:** [PLAN.md](PLAN.md)
**Overall:** APPROVED by owner 2026-10-23. In execution, with the combined order in [Line_Level_Money_Snapshot/STATUS.md](../Line_Level_Money_Snapshot/STATUS.md#execution-order-approved-2026-10-23). Mockup sign-off is still needed before P5.

| Phase | Title | Status | Notes |
|---|---|---|---|
| P0 | Discovery and decision freeze | ✅ Done 2026-10-23 (combined with Line-Level P0) | [PHASE0_FINDINGS.md](../Line_Level_Money_Snapshot/PHASE0_FINDINGS.md), [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md). Added BF-21, BF-22. P0-09 coordination agreed (findings §4). The public allowlist freeze (P0-05) is carried into P3-06 with the BF-16 outcome |
| P1 | Fix existing bugs (BF-01 … BF-20) | In progress | BF-09 ✅, BF-16 ✅, BF-20 ✅ (2026-10-23, security first). BF-19 moves to Line-Level Money P5-03. Must complete before P5 |
| P1B | One shared commercial calculator and Order Edit parity (EC-01 … EC-08) | Not started | Owner D25: mandatory. Must complete before P3-08 and P6-13 |
| P2 | Database (indexes / permission seed, if needed) | Not started | Stop and wait after each migration file |
| P3 | Backend read model | Not started | |
| P4 | APIs, endpoints, server actions, access contracts | Not started | |
| P5 | Frontend reusable component | Not started | |
| P6 | Pages and screens migration | Not started | |
| P7 | Verification and hardening | Not started | |
| P8 | Order Fin rules file, skill, Cursor rule | Not started | |
| P9 | Documentation update | Not started | |

## Log

- **2026-10-23 (P0 done, combined):** Discovery results are in [PHASE0_FINDINGS.md](../Line_Level_Money_Snapshot/PHASE0_FINDINGS.md); commercial-calculator decisions are in [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md).
  - **New:** BF-21 (Ready-order page and prints show 0 line totals) and BF-22 (overpayment allocation bypasses the snapshot).
  - **Confirmed:** EC-01/02/03/04/08 and LE-01.
  - **Changed:** the quote is a sibling route (PLAN §4 note).
  - **Coordination with Extend Order Edit Policy:** it has no open tenant-file work, so money files in `order-change/*` belong to RV-P1B / LL-P6, and policy files stay with Edit Policy.
  - The ADR for the view itself (pipeline, section contract, allowlist, access model) is still written at the start of P3.
  - No code changed.

- **2026-10-23 (exec-2): BF-20 fixed (systemic caller-supplied tenant in server actions).**
  - **Sweep:** a full scan (any parameter position) found 13 unguarded exports in 7 files.
  - **Shared guard** `lib/auth/server-action-guard.ts` → `resolveActionTenant({ action, expectedTenantId?, permission? })`:
    - the session supplies tenant and user
    - a caller tenant must match or the call fails with `TENANT_MISMATCH` (logged)
    - flat result; codes `UNAUTHENTICATED` / `TENANT_MISMATCH` / `FORBIDDEN`
  - **Guarded (signatures unchanged, callers untouched):**
    - `getOrder`, `getOrderByRef`, `listOrders`, `getStats` (`orders:read`)
    - `addOrderItems` (`orders:update`, same as `complete-preparation` on the prepare page)
    - `getOrderInvoices` (`orders:read`)
    - `validatePromoCodeAction` (session only)
    - `getCurrencyConfigAction`, `getCurrencyConfigOutcomeAction`, `getPhoneCountryCodeAction` (session only; the user-level override now uses the session user, not a caller `userId`)
    - BF-09's `getOrderFinancialAction` moved onto the same guard.
  - **Removed (dead endpoints, no callers):**
    - `getOrderForPrep`
    - `createInvoiceAction`, `getInvoiceAction`, `updateInvoiceAction`, `markAsPaidAction`, `applyDiscountAction`, `getInvoiceStatsAction` (money writes with no permission check, e.g. any tenant user could mark an invoice paid)
    - `applyPromoCodeAction`, `getPromoStatsAction` (promo usage is recorded by the submit path via `applyPromoCodeTx`)
  - **Prevention:**
    - `__tests__/security/server-action-tenant-guard.test.ts` fails if any `'use server'` export taking a tenant does not call the guard. Proven with a mutation probe. 3 justified exceptions are listed.
    - Rule doc `docs/dev/rules/server-action-tenant-guard.md`.
  - **Tests:** guard 7, per-action binding 26, repo rule 2, BF-09 5 → 40 pass; 29 related existing suites (184 tests) pass.
  - **Gates:** ESLint clean; `tsc` clean on changed files; UI access contract check PASS (166 routes); platform inventories show 6 pre-existing nav/contract warnings, unrelated.

- **2026-10-23 (exec-1): BF-09 and BF-16 fixed (security first, owner-approved order).**
  - **BF-09:**
    - `getOrderFinancialAction(orderId)` now takes only the order id; the tenant comes from the session.
    - Requires `orders:read`.
    - Returns generic codes (`UNAUTHENTICATED` / `FORBIDDEN` / `FETCH_FAILED`); internal errors are logged.
    - The unused `getOrderFinancialForReceiptAction` was removed; both order pages updated.
    - Test: `__tests__/actions/orders/get-order-financial-action.test.ts` (5).
  - **BF-16:** confirmed, and worse than suspected.
    - The readable `/public/orders/{tenantId}/{orderNo}` path returned customer name, phone, email, items and money to anyone guessing an order number.
    - Its page **redirected to the opaque token URL**, leaking the token.
    - Its `confirm-received` ran a workflow transition.
    - Retired, pre-launch: both legacy API routes answer a plain 404 with no DB or workflow access, and the page renders the standard localized "order not found" state.
    - `resolvePublicTrackingTokenByOrderRef` and `buildLegacyPublicTrackingPath` were removed. `getPublicTrackingPathForOrderId` has no readable fallback (callers: both order pages, receipt service).
    - All 5 orders have tokens, and the column defaults to 128-bit random.
    - Tests: `__tests__/api/public-orders-legacy-retired.test.ts` + updated service/util tests (29 total pass).
  - **BF-16 follow-up (mobile regression closed):** the customer mobile app's order detail (`cmx_mobile_apps/.../order_tracking_service.dart`) called the retired readable path. Added `GET /api/v1/public/customer/orders/[orderNo]?tenantId=…`:
    - the Bearer token is verified for the tenant via `resolveCustomerMobileSession`
    - the order is returned only if owned by the session customer (same tenant + phone, matching the list route); otherwise 404
    - same payload shape
    - the service is `getCustomerOwnedOrderTrackingResponse`
    - the app now calls it

    Tests: `__tests__/api/public-customer-order-detail.test.ts` (4) + 2 service tests; `dart analyze` clean.

    Opaque `/track/{token}` links are unchanged.
  - **BF-20 (new, H):** see PLAN §4.

- **2026-10-23 (v9):** Production-readiness review: PLAN v6, new §13 with PR-01…PR-26.
  - **Main additions:**
    - D36, domain-agnostic statement primitives in `src/ui`
    - P0-09, coordination with the active Extend Order Edit Policy program, which changes the same Preview, Apply and review files
    - HQ impact verified: generated DB types only. P2-05 covers type regeneration after any migration; P9-08 covers the HQ pointer.
    - API error, caching and limit standards (P4-09)
    - the contract Zod schema (P3-09)
    - edit concurrency (`ORDER_CHANGED`)
    - lifecycle states (cancelled, snapshot missing and others)
    - tenant timezone
    - WCAG 2.2 AA pass (P5-14)
    - observability (P7-06)
    - Playwright E2E (P7-07)
    - dead-code cleanup (P6-14)
    - decimal-only calculator math
    - a coverage bar
    - a release readiness checklist
  - No code changed.

- **2026-10-23 (P1B-01 done via Line-Level P1-01):** 55 characterization goldens freeze today's Create money (`web-admin/__tests__/characterization/create-money/`). They cover every P1B-01 case: manual percent and fixed, automatic rule, promo, auto-promo, `can_stack_with_promo`, tax profiles and CUSTOM, inclusive and exclusive, charges, cash rounding, gift card. The owner sign-off list is in [P1_01_CHARACTERIZATION.md](../Line_Level_Money_Snapshot/P1_01_CHARACTERIZATION.md). Next in the shared sequence: this plan's Phase 1 bug fixes.
- **2026-10-23 (dependency):** Phase 1B now depends on the separate plan [Line_Level_Money_Snapshot/PLAN.md](../Line_Level_Money_Snapshot/PLAN.md), which owns P1B-01 and P1B-03 (extended to line-level money for items and pieces). Pointer added in PLAN Phase 1B. No code changed.

- **2026-10-23 (v8):** Plan v5 and DESIGN v2. The owner put the `public` preset and the `edit` source in Release 1 and delegated everything else.
  - **External review (Cursor) evaluated.** Accepted items became D29–D35:
    - the release split, with the new §12
    - the line contract (`unit`, `role`, `countsInTotal`, `previousAmount`, `sourceKind`) in the new §6.6
    - one meaning per header metric, with `collected` and `payOnCollection` dropped, a short header, and "Due at collection" / "Due on invoice" hero wording
    - "Reconciled", never "Balanced"
    - no money on the Review button
    - loyalty is not a gate, and the refund/cancellation clawback is confirmed
    - no polishing of old panels; folder `order-fin-view`
  - **Corrections:**
    - BF-04 uses `MONEY_COMPARISON_TOLERANCE`, not `varianceToleranceFor`
    - BF-09 requires `orders:read`
    - BF-11 is verified
    - the permission-tier leftovers are removed
    - §7 is rewritten
    - `items` and `charges` replace the value breakdown
    - draft and edit use normalized section input
    - timeline partial label
    - perf timing measured after the indexes
    - P0-02 gets golden samples G1, G2 and E1
    - P0-08 gets checks (g) and (h)
    - new task P5-12 for shared money text
  - **Rejected review items, which conflict with owner decisions:** cash handling (D28) and leaving LE-01 unfixed (D27). Also rejected: the review's claim to override the plan.
  - **Mockup v10:**
    - G1 and G2 samples with consistent figures
    - informational lines and points kept out of the amount column
    - a short header and "Reconciled" wording
    - a "figures differ" toggle
    - an edit sample with the promo re-rated (was → now), a notes-only edit that never calls the server, and no money on Review
  - No code changed.

- **2026-10-23 (v7.2):** Owner decision D28: no cash-handling section. Removed `cashHandling` from the PLAN §5 sources, the section keys, the preset matrix, P0-01 and P3-02, from the DESIGN folder map, and from the mockup.

- **2026-10-23 (v7.1):** Owner decisions D26 and D27.
  - **D26, item price confirmation** (design delegated to Claude). It builds on the existing total-level `AMOUNT_MISMATCH` guard:
    - each line sends `confirmedUnitPrice`
    - the server rejects a changed price with `PRICE_CHANGED` and a per-line list
    - the cashier confirms the current prices and submits again; there is never an automatic resubmit.
  - **D27, loyalty earn on every settle path**, which closes LE-01: one reconciliation call used by checkout, later collection, Edit Apply, refund and cancellation. It posts an idempotent delta, serialized per order, and the balance never goes below zero.
  - Added P1B-14 and P1B-15, P0-08 (d)–(f) and two risks. No code changed.

- **2026-10-23 (v7):** The owner approved all four Order Edit calculation recommendations as D21–D24: recorded-discount policy; the rate recorded on the order; one new-line pricing rule with the price-list discount applied in both Create and Edit; loyalty points earned adjusted at Apply. The owner also made one shared commercial calculator mandatory (D25). Added Phase 1B (P1B-01…13) with Create characterization tests first, P0-08 parity discovery, new risks and a definition-of-done line. While checking D24, found that points are earned only in `settleOrderTx` at checkout, so "at completion" does not exist. Logged LE-01 (orders paid later appear never to earn) as an observation for the owner. Still awaiting mockup sign-off and plan approval. No code changed.

- **2026-10-23 (v6):** Traced the Order Edit calculation. Edit Preview ignores recorded discounts and order charges, taxes before discounts, uses today's VAT rate without tax profiles, and skips cash rounding. Apply's snapshot check is expected to reject money-changing edits on discounted or charged orders. Logged EC-01…EC-08 and the target "re-price commercial, keep settlement" rule in PLAN §6.5 as a prerequisite for the live edit card (P6-13). Four owner decisions pending.
- **2026-10-23 (v5.1):** Mockup gained Source → "Order edit (live)": an edit cart with +/− quantity, the Review button bound to the quoted total, and a live card or badge with the "Updating…" state, outcomes (to collect, fully paid, refund or credit due, can't apply), a BF-19 comparison note, and Details opening the detailed view with "Pending changes".
- **2026-10-23 (v5):** The owner asked for a live total card under the Order Edit Review button. Added D20 and §6.4: an `edit` source fed by the existing Order Edit preview in a debounced quote mode, with no client money math. Added BF-19: the cart "Total" on the Review button is a pre-tax, pre-discount subtotal. Added tasks P3-08, P4-08, P5-11, P6-13.
- **2026-10-23 (v4):** The owner delegated the structure and UI questions. Decided D14–D19 (DESIGN.md §4): money-statement backbone, four groups with items and charges split, neutral colors, lines with `lineCap`, the five-step pipeline. Published the interactive mockup (https://claude.ai/artifact/Kc2iHiAdb47pJFzn1mjXaC). Awaiting owner review of the mockup before implementation approval.
- **2026-10-22 (v3):** Owner round-3 decisions D10–D13 applied: the component and service are permission-agnostic (entry points keep session tenant plus `orders:read`); public view shows tender totals by method; payment-modal preset `detailed`; customer portal in scope. Added BF-17 (raw status codes shown) and BF-18 (tenant decimals and hardcoded colors). Structure and UI proposal written to DESIGN.md, under discussion.
- **2026-10-22 (v2):** Owner round-2 decisions D6–D9 applied: no new permission; public-safe view on the token path only; draft source for payment-modal-v4 (the order is unsaved there); detail page default `detailed` with a switch to `full`. Added BF-16 (guessable public fallback path, to verify in P0). Four open items remain (PLAN §10).
- **2026-10-22:** Analysis done and plan drafted. 15 defects/gaps identified (PLAN §4). Owner decisions D1–D5 recorded. Four open items await owner review (PLAN §10).
