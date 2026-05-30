# RESUME — BVM Wiring: close Phase 4 → Phases 5 + 6 → program summary

**Created:** 2026-05-30 (mid-session checkpoint, just before user runs `/clear`).
**Predecessor (this session):** `docs/features/Order_Fin/bvm_wiring_phase4_RESUME.md` — Steps 2c onward.
**Predecessor (original program plan):** `docs/features/Order_Fin/bvm_wiring_phase4_to_6_RESUME.md` — Phase 5 and Phase 6 specs still apply unchanged.

This doc is self-contained. After `/clear`, paste the single-line prompt below.

---

## Single-line prompt to paste in the new session

> Read `docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation` skills. Resume at **Phase 4 close — Step 8a** (Phase 4 implementation doc). Continue through Step 8e (memory update), then run **Phase 5** (History/Audit, PRD §22) and **Phase 6** (UI/schema debt cleanup per `BVM_PHASE_2_ENTRY_PLAN.md`). NEVER apply migrations — create the `.sql` file, then STOP and ask. After every code step, run `cd web-admin && npx tsc --noEmit` filtered to exclude `payment-config|cash-drawers` + the 163/163 baseline sweep (command at bottom of this doc). Append a progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` per step. End each phase with its exit checklist + close via the `/documentation` skill writing `docs/features/Order_Fin/bvm_wiring_phase{N}_implementation.md`. After Phase 6 closes, write `docs/features/Order_Fin/bvm_wiring_program_summary.md` capping the whole program. Production quality only: full EN/AR + RTL, Cmx components, RBAC, multi-tenant safety via `withTenantContext`, no shortcuts.

---

## State at handoff (verified clean — safe to resume cold)

| Thing | Value | Verify command |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| HEAD | Phase 3 close (`5c7a78b 28_05_2026_14 fix ar-invoice.service.ts and Update payment Modal screen v04`) | `git log -1 --oneline` |
| Last migration on disk | `0329_phase2_stored_value_voucher_fks.sql` | `ls supabase/migrations/03*.sql \| sort \| tail -3` |
| Next free seq | `0330` (still unused — Phase 4 had no schema gap) | as above |
| Phase 4 code | **DONE** through Step 7 (29 new tests + UI Cmx migration + voucher-scoped service + voucher-scoped API route) | this doc |
| Phase 4 docs/close | **PENDING** Steps 8a–8e | this doc |
| tsc (filtered) | **0 errors** | see baseline below |
| Full jest sweep | **163/163 pass** (120 baseline + 14 orchestrator + 29 check-modules) | see baseline below |
| i18n parity | **green** | `npm run check:i18n` |
| Supabase MCP | configured (`supabase_remote_db`) | `.mcp.json` |

### Files dirty at handoff — Phase 4 work-in-progress (ship as one Phase 4 commit when phase closes)

```
web-admin/app/api/v1/finance/reconciliation/issues/[issueId]/route.ts        # BUG-R1 fix (Step 2a)
web-admin/app/api/v1/finance/vouchers/[voucherId]/reconciliation/route.ts    # NEW (Step 3a)
web-admin/app/api/v1/orders/[id]/financial-reconcile/route.ts                # JSDoc cross-ref (Step 3b)
web-admin/app/api/v1/orders/[id]/financial-reconciliation/route.ts           # JSDoc cross-ref (Step 3b)
web-admin/app/dashboard/internal_fin/reconciliation/[runId]/page.tsx         # Cmx back-link (Step 4c)
web-admin/lib/constants/order-financial.ts                                   # 20 new check codes (Step 2b)
web-admin/lib/services/reconciliation.service.ts                             # full orchestrator rewrite (Step 2h)
web-admin/lib/services/reconciliation/types.ts                               # NEW (Step 2b)
web-admin/lib/services/reconciliation/ar-checks.ts                           # NEW (Step 2d)
web-admin/lib/services/reconciliation/stored-value-checks.ts                 # NEW + T1 closed (Step 2c+2h)
web-admin/lib/services/reconciliation/order-checks.ts                        # NEW (Step 2e)
web-admin/lib/services/reconciliation/order-snapshot-checks.ts               # NEW (Step 2f)
web-admin/lib/services/reconciliation/voucher-checks.ts                      # NEW (Step 2g)
web-admin/lib/services/voucher-reconciliation.service.ts                     # NEW (Step 2i)
web-admin/src/features/billing/ui/reconciliation-list-client.tsx             # Cmx/RTL/i18n (Step 4a)
web-admin/src/features/billing/ui/reconciliation-detail-client.tsx           # Cmx/RTL/i18n (Step 4b)
web-admin/messages/en.json                                                   # paginationTotal + 33 check labels (Step 6a)
web-admin/messages/ar.json                                                   # paginationTotal + 33 check labels (Step 6a)
web-admin/__tests__/services/reconciliation.service.test.ts                  # createMany contract (Step 2j)
web-admin/__tests__/integration/reconciliation-run.test.ts                   # createMany contract (Step 2j)
web-admin/__tests__/services/reconciliation/check-modules.test.ts            # NEW (Step 7)
docs/features/Order_Fin/IMPLEMENTATION_STATUS.md                             # all per-step entries
docs/features/Order_Fin/bvm_wiring_phase4_RESUME.md                          # earlier checkpoint
docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md     # THIS DOC
```

### Carry-over files — NOT MINE, leave alone

Already dirty before Phase 4 started. Do not touch:

- `web-admin/app/dashboard/internal_fin/invoices/[id]/page.tsx`
- `web-admin/src/features/ar/ui/ar-invoice-detail-tabs.tsx`
- `web-admin/src/features/ar/ui/ar-invoice-detail-data-table.tsx` (untracked)
- `docs/features/Order_Fin/CleanMateX_Order_Details_Financial_Summary_Enhancement_Spec_v1_0.md` (untracked)
- Payment Modal v4 work (`payment-modal-v3.tsx`, `payment-modal-v4.tsx`, related test/route/i18n files) — separate effort

---

## Work plan from here

### Phase 4 close — Steps 8a → 8e (NEXT)

- **8a** — Write `docs/features/Order_Fin/bvm_wiring_phase4_implementation.md`. Mirror the Phase 3 template (`bvm_wiring_phase3_implementation.md`). Sections: scope summary, every step's deliverables, file inventory, R1–R8 bug status, public API surface, verification matrix, follow-up TODOs (none — T1 was closed in Step 2h).
- **8b** — Append a Phase 4 entry to the top of `docs/features/Order_Fin/CHANGELOG.md` (Phase 3 entry is the existing top).
- **8c** — Flip Phase 4 status to ✅ Done in `IMPLEMENTATION_STATUS.md` (the long-running progress doc).
- **8d** — Phase 4 exit checklist (template from original RESUME §"Phase 4 exit checklist"). Verify each line.
- **8e** — Update memory `project_bvm_wiring_phases.md` to mark Phase 4 ✅ done with bullet of new artifacts.

### Phase 5 — History / Audit (PRD §22)

Reproduced from the original RESUME so this doc is self-contained:

- **Step 0** — Discovery: grep `org_order_history|org_order_status_history` in schema; check existing services. Confirm whether tables already exist (Phase 3 may have added some).
- **Step 1** — Migration `0330_phase5_order_history.sql` (only if tables missing). Two tables:
  - `org_order_history` — event log (`event_type`, `payload jsonb`, `actor`, audit fields, RLS).
  - `org_order_status_history` — status timeline (`from_status`, `to_status`, `transition_at`, `reason`, audit fields, RLS).
  - Composite FKs to `org_orders_mst`, standard indexes, `tenant_isolation_*` RLS policies. STOP for user apply + `npx prisma generate`.
- **Step 2** — Consumer service `lib/services/order-history-consumer.service.ts` subscribed to outbox events `ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, `AR_INVOICE_ISSUED`. Writes history rows **asynchronously**, never inside the submit-order transaction. Idempotent on `(tenant_org_id, outbox_event_id)`.
- **Step 3** — UI: add a "History" tab to `src/features/orders/ui/order-detail-screen.tsx` using `CmxTabsPanel` from `@ui/navigation`. Tab body uses `CmxDataTable` (server-side pagination). RTL: chevron `rtl:rotate-180` if used.
- **Step 4** — Tests + docs:
  - Consumer service unit tests (idempotency, multi-tenant).
  - UI a11y test for the new tab.
  - Append Phase 5 entries to `IMPLEMENTATION_STATUS.md` per step.
