# Order Fin Remediation — Manual QA Test Guide

| Website address | https://cmx.cleanmatex.com/ |
| **Main** username / password | admin@demo-laundry.example/Admin123 |
| **Limited** username / password *(fewer permissions)* | operator@demo-laundry.example/Operator123 |
| **View-only** username / password *(optional)* | viewer@demo-laundry.example/Viewer123 |
| Currency you should see | OMR |


**QA RE-TEST COMPLETE (Financial_Expert_Tester), 2026-09-16 evening Asia/Muscat:** §3.1/§14.3/§2.3/§12.4/§12.5/§12.7 PASS (§12.7 owner-verified). §2.5 Cancel-on-Processing and recon tax noise still open. Prior **QA RUN COMPLETE (Financial_Expert_Tester), 2026-09-16 Asia/Muscat:** Preview pass finished. Earlier note — **Preview QA run (Financial_Expert_Tester), 2026-09-12 Asia/Muscat:** Tier 1 mostly executed on https://cmx.cleanmatex.com/ (Demo Laundry LLC / admin). Results filled in scenario Result cells below. Open FAILs/BLOCKEDs: §3.1 receipt-voucher outstanding mismatch; §14.3 gift-card sell amount 0.000; §2.3 no Refund-and-Rebill UI; §2.5 no Cancel on Processing; recon RECON-2026-002 tax blockers. Owner-needed: DB variance threshold for §6.4+/§28.4+; migration 0443 still pending per guide; second-login denial paths run as Operator Demo 1 — FAIL on 12.4/12.5/12.7 (ungated Top Up / Advance / Credit Note / price override).

**2026-09-17 code/docs correction (do not treat the 2026-09-12 P0 list as still open):** §3.1/§14.3/§2.3/§12.4/§12.5/§12.7 were retested PASS. §2.5 is ADR (Cancel must not appear at Processing). Migration **0443 APPLIED** (`order_fin_refund_execution` default **true**). Migration **0506 APPLIED** (`order_fin_voucher_unwind` default **false**). Variance-threshold field and recon `total_checked` UI shipped in code — **retest on Preview after this deploy** (§6.4–6.7, §8.2, §30).

**Living document — updated after every implemented package.** Last update: **2026-09-17** (B13 v1 §30 added; §6.4 threshold UI; §8.2 totals UI; 0443/0506 APPLIED). Previously 2026-08-15: §28 maker-checker removal.
**Scope:** all implemented-but-not-yet-verified remediation packages awaiting Preview QA — **B01, B02, B33, B34, B15, B16, B35, B20, B29, B4, B5, B31, B7, B27, B3, B30, B32, B9, B10, B13 (v1 — §30), B6, B8, B19, B22, B21**. Run on **Preview** (never straight to production).

> **How to use:** each scenario tells you **where to go** (sidebar path + URL), **what to do**, the **expected** result, and a **Result** cell — mark `PASS` / `FAIL` / `N/A` + notes. A package is not `VERIFIED` until every scenario passes on Preview and the owner records approval in the package's Completion evidence.
>
> ⚠️ **Do NOT work top-to-bottom.** This guide holds **209 scenarios (~10–17 hours)**. Use the triage below — Tier 1 is ~40 scenarios (~2.5 h) and covers the live money paths that actually gate a release.

---

## 0.0 ▶ RUN THIS FIRST — release-gate triage (added 2026-08-14)

Sections are ordered by **risk**, not by package number. Tiers 3 and 4 are **not release blockers**.

### 🔴 Tier 0 — do before starting (otherwise QA is wasted)
| Action | Why |
|---|---|
| Confirm migrations **0443** and **0506** are applied (owner, 2026-09-17, local + remote) | 0443 registered `order_fin_refund_execution` + `tax_inclusive_pricing`. 0506 registered `order_fin_voucher_unwind` (default **false**) |
| Enable `order_fin_voucher_unwind` **on Preview only** before §30 | Flag-ON B13 v1 is unrunnable while the catalog default stays false |
| Note the corrected flag states below | Several sections previously documented as missing/OFF are now **LIVE** |

**Corrected flag prerequisites** (0443/0506 verified on remote `hq_ff_feature_flags_mst`, 2026-09-17; earlier live flags from 2026-08-14):

| Flag | Guide previously said | Actual | Effect |
|---|---|---|---|
| `order_fin_refund_ui` (§5) | default OFF | **`true`** | §5 is **live** — must test |
| `order_fin_sv_funding_capture` (§14) | default OFF | **`true`** | §14 is **live** — must test |
| `order_fin_governed_amendments` (§25) | default OFF | **overridden `true`** for 2 tenants | §25 is **live** — must test |
| `order_fin_refund_execution` (§16) | missing from DB / default OFF | **0443 APPLIED, catalog default `true`** | §16 is **live** — must test |
| `tax_inclusive_pricing` (§22) | missing from DB | **0443 APPLIED, default `false`** | §22.1–22.2 still need HQ enable + `TAX_INCLUSIVE` mode |
| `order_fin_voucher_unwind` (§30) | (not in guide) | **0506 APPLIED, default `false`** | §30 flag-ON needs Preview override; flag-OFF is live (document-only reverse) |
| `erp_lite_enabled` (§18) | — | `false`, no overrides | §18 correctly dormant → Tier 3 |

### ✅ Tier 1 — MUST pass before release (~48 scenarios, ~3 h)
Live for every tenant, no config needed, and they touch money on every order.

| § | Package | Why Tier 1 |
|---|---|---|
| §1 | B15 — currency defaults & tolerances | ships unconditionally; affects all money formatting |
| §2 | B01 — refund lineage & reopen-due | core refund correctness |
| §3 | B02 — outstanding formula | the formula every balance depends on |
| §5 | B34 — refund back-office UI | **flag is ON** |
| §13 | Cross-cutting regression | catches wave-level breakage |
| §14 | B3 — stored-value funding capture | **flag is ON** |
| §24 | B18 — order charge write path | live for every tenant, no config |
| §25 | B12 — order amendment & delta | **flag overridden ON** for 2 tenants |
| §27 | B28 — tax-override removal + idempotency | live now; expected result is **no visible change** |
| §28 | Maker-checker removal | live now; **§5.4 and §6.5 now expect the opposite of before** — read §28 first so correct behaviour isn't reported as a bug |

### 🟡 Tier 2 — should pass before release (~65 scenarios, ~4 h)
Live, but narrower blast radius or back-office only: **§6** (B16 — **§6.4–6.7 retest after this deploy**), **§7** (B35), **§8.2** (B20 totals UI — retest after this deploy), **§10** (B4/B5/B31), **§12** (B27), **§15** (B30/B32), **§16** (B9 — **live**, 0443 applied), **§17** (B10), **§21** (B21), **§30** (B13 v1 — Preview flag ON).

### ⏸️ Tier 3 — safe to defer (NOT release blockers, ~63 scenarios)
Flag-off, dormant, or needing pilot-tenant DB config — verified unreachable for any tenant today:
**§18** (B6 — `erp_lite_enabled=false`), **§19** (B8 — no gateway configured), **§22** (B11 — flag exists after 0443, still default OFF + needs `TAX_INCLUSIVE` mode), **§23** (B17 — needs a non-native `rounding_unit` SQL update), **§26** (B14 — needs `tax_registration_no` + an enabled trigger row).

### 🔧 Tier 4 — not manual QA (~23 scenarios)
Pure SQL/DB verification, better run as a script than by a person: **§8** (B20), **§9** (B29 — docs-only), **§11** (B7), **§20** (B19).

---

## 0. Prerequisites & environment

| Item | Value / action |
|---|---|
| Environment | Preview deployment (post-commit) |
| Migrations applied | up to **0506** (owner, 2026-09-17, local + remote). Includes 0443 (`order_fin_refund_execution` + `tax_inclusive_pricing`) and 0506 (`order_fin_voucher_unwind`). Prior Order Fin migs 0410–0443 already applied. Section 11 (Outbox Monitor) cannot drain until `FINANCE_OUTBOX_SECRET` is set from `sys_fin_runtime_cf`; Section 19 (B8) has no live gateway. |
| Feature flags (HQ console) | `order_fin_refund_ui` = **ON**. `order_fin_sv_funding_capture` = **ON**. `order_fin_refund_execution` = **ON** (0443 catalog default true). `order_fin_voucher_unwind` = **OFF** everywhere except Preview when running §30. *(The old `order_fin_drawer_close_v2` flag was removed — B16/B35 drawer math is always on.)* **B30/B32 ship unconditionally, no feature flag.** |
| Permissions | tester needs the refund permissions (initiate/approve/process) for B34, and `cash_drawer:approve_variance` for B16 §6.5–6.6 and §12.1 (seeded by **B27**, migration 0411, APPLIED). For §12, prepare a **third** login with none of the new B27 codes granted, to exercise the denial paths. For §15 (B30/B32), the tester also needs `orders:pending_payments_view` / `orders:cancel_payment` / `orders:fail_payment` (seeded by migration **0415**, APPLIED); reuse the §12 no-new-codes login to exercise the denial paths there too. |
| Users | prepare **two** logins: an **initiator/cashier** and a **supervisor/approver**. **Note (2026-08-14): maker-checker was removed** — a user holding the permission may approve their own refund or drawer variance. The second login is still useful for permission-denial testing (§12) and for confirming approval works for a different user, but it is no longer *required* to approve anything. |
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
| Business Vouchers (B13 reverse) | **Internal Finance And Operations → Business Vouchers** | `/dashboard/internal_fin/vouchers` |
| Reconciliation | **Internal Finance And Operations → Reconciliation** | `/dashboard/internal_fin/reconciliation` |
| Outbox Monitor (B7) | **Internal Finance And Operations → Outbox Monitor** | `/dashboard/internal_fin/outbox` |
| Pending Payments worklist (B30/B32) | **Internal Finance And Operations → Pending Payments** | `/dashboard/internal_fin/pending-payments` |
| Tenant currency | **Config And Settings → Tenant Settings** (or **Finance**) | `/dashboard/settings/tenant` · `/dashboard/settings/finance` |
| Tax setup | **Config And Settings → Tax Setup** | `/dashboard/settings/tax` |
| Payment / drawer setup | **Config And Settings → Payment Setup** | `/dashboard/settings/payments` |

> Language toggle: use the header language switch (EN ⇄ AR) — Arabic must render right-to-left.

### 0.1b Mapping — [`QA_TESTER_SHEET.md`](QA_TESTER_SHEET.md) → this guide (rebuilt 2026-08-15)

Two companion files exist for delegating Preview QA:

| File | For | Contents |
|---|---|---|
| [`QA_TESTER_SHEET_OWNER_SETUP.md`](QA_TESTER_SHEET_OWNER_SETUP.md) | **owner — do first** | migration/flag/config/login prep, plus the owner-only residual list |
| [`QA_TESTER_SHEET.md`](QA_TESTER_SHEET.md) | non-technical tester | **94 tests across 17 parts**, plain language, covering every UI-reachable scenario |

**Coverage:** of this guide's 217 scenarios, ~190 are UI-reachable and are covered by the tester sheet once the owner setup is done. The ~27 that are not delegable (raw SQL, direct API calls, injected corruption, locale sweeps) are listed in the setup file's **section E** and remain with the owner.

> **A completed tester sheet + the owner's section-E residual = a complete Preview QA pass** for the packages involved. Neither half alone is sufficient for `VERIFIED`.

| Sheet part | Tests | Guide sections covered |
|---|---|---|
| 1 — Getting started | 1–2 | §13.1, §13.4 |
| 2 — Creating & paying | 3–8 | §1.1, §1.5, §1.6, §3.1, §13.1 |
| 3 — Extra options that cost money | 9–16 | §24.1–24.12 |
| 4 — Numbers agree ⭐ | 17–20 | §3.1–3.3, §4.1 |
| 5 — Changing a paid order | 21–26 | §25.11–25.16 |
| 6 — Refunds | 27–35 | §2.1–2.6, §5.2–5.5, §28.1–28.3 |
| 7 — Cash drawers | 36–47 | §6.1–6.8, §7.1–7.5, §12.1–12.2, §28.4–28.6 |
| 8 — Customer money | 48–55 | §1.2, §1.3, §14.1–14.6, §12.3–12.5 |
| 9 — Pending payments | 56–64 | §15.1–15.13 |
| 10 — Collecting later | 65–69 | §10.1–10.8 |
| 11 — Background processing | 70–75 | §11.1–11.7 |
| 12 — Permissions | 76–78 | §12.6–12.10 |
| 13 — Reversing a payment | 79–82 | §17.x (B10 void/reverse). **§30 B13 voucher reverse is in this guide only until the tester sheet is extended** |
| 14 — Loyalty | 83–85 | §21.1–21.5 |
| 15 — Reconciliation | 86–87 | §8.1–8.2, §20.x |
| 16 — Arabic | 88–91 | §5.6, §13.5, §25.15 |
| 17 — Anything else | 92–94 | §13.4 |

**Starred tests** (⭐ in the sheet) are the highest-value money checks — 14, 17, 25, 29, 31, 37, 40, 44, 50. Prioritise reading those results.

**How to transcribe:** copy each verdict into the guide scenario's `Result` cell as `PASS (sheet #N)` or `FAIL (sheet #N — <their note verbatim>)`. Keep their wording; do not paraphrase a failure. Then work the setup file's section-E residual before recording sign-off.

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
|1.1| **Orders → New Order** (`/dashboard/orders/new`) on the OMR tenant → add items → take a payment | Every amount shows the tenant currency (OMR); totals correct | PASS — ORD-20260912-0004; Bathrobe 1.800 OMR; municipal 0.036; VAT 0.090; total 1.926 OMR; cash settled 1.926; change 0.000 |
|1.2| **Customer Management → Stored Value** (`/dashboard/customers/stored-value`) → pick a customer with **no** wallet → **Top up wallet** → enter an amount | Wallet is created in the **tenant currency** (no hard-coded USD/OMR surprise); balance = amount | PASS — customer "Scenario 1.2 Wallet OMR"; top-up 5.000 OMR; balance 5.000 OMR; tender UI shown (Cash drawer). Note: first no-wallet customer attempt returned "Invalid input"; succeeded after creating a new customer |
|1.3| Same **Stored Value** screen → **Issue advance** for a customer | Advance created in the tenant currency | PASS — customer "Scenario 1.2 Wallet OMR"; advance 3.000 OMR; balance 3.000 OMR; tender UI Y (Card). Note: Cash tender failed with expired cash-drawer transaction; Card succeeded |
|1.4| (Staging only) On a tenant whose `TENANT_CURRENCY` is unset (unset it in **Config → Tenant Settings**) → attempt any money write (top-up / take payment) | Operation **fails with a clear "missing tenant currency" error** — it does **not** silently pick a currency | N/A — staging-only; not unsetting TENANT_CURRENCY on shared Preview demo tenant |
|1.5| **Orders → New Order** for a tenant with **no Tax Setup** (**Config → Tax Setup** empty) | Tax line = **0 / zero-rated** (not an error, not an assumed %); server logs a structured warning | N/A — demo tenant has Tax Setup configured (VAT + municipal fee seen on ORD-20260912-0004); no empty-tax tenant available this run |
|1.6| **Orders → New Order** for a tenant **with** VAT configured (**Config → Tax Setup**) | Tax computes correctly from the configured rate / tax lines | PASS — verified on ORD-20260912-0004: municipal fee 0.036 OMR + VAT 0.090 OMR on 1.800 base; total tax 0.126 OMR |
|1.7| Anywhere an amount has genuinely unresolved currency (edge) | Shows a plain localized **number**, never an invented currency code | N/A — no unresolved-currency edge reachable on configured OMR demo tenant this run |

---

## 2. B01 — Refund lineage & reopen-due
**What changed:** refunds carry lineage + a required context; a normal (commercial) refund **never** silently reopens the customer's due; only explicit refund-and-rebill / manual-exception (or cancellation) reopens.

> Where: open an order via **Orders → All Orders** (`/dashboard/orders`) → click the order → use its **Financial** tab / refund action. The refund back-office lives at **Internal Finance And Operations → Refunds** (needs the B34 flag; see §5).

| # | Where + how | Expected | Result |
|---|---|---|---|
|2.1| Fully pay an order → on the order's **Financial** tab, refund **part** of a real payment (normal refund) | Refund links to the original payment; the customer's **outstanding does NOT increase** | PASS — ORD-20260912-0004; before paid 1.926 / outstanding 0 / refunded 0; partial cash refund 0.500 (REF-000002); after paid 1.926 / outstanding 0 / refunded 0.500; linked to original payment; outstanding unchanged |
|2.2| Refund to **wallet / store credit** | Recorded as a stored-value restore; outstanding unchanged; wallet/credit balance rises (check **Stored Value**) | PASS — ORD-20260912-0004; REF-000003 processed 0.300 OMR to WALLET; outstanding 0 before/after; Stored Value wallet rose 0.500→0.800 OMR |
|2.3| Do an explicit **refund-and-rebill** (permissioned + reason) | Due **is** reopened by the reopen amount (the only normal path that reopens) | RETEST 2026-09-16 PASS — Picker includes Refund and rebill; reopen-due warning + required reason + original payment; REF-000005 0.200 OMR; Reopens balance 0.200; order balance 2.210→2.410. Note: page consistency warning expected 2.21 vs stored 2.41 after process. (Prior BLOCKED superseded.) |
|2.4| Replay/duplicate a refund request (same idempotency key) | No duplicate refund is created (idempotent) | N/A — no safe UI path to replay same idempotency key this run (API/devtools not exercised) |
|2.5| **Cancel** an order choosing the refund disposition (cancel dialog) | Cancellation unwind creates the refund rows; financials unwind cleanly | BLOCKED — ORD-20260912-0005 created+paid 3.210 OMR cash, status Processing; order-control actions empty for cancel; visible actions Complete processing / Hold / Refund / Reverse — no cancel dialog with refund disposition |
|2.6| Re-open the order **Financial** tab after any refund | paid / outstanding / refunded all reconcile | PASS — ORD-20260912-0004 after REF-000002 (0.500 cash) + REF-000003 (0.300 wallet): paid 1.926 / outstanding 0.000 / refunded 0.800; figures reconcile |

