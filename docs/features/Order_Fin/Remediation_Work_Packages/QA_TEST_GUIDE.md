# Order Fin Remediation — Manual QA Test Guide

**Living document — updated after every implemented package.** Last update: 2026-07-20.
**Scope:** all implemented-but-not-yet-verified remediation packages awaiting Preview QA — **B01, B02, B33, B34, B15, B16, B35, B20, B29, B4, B5, B31, B7, B27, B3 (backend core only — see §14 header)**. Run on **Preview** (never straight to production).

> **How to use:** work top-to-bottom. Each scenario tells you **where to go** (sidebar path + URL), **what to do**, the **expected** result, and a **Result** cell — mark `PASS` / `FAIL` / `N/A` + notes. A package is not `VERIFIED` until every scenario passes on Preview and the owner records approval in the package's Completion evidence.

---

## 0. Prerequisites & environment

| Item | Value / action |
|---|---|
| Environment | Preview deployment (post-commit) |
| Migrations applied | up to **0415**. **Migration 0410 (B7), 0411 (B27), 0412 (B3), and 0415 (B30/B32) are all APPLIED (owner, 2026-07-20/2026-07-23) and verified via remote DB.** Section 15's permission codes and worklist nav entry are live and ready to test. Section 11 (Outbox Monitor) cannot be tested until `FINANCE_OUTBOX_SECRET` is set from the generated `sys_fin_runtime_cf` value; Section 14 (B3) needs the `order_fin_sv_funding_capture` flag ON. |
| Feature flags (HQ console) | `order_fin_refund_ui` = **ON** for the test tenant to exercise B34 (OFF to confirm it stays hidden). `order_fin_sv_funding_capture` = **ON** to exercise B3's tender step (OFF to confirm the 3 entry points fall back to their pre-existing behavior unchanged — see §14). *(The old `order_fin_drawer_close_v2` flag was removed — B16/B35 drawer math is always on.)* **B30/B32 ship unconditionally, no feature flag.** |
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

**Automated gates at build time (2026-07-20, all green where run):** tsc clean · eslint 0 (project-wide) · cash-drawer jest 39/39 · close-preview 3/3 · inventory/access 11/11 · reconciliation 66/66 (+2 new B3 checks) · settlement/collect-payment + wiring-handler suites 51/51 · outbox/outbox-processor/loyalty-earn suites 26/26 · B27 permission suites 16/16 · B3 suites 31/31 (fundStoredValue/finalizer 11, wiring handlers 7, reconciliation check 5, +8 from fixing 2 pre-existing suites' Prisma mocks that predated `org_sv_funding_tenders_dtl`) · full jest **220/220 suites, 2108/2108 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0, zero warnings). B3's Preview deployment is still pending (see B03 Completion evidence). This manual guide covers the end-to-end behaviour those unit gates can't.

**Automated gates at build time (2026-07-23, B30/B32):** tsc clean (2 pre-existing unrelated errors untouched) · eslint 0 (project-wide) · `payment-transition.service.test.ts` 19/19 · `cash-drawer-wiring.handler.test.ts` 7/7 · reconciliation check-modules +2 · planner/collect-payment investigation pinning tests +2 · full jest **222/222 suites, 2135/2135 tests — zero known failures** (one transient Windows Prisma query-engine file-lock flake on the first run, self-resolved on retry, not a code issue) · check:i18n ✓ · build ✓ (exit 0) · check:ui-access-contract --wire PASS · sync:ui-access-contract PASS (144/144 routes, drift 0) · check:platform-info-inventories PASS. **Migration 0415 APPLIED (owner, 2026-07-23) to local + remote, verified via remote DB** — B30/B32's permission codes, audit columns, and worklist nav entry are all live; §15 above is ready to run once deployed to Preview.