- **Phase 5 exit checklist** — same template as Phase 4 (write `bvm_wiring_phase5_implementation.md` via `/documentation`).

### Phase 6 — UI / schema debt cleanup

Priority order from `BVM_PHASE_2_ENTRY_PLAN.md`. Each sub-item is its own step:

1. **Verify-payment endpoint** (highest UX value):
   - `POST /api/v1/orders/[id]/payments/[paymentId]/verify`
   - Service: `verifyPaymentTx(tx, { orderId, paymentId, userId })` flips `payment_status` PENDING → COMPLETED, emits outbox event.
   - New permission `orders:verify_payment` → **needs DB seed migration** (`0331_orders_verify_payment_permission.sql`). STOP for user apply.
   - UI: verify button + badge in payment details (Cmx).
2. **Retire `createInvoice`** (legacy adapter in `lib/services/invoice-service.ts`):
   - Migrate `app/actions/payments/invoice-actions.ts:createInvoiceAction` to `createArInvoiceFromOrders`.
   - Update `__tests__/services/invoice-service.test.ts`.
   - Delete `createInvoice` + its private helpers.
   - Extract `assertBlockingInvoiceAutoPostSucceeded` to `lib/services/erp-lite-auto-post.util.ts` (currently duplicated in `invoice-service.ts` and `ar-invoice.service.ts`).