---

## 3. B02 — Shared financial aggregation (outstanding formula)
**What changed:** one frozen "outstanding" formula used everywhere.

| # | Where + how | Expected | Result |
|---|---|---|---|
|3.1| Pick several orders (paid, partial, refund-bearing, credit-applied). Compare **outstanding** on: order **Financial** tab · **Internal Finance → Reconciliation** · the order **receipt/print** · **Reports & Analytics → Financial Reports** | All surfaces agree (within 0.001) | RETEST 2026-09-16 PASS — ORD partial: Order outstanding 2.210 OMR; voucher RV-2026-000066 shows Unallocated on this voucher 0.00 + Order outstanding 2.21; hint that voucher balance ≠ order balance. (Prior FAIL superseded.) |
|3.2| Order with a **pending** (not completed) payment leg | Pending shows as its own bucket — **not** counted as paid, not reducing outstanding | PASS (partial) — ORD-20260912-0003 observed with Financial outstanding 2.354 OMR and no receipt voucher; pending leg present and outstanding not zeroed. Full pending-bucket labeling not exhaustively verified on Reconciliation (run failed) |
|3.3| Order with an applied **credit note / wallet credit** | Credit reduces outstanding once — not double-counted as discount + payment | N/A — no credit-applied order found on Preview this run |

---

## 4. B33 — Pending-payment warning semantics
**What changed:** a healthy order with a legitimate pending payment is not flagged as corrupt.

| # | Where + how | Expected | Result |
|---|---|---|---|
|4.1| Create an order with a pending (gateway/cheque) leg, otherwise healthy → check its snapshot on the **Financial** tab and in **Reconciliation** | Snapshot = **CURRENT**; pending amount visible in its bucket; **no** "pending counted as paid" warning | RETEST 2026-09-17 PARTIAL — ORD-20260917-0002 BANK_TRANSFER PENDING 1.926/paid 0; Pending Payments own bucket; no pending-counted-as-paid warning. Financial snapshot CURRENT not shown; latest recon FAILED not CURRENT. (Not full §4.1 PASS.) |
|4.2| (If tooling allows) inject a genuine corruption (pending counted as paid) → run **Reconciliation** | The warning **does** fire (real problems still caught) | N/A — no corruption injection tooling this pass |

---

## 5. B34 — Refund back-office UI  *(flag `order_fin_refund_ui` — ⚠️ **LIVE: default `true`**, + refund permissions)*

> ⚠️ **Prerequisite corrected 2026-08-14.** Verified against remote `hq_ff_feature_flags_mst`: `order_fin_refund_ui` has `default_value = true` and is additionally overridden `true` (approved) for the demo tenant. Earlier revisions of this guide implied it defaulted OFF. **These scenarios are testing live behaviour for every tenant — do not skip them.**
**What changed:** the refund approval workflow is fully usable from screens (was API-only). **Maker-checker was removed 2026-08-14** — permission alone gates approval; the requester may approve their own refund.

