# START HERE — POS Session & Cash Drawer Hardening

**Entry point for a cold session.** Read this first, then `STATUS.md` (the top rows), then `REMAINING_WORK.md`. `RESUME_CONTINUATION.md` is the session-to-session log; `IMPLEMENTATION_PLAN.md` is the original plan and is now history.

---

## 1. State as of 2026-10-09 — **STATUS.md is authoritative; this section is a summary only**

- **The program is COMPLETE (2026-10-03, STATUS D67).** CLF ledger, Wave 0 and Waves A–E are built, gated and documented. Migrations `0515`–`0562` are applied (local + remote). The plan has no open boxes.
- **Post-program polish, all delivered:**
  - **D68 (2026-10-08) — HQ catalog screens.** The eight cash-drawer / POS-session `sys_*` code tables are managed in the HQ repo (`cleanmatexsaas`): `/system-codes/cash-pos`. HQ edits names, descriptions and order only; codes, `is_active` and behaviour flags stay a tenant-repo migration plus a constant.
  - **D69 (2026-10-08) — web-admin audit.** Screens show bilingual catalog names instead of raw codes (HQ edits appear within about 10 minutes); the missing **Z-report archive** screen was added (`/dashboard/internal_fin/pos-sessions/z-reports`); the shift-report print page got its page gate; migration **`0578`** (applied 2026-10-09) replaced the over-granted `pos_session:*` defaults of old migration 0396 with a least-privilege role matrix.
  - **D70 (2026-10-09) — POS Settings page.** The POS-session settings (session requirement per screen, rollover mode, stale hours, Z-report required) moved off Cash Control Settings to `/dashboard/settings/pos-settings` (tabs *Session requirement* and *Shift lifecycle*). Cash Control Settings keeps drawer and cash policy. Migration **`0587`** (applied 2026-10-09) added the menu entry.
- **Only owner-side items remain** — see `REMAINING_WORK.md`: commit, restart the dev servers, run `QA_TEST_GUIDE.md` §13–§19, force-close the two historical `CLOSING` sessions (drawers ac312993 / 65546cc7).

## 2. Files in this folder

| File | What it is |
|---|---|
| `START_HERE.md` | this file |
| `STATUS.md` | decisions D1–D70, wave status, audit history — **the progress record; if it disagrees with anything else, it wins** |
| `REMAINING_WORK.md` | what is still open (owner-only items and optional follow-ups) |
| `RESUME_CONTINUATION.md` | session-to-session log; the top entries are current, the rest is history |
| `OPERATOR_GUIDE.md` | how branch managers, supervisors, cashiers and finance staff run the day |
| `QA_TEST_GUIDE.md` | owner-runnable scenarios, §1–§19 |
| `IMPLEMENTATION_REQUIREMENTS.md` | as-built lookup: migrations, permissions, routes, APIs, settings, jobs, error codes |
| `CLF_FEATURE_REFERENCE.md` | the cash ledger (ADR-057) as built |
| `IMPLEMENTATION_PLAN.md` | the original plan (history; its checkboxes are all ticked or superseded) |
| `ARCHITECTURE_REVIEW_2026-09-23.md` | evaluation of the external architecture doc — what was adopted, rejected, corrected |

ADRs: [054](../ADR/ADR-054-User-Owned-POS-Sessions.md) · [056](../ADR/ADR-056-Cash-Control-Settings-Finance-Owned-Table.md) · [057](../ADR/ADR-057-Two-Domain-Cash-Ledger.md) · [058](../ADR/ADR-058-In-Transit-Cash-Transfers.md) · [059](../ADR/ADR-059-Immutable-Shift-Z-Report.md).

Related, in the **HQ repo** (`cleanmatexsaas`): `docs/features/Cash_Pos_Catalogs/progress_status.md` (the HQ screens for the eight system-code tables) and `docs/features/Currency_Setup/HQ_CURRENCY_HANDOFF.md`.

## 3. Read order before changing anything

1. `STATUS.md` — the top rows (D70 → D65) and any decision that touches your area.
2. `REMAINING_WORK.md` — what is genuinely open.
3. `IMPLEMENTATION_REQUIREMENTS.md` — what exists (routes, APIs, settings, permissions).
4. `IMPLEMENTATION_PLAN.md` **§10** — the standing rules, if you are about to build something.

## 4. Before the first line of code — mandatory

