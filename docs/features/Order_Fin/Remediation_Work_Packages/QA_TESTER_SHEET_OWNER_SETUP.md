# Owner setup — do this BEFORE handing the sheet to the tester

**Not for the tester.** This is the short list of technical preparation that unblocks the tester's sheet. Every item here is something a non-technical person cannot do — doing them first is what makes their pass count toward `VERIFIED`.

Reference: [`QA_TEST_GUIDE.md`](QA_TEST_GUIDE.md) · tester file: [`QA_TESTER_SHEET.md`](QA_TESTER_SHEET.md)

---

## A. Deploy & migrations

- [ ] Preview deployment is live and the tester can reach it
- [ ] **Apply migration `0443_seed_missing_order_fin_feature_flags.sql`** — without it the two flags below cannot be switched on at all, and Parts 12 & 13 of the tester sheet are unrunnable
- [ ] Confirm all earlier migrations are applied (0410–0442)

## B. Feature flags (HQ console)

Set these **for the test tenant** before handing over:

| Flag | Set to | Unblocks |
|---|---|---|
| `order_fin_refund_ui` | **ON** *(already default `true`)* | Part 6 — refunds |
| `order_fin_sv_funding_capture` | **ON** *(already default `true`)* | Part 8 — wallet/gift-card tender step |
| `order_fin_governed_amendments` | **ON** *(already overridden ON for 2 tenants)* | Part 5 — editing paid orders |
| `order_fin_refund_execution` | **ON** | Part 12 — real refund execution *(needs 0443 first)* |
| `tax_inclusive_pricing` | **ON** for one pilot tenant | Part 13 — tax-inclusive *(needs 0443 first)* |
| `erp_lite_enabled` | ON **only if** you want Part 14 tested | Part 14 — accounting entries |

## C. Tenant / config prerequisites

- [ ] Test tenant has **TENANT_CURRENCY** set (e.g. OMR) — otherwise money screens fail loudly by design
- [ ] Test tenant has a **tax profile** configured (Config → Tax Setup) — for the tax tests
- [ ] Optionally a **second tenant with no tax profile**, to confirm zero-rating
- [ ] At least one **cash drawer** exists with `variance_approval_threshold` set (e.g. `1.000`) — Part 7 needs it
- [ ] At least one payment method configured with `default_creation_status = PENDING` (e.g. CHECK or BANK_TRANSFER) — Parts 9 & 10 need a pending leg to exist
- [ ] For tax-inclusive: set `org_tenants_mst.tax_pricing_mode = 'TAX_INCLUSIVE'` for the pilot tenant (direct SQL — no settings UI yet)
- [ ] For rounding: set one currency's `rounding_unit` to a **non-native** value (direct SQL) — otherwise the rounding adjustment is always 0 and Part 13 shows nothing
- [ ] `FINANCE_OUTBOX_SECRET` set in env — otherwise the Outbox Monitor (Part 11) does not work

## D. Logins to give the tester

| Login | Needs | Used for |
|---|---|---|
| **Main** | full finance permissions (refunds initiate/approve/process, `cash_drawer:approve_variance`, `orders:pending_payments_view`, `orders:cancel_payment`, `orders:fail_payment`, `finance_outbox:view` + `retry`) | almost everything |
| **Limited** | a login with **none** of the new B27/B30 permission codes | the permission-denial tests (Parts 6, 7, 9, 11) |
| **View-only** *(optional)* | `finance_outbox:view` but NOT `finance_outbox:retry` | Part 11 retry-button gating |

> Fill these into the tester sheet's login table before sending it.

---

## E. What the tester CANNOT do — you must run these yourself

These stay with you regardless. They are the residual after the tester's pass.

| Guide § | What | Why not delegable |
|---|---|---|
| §0.2 | Pre-deploy currency data checks | raw SQL |
| §8.3 | Injected tax/discount drift | requires manipulating rows |
| §10.9 | collect-payment without `idempotencyKey` | direct API call |
| §14.9 | `org_sv_funding_tenders_dtl` row check | raw SQL |
| §24.13 | Charge/preference reconciliation for a new order | run + interpret reconciliation output |
| §25.1–25.10 | Governed amendment API contract | direct API calls with auth |
| §26.1–26.10 | Tax document runtime | SQL config + row inspection |
| §27.1–27.3 | Tax-override removal regression | needs a no-tax-profile tenant + comparison |
| §28.8 | Locale sweep for removed strings | code/locale inspection |
| §4.2 | Injected corruption test | requires tooling |

**After the tester returns their sheet:** transcribe using the mapping in [`QA_TEST_GUIDE.md` §0.1b](QA_TEST_GUIDE.md), then work through the table above. A package is `VERIFIED` only when **both** halves are done and you record approval.