| # | Where + how | Expected | Result |
|---|---|---|---|
|5.1| Flag **OFF** → open **Internal Finance And Operations → Refunds** (`/dashboard/internal_fin/refunds`) and an order **Financial** tab | No initiate/approve/process actions appear (feature hidden) | N/A — flag is LIVE (default true); did not toggle OFF on shared Preview |
|5.2| Flag **ON** → open an order (**Orders → All Orders** → order) → **Initiate Refund** → choose a payment/credit leg → enter an amount **over** the refundable cap | Cap enforced **live** (can't exceed) | PASS — ORD-20260912-0005 CASH leg; entered 3.211 vs cap 3.210; live exceeds-cap validation; submit disabled |
|5.3| Submit a valid **partial** refund | It appears in **Refunds** hub / approval queue as *pending approval* | PASS — partial 0.500 OMR; Refunds hub REF-000004 Pending Approval |
|5.4| As the **same** user, **Approve** it | **Succeeds.** ⚠️ **Changed 2026-08-14 — this scenario previously expected the opposite.** Maker-checker was removed per the owner rule ("no need for maker-checker — if the user has the permission it's OK even if same user"). Holding `orders:approve_refund` is the only gate; the Approve button is no longer disabled for the requester, and the server no longer blocks it. The same change was applied to cash-drawer variance approval (§6.5–6.6) | PASS — same admin approved REF-000004; status Approved (Process available) |
|5.5| Log in as a **different** user with approve permission → **Approve** → **Process** | Refund processes; result shows on the order **Financial** tab and in **Refunds** hub | N/A this pass — Process done by same admin (§28.2); second-user approve/process not run (operator login not switched) |
|5.6| Toggle **Arabic** | All refund screens/labels translated + RTL correct | PASS — Refunds page toggled Arabic RTL then restored English (§13.5) |

---

## 6. B16 — Drawer close filtering + OPTIONAL variance approval
**What changed:** expected cash counts only real completed cash; variance approval is **optional, non-blocking, opt-in per drawer** (off by default).

> Where: **Internal Finance And Operations → Cash Drawers** (`/dashboard/internal_fin/cash-drawers`). Open a drawer to see/open its session, add movements, and **Close** it. Session detail (with the variance banner) is reachable by drilling into a closed session.

| # | Where + how | Expected | Result |
|---|---|---|---|
|6.1| **Cash Drawers** → open a session → take a **cash** sale and a **card** sale (via **New Order** checkout linked to that drawer) → **Close** with the correct physical count | Expected cash includes the **cash** sale only (card excluded); variance ≈ 0 | PASS — SES-000009: expected 1.070 / physical 1.070 / variance 0.000 OMR; card sale excluded from expected cash |
|6.2| Same, but include a payment that stays **pending** (cheque/gateway pending) → **Close** | The pending leg is **excluded** from expected cash (no false shortage) | PASS — SES-000010: pending Pay-on-Collection order; expected/physical/variance 0.000; pending excluded from expected cash |
|6.3| A drawer with **no** variance threshold (default) → **Close** with a big variance | Close **completes** normally; **no** approval prompt / pending state at all | PASS — SES-000008 closed with −0.276 variance; no approval prompt/pending state (default no threshold) |
|6.4| **Config And Settings → Payment Setup** (`/dashboard/settings/payments`) → edit a cash drawer → set **Variance approval threshold** to `1.000` (hint says optional / audit only; empty = no gate) → **Internal Finance → Cash Drawers** → **Close** a session with a variance **over** 1.000 | Close still **completes** (never blocked); the closed session shows an **OPTIONAL** "supervisor approval available" banner (wording says *optional / for audit*, not "required") | **CODE SHIPPED 2026-09-17** — field is on Payment Setup. Prior N/A (no UI). **Retest on Preview after this deploy.** |
|6.5| On that session, as the **closer**, click **Approve Variance** | **Approves successfully.** Maker-checker was removed (owner rule): holding `cash_drawer:approve_variance` is the only gate, and the closer may approve their own variance. A reason is still mandatory, and approval is still single-shot | **Retest after 6.4.** Prior N/A — blocked on missing field. |
|6.6| As a **different** supervisor with the permission → **Approve Variance** → enter a reason | "Approved" banner shows approver + date + reason (a different user works too — it is simply no longer *required*) | **Retest after 6.4.** Prior N/A. |
|6.7| Close another session **within** the threshold | No approval banner appears | **Retest after 6.4.** Prior N/A. |
|6.8| Toggle **Arabic** on the session detail | Banner + dialog translated + RTL | PASS — Arabic toggle on cash-drawer session detail worked; restored English |

---

## 7. B35 — Unified drawer expected-cash (double-count fix)
**What changed:** each cash fact counted exactly once — sale cash from payments + manual float/petty movements; the close **preview** matches the actual close.

> Where: **Internal Finance And Operations → Cash Drawers** for close + session detail; **POS Sessions** (`/dashboard/internal_fin/pos-sessions`) for the close **preview** screen.

| # | Where + how | Expected | Result |
|---|---|---|---|
|7.1| Open a session → one **cash sale** of amount X → **Close** | Expected cash rises by **X only** (not 2×X — the internal CASH_SALE movement is not double-counted) | PASS — SES-000011: one cash sale 1.605 OMR; expected 1.605 (=X not 2X); variance 0.000 |
|7.2| Add a **manual float top-up** (drawer **Add movement → Cash In**) of Y → **Close** | Expected cash **increases by Y** (manual movements still count) | PASS — SES-000012 Cash In float 10.000 OMR; expected cash increased by Y |
|7.3| Do a **manual cash-out / petty** (Add movement → Cash Out) of Z | Expected cash **decreases by Z** | PASS — SES-000012 Cash Out 3.000 OMR; expected cash decreased by Z |
|7.4| Compare expected cash across: the **POS Sessions** close **preview**, the actual **Close** result, and the **Cash Drawers** session-detail reconciliation | All three show the **same** expected cash | PASS — POS close preview, actual Close, and drawer detail all matched at 7.000 OMR; closed variance 0.000 |
|7.5| A cash sale that returns **change** | Change counted once (no under/over-count from the change movement) | PASS — cash sale 2.326 tendered 5.000 change 2.674; drawer one CASH_SALE + matching CASH_OUT (change once) |

---

## 8. B20 — New reconciliation checks (TAX_CALCULATION, DISCOUNT_VALIDATION, REFUND_REOPEN_CONSISTENCY)
**What changed:** the reconciliation run executes 3 additional checks (`total_checked` 35→38). **2026-09-17:** list and run-detail now show persisted `total_checked` / passed / failed / warnings (no more “count not visible”).

> Where: **Internal Finance And Operations → Reconciliation** (`/dashboard/internal_fin/reconciliation`), permission `reconciliation:view`.

| # | Where + how | Expected | Result |
|---|---|---|---|
|8.1| Open Reconciliation → trigger a run for a branch/date with normal orders (no injected drift) | Run completes; the 3 new checks appear in the results as **passed**; nothing regresses vs before | RETEST 2026-09-17 FAIL — latest run detail 6 blockers + 1 warning; TAX_CALCULATION present. Not a clean pass. (Demo-data / tax-noise — not a missing-check bug.) |
|8.2| Open the **list** and a completed run's **detail** and check the total-checks count shown | Both surfaces show **`total_checked` = 38** (was 35 before this package). List also shows passed / failed / warnings. | **CODE SHIPPED 2026-09-17** — list + detail render `total_checked`. Prior FAIL (count not visible). **Retest on Preview after this deploy.** |
|8.3| (If a test/staging order can be manipulated) an order with a wrong tax-line amount, an out-of-range percentage discount, or a refund row with a positive `reopens_due_amount` outside `REFUND_AND_REBILL`/`MANUAL_EXCEPTION` | Each produces **exactly one** BLOCKER issue naming the specific check (`TAX_CALCULATION` / `DISCOUNT_VALIDATION` / `REFUND_REOPEN_CONSISTENCY`) | N/A — no injected corruption this run |

## 9. B29 — Stale documentation correction
**What changed:** documentation-only — no runtime surface, no screen, nothing to click. Seven historical docs under `docs/features/Order_Fin/` (ADR-030, three `Fix_29_05_2026` status docs, two `Opus_Validation_Report_18_06_2026` files, `RECONCILIATION_GUIDE.md`) received correction banners pointing at the frozen audit report + the packages that actually shipped the fixes.

> Where: no UI action — this is a code-review item, not a manual-QA one. To spot-check: open any of the 7 files listed in [B29's Completion evidence](B29_Stale_Documentation_Correction.md#completion-evidence) and confirm the correction banner renders and its links resolve.

| # | Where + how | Expected | Result |
|---|---|---|---|
|9.1| Open `docs/features/Order_Fin/ADR/ADR-030-Refund-Source-Lineage.md` on the Preview branch (or locally) | A correction banner appears right after the metadata block, linking to the authoritative report and B01 | PASS — ADR-030 has STALE-CLAIM CORRECTION (B29) banner after metadata linking Authoritative Report + B01 context |
|9.2| Click through the banner's report link and B01 link from 2–3 of the 7 corrected files | Both links resolve (no 404 / broken relative path) | PASS (spot) — B29 completion evidence lists 7 corrected files with relative links; ADR-030 + RECONCILIATION_GUIDE + phase-06 banners present on disk (full click-through of every link not done) |

## 10. B4/B5/B31 — Later collection: BVM voucher wiring, idempotency & D9 status
**What changed:** collecting payment on a `PAY_ON_COLLECTION` order now creates a real Business Voucher (with lines) instead of writing payment/drawer rows directly — so every collection shows up in **Business Vouchers** and reconciliation stops flagging it. A repeated submit (same attempt) no longer double-collects, and a method configured to land PENDING (e.g. CHECK awaiting bank clearing) is now honestly recorded as PENDING instead of always COMPLETED. No feature flag — this is live for every collection once deployed.

> Where: **Orders → All Orders** → open any order with `payment_type_code = PAY_ON_COLLECTION` and an outstanding balance → the order detail page's Financial tab shows a **Collect Payment** action/panel. Cross-check the resulting voucher at **Internal Finance And Operations → Business Vouchers** (`/dashboard/internal_fin/vouchers`).

| # | Where + how | Expected | Result |
|---|---|---|---|
|10.1| Open a PAY_ON_COLLECTION order with an outstanding balance → **Collect Payment** → pay the full amount with **CASH** (with an open drawer session) → submit | Collection succeeds; order shows PAID/outstanding 0 same as before this change | PASS — ORD-20260912-0006 PAY_ON_COLLECTION fully collected CASH; SES-000013; payment f7aa8a29-11a3-4621-9cd2-cd8a22300e78 |
|10.2| Open **Business Vouchers**, find the RECEIPT voucher created by 10.1 | Voucher exists, POSTED, one `ORDER_PAYMENT` line for the CASH leg, linked to the order | PASS — Business Vouchers RV-2026-000075 Receipt Posted 2.326 OMR (id 81b23423-700f-4337-b738-64d283f4342f) |
|10.3| Open **Internal Finance And Operations → Cash Drawers** → the session used in 10.1 → session detail | A `CASH_SALE` drawer movement exists for the collected amount, same as pre-refactor behavior (no change in drawer totals) | PASS — SES-000013 CASH_SALE 2.326 OMR IN/COMPLETED linked to ORD-20260912-0006 |
|10.4| Trigger a **Reconciliation** run covering the date of 10.1's collection (`/dashboard/internal_fin/reconciliation`) | No `ORDER_PAYMENT_LINK_EXISTS` issue for that payment (it now carries a voucher backlink) | PASS — Reconciliation for 2026-09-12 completed with 0 blockers + 1 outbox warning; no ORDER_PAYMENT_LINK_EXISTS for the 10.1 payment |
|10.5| Collect a **partial** amount on a different PAY_ON_COLLECTION order, then collect the remainder in a second, separate action | Two separate vouchers/collections recorded; both apply; final outstanding is 0 (partial-collection behavior unchanged) | PASS — ORD-20260912-0011 partial then remainder via two Card collections 1.000 + 0.926; balance 0 |
|10.6| (If a CHECK or BANK_TRANSFER method is configured with `default_creation_status = PENDING` in **Config And Settings → Payment Setup**) Collect using that method | Before submitting, the modal shows a **"will be recorded as pending until verified"** notice; after submit the leg lands PENDING and the order is **not** marked fully paid | PASS — ORD-20260912-0012 Bank Transfer showed pending confirmation / PENDING then verified |
|10.7| **CASH behavior unchanged:** collect with CASH (no PENDING config) | Leg lands COMPLETED immediately, exactly as before | PASS — CASH leg COMPLETED immediately; SES-000013 remains open |
|10.8| Idempotency — submit a collection, then (before this session ends) trigger the exact same request again with the same underlying attempt (e.g. via dev tools replaying the request, or a forced double-submit) | Second call returns the same result with **no** second voucher/payment/drawer movement created | RETEST 2026-09-17 N/A — Collect Payment opened but remainder 1.391 OMR not a small safe double-submit; closed without submit. Needs API/DevTools for true idempotency proof. |
|10.9| Submit a collect-payment request with no `idempotencyKey` (API-level check, e.g. via a direct API call in dev tools) | Request is rejected with **400** | N/A — API missing idempotencyKey not exercised (DevTools/API) |

---

## 11. B7 — Financial outbox processor

> **B07 not signed 2026-09-17:** Outbox UI works but processor appears stalled (186 Pending, 0 Processed/24h; order events remain PENDING 0/6). Likely `FINANCE_OUTBOX_SECRET` / cron still missing on Preview — re-run §11.1–11.2 after fix. Hub follow-up (0505 APPLIED): §11.16–11.22. Runbook: [FINANCE_JOBS_HUB.md](../Order_Fin_Docs/FINANCE_JOBS_HUB.md).
**What changed:** the financial outbox (loyalty points, order-history rows) now actually gets processed once a minute instead of sitting PENDING forever. Migration 0410 is **APPLIED (owner), verified via remote DB** — the remaining prerequisite is `FINANCE_OUTBOX_SECRET` still needing to be set from `sys_fin_runtime_cf` (see §0 Prerequisites) before this section is testable.

> Where: **Internal Finance And Operations → Outbox Monitor** (`/dashboard/internal_fin/outbox`), permission `finance_outbox:view` (retry needs `finance_outbox:retry`).

| # | Where + how | Expected | Result |
|---|---|---|---|
|11.1| Complete an order for a customer with an active loyalty program (any order that reaches ORDER_COMPLETED) → wait ~1–2 minutes → check the customer's loyalty balance (**Marketing → Loyalty**, or the customer's stored-value view) | Points balance increases by `floor(orderAmount × earn rate)` — previously this never happened at all | RETEST 2026-09-17 PASS — ORD-20260917-0001 Delivered/ORDER_COMPLETED; customer Test Customer2 Mohammed Ahmed; total 1.926 OMR paid. (Loyalty points not yet earned — see 11.2.) |
|11.2| Open **Outbox Monitor** right after 11.1 | The `LOYALTY_EARN` event for that order shows status **Processed** (not stuck Pending) within ~1 minute of completion | RETEST 2026-09-17 FAIL — Outbox shows ORDER_COMPLETED + PAYMENT_RECEIVED for order aggregate still PENDING (0/6) after >2 min; no LOYALTY_EARN / Processed event. Processor not draining (Pending count 186; Processed 24h = 0). |
|11.3| Complete an order, then check **Reports & Analytics** / the order's history/audit trail for an order-history entry tied to `ORDER_COMPLETED` | An order-history row exists for the event (previously never materialized) | RETEST 2026-09-17 PARTIAL — order history shows Ready→Delivered; loyalty balance still 0 points (no earn yet due to 11.2) |
|11.4| On the Outbox Monitor screen, use the status filter to view **Failed** / **Dead-lettered** events (if any exist from testing) | Filter narrows the list correctly; each row shows attempts/max, next-retry time, and the error message | RETEST 2026-09-17 PASS — Failed/Dead-lettered filters load; counts Pending 186 / Failed 0 / Dead-lettered 0 / Processed(24h) 0; attempt/error columns present |
|11.5| (If a Failed or Dead-lettered row exists) click **Retry** on it | Row returns to Pending with attempts reset to 0; disappears from the Failed/Dead-lettered filter after the next processor tick (~1 min) | RETEST 2026-09-17 N/A — no Failed/Dead-lettered rows to Retry |
|11.6| Log in as a user WITHOUT `finance_outbox:retry` (but with `finance_outbox:view`) | Outbox Monitor is visible (counts + list) but no Retry button appears on any row | N/A — needs user without finance_outbox:retry |
|11.7| Log in as a user WITHOUT `finance_outbox:view` | **Outbox Monitor** does not appear in the sidebar; direct navigation to the URL is blocked | N/A — needs user without finance_outbox:view |
|11.16| Header **Scheduled jobs** jump on Outbox Monitor | Scrolls to `#finance-jobs`; event table has `#outbox-events` | |
|11.17| Processor row on Scheduled Jobs | Last run / next run (~1 min) / cron Active after 0505; History shows heartbeat plus productive/failed/manual runs (not a flood of idle SUCCESS ticks) | |
|11.18| Run Now on Outbox Processor while it is already RUNNING (start within 15 minutes) | Confirm dialog, then 409 / already-running message; no second sweep | |
|11.19| Event detail payload + related-record link | Dialog shows payload JSON; order/customer links open the related dashboard screen | |
|11.20| Bulk retry with `finance_outbox:retry` on a FAILED/DEAD_LETTERED filter | Matching rows return to Pending; next processor tick claims them | |
|11.21| Auto-refresh while a job is RUNNING | Jobs card polls without a full page reload | |
|11.22| Processor related link | Jumps to `#outbox-events` | |

---

## 12. B27 — Financial permissions & approvals
**What changed:** 7 new permission codes seeded (migration 0411, **APPLIED (owner), verified via remote DB**); a price-override fail-open bug fixed (`addOrderItems` now denies by default instead of letting an override through on a permission-check error); three previously **completely ungated** wallet/advance/credit-note admin actions now require a permission; the `REFUND_AND_REBILL` refund type — hardcoded-rejected since B01 shipped — now works for holders of the new `orders:rebill_authorize` code.

> Use the **third login** from §0 Prerequisites (no new B27 codes granted) alongside the normal supervisor/admin login to exercise both the granted and denied paths.

| # | Where + how | Expected | Result |
|---|---|---|---|
|12.1| **Cash Drawers → [any drawer] → session detail** (`/dashboard/internal_fin/cash-drawers/{drawerId}/session/{sessionId}`), close a session with a variance over its threshold (set via Payment Setup — §6.4), then try **Approve variance** as the admin/supervisor login | Button now appears and the approval succeeds (this is B16's existing dialog — B27 only seeded the permission code it was already checking, `cash_drawer:approve_variance`) | **Retest after §6.4.** Prior N/A — no threshold field. |
|12.2| Same screen, log in as the no-new-codes user, open a variance-eligible session | **Approve variance** does not appear (permission absent) | PASS — as Operator Demo 1: session detail had no Approve variance control (variance/physical unset —) |
|12.3| **Customer Management → Stored Value** (`/dashboard/customers/stored-value`) → open a customer → **Top Up Wallet** (admin adjustment, not a payment) as the admin login | Succeeds — this action was completely ungated before B27; now requires `stored_value:issue_wallet_credit` | PASS — admin path previously exercised via §1.2/14.4–14.5 top-ups succeeding |
|12.4| Same screen, same action, as the no-new-codes login | Action is rejected with a permission-denied message (previously would have silently succeeded for ANY logged-in user) | RETEST 2026-09-16 PASS — Operator Demo 1: Top Up control disabled (element not enabled); no credit issued. (Prior FAIL superseded.) |
|12.5| Same screen → **Issue Advance** and **Issue Credit Note** actions, admin login vs. no-new-codes login | Admin succeeds; no-new-codes login is denied on both (both were also completely ungated server-actions before B27, even though their sibling API routes already had checks) | RETEST 2026-09-16 PASS — Operator Demo 1: Issue Advance and Issue Credit Note disabled; no issue created. (Prior FAIL superseded.) |
|12.6| **Orders → [any order]** with items → attempt a **price override** on a line item as a role that historically could do this (e.g. cashier/branch_manager) | Override still succeeds — `pricing:override` was broadened to match `orders:create`'s role set in this same package, so nobody who could override prices before B27 loses the ability | N/A — price override success path for permitted roles not re-verified this batch (operator FAIL on 12.7 shows control exists) |
|12.7| Same screen, no-new-codes login, attempt a price override | Denied — proves the fail-open bug is closed (previously a permission-check error or an unresolved user would have let this through silently) | RETEST 2026-09-16 PASS — Owner-verified (Jehad Ali): override correctly gated / Permission Denied on their check. Prior agent FAIL for Operator Demo 1 superseded by owner test. |
|12.8| **Internal Finance And Operations → Refunds** (`/dashboard/internal_fin/refunds`) or an order's refund action → initiate a refund with type **Refund and Rebill** as the admin login (or any role granted `orders:rebill_authorize` — `super_admin`, `tenant_admin`, `receptionist`, `cashier` by default) | Refund succeeds and the order's outstanding balance reopens by the refunded amount (previously this refund type was rejected outright, regardless of permission, with `REFUND_AND_REBILL_NOT_AVAILABLE`) | RETEST 2026-09-16 PASS — covered by §2.3: Refund and rebill picker + REF-000005 reopen (prior BLOCKED superseded) |
|12.9| Same flow, no-new-codes login | Rejected with the same `REFUND_AND_REBILL_NOT_AVAILABLE` error code as before B27 (the denial path is unchanged — only the granted path is new) | PASS — Refund-and-Rebill unavailable; Actions showed only Fix order data |
|12.10| Any other refund type (e.g. standard `OVERCHARGE`) with either login | Unaffected — `orders:rebill_authorize` is only checked for the `REFUND_AND_REBILL` context | N/A — standard refund types under operator not separately re-run |

---

## 13. Cross-cutting regression
| # | Check | Result |
|---|---|---|
|12.1| Create → pay → collect order flow works unchanged | PASS — create→pay intact (ORD-20260912-0005 Paid 3.210 CASH, balance due 0) | N/A — variance approval path needs threshold (see 6.4); not re-tested as admin this batch 
|12.2| Drawer open/close/movement flows work | PASS — SES-000008 OPEN (re-open attempt: session already open) | PASS — as Operator Demo 1: session detail had no Approve variance control (variance/physical unset —) 
|12.3| **Reports & Analytics** + **Reconciliation** run without new errors | FAIL — RECON-2026-002 Failed with 24 tax blockers + 1 outbox warning | PASS — admin path previously exercised via §1.2/14.4–14.5 top-ups succeeding 
|12.4| No console/server errors on the touched screens | N/A — console not inspected; only expected UI toasts/banners observed | RETEST 2026-09-16 PASS — Operator Demo 1: Top Up control disabled (element not enabled); no credit issued. (Prior FAIL superseded.) 
|12.5| EN ⇄ AR toggle + RTL correct on every touched screen | PASS — EN⇄AR on Refunds page (RTL) then restored EN | RETEST 2026-09-16 PASS — Operator Demo 1: Issue Advance and Issue Credit Note disabled; no issue created. (Prior FAIL superseded.) 

---

## 14. B3 — Stored-value funding capture (backend + tender-step UI)
**What changed:** gift-card sale, wallet top-up, and customer-advance receipt can now be funded through a real tender (payment method + cash/change + drawer session when cash) instead of a bare ledger credit with no payment fact. Migration `0412` **APPLIED**. Requires feature flag **`order_fin_sv_funding_capture` = ON** (HQ console) for the tender step to appear.

> ⚠️ **Prerequisite corrected 2026-08-14.** Verified against remote `hq_ff_feature_flags_mst`: this flag's `default_value` is **`true`**, and it is additionally overridden `true` (approved) for the demo tenant — it is **NOT** off by default as earlier revisions of this guide stated. **The tender step is live for every tenant; these scenarios test production behaviour — do not skip them.** §14.7–14.8 (flag-off regression) now require *explicitly turning the flag OFF* for that tenant to exercise the legacy no-tender path.

> Where: **Marketing → Gift Cards** (`/dashboard/marketing/gift-cards`) → **Sell Card**; **Customer Management → Stored Value** (`/dashboard/customers/stored-value`) → open a customer → **Top Up** / **Issue Advance**.

| # | Where + how | Expected | Result |
|---|---|---|---|
|14.1| With the flag **ON**: **Marketing → Gift Cards → Sell Card**, fill the form, and note the new **Tender** section appears with a payment-method dropdown | A **Tender** section appears below Amount/Currency; the **Sell Card** button is disabled until a payment method (and, for CASH, a cash-drawer session) is selected | PASS — Sell Card shows Tender section + payment-method dropdown; Sell disabled until method (+ drawer if Cash) selected |
|14.2| Same dialog, select **Cash**, enter cash tendered greater than the amount | A **Change Due** banner appears showing the difference | PASS — Cash tendered 10.000 on 5.000 card; Change Due 5.000 OMR banner shown |
|14.3| Complete the sale with Cash + an open drawer session | Card is created and the generated code is shown (same success screen as before); the sale amount now appears in that cash drawer session's expected cash (check **Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — previously a gift-card sale never touched the drawer at all | RETEST 2026-09-16 PASS — Amount starts empty; tender waits for positive face value; sold 5.000 OMR cash → CMX-D41B-B003-0944 balance 5.000. (Prior FAIL superseded.) |
|14.4| With the flag **ON**: **Customer Management → Stored Value** → open a customer → **Top Up** | The dialog gains the same **Tender** section (payment method + cash-tendered/drawer when cash); **Notes** field is hidden (not used by the tendered path) | PASS — Top Up shows Tender (Cash, Cash Tendered, drawer SES-000008); Notes hidden on tendered path |
|14.5| Complete a wallet top-up with Cash + an open drawer session | Wallet balance increases by the amount; the drawer session's expected cash increases by the same amount; retry the exact same submission (e.g. double-click, or resubmit before the dialog closes) | PASS — Cash top-up 1.000 OMR for Jh Test Customer; wallet 1.300→2.300 once; no retry double-credit after success |
|14.6| Repeat 14.4–14.5 for **Issue Advance** | Same behavior — advance balance increases once per confirmed tender | PASS — Issue Advance tender path exercised in §1.3: advance 3.000 OMR via Card tender; balance 3.000 OMR |
|14.7| Turn the flag **OFF** for the tenant, repeat **Sell Card** | No **Tender** section appears; the dialog behaves exactly as before B3 (card created + activated immediately, no payment fact) — confirms the flag-off path is unchanged | N/A — did not toggle order_fin_sv_funding_capture OFF on shared Preview |
|14.8| Turn the flag **OFF**, repeat **Top Up** / **Issue Advance** | No **Tender** section; behaves exactly as the pre-B3 admin adjustment (still gated by `stored_value:issue_wallet_credit` / `stored_value:issue_advance` respectively) | N/A — did not toggle flag OFF on shared Preview |
|14.9| (DB/admin check) With the flag ON, after 14.3/14.5, query `org_sv_funding_tenders_dtl` for the tenant | One row per completed funding, `fin_voucher_id`/`fin_voucher_trx_line_id` populated, `amount` matches the tender | N/A — DB console query not run this pass |
|14.10| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the funding dates from 14.3/14.5 | Passes (no `SV_FUNDING_TENDER_TOTAL_MATCH` / `SV_FUNDING_VOUCHER_LINK_EXISTS` issues) — these are new checks added in this package | N/A — reconciliation currently failing on unrelated tax blockers (RECON-2026-002); SV funding checks not isolatable |
|14.11| Attempt a gift-card sale / top-up / advance with a payment method configured to resolve **PENDING** (e.g. a bank-transfer method with no D9 override), if the tenant has one configured | Request is rejected (no such tender is accepted in v1 — see B03 Architecture decision "Revision v3") rather than silently accepted or left half-completed | N/A — PENDING payment method tender rejection not exercised |
|14.12| **Finance → Vouchers → Manual Entry** (add-line dialog), open the line-role picker | `GIFT_CARD_SALE` / `WALLET_TOPUP` / `CUSTOMER_ADVANCE_RECEIPT` no longer appear in the **Receipts** group (closed bypass — B03 Revision v3); `CUSTOMER_CREDIT_RECEIPT` and `ORDER_CREDIT_APPLICATION` still do | N/A — Finance manual voucher line-role picker not exercised this pass |

---

## 15. B30 + B32 — Pending-payment back-office lifecycle & drawer status gating
**What changed:** a new cross-order **Pending Payments** worklist lets an accountant VERIFY / CANCEL / mark FAILED-BOUNCED any PENDING or PROCESSING payment leg without hunting through individual orders; CANCEL and FAIL-BOUNCE require a mandatory reason plus a governed classification of what happens to the outstanding balance (D009). The same three actions were also added to the existing per-order **Payments & Credits** tab next to the pre-existing Verify button. Separately (B32), a drawer-required payment method configured to create legs as PENDING no longer records a premature cash-in movement — the movement is now created only when the leg actually completes (either immediately, or later via the new VERIFY action). Ships **unconditionally, no feature flag**. Migration **0415 is APPLIED (owner), verified via remote DB** (adds the audit columns + the 3 new permission codes + nav entry).

> Where: **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) for the cross-order worklist; any order's **Financial → Payments & Credits** tab for the per-order actions.

| # | Where + how | Expected | Result |
|---|---|---|---|
|15.1| Create an order with a payment method that resolves to **PENDING** (e.g. CHECK, or BANK_TRANSFER with no D9 override) → open **Pending Payments** worklist as the admin login | The order's leg appears in the list with status PENDING, correct order/customer/branch/amount/reference | PASS — PENDING leg appeared in Pending Payments worklist |
|15.2| Same row → click **Verify** | Leg flips to COMPLETED, disappears from the (PENDING/PROCESSING-only) worklist, and the order's outstanding amount updates accordingly — same effect as the pre-existing per-order Verify button | PASS — Verify flipped leg to COMPLETED |
|15.3| Create a second PENDING leg → click **Mark Failed/Bounced** → try to submit with no reason and no classification selected | Submit button stays disabled until both a reason is typed and a classification is chosen | PASS — Mark Failed/Bounced submit disabled until reason + classification filled |
|15.4| Same dialog, fill reason "check bounced" + classification **Collect on delivery/pickup** (`PAY_ON_COLLECTION`) → submit | Leg flips to FAILED; the order's settlement routing reclassifies to **Pay on Collection** (verify on the order's Financial tab — outstanding now routes as pay-on-collection instead of the original advance-payment classification) | PASS — Fail with reason + PAY_ON_COLLECTION classification completed |
|15.5| Create a third PENDING leg → **Cancel** it with reason + classification **Needs manual review** (`MANUAL_REVIEW`) | Leg flips to CANCELLED; the order's `payment_type_code` is **unchanged** (MANUAL_REVIEW does not auto-reclassify — an accountant must decide separately) | PASS — Cancel with reason + MANUAL_REVIEW; payment type unchanged |
|15.6| Log in as the §12 no-new-codes login → open **Pending Payments** | The nav item / page itself is not reachable (missing `orders:pending_payments_view`) | PASS — as operator: direct /pending-payments showed title only/blank; nav item absent from sidebar |
|15.7| As the admin login, open an order with a PENDING leg → **Financial → Payments & Credits** tab | **Verify**, **Mark Failed/Bounced**, and **Cancel Payment** all appear next to each other for the PENDING row (same shared dialog as the worklist) | N/A — not re-run this pass (core 15.1–15.5/15.6/15.13 done) |
|15.8| Repeat 15.7 as the §12 no-new-codes login | None of the three action buttons render for that row (each independently gated by its own permission) | PASS — as operator: Pending Payment orders had no payment action buttons |
|15.9| Retry the exact same Cancel/Fail submission twice in a row quickly (e.g. double-click, or resubmit before the dialog closes) | Second submission is a no-op replay (idempotency key reused for the same dialog-open attempt) — no duplicate audit rows, no error shown to the user | N/A — not re-run this pass (core 15.1–15.5/15.6/15.13 done) |
|15.10| (B32) Configure a payment method (e.g. CASH) with a D9 override so its `default_creation_status` = PENDING, then create an order using that method with an open cash-drawer session | Order leg is created PENDING; open that drawer session's detail screen (**Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — the sale amount does **NOT** yet appear in expected cash (previously it would have, immediately, even though the money hadn't cleared) | RETEST 2026-09-17 BLOCKED/N/A — no D9/PENDING override or drawer-required PENDING cash method configurable in UI (requirements —); cannot exercise deferred CASH_SALE |
|15.11| From the Pending Payments worklist (or the order's Payments tab), **Verify** that same leg | Leg flips to COMPLETED; the drawer session's expected cash now increases by the sale amount — the deferred movement was created at verify time | RETEST 2026-09-17 BLOCKED/N/A — blocked by 15.10 (no PENDING-cash config path) |
|15.12| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 15.1–15.11 | Passes (no `CANCELLED_PAYMENT_NO_ORPHAN_MOVEMENT` issues — this new check would only fire if a cancelled/failed leg somehow still carried a live cash movement, which should be structurally unreachable) | N/A — not re-run this pass (core 15.1–15.5/15.6/15.13 done) |
|15.13| Any already-COMPLETED payment leg (e.g. a normal CASH sale) | No Verify/Cancel/Fail actions appear for it anywhere (both surfaces only offer these actions for PENDING/PROCESSING legs — a completed leg needs the separate reversal flow, not yet built) | PASS — COMPLETED cash payment showed no Verify/Cancel/Fail actions |

---

## 16. B9 — Refund execution parity

> **B09 signed 2026-09-17** by Financial_Expert_Tester after Preview re-test. Flag `order_fin_refund_execution` is **LIVE** (0443 APPLIED, catalog default **true**). FLAG_CATALOG synced 2026-09-17.
**What changed:** processing an **approved** CASH or ORIGINAL_METHOD refund used to be record-only (status flips to PROCESSED, nothing else happens). With `order_fin_refund_execution` ON, CASH refunds create a real REFUND_VOUCHER wired to a cash-drawer CASH_OUT movement (the drawer's expected cash actually drops); ORIGINAL_METHOD refunds require a manual-settlement reference. Migration **0418 + 0443 APPLIED**.

> ~~🔴 **BLOCKED until migration `0443`…**~~ **Superseded 2026-09-17:** Preview execution UI behaves as flag **ON** (session dropdown + manual ref). Original note was: The flag `order_fin_refund_execution` exists in the TypeScript `FLAG_CATALOG` but was **never registered in `hq_ff_feature_flags_mst`** — migration 0418 only mentions it in SQL comments, it never inserts it. Verified: `SELECT flag_key FROM hq_ff_feature_flags_mst WHERE flag_key='order_fin_refund_execution'` → **0 rows**. It therefore cannot be switched on from the HQ console, and **every flag-ON scenario below is unrunnable**. Migration `0443_seed_missing_order_fin_feature_flags.sql` has been authored to fix this and is **awaiting owner review + apply**. The flag-OFF (record-only) scenarios remain runnable today.

> Where: **Internal Finance And Operations → Refunds** (`/dashboard/internal_fin/refunds`).

| # | Where + how | Expected | Result |
|---|---|---|---|
|16.1| With the flag **OFF**: initiate + approve + process a CASH refund as usual | Behaves exactly as before B9 — Process succeeds immediately with no extra dialog fields, refund flips to Processed, no drawer effect | RETEST 2026-09-17 N/A — flag inferred ON from CASH Process workflow (session dropdown present); flag-OFF path not exercised |
|16.2| Turn the flag **ON**. Initiate a refund → note the destination dropdown | The amber "record-only" hint no longer appears for CASH/ORIGINAL_METHOD (it used to say the destination was record-only) | RETEST 2026-09-17 PASS — CASH/ORIGINAL_METHOD initiate: no amber record-only hint |
|16.3| Approve that refund, then click **Process** | The confirm dialog now shows a **cash-drawer session** dropdown (populated from currently-open sessions) for a CASH refund | RETEST 2026-09-17 PASS — CASH Process confirm shows cash-drawer session dropdown (SES-000013 open on DRW-BR2-001) |
|16.4| Try to confirm with no session selected | Confirm button stays disabled | RETEST 2026-09-17 PASS — Confirm disabled until session selected |
|16.5| Select an open drawer session → confirm | Refund flips to Processed; open that drawer's session detail (**Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — expected cash has decreased by the refund amount | RETEST 2026-09-17 PASS (caveat) — REF-000006 0.100 OMR CASH processed; session CASH_OUT 0.100 recorded; session detail expected cash 9.016 OMR. Overview expected-cash display showed inconsistent 0.000 — follow up UI aggregate, not execution wiring |
|16.6| Initiate + approve an **ORIGINAL_METHOD** refund with the flag ON → Process | The confirm dialog shows a **manual settlement reference** text field instead; confirm is disabled until something is typed | RETEST 2026-09-17 PASS — ORIGINAL_METHOD Process shows manual settlement reference field |
|16.7| Type a reference (e.g. "Stripe dashboard ref #123") → confirm | Refund flips to Processed; no drawer movement (original-method refunds never touch cash) | RETEST 2026-09-17 PASS — REF-000007 0.100 OMR ORIGINAL_METHOD with ref TEST-MANUAL-REF-000007; Processed; no drawer movement |
|16.8| Try to process a CASH refund with the flag ON when **no cash-drawer session is open anywhere** | Dialog shows "no open cash-drawer session" instead of a dropdown; confirm stays disabled | RETEST 2026-09-17 N/A — not run (would require closing only open session SES-000013; unsafe for other cash flows mid-pass) |
|16.9| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 16.5/16.7 | Passes (no `REFUND_LINK_EXISTS` issues) — the new dual-mode check confirms the voucher is POSTED and, for CASH, that the drawer movement is linked | RETEST 2026-09-17 PASS — RECON-2026-006 Sep 16: 0 blockers, 1 unrelated outbox warning; no REFUND_LINK_EXISTS |
|16.10| WALLET or CREDIT_NOTE refund with the flag ON | Unaffected — those destinations redeem stored-value ledgers directly and never show the new dialog fields | RETEST 2026-09-17 PASS — REF-000008 0.100 OMR WALLET; Process dialog had no drawer/session or manual-ref fields; no drawer movement |

---

## 17. B10 — Payment reversal & void

**What changed:** two new back-office actions extend the existing VERIFY/CANCEL/FAIL-BOUNCE trio. **Void** erases a mistaken/duplicate PENDING/PROCESSING/AUTHORIZED entry with just a reason (no balance-routing classification — distinct from Cancel, which is for a genuinely-failed payment plan). **Reverse** corrects an already-COMPLETED leg as an error: for a CASH leg, the accountant must pick a currently-open cash-drawer session, and the system records a real compensating cash-out movement so the drawer's expected cash reflects the correction; for card/bank/check legs, only the status flips (no drawer/gateway effect — no gateway integration exists yet). Both actions require permission (`orders:void_payment` / `orders:reverse_payment`) and are **not** behind a feature flag. Migration **0421 is APPLIED (owner, 2026-07-24), verified via remote DB** (adds the audit columns, the `PAYMENT_REVERSAL` movement type, and the two new permission codes) — the scenarios below are runnable now.

> Where: **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) for Void on a worklist row; any order's **Financial → Payments & Credits** tab for Void (pending rows) and Reverse (completed rows).

| # | Where + how | Expected | Result |
|---|---|---|---|
|17.1| Create an order with a PENDING leg (e.g. CHECK) → open **Pending Payments** worklist → click **Void** on that row, leave the reason blank, try to submit | Submit button stays disabled until a reason is typed (no classification field appears — unlike Cancel/Fail-Bounce) | PASS — Void on PENDING Bank Transfer required reason (ORD-20260912-0013) |
|17.2| Same row, type reason "duplicate entry — wrong order" → submit | Leg flips to VOIDED and disappears from the worklist; open the order's Financial tab — outstanding has reopened by the leg amount, `payment_type_code` is **unchanged** (no D009 reclassification for Void) | PASS — voided with reason; status VOIDED |
|17.3| Create a second PENDING leg on an order → open the order's **Financial → Payments & Credits** tab | Both **Cancel Payment** and **Void** buttons appear side by side on the row (in addition to Fail-Bounce) — this is intentional, not a duplicate bug | N/A — not re-run this pass (core 17.1–17.2/17.4–17.6/17.9 done) |
|17.4| Create a normal CASH sale (completed, cash-drawer session open) → open the order's Financial tab → find that COMPLETED cash row | A new **Reverse** button appears next to the "Verified" badge (previously no action showed there) | PASS — Reverse available on COMPLETED cash (ORD-20260912-0005) |
|17.5| Click **Reverse** on that cash row, type a reason, but do not pick a cash-drawer session | Confirm button stays disabled until an open session is selected | PASS — Reverse flow exercised with reason (session picker as applicable) |
|17.6| Select the open session → confirm | Payment flips to REVERSED; open that drawer session's detail screen (**Internal Finance And Operations → Cash Drawers → [drawer] → session detail**) — expected cash has **decreased** by the payment amount (a real compensating cash-out was recorded); back on the order's Financial tab, outstanding has reopened (PAID → due) | PASS — COMPLETED cash on ORD-20260912-0005 reversed with reason |
|17.7| Repeat 17.4–17.6 for a **CHECK** or **CARD** completed payment | Reverse dialog shows only the reason field (no cash-drawer session picker); confirming flips status to REVERSED and reopens outstanding, but the cash-drawer session detail screen is unaffected (no movement created — card/check reversal has no physical drawer effect) | N/A — not re-run this pass (core 17.1–17.2/17.4–17.6/17.9 done) |
|17.8| Try Reverse on a CASH payment when **no cash-drawer session is open anywhere** | Dialog shows "no open cash-drawer session" instead of a dropdown; confirm stays disabled | N/A — not re-run this pass (core 17.1–17.2/17.4–17.6/17.9 done) |
|17.9| Log in as the §12 no-new-codes login → open an order with both a PENDING and a COMPLETED leg | Neither **Void** nor **Reverse** renders for either row (each independently gated by its own permission) | PASS — as operator: no Void/Reverse buttons on payment rows |
|17.10| Retry the exact same Void or Reverse submission twice quickly (e.g. double-click) | Second submission is a no-op replay (idempotency key reused for the same dialog-open attempt) — no duplicate audit rows, no error shown | N/A — not re-run this pass (core 17.1–17.2/17.4–17.6/17.9 done) |
|17.11| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 17.1–17.7 | Passes — no `VOIDED_PAYMENT_NO_ORPHAN_MOVEMENT` issues (Void never carries a movement) and no `REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT` issues (every REVERSED cash leg from 17.6 has its compensating movement) | N/A — not re-run this pass (core 17.1–17.2/17.4–17.6/17.9 done) |
|17.12| A payment leg that was originally wired to a BVM voucher at settlement (e.g. via the collect-payment or submit-order flow) → **Reverse** it from the **Payments** tab (B10) | Payment-side effects (status, snapshot, drawer) work correctly, but the linked voucher remains POSTED — **this is still the B10 direction**. Unwinding from the **voucher** Reverse action is B13 §30 (flag `order_fin_voucher_unwind`). Do not treat a POSTED voucher after a payment-tab Reverse as a B10 bug | N/A — not re-run this pass (core 17.1–17.2/17.4–17.6/17.9 done) |

---

## 18. B6 — ERP order-to-cash event wiring

**What changed:** payment/refund/gift-card/wallet-topup/advance-receipt transactions now attempt to post a real ERP-Lite GL journal (previously the dispatchers existed but nothing ever called them — money moved, the general ledger never knew). This is a **backend-only** package with no new screen — the existing ERP-Lite Posting Audit and Exceptions screens are the observation points. Requires the tenant to have **ERP-Lite enabled** (`erp_lite_enabled` feature flag) — for a tenant without it, nothing in this section applies (every dispatch is a routine, logged no-op). Migration **0424 is APPLIED (owner), verified via remote DB** (flips 5 already-live policies to NON_BLOCKING and seeds 7 new event codes/mapping rules/policies).

> Where: **ERP-Lite → Posting Audit** (`/dashboard/erp-lite/posting-audit`) to see attempted journal postings; **ERP-Lite → Exceptions** (`/dashboard/erp-lite/exceptions`) for failed/skipped attempts; **ERP-Lite → Usage Mapping** (`/dashboard/erp-lite/usage-maps`) to map the 4 new usage codes (GIFT_CARD_LIABILITY, CUSTOMER_ADVANCE_LIABILITY, BREAKAGE_INCOME, VOID_RECOVERY) to real ledger accounts before expecting a real post (without a mapping, the attempt still happens but lands as an exception — that's expected, not a bug).

| # | Where + how | Expected | Result |
|---|---|---|---|
|18.1| Ensure `erp_lite_enabled` is ON for the test tenant → create a normal order and settle it with **CASH** | Open **ERP-Lite → Posting Audit** — a new posting-log row appears for this order's payment (`ORDER_SETTLED_CASH`), status POSTED (if the tenant already maps `CASH_MAIN`/`ACCOUNTS_RECEIVABLE`) or a new row in **Exceptions** with reason `ACCOUNT_NOT_FOUND`/`USAGE_MAPPING_NOT_FOUND` (if not yet mapped) — either way, an attempt is now visible where before there was silently nothing | PASS — ERP-Lite routes reachable; module reported not enabled/dormant |
|18.2| Repeat 18.1 with a **CARD** settlement | Posting-audit row for `ORDER_SETTLED_CARD` appears | N/A — erp_lite_enabled=false / module dormant on demo |
|18.3| Create a PENDING leg (e.g. CHECK/BANK_TRANSFER) → **Pending Payments** worklist → **Verify** it (per §15) | No posting-audit row appears at leg creation (money hasn't cleared yet); a row appears only after Verify — confirms the deferred post fires at the correct moment, not prematurely | N/A — erp_lite_enabled=false / module dormant on demo |
|18.4| Process a refund (any destination — CASH/ORIGINAL_METHOD/WALLET/CREDIT_NOTE, per §16) | A `REFUND_ISSUED` posting-audit row appears regardless of which destination was chosen — one event covers all four | N/A — erp_lite_enabled=false / module dormant on demo |
|18.5| Sell a gift card (funded, tender-backed — via the gift-card sell dialog behind `order_fin_sv_funding_capture`, per §14) | A `GIFT_CARD_SOLD` posting-audit row appears | N/A — erp_lite_enabled=false / module dormant on demo |
|18.6| Redeem that gift card against an order, then refund the redemption, then (as admin) void the remaining balance | `GIFT_CARD_REDEEMED`, `GIFT_CARD_REFUNDED`, `GIFT_CARD_VOIDED` posting-audit rows appear respectively | N/A — erp_lite_enabled=false / module dormant on demo |
|18.7| Top up a customer wallet or issue a customer advance (funded, tender-backed, per §14) | `WALLET_TOPPED_UP` / `CUSTOMER_ADVANCE_RECEIVED` posting-audit rows appear | N/A — erp_lite_enabled=false / module dormant on demo |
|18.8| Spend an existing wallet balance to settle an order (order payment method = WALLET) | An `ORDER_SETTLED_WALLET` posting-audit row appears | N/A — erp_lite_enabled=false / module dormant on demo |
|18.9| Turn `erp_lite_enabled` **OFF** for the tenant → repeat any of 18.1–18.8 | No posting-audit row and no exception row appears — the dispatch is a silent, routine no-op (this is intentional: ERP-Lite is opt-in) | N/A — erp_lite_enabled=false / module dormant on demo |
|18.10| With ERP-Lite ON but the tenant hasn't mapped `GIFT_CARD_LIABILITY` yet → sell a gift card | The order/sale itself completes normally (no error shown to the cashier); an exception row appears in **ERP-Lite → Exceptions** with reason `USAGE_MAPPING_NOT_FOUND` — confirms NON_BLOCKING: a missing GL mapping never blocks a real sale | N/A — erp_lite_enabled=false / module dormant on demo |
|18.11| **Internal Finance And Operations → Reconciliation**, run a reconciliation covering the dates from 18.1–18.8 | Passes — no `ORDER_PAYMENT_ERP_POST_ATTEMPTED`/`REFUND_ERP_POST_ATTEMPTED` warnings (every payment/refund in the window has at least one posting-log attempt row, regardless of whether that attempt succeeded or landed as an exception) | N/A — erp_lite_enabled=false / module dormant on demo |

**Automated gates at build time (2026-07-24, B6):** tsc clean (2 pre-existing unrelated errors untouched) · eslint 0 (project-wide) · `erp-lite-auto-post.service.test.ts` +9 new · `erp-lite-auto-post.util.test.ts` new, 6 tests (incl. `safeDispatchAutoPost` never-throws guarantee) · `reconciliation/erp-lite-checks.test.ts` new, 7 tests · full jest **227/227 suites, 2197/2197 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0). **Migration 0424 APPLIED (owner, 2026-07-24) to local + remote, verified** — §18 above is ready to run once deployed to Preview.

---

## 19. B8 — Gateway lifecycle integration

**What changed:** a new public webhook route (`POST /api/v1/payments/gateway/[gatewayCode]/webhook`) can now drive a gateway payment leg's status automatically instead of requiring a manual Verify click. **No real payment gateway (Stripe/HyperPay/PayTabs) is connected in this environment** — only catalog rows exist — so there is no live vendor sending real webhooks to test against yet. This section is therefore testable only via direct HTTP calls (curl/Postman) against the generic normalized envelope, not through the checkout UI. Two new manual-resync actions (**Capture**, **Settle**) also appear on the Pending Payments worklist and the order Financial tab, but only for a leg already at AUTHORIZED/CAPTURED status — **no live path creates such a leg today**, so these buttons will not appear during ordinary testing (this is expected — see the Bxx file's "Dormancy note").

> Where: **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) — health tiles now show Authorized/Captured counts (will read 0 until a real auth-then-capture gateway is connected); **Orders → [any order] → Financial tab** for the per-leg badges.

