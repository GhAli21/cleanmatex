# Reusable Order Financial View — STATUS

**Plan:** [PLAN.md](PLAN.md)
**Overall:** ✅ Engineering complete 2026-11-01 (P0–P9). Owner steps left: QA run ([QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)), live E2E run, commit. APPROVED by owner 2026-10-23. In execution, with the combined order in [Line_Level_Money_Snapshot/STATUS.md](../Line_Level_Money_Snapshot/STATUS.md#execution-order-approved-2026-10-23). Mockup sign-off is still needed before P5.

| Phase | Title | Status | Notes |
|---|---|---|---|
| P0 | Discovery and decision freeze | ✅ Done 2026-10-23 (combined with Line-Level P0) | [PHASE0_FINDINGS.md](../Line_Level_Money_Snapshot/PHASE0_FINDINGS.md), [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md). Added BF-21, BF-22. P0-09 coordination agreed (findings §4). The public allowlist freeze (P0-05) is carried into P3-06 with the BF-16 outcome |
| P1 | Fix existing bugs (BF-01 … BF-22) | ✅ Done 2026-10-23 (code bugs) | BF-01/02/03/04/05/06/07/09/10/11/13/16/20/21/22 ✅. BF-08 shared path ✅ (full page retired in P6-02). BF-12/15/17/18 are closed by the new view (D35). BF-14 decided in P3 (shared rule source). BF-19 → Line-Level P5-03. New BF-23 (tenant from `tenants[0]` in 32 routes) is its own package |
| P1B | One shared commercial calculator and Order Edit parity (EC-01 … EC-08) | ✅ Done 2026-10-31 | Owner D25: mandatory. Must complete before P3-08 and P6-13. ✅ P1B-01 (Line-Level P1-01), P1B-03 (Line-Level P4), P1B-14 Create part (Line-Level P5-03d), P1B-04/06/07/08/09 (Line-Level P6-01, 2026-10-28), P1B-14 Edit part (Line-Level P6-02e, 2026-10-30), P1B-05 and P1B-11 (2026-10-30). Partly: P1B-12 (Edit parity DB proof; line controls added in Line-Level P6-02f, 2026-10-30), P1B-13 (WP08 pointer). Open: P1B-10, P1B-15 |
| P2 | Database (indexes / permission seed, if needed) | ✅ Done 2026-10-31 (migration 0679 applied local + remote) | P2-01 receipts index (0679); P2-02 not needed (D6); P2-04 Prisma pulled; P2-05 types regenerated in both repos by the owner (index only, no HQ type change) |
| P3 | Backend read model | ✅ Done 2026-10-31 | ✅ P3-01 contract types; ✅ P3-09 full-view schema; ✅ config resolver + presets; ✅ P3-02 all sources (migration 0681 applied); ✅ P3-03 `getOrderFinancialView` (all sections, timeline, shared warnings BF-14); ✅ P3-04 `getOrderFinancialHeaders` (batch ≤100); ✅ P3-06 public projection + strict public schema (P3-09 complete); ✅ P3-07 draft mapper; ✅ P3-03b statement adds up (rounding line, tax-inclusive, total check); ✅ P3-08 edit mapper (card = Review = saved after Apply, DB-proved); ✅ P3-05 tests (normalizer unit tests, golden fixture view = writer snapshot = reconciliation) |
| P4 | APIs, endpoints, server actions, access contracts | ✅ Done 2026-10-31; P4-05 contracts done 2026-11-01 | Staff view, batch headers, server action, public tracking, customer portal, Edit quote; one error envelope + no-store; rate limits |
| P5 | Frontend reusable component | ✅ Done 2026-10-31 | Shared CmxCollapsibleSection, CmxMoneyText, statement primitives; OrderFinancialView (4 sources), header, statement, preset switcher, live Edit quote hook + card, print report; i18n EN/AR |
| P6 | Pages and screens migration | ✅ Done 2026-11-01 (browser smoke = owner QA, [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)) | Order detail, full page, prints, handovers, collect-payment, workspace, delivery, AR invoice, payment-modal button, Edit live card, public tracking, customer app; legacy panels deleted |
| P7 | Verification and hardening | ✅ Done 2026-11-01 (P7-05 owner QA run and the E2E run against a live environment are owner steps) | Golden fixture, security cases, timing guard (p95 42 ms), observability, a11y built in, Playwright spec |
| P8 | Order Fin rules file, skill, Cursor rule | ✅ Done 2026-11-01 | `docs/dev/rules/order-fin-rules.md`, `/order-fin` skill, `.cursor/rules/order-fin.mdc`, CLAUDE.md rows |
| P9 | Documentation update | ✅ Done 2026-11-01 | README (+ implementation checklist), developer and user guides, CHANGELOG 1.0.0, root pointers, glossary, `.clauderc`, HQ pointer |

## Remaining work (re-checked 2026-10-31)

The combined order lives in [Line-Level STATUS → Remaining work](../Line_Level_Money_Snapshot/STATUS.md#remaining-work-consolidated-2026-10-24-re-checked-2026-10-30). Phase 1B, P2 and P3 are done. Left in this plan:

| Phase | Left | Migration |
|---|---|---|
| P7 | Owner steps only: P7-05 QA run of [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md); run `e2e/order-financial-view.spec.ts` with `E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD`, `E2E_FIN_ORDER_ID` | None |

**Open findings to carry:** the preview's overpaid figure ignores cash change returned (P3-08); the stale banner must key on `snapshotStatus` (P3-04); the legacy `order-value-breakdown.tsx` shows overlapping extras until P6 retires it.

**Own package (security):** BF-23 → [API_Route_Auth_Hardening](../../API_Route_Auth_Hardening/PLAN.md), implemented 2026-10-30; QA and follow-ups in its STATUS.

## Log

- **2026-11-01 (P9 done: documentation — plan complete):** folder `README.md` (doc map + P9-03 checklist: no new permissions, navigation, settings, flags, plan limits or env vars; routes, rate limits, migrations 0679/0681/0686, constants, i18n, shared UI, HQ, mobile), `developer_guide.md`, `user_guide.md` (EN/AR terms), `CHANGELOG.md` 1.0.0, `version.txt`; Order_Fin root: README quick links, IMPLEMENTATION_STATUS section, CHANGELOG entry, developer-guide pointer, the enhancement spec marked "implemented by"; glossary terms `order_balance`, `order_settled`, `order_overpaid`, `figures_reconciled` (EN/AR, matching the catalog); `.clauderc` `order_financial_view`; HQ pointer in `cleanmatexsaas/docs/features/Order_Edit_V2/WP05-B_HQ_PROGRESS.md`; inventories synced (P4-05); memory updated.
  - **Reusable Order Financial View: all phases P0–P9 done.** Owner steps: run [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) in EN/AR at phone, tablet, desktop and A4; run `e2e/order-financial-view.spec.ts` against a live app; commit (web-admin, HQ, mobile).

- **2026-11-01 (P4-05 done: access contracts) — with an incident, repaired:**
  - `derive:ui-access-contract --feature=orders --apply --refresh-extract` added the new routes to the page contracts, but it also **rewrote 18 existing requirement blocks** (for example New Order `priceOverride` `pricing:override` → `orders:read`; Edit `payment-quote` `orders:create` → `orders:read`; full-page recalc `orders:post_settlement_edit`; preparation transition `orders:transition` → `orders:update`; ready overpayment toggle `orders:overpayment_allocate`; delivery drivers) and left duplicate `requireAllPermissions` keys, and it misread template strings (`/financial-view[id]`, `/changes/quote[id]`, quote as GET, both as auth-only; `routes${query`, `my-active[id]`).
  - **Repair:** every rewritten block restored to its HEAD permission where it existed at HEAD; the 6 entries new since HEAD (`/orders/[id]/state` ×5, `/orders/issues`) checked against their routes (`requirePermission('orders:read')`) — correct; duplicates removed; the new routes corrected by hand (`GET /financial-view` and `POST /financial-headers` with `orders:read`, `POST /changes/quote` with `orders:edit`); malformed paths removed. A cleanup script of mine then over-matched and removed five whole route contracts (`/dashboard/ready/[id]`, `/dashboard/delivery`, `/delivery/[id]`, `/delivery/routes/[id]`, `/delivery/routes/[id]/stops/[stopId]`); they were restored from HEAD and the wire audit passes for all five (any uncommitted edit made to those five contracts after HEAD is not in them — the audit found no mismatch with the code). Verification: a permission diff against HEAD shows no remaining change except the earlier BF-23 auth-only note on `/api/v1/categories`; `tsc` clean; `page-access-registry` tests 5/5; `check:ui-access-contract --feature=orders --wire` OK except the pre-existing `/dashboard/orders/[id]/prepare` page-gate failure (not touched here); `sync:ui-access-contract` ✓.
  - Hand-added: `financial-view` on `/dashboard/ready/[id]` and `/dashboard/delivery/[id]`; `financial-headers` on `/dashboard/internal_fin/invoices/[id]` (billing contract) with a note — a user with `invoices:read` but not `orders:read` sees "—" in the Order balance column.
  - **Lesson (also in the `/order-fin` skill pitfalls):** review a `derive --apply` diff before trusting it; it can rewrite existing requirements.
  - Owner follow-up (not this program): `/dashboard/orders/[id]/prepare` has no page gate.

- **2026-11-01 (P8 done: rules, skill, Cursor rule):** `docs/dev/rules/order-fin-rules.md` (25 canonical rules: one source of truth, one calculator, one outstanding formula, no UI arithmetic, cash rounding only on change, one component, line roles, header words, order currency, `??` for money, unavailable never zeros, tenancy and public projection, no tiers, no maker-checker, invalidate after writes, golden tests) and its index row; skill `.claude/skills/order-fin/SKILL.md` (component and preset cheat-sheet, routes, server data flow, checklists for a source / section / metric, pitfalls learned in this program); `.cursor/rules/order-fin.mdc` (path-scoped short form); CLAUDE.md: hard-stop table, mandatory skill table, Skills Reference and the Cursor rule list.

- **2026-11-01 (P7 done: verification and hardening):**
  - **P7-01 golden fixtures and lifecycle (PR-09):** golden DB order (writer snapshot = view = reconciliation, P3-05) plus UI tests for every lifecycle state: never written ("unavailable", never zeros), recalculating (bar + badge), cancelled (bar), unknown currency (said, never guessed), section error (Retry).
  - **P7-02 security (PR-15):** cross-tenant order → 404 on every route and the action; a smuggled `tenantId` in the action is refused; tenant from the token on the public route; the customer portal matches tenant **and** customer (DB-proved); CSRF on `financial-headers` and the quote POST; rate limits with `Retry-After`; public allowlist leak tests (P3-06).
  - **P7-03 performance:** each preset loads only its sources (resolver tests, DB test of the registry); measured on the local harness: `audit` view (every source) **p95 42 ms** over 20 runs, guarded in `order-fin-view-sources.db.test.ts` (< 300 ms).
  - **P7-04 / P5-14 accessibility and RTL (built in):** native buttons with `aria-expanded`/`aria-controls`, 44 px targets, Radix dialogs (focus trap and return), `aria-live` on confirmed quote figures only (off while pending), spoken signs, `prefers-reduced-motion`, theme tokens for contrast in light/dark, `<bdi dir="ltr">` numbers in Arabic, mirrored chevrons; keyboard row toggling in the E2E spec. Screen-reader walkthrough is part of the owner QA run.
  - **P7-06 observability (PR-13):** per-source load timing (`Order fin view sources loaded`, debug), quote latency (`Order edit quote served`, info), "figures differ" counter (`Order fin view figures differ`, warn, codes only); ids only, no customer data, IP never logged on public routes.
  - **P7-07 E2E:** `e2e/order-financial-view.spec.ts` (statement visible EN/AR, preset switch remembered, keyboard toggling, envelope + no-store, unknown preset 400, made-up id 404). Not run here: needs a live app and credentials (skips cleanly without them).
  - Tests: route tests 15 (CSRF on quote added), UI 11 (lifecycle added), DB 6 — all pass.

- **2026-11-01 (P6 done: the screens):**
  - **P6-01 order detail:** the header strip is a header-only view (every section hidden → only the snapshot row is read); the *Financial summary* tab is `OrderFinancialView` `detailed` with the **Detailed / Full** switch, the AR-collection and tax-document action panels beside it.
  - **P6-02:** the *Financial details* tab and the full page's Financial tab are the `full` view (full page also `audit`). `orders-financial-tab-rprt.tsx` (its own arithmetic, BF-08/BF-12) is retired; its only action, **Void charge**, moved to `order-charges-void-panel.tsx` so nothing was lost.
  - **P6-03:** the payments and invoices-and-payments print reports print the statement under them (`OrdersFinancialStatementRprt`, print layout).
  - **P6-04 / P6-06:** ready detail, delivery detail and the order workspace show the `totals` view. Two browser computations removed: the workspace's `total − paid − credits` fallback and the hand-built money card.
  - **P6-05:** the collect-payment modal shows the balance badge under its title.
  - **P6-07:** AR invoice → Orders tab: column *Order balance*, all linked orders in **one** batch request (`useOrderFinancialHeaders` → `POST /financial-headers`; new `OrderFinBalanceBadge`; key `invoices.ar.detailTabs.columns.orderBalance` EN/AR).
  - **P6-08:** `useOrderMoneyRefresh` (router refresh + `invalidateOrderFinancial`) after payment verify/transition, refund, charge void, tax-document issue, AR collection, collect payment and order actions; Edit Apply invalidates too. Cache helpers live in the light `order-fin-view-cache.ts` (no auth import), found when `order-actions.test` broke on the import chain.
  - **P6-09:** payment-modal-v4 header button **Financial summary** → read-only draft statement from the modal's own quote and engine figures (`OrderDraftFinancialSummaryButton`); nothing is written back. `OrderFinDraftInput` legs accept the engine's optional `method`.
  - **P6-11:** public tracking renders the server's public statement (P4-06); the page's `total − paid` fallback is gone (balance from the server).
  - **P6-12 (customer app, `cmx_mobile_apps`):** order detail shows the server statement (P4-07). Found and fixed: the screen showed balance = total − paid, **ignoring credits**. Model, service, provider, card, EN/AR, 4 tests; mobile milestone plan row 10.
  - **P6-13 (owner request D20):** the Edit live card under the Review button (`OrderEditFinancialCard` via the workspace session's `financialCard` slot). The card quotes through **its own controller** loaded with the same baseline, so a quote can never clear the Review controller's issued proof; it skips the server for edits that change no money. D33: the review-status message no longer prints totals as raw strings.
  - **P6-14 cleanup (proof: search + green build):** deleted `orders-financial-tab-rprt.tsx`, `order-financial-summary-cards.tsx`, `order-value-breakdown.tsx`, `order-settlement-summary.tsx`, `order-financial-warning-banner.tsx` (no callers left). Kept for now: the legacy view-model mapper (the AR-collection, tax-document, payments-tables and invoice-tab panels still read it) → retire with those panels in Release 2.
  - **P6-10:** ESLint (0 errors), `tsc`, `npm run build` ✓; full unit suite 538/540 suites — the two failures were `order-actions` (fixed, test now provides the query client) and the known pre-existing `platform-inventories` nav/contract drift. Mobile: `flutter analyze` clean, order tests 6/6. **Browser smoke at 360 px / tablet / desktop / A4 in EN and AR is the owner QA run** — scenarios in [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md).

- **2026-10-31 (P5 done: the shared component):**
  - **Shared UI (`src/ui/data-display`, `.clauderc` snippets):** `CmxCollapsibleSection` (button with `aria-expanded`/`aria-controls`, 44 px target, RTL-mirrored chevron, reduced motion), `CmxMoneyText` (explicit currency + decimals, BF-18; sign as a glyph with a spoken label; `<bdi dir="ltr">` keeps sign and digits together in Arabic; unknown-currency state; tones from theme tokens; struck for not-counted), and the statement primitives `CmxStatement` / `CmxStatementGroup` / `CmxStatementRow` (modes total / expandable / expanded / detail) / `CmxStatementLine` / `CmxStatementLineList` (line cap with Show all / Show less). No order types, no translations inside. Stories: `cmx-statement.stories.tsx` (default, draft, RTL, dark, print, money-text states).
  - **Feature (`src/features/orders/order-fin-view/`):** `ui/order-financial-view.tsx` (sources `order` | `data` | `draft` | `edit`; only `order` fetches, in a child component, so public and draft views need no staff session — found and fixed while writing the story: the first cut called `useAuth` for every source, which would have crashed the public tracking page); `ui/order-fin-header.tsx` (hero + status word, ≤ 3 metrics, payment status / settlement / "Reconciled · Figures differ · Recalculating" / edit outcome badges, `badge` layout); `ui/order-fin-statement.tsx` (groups and rows in the resolved order and mode, Expand / Collapse all, only `additive` money in the amount column, included / informational / points / was → now in the text, not-counted lines struck with a chip, section error with Retry, "None" in full/audit, closing Total and balance rows taken from the header); `ui/order-fin-labels.ts`; `ui/order-fin-money.tsx`; preset switcher (`CmxTabs`; `?fin=` → remembered per route in try/catch localStorage → caller preset); banners (recalculating, cancelled, unavailable, currency unknown) and the warnings list (the five existing texts reused from `orders.detail.financial.warning.*`).
  - **Data:** `api/order-fin-view-api.ts` (envelope → `OrderFinApiError` with code / reason / Retry-After), `hooks/use-order-financial-view.ts` (key `['order-fin-view', tenant, order, preset, sections]`, `staleTime: 0`, refetch on focus/reconnect, `invalidateOrderFinancial(queryClient, orderId)`), `hooks/use-order-edit-financial-quote.ts` (P5-11: no request for an edit that changes no money — `orderChangeNeedsPricing`, now in the browser-safe `lib/services/order-change/order-change-priced-ops.ts` that the server Preview also uses; 500 ms debounce; abort; last confirmed figures kept; status derived in render, no set-state-in-effect). The Edit controller gained `quote(orderId, { preset, signal })` (same body and headers as Preview).
  - **Edit card:** `ui/order-edit-financial-card.tsx` (new total, was + difference, balance after the change, outcome chip, Updating… / refusal reason / Try again, Details dialog with the full statement of the same quote; announces confirmed figures only). **Print:** `ui/orders-financial-statement-rprt.tsx` (`layout: 'print'`, every row open, all lines).
  - **i18n:** `messages/{en,ar}/orders/finView.json` (133 keys, AR plural forms), `check:i18n` ✓.
  - Tests: `order-financial-view.ui.test.tsx` (10, real EN catalog, a missing key fails), `use-order-edit-financial-quote.test.ts` (5). 57 view feature tests pass; ESLint, `tsc`, `npm run build` ✓.
  - **Left for P7 (named, not skipped silently):** a feature-level Storybook story for `OrderFinancialView` needs a next-intl decorator in `.storybook/preview.ts` (the shared primitives have stories); the a11y walkthrough with screen readers (P5-14) is part of the P7-04 pass.

- **2026-10-31 (P4 done: APIs, server action, public routes, Edit quote):**
  - **Shared (P4-09, PR-05/06/22):** `ORDER_FIN_API_ERRORS` (`VALIDATION_FAILED`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `CSRF_REJECTED`, `ORDER_NOT_FOUND`, `ORDER_CHANGED`, `EDIT_SESSION_INVALID`, `QUOTE_REJECTED`, `RATE_LIMITED`, `INTERNAL_ERROR`) and `lib/api/order-fin-view-http.ts`: one envelope `{ success:false, error:{ code, messageKey: orders.finView.errors.<code>, reason? } }`, `Cache-Control: no-store` on every response, guard/429 mapping with `Retry-After`, a uniform public 404. Zod: `orderFinViewRequestSchema` (preset whitelist; `sections=key:mode,…` with known keys/modes only, no duplicates; unknown params ignored), `orderFinViewConfigSchema` (strict object, action), `orderFinHeadersRequestSchema` (1–`ORDER_FIN_HEADERS_MAX` UUIDs; the constant moved to `lib/constants/order-fin-view.ts`). New rate limits: `editQuoteUser` 120/min per user, `publicFinancialView` 60/min per IP (IP never logged). Public cap `ORDER_FIN_PUBLIC_MAX_BYTES` = 64 KB (over → 404, never a cut view).
  - **P4-01** `GET /api/v1/orders/[id]/financial-view` (`orders:read`, session tenant, 404 cross-tenant, generic 500).
  - **P4-02** `POST /api/v1/orders/financial-headers` (CSRF, `orders:read`, 16 KB body cap).
  - **P4-03** `getOrderFinancialViewAction(orderId, config)` (`app/actions/orders/get-order-financial-view.ts`): session guard, strict config (a smuggled `tenantId` is refused), flat result with the route codes.
  - **P4-04** `financial-summary` unchanged; its JSDoc points new screens to `financial-view`.
  - **P4-06** `GET /api/v1/public/track/[token]/financial-view`: tenant + order from the token only; `public` preset + server projection always (no display options); every refusal the same 404. **P4-07** `GET /api/v1/public/customer/orders/[orderNo]/financial-view?tenantId=` (Bearer): the order must match the session tenant **and** the session `customerId` (stronger than the phone match of the existing detail route). Both via `lib/services/order-fin-view/public-view.service.ts`.
  - **P4-08** `POST /api/v1/orders/[id]/changes/quote?preset=totals`: CSRF, `orders:edit`, per-user limit, the live edit-session lock, the same request schema and calculation as Preview, no review proof. Returns `{ status, view }` (`READY`, `DENIED`, …) with the view built on the server (`edit-view.service.ts` → `getOrderEditQuoteView`). Engine refusals: 409 `ORDER_CHANGED` / 422 `QUOTE_REJECTED` with `reason` = the engine code. Preview and Quote now share `runOrderChangePreview` (`lib/services/order-change/order-change-preview-run.ts`), so they cannot drift; Preview's behaviour is unchanged (its route test passes). The saved-order load is shared too (`loadSavedOrderFinSourceSet`). Shortcut: the quote still loads the preview's audit facts (same path as Review, correct by construction); trim only if P7-03 timing shows a need.
  - **P4-05:** inventories rebuilt (`rebuild:platform-info-inventories` ✓; 6 pre-existing nav/contract drift warnings on unrelated pages). The new routes enter the inventory through page contracts' `apiDependencies` once P6 screens call them, so derive/wire/check/sync runs with P6.
  - Tests: `__tests__/api/v1/orders/order-fin-view.routes.test.ts` (14: guards, validation, envelope, no-store, cross-tenant 404, CSRF, caps, rate limits with Retry-After, edit session, engine refusal reasons, uniform public 404, tenant from token, tenant+customer ownership, action whitelist). DB: public projection + ownership on the golden order; the edit parity proof now goes through `getOrderEditQuoteView`. `tsc` clean.

- **2026-10-31 (P3-05 done — Phase 3 complete):**
  - `__tests__/services/order-fin-view/normalize.test.ts` (12): a snapshot never written is null; stored figures and base currency; the tax-mode ladder; every stored status → line state (payments incl. `REVERSED`, legacy credits with no status = applied, refunds, tax documents, vouchers, adjustments, receipts); records informational, loyalty in points, voided charges kept as voided; receivable = the order's own share with voided invoices marked; an unloaded source has no facts; checks run the shared rules (writer total formula, aggregation with active credits only, live invoices only, line drift flagged, header-total fallback skipped); included parts only on calculator orders with item rows.
  - DB golden fixture (`order-fin-view-sources.db.test.ts`): an order written by the real snapshot writer (`recalculateOrderFinancialSnapshotTx`) with items, delivery charge, order discount, VAT, a completed cash payment, a failed card payment and a wallet credit. The `audit` view's header equals the stored columns (total 10.975, paid 5, credits 1, balance 4.975), no warnings (aggregation and writer formula agree), the statement adds up, and every section's counted lines equal its total; the failed card line is shown but not counted. Tenant isolation per source and the cross-tenant 404 were already proved there (P3-02/P3-03). 6 DB + 19 unit pass.
  - Note: a test payment without `payment_nature_snapshot` or a method code is not counted by the aggregation (`isClearlyRealPaymentRow`) — correct by design; fixtures now set it.

- **2026-10-31 (P3-08 done: edit mapper for the Order Edit live card):**
  - **Shape (decided):** the live card's quote route (P4-08) builds the view **on the server**: saved source set (`normalizeOrderFinSources`) + `editQuoteFromPreview(preview)` → `mapEditQuoteToSourceSet` → the same builders. The browser receives a finished view, as with `kind: 'data'`. Reason: the per-component breakdown lives in the preview's server-only `commercial` result (the HTTP preview omits it), and `context.financial` on the client has only total / net collected / outstanding / overpaid, too little for the statement.
  - `editQuoteFromPreview` (`lib/services/order-fin-view/edit-quote.ts`, server only) reads the same preview result the Review dialog reads and Apply stores. Value parts on the snapshot writer's basis: items = item gross, discount = line + order discounts, charges = net, tax = Σ tax lines, included extras and speed premium as on Create, tax mode from the calculator. Header: `originalTotal`, `projectedTotal` as returned, `totalDelta` = Apply's own `commercialDelta` (`subMoney` → `toMoneyString`), outcome as the service emits it. Paid, credits, balance and overpaid come from the preview's financial result (`effectivePayments`, `effectiveCredits`, `outstandingAmount`, `unresolvedOverpayment`). NO_CHANGE returns null (the card shows the saved order).
  - Discount lines: each recorded order discount (`discountChanges`) with `previousAmount` → `amount`; a REMOVED one is a `voided` line at zero; an order discount the edit added has no previous amount; line discounts are one line (`orders.finView.lines.lineDiscounts`, i18n in P5).
  - `mapEditQuoteToSourceSet(saved, quote)` (`src/features/orders/order-fin-view/edit/`, pure): the quote replaces the value side and its facts (charges keep their saved label by id; pre-edit item lines are not shown), total, paid, credits, balance, overpaid and AR receivable. Settlement facts (payments, credits, refunds…) stay as saved. Dropped for the projection: saved reconciliation checks and mismatch count, engine version, hash, trace id, and the base-currency total (unknown until Apply). An unpriced edit (notes, dates) keeps the saved value side. No saved snapshot stays "unavailable".
  - Contract: `OrderFinEditQuote`, `OrderFinSourceSet.edit` (was → now for the header), `OrderFinFactInput.previousAmount`. The header fills `originalTotal`, `projectedTotal`, `totalDelta`, `projectedBalance` and `editOutcome` only for the edit source.
  - Tests: `map-edit-quote-to-source-set.test.ts` (8): was → now and balance from the quote; statement adds up; discount was → now lines; settlement facts kept; unpriced edit; overpayment; AR receivable; missing snapshot; edit metrics absent for saved; card = Review dialog figures (`readEditReview`). **DB proof** added to `order-change-edit-parity.db.test.ts`: on every applied edit (≥ 15: notes, quantity, add/remove line, preferences, order and line speed, line price, line discount, custom line, promo removal), the card built before Apply equals the Review dialog figures and, section by section (items, charges, discounts, taxes, rounding, included lines, total, balance, paid), the saved order's view after Apply. Counted discount lines add up to the discount total. 42 unit + DB pass, plus the order-change and view service suites (24); ESLint, `tsc` and `npm run build` clean.
  - **Finding — corrected 2026-10-31 (owner question): not a gap.** First written as "Order Edit applies no cash rounding", which was wrong. By design (owner decision 2026-10-02, A6-1b, `cash-change-rounding.service.ts`) the order total rounds only to the currency's own decimals (`ACCOUNTING` rules: all 181 active rules on remote use 1 minor unit), and cash rounding applies only to the change handed back on a cash tender (`CASH_CHANGE` / `CASH_TENDER` rules), recorded as a `CASH_CHANGE_ROUNDING` adjustment voucher; the order and non-cash tenders stay exact. Edit therefore needs no cash rounding. The only residue: Create still applies the `ACCOUNTING` rule to the total (always a 0 difference, saved in `rounding_adjustment_amount`), Edit does not; they could differ only if HQ set an `ACCOUNTING` rule coarser than the minor unit, which is a misconfiguration. **Guarded 2026-10-31 (owner):** migration 0686 + HQ API/form check (Line-Level STATUS log); Create's dead rounding step → Line-Level P10-04.

- **2026-10-31 (speed premium shown as included — Claude's decision, owner delegated):**
  - Why: the speed (express) premium sits inside the item price (gross = base + premium + included extras), so it was invisible, and "why does this cost more?" is the first question on an express order. Same pattern as the extras, no new math.
  - `OrderFinSnapshotInput.speedPremiumIncluded: number | null` → line `items-speedPremiumIncluded` (`orders.finView.lines.speedPremiumIncluded`, i18n in P5), `role: 'included'`, before the extras line. Saved: Σ live items' `speed_premium_amount` on calculator orders (older orders: no line). Draft: new optional quote field `speedPremiumIncludedAmount` = calculator `speedPremiumTotal`.
  - Tests: assemble (both lines, order, not counted), draft (1.25 + 0.75 from the quote), checkout quote (0 at standard speed), DB (express premium 1 from the item rows). 376 suites (3574 tests) + 5 DB pass; ESLint and `tsc` clean. Build: the previous build passed; a fresh build with this change was started.
  - Legacy summary panel (`order-value-breakdown.tsx`) left as is: P6 replaces it with the view.

- **2026-10-31 (extras fix: one "Extras included" line, owner-approved):**
  - The two `included` lines (piece extras, preference extras) are replaced by one: `orders.finView.lines.extrasIncluded` (i18n in P5). `OrderFinSnapshotInput.pieceExtras/preferenceExtras` → `extrasIncluded: number | null` (null = not known, no line; never zero).
  - **Saved:** on calculator orders (`commercial_calc_version` set, now in `ORDER_FIN_CORE_SELECT`) = Σ live items' `service_pref_charge`, which the calculator writes as `includedModifierAmount` (inside `total_price`: gross = base + speed premium + included extras, `lib/commercial/line-pricing.ts`). Computed in `normalizeOrderFinSources` only when the item rows were loaded (detail modes, where the line shows). Older orders: no line, rather than the overlapping columns.
  - **Draft:** the checkout quote now returns `extrasIncludedAmount` = Σ the calculator's line `includedModifierAmount` (`commercial-checkout.service.ts`; additive, optional on `OrderCalculationResult` and `ServerTotals`; the legacy `calculateOrderTotals` does not set it = unknown). It reaches the modal through `payment-quote.service.ts` (`...financials.totals`) with no route change. `mapDraftToSourceSet` maps it to `extrasIncluded`.
  - The stored `piece_extra_price_amount` / `preference_extra_price_amount` columns are no longer read by the view (still loaded for the legacy summary service, unchanged).
  - Tests: assemble (one line; none when unknown), draft (0.75 from the quote), checkout quote (`extrasIncludedAmount` 0.2 for the STARCH line), DB (calculator order: one line 0.75 from item rows while the stored columns say 0.5/1; older order: no line; `totals` preset: no lines). 376 suites (3573 tests) + 5 DB pass; ESLint and `tsc` clean.
  - Note: the legacy order summary panel (`order-value-breakdown.tsx`) still shows the overlapping columns; it is retired by P6 (the view replaces it), so it is not patched.

- **2026-10-31 (P3-07 limits followed up):**
  - **Overpayment — fixed.** `OrderFinDraftInput.unresolvedOverpaymentAmount` (engine `payExtra.unresolvedExcessAmount`) → `snapshot.overpaid`. Same meaning as the saved `overpaid_amount` (`computeOverpaidAmount`: excess not returned as change and not disposed to wallet/advance). An unresolved excess now reads "Overpaid", a resolved one "Settled". Test added; 32 unit pass; ESLint and `tsc` clean.
  - **Extras split — the saved view's own extras lines were wrong (fixed, owner-approved; see the next entry).**
    - `piece_extra_price_amount` = Σ piece `service_pref_charge`, and each piece's `service_pref_charge` is the sum of its PIECE-level rows in `org_order_preferences_dtl` (`order-service.ts` create path, `order-charge.service.ts` void path). `preference_extra_price_amount` = Σ ALL `org_order_preferences_dtl.extra_price` (ITEM and PIECE). So piece extras are a **subset** of preference extras: the two "included" lines show piece-level extras twice (e.g. "Piece extras 0.500 · Preference extras 1.000" when the extras are 1.000 in all).
    - On calculator orders a SEPARATE-placed extra is a charge, not part of the item price (writer comment, `order-financial-write.service.ts` ~L582), yet its preference row still feeds `preference_extra_price_amount`, so the "included" line can also show money that is really in Charges.
    - Lines are informational (`countsInTotal: false`), so no total is wrong, but the breakdown misleads.
    - Proposed fix: one "Extras included" figure that is exactly what sits inside the item prices: the calculator's `includedModifierAmount` (stored per item as `org_order_items_dtl.service_pref_charge` on calculator orders). Saved: from the items rows (detail modes load them already); legacy orders (no `commercial_calc_version`): no extras line rather than a wrong one. Draft: the quote returns the same calculator figure (additive field on the payment-quote response — approved by the owner 2026-10-31).

- **2026-10-31 (P3-03b done: the statement adds up — rounding line, tax-inclusive pricing, total check; owner-approved):**
  - Problem: the statement could not add up. (1) `snapshot.rounding` was loaded but never shown, so any order with cash rounding was off by the rounding. (2) `tax_pricing_mode` was not loaded, so a tax-inclusive order added its tax on top of prices that already hold it (off by the whole tax).
  - **Rounding:** new section `rounding` in the value group, after `taxes` (`ORDER_FIN_SECTION_KEYS`, `ORDER_FIN_SECTION_GROUP`, sources, presets). Always `total` mode, never expanded; `empty` (not shown) when zero. The line carries the size and the direction like every other line: `amount = |rounding|`, `sign` minus or plus. Built in `build-special-sections.ts`.
  - **Tax-inclusive:** `OrderFinSnapshotInput.taxPricingMode` (never null). Saved orders: the order's own `tax_pricing_mode` column (calculator orders), else `taxPricingModeAtCalculation` that the snapshot writer recorded in `financial_calculation_snapshot` (older orders: all 68 local orders have a null column), else `TAX_EXCLUSIVE`, the platform default (`orderTaxPricingMode` in `normalize.ts`). Draft: the quote's server-resolved `taxPricingMode`. When inclusive, the tax total and default-role tax lines are `role: 'included'`, `countsInTotal: false` ("VAT included"), the same rule as the piece/preference extras. The header `tax` metric is unchanged.
  - **Total check (one rule source):** `computeOrderFinChecks` runs the snapshot writer's own `resolveCanonicalTotalAmount` on the stored parts into `checks.expectedTotal` (skipped when the writer fell back to the header total). `build-warnings` raises the existing `ORDER_TOTAL_COMPONENT_MISMATCH` (warning, header-level, `messageKey: totalComponentsMismatch`, params expected/stored) when the stored total differs. It catches rows changed outside the writer.
  - **Public view (owner-approved):** `rounding` is in `ORDER_FIN_PUBLIC_SECTION_KEYS` and the `public` preset (`total`), so the customer's statement adds up too.
  - Tests: `statement-identity.test.ts` (7): the counted value totals, signed, equal the total for exclusive, rounding down, rounding up, tax-inclusive (saved and draft) and a rounded draft; the warning fires only on a real difference. DB test (new case): null column + writer record TAX_INCLUSIVE → tax included, rounding line minus 0.050, no warning; a drifted total raises the warning with expected 10.5 / stored 12. Public allowlist test updated. 305 suites (3109 tests) pass; 4 DB pass; ESLint and `tsc` clean.
  - For P5: i18n keys `orders.finView.sections.rounding`, `orders.finView.warnings.totalComponentsMismatch`, and the "included" wording on the tax row.

- **2026-10-31 (P3-07 done: draft mapper for payment-modal-v4):**
  - `OrderFinDraftInput` (`lib/types/order-fin-view.ts`): the server quote fields the modal shows (`subtotal`, the three order discounts, `vatValue` + `additionalTaxAmount`, `taxBreakdown`, `chargesTotal`, `roundingAdjustmentAmount`, `saleTotal`) plus the engine's `useMoneyDerivations` outputs under their own names (`realPaymentEntries`, `customerCreditEntries`, `payNowAmount`, `customerCreditAmount`, `remainingBalance`) and `giftCardSettlementAmount`, `displayChangeAmount`. P6-09 copies them as they are.
  - `mapDraftToSourceSet(draft)` in `src/features/orders/order-fin-view/draft/` (pure, browser-safe). The only sums regroup figures the quote and engine return split, the same way the server forms them: discount = manual + rule + promo, tax = VAT + other tax, credits = credit legs + gift card. Balance and change come from the engine, never recomputed.
  - Lines: discounts carry fixed i18n keys (`orders.finView.lines.manualDiscount` / `autoRuleDiscount` / `promoDiscount`, to add in P5), taxes the profile names, payments and credits one line per leg, plus a `GIFT_CARD` credit line. Charges show their total only (the quote has no charge lines). `OrderFinFactInput` gained `labelKey`.
  - Test `__tests__/features/orders/order-fin-view/map-draft-to-source-set.test.ts` (4) runs the real `useMoneyDerivations` hook: header equals the quote and the engine (total, paid, credits, balance, tax, discount); counted lines add up to each section total; change due and settled state from the engine; the pre-submit sections stay hidden under `full`. ESLint and `tsc` clean.
  - **Gap found (fixed same day in P3-03b):** the view had no rounding line, for saved orders too: `snapshot.rounding` is carried but no section or header metric shows it. With cash rounding, items + charges − discount + tax differs from the total by the rounding. P5 must add a rounding line under the total (like the modal) before the statement ships.
  - Next in P3: P3-08 edit mapper, P3-05 remaining tests.

- **2026-10-31 (P3-06 done: public projection; P3-09 public schema; P0-05 allowlist frozen):**
  - `projectOrderFinancialViewForPublic(view)` in `lib/services/order-fin-view/projections/public.projection.ts` (server only, pure). An allowlist: each field is copied only when named.
    - Kept: schema version, order number, currency and decimals, currency-known, generated time, header metrics `total/paid/credits/balance/refunded/discount/tax`, balance state, payment status code (the UI shows its customer label), and the sections `items/charges/discounts/taxes/credits/refunds/payments` with their totals.
    - Payments go out as per-method tender totals of the counted lines (D11): "Cash 5.000, Card 3.000"; pending rows and references dropped.
    - Always dropped: order id, order status, snapshot status, settlement type, edit outcome, base currency and rate, warnings, counts, warning codes, previous amounts, line dates, references, status codes, and every other section (vouchers, debug, reconciliation, timeline…).
    - Figures go out only when the snapshot is `CURRENT` or `LOCKED`. Any other status (`RECALCULATION_REQUIRED`, `MISMATCH`, `STALE`) gives "Financial data unavailable" to the customer, never provisional numbers (follows from the P3-04 finding: the column defaults make most never-calculated rows look written).
  - The allowlists are constants: `ORDER_FIN_PUBLIC_HEADER_METRICS`, `ORDER_FIN_PUBLIC_SECTION_KEYS` (`lib/constants/order-fin-view.ts`); the `public` preset and resolver read the same list.
  - `orderFinancialPublicViewSchema` (`lib/validations/order-fin-view-schemas.ts`): strict objects at every level, so any unknown or private field fails. The projected view also passes the full-view schema, so the one component renders it (D7).
  - Test `__tests__/services/order-fin-view/public-projection.test.ts` (7): every field of the view, header, section, line and line meta is classified public or private (compile-time `satisfies` + runtime against the Zod shapes), so a new field fails until someone classifies it; the public schema allows exactly the public fields; the public preset shows exactly the allowlisted sections; the richest `audit` view projects with no reference, hash, trace, base currency, ids or internal status in the JSON; tender totals; non-healthy snapshots show nothing; seven leak shapes rejected. 31 unit pass; ESLint and `tsc` clean.
  - Not wired to any route yet: P4-06 (track token) and P4-07 (customer portal) call it.
  - Next in P3: P3-07 draft mapper, P3-08 edit mapper, P3-05 remaining tests.

- **2026-10-31 (P3-04 done: batch header reader):**
  - `getOrderFinancialHeaders(tenantId, orderIds)` in `lib/services/order-fin-view/order-fin-headers.service.ts`: one `findMany` (tenant + `id in`), snapshot columns only (the calculation JSON is left out), order currency decimals through the `sys_currency_cd` relation in the same query. No detail sources, no warnings. Returns `Record<orderId, OrderFinHeaderView>`; ids not in the tenant are left out; duplicates ignored; more than 100 distinct ids is a `ValidationError` (never silently cut).
  - `OrderFinHeaderView` type (the view without sections and warnings). `buildOrderFinHeaderView` in `vwbuilders/assemble.ts` builds envelope + header for both the full view and the batch reader, so the two cannot drift.
  - Finding: `org_orders_mst.financial_engine_version` defaults to 1 and `financial_snapshot_status` to `RECALCULATION_REQUIRED`. So the "never written → no figures" rule only catches rows with an explicit NULL; a row nobody calculated shows its figures with status `RECALCULATION_REQUIRED`. The P5 stale banner (PLAN risk table) must key on `snapshotStatus`, not on figures being absent.
  - Tests: DB test (written, never-written, default/stale row, duplicates, unknown id, other tenant empty, empty input, cap 101 throws). 3 DB + 24 unit pass; ESLint and `tsc` clean.
  - Next in P3: P3-06 public projection + strict schema, P3-07 draft mapper, P3-08 edit mapper, P3-05 remaining tests.

- **2026-10-31 (P3-03 done: records sections, timeline, shared warnings):**
  - 0681 verified applied on remote (`idx_fin_vouchers_tenant_order`, `idx_invoice_tenant_order`; old voucher index gone, `idx_org_invoice_order` kept).
  - Records sections through the same spec table (`vwbuilders/build-sections.ts`): tax documents, vouchers, order changes and receipts are `informational` lines; loyalty lines are `unit: 'points'`; none count toward a money total. Records sections have no snapshot total, so they show counts. Line states from the stored statuses (`TAX_DOCUMENT_STATUSES`, `VOUCHER_STATUS`, the `org_order_adjustments_dtl.status` CHECK values).
  - `vwbuilders/build-special-sections.ts`: currency (base-currency total, informational), reconciliation (warning count, stored mismatch count, codes), debug (hash, trace id, engine version as refs), timeline (every dated fact, oldest first, `partial` when an event source was not loaded or failed).
  - **BF-14 decided and built:** one rule source. The reconciliation checks are batch, DB-bound functions, so the view does not call them; both now go through the shared aggregation module. `normalize.ts` `computeOrderFinChecks` runs `aggregateOrderFinancials` (same `is_active` row set as `runOrderBalanceChecks`) for expected outstanding and credits, the order's share on live AR invoices, and the §6.6 line-consistency check (items, discounts, taxes; charges left out because legacy orders exclude item-level PREFERENCE rows from `total_charges_amount`). `vwbuilders/build-warnings.ts` only compares those with the snapshot, with the shared tolerance. Rules and codes carried over from the legacy mapper; new code `SECTION_LINES_MISMATCH` in `ORDER_FINANCIAL_WARNING_CODES`. Each warning also marks its section (`warningCodes`).
  - The missing-AR-invoice warning fires only when the receivable source was loaded, so a `totals` view never reports a false "no invoice".
  - Tests: 24 unit (records, timeline order and partial, warnings and section markers, AR rules) + 2 DB (end to end, the shared aggregation flags a stored balance with no payment rows). 78 existing order/financial suites (673 tests) still pass. ESLint and `tsc` clean.
  - P3-03 complete. Next in P3: P3-04 `getOrderFinancialHeaders` (batch, snapshot only), then P3-06 public projection + strict schema, P3-07 draft mapper, P3-08 edit mapper, P3-05 remaining tests.

- **2026-10-31 (P3-03 part 1: getOrderFinancialView for value and settlement sections):**
  - Normalized input added to the contract: `OrderFinSnapshotInput`, `OrderFinFactInput`, `OrderFinSourceSet` (`lib/types/order-fin-view.ts`). The draft and edit mappers (P3-07/P3-08) will produce the same set.
  - Builders in `src/features/orders/order-fin-view/vwbuilders/` (owner-chosen name; DESIGN said `build/`, which a local permission rule blocks): `build-sections.ts` (one spec table drives items, charges, discounts, taxes, payments, credits, refunds, overpayment, receivable; totals from the snapshot, lines from facts, `countsInTotal` from the state; a failed source keeps its snapshot total with `status: 'error'`; zero total and no lines → `empty`) and `assemble.ts` (header metrics, `balanceStateFor`, envelope).
  - P0-08(h) answered from the writer: `items_base_amount = Σ item total_price` with extras already inside it, so piece and preference extras are `role: 'included'`, `countsInTotal: false`.
  - Server: `lib/services/order-fin-view/normalize.ts` (rows → facts; line state from the stored status via `ORDER_PAYMENT_LIFECYCLE_STATUSES`, `CREDIT_APPLICATION_STATUSES`, `REFUND_STATUSES`; payments carry only `••last4`, never gateway refs; receivable uses the order's own share per invoice) and `order-fin-view.service.ts` (`getOrderFinancialView(tenantId, orderId, resolved)`: core first, then the required sources plus the currency minor unit in parallel; `NotFoundError` for another tenant).
  - A snapshot never written (`financial_engine_version` null) gives no sections and an empty header ("Financial data unavailable"); the old read fallback is not used.
  - Zod: dropped `satisfies z.ZodType<OrderFinancialView>` (web-admin `strict:false` makes `.nullable()` read as optional, so it can't hold); recorded as a `shortcut:` comment. The typed-fixture schema tests still guard the shape.
  - Known limit: the discount loader (`getDiscountLinesForOrder`) returns live rows only, so voided discounts aren't shown yet (PLAN §5 wants them marked).
  - Tests: `__tests__/features/orders/order-fin-view/assemble.test.ts` (7, G1 fixture); DB test adds `getOrderFinancialView` end-to-end (currency decimals from the catalog, voided charge not counted, other tenant 404). 20 unit + 2 DB pass; ESLint and `tsc` clean.
  - Next: P3-03 part 2: records sections (tax documents, vouchers, loyalty, adjustments, order changes, currency, receipts), timeline, and the shared warning rules (BF-14).

- **2026-10-31 (DB integrity findings handed off):** the schema-wide issues found during P2/P3-02 (87 composite tenant FKs with `ON DELETE SET NULL`, 105 single-column FKs between tenant tables, 318 FKs without an index, 128 prefix-redundant + 36 duplicate index sets, dead charge-type aliases, no delivery-fee capability) are written up for a separate package in [DB_Integrity_Hardening/FINDINGS.md](../../DB_Integrity_Hardening/FINDINGS.md). Not part of this program.

- **2026-10-31 (P3-02 done; migration 0681 written, waiting for the owner to apply):**
  - 0680 verified applied on remote (FK `fk_ocd_charge_type`, 7 catalog codes, old CHECK gone; Prisma relation present).
  - New sources, one file each in `lib/services/order-fin-view/sources/`: `items` (live lines, `rec_status = 1`, stored line money), `overpayment` (`org_fin_overpay_disp_dtl`), `receivable` (invoice links → invoices, invoice payments, AR credit allocations), `vouchers` (by `order_id` plus those referenced by payments, credits and refunds), `loyalty`, `orderChanges` (history fields only), `receipts` (no content columns). Every query filters by tenant; the receivable and voucher lookups run in two tenant-filtered steps, never a cross-table join. The registry now covers every source (`satisfies Record<…>`).
  - Index check of every view source on remote: only `org_fin_vouchers_mst` and `org_invoice_mst` lacked a tenant-first order index (Phase 0 missed them). Migration `0681_fin_view_tenant_order_idx.sql`: `idx_fin_vouchers_tenant_order` (partial, replaces `idx_fin_vouchers_order`; the voucher FK is composite so it is covered) and `idx_invoice_tenant_order` (partial; `idx_org_invoice_order` stays because `fk_org_invoice_order` is single-column `order_id` and cascades by it). `org_order_items_dtl.idx_org_items_order` also stays for the same reason.
  - **Finding for the owner (not fixed here):** 89 composite FKs that include the required `tenant_org_id` use `ON DELETE SET NULL`, which CLAUDE.md bans (the delete would fail on a NOT NULL tenant column); 11 are on tables this view reads (e.g. `fk_fin_voucher_order`). Fixing one would leave the rest inconsistent; it needs its own package (PG 15+ `ON DELETE SET NULL (col)`).
  - DB test extended: all 15 sources run against the real schema with no error, a `DELIVERY` charge row is accepted (0680), and another tenant gets nothing from any source. ESLint and `tsc` clean.
  - Next: P3-03 `getOrderFinancialView` (builders, header, timeline, warnings), after the owner applies 0681.

- **2026-10-31 (charge types, owner request; migration 0680 written, waiting for the owner to apply):**
  - Correction to the P3-02 part 1 finding: delivery and service charges are meant to be charge rows. The snapshot writer already buckets `DELIVERY`/`SERVICE` rows into `delivery_charge_amount`/`service_charge_amount`, but the hard-coded CHECK rejected them, so those buckets were always 0.
  - `0680_order_charge_types_catalog.sql`: seeds `DELIVERY` (Delivery Fee / رسوم التوصيل), `SERVICE` (Service Charge / رسوم الخدمة), `OTHER` (Other Charge / رسوم أخرى) into `sys_charge_types_cd`; drops `org_order_charges_dtl_charge_type_check` (RESTRICT); adds FK `fk_ocd_charge_type` → `sys_charge_types_cd(charge_type)`, so a new type needs only a catalog row. No existing rows conflict (remote has no charge rows).
  - `CHARGE_TYPES` (`lib/constants/order-financial.ts`) gained `DELIVERY`, `SERVICE`, `OTHER` (DB mirror). No code writes them yet; nothing enumerates the whole constant.
  - Not in scope: a screen or API to add a delivery fee to an order. After apply: `prisma:pull` (new relation), then P3-02 part 2.

- **2026-10-31 (P3-02 part 1: source infrastructure + existing tables):**
  - `lib/services/order-fin-view/sources/`: `core.source.ts` (`ORDER_FIN_CORE_SELECT` + `loadOrderCore`; adds `status` for the cancelled banner), `settlement.sources.ts` (charges, discounts, taxes, payments, credits, refunds, tax documents, adjustments; raw rows, explicit `tenant_org_id` filter each), `registry.ts` (`loadOrderFinSources`: requested keys only, in parallel, a failure is isolated to its key with `SOURCE_LOAD_FAILED` and logged).
  - D18 split done: `getOrderFinancialSummary` now calls these loaders and keeps its own mapping, so the queries exist once. No behaviour change: 10 summary-related suites (100 tests) pass.
  - The existing tables share one file (`settlement.sources.ts`) instead of one file each: they are 8 short queries; each new table gets its own file.
  - Found: `org_order_charges_dtl.charge_type` allows only `PREFERENCE`, `EXPRESS`, `BULK_SURCHARGE`, `SPECIAL_HANDLING`. Delivery and service charges live only in the snapshot columns, so the `charges` builder must combine snapshot columns with the rows.
  - The view will not use the summary's read fallback: a snapshot never written shows "Financial data unavailable" (PR-09), never re-derived figures.
  - Test: `__tests__/db-integration/order-fin-view-sources.db.test.ts` (real DB, rolled back): core row, requested sources only, voided charge kept, another tenant gets nothing. ESLint and `tsc` clean.
  - Next: P3-02 part 2, the new sources (items, overpayment, receivable, vouchers, loyalty, orderChanges, receipts).

- **2026-10-31 (P3 config resolver done):**
  - `src/features/orders/order-fin-view/config/`: `presets.ts` (the §6 matrix and §6.2 public preset; header hero `balance` plus at most three), `section-sources.ts` (section → data sources; a snapshot-backed section in `total` mode loads only `core`), `resolve-display-config.ts` (`resolveOrderFinDisplayConfig(config, sourceKind)` → `ResolvedOrderFinDisplayConfig` with `requiredSources`).
  - Rules enforced: `public` cannot be widened (sections, header metrics, warnings, switcher); a draft hides the §6.3 sections and loads nothing; edit-only metrics are dropped for other sources; section order is completed without loss or duplicates; `audit` and `print` show every line.
  - Choices: `receivable`, `taxDocuments`, `vouchers`, `loyalty`, `adjustments`, `orderChanges`, `receipts` and `timeline` have no snapshot total, so their source loads even in `total` mode. Empty sections show by default only in `full` and `audit` (DESIGN §2.6).
  - `ORDER_FIN_DATA_SOURCES` + `ORDER_FIN_DEFAULT_LINE_CAP` added to `lib/constants/order-fin-view.ts`; `OrderFinDataSource` + `ResolvedOrderFinDisplayConfig` to the contract.
  - Test: `__tests__/features/orders/order-fin-view/resolve-display-config.test.ts` (9 pass). ESLint and `tsc` clean for these files.
  - Next in P3: the sources (P3-02), starting with `core`.

- **2026-10-31 (P3-01 done, P3-09 full-view schema done):**
  - Location decided: the contract lives in `lib/types/order-fin-view.ts` (P3-01, PR-24: framework-free, reusable by `cmx-api`). The feature `model/` folder will re-export, not redefine. PLAN §6's "types live in the feature `model/`" is superseded by this.
  - `lib/constants/order-fin-view.ts`: section, group, mode, status, metric, balance-state, preset, source-kind and line enums, plus `ORDER_FIN_VIEW_SCHEMA_VERSION = 1`. UI configuration only; DB codes pass through as stored.
  - `lib/types/order-fin-view.ts`: `OrderFinLine`, `OrderFinSectionPayload<T>`, `OrderFinHeaderPayload`, `OrderFinancialView`, `OrderFinHeaderConfig`, `OrderFinancialDisplayConfig`. Additions over DESIGN: `orderStatus` (cancelled banner, PR-09), `header.balanceState` (the hero word, D31), `header.editOutcome` (exact service code), section `partial` (timeline). `currency.code` is nullable with `currencyKnown`.
  - `FinancialWarning` moved into the contract; `src/features/orders/model/order-financial-summary-view.ts` re-exports it (callers unchanged).
  - `lib/validations/order-fin-view-schemas.ts`: Zod schema for the full view (rejects a section stored under another key). The strict public schema ships with the public projection (P3-06).
  - Test: `__tests__/validations/order-fin-view-schemas.test.ts` (4 pass; pins the edit outcome codes to `OrderChangeFinancialOutcome`). ESLint clean; `tsc` clean for touched files and the warning importers.
  - Next in P3: config resolver + presets, then the sources (P3-02).

- **2026-10-31 (P2 done):** the owner applied 0679 to local and remote, regenerated types in both repos and pulled Prisma. Verified: remote has `idx_rcpt_receipts_tenant_order (tenant_org_id, order_id)` and no `idx_rcpt_receipts_order`; `schema.prisma` maps the new index. P2-05: index only, so no HQ type change (HQ pointer is P9-08). Next: P3 read model.

- **2026-10-31 (P2-01 written; waiting for the owner to apply 0679):**
  - Remote DB check of the read-model sources: only `org_rcpt_receipts_mst` lacked a tenant-first order index (it had `order_id` alone), as Phase 0 found.
  - Migration `0679_rcpt_receipts_tenant_order_idx.sql`: adds `idx_rcpt_receipts_tenant_order (tenant_org_id, order_id)` and drops the replaced `idx_rcpt_receipts_order` (RESTRICT). Index only, no schema change. The one by-order receipt query (`receipt-service.ts`) already filters by tenant.
  - `org_loyalty_txn_dtl`: no index needed, `idx_loyalty_txn_order (tenant_org_id, order_id)` exists. Its single-column `account_id` FK is a schema change outside P2; left as is.
  - P2-02: no permission seed (D6). After apply: P2-04 `npm run prisma:pull` (the `@@index` map changes), P2-05 HQ type regeneration (index only, so "no HQ type change" is expected).

- **2026-10-31 (P1B-13 done, Phase 1B complete):** Order Edit V2 Open Decisions gained D21–D24 (as built); its Test Guide gained OC-CALC-011–018 and a §21 evidence table. Next: P2.

- **2026-10-31 (P1B-12 done):** parity suite complete: cart quote = Create snapshot, and a removed promo with real usage rows is given back. Found and fixed: customer booking did not record promo usage. Phase 1B left: P1B-13. Details in the [Line-Level STATUS log](../Line_Level_Money_Snapshot/STATUS.md#log).

- **2026-10-31 (P1B-10 done):** Edit Apply's loyalty points change is traced to the order change (`ORDER_EDIT` + change id). Phase 1B left: P1B-12, P1B-13. Details in the [Line-Level STATUS log](../Line_Level_Money_Snapshot/STATUS.md#log).

- **2026-10-31 (P1B-15 done, LE-01 closed):** loyalty points now follow the order on every money change: paid later, edited, refunded or cancelled. One request from the snapshot recalc plus workflow cancel; the outbox consumer posts the delta, never below zero. Details in the [Line-Level STATUS log](../Line_Level_Money_Snapshot/STATUS.md#log). Next: P1B-10.

- **2026-10-31 (P1B-15 started):** migration 0676 adds the earn rate and the clawback shortfall to the loyalty ledger; it is waiting for the owner to apply it. The reconcile request is emitted from the one snapshot recalculation every money path already calls, plus workflow cancel. Design in the [Line-Level STATUS log](../Line_Level_Money_Snapshot/STATUS.md#log).

- **2026-10-30 (P1B-11 done):** the Review dialog lists every recalculated discount line by line and asks for one acknowledgement per removal (EN/AR, Cmx). Details in the [Line-Level STATUS log](../Line_Level_Money_Snapshot/STATUS.md#log). Next: P1B-15, then P1B-10.

- **2026-10-30 (P1B-05 done):** recorded rule and promo discounts are re-checked on Edit (D21) and reported as `discountChanges[]`; a removal needs an acknowledgement before Apply, and a removed promo gives its use back. Details in the [Line-Level STATUS log](../Line_Level_Money_Snapshot/STATUS.md#log). `existingDiscountPolicy` stays null: D21 is the platform default, and tenant-configurable policy stays reserved for the Edit Policy program (PR-03). Next: P1B-11 (the Review list and the acknowledgement).

- **2026-10-30:** Line-Level P6-02f extended the Edit parity DB proof (P1B-12 part) to line speed, line price, line discount, custom lines and the shown price; it found and fixed a change-history check that refused those line edits (migration 0664).
- **2026-10-30:** P1B-14 Edit part done as Line-Level P6-02e. Edit lists changed prices in Review instead of rejecting (reason in the Line-Level log).

- **2026-10-30 (owner decisions):** mockup signed off (P5 unblocked); BF-23 runs in the owner's other session; demo orders deleted and the work committed and deployed by the owner. No code changed here.

- **2026-10-30 (remaining work, docs only):** added the "Remaining work" section above, matching the consolidated list in Line-Level STATUS. No code changed.

- **2026-10-28 (P1B-04/06/07/08/09 done in Line-Level P6-01):** Edit preview and apply now price on the shared calculator. Details in [Line-Level STATUS](../Line_Level_Money_Snapshot/STATUS.md) (P6-01a–e).
  - **P1B-04:** `commercial-edit.loader.ts` reads the order's recorded discounts, charges, tax lines and stored line prices.
  - **P1B-06:** tax comes from the order's recorded tax lines and profile rows (D22). Orders from before the calculator are refused for money edits (`ORDER_NEEDS_RECOMPUTE`), as the owner approved.
  - **P1B-07:** a new line uses the same price resolver as Create, on the edit date (L24).
  - **P1B-08:** Preview, Apply and the stored rows all come from one calculated order. Apply replaces the discount, charge and tax rows (old ones voided or inactivated), and the rollup must equal the reviewed total.
  - **P1B-09:** a header-only edit is not re-priced (EC-08).
  - **Partly P1B-12:** `order-change-edit-parity.db.test.ts` proves Create parity and Preview = Apply = rollup on real PostgreSQL for 9 edit kinds. The quote route side follows in P1B-08's live-quote work.
  - **Partly P1B-13:** the Order Edit V2 active index points here and WP08 is marked replaced; D21–D24 in the Open Decisions doc and the Test Guide scenarios are still to do.
  - **Kept for later:** recorded discounts are re-applied as recorded (a percent again, a fixed amount kept). Re-evaluating them is P1B-05, with the review disclosure in P1B-11.

- **2026-10-23 (exec-3): Phase 1 bug fixes (combined step 4).**
  - **BF-11 (root cause):** `buildEffectiveOrderFinancialSnapshot` treated a stored 0 as missing and recomputed it from rows. It now takes `snapshotWritten` (`financial_engine_version` set). A written snapshot is the authority, zeros included. Rows are used only for a snapshot the engine never wrote (remote DB: all 11 orders are written). The service's own `||` fallbacks and its duplicate refund classifiers were removed. The unwritten-snapshot overpaid fallback uses `computeOverpaidAmount` (subtracts change returned). A written zero taxable amount stays 0.
  - **BF-01:** voided charge rows never count, in the effective snapshot and in the mapper. The mapper reads the snapshot charge fields first (`??`).
  - **BF-02:** the read model carries `expectedOutstandingAmount` (D005 `computeOutstanding` with refund reopens); the mapper no longer re-derives it, so a reopened refund raises no false mismatch.
  - **BF-03:** already fixed (no `'OMR'` default; the currency stays blank when unknown).
  - **BF-04:** `MONEY_COMPARISON_TOLERANCE`.
  - **BF-05:** rounding and pay-on-collection come from the snapshot.
  - **BF-06:** pending, authorized and failed payments, real-payment refunded, stored-value restored, customer credit issued, change returned and voucher references are in the view model (additive).
  - **BF-07:** `getInvoicesForOrder` unions `org_invoice_orders_dtl` links with the legacy `order_id` (de-duplicated, tenant-filtered) and carries the order's share (`order_invoiced_amount`, `order_outstanding_amount`). The detail page uses `selectOrderArInvoices`: the primary invoice is the newest one with a balance; all of them are in `arInvoices`. The remote DB has no invoices yet.
  - **BF-10:** the service throws `NotFoundError`; the route answers 404 `ORDER_NOT_FOUND`, and a generic 500 that is logged and never echoed.
  - **BF-13:** the full tax-document chain is in `taxDocuments` (`mapOrderTaxDocumentChain`).
  - **BF-21:** the state route selects `price_per_unit` and `total_price`, so Ready page and prints show line totals.
  - **BF-22:** the overpayment allocation to another order records the payment, then calls `recalculateOrderFinancialSnapshotTx` (paid, outstanding and payment status from the one writer); the hand-written column update was removed.
  - **New BF-23:** found in the state route (see PLAN §4); its own package.
  - **Test-infra fix:** two UI suites failed to load after BF-20, because the currency context's server action now pulls in `next/server` under jsdom. They stub the action, as `cmx-keypad.test.tsx` already does.
  - **Tests:** new `order-financial-effective-snapshot-bf11` (3), BF regressions in the mapper suite (+6, one test that pinned BF-11 flipped), `order-financial-summary.route` (3), `order-state-line-prices.route` (2), `customer-receipt-excess-order-allocation` (1), `invoice-service-order-invoices` (5).
  - **Full Jest:** 4373 of 4374 tests pass. The one failure is `platform-inventories`: the pre-existing navigation-vs-contract drift (6 routes, inventory files changed outside this work). ESLint and `tsc` are clean on the changed files.

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
