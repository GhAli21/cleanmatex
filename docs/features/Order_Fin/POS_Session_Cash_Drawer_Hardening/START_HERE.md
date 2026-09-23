# START HERE — POS Session & Cash Drawer Hardening

**Entry point for a cold session.** Read this first, then `STATUS.md`, then the part of `IMPLEMENTATION_PLAN.md` you are about to work on.

---

## 1. State as of 2026-09-23

- **Planning is complete.** 188 tasks, 18 decisions (D1–D16), 20 migrations (`0515`–`0534`), three completeness audits.
- **Nothing is implemented.** Zero code written, zero migration files created, zero tasks ticked.
- All open questions are answered or carry a recorded safe default.
- The only external dependency is HQ's curated currency values — and both affected packages degrade safely without them, so nothing is blocked.

## 2. Files in this folder

| File | What it is |
|---|---|
| `START_HERE.md` | this file |
| `STATUS.md` | decisions, wave status, open questions, HQ obligations, audit history — **the progress record; if it disagrees with anything else, it wins** |
| `IMPLEMENTATION_PLAN.md` | the full plan: waves, tasks, DDL, inventories, standing rules |
| `ARCHITECTURE_REVIEW_2026-09-23.md` | evaluation of the external architecture doc — what was adopted, rejected, corrected |

Related, in the **HQ repo**: `cleanmatexsaas/docs/features/Currency_Setup/HQ_CURRENCY_HANDOFF.md`.

## 3. Read order before writing anything

1. `STATUS.md` — decisions D1–D16 and any newly answered questions.
2. `IMPLEMENTATION_PLAN.md` **§10** — the standing rules. All of them apply to every task.
3. The specific wave section you are starting.

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

For W0 specifically: **`/database` + `/multitenancy`**.

## 5. Where to start — W0, migration `0515`

**Package W0 §3.1** — the cash-control config table.

1. Verify on the **remote** DB (read-only MCP) that `org_fin_cash_ctrl_stng_cf` does not exist, and confirm `uuid_nil()` is available or pick a sentinel UUID.
2. Write `supabase/migrations/0515_cash_control_settings.sql` — the 13 explicit nullable setting columns (D4), every `CHECK` from §3.1.2, the unique expression index, RLS, `COMMENT ON` per column. **No seed rows** (§10.12 explains why this one is deliberately empty).
3. **STOP.** Do not apply it. Hand it over for review.

Then W0-3b (Prisma + generated types), W0-3 (constants), W0-4 (resolver service), W0-4b (audit), W0-5 (admin screen + API), W0-6 (i18n), W0-7 (tests), W0-8 (STATUS).

## 6. The rules that get broken most often

- **Never apply a migration.** Write the `.sql`, stop, wait for confirmation. Every `STOP-AND-WAIT` marker in the plan is real.
- **Load the skill first.** Not after.
- **`withTenantContext(tenantId, () => prisma.$transaction(...))`** — never the reverse, or RLS context is lost inside the transaction and every `org_*` read silently returns zero rows.
- **Money is `DECIMAL(19,4)`** in the DB and `Prisma.Decimal` in code — never a JS `number`, never `::float8`.
- **Minor-unit columns are `INTEGER`** (D13), not `BIGINT`.
- **`TEXT` not `VARCHAR`; `TIMESTAMPTZ` not naive timestamps; audit actors are `TEXT`** with `_info` columns.
- **Cmx components only**, `cmxMessage` for all feedback, EN **and** AR for every key.
- **Update `STATUS.md`** at every package close (§10.9).

## 7. What NOT to redo

These are settled. Reopening them wastes a session:

- Settings live in `org_fin_cash_ctrl_stng_cf` with one column per setting and a single resolver service (D3, D4).
- Rounding policy lives in `sys_currency_rounding_rules_cf`, HQ-owned (D8, D12).
- Denomination catalog is HQ-owned; we consume it read-only (D9).
- Per-currency session balances, **not** a single-currency `CHECK` (D14).
- Counts are header + detail snapshots, immutable (D15).
- Cash-change rounding is a tenant setting; tender rounding is not (D16).

## 8. Suggested first prompt for a cold session

> Read `docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/START_HERE.md` and `STATUS.md`, then start W0: load `/database` and `/multitenancy`, and write migration `0515` per §3.1 of the plan. Stop after writing the file.