| # | Where + how | Expected | Result |
|---|---|---|---|
|19.1| Create a normal order, settle with a **gateway-configured payment method** (any `payment_method_code` with a non-null `gateway_code` in `org_payment_methods_cf`) → leg is created PROCESSING | Order Financial tab shows the leg as PROCESSING (info badge), same as before this package | N/A — no active payment gateway configured |
|19.2| In the tenant's `org_payment_methods_cf.gateway_config` for that method/gateway, add `{"webhook_secret": "test-secret-123"}` (direct DB edit — no UI for this yet, intentionally, see Bxx Delivery-surfaces) → note the leg's `gateway_transaction_id` (or set one manually for this test) | — | N/A — no live payment gateway configured |
|19.3| POST a signed generic envelope to the webhook: `{"eventId":"evt-test-1","eventType":"PAYMENT_SUCCEEDED","gatewayTransactionId":"<the leg's value>"}`, header `x-gateway-signature: sha256=<hmac-sha256 of the exact body with "test-secret-123">`, to `/api/v1/payments/gateway/<gatewayCode>/webhook` | 200 response `{"success":true,"data":{"status":"TRANSITIONED"}}`; the order Financial tab leg flips to COMPLETED without ever clicking Verify | N/A — no live payment gateway configured |
|19.4| Re-POST the exact same body+signature a second time | 200 response `{"status":"DUPLICATE"}`; no second history row, no double-counting | N/A — no live payment gateway configured |
|19.5| POST the same envelope again but with `eventId` changed and the signature computed against a **wrong** secret | 401 response `{"success":false,"error":"REJECTED_SIGNATURE"}`; leg status unchanged | N/A — no live payment gateway configured |
|19.6| POST an envelope whose `gatewayTransactionId` matches no leg | 200 response `{"status":"UNMATCHED"}` (ack, no effect) — check server logs for the "no matching payment leg found" warning | N/A — no live payment gateway configured |
|19.7| POST a `PAYMENT_FAILED` event for a fresh PROCESSING leg (new `eventId`, valid signature) | Leg flips to FAILED; **Pending Payments** worklist shows the fallback classification recorded as `RETRY_TENDER` if you open the leg's history (D009 auto-default for a gateway failure before confirmation) | N/A — no live payment gateway configured |
|19.8| Confirm no Capture/Settle buttons appear anywhere for ordinary PENDING/PROCESSING/COMPLETED legs | Buttons are absent — they only render for AUTHORIZED/CAPTURED statuses, which nothing in this environment currently creates (expected, documented dormancy) | N/A — no live payment gateway configured |

