# Order Fin Remediation — Manual QA Test Guide

**Living document — updated after every implemented package.** Last update: 2026-07-25 (B21).
**Scope:** all implemented-but-not-yet-verified remediation packages awaiting Preview QA — **B01, B02, B33, B34, B15, B16, B35, B20, B29, B4, B5, B31, B7, B27, B3 (backend core only — see §14 header), B30, B32, B9, B10, B6, B8, B19, B22, B21**. Run on **Preview** (never straight to production).

> **How to use:** work top-to-bottom. Each scenario tells you **where to go** (sidebar path + URL), **what to do**, the **expected** result, and a **Result** cell — mark `PASS` / `FAIL` / `N/A` + notes. A package is not `VERIFIED` until every scenario passes on Preview and the owner records approval in the package's Completion evidence.

---

## 0. Prerequisites & environment

| Item | Value / action |
|---|---|
| Environment | Preview deployment (post-commit) |
| Migrations applied | up to **0429** — all of 0410 (B7), 0411 (B27), 0412 (B3), 0415 (B30/B32), 0418 (B9), 0421 (B10), 0424 (B6), 0426 (B8), and 0429 (B19) are **APPLIED (owner) and verified via remote DB**. Sections 15–20 (B30/B32, B9, B10, B6, B8, B19) are all migration-ready to test. Section 11 (Outbox Monitor) cannot be tested until `FINANCE_OUTBOX_SECRET` is set from the generated `sys_fin_runtime_cf` value; Section 14 (B3) needs the `order_fin_sv_funding_capture` flag ON; Section 16 (B9) needs `order_fin_refund_execution` ON; Section 19 (B8) has no UI path yet — see its own header (no live gateway connected). |
| Feature flags (HQ console) | `order_fin_refund_ui` = **ON** for the test tenant to exercise B34 (OFF to confirm it stays hidden). `order_fin_sv_funding_capture` = **ON** to exercise B3's tender step (OFF to confirm the 3 entry points fall back to their pre-existing behavior unchanged — see §14). `order_fin_refund_execution` = **ON** to exercise B9's real CASH/ORIGINAL_METHOD execution (OFF to confirm record-only stays unchanged — see §16). *(The old `order_fin_drawer_close_v2` flag was removed — B16/B35 drawer math is always on.)* **B30/B32 ship unconditionally, no feature flag.** |
| Permissions | tester needs the refund permissions (initiate/approve/process) for B34, and `cash_drawer:approve_variance` for B16 §6.5–6.6 and §12.1 (seeded by **B27**, migration 0411, APPLIED). For §12, prepare a **third** login with none of the new B27 codes granted, to exercise the denial paths. For §15 (B30/B32), the tester also needs `orders:pending_payments_view` / `orders:cancel_payment` / `orders:fail_payment` (seeded by migration **0415**, APPLIED); reuse the §12 no-new-codes login to exercise the denial paths there too. |
| Users | prepare **two** logins: an **initiator/cashier** and a **supervisor/approver** (different users — needed for maker-checker in B34 and B16). |
| Test tenant | one with `TENANT_CURRENCY` set (e.g. OMR); ideally a second non-OMR tenant. |

### 0.1 Screen map — where to find each area (sidebar → item → URL)

| Area | Sidebar path | URL |
|---|---|---|
| Orders list | **Orders → All Orders** | `/dashboard/orders` |
| New order | **Orders → New Order** | `/dashboard/orders/new` |
| Order detail (Financial tab, refund action, later-collection action) | click any order in the list | `/dashboard/orders/{id}` |
| Customers | **Customer Management → All Customers** | `/dashboard/customers` |
| Wallet / Advance (stored value) | **Customer Management → Stored Value** | `/dashboard/customers/stored-value` |
| Gift cards (sell/list) | **Marketing → Gift Cards** | `/dashboard/marketing/gift-cards` |
| Cash Drawers (open/close/movements) | **Internal Finance And Operations → Cash Drawers** | `/dashboard/internal_fin/cash-drawers` |
| POS Sessions (close preview) | **Internal Finance And Operations → POS Sessions** | `/dashboard/internal_fin/pos-sessions` |
| Refunds hub | **Internal Finance And Operations → Refunds** | `/dashboard/internal_fin/refunds` |
| Reconciliation | **Internal Finance And Operations → Reconciliation** | `/dashboard/internal_fin/reconciliation` |
| Outbox Monitor (B7) | **Internal Finance And Operations → Outbox Monitor** | `/dashboard/internal_fin/outbox` |
| Pending Payments worklist (B30/B32) | **Internal Finance And Operations → Pending Payments** | `/dashboard/internal_fin/pending-payments` |
| Tenant currency | **Config And Settings → Tenant Settings** (or **Finance**) | `/dashboard/settings/tenant` · `/dashboard/settings/finance` |
| Tax setup | **Config And Settings → Tax Setup** | `/dashboard/settings/tax` |
| Payment / drawer setup | **Config And Settings → Payment Setup** | `/dashboard/settings/payments` |

> Language toggle: use the header language switch (EN ⇄ AR) — Arabic must render right-to-left.

### 0.2 Pre-deploy data checks (run read-only in the DB console BEFORE deploying B15)
Both must return **0 rows**; if not, backfill currency before deploy.
```sql
-- (a) active tenants whose TENANT_CURRENCY resolves empty
WITH active_tenants AS (SELECT id,name FROM org_tenants_mst
  WHERE COALESCE(is_active,true)=true AND COALESCE(rec_status,1)<>0)
SELECT t.id,t.name, r.stng_value_jsonb #>> '{}' AS resolved_currency
FROM active_tenants t
LEFT JOIN LATERAL (SELECT stng_value_jsonb FROM fn_stng_resolve_all_settings(t.id,NULL,NULL)
  WHERE stng_code='TENANT_CURRENCY' LIMIT 1) r ON TRUE
WHERE NULLIF(btrim(COALESCE(r.stng_value_jsonb #>> '{}','')),'') IS NULL;
-- (b) wallets / advances with a blank currency_code
SELECT 'wallet' k,tenant_org_id,id,currency_code FROM org_customer_wallets_mst  WHERE NULLIF(btrim(currency_code),'') IS NULL
UNION ALL
SELECT 'advance',tenant_org_id,id,currency_code FROM org_customer_advances_mst WHERE NULLIF(btrim(currency_code),'') IS NULL;
```
Result (2026-07-18 remote): **CLEAN** — 3 active tenants / 0 empty; 2 wallets + 2 advances / 0 blank.

---

## 1. B15 — Currency defaults & tolerances
**What changed:** money paths never invent a currency or VAT rate; unconfigured tenant currency fails loudly; no-tax-setup = legitimately zero-rated.

| # | Where + how | Expected | Result |
|---|---|---|---|
|1.1| **Orders → New Order** (`/dashboard/orders/new`) on the OMR tenant → add items → take a payment | Every amount shows the tenant currency (OMR); totals correct | |
|1.2| **Customer Management → Stored Value** (`/dashboard/customers/stored-value`) → pick a customer with **no** wallet → **Top up wallet** → enter an amount | Wallet is created in the **tenant currency** (no hard-coded USD/OMR surprise); balance = amount | |
|1.3| Same **Stored Value** screen → **Issue advance** for a customer | Advance created in the tenant currency | |
|1.4| (Staging only) On a tenant whose `TENANT_CURRENCY` is unset (unset it in **Config → Tenant Settings**) → attempt any money write (top-up / take payment) | Operation **fails with a clear "missing tenant currency" error** — it does **not** silently pick a currency | |
|1.5| **Orders → New Order** for a tenant with **no Tax Setup** (**Config → Tax Setup** empty) | Tax line = **0 / zero-rated** (not an error, not an assumed %); server logs a structured warning | |
|1.6| **Orders → New Order** for a tenant **with** VAT configured (**Config → Tax Setup**) | Tax computes correctly from the configured rate / tax lines | |
|1.7| Anywhere an amount has genuinely unresolved currency (edge) | Shows a plain localized **number**, never an invented currency code | |

---

## 2. B01 — Refund lineage & reopen-due
**What changed:** refunds carry lineage + a required context; a normal (commercial) refund **never** silently reopens the customer's due; only explicit refund-and-rebill / manual-exception (or cancellation) reopens.

> Where: open an order via **Orders → All Orders** (`/dashboard/orders`) → click the order → use its **Financial** tab / refund action. The refund back-office lives at **Internal Finance And Operations → Refunds** (needs the B34 flag; see §5).

| # | Where + how | Expected | Result |
|---|---|---|---|
|2.1| Fully pay an order → on the order's **Financial** tab, refund **part** of a real payment (normal refund) | Refund links to the original payment; the customer's **outstanding does NOT increase** | |
|2.2| Refund to **wallet / store credit** | Recorded as a stored-value restore; outstanding unchanged; wallet/credit balance rises (check **Stored Value**) | |
|2.3| Do an explicit **refund-and-rebill** (permissioned + reason) | Due **is** reopened by the reopen amount (the only normal path that reopens) | |
|2.4| Replay/duplicate a refund request (same idempotency key) | No duplicate refund is created (idempotent) | |
|2.5| **Cancel** an order choosing the refund disposition (cancel dialog) | Cancellation unwind creates the refund rows; financials unwind cleanly | |
|2.6| Re-open the order **Financial** tab after any refund | paid / outstanding / refunded all reconcile | |

---

## 3. B02 — Shared financial aggregation (outstanding formula)
**What changed:** one frozen "outstanding" formula used everywhere.

| # | Where + how | Expected | Result |
|---|---|---|---|
|3.1| Pick several orders (paid, partial, refund-bearing, credit-applied). Compare **outstanding** on: order **Financial** tab · **Internal Finance → Reconciliation** · the order **receipt/print** · **Reports & Analytics → Financial Reports** | All surfaces agree (within 0.001) | |
|3.2| Order with a **pending** (not completed) payment leg | Pending shows as its own bucket — **not** counted as paid, not reducing outstanding | |
|3.3| Order with an applied **credit note / wallet credit** | Credit reduces outstanding once — not double-counted as discount + payment | |

---

## 4. B33 — Pending-payment warning semantics
**What changed:** a healthy order with a legitimate pending payment is not flagged as corrupt.

| # | Where + how | Expected | Result |
|---|---|---|---|
|4.1| Create an order with a pending (gateway/cheque) leg, otherwise healthy → check its snapshot on the **Financial** tab and in **Reconciliation** | Snapshot = **CURRENT**; pending amount visible in its bucket; **no** "pending counted as paid" warning | |
|4.2| (If tooling allows) inject a genuine corruption (pending counted as paid) → run **Reconciliation** | The warning **does** fire (real problems still caught) | |

---

