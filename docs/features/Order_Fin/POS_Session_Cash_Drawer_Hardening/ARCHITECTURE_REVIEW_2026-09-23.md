# Review — `CleanMateX_Currency_Denomination_Cash_Drawer_Architecture.md`

**Source:** `F:\JhApps_doc\CleanMateX_Jh\Dev\Currency_And_Money_Jh\` (1069 lines, external)
**Reviewed:** 2026-09-23
**Against:** this program's `IMPLEMENTATION_PLAN.md` + repo rules in `CLAUDE.md`
**Verdict:** **strong document — adopt most of it.** 12 ideas adopted, 3 rejected, 9 corrections required, 4 gaps it did not cover.

---

## 1. Overall assessment

This is a materially better piece of work than the earlier rounding-table proposal. Its layering principle is right and worth quoting into our own docs:

> Reference catalogs describe what exists; tenant configuration says what is allowed; runtime tables record what actually happened; finance vouchers record the financial consequence.

Three of its positions independently **confirm decisions we already took**, which is a good signal:

- Money stays `NUMERIC(19,4)`; no platform-wide migration to minor-unit money (matches our A3).
- Rounding is policy, not an intrinsic currency property; keep it out of `sys_currency_cd` (matches **D8**).
- Denomination values and rounding increments are integer minor units (matches **D13**, modulo width — §4.2).

Its single best contribution is **§6.3, the OMR cash-change policy**, which is a genuinely better idea than what we had. See §2.1.

Its main weakness is mechanical: **several proposed table names break the repo's 30-character limit**, and the DDL repeats the same audit-convention violations as the earlier proposal.

---

## 2. Adopted — ideas better than what we had

### 2.1 Asymmetric cash rounding: `CASH` vs `CASH_CHANGE` (§6.3) — **best idea in the document**

We had `CASH_TENDER` and `CASH_CHANGE` as separate contexts but never specified that they should round **in different directions**.

The document's OMR policy:

| Field | Value |
|---|---|
| `rounding_context` | `CASH_CHANGE` |
| `rounding_mode` | `CEILING` |
| `rounding_increment_minor` | `10` |

> Order payable 10.003 · tendered 20.000 · raw change 9.997 · **change returned 10.000** · business absorbs 0.003

Rounding *change* upward means the **business absorbs the remainder, never the customer**. That is the correct commercial and reputational default in a laundry counter context, and it is a deliberate asymmetry — tender rounding and change rounding are not the same policy and must not share one rule.

It also states the accounting rule correctly and in line with our `no-silent-money-mutation` rule: the commercial total stays 10.003; the 0.003 is an explicit settlement adjustment, never written back into the order price.

**Action:** plan A6-4 is amended — cash rounding resolves `CASH_TENDER` and `CASH_CHANGE` independently, and the HQ handoff seeds both. **Open question for the owner:** the document proposes increment `10` (nearest 10 baisa) for change while our tender suggestion was `5`. Both are defensible; they are business-policy calls, not technical ones.

### 2.2 Counts as snapshots, separate from movements (§16) — **structural improvement**

We modelled only `org_cash_count_sheets_dtl` (denomination lines attached to a session). The document separates:

- `org_cash_drawer_counts_mst` — count header: `count_type` (`OPENING` / `SPOT` / `CLOSING` / `RECOUNT`), `count_method` (`TOTAL_ONLY` / `DENOMINATION`), counted/expected/variance, counted_by, approved_by
- denomination detail lines beneath it

This is better for three reasons we did not account for:

1. **Spot checks and supervisor recounts** — we had neither. A mid-shift spot count is a standard loss-prevention tool and our model had nowhere to put one.
2. **`expected_amount` snapshotted at count time** — makes a count self-contained and reproducible, instead of recomputing later and getting a different answer (the same defect class as our D2 Z-report finding).
3. **`denomination_value_minor_snapshot`** on each line — freezes the denomination's value in case the catalog changes. We missed this entirely, and without it a historical count silently re-values when HQ edits a denomination.

**Action:** C1-2 restructured into a header + detail pair.

### 2.3 Per-currency session balances (§13) — **and it contradicts our A4-3**

`org_cash_drawer_session_currencies_dtl`: one row per currency active in a session, each with its own opening / expected / counted / variance, and the rule that **currencies are never cross-netted**.

Our A4-3 proposed a `CHECK` forcing a cash payment's currency to equal the drawer session's currency — i.e. one drawer, one currency, enforced in the schema. **That constraint would block this model permanently.**

The document's position is better and matches its own §1 principle: *multi-currency capable from day one, exposed only when a tenant opts in*.

**Resolution adopted — take the shape, defer the feature:**

- Model session balances per currency **now** (one row for single-currency tenants — no added complexity for them).
- Keep `allow_multi_currency_drawer = false` as the default, so nothing is exposed in the UI.
- **Drop the A4-3 single-currency `CHECK`.** Replace it with the invariant *every movement carries exactly one currency, and reconciliation is per currency* — which closes the original bug (silently dropping currencies in `getPosSessionSummary`) without welding the schema shut.

Enabling multi-currency later becomes a config flip, not a migration.

### 2.4 Session status `CLOSING` (§12) — **closes a real hole in our plan**

We had `OPEN` / `CLOSED` / `FORCE_CLOSED` (+ our new `CLOSED_PENDING_APPROVAL`). The document adds `CLOSING` as an intermediate state while counting is in progress.

This matters more than it looks. Our Wave A fixes the *race* where a payment lands between the close aggregate and the update — but locking only narrows the window. **`CLOSING` closes it at the domain level**: once counting starts, new cash movements are refused outright rather than merely serialized. That is the correct fix; the lock is the backstop.

**Action:** added to the C3 status work alongside `CLOSED_PENDING_APPROVAL`, and folded into the C3-8 allow-list sweep.

### 2.5 Three-level variance thresholds (§18) — richer than our single threshold

| Threshold | Effect |
|---|---|
| `variance_tolerance_amount` | below this, auto-accept |
| `variance_reason_required_amount` | at/above, require a reason |
| `variance_approval_required_amount` | at/above, require supervisor approval |

We had one threshold plus a three-mode gate (`OFF` / `WARN_ONLY` / `APPROVAL_REQUIRED`). The two models compose well: the mode says *whether* gating applies at all, the three amounts say *what* each band requires. A reason-but-no-approval band is genuinely useful and we did not have it.

**Action:** extend `org_fin_cash_ctrl_stng_cf` with the two extra threshold columns.

### 2.6 Denomination series and legal-tender metadata (§5, §5.1)

`series_code` / `issue_date` / `withdrawal_date` / `legal_tender_from` / `legal_tender_to`, and critically **`is_legal_tender` separate from `is_in_circulation`**.

We had only `is_circulating`. The distinction is real: a withdrawn note is often still legal tender for exchange at the central bank, so it must be countable without being offered as change.

Also right: **FK the count line to `denomination_id`, not to the value** — two 50-rial notes of different series share a value but are different rows. Our handoff used `(currency_code, denomination_minor)` as the PK, which cannot represent series.

**Action:** HQ handoff §4 updated — surrogate `id` PK, `denomination_code` business key, count lines FK to `denomination_id` and snapshot the value.

### 2.7 `default_accept_cash` vs `default_give_as_change` (§5, §8)

Two different policies we had collapsed into one flag. A branch will accept a 50-rial note but should never hand one out as change.

**Action:** both flags at HQ level, both overridable at tenant level.

### 2.8 Movement types `ROUNDING_ADJUSTMENT` and `CORRECTION` (§14.1)

Neither was in our `0522` catalog. `CORRECTION` with mandatory reason and elevated permission is a genuine operational need — without it, a mistake can only be fixed by a fake cash-in.

**Action:** added to the D1-1 movement-type seed.

### 2.9 `POST /cash/change/preview` (§28)

Preview tender, change and rounding before commit. With asymmetric change rounding (§2.1) the cashier *must* be able to see what will actually be handed back before committing.

**Action:** added to the §9.2 endpoint inventory.

### 2.10 Smaller adoptions

- **`cash_tracking_mode`** (`TOTAL_ONLY` / `COUNT_BY_DENOMINATION` / `FULL_DENOMINATION_TRACKING`) with `COUNT_BY_DENOMINATION` default — cleaner than our `count_sheet_mode`, and its framing is exactly right: *denomination entry is for counts, never for normal checkout*. That UX rule (§1, §15, §29) should be quoted verbatim into our frontend tasks.
- **`require_active_drawer_for_*`** flags separated for payment / refund / back-office — finer than our single `POS_SESSION_REQUIRED_FOR_CASH`.
- **`SAFE_REPLENISHMENT`** as the named inverse of `SAFE_DROP`.
- **Movement sign convention** (§14.2): amounts always positive with `direction IN/OUT`; signed values reserved for derived differences like variance. We had this implicitly; worth stating.

---

## 3. Rejected

### 3.1 `BIGINT` for denomination values, increments and quantities

The document specifies `BIGINT` in §3, §5, §6.2, §16.1 and §32. **This contradicts owner decision D13** (`INTEGER`).

D13 is correct: the largest realistic value is a ~1,000,000-unit banknote against an `INTEGER` ceiling of 2.1 billion. `quantity bigint` is even less defensible — a physical count of notes in one drawer.

**Verdict:** `INTEGER` throughout, per D13.

### 3.2 `priority integer not null default 100` on rounding rules (§6.2)

This adds a second resolution axis alongside `effective_from`/`effective_to`. Two overlapping rules can then both "win" depending on which axis you read first — that is ambiguity dressed as flexibility.

**Verdict:** drop `priority`. Determinism comes from the exclusion constraint on overlapping date ranges plus "greatest `effective_from` ≤ business date" — one axis, one answer.

### 3.3 `org_cash_management_cf` as a *new* table

Its settings list is good, but we already have `org_fin_cash_ctrl_stng_cf` (D3/D4) covering the same surface with an agreed shape, resolver service and admin screen.

**Verdict:** do not create a second tenant cash-policy table. **Merge** the document's richer settings into the existing columnar table. Two tables answering "what is this tenant's cash policy" is how drift starts.

---

## 4. Corrections required

### 4.1 Table names over the 30-character limit

| Proposed | Chars | Corrected |
|---|---|---|
| `org_cash_drawer_count_denominations_dtl` | 39 | `org_cash_count_denom_dtl` (24) |
| `org_cash_drawer_session_currencies_dtl` | 38 | `org_cash_sess_curr_dtl` (22) |
| `sys_currency_rounding_context_cd` | 32 | `sys_rounding_context_cd` (23) |
| `org_cash_drawer_counts_mst` | 26 | ok |
| `org_currency_denominations_cf` | 29 | ok |
| `org_cash_management_cf` | 22 | ok, but rejected per §3.3 |

`sys_currency_rounding_mode_cd` (29) fits, but `sys_rounding_mode_cd` (20) is better — rounding modes are not currency-specific, only the *rules* are.

### 4.2 Repo convention violations in the DDL

Same set as the earlier proposal:

| Proposed | Corrected | Rule |
|---|---|---|
| `created_by uuid` / `updated_by uuid` | `TEXT` | repo audit convention |
| missing `created_info` / `updated_info` / `rec_order` / `rec_notes` | full audit block | CLAUDE.md |
| `calculation_decimal_places smallint not null` | `INTEGER`, **nullable** | D13 — fallback to `minor_unit` |
| `output_decimal_places smallint not null` | `INTEGER`, **nullable** | D13 |

To its credit it uses `TIMESTAMPTZ` and `TEXT` currency codes correctly throughout — better than the earlier proposal.

### 4.3 Missing RLS statement

The document never mentions row-level security on the `org_*` tables it proposes. In this repo that is not optional (CRITICAL RULE #4 + `/multitenancy`): every `org_*` table needs `ENABLE ROW LEVEL SECURITY` and a `tenant_org_id = current_tenant_id()` policy, plus composite FKs on `(id, tenant_org_id)`.

---

## 5. Gaps — things our plan covers that the document does not

Worth noting so nobody treats it as a complete replacement:

1. **POS session vs drawer session separation.** The document folds cashier accountability into the drawer session (`opened_by`, `pos_terminal_id`). Our ADR-054 keeps a **user-owned POS session** distinct from the **drawer-owned cash session**, which is what allows several cashiers on one counter drawer with per-cashier attribution (E2). The document's model cannot express that.
2. **Business-date rollover and stale sessions** (our B2) — absent entirely. A forgotten session absorbing tomorrow's takings into yesterday's business date is unaddressed.
3. **Immutable Z-report artifact** (our D2). §16 snapshots counts, which is adjacent, but there is no shift-report document.
4. **Branch scoping of drawer operations** (our B3-2) — §25 covers permissions but not the cross-branch exposure.

---

## 6. Net scope impact

| Change | Effect |
|---|---|
| Counts header + detail (§2.2) | C1 grows by one table; replaces flat count-sheet design |
| Per-currency session balances (§2.3) | one new table; **removes** the A4-3 constraint |
| `CLOSING` status (§2.4) | small — one status + guard, folds into C3 |
| Extra threshold columns (§2.5) | two columns on an existing table |
| Denomination series (§2.6) | HQ-side; no tenant migration |
| New movement types, preview endpoint (§2.8–2.9) | small |

Roughly **+2 tables, −1 constraint**, and a better model. Concentrated in Wave C and D1, which have not started.

---

## 7. Recommendation

Adopt §2.1–2.10, apply the §4 corrections, reject §3.1–3.3.

**Three items need owner sign-off before I amend the plan**, because they change scope rather than detail:

| # | Decision needed |
|---|---|
| Q7 | Per-currency session balances now (drop the A4-3 single-currency constraint), or keep one-drawer-one-currency and defer? |
| Q8 | Counts as header + detail with spot/recount support, or keep the flat count sheet? |
| Q9 | OMR `CASH_CHANGE` increment — `10` baisa as the document proposes, or `5` to match tender? And confirm `CEILING` so the business absorbs the remainder. |