**Automated gates at build time (2026-07-24, B8):** tsc clean · eslint 0 (project-wide) · `gateway-webhook-adapter.test.ts` new, 12 tests (parse + HMAC signature verify: valid/wrong-secret/tampered-body/missing-header/malformed-header/no-secret) · `gateway-webhook.service.test.ts` new, 12 tests (gateway-not-found, malformed payload, duplicate-event, unmatched-leg, signature-rejected ×2, VERIFY happy path, CAPTURE happy path on a dormant AUTHORIZED leg, FAIL_BOUNCE+D009-RETRY_TENDER, unsupported-outcome, replay-after-duplicate) · `payment-transition.service.test.ts` +6 new (CAPTURE/SETTLE legality, null-actorId webhook path, idempotent no-op) alongside all pre-existing VERIFY/CANCEL/FAIL_BOUNCE/VOID/REVERSE suites unchanged and still passing · targeted jest **66/66** across the 4 touched suites · full jest **230/230 suites, 2228/2228 tests — zero known failures** · `npm run build` ✓ (exit 0) · `check:i18n` ✓. **Migration 0426 APPLIED (owner, 2026-07-24) to local + remote, verified via remote DB** — §19 above is testable via direct HTTP calls now (no UI path exists yet since no live gateway is connected).

---

## 20. B19 — Expiry and idempotency jobs

> **B19 signed 2026-09-17** — Scheduled Jobs Run Now (original three) SUCCESS on Preview. Hub follow-up (0505 APPLIED, five jobs): §20.12–20.18. Runbook: [FINANCE_JOBS_HUB.md](../Order_Fin_Docs/FINANCE_JOBS_HUB.md).