Load the skills for the domain. This is CLAUDE.md's hard stop, and it has been skipped before:

| Writing | Load |
|---|---|
| any SQL or migration | `/database` |
| any `org_*` query | `/multitenancy` |
| any route or service | `/backend` |
| any component or JSX | `/frontend` |
| any translation key | `/i18n` |
| a new feature end to end | `/implementation` |
| a menu entry | `/navigation` (dual-write: `config/navigation.ts` + a `sys_components_cd` migration) |

## 5. Where things live (quick map)

| Area | Where |
|---|---|
| Tenant policy (one row per tenant, `org_fin_cash_ctrl_stng_cf`) | API `GET/PUT /api/v1/settings/payments/cash-control`; resolver `lib/services/cash-control-settings.service.ts` |
| POS-session settings page | `/dashboard/settings/pos-settings` — `src/features/pos-settings/` |
| Drawer / cash policy page | `/dashboard/settings/payments/cash-control-settings` — `src/features/cash-drawers/ui/cash-control-settings-screen.tsx` |
| POS sessions, shift reports, Z archive | `/dashboard/internal_fin/pos-sessions` — `src/features/pos-sessions/` |
| Cash drawers, ledger, variance, in-transit | `/dashboard/internal_fin/cash-drawers` — `src/features/cash-drawers/` |
| Bilingual names of statuses, events, drawer types | `sys_*` catalogs → `GET /api/v1/pos-sessions/catalogs`, `GET /api/v1/cash-drawers/catalogs`; edited in HQ |

## 6. The rules that get broken most often

- **Never apply a migration.** Write the `.sql`, stop, wait for confirmation. Every `STOP-AND-WAIT` marker in the plan is real.
- **Load the skill first.** Not after.
- **`withTenantContext(tenantId, () => prisma.$transaction(...))`** — never the reverse, or RLS context is lost inside the transaction and every `org_*` read silently returns zero rows.
- **Every `org_*` query filters `tenant_org_id` itself**, including raw SQL and joins.
- **Money is `DECIMAL(19,4)`** in the DB and `Prisma.Decimal` in code — never a JS `number`, never `::float8`.
- **Minor-unit columns are `INTEGER`** (D13), not `BIGINT`.
- **`TEXT` not `VARCHAR`; `TIMESTAMPTZ` not naive timestamps; audit actors are `TEXT`** with `_info` columns.
- **Cmx components only**, `cmxMessage` for all feedback, EN **and** AR for every key (cash drawer = **درج النقد**, plural **أدراج النقد**).
- **Constants mirror DB values exactly** (CLAUDE.md rule 12) — which is why HQ cannot rename a code or flip a flag.
- **No maker ≠ checker**: permission is the only approval gate.
- **Update `STATUS.md`** at every package close (§10.9).

## 7. What NOT to redo

These are settled. Reopening them wastes a session:

- Settings live in `org_fin_cash_ctrl_stng_cf` with one column per setting and a single resolver service (D3, D4). Two pages edit it — POS Settings (POS-session fields) and Cash Control Settings (everything else) — each sending only the fields it changed (D70). Do not merge them back.
- Rounding policy lives in `sys_currency_rounding_rules_cf`, HQ-owned (D8, D12).
- Denomination catalog is HQ-owned; tenants may switch notes and coins off and reorder, never edit values (D9, C1-1b).
- Per-currency session balances, **not** a single-currency `CHECK` (D14) — `org_cash_drawer_ses_bal_dtl`.
- Counts are header + detail snapshots, immutable (D15).
- Two-domain cash ledger: finance = vouchers, custody = drawer transactions, one central gate, no mirrors (D29–D31, ADR-057).
- Per-screen POS-session policy, not global booleans; cash custody is separate from shift attribution (D62).
- Rollover never force-closes a session whose drawer holds cash (it pauses); a transit leg is undone by cancel, never by reversal; the Z-report is frozen in the closing transaction and immutable.
- Cash-change rounding is a tenant setting; tender rounding is not (D16).
- HQ owns the presentation (names, descriptions, order) of the eight `sys_*` tables; the tenant app owns their meaning (D68).

## 8. Suggested first prompt for a cold session

> Read `docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/START_HERE.md`, then the top of `STATUS.md` and `REMAINING_WORK.md`. The program is complete; work only on what the owner asks, and load the relevant skill(s) first per CLAUDE.md's table before writing anything.
