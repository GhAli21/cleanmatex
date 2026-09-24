# START HERE — POS Session & Cash Drawer Hardening

**Entry point for a cold session.** Read this first, then `STATUS.md`, then `RESUME_CONTINUATION.md`, then the part of `IMPLEMENTATION_PLAN.md` you are about to work on.

---

## 1. State as of 2026-09-25 — **STATUS.md is authoritative; this section is a summary only**

- **Planning is complete.** 188 tasks, decisions D1–D28, three completeness audits.
- **Wave 0 is COMPLETE** (migrations `0515`–`0518`, applied local+remote). **Wave A is IN PROGRESS**: A1, A2 (except the documented payment-during-close gap), **A3 is fully COMPLETE** (A3-1/A3-2/A3-3/A3-4/A3-5/A3-6/A3-7 all done — only A3-6b remains, deliberately deferred pending an owner call), and A4-1/A4-2 are done; A5-1/A5-2/A5-3 were run 2026-09-24 as an **interim checkpoint** (whole-project gates green, QA guide + docs refreshed) at the owner's request — this is **not** a Wave A close. **D26 (2026-09-24, CRITICAL, fixed): `closeSession` was failing on every real call since A3-3 shipped** — a Prisma-modeled column (`sys_currency_cd.decimal_places`) never existed on the live table, local or remote; fixed to the real `minor_unit` column, DB-integration-verified. **D28 (2026-09-25): A3-4 shipped** — money now crosses the drawer/POS-session APIs as exact fixed-point strings end to end, plus 2 real bugs found and fixed on the session print page along the way. Remaining in Wave A: A4-3/A4-3b/A4-3c/A4-3d/A4-4, A6 (now confirmed blocked at the DDL-authoring level too, not just value-supply — see D28/RESUME), and A3-6b pending an owner call (see D27). Waves B–E not started.
- **Next action:** see [`RESUME_CONTINUATION.md`](./RESUME_CONTINUATION.md) for the current pointer and options.
- All open questions are answered or carry a recorded safe default.
- The only external dependency is HQ's curated currency values — and both affected packages degrade safely without them, so nothing is blocked.

## 2. Files in this folder

| File | What it is |
|---|---|
| `START_HERE.md` | this file |
| `STATUS.md` | decisions, wave status, open questions, HQ obligations, audit history — **the progress record; if it disagrees with anything else, it wins** |
| `RESUME_CONTINUATION.md` | session-to-session log — what just happened, what's next; read this for the current pointer |
| `IMPLEMENTATION_PLAN.md` | the full plan: waves, tasks, DDL, inventories, standing rules |
| `ARCHITECTURE_REVIEW_2026-09-23.md` | evaluation of the external architecture doc — what was adopted, rejected, corrected |

Related, in the **HQ repo**: `cleanmatexsaas/docs/features/Currency_Setup/HQ_CURRENCY_HANDOFF.md`.

## 3. Read order before writing anything

1. `STATUS.md` — decisions D1–D25 and any newly answered questions.
2. `RESUME_CONTINUATION.md` — the current pointer (what just shipped, what's next).
3. `IMPLEMENTATION_PLAN.md` **§10** — the standing rules. All of them apply to every task.
4. The specific wave section you are starting.

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

## 5. Where to start — Wave A remainder (Wave 0 is done)

Wave 0 is fully shipped and applied. Wave A is partially shipped (A1, A2, **A3 fully done**, A4-1/2, A5-1/2/3-as-checkpoint). See `RESUME_CONTINUATION.md`'s latest entry for the owner's next pick among: A4-3/A4-3b/A4-3c/A4-3d/A4-4 (per-currency session balances table + `allow_multi_currency_drawer` setting — Wave-0-sized, its own pass) or A6 (cash tender rounding — blocked pending HQ's rounding-vocabulary sign-off, `HQ-CUR-3`; not a viable pick until that lands). A3-6b (demo-data recompute) needs an owner call on which historical sessions are safe to touch before it can be picked up (see D27). Load `/database` + `/multitenancy` for any of these that touch a table or `org_*` query; `/backend`/`/frontend`/`/i18n` per CLAUDE.md's table for the rest.

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

> Read `docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/START_HERE.md`, `STATUS.md`, and `RESUME_CONTINUATION.md` (in that order), then continue Wave A per `RESUME_CONTINUATION.md`'s latest "▶ NOW" pointer — load the relevant skill(s) first per CLAUDE.md's table before writing anything.