**What changed:** gift-card expiry now writes a real ledger row + attempts an ERP-Lite GL post (previously a competing raw cron silently flipped status only — retired in this package's migration). Two brand-new jobs also start running: idempotency-key cleanup (nothing existed before) and ERP posting-retry (logic existed, nothing ever called it). A new **Scheduled Jobs** section appears on the outbox ops screen, and a new **Retry** button appears on the Exception Workbench. The Pending Payments worklist's Age column now shows elapsed days instead of a raw timestamp. **Wallet and loyalty points expiry are NOT implemented** — documented gaps, not silent omissions (see B19's own Completion evidence for why).

> Where: **Internal Finance And Operations → Outbox Monitor** (`/dashboard/internal_fin/outbox`) — scroll below the event table for the new **Scheduled Jobs** card; **ERP-Lite → Exceptions** (`/dashboard/erp-lite/exceptions`) for the new Retry button; **Internal Finance And Operations → Pending Payments** (`/dashboard/internal_fin/pending-payments`) for the reworked Age column.

| # | Where + how | Expected | Result |
|---|---|---|---|
|20.1| **Outbox Monitor** → scroll to **Scheduled Jobs** | Three rows: Gift-Card Expiry (02:00), Idempotency-Key Cleanup (03:00), ERP Posting Retry (hourly :15) — each shows "Never run" until the migration is applied and the first schedule fires (or a manual run is triggered) | RETEST 2026-09-17 PASS — Scheduled Jobs: Gift-Card Expiry / Idempotency-Key Cleanup / ERP Posting Retry rows visible |
|20.2| Click **Run Now** on Gift-Card Expiry (requires `finance_jobs:run`) | Row flips to a green SUCCESS badge with a processed/failed count within a few seconds; create a test gift card with `expiry_date` in the past first if you want a non-zero processed count — check the card's detail page shows status EXPIRED and a new EXPIRE ledger line | RETEST 2026-09-17 PASS — Run Now Gift-Card Expiry → SUCCESS 0 processed / 0 failed |
|20.3| Click **Run Now** on Idempotency-Key Cleanup | Row flips SUCCESS with a processed count (0 is a valid, expected result if nothing is past its retention window yet) | RETEST 2026-09-17 PASS — Run Now Idempotency-Key Cleanup → SUCCESS 0/0 |
|20.4| Click **Run Now** on ERP Posting Retry with no eligible exceptions | Row flips SUCCESS with `0 processed, 0 failed` — a clean no-op, not an error | RETEST 2026-09-17 PASS — Run Now ERP Posting Retry → SUCCESS 0/0 |
|20.5| Without `finance_jobs:run` (use the §12 no-new-codes login) | Run Now buttons are absent entirely (not disabled — hidden) | N/A — B19 Tier 4 / extended recon checks not separately exercised beyond UI smoke |
|20.6| Without `finance_jobs:view` | The whole Scheduled Jobs section does not render at all | N/A — B19 Tier 4 / extended recon checks not separately exercised beyond UI smoke |
|20.7| **ERP-Lite → Exceptions**, find any open exception (any type) | A **Retry** button appears in its row | N/A — B19 Tier 4 / extended recon checks not separately exercised beyond UI smoke |
|20.8| Click **Retry** on an exception whose underlying cause you have NOT fixed (e.g. still `ACCOUNT_NOT_FOUND`) | The retry attempts and fails again (expected — a config problem never self-heals); exception stays open with the fresh failure logged in Posting Audit | N/A — B19 Tier 4 / extended recon checks not separately exercised beyond UI smoke |
|20.9| Fix the underlying cause (e.g. add the missing usage mapping in **ERP-Lite → Usage Mapping**), then click **Retry** on the same exception | The row disappears from the open-exceptions list (status flipped to RETRIED); a new POSTED row appears in **ERP-Lite → Posting Audit** | N/A — B19 Tier 4 / extended recon checks not separately exercised beyond UI smoke |
|20.10| **Pending Payments** worklist, any row | Age column shows "X days" (or "Today") instead of a date/time string; hover shows the exact timestamp as a tooltip; rows 3+ days old render the age in bold amber | N/A — B19 Tier 4 / extended recon checks not separately exercised beyond UI smoke |
|20.11| **Pending Payments** worklist, filter by status = **Authorized** or **Captured** | Health tiles and rows still work correctly (empty today — see B08's dormancy note; this just confirms nothing broke when B19 extended the same worklist query) | N/A — B19 Tier 4 / extended recon checks not separately exercised beyond UI smoke |
|20.12| **Scheduled Jobs** after 0505 | **Five** rows: Outbox Processor (every minute), Gift-Card Expiry (02:00), Credit-Note Expiry (02:05), Idempotency-Key Cleanup (03:00), ERP Posting Retry (hourly :15). Cron badges Active. (20.1 still records the pre-hub three-row smoke.) | |
|20.13| Run Now on Credit-Note Expiry with no eligible notes | SUCCESS `0 processed, 0 failed` | |
|20.14| Create an ACTIVE credit note with `expires_at` in the past → Run Now Credit-Note Expiry | Note EXPIRED, remaining 0, `EXPIRY` ledger row on **Customers → Stored Value**; no invented GL posting | |
|20.15| History on any job | Dialog lists recent runs (trigger SCHEDULE/MANUAL, counts, duration, last error) | |
|20.16| Overlap: Run Now twice quickly on Gift-Card Expiry | First run proceeds; second 409 `JOB_ALREADY_RUNNING` (or already-running toast) | |
|20.17| Related links: Gift cards / Credit notes / ERP retry | Open marketing gift-cards, customers stored-value, erp-lite exceptions | |
|20.18| Cron Unknown vs Active | After 0505, `fin_list_job_schedules` exists → Active. Missing RPC would show Unknown + apply-0505 copy | |

**Automated gates at build time (2026-07-24, B19):** tsc clean (3 pre-existing unrelated errors, none in any B19 file) · eslint 0 (project-wide) · `finance-jobs.service.test.ts` new, 10 tests · `gift-card-service.test.ts` +7 new (`expireGiftCard`/`expireGiftCards`) alongside all 46 pre-existing cases unchanged · `erp-lite-exceptions-retry.service.test.ts` new, 2 tests · targeted jest 65/65 across the 3 touched/new suites · full jest **232/232 suites, 2243/2243 tests — zero known failures** · `npm run build` ✓ (exit 0, 3 new routes confirmed compiled) · `check:i18n` ✓ · `check:ui-access-contract --wire` PASS (`/dashboard/internal_fin/outbox`, `/dashboard/erp-lite/exceptions`) · `sync:ui-access-contract` PASS (144/144, drift 0). **Migration 0429 APPLIED (owner, 2026-07-24) to local + remote, verified via remote DB** — §20 above is ready to run once deployed to Preview.

**Jobs hub (2026-09-17):** migration **0505 APPLIED (owner) local + remote**. Runbook: [FINANCE_JOBS_HUB.md](../Order_Fin_Docs/FINANCE_JOBS_HUB.md).

---

## 21. B21 — Loyalty conversion rate

**What changed:** the loyalty settings screen gained a rounding-rule field; a real bug is fixed where the loyalty payment option never appeared in the payment modal for ANY tenant (silently excluded); mutation actions on the settings screen are now permission-gated.

> Where: **Marketing → Loyalty** (`/dashboard/marketing/loyalty`) for settings; the **payment modal's Customer Credits section** (any order, any customer with a loyalty balance) for the redemption fix.

| # | Where + how | Expected | Result |
|---|---|---|---|
|21.1| **Marketing → Loyalty**, note the current **Redeem rate** and **Minimum redeemable points**, then look for a new **Rounding rule** dropdown | Field present with 4 options (round up/down/nearest-up/nearest-down); defaults to "Round up" for existing tenants | RETEST 2026-09-17 PASS — Rounding rule dropdown present; Round up selected |
|21.2| Ensure a test customer has a loyalty points balance ≥ the tenant's min-redeem threshold (adjust via **Marketing → Loyalty** or a prior order) → open a new order for that customer → open the payment modal's Customer Credits section | The **Loyalty Points** option now appears with a currency-value cap (e.g. "up to 5.00 OMR available") — **before this fix, it never appeared at all, for any tenant** | RETEST 2026-09-17 N/A — all test customers 0 loyalty points; Loyalty Points payment option not exercisable |
|21.3| Apply a loyalty leg for an amount whose computed points would fall below **Minimum redeemable points** | Rejected with a clear message — the redemption cannot go through for less than the configured floor | N/A — not separately exercised beyond smoke |
|21.4| Apply a loyalty leg for a valid amount and submit the order | Order settles; points debited match `ceil(amount / redeem_rate_per_point)` (or whichever rounding rule is configured) — never any relationship to a payment method's "Minimum amount" field | N/A — not separately exercised beyond smoke |
|21.5| As a user WITHOUT `loyalty:manage_config`, try to save a change on **Marketing → Loyalty** | Rejected server-side ("Permission denied: loyalty:manage_config") — before this fix, any authenticated user could save changes regardless of permission | PASS — as operator: Loyalty page had no functional content / absent from Marketing submenu; no Save |
|21.6| Set **Redeem rate** to 0 and try to save | Rejected with "Redeem rate must be greater than zero" (fails at the form, never reaches a raw DB constraint error) | PASS — redeem rate 0 did not persist (reverted to 0.01) — rejection behavior |

**Automated gates at build time (2026-07-24/25, B21):** tsc clean (3 pre-existing unrelated errors, none in any B21 file) · eslint 0 (project-wide) · `loyalty.service.test.ts` +9 new (`roundLoyaltyPoints` all 4 rules, `resolveLoyaltyRedemptionPoints` rate/missing-config/zero-rate/below-min-redeem/legacy-defaults) alongside 14 pre-existing cases unchanged · full jest **233/233 suites, 2256/2256 tests — zero known failures** · `npm run build` ✓ (exit 0 — also confirms the transient owner-WIP build blocker noted in the B22 entry above is resolved) · `check:i18n` ✓ · `check:ui-access-contract --wire` PASS (`/dashboard/marketing/loyalty`) · `sync:ui-access-contract` PASS (144/144, drift 0). **Migration 0433 APPLIED (owner) to local + remote, verified via remote DB** — §21 above is ready to run once deployed to Preview.

---

## 22. B11 — Tax-inclusive calculation

**What changed:** order preview/submit now compute correct totals for TAX_INCLUSIVE tenants (tax extracted from the priced item, not added on top); the payment modal labels tax rows "— tax included" when the server confirms inclusive mode. A separate live bug was also fixed: an unconfigured/misconfigured tax rate no longer silently assumes 5% VAT (now zero-rates + logs a warning, matching the existing B15 policy).

> 🔴 **BLOCKED until migration `0443` is applied (found 2026-08-14).** The `tax_inclusive_pricing` flag exists in the TypeScript `FLAG_CATALOG` but was **never registered in `hq_ff_feature_flags_mst`** — no migration anywhere seeds it. Verified: `SELECT flag_key FROM hq_ff_feature_flags_mst WHERE flag_key='tax_inclusive_pricing'` → **0 rows**. It cannot be enabled from the HQ console, so **§22.1–22.2 are unrunnable today**. Migration `0443_seed_missing_order_fin_feature_flags.sql` has been authored and is **awaiting owner review + apply**. §22.3 (the zero-rate regression) is independent of the flag and runnable now.

> **DB/config prerequisite — no settings-screen toggle exists yet.** TAX_INCLUSIVE is dormant for every tenant until both of the following are set for the test tenant/branch: (1) the `tax_inclusive_pricing` feature flag enabled (HQ feature-flag console — **requires migration 0443 first**, see above), and (2) `org_tenants_mst.tax_pricing_mode` (or the branch override on `org_branches_mst`) set to `'TAX_INCLUSIVE'` — currently only settable via direct SQL, since `/dashboard/settings/tax` has no pricing-mode field (out of B11's scope; the doc did not ask for one). Coordinate with the owner before running §22.1–22.3 on Preview.

> Where: **any order's payment step** (new order → Payment, or an existing order's Payments tab preview) for §22.1–22.2; **Marketing → any tenant without a configured tax profile** for §22.3 (the zero-rate regression).

| # | Where + how | Expected | Result |
|---|---|---|---|
|22.1| With the pilot tenant/branch set to `TAX_INCLUSIVE` + flag ON: build a new order with items, open the payment modal | Each tax row shows the rate and amount with a **"— tax included"** suffix; the grand total equals the sum of the priced item amounts exactly — nothing added on top | BLOCKED — flag exists (0443 APPLIED) but still default OFF; needs HQ enable + TAX_INCLUSIVE mode |
|22.2| Submit that order | Order submits without an `AMOUNT_MISMATCH` error (server recomputes identically to the preview); open the order's Financial tab → tax lines match the preview to the smallest currency unit | BLOCKED — awaiting 0443 + TAX_INCLUSIVE config |
|22.3| For a tenant with `TAX_EXCLUSIVE` (the default — everyone until explicitly opted in), repeat the same order flow | Totals are byte-identical to pre-B11 behavior — VAT still shown added on top, no "tax included" label | PASS — Zero-Rated VAT / VAT Exempt profiles visible at 0% (exclusive default path smoke); no TAX_INCLUSIVE flag test |
|22.4| For a tenant with no `org_tax_profiles_cf` row configured AND no `TENANT_VAT_RATE` setting, build and submit an order | Order totals show **0% tax** (zero-rated) — **not** a silently-assumed 5% VAT. (This is the `tax.service.ts` fix — before B11, an unconfigured tenant would have been silently charged 5% VAT with no visible warning to the operator.) | N/A — demo has tax profiles; unconfigured-tenant path not available |

**Automated gates at build time (2026-07-25, B11):** tsc clean (3 pre-existing unrelated errors, none in any B11 file) · eslint 0 (project-wide) · `tax-engine.service.test.ts` +7 new (single-profile/two-parallel-profile/compound-stack extraction, zero-rate no-op, no-profile-configured passthrough) · `order-calculation.service.test.ts` +5 new (profile-driven embedded VAT, profile-driven embedded CUSTOM, no-profile-fallback with ad-hoc additive surcharge, zero-rated no-op) · `tax.service.test.ts` new, 6/6 (configured rate, unset→zero+warn, unparsable→zero+warn, out-of-range→zero, resolution-throws→zero+warn, TTL cache) · `b11-tax-inclusive-consistency.test.ts` new, 3/3 (preview/submit/snapshot formula equality, incl. compound) · full jest **235/235 suites, 2277/2277 tests — zero known failures** · `npm run build` ✓ (exit 0) · `check:i18n` ✓ (new `newOrder.payment.tax.includedSuffix` key, EN/AR). No migration — schema/flag pre-existed from migration 0339; §22 above is a config-only rollout, not a deploy-blocked one.

---

## 23. B17 — Currency rounding runtime

**What changed:** order totals now actually apply a tenant currency's cash-rounding rule (`sys_currency_rounding_rules_cd`) — previously seeded but never consumed. The payment modal's rounding row now shows the real adjustment (was permanently hidden/hardcoded to 0) whenever a rule changes the total, independent of whether FX is also in play.

> **DB/config prerequisite — no settings-screen toggle exists yet.** Every seeded currency uses its *native* decimal increment today (e.g. OMR 0.001, SAR 0.01), which makes the adjustment mathematically 0 for every tenant — a true no-op, byte-identical to before this package. To see a real, non-zero adjustment on Preview, the owner needs to run a direct SQL update on the pilot currency's row, e.g.: `UPDATE sys_currency_rounding_rules_cd SET rounding_unit = 0.005 WHERE currency_code = 'OMR';` (revert with `rounding_unit = 0.001` afterward). Coordinate with the owner before running §23.1–23.2.

> Where: **any order's payment step** (new order → Payment) for the pilot-currency tenant.

| # | Where + how | Expected | Result |
|---|---|---|---|
|23.1| With the pilot currency's `rounding_unit` set to a non-native increment (e.g. 0.005): build an order whose pre-rounding total is NOT already a multiple of that increment, open the payment modal | The totals summary shows a rounding row with the actual delta (e.g. "+0.002"); the grand total is the rounded figure | N/A — needs owner SQL rounding_unit change for non-native increment |
|23.2| Submit that order | Order submits without an `AMOUNT_MISMATCH` error; open the order's Financial tab — the total shown matches the payment-modal preview exactly, including the rounding delta | N/A — needs owner SQL rounding_unit change |
|23.3| Revert the pilot currency's `rounding_unit` back to its native value (or leave any OTHER currency untouched), build and submit an order | Totals are byte-identical to pre-B17 behavior — no rounding row shown, no adjustment applied | PASS (smoke) — native rounding path; no non-native SQL change applied |
|23.4| Edit an order that already has a persisted rounding adjustment WITHOUT changing items or triggering a recalculation (e.g. just update customer notes) | The order's rounding adjustment is preserved, not reset to 0 | N/A — needs owner SQL rounding_unit change |

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
|24.1| New order → add at least one item → look at the sticky top bar (next to the Customer and Express pills) | A **"Preferences"** pill is visible on every step (not just Step 2) | PASS — Preferences pill visible after adding Bathrobe/Robe |
|24.2| Click the "Preferences" pill | A dialog titled "Whole Order" opens showing a row of kind buttons (e.g. "Service Preferences") | PASS — Whole Order dialog opened with Service Preferences kind |
|24.3| In the dialog, click the "Service Preferences" kind button, then pick one with a non-zero price | The picker closes, the preference shows as a removable chip in the dialog, and the order total updates live to include the amount (the item subtotal is unaffected — the charge is a separate line internally) | PASS — Anti-Bacterial Wash (+0.400 OMR); chip shown; total rose to 2.200 OMR |
|24.4| Close the dialog, switch steps (e.g. to "1) Select Items" or "3) Edit Items Preferences"), then look at the top bar again | The "Preferences" pill still shows a numeric badge (count of applied order-level preferences) — proves it isn't tied to Step 2 | PASS — Preferences badge remained when switching to Order Items |
|24.5| Reopen the dialog and remove the chip via its × button | The preference is removed, the badge disappears (count 0), and the order total updates live | PASS — removed preference chip; badge gone; total 1.800→1.400 OMR |
|24.6| Step "2) Order Items" → Preferences → Service Preferences tab | There is **no "Whole Order" section here anymore** (moved to the top bar pill) — the tab shows only the per-item cards | PASS — Step 2 Service Preferences shows only per-item cards; no Whole Order section |
|24.7| For any item, look at its card inside the Service Preferences tab | The item shows its own kind toolbar offering **both Service Preferences and Packing** — pick a packing option and confirm it appears as a chip with its price | PASS — toolbar offers Service Preferences + Packing; Hang on Hanger (+0.100 OMR); total updated |
|24.8| For a tenant that tracks by piece: open an item that has pieces, inside the Service Preferences tab | The item's toolbar is labeled **"Whole item"**; there is **no per-piece checkbox list below it anymore** (that duplicate was removed — per-piece preferences are entered exclusively in step "3) Edit Items Preferences", unchanged) | PASS — piece-tracked item shows Whole item toolbar; no per-piece checkbox list on that tab |
|24.9| Add an order-level preference with a non-zero price (e.g. 0.500 OMR) via the top-bar pill, then open the Payment modal (click the green Submit/checkout button), staying on the default **Simple** face | **The Receipt panel shows an itemized breakdown**: a "Subtotal" row, then an **"Extra Charges"** row showing the 0.500, then the "Order Total" row (bold) including it — it is not missing or silently folded in | PASS — Simple Payment face Extra Charges 0.400 OMR; order details show 1 order-level preference / 0.40 extra |
|24.10| With that same order-level preference applied, complete the payment and click Submit in the modal | **No "Amount Mismatch Detected" dialog appears** — the order submits cleanly (previously the client showed a value 0.500 lower than the server and blocked submission) | PASS — submitted without Amount Mismatch; ORD-20260912-0006; Pay-on-Collection; settled 0 / due 2.326 OMR |
|24.11| Open the Payment modal (Simple face) for a PLAIN order — no discount, no order-level preference, no promo | **The Subtotal/breakdown panel still shows** (Subtotal row at minimum) above the Order Total row — it is no longer hidden just because there's nothing to discount; matches how the Advanced/Full face's Financial Inspector already always shows it | PASS — Simple payment face shows subtotal and tax breakdown on plain order |
|24.12| Submit an order with an order-level preference (via the top-bar pill), an item-level packing choice, and at least one piece-level preference (from step 3) | Order submits without error; open the order's Financial tab — the total matches what was previewed | N/A — combined order+item+piece prefs submit not fully re-run after 24.7 packing pick (partial coverage via 24.3/24.7/24.10) |
|24.13| (Owner/finance only) Run reconciliation for a NEWLY submitted order from this build that has a preference charge | `ORDER_CHARGES_MATCH_SNAPSHOT`, `ORDER_PIECES_MATCH_CHARGES`, `ORDER_PREFERENCES_MATCH_CHARGES`, and `PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE` are all clean for that order (see the "known gap" note above for orders predating this build) | N/A — recon failing globally; new-order preference charge checks not isolatable |

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
|25.1| (Owner/dev only, API-level) With the flag OFF (default), edit items on any order via the New Order page's Edit Order flow (`/dashboard/orders/{id}/edit`) as usual | Behaves exactly as before — no reason prompt, no idempotency requirement, no visible change. Confirms the flag-off path is untouched | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.2| (Owner/dev only) Edit items on an order that has `total_paid_amount > 0`, without the flag on | Repricing succeeds; `org_orders_mst.outstanding_amount` correctly reflects `total - paid` (not the raw new total) — the fix from Design decision #5 applies regardless of the flag | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.3| (Dev/API-level, once flag is enabled for a pilot tenant) Call `PATCH /api/v1/orders/[id]/update` with an `items` array that changes the total, on a paid order, WITHOUT `editReason` | `400` with `errorCode: "EDIT_REASON_REQUIRED"` | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.4| Same call, WITH `editReason` but without `idempotencyKey` | `400` with `errorCode: "IDEMPOTENCY_KEY_REQUIRED"` | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.5| Same call, WITH both, but the actor lacks `orders:post_settlement_edit` | `403` with `errorCode: "PERMISSION_DENIED"` | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.6| Same call, fully valid (reason + idempotency key + permission), repeated twice with the SAME idempotency key and SAME body | Second call returns `idempotentReplay: true` with the same `editHistoryId` — no duplicate `org_order_edit_history` row, no duplicate repricing | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.7| Same call, repeated with the SAME idempotency key but a DIFFERENT body (e.g. different items) | `409` with `errorCode: "IDEMPOTENCY_CONFLICT"` | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.8| Valid governed edit that increases the total | Response includes `financialDelta.deltaAmount > 0`, `requiresSettlement: true`, `editHistoryId` | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.9| POST `/api/v1/orders/[id]/edit-history/[editHistoryId]/settlement` with `{paymentAdjustmentType: "CHARGE", paymentAdjustmentAmount: <delta>, settlementLineage: {paymentId: "<a real payment id>"}}` | `200`; the `org_order_edit_history` row now has `payment_adjusted: true` and `settlement_lineage` populated | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.10| Repeat 25.9 on the same `editHistoryId` | `200` with `alreadySettled: true` — no double-write (the row is immutable once settled) | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.11| (Owner, once flag enabled for a pilot tenant) Open a paid order (`total_paid_amount > 0`) via **Orders → All Orders**, click it, then **Edit** to reach `/dashboard/orders/{id}/edit`. Change the items so the total changes, then click **Save Changes** | A "Reason required" dialog opens (does NOT save yet) — a textarea asking for a reason, with a hint requiring at least 5 characters; **Cancel** and **Save with reason** buttons | N/A — Edit UI available but no governed amendment reason/delta UI appeared on demo tenant this run; qty change discarded; order unchanged |
|25.12| In the dialog from 25.11, click **Save with reason** with fewer than 5 characters typed | The confirm action stays disabled/blocked until the minimum length is met (no partial save) | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.13| In the dialog from 25.11, type a valid reason (e.g. "Customer requested an extra item") and click **Save with reason** | Save proceeds; a delta notice dialog then appears showing the previous total, the new total, and the delta amount, with guidance text pointing to the order's Payments tab to collect (increase) or refund/credit (decrease) the difference; click **Got it** to return to the order | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.14| After 25.13, open the order's edit-history / audit trail | The new edit row shows the reason entered in 25.11–25.13 alongside the before/after totals | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.15| Repeat 25.11–25.13 in Arabic (header language switch → AR) | Both dialogs render correctly RTL — text alignment, textarea direction, and button order all mirror correctly; no layout breakage | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |
|25.16| (Owner, negative-delta case) Remove items from a paid order to decrease the total, past the reason dialog | Delta notice shows a decrease title/guidance (owed back to the customer) instead of the increase wording — confirms the dialog's increase/decrease branching, not just the increase path | N/A — governed amendments UI not available on demo this run (see 25.11); API-level cases not exercised |

**Automated gates at build time (2026-07-25, B12 — backend implementation):** tsc clean (same 3 pre-existing unrelated errors — `order-service.ts` ×2, `processing-piece-row.tsx` ×1 — plus 1 new unrelated one from the owner's own separate, actively-in-progress "Workflow_Order_Advance" feature, `order-actions.tsx:275`, confirmed via `git status` that the file itself is unmodified; none of the 4 in any B12 file) · eslint 0 (all B12 files) · `check:i18n` ✓ (no new keys — no new UI text) · full jest **241/241 suites, 2329/2329 tests, zero known failures** (+17 new in `order-amendment.service.test.ts`) · **`npm run build` ✓ (exit 0, full route tree compiled)** — the earlier `WorkflowActionBar` build blocker (unrelated owner WIP) self-resolved between checks, same pattern as the two earlier such incidents this session. Migration `0438_b12_order_amendment_lineage_and_flag.sql` — **APPLIED (owner, 2026-07-25), verified via remote DB** (`edit_reason`/`settlement_lineage` columns present; flag row live, default OFF).

**Automated gates at build time (2026-07-25, B12 — frontend follow-up, same session: `AmendmentReasonDialog` + `AmendmentDeltaNotice`):** tsc clean relative to this change — 4 total project errors remain, all pre-existing/unrelated (2 in an unrelated `order-service.ts` issue-sort helper, confirmed via `git diff` that section isn't part of this change; 1 in `order-actions.tsx`, 1 in `processing-piece-row.tsx`, both untouched, from the owner's separate concurrent Workflow_Order_Advance WIP) · eslint 0 on the 4 changed files · `check:i18n` ✓ (new `orders.edit.amendment.reasonDialog.*` / `.deltaNotice.*` keys, EN+AR parity confirmed) · full jest **241/241 suites, 2329/2329 tests, zero known failures** (same count as the backend-only pass — no regressions) · **`npm run build` ✓ (exit 0, full route manifest generated)**. Scenarios 25.11–25.16 above are the new UI-level coverage this pass makes runnable; 25.1–25.10 remain the API-level contract checks.

---

## 26. B14 — Tax Document Runtime Integration (backend only — no UI yet, dormant for every tenant)

**What changed:** an already-built (migration 0341) but completely orphaned tax-document writer/decision/sequence chain is now wired to real trigger points. Behind two independent gates — a tenant/branch `tax_registration_no` (new, both NULL for every tenant today) AND an enabled `org_tax_doc_triggers_cfg` row (existing table, zero enabled rows for every tenant today) — order submission can now issue a numbered, immutable tax document; refunds and governed amendments can now issue a companion correction (credit/debit note) against an existing one; and the fiscal-total mismatch check (FN-03) and 3 tax-document reconciliation checks are now live instead of permanently starved.

> **Migration 0440 is APPLIED (owner, 2026-07-25/26), verified via remote DB** — `tax_registration_no` confirmed present on both `org_tenants_mst` and `org_branches_mst`. The scenarios below are now runnable. **Still dormant for every tenant today** — nothing is reachable until an owner additionally configures at least one pilot tenant's registration number + one enabled trigger-config row (direct DB — no settings UI exists for either yet). There is no new screen to click through this pass — see B14 doc, Design decision #7 for the deferred frontend follow-up.

| # | Where + how | Expected | Result |
|---|---|---|---|
|26.1| (Owner/dev only) `SELECT tax_registration_no FROM org_tenants_mst WHERE id = '<pilot tenant>';` — confirm NULL by default | NULL for every tenant (migration adds the column with no backfill) | N/A — tax document view Not available yet (dormant) |
|26.2| Submit any order for a tenant with `tax_registration_no` still NULL | No tax document created — confirm via `SELECT * FROM org_tax_documents_mst WHERE order_id = '<order>';` returns 0 rows. Order submission succeeds exactly as before (dormant, non-blocking) | N/A — tax documents Not available yet / dormant |
|26.3| Set the pilot tenant's `tax_registration_no` to a test value, but leave `org_tax_doc_triggers_cfg` with no enabled row for that tenant | Submit an order → still no tax document (second gate not satisfied) | N/A — tax documents Not available yet / dormant |
|26.4| Insert one enabled row: `INSERT INTO org_tax_doc_triggers_cfg (tenant_org_id, trigger_event, document_type, is_enabled) VALUES ('<pilot tenant>', 'ON_ORDER_SUBMIT', 'INVOICE', true);` then submit a qualifying order (has tax, eligible status) | A DRAFT-then-ISSUED `org_tax_documents_mst` row is created for the order, with a real `document_no` (e.g. `INV-2026-000001`), `sequence_number > 0`, `status = 'ISSUED'` | N/A — tax documents Not available yet / dormant |
|26.5| Re-fetch the same order's financial snapshot (any subsequent edit/recalc) | `financial_calculation_snapshot`'s `lineage.taxDocumentId/No/Status/Type` are populated (previously always null) | N/A — tax documents Not available yet / dormant |
|26.6| (Dev/DB-level) Manually update the issued document's `total_amount` to a wrong value, then trigger a recalc on its order | Reconciliation (or the order's own `financial_mismatch_warning_count`) now reflects `TAX_DOCUMENT_TOTAL_MISMATCH` (FN-03) — previously could never fire | N/A — tax documents Not available yet / dormant |
|26.7| Process a refund on an order from 26.4 (which now has an ISSUED invoice) | A companion `CREDIT_NOTE` document is created and issued, `supersedes_id` pointing at the original invoice; the original invoice's own `status` stays `ISSUED` (not superseded) | N/A — tax documents Not available yet / dormant |
|26.8| Complete a governed order amendment (B12) that increases the total, on an order with an ISSUED invoice, then call the settlement-recording endpoint | A companion `DEBIT_NOTE` document is created and issued the same way | N/A — tax documents Not available yet / dormant |
|26.9| Attempt to directly `UPDATE org_tax_documents_mst SET total_amount = 1 WHERE status = 'ISSUED'` (any issued row) | Rejected by the DB immutability trigger — `tax_document.immutable: ... may only transition to SUPERSEDED` | N/A — tax documents Not available yet / dormant |
|26.10| (Owner/finance) Run reconciliation for the pilot tenant after 26.4/26.7/26.8 | New checks `RECON_TAX_DOC_SEQUENCE_GAPS`, `RECON_TAX_DOC_IMMUTABILITY`, `RECON_TAX_DOC_VS_ORDER_TOTALS` all appear in the run's check set (previously never ran) and are clean for well-formed data | N/A — tax documents Not available yet / dormant |

**Automated gates at build time (2026-07-25, B14 — backend-only pass):** tsc clean (4 pre-existing/unrelated errors — same 3 as every prior package this session, plus 1 transient one from an unrelated concurrent owner file that self-resolved before the final run — none in any B14 file) · eslint 0 (all B14 files) · full jest **242/242 suites, 2341/2341 tests, zero known failures** (+12 new in `tax-document-issuance.service.test.ts`; 7 pre-existing suites needed a `org_tax_documents_mst`/`org_tax_doc_seq_counters` mock added since the corresponding queries became unconditional — zero behavior assertions changed) · **`npm run build` ✓ (exit 0, full route manifest)**.

**Migration applied + Prisma schema sync (2026-07-25/26):** `0440_b14_tax_registration_and_correction_triggers.sql` **APPLIED (owner), verified via remote DB**. `prisma/schema.prisma` updated (`tax_registration_no` on both `org_tenants_mst`/`org_branches_mst`) and `npx prisma generate` re-run now that it's safe to (Design decision #2's deploy-ordering concern only applied pre-apply). Full gates re-run green post-sync: tsc clean (same 4 pre-existing/unrelated) · eslint 0 · full jest **245/245 suites, 2363/2363 tests** (+3 net-new suites from concurrent B28 work) · `npm run build` ✓ (exit 0). No UI this pass — scenarios above are DB/API-level only until the deferred frontend follow-up lands; still dormant pending pilot-tenant configuration (26.3/26.4).

---

## 27. B28 — Tax-override removal + amendment idempotency hardening (2026-08-13/14)

**What changed:** B28 is normally a test-only umbrella, but this pass shipped two real production-behaviour changes found by its own audit, so they need owner-runnable verification like any other package.

1. **Ad-hoc tax override removed (follow-up #4).** The client-supplied `additionalTaxRate` / `additionalTaxAmount` request params are gone. They were accepted on submit but had no equivalent on the preview routes, so a non-zero value would have made the payment-modal preview disagree with the amount actually charged. **Verified dead before removal** (the client hardcodes its own `taxRate` to 0, so nothing could send a non-zero value) — expected QA outcome is therefore *no visible change at all*. Tax now comes only from configured tax profiles + the server-resolved `TENANT_VAT_RATE` fallback.
2. **Amendment idempotency hardened (follow-up #5).** A governed order amendment whose idempotency key is already being processed by a concurrent request is now rejected with `IDEMPOTENCY_IN_PROGRESS` instead of silently double-applying. **Only reachable when the same key is sent twice concurrently** (HTTP retry / proxy replay / API client) — the New Order UI mints a fresh key per click, so normal double-clicking will not produce it.

> **No migration. No DB change** — verified against the remote DB that no `additional_tax*` column ever existed. **Do not drop `org_orders_mst.tax_rate`**: it holds the CUSTOM tax-*profile* rate and carries real data on 72 of 74 live orders.

| # | Where + how | Expected | Result |
|---|---|---|---|
|27.1| **Regression — tenant WITH tax profiles.** Sidebar → Orders → New Order. Add items, open the Payment modal, note the tax line and Order Total, then submit. | Preview tax and total are unchanged from before this release; submit succeeds with no `AMOUNT_MISMATCH`. Charged total == the total the modal showed. | PASS — Payment modal shows normal tax breakdown (municipal + VAT); no ad-hoc tax-override controls; totals behave as before ||
|27.2| **Regression — tenant WITHOUT any tax profile configured** (the branch the removed params lived in). Same flow as 27.1. | Tax is either 0 or exactly the `TENANT_VAT_RATE` fallback; preview total == charged total. No "additional tax" appears anywhere. | N/A — demo tenant HAS tax profiles configured; empty-tax-profile tenant not available this run ||
|27.3| **CUSTOM tax profile still works** (this is what stayed). Configure/keep a CUSTOM-type tax profile (e.g. Municipality 2%) active, create an order, open the Payment modal. | The CUSTOM line still appears in the tax breakdown alongside VAT, and `org_orders_mst.tax_rate` is still written (`SELECT tax_rate, vat_rate FROM org_orders_mst WHERE id='<order>';` → CUSTOM rate in `tax_rate`, VAT in `vat_rate`). | PASS — CUSTOM/municipal fee still computes (seen on ORD-20260912-0004: municipal 0.036 + VAT 0.090) |
|27.4| **Governed amendment still works end-to-end** (no regression from the idempotency change). With `order_fin_governed_amendments` ON for a pilot tenant, edit a paid order's items → enter a reason when prompted → confirm. | Edit saves; the delta notice appears; exactly ONE row is added to `org_order_edit_history` for that edit. | N/A — concurrent same-key duplicate not exercised this run ||
|27.5| **Normal double-click is unaffected.** On the same Edit Order screen, click Save twice rapidly. | No `IDEMPOTENCY_IN_PROGRESS` error (each click mints its own key). Note: this does **not** prove double-submit protection — see the known residual below. | N/A — concurrent same-key duplicate not exercised this run ||
|27.6| *(Dev/API only — optional)* Fire two concurrent `PATCH /api/v1/orders/{id}/update` calls sharing one `idempotencyKey` and an identical body, against a governed order. | Exactly one succeeds; the other returns `errorCode: 'IDEMPOTENCY_IN_PROGRESS'`. Exactly one `org_order_edit_history` row is created. | N/A — concurrent same-key duplicate not exercised this run ||

> **Known residual, deliberately not fixed (recorded, not hidden):** `updateOrder`'s optimistic-lock check (`expectedUpdatedAt`) is a read-then-compare, not an atomic compare-and-set, so two requests that both read the order before either commits can both pass it. Sequential retries are correctly rejected. The fix belongs with the owner's in-flight workflow-engine `state_version` CAS rather than a second competing mechanism — see B28 doc → follow-up #5.

**Automated gates (2026-08-13/14):** tsc clean (3 pre-existing/unrelated errors, none touched) · eslint 0 (all changed files) · full jest **251/251 suites, 2395/2395 tests** · `npm run test:db-integration` **11/11 suites, 34/34 tests** · `npm run build` ✓ (exit 0, 271 static pages). New DB-integration coverage: real cancel-chain flow, real 8-way concurrent idempotency claim, real governed-amendment flow, real concurrent refund lock.

---

## 28. Maker-checker removal — permission-gated approvals (2026-08-14)

**What changed:** the "a different user must approve" rule (maker≠checker) was **removed everywhere**, per the owner rule in [`CLAUDE.md`](CLAUDE.md): *"No need for maker-checker in approve — even same user can approve if he has the required permission."*

**Permission is now the only gate.** Holding `orders:approve_refund` (refunds) or `cash_drawer:approve_variance` (drawer variance) is sufficient, regardless of who created the request or closed the session.

**What was removed:** the self-approval throw in `approveSessionVariance`; the dead `ENABLE_SELF_APPROVAL_CHECK` block in `approveRefund`; the disabled Approve button in the refunds list; the `REFUND_SELF_APPROVAL_BLOCKED` and `VARIANCE_SELF_APPROVAL_BLOCKED` error codes, their route/dialog mappings, and their EN/AR i18n strings.

**Still enforced (unchanged):** a mandatory reason on variance approval · single-shot approval (`VARIANCE_ALREADY_APPROVED`) · correct state checks · route-level `requirePermission`.

> ⚠️ **Two earlier scenarios now expect the opposite of what they used to** — §5.4 (refund) and §6.5 (drawer variance). Both are annotated in place. If a tester reports "I was able to approve my own request" as a bug, that is **correct behaviour**, not a defect.

| # | Where + how | Expected | Result |
|---|---|---|---|
|28.1| **Internal Finance And Operations → Refunds** — initiate a refund, then **Approve it yourself** (same login) | Approves successfully. No "self-approval" error, and the Approve button is **not** disabled | PASS — covered by §5.4: same admin initiated and approved REF-000004 |
|28.2| Continue: **Process** that same refund yourself | Processes normally — the whole initiate → approve → process chain is doable by one permitted user | PASS — REF-000004 processed 0.500 OMR (Wallet Credit); processed Sep 12, 2026 ~12:38 AM |
|28.3| Log in as a user **without** `orders:approve_refund` → open **Refunds** | No Approve action available; if forced via API, a permission error (not a self-approval error) | PASS — as operator: Refunds hub reachable (3 processed); no Approve controls |
|28.4| **Cash Drawers** — close a session with a variance over the drawer's threshold, then **as the same user who closed it**, click **Approve Variance** and enter a reason | Approves successfully (see §6.5) | N/A — closed SES-000008 with intentional variance −0.276 OMR (physical 13.000 vs expected 13.276); drawer had no variance_approval_threshold / no approval banner (matches default-off §6.3) |
|28.5| On that same session, click **Approve Variance** again | Rejected as **already approved** — single-shot approval is still enforced | N/A — no variance approval occurred (threshold unset) |
|28.6| Attempt a variance approval with an **empty** reason | Rejected — a reason is still mandatory | N/A — no variance approval UI available (threshold unset) |
|28.7| Log in as a user **without** `cash_drawer:approve_variance` → open the pending-variance session | No approve action available / permission error | N/A — no-approve_variance login not switched; threshold also unset so banner absent for everyone |
|28.8| Search the UI (EN + AR) for any leftover message telling a user they cannot approve their own request | **None should exist** — those strings were deleted from both locale files | PASS — Refunds EN UI: no leftover self-approval messages |

**Automated gates (2026-08-14):** tsc clean (3 pre-existing/unrelated) · eslint 0 · full jest **257/257 suites, 2410/2410 tests** · `check:i18n` ✓ (EN/AR aligned after removing 6 orphaned keys) · `npm run build` ✓ (exit 0, 271 pages). Two service tests were flipped from asserting *blocked* to asserting *allowed*; `cash-drawer.service.test.ts`'s error-code test was repointed at `ALREADY_APPROVED`, which is still enforced.

---

## 29. Collect Payment Enhancement — production hardening of the shared collect modal (2026-08-15)

**What changed:** the Collect Payment dialog was hardened end-to-end. **No migration.** Full write-up: [`../Collect_Payment_Enhancement/STATUS.md`](../Collect_Payment_Enhancement/STATUS.md).

**It is one shared dialog on three screens, with two different mount behaviours** — please run the scenarios on all three:

| Screen | How to get there |
|---|---|
| **Ready details** | **Orders → Ready** → open a PAY_ON_COLLECTION order with a balance → `/dashboard/ready/{id}` |
| **Delivery** | **Orders → Delivery** → `/dashboard/delivery` → a row with a balance |
| **Order Financial tab** | **Orders → All Orders** → open the order → **Financial** tab |

**Prerequisites:** an order with `payment_type_code = PAY_ON_COLLECTION` and a non-zero balance · a second login **without** `orders:collect_payment` · an open cash drawer session · one method configured `requires_reference = true` · ideally a 2-decimal-currency tenant (AED/SAR/QAR) for 29.4.

| # | Where + how | Expected | Result |
|---|---|---|---|
|29.1| Log in as a user **without** `orders:collect_payment` → open Ready details on an order with a balance → click **Collect Payment** | Button looks inactive and, on click, says you lack permission and names the code. **Previously it did nothing at all, silently** | N/A — operator collect_payment denial not re-run this sweep |
|29.2| Same user → the **Customer pickup** card's "Collect remaining payment" | Same explained refusal. The **Confirm handover** button on other orders is *not* affected (it is not a payment permission) | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.3| As a permitted user, select a **cash** method, then temporarily close/hide all open drawer sessions and try to collect | A readable message about opening a drawer session — **not** a raw key like `cashDrawer.errors.noOpenSession` | PASS — Collect Payment showed pending cash-drawer notice with Refresh/Open Session when no open session |
|29.4| On a **2-decimal** currency tenant, open the dialog and inspect **Amount** and **Cash Tendered**; also **Customers → Stored value → funding** change-due row | All show **2** decimals. Previously the change-due row and its inputs forced 3 | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.5| Focus the **Amount** field and scroll the mouse wheel over it | Value does **not** change (it used to, being a raw number input) | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.6| Enter a third decimal on a 2-decimal tenant | Not accepted | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.7| **Stale balance:** open Delivery, note a row's balance, collect part of it in a second browser/tab, then open the dialog from the **first** tab's stale row | Outstanding shows the **new** balance, and a warning states it changed and that the amount was updated | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.8| Repeat 29.7 but **type an amount first**, then let the balance change and reopen | Your typed amount is **kept**, and the warning tells you the balance moved. Money is never rewritten silently | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.9| Enter a **partial** amount (less than outstanding) | A **Remaining after this payment** line shows what the order will still owe | N/A — partial remaining line not explicitly verified this smoke |
|29.10| Cash method: tap a **quick-tender chip** (round-up / note values) | Only **Cash Tendered** changes — the **Amount** must not move. **Change due** appears in large type | PASS — cash tender preset populated (e.g. 2.000 vs amount 1.926) |
|29.11| Cash method: set tendered **below** the amount | Inline red message; **Collect** is disabled | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.12| Select **Check** | Check number / issuing bank / check date fields appear. With `requires_reference`, Collect stays disabled until the number is filled | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.13| Select a non-cash, non-check method with `requires_reference` | A single **Reference** field appears and gates Collect | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.14| Collect a CHECK with a reference, then open **Internal Finance And Operations → Business Vouchers** → the RECEIPT voucher, and the order's payment row | Check number/bank/date are stored. **Previously these could not be sent at all — non-cash collections had no reference** | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.15| Add a **Notes** value and collect; inspect the payment row's `rec_notes` | The note is stored (the column existed but was never written before) | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.16| Disconnect the network briefly, open the dialog so payment methods fail to load | An inline error with a **Retry** button appears; Retry recovers without closing the dialog. Previously: a vanishing toast and an empty dropdown | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.17| Configure a branch with **no** collection-eligible method → open the dialog | An explanation is shown instead of an empty dropdown, and Collect is disabled | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.18| Force a collection failure (e.g. stale balance) | The reason **stays on screen** (it does not vanish like a toast) and the balance re-reads | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.19| Fill a valid collection and press **Enter** (not the button) | Submits. Pressing Enter while anything is unresolved does nothing | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.20| While a collection is submitting, try to close the dialog (Esc / backdrop) | It refuses to close mid-request | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.21| Select a method whose status resolves to **PENDING** through configuration inheritance (e.g. bank transfer with no explicit override) | The "will be recorded as pending until verified" notice appears. **Previously only an explicit override showed it, so inherited-PENDING wrongly looked fully paid** | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.22| **Ready only:** collect from the **Customer pickup** card | Button reads **Collect & release order**, a hint explains why, and a **receipt preview opens automatically** after success | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.23| **Delivery / Financial tab:** collect | No print control appears, no handover wording — those are Ready-only capabilities | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.24| ⭐ **Most important.** On **Delivery**, collect on one row, close the dialog, then open a **different** row | Everything is fresh: amount, reference, check fields, notes. Nothing leaks between orders. *(This screen remounts the dialog instead of reopening it, so it exercises a different reset path from the other two.)* | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |
|29.25| Repeat the whole set in **Arabic (RTL)** | All new labels/messages translated; layout mirrors correctly | N/A — not exercised in this Preview pass (Collect Payment smoke covered 29.3/29.10 only) |

**Automated gates (2026-08-15):** tsc exit 0 · eslint 0 · `check:i18n` ✓ · **full jest 259/259 suites, 2423/2423 tests** · `npm run build` ✓ · `check:platform-info-inventories` drift 0 (access-contract suites 10/10).

> **Known gap, not a defect:** **split tender** (paying part cash + part card in one collection) is still not available in this dialog. The API has always accepted multiple legs; the UI change was deferred because it depends on adopting the shared payment-legs engine. Do not raise it as a bug.

---

## 30. B13 — Voucher reversal operational unwind (v1 ORDER_PAYMENT)

**What changed (2026-09-17):** reversing a posted voucher used to be paperwork only (`wiring_status: NOT_WIRED`). Behind **`order_fin_voucher_unwind`** (migration **0506 APPLIED**, catalog default **false**), Reverse also VOID/REVERSE linked **ORDER_PAYMENT** legs via B10 and writes a compensating drawer OUT for cash-family legs. Credit-application / stored-value unwind and consequence-preview UI are **not** in this slice — those lines stay NOT_WIRED even with the flag ON.

> Where: **Internal Finance And Operations → Business Vouchers** (`/dashboard/internal_fin/vouchers`) → open a **POSTED RECEIPT** with an `ORDER_PAYMENT` line → **Reverse**. Permission: `fin_vouchers:reverse` (same user may reverse). Cash reverse needs an **OPEN** session on the **original drawer** (original session if still open, else the current open session on that drawer).

> Enable the flag **on Preview only**. Leave it OFF in production until this section PASSes.

| # | Where + how | Expected | Result |
|---|---|---|---|
|30.1| Flag **OFF**. Open a posted cash RECEIPT voucher from a collect-payment (e.g. leftover from §10.1) → **Reverse** with a reason | Reverse succeeds. Reversal voucher exists. Original payment stays COMPLETED. Reversal lines `NOT_WIRED`. Order outstanding **unchanged**. Drawer expected-cash **unchanged**. This is the pre-B13 path. | pending Preview |
|30.2| HQ: enable `order_fin_voucher_unwind` for the Preview tenant only. Repeat Reverse on a **different** posted **CASH** RECEIPT while that drawer's session is **OPEN** | Reverse succeeds. Payment goes REVERSED (or VOID if it was still PENDING). Reversal `ORDER_PAYMENT` line `WIRED`. Order outstanding reopens. Drawer expected-cash **drops** by the cash amount (compensating OUT). | pending Preview (flag ON) |
|30.3| Flag ON. Reverse a posted **CARD** RECEIPT (no cash drawer needed) | Payment REVERSED/VOIDED, reversal line WIRED, outstanding reopens, **no** drawer movement | pending Preview |
|30.4| Flag ON. Reverse a posted **CASH** RECEIPT when **no OPEN session** exists on the original drawer | Whole reverse **aborts**. Original voucher stays POSTED. No B10 transition. Error maps to drawer-session-required (EN/AR). | pending Preview |
|30.5| Flag ON. Reverse a voucher that also has credit-application or stored-value lines | ORDER_PAYMENT legs unwind as in 30.2/30.3. Credit/SV lines stay **NOT_WIRED**. Do not file that as a v1 bug — remaining B13 slice. | pending Preview |
|30.6| Flag ON. Open **Reconciliation** for the reverse date | No `REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT` miss for 30.2; no orphan drawer movement | pending Preview |
|30.7| Toggle **Arabic** on the voucher Reverse error/success | Messages translated + RTL | pending Preview |

---

## Tester suggestions and recommendations

> Added by **Financial_Expert_Tester** during Preview QA (2026-09-12 → 2026-09-16, Asia/Muscat) on `https://cmx.cleanmatex.com/` · Demo Laundry LLC.  
> These are improvement ideas grounded in defects and friction observed while executing this guide — not a substitute for PASS/FAIL cells above.

### P0 retest status (2026-09-16 evening)

| Item | Retest |
|---|---|
| §3.1 voucher outstanding labels | **PASS** |
| §14.3 Sell Card amount | **PASS** |
| §2.3 Refund-and-rebill UI | **PASS** (minor consistency warning 2.21 vs 2.41) |
| §12.4 / 12.5 / 12.7 operator gates | **12.4/12.5/12.7 PASS** (12.7 owner-verified) |
| §2.5 Cancel on Processing | still open (not in this fix set) |
| Recon tax blockers | still open |

### P0 — Fix before calling Order Fin “release-ready”

1. **Partial-pay outstanding mismatch on receipt voucher (§3.1 FAIL)**  
   `ORD-20260912-0001` showed Financial outstanding **2.210 OMR** while the Receipt Voucher showed **0.000**. Operators and customers will trust the voucher. Align voucher outstanding/balance with the shared B02 outstanding formula (or clearly label voucher as “amount on this receipt only” and never imply order balance).

2. **Gift Card Sell posts amount `0.000` (§14.3 FAIL)**  
   Tender UI and Change Due worked, but submit failed `original_amount_check` because the backend received **0.000**. Treat as a contract bug between Sell Card form state and `org_sv_funding` / gift-card create payload. Add a client-side guard (“amount required”) and a server integration test that posts a non-zero amount through the tendered path.

3. **Operator can still Top Up / Issue Advance / Credit Note / Override price (§12.4, 12.5, 12.7 FAIL)**  
   B27 promised these were gated. As **Operator Demo 1**, the controls opened with Save/Apply and no denial. Re-verify permission seeds + UI gating + server-action checks for `stored_value:*` and `pricing:override`. Until fixed, limited roles are not actually limited for money movement.

4. **Refund-and-Rebill missing from UI (§2.3 / §12.8 BLOCKED)**  
   Admin has `orders:rebill_authorize` but the refund type picker only offered Standard / Price adjustment. Either expose the type in the Initiate Refund dialog or remove the permission from seeds until the UI ships — today’s state is a false capability.

5. **No Cancel / refund-disposition on Processing orders (§2.5 BLOCKED)**  
   Paid Processing order only offered Complete / Hold / Refund / Reverse. If cancel-with-refund is a supported disposition, surface it by status; if not allowed until Ready, document that in the cancel dialog and this guide so QA stops filing it as a blocker.

6. **Reconciliation tax noise (§8.1 / earlier RECON-2026-002)**  
   Runs alternately showed **24 TAX_CALCULATION blockers** or a clean day run. Stabilize tax-check fixtures on Preview demo data, or quarantine known legacy orders so new-money QA is not drowned in blockers. Also show **total checks = 38** explicitly on run detail (§8.2 was not visible).

### P1 — UX / product clarity (high leverage, lower risk)

7. **Collect Payment empty-drawer messaging (§29.3)**  
   The Refresh / Open Session notice is good. Make it the single pattern everywhere cash is required (gift-card sell, wallet top-up, refund cash process) — we also saw **expired cash-drawer transaction** on advance tender earlier; prefer one human-readable error, not raw/expired session language.

8. **Pending Payments discoverability**  
   Operator could open Refunds by URL but not via sidebar; Pending Payments was blank/blocked. For roles that can view, always show the nav item (disabled + tooltip beats a blank page). For roles that cannot, return a clear 403 page with the missing permission code (same pattern as collect-payment permission messaging in §29).

9. **Refund type labels vs guide vocabulary**  
   UI “Standard / Price adjustment (goodwill)” vs guide “OVERCHARGE / REFUND_AND_REBILL / commercial refund” confuses testers and support. Add secondary text or a glossary tooltip mapping UI labels → canonical refund context codes.

10. **Variance approval threshold settings field (§6.4)** — **CLOSED 2026-09-17 in code.** Field is on Config → Payment Setup cash-drawer create/update (empty = no gate). **Retest §6.4–6.7 / §28.4–28.6 after Preview deploy.** Do not file “no settings field” again.

11. **Timezone / business-date on Reconciliation**  
    Observed Sep 11 vs Sep 12 mismatch while testing. Show the branch business date and timezone on the recon run header; default “Today” to branch local date, not browser UTC.

12. **Stored Value first-customer “Invalid input”**  
    §1.2: existing no-wallet customer failed with generic Invalid input; new customer worked. Return field-level validation (which field, why) and don’t leave operators guessing.

### P2 — Future-proof SaaS / ERP / maintenance

13. **Feature-flag catalog vs DB (migration 0443)** — **CLOSED 2026-09-17.** 0443 APPLIED; `order_fin_refund_execution` default true; `tax_inclusive_pricing` registered (still default false). 0506 APPLIED for `order_fin_voucher_unwind` (default false).

14. **Idempotency without DevTools (§10.8 / §2.4)**  
    Several scenarios require replaying the same idempotency key. Ship a Preview-only “QA: replay last mutation” affordance or document a safe API recipe in the owner setup sheet so manual QA can verify idempotency without browser DevTools.

15. **Maker-checker removal communication**  
    Same-user approve for refunds works (§5.4 / §28.1–28.2) — correct per owner rule. Add an audit banner on Approve (“You are approving your own request”) for SOX-ish tenants who may later re-enable dual control via a tenant setting rather than hard-coding either extreme.

16. **Mobile / responsive spot-check gap**  
    This run was desktop Chrome only. Prioritise Collect Payment, Refunds approve/process, and Cash Drawer close on a narrow viewport next pass — cash tender chips and sticky New Order Preferences pill are likely overflow risks.

17. **Support playbook hooks**  
    When recon fails, deep-link from the blocker row to the offending order Financial tab. When gift-card sell fails `original_amount_check`, show a support code + correlation id in the toast for log search.

18. **Demo tenant hygiene**  
    “Orders past ready-by” warnings (13→25 during the run) clutter operator focus. Add a Preview “seed reset / age-out ready-by” job so financial QA is not mixed with ops backlog noise.

### Suggested next QA pass (after this Preview deploy)

| Priority | What to re-run |
|---|---|
| 1 | §6.4–6.7 / §28.4–28.6 (threshold UI) |
| 2 | §8.2 recon list + detail `total_checked` = 38 |
| 3 | §16 already signed; smoke if refund execution regresses |
| 4 | **§30 B13** after enabling `order_fin_voucher_unwind` on Preview only |
| 5 | Full §29 matrix + Arabic RTL on Collect Payment |
| 6 | Narrow-viewport smoke on money dialogs |

### §29 polish note

An extra Collect Payment matrix pass was started 2026-09-16 and **stopped** after the browser agent looped on navigation. Core §29 smoke (**29.3**, **29.10**) remains PASS; other §29 rows stay N/A pending a focused re-run after P0 fixes.

### §12.7 follow-up (2026-09-16 retest)

Owner marked **PASS** after self-test (Permission Denied / correctly gated). Agent earlier saw Apply Override enabled for Operator Demo 1 — treat owner verification as authoritative for sign-off.

### B09 follow-up (non-blocking)

After signing B09: Cash Drawers **overview** expected-cash showed **0.000** while session detail for SES-000013 correctly reflected post-refund expected cash (**9.016 OMR**) and the `CASH_OUT` movement. Treat as a list/aggregate display bug — refund execution itself PASS.

### Sign-off note from tester

Preview Order Fin is **not VERIFIED** end-to-end while P0 items 1–6 remain open. Core happy paths (pay, partial refund, wallet refund, same-user approve/process, drawer expected-cash, collect payment voucher wiring, order preference charges) look solid and should stay green while P0 is fixed.


## Sign-off
| Package | Preview deployed | QA result | Approved by / date |
|---|---|---|---|
| B15 | | | |
| B01 | | | |
| B02 | | | |
| B33 | Preview | PARTIAL — §4.1 no false pending-as-paid warning but snapshot CURRENT not confirmed / recon FAILED | — |
| B34 | | | |
| B16 | Preview — default close VERIFIED 2026-09-16; threshold UI shipped 2026-09-17 | **Retest §6.4–6.7 after this deploy** | — |
| B35 | | | |
| B20 | Preview — Reconciliation live | §8.1 tax noise still FAIL (demo data). **§8.2 totals UI shipped 2026-09-17 — retest after this deploy** | — |
| B29 | n/a (docs-only) | | |
| B4 | | | |
| B5 | Preview | N/A — §10.8/10.9 idempotency needs API/DevTools; UI double-submit not safely run | — |
| B31 | | | |
| B7 | Preview — Outbox Monitor live; processor NOT draining | BLOCKED — §11.2 FAIL (events stuck PENDING; no LOYALTY_EARN Processed). Do not sign until processor runs | — |
| B27 | migration 0411 APPLIED (owner), verified via remote DB; implemented, not yet deployed to Preview | | |
| B3 | migration 0412 applied; backend + tender-step UI implemented, not yet deployed to Preview | | |
| B30 | migration 0415 applied (owner, 2026-07-23); implemented, not yet deployed to Preview | | |
| B32 | Preview | BLOCKED — no UI path to configure PENDING cash / D9 override for deferred drawer test | — |
| B9 | Preview — refund execution UI live (flag ON inferred); migration 0418 previously applied | PASS — §16.2–16.7, 16.9–16.10 PASS; 16.1/16.8 N/A; 16.5 caveat on overview expected-cash display | Financial_Expert_Tester / 2026-09-17 (Asia/Muscat) |
| B10 | migration 0421 applied (owner, 2026-07-24), verified via remote DB; implemented, not yet deployed to Preview | | |
| B13 | migration **0506 APPLIED** (owner, 2026-09-17) local + remote; flag `order_fin_voucher_unwind` default **false**; v1 ORDER_PAYMENT unwind in code | pending Preview enable + §30 | — |
| B6 | migration 0424 applied (owner, 2026-07-24), verified via remote DB; implemented, not yet deployed to Preview | | |
| B8 | migration 0426 applied (owner, 2026-07-24), verified via remote DB; implemented, not yet deployed to Preview | | |
| B19 | Preview — Scheduled Jobs on Outbox Monitor live | PASS — §20.1–20.4 Run Now all SUCCESS | Financial_Expert_Tester / 2026-09-17 |
| B22 | Preview — Refunds hub live | PASS — refunds list smoke: 7 rows, Processed badges, order links | Financial_Expert_Tester / 2026-09-17 |
| B21 | Preview — Loyalty settings live | PASS (partial) — §21.1 rounding rule + prior 21.5/21.6; §21.2 N/A (no points balance on demo customers) | Financial_Expert_Tester / 2026-09-17 |
| B11 | no migration (schema/flag pre-existed from 0339); requires direct DB config (no settings UI) to opt a pilot tenant into TAX_INCLUSIVE before §22 is runnable on Preview | | |
| B17 | no migration (column + rules table pre-existed); requires a direct SQL UPDATE on one currency's `rounding_unit` (no settings UI) to see a non-zero adjustment before §23 is meaningfully runnable on Preview | | |
| B18 | no migration; live for every tenant immediately, no config needed; the earlier unrelated assembly-exceptions build blocker (owner's own WIP) is resolved, build green; top-bar pill UI redesign is the current (3rd) iteration — not yet deployed to Preview; 67 pre-existing orders intentionally NOT backfilled (owner-approved fix-forward-only, flagged as a separate future package) | | |
| B12 | migration 0438 APPLIED (owner, 2026-07-25), verified via remote DB; backend/API/gate + frontend reason-prompt/delta-notice UI fully implemented and tested; settlement automation deliberately NOT built (real `collectPaymentTx` PAY_ON_COLLECTION-only blocker, see Design decision #13 — operator settles manually via the order's Payments tab); flag `order_fin_governed_amendments` defaults OFF, zero effect on any tenant; §25 above covers both API-level (25.1–25.10) and UI-level (25.11–25.16) scenarios | | |
| B14 | migration 0440 APPLIED (owner), verified via remote DB; Prisma schema synced; backend trigger-wiring + lineage/FN-03 fix + 3 reconciliation checks + correction-document hooks (B34 refund, B12 amendment) implemented and tested; still dormant for every tenant (requires both `tax_registration_no` and an enabled `org_tax_doc_triggers_cfg` row, neither configured anywhere yet); frontend print/QR/issue-cancel-replace UI deliberately deferred, see Design decision #7; §26 above is DB/API-level only, now runnable once a pilot tenant is configured | | |
| B28 | no migration, no DB change (verified against remote DB — no `additional_tax*` column ever existed; do NOT drop `org_orders_mst.tax_rate`). Normally test-only, but this pass shipped 2 real behaviour changes: the ad-hoc tax-override params were removed (verified dead before removal — expected QA outcome is *no visible change*), and governed amendments now reject a concurrent same-key duplicate with `IDEMPOTENCY_IN_PROGRESS`. Live for every tenant immediately, no config needed. §27 above covers both, incl. the deliberately-unfixed residual (`updateOrder`'s non-atomic optimistic lock — belongs with the owner's in-flight `state_version` CAS) | | |
| Maker-checker removal | no migration, no DB change. Removes the "a different user must approve" rule from refunds AND drawer-variance approval; permission (`orders:approve_refund` / `cash_drawer:approve_variance`) is now the only gate. Live for every tenant immediately, no config. **§5.4 and §6.5 now expect the OPPOSITE of previous revisions** — a tester reporting "I could approve my own request" is reporting correct behaviour. §28 covers it end to end | | |

**Automated gates at build time (2026-07-20, all green where run):** tsc clean · eslint 0 (project-wide) · cash-drawer jest 39/39 · close-preview 3/3 · inventory/access 11/11 · reconciliation 66/66 (+2 new B3 checks) · settlement/collect-payment + wiring-handler suites 51/51 · outbox/outbox-processor/loyalty-earn suites 26/26 · B27 permission suites 16/16 · B3 suites 31/31 (fundStoredValue/finalizer 11, wiring handlers 7, reconciliation check 5, +8 from fixing 2 pre-existing suites' Prisma mocks that predated `org_sv_funding_tenders_dtl`) · full jest **220/220 suites, 2108/2108 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0, zero warnings). B3's Preview deployment is still pending (see B03 Completion evidence). This manual guide covers the end-to-end behaviour those unit gates can't.

**Automated gates at build time (2026-07-23, B30/B32):** tsc clean (2 pre-existing unrelated errors untouched) · eslint 0 (project-wide) · `payment-transition.service.test.ts` 19/19 · `cash-drawer-wiring.handler.test.ts` 7/7 · reconciliation check-modules +2 · planner/collect-payment investigation pinning tests +2 · full jest **222/222 suites, 2135/2135 tests — zero known failures** (one transient Windows Prisma query-engine file-lock flake on the first run, self-resolved on retry, not a code issue) · check:i18n ✓ · build ✓ (exit 0) · check:ui-access-contract --wire PASS · sync:ui-access-contract PASS (144/144 routes, drift 0) · check:platform-info-inventories PASS. **Migration 0415 APPLIED (owner, 2026-07-23) to local + remote, verified via remote DB** — B30/B32's permission codes, audit columns, and worklist nav entry are all live; §15 above is ready to run once deployed to Preview.

**Automated gates at build time (2026-07-23, B9):** tsc clean (same pre-existing unrelated errors) · eslint 0 · `order-refund-b9-execution.test.ts` 8/8 · `order-refund-cash-drawer-wiring.handler.test.ts` 9/9 · reconciliation check-modules +4 · all 31 pre-existing `refund-b01-matrix.test.ts` scenarios re-run and pass unchanged (zero regression to the flag-off path) · full jest **224/224 suites, 2156/2156 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0). Migration 0418 was subsequently **APPLIED (owner)** and committed together with B10's session — §16 above is now runnable once deployed to Preview.

**Automated gates at build time (2026-07-24, B10):** tsc clean (2 pre-existing unrelated errors untouched) · eslint 0 (project-wide) · `payment-transition.service.test.ts` +17 new (VOID/REVERSE legality, idempotency-payload, cash-session-required/not-open, compensating-movement lineage, orphan-movement trip-wire) · reconciliation check-modules +5 (`VOIDED_PAYMENT_NO_ORPHAN_MOVEMENT` ×2, `REVERSED_CASH_PAYMENT_HAS_COMPENSATING_MOVEMENT` ×3) · full jest **224/224 suites, 2173/2173 tests — zero known failures** · check:i18n ✓ · build ✓ (exit 0) · check:ui-access-contract --wire PASS (`/dashboard/internal_fin/pending-payments`, `/dashboard/orders/[id]`) · sync:ui-access-contract PASS (144/144 routes, drift 0). Migration **0421 is APPLIED (owner, 2026-07-24), verified via remote DB** — §17 above is runnable.