3. **Hoist `STORED_VALUE_CODE`** from `order-submit-orchestrator.service.ts:84-90` into `lib/constants/order-financial.ts`.
4. **Payment Modal v4 completion** (WALLET + CHECK/HYPERPAY validation) — **check `git status` first**; someone is already mid-work, might be merged separately.
5. **Payment Method settings UI** — 4 D9 toggles + tenant-level `currency_code`.
6. **`paymentStatus` field on `paymentLegSchema`** + planner honoring (B7 unblock).
7. **Voucher status triple-column collapse migration** — only after audit confirms no readers use legacy `status`.

Each sub-item gets its own progress entry. Phase 6 can span multiple sessions.

**Phase 6 exit checklist** — same template (write `bvm_wiring_phase6_implementation.md` via `/documentation`).

### Program summary (after Phase 6 closes)

Write `docs/features/Order_Fin/bvm_wiring_program_summary.md`:

- Recap Phases 1A–6 in chronological order with one-paragraph each.
- Public API surface delta (new endpoints, new services, new constants).
- Migration log (0290–0331 range).
- Test coverage delta (start vs end count).
- Open follow-ups (if any).
- Production-readiness checklist (security, multi-tenancy, i18n, RTL, RBAC).

---

## Per-step protocol (apply to every step in every phase)

1. **Plan the step** — confirm scope + acceptance criteria.
2. **Load any new skill** the step needs (`/i18n` for translations, `/navigation` for nav, `/database` for SQL, etc.). Skills already loaded at session start: `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation`.
3. **Implement** with production-ready discipline (no gaps, no shortcuts, full a11y/RTL/i18n where applicable). Constants must DB-mirror exactly. Use `withTenantContext` for every Prisma call on `org_*` tables.
4. **STOP for user review** if it's a migration. Otherwise…
5. **Verify** (baseline below).
6. **Update `IMPLEMENTATION_STATUS.md`** with the step's progress entry (dual-step rule).
7. **Mark TODO complete + next step in_progress** (`TodoWrite`).

## Per-phase protocol (apply at every phase boundary)

1. Run every per-step protocol on every step.
2. Run the per-phase exit checklist.
3. Invoke `/documentation` skill → `docs/features/Order_Fin/bvm_wiring_phase{N}_implementation.md` matching the Phase 2/3 template.
4. Update `docs/features/Order_Fin/CHANGELOG.md` with a top-of-file entry.
5. Flip the phase status in `IMPLEMENTATION_STATUS.md` to ✅ Done.

---

## Quick sanity test before resuming

```powershell
Set-Location F:\jhapp\cleanmatex\web-admin
npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 10
# expect: 0 errors

npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts `
         __tests__/services/order-settlement-planner.service.test.ts `
         __tests__/services/discount-service.test.ts `
         __tests__/services/stored-value.service.test.ts `
         __tests__/services/loyalty.service.test.ts `
         __tests__/services/ar-invoice.service.test.ts `
         __tests__/services/gift-card-service.test.ts `
         __tests__/services/reconciliation.service.test.ts `
         __tests__/integration/reconciliation-run.test.ts `
         __tests__/services/reconciliation/check-modules.test.ts
# expect: 163/163 pass

npm run check:i18n
# expect: i18n parity check passed

git status
# expect: dirty files listed above, nothing else new
```

If any of the above fails, investigate before continuing — do not paper over.

---

## Canonical references

| Purpose | Path |
|---|---|
| PRD (master spec, all phases) | `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` |
| Current implementation status | `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` |
| Original program plan (still authoritative for Phase 5/6) | `docs/features/Order_Fin/bvm_wiring_phase4_to_6_RESUME.md` |
| Phase 3 close template | `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md` |
| Phase 2 close template | `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md` |
| Phase 6 priority backlog | `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` |
| AR Invoice scope ADR | `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md` |
| Changelog | `docs/features/Order_Fin/CHANGELOG.md` |
