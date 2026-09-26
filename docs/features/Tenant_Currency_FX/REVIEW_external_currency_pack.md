# Review — external "Tenant Currency Configuration Pack" (ChatGPT suggestion)

**Reviewed:** 2026-09-25 · **Against:** the live `cleanmatex` schema/code + `implementation_plan_01.md` (tenant) + the cash-drawer program (CLF, ADR-057)
**Outcome:** a lot of it is adopted and improves the plan. Several parts conflict with decisions already shipped in this repo and are rejected or re-shaped. §3 adds ideas that go beyond both documents. The accepted result is `implementation_plan_01.md` **v2**.

---

## 1. Verdict per pack section

| Pack item | Verdict | Why (verified against this repo) |
|---|---|---|
| Layering `sys → tenant → branch → drawer → session`, **lower layers may only restrict** | ✅ **Adopt** (principle) | Correct and safe. It is how `org_fin_cash_ctrl_stng_cf` already scopes cash policy (TENANT/BRANCH/DRAWER, `0515`) |
| "Powerful underneath, simple in the UI" + progressive disclosure | ✅ **Adopt** | Better than v1's always-visible 5-tab screen. Single-currency tenants see one card |
| `base currency == functional currency`, naming `is_base_currency` | ✅ **Adopt the name** | Mirrors `base_currency_code` in the `/database` standard and ADR-039 `base_cur_*` (CRITICAL RULE 12: names mirror the DB) |
| Full `UNIQUE (tenant_org_id, currency_code)` (not partial) | ✅ **Adopt** (corrects v1) | A composite FK can only target a full unique constraint. v1's `WHERE rec_status = 1` unique index would have made `(tenant_org_id, currency_code)` FKs impossible. Deactivate/reactivate the same row; never re-insert |
| Partial unique for one active base / one reporting | ✅ Adopt | Same as v1 |
| `is_default_display_currency` role | ❌ **Reject** | No consumer. The display currency in POS/receipts is the document's own currency, and the dashboard uses base. A third role is ambiguity without a use case (YAGNI). Can be added later without a rewrite |
| 12 `allow_*` context booleans **defaulting to TRUE** | ⚠️ **Adapt** | Defaults of TRUE mean enabling USD silently enables it for wallets, gift cards, AP, advances… A config screen must never grant more than the owner clicked. **Defaults FALSE**; the base currency is forced TRUE by CHECK. Set reduced to contexts that exist as modules here (§2.2) |
| `allow_refunds` | ❌ **Replace with an invariant** | A refund must go back in the **original tender's currency**. That is a rule, not a toggle. With a toggle, turning USD refunds off would strand every USD payment. (The pack's own test plan says "refunds in original currency", contradicting its own toggle) |
| `allow_accounting`, `allow_customer_credit` | ❌ Reject | Every posted document is accounting. Credit notes follow their invoice's currency. Both are derived, not configurable |
| `requires_fx` boolean | ❌ **Reject** | Fully derived (`currency_code <> base`). A stored copy can only drift |
| FX policy defaults (rate type, source, manual allowed, manual needs approval) | ✅ Adopt + merge | Merged with v1's `manual_rate_tolerance_pct`, `rate_max_age_days`, `tax_rate_source_code`. **No current-rate column** (agreed) |
| `effective_from/to` on `org_currency_cf` | ⏸️ Defer | Every resolver call would need date logic for a feature (scheduled deactivation) nobody has asked for. `is_active` + the usage guard cover it |
| `org_branch_currency_cf` (restrict-only) | ✅ **Adopt as a later phase (T-B)** | Valid need (a branch at the airport accepts USD, others don't). Composite FK to `org_currency_cf(tenant_org_id, currency_code)` enforces "can't enable what the tenant hasn't". Not needed for v1 |
| `org_cash_management_cf` | ❌ **Reject: duplicate** | `org_fin_cash_ctrl_stng_cf` (`0515`) already exists: per-scope cash policy with TENANT/BRANCH/DRAWER, count modes, blind close, variance thresholds, change-rounding policy. Building a second one would split the cash policy |
| `org_cash_drawer_currencies_cf` (multi-currency drawers) + `allow_multi_currency_drawer` + session currency snapshot | ❌ **Reject: contradicts shipped CLF** | Drawer plan §4B.13: *"`org_cash_sess_curr_dtl` and `allow_multi_currency_drawer` are **not** built."* P12: *"a cash line's currency must equal the drawer's currency."* Balances are already per currency in `org_cash_drawer_ses_bal_dtl`. Foreign cash = **a drawer in that currency** (§3.2), which gives per-currency custody and reconciliation for free |
| `org_currency_denominations_cf` | ❌ **Reject: duplicate** | The drawer program owns the tenant denomination override as `org_currency_denom_cf` (C1-1b), FK'd to `sys_currency_denominations_cd(id)` (`0522`) |
| `org_currency_rounding_rules_cf` (tenant rounding overrides) | ✅ **Adopt as a later phase (T-R)**, corrected | Must honor `sys_currency_rounding_rules_cf.is_tenant_overridable` (`TAX`/`ACCOUNTING` are never overridable, plan 02 decision 16). Catalogs are `sys_rounding_context_cd` / `sys_rounding_mode_cd` (the pack's names don't exist). Increment is `INTEGER` (plan 02 decision 12), not `BIGINT` |
| `created_by uuid` | ⚠️ Adapt | Recent tenant tables use `created_by TEXT` + `created_info` (`0515`, `0527`). Follow the repo |
| Permissions `currency.set_base` etc. (dotted) | ⚠️ **Adapt format** | CRITICAL RULE 13 requires `resource:action`. Granularity partly adopted: `currencies:view`, `currencies:manage`, **`currencies:set_base`** (elevated), `fx_rates:manual_override` |
| `CurrencyPolicyResolver` as the one decision point, with **reason metadata** | ✅ **Adopt** (strengthened in §3.4) | Exactly the right boundary. Reason *codes* feed the business-language errors (below) through i18n |
| Business-language errors ("This drawer does not accept USD") | ✅ Adopt | Via `cmxMessage` + reason-code i18n keys |
| REST `/api/org/v1/...` | ⚠️ Adapt | Follow web-admin's existing `app/api/v1` + server-action conventions and the UI-access-contract path (CRITICAL RULE 14) |
| Bootstrap: base = reporting = display on one row | ⚠️ Adapt | Reporting is **NULL = same as base**. A role is only set when it differs. This keeps the "one reporting currency" index meaningful |
| Deactivation usage checks (open docs, balances, sessions, AR/AP) | ✅ Adopt | Extends v1 C4 into a full `CurrencyUsageService` (tenant side) |
| Base-currency change: allowed before posted finance, a controlled process after | ✅ Adopt | Same as v1 C6. v1's **DB trigger** enforcement is stronger than the pack's service-only rule and is kept |
| Test plan (concurrency, two admins, snapshot immutability) | ✅ Adopt, merged | |
| Rollout "inventory every currency column first" | ✅ Already done | Plan 02 A2 (47 columns) + L0 drift report |
| Transaction standard (§12) | ✅ Already the repo standard | Identical to the `/database` skill. Adds nothing new, and nothing conflicts |

---

## 2. What changes in the tenant plan (v2)

### 2.1 Naming
`is_functional` → **`is_base_currency`**. `functional_locked_at` → **`base_locked_at`**.

### 2.2 Context flags (defaults FALSE; base row forced TRUE for every *ready* context)

| Flag | Covers | v1 ready? |
|---|---|---|
| `allow_sales` | orders, invoices, price display | ✅ (with `sales_pricing_mode`, §3.3) |
| `allow_payments` | non-cash tenders (card, bank, link) | ✅ |
| `allow_cash` | a cash drawer may be created in this currency (§3.2) | ✅ via CLF drawers |
| `allow_ar` | B2B invoices / statements | ✅ |
| `allow_wallet` | customer wallet balances | ⛔ not ready: foreign stored value needs revaluation |
| `allow_gift_card` | gift cards issued in the currency | ⛔ same |
| `allow_customer_advance` | advances/deposits | ⛔ same |
| `allow_purchasing` | AP invoices + POs (ERP-lite) | ⛔ ERP-lite not multi-currency yet |

"Not ready" flags exist in the table from day one (no later migration), but the service **rejects TRUE** for a foreign currency until the module declares itself ready (§3.1).

### 2.3 Layers owned elsewhere (explicit contract)
- **Cash policy:** `org_fin_cash_ctrl_stng_cf` (drawer program).
- **Denominations:** `org_currency_denom_cf` (drawer program C1-1b).
- **Session balances:** `org_cash_drawer_ses_bal_dtl` (CLF).

The currency plan owns *which currencies exist for the tenant and for what*. The drawer program owns *how cash in those currencies is held*.

---

## 3. Better ideas (beyond both documents)

### 3.1 Module-readiness registry: config can never promise what code can't do
A code constant `MULTI_CURRENCY_READY_CONTEXTS` (in `lib/constants/currency-contexts.ts`, DB-mirrored names), flipped per module as each one ships multi-currency support.
- `org-currency.service` rejects enabling a not-ready context for a foreign currency (`CURRENCY_CONTEXT_NOT_READY`).
- The UI shows those toggles disabled with a "coming with <module>" hint.

Without this, a tenant can enable USD wallets months before the wallet code can handle them. That is the most common way multi-currency configuration corrupts data in SaaS ERPs.

### 3.2 Foreign cash = a drawer in that currency, not a multi-currency drawer
`org_cash_drawers_mst.currency_code` gets a **composite FK** `(tenant_org_id, currency_code) → org_currency_cf(tenant_org_id, currency_code)` (`NOT VALID` → `VALIDATE` after L1 backfills every currency already used by a drawer). The drawer service additionally requires `allow_cash = true` on that row.
- **Result:** "accept USD cash at the airport branch" = enable USD with `allow_cash`, create a USD drawer in that branch. This needs **zero** new drawer tables, per-currency custody and reconciliation come from CLF as-is, and it respects P12 exactly.
- It also retires v1's "`allow_cash` inert until A4-3", since A4-3 is superseded anyway.

### 3.3 `sales_pricing_mode`: where do USD prices come from?
Neither document answers this, and it's the first question a tenant enabling USD sales will hit.
- **`CONVERT_FROM_BASE`** (v1 default): the price is the base price converted at the resolved rate. It is rounded with the currency's `FX_CONVERSION` rule, and **the rate and the rounding are shown inline on the order** (CRITICAL RULE 15, no silent money mutation). The rate is frozen on the order.
- **`PRICE_LIST`** (reserved): explicit per-currency prices. Rejected by the service until price lists support currencies.

### 3.4 Policy decisions return a reason code, and the reason codes are the i18n keys
`currencyPolicy.check({tenant, branch?, drawer?, context, currency}) → { allowed, reasonCode, requiresFx }` with reason codes such as:
- `CURRENCY_NOT_ENABLED`
- `CONTEXT_NOT_ALLOWED`
- `CONTEXT_NOT_READY`
- `BRANCH_RESTRICTED`
- `NO_DRAWER_IN_CURRENCY`
- `FX_RATE_MISSING`
- `FX_RATE_STALE`

Each one maps 1:1 to `currencyPolicy.reasons.<CODE>` in EN/AR. The UI never invents wording, and support can search logs by code.

### 3.5 Currency health panel
Per enabled currency, the Currencies tab shows a readiness line:
- the rate is fresh (within `rate_max_age_days`)
- if `allow_cash`, at least one active drawer exists
- if cash, denominations are available
- the tax rate source is set, if the tenant issues tax documents

Misconfiguration surfaces at setup time, not at the counter.

### 3.6 Composite FK on transaction currency columns (stage 5G)
When the transaction tables get their FX snapshot columns, also add `(tenant_org_id, currency_code) → org_currency_cf` (`NOT VALID` → `VALIDATE`). Deactivating a currency never breaks history, because the row persists (the full unique from §1 is what makes this possible). A transaction can never be written in a currency the tenant never enabled.

### 3.7 Refund-in-original-currency as a DB-checkable rule
The refund voucher line carries `currency_code` = the original tender line's `currency_code` (validated in service + tests). Cross-currency refunds are an explicit future feature, never a side effect.
