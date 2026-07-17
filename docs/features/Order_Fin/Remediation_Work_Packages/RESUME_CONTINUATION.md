# RESUME — Order Fin Remediation Program (session continuation)

**Updated:** 2026-07-17, immediately before an owner `/clear` (expert correction pass 2026-07-16 already applied). **Read this file + [CLAUDE.md](CLAUDE.md) first in any new session, then follow it exactly.**

## Where the program stands

| Item | State |
|---|---|
| Authoritative current-state report | frozen at `docs/Audit_Reports/CleanMateX_Enterprise_Financial_Accounting_Audit_15_07_2026/CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md` (incl. Addendum A1) — never modify except explicit addenda |
| Documentation status | **UNDER_REVIEW** — 12 decisions, 34 packages (B01–B34), master + Phase 0 indexes, capability bundles; these are active planning files, not frozen artifacts |
| Approved decisions | **APPROVED (Expert), 2026-07-16 — D002 (Option A v2: five-facet vocabulary, origin-only source registry), D003 (Expert model v2: commercial refunds never reopen by default; reversal/void/bounce/chargeback reopen via status change; refund-and-rebill explicit + permissioned; stored-value reversal reopens only via credits term), D004 (Option B), D005 (Option A), D010 (Option A)** — approval type, selected option, and rationale summary recorded in each decision file |
| Open decisions | D001, D006–D009, D011 (PROPOSED — finalize at their waves); D012 (needs accounting-owner) |
| Implementation authorization | **Owner continuation directive (recorded 2026-07-17):** continue all remaining planning AND implementation phases, following the master sequence, until the program is finished. This directive is the explicit authorization instrument; **B01 is the named next package under it.** Each subsequent package start is announced against this RESUME + master index (the owner may redirect at any boundary). Hard owner control points remain at every package: migration apply (stop-and-wait), commits, Preview QA approval. D012 still requires the accounting owner |
| Remaining decisions at their waves | D001, D006–D009, D011 are finalized at their decision waves using the same expert-approval pattern (`APPROVED (Expert)` with selected option + rationale recorded); D012 only with the accounting owner |
| Next action | **B01 IN_IMPLEMENTATION — checklist step 2 (migration) DONE 2026-07-17: `supabase/migrations/0404_b01_refund_lineage_and_context.sql` authored. STOPPED per stop-and-wait rule: OWNER MUST APPLY 0404, then the session continues with checklist step 3 (service) → 4 (tests §14) → 5 (statuses/evidence).** B01 §1a records the verified actual-DB corrections: **table empty in all environments (owner-confirmed)** → unconditional v2 constraints, `refund_context` NOT NULL, no cutover/legacy arms; reopen-bounds CHECK pre-existed; payment FK made tenant-composite; `PENDING_APPROVAL` status-CHECK defect fixed in 0404 |

## Standing rules that bind every session (do not re-negotiate)

1. **Folder [CLAUDE.md](CLAUDE.md)** governs all planning files; project root CLAUDE.md governs code.
2. **Skills before code:** `/database` (SQL/migrations), `/backend` (services/APIs), `/frontend` + `/i18n` (UI), `/multitenancy` (org_* queries), `/implementation` (features). Load BEFORE the first line of that domain.
3. **Migrations:** create the SQL file with the next sequence in `supabase/migrations/` (check at that moment; ≥0402 expected), then **STOP and wait for the owner to apply it** before continuing. Never apply via MCP/CLI. New migrations only — never modify existing ones. TEXT not VARCHAR. Every org_* query filters `tenant_org_id`.
4. **Gates before "done" per package:** `npx eslint . --quiet` (web-admin), `npx tsc --noEmit`, targeted + full jest, `npm run build`, `npm run check:i18n` when translations touched. Fix until green; report honestly.
5. **Full-cycle completeness (owner directive):** every capability ships backend + API + frontend screens + permissions + i18n/RTL + audit, usable end-to-end. Backend-without-UI = PARTIAL.
6. **No silent money mutation** (CRITICAL RULE 15) and the frozen layer rule: business event ≠ BVM voucher ≠ operational fact ≠ drawer movement ≠ GL journal. D003 v2 extends this: a normal refund never silently reopens a customer's due.
7. Update package status + Completion evidence + this RESUME + the master index at every package boundary; the owner commits (do not commit unless asked).
   **Release promotion (owner rule, 2026-07-16): commit → deploy to Preview → QA executes the package checklist on Preview → QA finished + owner approval recorded → only then promote to production.** No direct-to-production; VERIFIED and production flag activation both require the recorded Preview QA approval; rollback proven on Preview first.