## 5. B34 — Refund back-office UI  *(flag `order_fin_refund_ui` = ON + refund permissions)*
**What changed:** the refund maker-checker workflow is fully usable from screens (was API-only).

| # | Where + how | Expected | Result |
|---|---|---|---|
|5.1| Flag **OFF** → open **Internal Finance And Operations → Refunds** (`/dashboard/internal_fin/refunds`) and an order **Financial** tab | No initiate/approve/process actions appear (feature hidden) | |
|5.2| Flag **ON** → open an order (**Orders → All Orders** → order) → **Initiate Refund** → choose a payment/credit leg → enter an amount **over** the refundable cap | Cap enforced **live** (can't exceed) | |
|5.3| Submit a valid **partial** refund | It appears in **Refunds** hub / approval queue as *pending approval* | |
|5.4| As the **same** user, try to **Approve** it | **Blocked** — maker can't self-approve (self-approval error) | |
|5.5| Log in as a **different** user with approve permission → **Approve** → **Process** | Refund processes; result shows on the order **Financial** tab and in **Refunds** hub | |
|5.6| Toggle **Arabic** | All refund screens/labels translated + RTL correct | |

---

## 6. B16 — Drawer close filtering + OPTIONAL variance approval
**What changed:** expected cash counts only real completed cash; variance approval is **optional, non-blocking, opt-in per drawer** (off by default).

> Where: **Internal Finance And Operations → Cash Drawers** (`/dashboard/internal_fin/cash-drawers`). Open a drawer to see/open its session, add movements, and **Close** it. Session detail (with the variance banner) is reachable by drilling into a closed session.

| # | Where + how | Expected | Result |
|---|---|---|---|
|6.1| **Cash Drawers** → open a session → take a **cash** sale and a **card** sale (via **New Order** checkout linked to that drawer) → **Close** with the correct physical count | Expected cash includes the **cash** sale only (card excluded); variance ≈ 0 | |
|6.2| Same, but include a payment that stays **pending** (cheque/gateway pending) → **Close** | The pending leg is **excluded** from expected cash (no false shortage) | |
|6.3| A drawer with **no** variance threshold (default) → **Close** with a big variance | Close **completes** normally; **no** approval prompt / pending state at all | |
|6.4| Set a drawer `variance_approval_threshold` (e.g. `1.000`) — via **Config → Payment Setup** drawer config **if the field exists, else set it in the DB** (`org_cash_drawers_mst.variance_approval_threshold`) → **Close** with a variance **over** it | Close still **completes** (never blocked); the closed session shows an **OPTIONAL** "supervisor approval available" banner (wording says *optional / for audit*, not "required") | |
|6.5| On that session, as the **closer**, click **Approve Variance** | Blocked — approver must differ from the closer (button also needs `cash_drawer:approve_variance`, seeded by B27) | |
|6.6| As a **different** supervisor with the permission → **Approve Variance** → enter a reason | "Approved" banner shows approver + date + reason | |
|6.7| Close another session **within** the threshold | No approval banner appears | |
|6.8| Toggle **Arabic** on the session detail | Banner + dialog translated + RTL | |

---

## 7. B35 — Unified drawer expected-cash (double-count fix)
**What changed:** each cash fact counted exactly once — sale cash from payments + manual float/petty movements; the close **preview** matches the actual close.

> Where: **Internal Finance And Operations → Cash Drawers** for close + session detail; **POS Sessions** (`/dashboard/internal_fin/pos-sessions`) for the close **preview** screen.

| # | Where + how | Expected | Result |
|---|---|---|---|
|7.1| Open a session → one **cash sale** of amount X → **Close** | Expected cash rises by **X only** (not 2×X — the internal CASH_SALE movement is not double-counted) | |
|7.2| Add a **manual float top-up** (drawer **Add movement → Cash In**) of Y → **Close** | Expected cash **increases by Y** (manual movements still count) | |
|7.3| Do a **manual cash-out / petty** (Add movement → Cash Out) of Z | Expected cash **decreases by Z** | |
|7.4| Compare expected cash across: the **POS Sessions** close **preview**, the actual **Close** result, and the **Cash Drawers** session-detail reconciliation | All three show the **same** expected cash | |
|7.5| A cash sale that returns **change** | Change counted once (no under/over-count from the change movement) | |

---

## 8. B20 — New reconciliation checks (TAX_CALCULATION, DISCOUNT_VALIDATION, REFUND_REOPEN_CONSISTENCY)
**What changed:** the reconciliation run now executes 3 additional checks (`total_checked` 35→38) — no new screen, the existing Reconciliation screen just shows the new check rows/counts.

> Where: **Internal Finance And Operations → Reconciliation** (`/dashboard/internal_fin/reconciliation`), permission `reconciliation:view`.

| # | Where + how | Expected | Result |
|---|---|---|---|
|8.1| Open Reconciliation → trigger a run for a branch/date with normal orders (no injected drift) | Run completes; the 3 new checks appear in the results as **passed**; nothing regresses vs before | |
|8.2| Open a completed run's detail and check the total-checks count shown | Reads **38** (was 35 before this package) | |
|8.3| (If a test/staging order can be manipulated) an order with a wrong tax-line amount, an out-of-range percentage discount, or a refund row with a positive `reopens_due_amount` outside `REFUND_AND_REBILL`/`MANUAL_EXCEPTION` | Each produces **exactly one** BLOCKER issue naming the specific check (`TAX_CALCULATION` / `DISCOUNT_VALIDATION` / `REFUND_REOPEN_CONSISTENCY`) | |

## 9. B29 — Stale documentation correction
**What changed:** documentation-only — no runtime surface, no screen, nothing to click. Seven historical docs under `docs/features/Order_Fin/` (ADR-030, three `Fix_29_05_2026` status docs, two `Opus_Validation_Report_18_06_2026` files, `RECONCILIATION_GUIDE.md`) received correction banners pointing at the frozen audit report + the packages that actually shipped the fixes.

> Where: no UI action — this is a code-review item, not a manual-QA one. To spot-check: open any of the 7 files listed in [B29's Completion evidence](B29_Stale_Documentation_Correction.md#completion-evidence) and confirm the correction banner renders and its links resolve.

| # | Where + how | Expected | Result |
|---|---|---|---|
|9.1| Open `docs/features/Order_Fin/ADR/ADR-030-Refund-Source-Lineage.md` on the Preview branch (or locally) | A correction banner appears right after the metadata block, linking to the authoritative report and B01 | |
|9.2| Click through the banner's report link and B01 link from 2–3 of the 7 corrected files | Both links resolve (no 404 / broken relative path) | |

## 10. B4/B5/B31 — Later collection: BVM voucher wiring, idempotency & D9 status
**What changed:** collecting payment on a `PAY_ON_COLLECTION` order now creates a real Business Voucher (with lines) instead of writing payment/drawer rows directly — so every collection shows up in **Business Vouchers** and reconciliation stops flagging it. A repeated submit (same attempt) no longer double-collects, and a method configured to land PENDING (e.g. CHECK awaiting bank clearing) is now honestly recorded as PENDING instead of always COMPLETED. No feature flag — this is live for every collection once deployed.

> Where: **Orders → All Orders** → open any order with `payment_type_code = PAY_ON_COLLECTION` and an outstanding balance → the order detail page's Financial tab shows a **Collect Payment** action/panel. Cross-check the resulting voucher at **Internal Finance And Operations → Business Vouchers** (`/dashboard/internal_fin/vouchers`).

| # | Where + how | Expected | Result |
|---|---|---|---|
|10.1| Open a PAY_ON_COLLECTION order with an outstanding balance → **Collect Payment** → pay the full amount with **CASH** (with an open drawer session) → submit | Collection succeeds; order shows PAID/outstanding 0 same as before this change | |
|10.2| Open **Business Vouchers**, find the RECEIPT voucher created by 10.1 | Voucher exists, POSTED, one `ORDER_PAYMENT` line for the CASH leg, linked to the order | |
|10.3| Open **Internal Finance And Operations → Cash Drawers** → the session used in 10.1 → session detail | A `CASH_SALE` drawer movement exists for the collected amount, same as pre-refactor behavior (no change in drawer totals) | |
|10.4| Trigger a **Reconciliation** run covering the date of 10.1's collection (`/dashboard/internal_fin/reconciliation`) | No `ORDER_PAYMENT_LINK_EXISTS` issue for that payment (it now carries a voucher backlink) | |
|10.5| Collect a **partial** amount on a different PAY_ON_COLLECTION order, then collect the remainder in a second, separate action | Two separate vouchers/collections recorded; both apply; final outstanding is 0 (partial-collection behavior unchanged) | |
|10.6| (If a CHECK or BANK_TRANSFER method is configured with `default_creation_status = PENDING` in **Config And Settings → Payment Setup**) Collect using that method | Before submitting, the modal shows a **"will be recorded as pending until verified"** notice; after submit the leg lands PENDING and the order is **not** marked fully paid | |
|10.7| **CASH behavior unchanged:** collect with CASH (no PENDING config) | Leg lands COMPLETED immediately, exactly as before | |
|10.8| Idempotency — submit a collection, then (before this session ends) trigger the exact same request again with the same underlying attempt (e.g. via dev tools replaying the request, or a forced double-submit) | Second call returns the same result with **no** second voucher/payment/drawer movement created | |
|10.9| Submit a collect-payment request with no `idempotencyKey` (API-level check, e.g. via a direct API call in dev tools) | Request is rejected with **400** | |

---

## 11. B7 — Financial outbox processor
**What changed:** the financial outbox (loyalty points, order-history rows) now actually gets processed once a minute instead of sitting PENDING forever. **Cannot be tested until migration 0410 is applied and `FINANCE_OUTBOX_SECRET` is set** (see §0 Prerequisites).

> Where: **Internal Finance And Operations → Outbox Monitor** (`/dashboard/internal_fin/outbox`), permission `finance_outbox:view` (retry needs `finance_outbox:retry`).

| # | Where + how | Expected | Result |
|---|---|---|---|
|11.1| Complete an order for a customer with an active loyalty program (any order that reaches ORDER_COMPLETED) → wait ~1–2 minutes → check the customer's loyalty balance (**Marketing → Loyalty**, or the customer's stored-value view) | Points balance increases by `floor(orderAmount × earn rate)` — previously this never happened at all | |
|11.2| Open **Outbox Monitor** right after 11.1 | The `LOYALTY_EARN` event for that order shows status **Processed** (not stuck Pending) within ~1 minute of completion | |
|11.3| Complete an order, then check **Reports & Analytics** / the order's history/audit trail for an order-history entry tied to `ORDER_COMPLETED` | An order-history row exists for the event (previously never materialized) | |
|11.4| On the Outbox Monitor screen, use the status filter to view **Failed** / **Dead-lettered** events (if any exist from testing) | Filter narrows the list correctly; each row shows attempts/max, next-retry time, and the error message | |
|11.5| (If a Failed or Dead-lettered row exists) click **Retry** on it | Row returns to Pending with attempts reset to 0; disappears from the Failed/Dead-lettered filter after the next processor tick (~1 min) | |
|11.6| Log in as a user WITHOUT `finance_outbox:retry` (but with `finance_outbox:view`) | Outbox Monitor is visible (counts + list) but no Retry button appears on any row | |
|11.7| Log in as a user WITHOUT `finance_outbox:view` | **Outbox Monitor** does not appear in the sidebar; direct navigation to the URL is blocked | |

---

## 12. B27 — Financial permissions & approvals
**What changed:** 7 new permission codes seeded (migration 0411, must be applied first); a price-override fail-open bug fixed (`addOrderItems` now denies by default instead of letting an override through on a permission-check error); three previously **completely ungated** wallet/advance/credit-note admin actions now require a permission; the `REFUND_AND_REBILL` refund type — hardcoded-rejected since B01 shipped — now works for holders of the new `orders:rebill_authorize` code.

> Use the **third login** from §0 Prerequisites (no new B27 codes granted) alongside the normal supervisor/admin login to exercise both the granted and denied paths.

| # | Where + how | Expected | Result |
|---|---|---|---|
|12.1| **Cash Drawers → [any drawer] → session detail** (`/dashboard/internal_fin/cash-drawers/{drawerId}/session/{sessionId}`), close a session with a variance over its threshold, then try **Approve variance** as the admin/supervisor login | Button now appears and the approval succeeds (this is B16's existing dialog — B27 only seeded the permission code it was already checking, `cash_drawer:approve_variance`) | |
|12.2| Same screen, log in as the no-new-codes user, open a variance-eligible session | **Approve variance** does not appear (permission absent) | |
|12.3| **Customer Management → Stored Value** (`/dashboard/customers/stored-value`) → open a customer → **Top Up Wallet** (admin adjustment, not a payment) as the admin login | Succeeds — this action was completely ungated before B27; now requires `stored_value:issue_wallet_credit` | |
|12.4| Same screen, same action, as the no-new-codes login | Action is rejected with a permission-denied message (previously would have silently succeeded for ANY logged-in user) | |
|12.5| Same screen → **Issue Advance** and **Issue Credit Note** actions, admin login vs. no-new-codes login | Admin succeeds; no-new-codes login is denied on both (both were also completely ungated server-actions before B27, even though their sibling API routes already had checks) | |
|12.6| **Orders → [any order]** with items → attempt a **price override** on a line item as a role that historically could do this (e.g. cashier/branch_manager) | Override still succeeds — `pricing:override` was broadened to match `orders:create`'s role set in this same package, so nobody who could override prices before B27 loses the ability | |
|12.7| Same screen, no-new-codes login, attempt a price override | Denied — proves the fail-open bug is closed (previously a permission-check error or an unresolved user would have let this through silently) | |
|12.8| **Internal Finance And Operations → Refunds** (`/dashboard/internal_fin/refunds`) or an order's refund action → initiate a refund with type **Refund and Rebill** as the admin login (or any role granted `orders:rebill_authorize` — `super_admin`, `tenant_admin`, `receptionist`, `cashier` by default) | Refund succeeds and the order's outstanding balance reopens by the refunded amount (previously this refund type was rejected outright, regardless of permission, with `REFUND_AND_REBILL_NOT_AVAILABLE`) | |
|12.9| Same flow, no-new-codes login | Rejected with the same `REFUND_AND_REBILL_NOT_AVAILABLE` error code as before B27 (the denial path is unchanged — only the granted path is new) | |
|12.10| Any other refund type (e.g. standard `OVERCHARGE`) with either login | Unaffected — `orders:rebill_authorize` is only checked for the `REFUND_AND_REBILL` context | |

---

## 13. Cross-cutting regression
| # | Check | Result |
|---|---|---|
|12.1| Create → pay → collect order flow works unchanged | |
|12.2| Drawer open/close/movement flows work | |
|12.3| **Reports & Analytics** + **Reconciliation** run without new errors | |
|12.4| No console/server errors on the touched screens | |
|12.5| EN ⇄ AR toggle + RTL correct on every touched screen | |

---

## 14. B3 — Stored-value funding capture (backend + tender-step UI)
**What changed:** gift-card sale, wallet top-up, and customer-advance receipt can now be funded through a real tender (payment method + cash/change + drawer session when cash) instead of a bare ledger credit with no payment fact. Migration `0412` **APPLIED**. Requires feature flag **`order_fin_sv_funding_capture` = ON** (HQ console) for the tender step to appear — **OFF is the default and must also be verified** (§14.7–14.8 below), since the existing no-tender admin actions must keep working unchanged while the flag is off.

> Where: **Marketing → Gift Cards** (`/dashboard/marketing/gift-cards`) → **Sell Card**; **Customer Management → Stored Value** (`/dashboard/customers/stored-value`) → open a customer → **Top Up** / **Issue Advance**.

| # | Where + how | Expected | Result |
|---|---|---|---|
|14.1| With the flag **ON**: **Marketing → Gift Cards → Sell Card**, fill the form, and note the new **Tender** section appears with a payment-method dropdown | A **Tender** section appears below Amount/Currency; the **Sell Card** button is disabled until a payment method (and, for CASH, a cash-drawer session) is selected | |
|14.2| Same dialog, select **Cash**, enter cash tendered greater than the amount | A **Change Due** banner appears showing the difference | |
|14.3| Complete the sale with Cash + an open drawer session | Card is created and the generated code is shown (same success screen as before); the sale amount now appears in that cash drawer session's expected cash (check **Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — previously a gift-card sale never touched the drawer at all | |
|14.4| With the flag **ON**: **Customer Management → Stored Value** → open a customer → **Top Up** | The dialog gains the same **Tender** section (payment method + cash-tendered/drawer when cash); **Notes** field is hidden (not used by the tendered path) | |
|14.5| Complete a wallet top-up with Cash + an open drawer session | Wallet balance increases by the amount; the drawer session's expected cash increases by the same amount; retry the exact same submission (e.g. double-click, or resubmit before the dialog closes) | Balance increases **once** — the retry replays the cached result, no double-credit |
|14.6| Repeat 14.4–14.5 for **Issue Advance** | Same behavior — advance balance increases once per confirmed tender | |
|14.7| Turn the flag **OFF** for the tenant, repeat **Sell Card** | No **Tender** section appears; the dialog behaves exactly as before B3 (card created + activated immediately, no payment fact) — confirms the flag-off path is unchanged | |
|14.8| Turn the flag **OFF**, repeat **Top Up** / **Issue Advance** | No **Tender** section; behaves exactly as the pre-B3 admin adjustment (still gated by `stored_value:issue_wallet_credit` / `stored_value:issue_advance` respectively) | |
|14.9| (DB/admin check) With the flag ON, after 14.3/14.5, query `org_sv_funding_tenders_dtl` for the tenant | One row per completed funding, `fin_voucher_id`/`fin_voucher_trx_line_id` populated, `amount` matches the tender | |
|14.10| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the funding dates from 14.3/14.5 | Passes (no `SV_FUNDING_TENDER_TOTAL_MATCH` / `SV_FUNDING_VOUCHER_LINK_EXISTS` issues) — these are new checks added in this package | |
|14.11| Attempt a gift-card sale / top-up / advance with a payment method configured to resolve **PENDING** (e.g. a bank-transfer method with no D9 override), if the tenant has one configured | Request is rejected (no such tender is accepted in v1 — see B03 Architecture decision "Revision v3") rather than silently accepted or left half-completed | |
|14.12| **Finance → Vouchers → Manual Entry** (add-line dialog), open the line-role picker | `GIFT_CARD_SALE` / `WALLET_TOPUP` / `CUSTOMER_ADVANCE_RECEIPT` no longer appear in the **Receipts** group (closed bypass — B03 Revision v3); `CUSTOMER_CREDIT_RECEIPT` and `ORDER_CREDIT_APPLICATION` still do | |

---

## 15. B30 + B32 — Pending-payment back-office lifecycle & drawer status gating
**What changed:** a new cross-order **Pending Payments** worklist lets an accountant VERIFY / CANCEL / mark FAILED-BOUNCED any PENDING or PROCESSING payment leg without hunting through individual orders; CANCEL and FAIL-BOUNCE require a mandatory reason plus a governed classification of what happens to the outstanding balance (D009). The same three actions were also added to the existing per-order **Payments & Credits** tab next to the pre-existing Verify button. Separately (B32), a drawer-required payment method configured to create legs as PENDING no longer records a premature cash-in movement — the movement is now created only when the leg actually completes (either immediately, or later via the new VERIFY action). Ships **unconditionally, no feature flag**. Migration **0415 must be applied first** (adds the audit columns + the 3 new permission codes + nav entry).

> Where: **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) for the cross-order worklist; any order's **Financial → Payments & Credits** tab for the per-order actions.

| # | Where + how | Expected | Result |
|---|---|---|---|
|15.1| Create an order with a payment method that resolves to **PENDING** (e.g. CHECK, or BANK_TRANSFER with no D9 override) → open **Pending Payments** worklist as the admin login | The order's leg appears in the list with status PENDING, correct order/customer/branch/amount/reference | |
|15.2| Same row → click **Verify** | Leg flips to COMPLETED, disappears from the (PENDING/PROCESSING-only) worklist, and the order's outstanding amount updates accordingly — same effect as the pre-existing per-order Verify button | |
|15.3| Create a second PENDING leg → click **Mark Failed/Bounced** → try to submit with no reason and no classification selected | Submit button stays disabled until both a reason is typed and a classification is chosen | |
|15.4| Same dialog, fill reason "check bounced" + classification **Collect on delivery/pickup** (`PAY_ON_COLLECTION`) → submit | Leg flips to FAILED; the order's settlement routing reclassifies to **Pay on Collection** (verify on the order's Financial tab — outstanding now routes as pay-on-collection instead of the original advance-payment classification) | |
|15.5| Create a third PENDING leg → **Cancel** it with reason + classification **Needs manual review** (`MANUAL_REVIEW`) | Leg flips to CANCELLED; the order's `payment_type_code` is **unchanged** (MANUAL_REVIEW does not auto-reclassify — an accountant must decide separately) | |
|15.6| Log in as the §12 no-new-codes login → open **Pending Payments** | The nav item / page itself is not reachable (missing `orders:pending_payments_view`) | |
|15.7| As the admin login, open an order with a PENDING leg → **Financial → Payments & Credits** tab | **Verify**, **Mark Failed/Bounced**, and **Cancel Payment** all appear next to each other for the PENDING row (same shared dialog as the worklist) | |
|15.8| Repeat 15.7 as the §12 no-new-codes login | None of the three action buttons render for that row (each independently gated by its own permission) | |
|15.9| Retry the exact same Cancel/Fail submission twice in a row quickly (e.g. double-click, or resubmit before the dialog closes) | Second submission is a no-op replay (idempotency key reused for the same dialog-open attempt) — no duplicate audit rows, no error shown to the user | |
|15.10| (B32) Configure a payment method (e.g. CASH) with a D9 override so its `default_creation_status` = PENDING, then create an order using that method with an open cash-drawer session | Order leg is created PENDING; open that drawer session's detail screen (**Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — the sale amount does **NOT** yet appear in expected cash (previously it would have, immediately, even though the money hadn't cleared) | |
|15.11| From the Pending Payments worklist (or the order's Payments tab), **Verify** that same leg | Leg flips to COMPLETED; the drawer session's expected cash now increases by the sale amount — the deferred movement was created at verify time | |
|15.12| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 15.1–15.11 | Passes (no `CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT` issues — this new check would only fire if a cancelled/failed leg somehow still carried a live cash movement, which should be structurally unreachable) | |
|15.13| Any already-COMPLETED payment leg (e.g. a normal CASH sale) | No Verify/Cancel/Fail actions appear for it anywhere (both surfaces only offer these actions for PENDING/PROCESSING legs — a completed leg needs the separate reversal flow, not yet built) | |

---

## 16. B9 — Refund execution parity
**What changed:** processing an **approved** CASH or ORIGINAL_METHOD refund used to be record-only (status flips to PROCESSED, nothing else happens). Behind the new flag `order_fin_refund_execution` (default OFF), CASH refunds now create a real REFUND_VOUCHER wired to a cash-drawer CASH_OUT movement (the drawer's expected cash actually drops); ORIGINAL_METHOD refunds require the accountant to type a manual-settlement reference (bank transfer ref, terminal void slip no., gateway dashboard ref) since no gateway integration exists yet. Migration **0418 must be applied first**.

> Where: **Internal Finance And Operations → Refunds** (`/dashboard/internal_fin/refunds`).

| # | Where + how | Expected | Result |
|---|---|---|---|
|16.1| With the flag **OFF**: initiate + approve + process a CASH refund as usual | Behaves exactly as before B9 — Process succeeds immediately with no extra dialog fields, refund flips to Processed, no drawer effect | |
|16.2| Turn the flag **ON**. Initiate a refund → note the destination dropdown | The amber "record-only" hint no longer appears for CASH/ORIGINAL_METHOD (it used to say the destination was record-only) | |
|16.3| Approve that refund, then click **Process** | The confirm dialog now shows a **cash-drawer session** dropdown (populated from currently-open sessions) for a CASH refund | |
|16.4| Try to confirm with no session selected | Confirm button stays disabled | |
|16.5| Select an open drawer session → confirm | Refund flips to Processed; open that drawer's session detail (**Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — expected cash has decreased by the refund amount | |
|16.6| Initiate + approve an **ORIGINAL_METHOD** refund with the flag ON → Process | The confirm dialog shows a **manual settlement reference** text field instead; confirm is disabled until something is typed | |
|16.7| Type a reference (e.g. "Stripe dashboard ref #123") → confirm | Refund flips to Processed; no drawer movement (original-method refunds never touch cash) | |
|16.8| Try to process a CASH refund with the flag ON when **no cash-drawer session is open anywhere** | Dialog shows "no open cash-drawer session" instead of a dropdown; confirm stays disabled | |
|16.9| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 16.5/16.7 | Passes (no `REFUND_LINK_EXISTS` issues) — the new dual-mode check confirms the voucher is POSTED and, for CASH, that the drawer movement is linked | |
|16.10| WALLET or CREDIT_NOTE refund with the flag ON | Unaffected — those destinations redeem stored-value ledgers directly and never show the new dialog fields | |

---

## 17. B10 — Payment reversal & void

**What changed:** two new back-office actions extend the existing VERIFY/CANCEL/FAIL-BOUNCE trio. **Void** erases a mistaken/duplicate PENDING/PROCESSING/AUTHORIZED entry with just a reason (no balance-routing classification — distinct from Cancel, which is for a genuinely-failed payment plan). **Reverse** corrects an already-COMPLETED leg as an error: for a CASH leg, the accountant must pick a currently-open cash-drawer session, and the system records a real compensating cash-out movement so the drawer's expected cash reflects the correction; for card/bank/check legs, only the status flips (no drawer/gateway effect — no gateway integration exists yet). Both actions require permission (`orders:void_payment` / `orders:reverse_payment`) and are **not** behind a feature flag. Migration **0421 must be applied first** (adds the audit columns, the `PAYMENT_REVERSAL` movement type, and the two new permission codes).

> Where: **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) for Void on a worklist row; any order's **Financial → Payments & Credits** tab for Void (pending rows) and Reverse (completed rows).

| # | Where + how | Expected | Result |
|---|---|---|---|
|17.1| Create an order with a PENDING leg (e.g. CHECK) → open **Pending Payments** worklist → click **Void** on that row, leave the reason blank, try to submit | Submit button stays disabled until a reason is typed (no classification field appears — unlike Cancel/Fail-Bounce) | |
|17.2| Same row, type reason "duplicate entry — wrong order" → submit | Leg flips to VOIDED and disappears from the worklist; open the order's Financial tab — outstanding has reopened by the leg amount, `payment_type_code` is **unchanged** (no D009 reclassification for Void) | |
|17.3| Create a second PENDING leg on an order → open the order's **Financial → Payments & Credits** tab | Both **Cancel Payment** and **Void** buttons appear side by side on the row (in addition to Fail-Bounce) — this is intentional, not a duplicate bug | |
|17.4| Create a normal CASH sale (completed, cash-drawer session open) → open the order's Financial tab → find that COMPLETED cash row | A new **Reverse** button appears next to the "Verified" badge (previously no action showed there) | |
|17.5| Click **Reverse** on that cash row, type a reason, but do not pick a cash-drawer session | Confirm button stays disabled until an open session is selected | |
|17.6| Select the open session → confirm | Payment flips to REVERSED; open that drawer session's detail screen (**Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — expected cash has **decreased** by the payment amount (a real compensating cash-out was recorded); back on the order's Financial tab, outstanding has reopened (PAID → due) | |
|17.7| Repeat 17.4–17.6 for a **CHECK** or **CARD** completed payment | Reverse dialog shows only the reason field (no cash-drawer session picker); confirming flips status to REVERSED and reopens outstanding, but the cash-drawer session detail screen is unaffected (no movement created — card/check reversal has no physical drawer effect) | |
|17.8| Try Reverse on a CASH payment when **no cash-drawer session is open anywhere** | Dialog shows "no open cash-drawer session" instead of a dropdown; confirm stays disabled | |
|17.9| Log in as the §12 no-new-codes login → open an order with both a PENDING and a COMPLETED leg | Neither **Void** nor **Reverse** renders for either row (each independently gated by its own permission) | |
|17.10| Retry the exact same Void or Reverse submission twice quickly (e.g. double-click) | Second submission is a no-op replay (idempotency key reused for the same dialog-open attempt) — no duplicate audit rows, no error shown | |
|17.11| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 17.1–17.7 | Passes — no `VOIDED_PAYMENT_NO_ORPHAN_MOVEMENT` issues (Void never carries a movement) and no `REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT` issues (every REVERSED cash leg from 17.6 has its compensating movement) | |
|17.12| A payment leg that was originally wired to a BVM voucher at settlement (e.g. via the collect-payment or submit-order flow) → Reverse it | Payment-side effects (status, snapshot, drawer) work correctly, but the linked voucher (open it via the row's "Open Voucher" link) remains POSTED/un-reversed — **this is the known, documented B13 gap**; do not treat the voucher staying POSTED as a B10 bug | |

---

## 18. B6 — ERP order-to-cash event wiring

**What changed:** payment/refund/gift-card/wallet-topup/advance-receipt transactions now attempt to post a real ERP-Lite GL journal (previously the dispatchers existed but nothing ever called them — money moved, the general ledger never knew). This is a **backend-only** package with no new screen — the existing ERP-Lite Posting Audit and Exceptions screens are the observation points. Requires the tenant to have **ERP-Lite enabled** (`erp_lite_enabled` feature flag) — for a tenant without it, nothing in this section applies (every dispatch is a routine, logged no-op). Migration **0424 must be applied first** (flips 5 already-live policies to NON_BLOCKING and seeds 7 new event codes/mapping rules/policies).

> Where: **ERP-Lite → Posting Audit** (`/dashboard/erp-lite/posting-audit`) to see attempted journal postings; **ERP-Lite → Exceptions** (`/dashboard/erp-lite/exceptions`) for failed/skipped attempts; **ERP-Lite → Usage Mapping** (`/dashboard/erp-lite/usage-maps`) to map the 4 new usage codes (GIFT_CARD_LIABILITY, CUSTOMER_ADVANCE_LIABILITY, BREAKAGE_INCOME, VOID_RECOVERY) to real ledger accounts before expecting a real post (without a mapping, the attempt still happens but lands as an exception — that's expected, not a bug).

| # | Where + how | Expected | Result |
|---|---|---|---|
|18.1| Ensure `erp_lite_enabled` is ON for the test tenant → create a normal order and settle it with **CASH** | Open **ERP-Lite → Posting Audit** — a new posting-log row appears for this order's payment (`ORDER_SETTLED_CASH`), status POSTED (if the tenant already maps `CASH_MAIN`/`ACCOUNTS_RECEIVABLE`) or a new row in **Exceptions** with reason `ACCOUNT_NOT_FOUND`/`USAGE_MAPPING_NOT_FOUND` (if not yet mapped) — either way, an attempt is now visible where before there was silently nothing | |
|18.2| Repeat 18.1 with a **CARD** settlement | Posting-audit row for `ORDER_SETTLED_CARD` appears | |
|18.3| Create a PENDING leg (e.g. CHECK/BANK_TRANSFER) → **Pending Payments** worklist → **Verify** it (per §15) | No posting-audit row appears at leg creation (money hasn't cleared yet); a row appears only after Verify — confirms the deferred post fires at the correct moment, not prematurely | |
|18.4| Process a refund (any destination — CASH/ORIGINAL_METHOD/WALLET/CREDIT_NOTE, per §16) | A `REFUND_ISSUED` posting-audit row appears regardless of which destination was chosen — one event covers all four | |
|18.5| Sell a gift card (funded, tender-backed — via the gift-card sell dialog behind `order_fin_sv_funding_capture`, per §14) | A `GIFT_CARD_SOLD` posting-audit row appears | |
|18.6| Redeem that gift card against an order, then refund the redemption, then (as admin) void the remaining balance | `GIFT_CARD_REDEEMED`, `GIFT_CARD_REFUNDED`, `GIFT_CARD_VOIDED` posting-audit rows appear respectively | |
|18.7| Top up a customer wallet or issue a customer advance (funded, tender-backed, per §14) | `WALLET_TOPPED_UP` / `CUSTOMER_ADVANCE_RECEIVED` posting-audit rows appear | |
|18.8| Spend an existing wallet balance to settle an order (order payment method = WALLET) | An `ORDER_SETTLED_WALLET` posting-audit row appears | |
|18.9| Turn `erp_lite_enabled` **OFF** for the tenant → repeat any of 18.1–18.8 | No posting-audit row and no exception row appears — the dispatch is a silent, routine no-op (this is intentional: ERP-Lite is opt-in) | |
|18.10| With ERP-Lite ON but the tenant hasn't mapped `GIFT_CARD_LIABILITY` yet → sell a gift card | The order/sale itself completes normally (no error shown to the cashier); an exception row appears in **ERP-Lite → Exceptions** with reason `USAGE_MAPPING_NOT_FOUND` — confirms NON_BLOCKING: a missing GL mapping never blocks a real sale | |
|18.11| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 18.1–18.8 | Passes — no `ORDER_PAYMENT_ERP_POST_ATTEMPTED`/`REFUND_ERP_POST_ATTEMPTED` warnings (every payment/refund in the window has at least one posting-log attempt row, regardless of whether that attempt succeeded or landed as an exception) | |

**Automated gates at build time (2026-07-24, B6):** tsc clean (2 pre-existing unrelated errors untouched) · eslint 0 (project-wide) · `erp-lite-auto-post.service.test.ts` +9 new · `erp-lite-auto-post.util.test.ts` new, 6 tests (incl. `safeDispatchAutoPost` never-throws guarantee) · `reconciliation/erp-lite-checks.test.ts` new, 7 tests · full jest **227/227 suites, 2197/2197 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0). **Migration 0424 APPLIED (owner, 2026-07-24) to local + remote, verified** — §18 above is ready to run once deployed to Preview.

---

## 19. B8 — Gateway lifecycle integration

**What changed:** a new public webhook route (`POST /api/v1/payments/gateway/[gatewayCode]/webhook`) can now drive a gateway payment leg's status automatically instead of requiring a manual Verify click. **No real payment gateway (Stripe/HyperPay/PayTabs) is connected in this environment** — only catalog rows exist — so there is no live vendor sending real webhooks to test against yet. This section is therefore testable only via direct HTTP calls (curl/Postman) against the generic normalized envelope, not through the checkout UI. Two new manual-resync actions (**Capture**, **Settle**) also appear on the Pending Payments worklist and the order Financial tab, but only for a leg already at AUTHORIZED/CAPTURED status — **no live path creates such a leg today**, so these buttons will not appear during ordinary testing (this is expected — see the Bxx file's "Dormancy note").

> Where: **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) — health tiles now show Authorized/Captured counts (will read 0 until a real auth-then-capture gateway is connected); **Orders → [any order] → Financial tab** for the per-leg badges.

| # | Where + how | Expected | Result |
|---|---|---|---|
|19.1| Create a normal order, settle with a **gateway-configured payment method** (any `payment_method_code` with a non-null `gateway_code` in `org_payment_methods_cf`) → leg is created PROCESSING | Order Financial tab shows the leg as PROCESSING (info badge), same as before this package | |
|19.2| In the tenant's `org_payment_methods_cf.gateway_config` for that method/gateway, add `{"webhook_secret": "test-secret-123"}` (direct DB edit — no UI for this yet, intentionally, see Bxx Delivery-surfaces) → note the leg's `gateway_transaction_id` (or set one manually for this test) | — | |
|19.3| POST a signed generic envelope to the webhook: `{"eventId":"evt-test-1","eventType":"PAYMENT_SUCCEEDED","gatewayTransactionId":"<the leg's value>"}`, header `x-gateway-signature: sha256=<hmac-sha256 of the exact body with "test-secret-123">`, to `/api/v1/payments/gateway/<gatewayCode>/webhook` | 200 response `{"success":true,"data":{"status":"TRANSITIONED"}}`; the order Financial tab leg flips to COMPLETED without ever clicking Verify | |
|19.4| Re-POST the exact same body+signature a second time | 200 response `{"status":"DUPLICATE"}`; no second history row, no double-counting | |
|19.5| POST the same envelope again but with `eventId` changed and the signature computed against a **wrong** secret | 401 response `{"success":false,"error":"REJECTED_SIGNATURE"}`; leg status unchanged | |
|19.6| POST an envelope whose `gatewayTransactionId` matches no leg | 200 response `{"status":"UNMATCHED"}` (ack, no effect) — check server logs for the "no matching payment leg found" warning | |
|19.7| POST a `PAYMENT_FAILED` event for a fresh PROCESSING leg (new `eventId`, valid signature) | Leg flips to FAILED; **Pending Payments** worklist shows the fallback classification recorded as `RETRY_TENDER` if you open the leg's history (D009 auto-default for a gateway failure before confirmation) | |
|19.8| Confirm no Capture/Settle buttons appear anywhere for ordinary PENDING/PROCESSING/COMPLETED legs | Buttons are absent — they only render for AUTHORIZED/CAPTURED statuses, which nothing in this environment currently creates (expected, documented dormancy) | |

**Automated gates at build time (2026-07-24, B8):** tsc clean · eslint 0 (project-wide) · `gateway-webhook-adapter.test.ts` new, 12 tests (parse + HMAC signature verify: valid/wrong-secret/tampered-body/missing-header/malformed-header/no-secret) · `gateway-webhook.service.test.ts` new, 12 tests (gateway-not-found, malformed payload, duplicate-event, unmatched-leg, signature-rejected ×2, VERIFY happy path, CAPTURE happy path on a dormant AUTHORIZED leg, FAIL_BOUNCE+D009-RETRY_TENDER, unsupported-outcome, replay-after-duplicate) · `payment-transition.service.test.ts` +6 new (CAPTURE/SETTLE legality, null-actorId webhook path, idempotent no-op) alongside all pre-existing VERIFY/CANCEL/FAIL_BOUNCE/VOID/REVERSE suites unchanged and still passing · targeted jest **66/66** across the 4 touched suites · full jest **230/230 suites, 2228/2228 tests — zero known failures** · `npm run build` ✓ (exit 0) · `check:i18n` ✓. **Migration 0426 APPLIED (owner, 2026-07-24) to local + remote, verified via remote DB** — §19 above is testable via direct HTTP calls now (no UI path exists yet since no live gateway is connected).

---

## 20. B19 — Expiry and idempotency jobs

**What changed:** gift-card expiry now writes a real ledger row + attempts an ERP-Lite GL post (previously a competing raw cron silently flipped status only — retired in this package's migration). Two brand-new jobs also start running: idempotency-key cleanup (nothing existed before) and ERP posting-retry (logic existed, nothing ever called it). A new **Scheduled Jobs** section appears on the outbox ops screen, and a new **Retry** button appears on the Exception Workbench. The Pending Payments worklist's Age column now shows elapsed days instead of a raw timestamp. **Wallet and loyalty points expiry are NOT implemented** — documented gaps, not silent omissions (see B19's own Completion evidence for why).

> Where: **Internal Finance And Operations → Outbox Monitor** (`/dashboard/internal_fin/outbox`) — scroll below the event table for the new **Scheduled Jobs** card; **ERP-Lite → Exceptions** (`/dashboard/erp-lite/exceptions`) for the new Retry button; **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) for the reworked Age column.

| # | Where + how | Expected | Result |
|---|---|---|---|
|20.1| **Outbox Monitor** → scroll to **Scheduled Jobs** | Three rows: Gift-Card Expiry (02:00), Idempotency-Key Cleanup (03:00), ERP Posting Retry (hourly :15) — each shows "Never run" until the migration is applied and the first schedule fires (or a manual run is triggered) | |
|20.2| Click **Run Now** on Gift-Card Expiry (requires `finance_jobs:run`) | Row flips to a green SUCCESS badge with a processed/failed count within a few seconds; create a test gift card with `expiry_date` in the past first if you want a non-zero processed count — check the card's detail page shows status EXPIRED and a new EXPIRE ledger line | |
|20.3| Click **Run Now** on Idempotency-Key Cleanup | Row flips SUCCESS with a processed count (0 is a valid, expected result if nothing is past its retention window yet) | |
|20.4| Click **Run Now** on ERP Posting Retry with no eligible exceptions | Row flips SUCCESS with `0 processed, 0 failed` — a clean no-op, not an error | |
|20.5| Without `finance_jobs:run` (use the §12 no-new-codes login) | Run Now buttons are absent entirely (not disabled — hidden) | |
|20.6| Without `finance_jobs:view` | The whole Scheduled Jobs section does not render at all | |
|20.7| **ERP-Lite → Exceptions**, find any open exception (any type) | A **Retry** button appears in its row | |
|20.8| Click **Retry** on an exception whose underlying cause you have NOT fixed (e.g. still `ACCOUNT_NOT_FOUND`) | The retry attempts and fails again (expected — a config problem never self-heals); exception stays open with the fresh failure logged in Posting Audit | |
|20.9| Fix the underlying cause (e.g. add the missing usage mapping in **ERP-Lite → Usage Mapping**), then click **Retry** on the same exception | The row disappears from the open-exceptions list (status flipped to RETRIED); a new POSTED row appears in **ERP-Lite → Posting Audit** | |
|20.10| **Pending Payments** worklist, any row | Age column shows "X days" (or "Today") instead of a date/time string; hover shows the exact timestamp as a tooltip; rows 3+ days old render the age in bold amber | |
|20.11| **Pending Payments** worklist, filter by status = **Authorized** or **Captured** | Health tiles and rows still work correctly (empty today — see B08's dormancy note; this just confirms nothing broke when B19 extended the same worklist query) | |

**Automated gates at build time (2026-07-24, B19):** tsc clean (3 pre-existing unrelated errors, none in any B19 file) · eslint 0 (project-wide) · `finance-jobs.service.test.ts` new, 10 tests · `gift-card-service.test.ts` +7 new (`expireGiftCard`/`expireGiftCards`) alongside all 46 pre-existing cases unchanged · `erp-lite-exceptions-retry.service.test.ts` new, 2 tests · targeted jest 65/65 across the 3 touched/new suites · full jest **232/232 suites, 2243/2243 tests — zero known failures** · `npm run build` ✓ (exit 0, 3 new routes confirmed compiled) · `check:i18n` ✓ · `check:ui-access-contract --wire` PASS (`/dashboard/internal_fin/outbox`, `/dashboard/erp-lite/exceptions`) · `sync:ui-access-contract` PASS (144/144, drift 0). **Migration 0429 APPLIED (owner, 2026-07-24) to local + remote, verified via remote DB** — §20 above is ready to run once deployed to Preview.

---

## 21. B21 — Loyalty conversion rate

**What changed:** the loyalty settings screen gained a rounding-rule field; a real bug is fixed where the loyalty payment option never appeared in the payment modal for ANY tenant (silently excluded); mutation actions on the settings screen are now permission-gated.

> Where: **Marketing → Loyalty** (`/dashboard/marketing/loyalty`) for settings; the **payment modal's Customer Credits section** (any order, any customer with a loyalty balance) for the redemption fix.

| # | Where + how | Expected | Result |
|---|---|---|---|
|21.1| **Marketing → Loyalty**, note the current **Redeem rate** and **Minimum redeemable points**, then look for a new **Rounding rule** dropdown | Field present with 4 options (round up/down/nearest-up/nearest-down); defaults to "Round up" for existing tenants | |
|21.2| Ensure a test customer has a loyalty points balance ≥ the tenant's min-redeem threshold (adjust via **Marketing → Loyalty** or a prior order) → open a new order for that customer → open the payment modal's Customer Credits section | The **Loyalty Points** option now appears with a currency-value cap (e.g. "up to 5.00 OMR available") — **before this fix, it never appeared at all, for any tenant** | |
|21.3| Apply a loyalty leg for an amount whose computed points would fall below **Minimum redeemable points** | Rejected with a clear message — the redemption cannot go through for less than the configured floor | |
|21.4| Apply a loyalty leg for a valid amount and submit the order | Order settles; points debited match `ceil(amount / redeem_rate_per_point)` (or whichever rounding rule is configured) — never any relationship to a payment method's "Minimum amount" field | |
|21.5| As a user WITHOUT `loyalty:manage_config`, try to save a change on **Marketing → Loyalty** | Rejected server-side ("Permission denied: loyalty:manage_config") — before this fix, any authenticated user could save changes regardless of permission | |
|21.6| Set **Redeem rate** to 0 and try to save | Rejected with "Redeem rate must be greater than zero" (fails at the form, never reaches a raw DB constraint error) | |

**Automated gates at build time (2026-07-24/25, B21):** tsc clean (3 pre-existing unrelated errors, none in any B21 file) · eslint 0 (project-wide) · `loyalty.service.test.ts` +9 new (`roundLoyaltyPoints` all 4 rules, `resolveLoyaltyRedemptionPoints` rate/missing-config/zero-rate/below-min-redeem/legacy-defaults) alongside 14 pre-existing cases unchanged · full jest **233/233 suites, 2256/2256 tests — zero known failures** · `npm run build` ✓ (exit 0 — also confirms the transient owner-WIP build blocker noted in the B22 entry above is resolved) · `check:i18n` ✓ · `check:ui-access-contract --wire` PASS (`/dashboard/marketing/loyalty`) · `sync:ui-access-contract` PASS (144/144, drift 0). **Migration 0433 APPLIED (owner) to local + remote, verified via remote DB** — §21 above is ready to run once deployed to Preview.

---

## 22. B11 — Tax-inclusive calculation

**What changed:** order preview/submit now compute correct totals for TAX_INCLUSIVE tenants (tax extracted from the priced item, not added on top); the payment modal labels tax rows "— tax included" when the server confirms inclusive mode. A separate live bug was also fixed: an unconfigured/misconfigured tax rate no longer silently assumes 5% VAT (now zero-rates + logs a warning, matching the existing B15 policy).

> **DB/config prerequisite — no settings-screen toggle exists yet.** TAX_INCLUSIVE is dormant for every tenant until both of the following are set for the test tenant/branch: (1) the `tax_inclusive_pricing` feature flag enabled (HQ feature-flag console, or directly via `org_ff_overrides_cf`/plan mapping — there is no web-admin UI for this flag), and (2) `org_tenants_mst.tax_pricing_mode` (or the branch override on `org_branches_mst`) set to `'TAX_INCLUSIVE'` — currently only settable via direct SQL, since `/dashboard/settings/tax` has no pricing-mode field (out of B11's scope; the doc did not ask for one). Coordinate with the owner before running §22.1–22.3 on Preview.

> Where: **any order's payment step** (new order → Payment, or an existing order's Payments tab preview) for §22.1–22.2; **Marketing → any tenant without a configured tax profile** for §22.3 (the zero-rate regression).

| # | Where + how | Expected | Result |
|---|---|---|---|
|22.1| With the pilot tenant/branch set to `TAX_INCLUSIVE` + flag ON: build a new order with items, open the payment modal | Each tax row shows the rate and amount with a **"— tax included"** suffix; the grand total equals the sum of the priced item amounts exactly — nothing added on top | |
|22.2| Submit that order | Order submits without an `AMOUNT_MISMATCH` error (server recomputes identically to the preview); open the order's Financial tab → tax lines match the preview to the smallest currency unit | |
|22.3| For a tenant with `TAX_EXCLUSIVE` (the default — everyone until explicitly opted in), repeat the same order flow | Totals are byte-identical to pre-B11 behavior — VAT still shown added on top, no "tax included" label | |
|22.4| For a tenant with no `org_tax_profiles_cf` row configured AND no `TENANT_VAT_RATE` setting, build and submit an order | Order totals show **0% tax** (zero-rated) — **not** a silently-assumed 5% VAT. (This is the `tax.service.ts` fix — before B11, an unconfigured tenant would have been silently charged 5% VAT with no visible warning to the operator.) | |

**Automated gates at build time (2026-07-25, B11):** tsc clean (3 pre-existing unrelated errors, none in any B11 file) · eslint 0 (project-wide) · `tax-engine.service.test.ts` +7 new (single-profile/two-parallel-profile/compound-stack extraction, zero-rate no-op, no-profile-configured passthrough) · `order-calculation.service.test.ts` +5 new (profile-driven embedded VAT, profile-driven embedded CUSTOM, no-profile-fallback with ad-hoc additive surcharge, zero-rated no-op) · `tax.service.test.ts` new, 6/6 (configured rate, unset→zero+warn, unparsable→zero+warn, out-of-range→zero, resolution-throws→zero+warn, TTL cache) · `b11-tax-inclusive-consistency.test.ts` new, 3/3 (preview/submit/snapshot formula equality, incl. compound) · full jest **235/235 suites, 2277/2277 tests — zero known failures** · `npm run build` ✓ (exit 0) · `check:i18n` ✓ (new `newOrder.payment.tax.includedSuffix` key, EN/AR). No migration — schema/flag pre-existed from migration 0339; §22 above is a config-only rollout, not a deploy-blocked one.

---

## 23. B17 — Currency rounding runtime

**What changed:** order totals now actually apply a tenant currency's cash-rounding rule (`sys_currency_rounding_rules_cd`) — previously seeded but never consumed. The payment modal's rounding row now shows the real adjustment (was permanently hidden/hardcoded to 0) whenever a rule changes the total, independent of whether FX is also in play.

> **DB/config prerequisite — no settings-screen toggle exists yet.** Every seeded currency uses its *native* decimal increment today (e.g. OMR 0.001, SAR 0.01), which makes the adjustment mathematically 0 for every tenant — a true no-op, byte-identical to before this package. To see a real, non-zero adjustment on Preview, the owner needs to run a direct SQL update on the pilot currency's row, e.g.: `UPDATE sys_currency_rounding_rules_cd SET rounding_unit = 0.005 WHERE currency_code = 'OMR';` (revert with `rounding_unit = 0.001` afterward). Coordinate with the owner before running §23.1–23.2.

> Where: **any order's payment step** (new order → Payment) for the pilot-currency tenant.

| # | Where + how | Expected | Result |
|---|---|---|---|
|23.1| With the pilot currency's `rounding_unit` set to a non-native increment (e.g. 0.005): build an order whose pre-rounding total is NOT already a multiple of that increment, open the payment modal | The totals summary shows a rounding row with the actual delta (e.g. "+0.002"); the grand total is the rounded figure | |
|23.2| Submit that order | Order submits without an `AMOUNT_MISMATCH` error; open the order's Financial tab — the total shown matches the payment-modal preview exactly, including the rounding delta | |
|23.3| Revert the pilot currency's `rounding_unit` back to its native value (or leave any OTHER currency untouched), build and submit an order | Totals are byte-identical to pre-B17 behavior — no rounding row shown, no adjustment applied | |
|23.4| Edit an order that already has a persisted rounding adjustment WITHOUT changing items or triggering a recalculation (e.g. just update customer notes) | The order's rounding adjustment is preserved, not reset to 0 | |

**Automated gates at build time (2026-07-25, B17):** tsc clean (3 pre-existing unrelated errors, none in any B17 file) · eslint 0 (project-wide, incl. a transient cwd-drift false failure caught and re-run correctly) · `currency-rounding.test.ts` new, 11/11 (all 4 rounding modes, native/non-native increments, no-op guards on bad config, rule resolution incl. inactive/missing row and unknown-method fallback) · `order-calculation.service.test.ts` +4 new (no-op default, non-native increment with gift-card cap consistency, native-increment no-op, TAX_INCLUSIVE + rounding combined) · `b17-currency-rounding-consistency.test.ts` new, 3/3 (preview/submit/snapshot formula equality for exclusive, no-rule, and inclusive+rounding combined) · full jest **237/237 suites, 2295/2295 tests — zero known failures** · `npm run build` ✓ (exit 0) · `check:i18n` ✓ (no new keys). No migration — column and rules table both pre-existed; §23 above is a config-only rollout (one SQL UPDATE), not a deploy-blocked one.

---

## 24. B18 — Order charge write path (order-level preferences + redesigned entry UI)

**What changed:** the new-order page's Preferences → Service tab originally gained a "Whole Order" preference section, then that section and the item-level section were redesigned into a "kind toolbar" (a row of buttons, one per configured preference kind, opening a picker dialog — the same pattern piece-level preferences already use). Item-level additionally gained **packing preference** through the same toolbar. **Third iteration (2026-07-25, owner-directed, usability):** order-level preferences were relocated OUT of the Step-2 tab entirely, into a **"Preferences" pill in the sticky top bar** (next to Customer/Express), visible and clickable from every step of the New Order wizard — not just from a non-default sub-tab an operator has to remember to click. The Service Preferences tab is now **items only**: the old duplicate per-piece checkbox rows were also removed from this tab (piece-level preferences already have their own full experience in the "Edit Items Preferences" step). Every preference with a non-zero amount — order, item, or piece level — still writes a matching fact row into the order's charges ledger, unchanged from the original fix.

> **No DB/config prerequisite** — this is live for every tenant immediately, no flag, no data change needed. The fix is additive-only: nothing changes for an order unless an operator actually adds an order-level or item-level preference.

> **Known gap, not yet fixed:** orders created **before** this package shipped will still show a mismatch if reconciliation is run against them, since their preference charges were never backfilled into the ledger. This is intentional and owner-approved (fix-forward-only) — a separate backfill migration is a future, explicitly deferred follow-up requiring its own sign-off.

> **Known scope boundary:** order-level only offers service preferences (no order-wide packing option — set packing per item instead). Conditions (stain/damage) and color stay piece-only, by design — see B18 doc Design decisions #7 for why.

> Where: **order-level →** the **"Preferences" pill in the sticky top bar** (any step, any order, any tenant). **item-level →** new order page → step "2) Order Items" → **Preferences → Service Preferences tab**. **piece-level →** unchanged, step "3) Edit Items Preferences".

| # | Where + how | Expected | Result |
|---|---|---|---|
|24.1| New order → add at least one item → look at the sticky top bar (next to the Customer and Express pills) | A **"Preferences"** pill is visible on every step (not just Step 2) | |
|24.2| Click the "Preferences" pill | A dialog titled "Whole Order" opens showing a row of kind buttons (e.g. "Service Preferences") | |
|24.3| In the dialog, click the "Service Preferences" kind button, then pick one with a non-zero price | The picker closes, the preference shows as a removable chip in the dialog, and the order total updates live to include the amount (the item subtotal is unaffected — the charge is a separate line internally) | |
|24.4| Close the dialog, switch steps (e.g. to "1) Select Items" or "3) Edit Items Preferences"), then look at the top bar again | The "Preferences" pill still shows a numeric badge (count of applied order-level preferences) — proves it isn't tied to Step 2 | |
|24.5| Reopen the dialog and remove the chip via its × button | The preference is removed, the badge disappears (count 0), and the order total updates live | |
|24.6| Step "2) Order Items" → Preferences → Service Preferences tab | There is **no "Whole Order" section here anymore** (moved to the top bar pill) — the tab shows only the per-item cards | |
|24.7| For any item, look at its card inside the Service Preferences tab | The item shows its own kind toolbar offering **both Service Preferences and Packing** — pick a packing option and confirm it appears as a chip with its price | |
|24.8| For a tenant that tracks by piece: open an item that has pieces, inside the Service Preferences tab | The item's toolbar is labeled **"Whole item"**; there is **no per-piece checkbox list below it anymore** (that duplicate was removed — per-piece preferences are entered exclusively in step "3) Edit Items Preferences", unchanged) | |
|24.9| Add an order-level preference with a non-zero price (e.g. 0.500 OMR) via the top-bar pill, then open the Payment modal (click the green Submit/checkout button), staying on the default **Simple** face | **The Receipt panel shows an itemized breakdown**: a "Subtotal" row, then an **"Extra Charges"** row showing the 0.500, then the "Order Total" row (bold) including it — it is not missing or silently folded in | |
|24.10| With that same order-level preference applied, complete the payment and click Submit in the modal | **No "Amount Mismatch Detected" dialog appears** — the order submits cleanly (previously the client showed a value 0.500 lower than the server and blocked submission) | |
|24.11| Open the Payment modal (Simple face) for a PLAIN order — no discount, no order-level preference, no promo | **The Subtotal/breakdown panel still shows** (Subtotal row at minimum) above the Order Total row — it is no longer hidden just because there's nothing to discount; matches how the Advanced/Full face's Financial Inspector already always shows it | |
|24.12| Submit an order with an order-level preference (via the top-bar pill), an item-level packing choice, and at least one piece-level preference (from step 3) | Order submits without error; open the order's Financial tab — the total matches what was previewed | |
|24.13| (Owner/finance only) Run reconciliation for a NEWLY submitted order from this build that has a preference charge | `ORDER_CHARGES_MATCH_SNAPSHOT`, `ORDER_PIECES_MATCH_CHARGES`, `ORDER_PREFERENCES_MATCH_CHARGES`, and `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE` are all clean for that order (see the "known gap" note above for orders predating this build) | |

**Automated gates at build time (2026-07-25, B18 — top-bar pill redesign, 3rd iteration):** tsc clean (same pre-existing unrelated errors as every prior package this session, none newly introduced) · eslint 0 (both targeted on changed files and project-wide) · `check:i18n` ✓ (new `newOrder.topBar.orderPreferences` / `orderPreferencesAria` and `newOrder.preferences.orderLevelPrefsDialogDesc` keys added to EN+AR, parity confirmed) · **`npm run build` ✓ (exit 0)**. No new automated unit tests for this iteration (pure relocation of an existing, already-tested UI pattern — `LevelPreferenceCard` and its backend write path are unchanged; verified via tsc/eslint/build + manual code review). §24 above is fully runnable once deployed to Preview.

**Automated gates at build time (2026-07-25, B18 — payment-modal + running-total consistency fix, 4th iteration; owner-reported "not show in payment model" + `AMOUNT_MISMATCH` defect):** root cause was the client preview fetch (`usePaymentTotals`) never sending `orderServicePrefs` to `/api/v1/orders/preview-payment`, so the modal total (and the `clientTotals.saleTotal` it feeds into submit) excluded the order-level charge while the submit orchestrator's own server calc included it → guaranteed mismatch. Fix threads `orderServicePrefs` through `new-order-modals → PaymentModalV4 → PaymentFullView → usePaymentEngine → usePaymentTotals` and adds the charge to the workspace running-total display. tsc clean (same 3 pre-existing unrelated errors, none newly introduced) · eslint 0 (changed files) · **`npm run build` ✓ (exit 0)**. No new unit tests (client wiring fix; behavior verified against the existing preview/submit server calc, which already handled `orderServicePrefs`). Scenarios 24.9–24.10 above specifically cover this fix.

**Automated gates at build time (2026-07-25, B18 — order-charges itemized + always-visible receipt breakdown, 5th iteration; owner follow-up):** `use-payment-totals.ts` now reads the preview response's existing `chargesTotal` field into `ServerTotals`/`totals`; `payment-full-view.tsx` adds an "Order preferences" gross row to `orderValueBreakdownModel` when non-zero; `payment-simple-view.tsx`'s receipt breakdown panel is now rendered **unconditionally** (previously gated on `discountRows.length > 0`, hiding the subtotal/tax story on every order without a discount — owner explicitly rejected a narrower "or has a charge" gate and asked for a permanent fix). tsc clean on all touched files (`use-payment-totals.ts`, `payment-full-view.tsx`, `payment-simple-view.tsx`) · eslint 0 (targeted) · `check:i18n` ✓ (new `newOrder.payment.summary.orderCharges` key, EN+AR parity confirmed). **`npm run build` currently FAILS — confirmed NOT from this fix or any B18 file.** The only compile error is a genuine JSX syntax error in `app/dashboard/preparation/[orderId]/page.tsx:168` (`Expected '</', got 'orderId'`), inside your own uncommitted, in-progress `WorkflowActionBar` integration (that file + `lib/hooks/use-workflow-actions.ts` + `src/features/workflow/ui/WorkflowActionBar.tsx` were already modified, uncommitted, before this session started — confirmed via `git status`). Not fixed here — same handling as the assembly-exceptions and workflow-engine build blockers earlier this session. Scenarios 24.9 and 24.11 above cover this fix; re-run `npm run build` once your `WorkflowActionBar` edit is finished to confirm end-to-end.

---

## 25. B12 — Order Amendment and Financial Delta (backend + gate + frontend reason/delta UI — settlement stays manual by design)

**What changed:** editing items on an order that already has payments recorded (via the New Order page's Edit Order flow, `/dashboard/orders/{id}/edit`) used to silently reprice the total with no reason, no delta record, and — for one write, before a redundant recalc corrected it — a wrong `outstanding_amount` (ignored `total_paid_amount` entirely). Behind the new `order_fin_governed_amendments` flag (**default OFF**), such an edit now requires a reason (collected via a new dialog) and an idempotency key, is permission-gated (`orders:post_settlement_edit`), computes a signed financial delta, records it against the existing `org_order_edit_history` table, and shows the operator the resulting delta before returning to the order.

> **Migration 0438 is APPLIED (owner, 2026-07-25), verified via remote DB.** Flag is OFF for every tenant today — the whole governed path (reason prompt, delta notice) has zero effect until an owner opts a pilot tenant in via direct DB/flag config (no settings-UI toggle exists for this flag yet). Once on, the reason-prompt and delta-notice steps ARE reachable through the New Order page's Edit Order UI (§25.11–25.13 below) — this is no longer API-only. The actual collection/refund step is intentionally **manual**, via the order's existing Payments tab: automating it was evaluated (reusing `OrderCollectPaymentModal`) and found unsafe for the common case (that modal's `collectPaymentTx` only accepts `PAY_ON_COLLECTION` orders with `outstanding_amount > 0` — see B12 doc, Design decision #13), so the delta notice deliberately tells the operator the amount and points them at Payments instead of silently failing.

> **No DB prerequisite for the fix that IS live:** the `outstanding_amount` correctness fix in `OrderService.updateOrder` ships unconditionally (not flag-gated) — any order edit today already benefits from it, silently, with no visible change.

| # | Where + how | Expected | Result |
|---|---|---|---|
|25.1| (Owner/dev only, API-level) With the flag OFF (default), edit items on any order via the New Order page's Edit Order flow (`/dashboard/orders/{id}/edit`) as usual | Behaves exactly as before — no reason prompt, no idempotency requirement, no visible change. Confirms the flag-off path is untouched | |
|25.2| (Owner/dev only) Edit items on an order that has `total_paid_amount > 0`, without the flag on | Repricing succeeds; `org_orders_mst.outstanding_amount` correctly reflects `total - paid` (not the raw new total) — the fix from Design decision #5 applies regardless of the flag | |
|25.3| (Dev/API-level, once flag is enabled for a pilot tenant) Call `PATCH /api/v1/orders/[id]/update` with an `items` array that changes the total, on a paid order, WITHOUT `editReason` | `400` with `errorCode: "EDIT_REASON_REQUIRED"` | |
|25.4| Same call, WITH `editReason` but without `idempotencyKey` | `400` with `errorCode: "IDEMPOTENCY_KEY_REQUIRED"` | |
|25.5| Same call, WITH both, but the actor lacks `orders:post_settlement_edit` | `403` with `errorCode: "PERMISSION_DENIED"` | |
|25.6| Same call, fully valid (reason + idempotency key + permission), repeated twice with the SAME idempotency key and SAME body | Second call returns `idempotentReplay: true` with the same `editHistoryId` — no duplicate `org_order_edit_history` row, no duplicate repricing | |
|25.7| Same call, repeated with the SAME idempotency key but a DIFFERENT body (e.g. different items) | `409` with `errorCode: "IDEMPOTENCY_CONFLICT"` | |
|25.8| Valid governed edit that increases the total | Response includes `financialDelta.deltaAmount > 0`, `requiresSettlement: true`, `editHistoryId` | |
|25.9| POST `/api/v1/orders/[id]/edit-history/[editHistoryId]/settlement` with `{paymentAdjustmentType: "CHARGE", paymentAdjustmentAmount: <delta>, settlementLineage: {paymentId: "<a real payment id>"}}` | `200`; the `org_order_edit_history` row now has `payment_adjusted: true` and `settlement_lineage` populated | |
|25.10| Repeat 25.9 on the same `editHistoryId` | `200` with `alreadySettled: true` — no double-write (the row is immutable once settled) | |
|25.11| (Owner, once flag enabled for a pilot tenant) Open a paid order (`total_paid_amount > 0`) via **Orders → All Orders**, click it, then **Edit** to reach `/dashboard/orders/{id}/edit`. Change the items so the total changes, then click **Save Changes** | A "Reason required" dialog opens (does NOT save yet) — a textarea asking for a reason, with a hint requiring at least 5 characters; **Cancel** and **Save with reason** buttons | |
|25.12| In the dialog from 25.11, click **Save with reason** with fewer than 5 characters typed | The confirm action stays disabled/blocked until the minimum length is met (no partial save) | |
|25.13| In the dialog from 25.11, type a valid reason (e.g. "Customer requested an extra item") and click **Save with reason** | Save proceeds; a delta notice dialog then appears showing the previous total, the new total, and the delta amount, with guidance text pointing to the order's Payments tab to collect (increase) or refund/credit (decrease) the difference; click **Got it** to return to the order | |
|25.14| After 25.13, open the order's edit-history / audit trail | The new edit row shows the reason entered in 25.11–25.13 alongside the before/after totals | |
|25.15| Repeat 25.11–25.13 in Arabic (header language switch → AR) | Both dialogs render correctly RTL — text alignment, textarea direction, and button order all mirror correctly; no layout breakage | |
|25.16| (Owner, negative-delta case) Remove items from a paid order to decrease the total, past the reason dialog | Delta notice shows a decrease title/guidance (owed back to the customer) instead of the increase wording — confirms the dialog's increase/decrease branching, not just the increase path | |

**Automated gates at build time (2026-07-25, B12 — backend implementation):** tsc clean (same 3 pre-existing unrelated errors — `order-service.ts` ×2, `processing-piece-row.tsx` ×1 — plus 1 new unrelated one from the owner's own separate, actively-in-progress "Workflow_Order_Advance" feature, `order-actions.tsx:275`, confirmed via `git status` that the file itself is unmodified; none of the 4 in any B12 file) · eslint 0 (all B12 files) · `check:i18n` ✓ (no new keys — no new UI text) · full jest **241/241 suites, 2329/2329 tests, zero known failures** (+17 new in `order-amendment.service.test.ts`) · **`npm run build` ✓ (exit 0, full route tree compiled)** — the earlier `WorkflowActionBar` build blocker (unrelated owner WIP) self-resolved between checks, same pattern as the two earlier such incidents this session. Migration `0438_b12_order_amendment_lineage_and_flag.sql` — **APPLIED (owner, 2026-07-25), verified via remote DB** (`edit_reason`/`settlement_lineage` columns present; flag row live, default OFF).

**Automated gates at build time (2026-07-25, B12 — frontend follow-up, same session: `AmendmentReasonDialog` + `AmendmentDeltaNotice`):** tsc clean relative to this change — 4 total project errors remain, all pre-existing/unrelated (2 in an unrelated `order-service.ts` issue-sort helper, confirmed via `git diff` that section isn't part of this change; 1 in `order-actions.tsx`, 1 in `processing-piece-row.tsx`, both untouched, from the owner's separate concurrent Workflow_Order_Advance WIP) · eslint 0 on the 4 changed files · `check:i18n` ✓ (new `orders.edit.amendment.reasonDialog.*` / `.deltaNotice.*` keys, EN+AR parity confirmed) · full jest **241/241 suites, 2329/2329 tests, zero known failures** (same count as the backend-only pass — no regressions) · **`npm run build` ✓ (exit 0, full route manifest generated)**. Scenarios 25.11–25.16 above are the new UI-level coverage this pass makes runnable; 25.1–25.10 remain the API-level contract checks.

---

## Sign-off
| Package | Preview deployed | QA result | Approved by / date |
|---|---|---|---|
| B15 | | | |
| B01 | | | |
| B02 | | | |
| B33 | | | |
| B34 | | | |
| B16 | | | |
| B35 | | | |
| B20 | | | |
| B29 | n/a (docs-only) | | |
| B4 | | | |
| B5 | | | |
| B31 | | | |
| B7 | blocked on migration 0410 apply | | |
| B27 | blocked on migration 0411 apply | | |
| B3 | migration 0412 applied; backend + tender-step UI implemented, not yet deployed to Preview | | |
| B30 | migration 0415 applied (owner, 2026-07-23); implemented, not yet deployed to Preview | | |
| B32 | migration 0415 applied (owner, 2026-07-23, shared with B30); implemented, not yet deployed to Preview | | |
| B9 | migration 0418 applied (owner) and committed (1d31887e); implemented, not yet deployed to Preview | | |
| B10 | migration 0421 applied (owner, 2026-07-24), verified via remote DB; implemented, not yet deployed to Preview | | |
| B6 | migration 0424 applied (owner, 2026-07-24), verified via remote DB; implemented, not yet deployed to Preview | | |
| B8 | migration 0426 applied (owner, 2026-07-24), verified via remote DB; implemented, not yet deployed to Preview | | |
| B19 | migration 0429 applied (owner, 2026-07-24), verified via remote DB; implemented, not yet deployed to Preview | | |
| B22 | no migration (pure TS refactor, zero behavior change) — build gate was transiently blocked by unrelated owner WIP, confirmed resolved as of the B21 gate run; no new manual QA scenarios (existing refund-list scenarios already cover the touched screen; a smoke-check that Refunds list badges/actions still render correctly on Preview is sufficient) | | |
| B21 | migration 0433 applied (owner), verified via remote DB; extends the existing loyalty settings screen (no new screen) | | |
| B11 | no migration (schema/flag pre-existed from 0339); requires direct DB config (no settings UI) to opt a pilot tenant into TAX_INCLUSIVE before §22 is runnable on Preview | | |
| B17 | no migration (column + rules table pre-existed); requires a direct SQL UPDATE on one currency's `rounding_unit` (no settings UI) to see a non-zero adjustment before §23 is meaningfully runnable on Preview | | |
| B18 | no migration; live for every tenant immediately, no config needed; the earlier unrelated assembly-exceptions build blocker (owner's own WIP) is resolved, build green; top-bar pill UI redesign is the current (3rd) iteration — not yet deployed to Preview; 67 pre-existing orders intentionally NOT backfilled (owner-approved fix-forward-only, flagged as a separate future package) | | |
| B12 | migration 0438 APPLIED (owner, 2026-07-25), verified via remote DB; backend/API/gate + frontend reason-prompt/delta-notice UI fully implemented and tested; settlement automation deliberately NOT built (real `collectPaymentTx` PAY_ON_COLLECTION-only blocker, see Design decision #13 — operator settles manually via the order's Payments tab); flag `order_fin_governed_amendments` defaults OFF, zero effect on any tenant; §25 above covers both API-level (25.1–25.10) and UI-level (25.11–25.16) scenarios | | |

**Automated gates at build time (2026-07-20, all green where run):** tsc clean · eslint 0 (project-wide) · cash-drawer jest 39/39 · close-preview 3/3 · inventory/access 11/11 · reconciliation 66/66 (+2 new B3 checks) · settlement/collect-payment + wiring-handler suites 51/51 · outbox/outbox-processor/loyalty-earn suites 26/26 · B27 permission suites 16/16 · B3 suites 31/31 (fundStoredValue/finalizer 11, wiring handlers 7, reconciliation check 5, +8 from fixing 2 pre-existing suites' Prisma mocks that predated `org_sv_funding_tenders_dtl`) · full jest **220/220 suites, 2108/2108 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0, zero warnings). B3's Preview deployment is still pending (see B03 Completion evidence). This manual guide covers the end-to-end behaviour those unit gates can't.

**Automated gates at build time (2026-07-23, B30/B32):** tsc clean (2 pre-existing unrelated errors untouched) · eslint 0 (project-wide) · `payment-transition.service.test.ts` 19/19 · `cash-drawer-wiring.handler.test.ts` 7/7 · reconciliation check-modules +2 · planner/collect-payment investigation pinning tests +2 · full jest **222/222 suites, 2135/2135 tests — zero known failures** (one transient Windows Prisma query-engine file-lock flake on the first run, self-resolved on retry, not a code issue) · check:i18n ✓ · build ✓ (exit 0) · check:ui-access-contract --wire PASS · sync:ui-access-contract PASS (144/144 routes, drift 0) · check:platform-info-inventories PASS. **Migration 0415 APPLIED (owner, 2026-07-23) to local + remote, verified via remote DB** — B30/B32's permission codes, audit columns, and worklist nav entry are all live; §15 above is ready to run once deployed to Preview.

**Automated gates at build time (2026-07-23, B9):** tsc clean (same pre-existing unrelated errors) · eslint 0 · `order-refund-b9-execution.test.ts` 8/8 · `order-refund-cash-drawer-wiring.handler.test.ts` 9/9 · reconciliation check-modules +4 · all 31 pre-existing `refund-b01-matrix.test.ts` scenarios re-run and pass unchanged (zero regression to the flag-off path) · full jest **224/224 suites, 2156/2156 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0). Migration 0418 was subsequently **APPLIED (owner)** and committed together with B10's session — §16 above is now runnable once deployed to Preview.

**Automated gates at build time (2026-07-24, B10):** tsc clean (2 pre-existing unrelated errors untouched) · eslint 0 (project-wide) · `payment-transition.service.test.ts` +17 new (VOID/REVERSE legality, idempotency-payload, cash-session-required/not-open, compensating-movement lineage, orphan-movement trip-wire) · reconciliation check-modules +5 (`VOIDED_PAYMENT_NO_ORPHAN_MOVEMENT` ×2, `REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT` ×3) · full jest **224/224 suites, 2173/2173 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0) · check:ui-access-contract --wire PASS (`/dashboard/internal_fin/pending-payments`, `/dashboard/orders/[id]`) · sync:ui-access-contract PASS (144/144 routes, drift 0). Migration **0421 is authored (STOP-AND-WAIT)** — §17 below is not testable until the owner applies it.