8. Safety gates: production UI activation never exposes an unsafe backend — per-package Safety blocks are binding. **B34: production activation of any refund workflow only after B01 AND B02 VERIFIED; cash/original-method refunds only after B09 VERIFIED; permission-sensitive actions (rebill, manual exception) gated by the applicable B27 codes. B34 must not be built or activated against the pre-B1 API.**
9. **Progress after every task:** update plan progress + statuses (Bxx file, master index, this RESUME) after each task, not only at package boundaries.
10. **Docs after every package:** once a package finishes implementation + Preview QA, update/create/refresh all related documentation (feature docs, STATUS, guides — `/documentation` skill) before marking VERIFIED.
11. **Project CLAUDE.md always binds** (`F:\jhapp\cleanmatex\CLAUDE.md`): required skills loaded per domain before code, agents per task type, referenced rule docs read; Cmx reusables first — create a reusable component when an element will be used in 2+ places. Best practices throughout: no gaps, no bugs, UI/UX best practices, production-ready only.
12. **B26 is a planning umbrella only** — no implementation of any kind under the B26 ID until its FX, gateway settlement, chargeback, bank reconciliation, safe/deposit, and ECL areas are split into separate implementation packages.

## Implementation order (from the master index — follow under the 2026-07-17 continuation directive unless the owner redirects)

```text
NOW    → B1 (per B01 §15 rollout: migration [STOP-AND-WAIT] → service → tests §14 → verify)
Seq 2  → B2 → B33;  B34 design/flagged implementation (activation per Safety block:
         B01+B02 VERIFIED; cash/original-method after B09; B27 for permission-sensitive actions)
Seq 3  → B15, B16, B20(design), B29
Seq 4  → B4 → B5, B31          Seq 5 → B7, B27
Seq 6  → B3, B30, B32          Seq 7 → B9, B10
Seq 8  → B6 → B13              Seq 9 → B8, B19, B21, B22
Seq 10 → B11, B17, B18         Seq 11 → B12, B14
Seq 12 → B23, B24              Seq 13 → B25, B26 (umbrella — split first)
Cont.  → B28 slice per wave (a wave is not VERIFIED without it)
Decision waves: D001+D009 before B30 actions; D007+D008 before B3/B6; D006 before B13; D011 before B12; D012 before B25.
```

## B1 implementation checklist (first work in the new session, per the 2026-07-17 continuation directive)

1. Load `/database` + `/backend`; read [B01](B01_Refund_Lineage_And_Reopen_Due.md) fully (it is the spec; the APPROVED (Expert) v2 decisions are binding).
2. ✅ DONE 2026-07-17 — Migration `0404_b01_refund_lineage_and_context.sql` (rev 2 — table verified/owner-confirmed EMPTY in all environments, so all constraints are **unconditional**, no cutover): `original_credit_app_id` promoted (defensive copy-only backfill, same-tenant resolution guard) + composite FK + cap index; `refund_context` TEXT **NOT NULL** + registry CHECK; v2 origin-only source-registry CHECK (old CHECK replaced); D003-invariant-7 CHECK (positive reopen ⇒ REFUND_AND_REBILL/MANUAL_EXCEPTION); source↔lineage XOR CHECK; payment FK aligned tenant-composite; reopen-bounds CHECK pre-existed (0340, ensured); `PENDING_APPROVAL` added to the status CHECK (defect fix — see B01 §1a). **STOPPED → owner applies 0404 before step 3.**
3. Service: `initiateRefund` classification (D002 v2 map incl. CUSTOMER_CREDIT_RESTORE / GOODWILL_CONCESSION, lineage XOR validation, required route key, required `refundContext`), `processRefund` reopen per **D003 v2** (0 for all commercial paths; positive only for REFUND_AND_REBILL [rejected until the B27 code exists] and MANUAL_EXCEPTION; CANCELLATION_UNWIND from cancel unwind), wallet destination idempotency key `refund-${refundId}-wallet`, `classifyRefunds` column-first already exists.
4. Tests: full §14 matrix (18 scenarios, v2 expectations) + regression suite; gates green.
5. Update B01 Completion evidence + statuses + this RESUME; owner commits → **Preview deployment → QA runs the §14 scenario checklist on Preview → owner approval recorded** → production promotion; mark VERIFIED only when §16 criteria all hold AND the Preview QA approval is recorded.

## Memory pointer

Persistent memory `project_order_fin_remediation_wp_program.md` mirrors this state (auto-recalled in new sessions). If memory and this file disagree, **this file wins** — update memory.
