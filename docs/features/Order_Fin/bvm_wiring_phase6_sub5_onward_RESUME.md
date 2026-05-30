# RESUME — BVM Wiring: Phase 6 Sub-item 5 → program end

**Created:** 2026-05-30 (after Sub-items 1–4 closed; Sub-item 5 not yet started).
**Predecessor:** `docs/features/Order_Fin/bvm_wiring_phase6_sub1_inflight_RESUME.md` — Sub-items 1 + 2 + 3 + 4 are now ✅ Done in `IMPLEMENTATION_STATUS.md`.

This doc is self-contained. After `/clear`, paste the single-line prompt below.

---

## Single-line prompt to paste in the new session

> Read `docs/features/Order_Fin/bvm_wiring_phase6_sub5_onward_RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation` skills. Resume at **Phase 6 Sub-item 5** (Payment Method settings UI — D9 toggles). Continue through Sub-items 6–7 in priority order, stopping for user apply on every migration. After every code step, run the tsc + 196/196 baseline sweep at the bottom of this doc. Append a progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` per sub-item. End Phase 6 with its exit checklist + close via the `/documentation` skill writing `docs/features/Order_Fin/bvm_wiring_phase6_implementation.md`. After Phase 6 closes, write `docs/features/Order_Fin/bvm_wiring_program_summary.md` capping the whole program. Production quality only: full EN/AR + RTL, Cmx components, RBAC, multi-tenant safety via `withTenantContext`, no shortcuts.

---

## State at handoff (verified clean — safe to resume cold)

| Thing | Value | Verify command |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| Working tree | **clean except docs + UI from Sub-items 1–4** | `git status --short` |
| Last migration on disk | `0332_phase6_verify_payment_permission_and_action.sql` (applied) | `Get-ChildItem supabase/migrations/03*.sql \| Sort-Object Name \| Select-Object -Last 3` |
| Next free seq | `0333` | as above |
| Phase 6 Sub-item 1 (Verify-Payment) | ✅ Done |
| Phase 6 Sub-item 2 (Retire `createInvoice`) | ✅ Done |
| Phase 6 Sub-item 3 (`STORED_VALUE_SUB_IDEMPOTENCY_CODE` hoist) | ✅ Done |
| Phase 6 Sub-item 4 (Payment Modal v4 CHECK + gateway helpers) | ✅ Done |
| Phase 6 Sub-items 5–7 | ⏳ Pending |
| tsc (filtered) | **0 errors** |
| Full jest sweep | **196/196 pass** (172 baseline + 6 verify-payment + 2 history-consumer + 16 utils) |
| i18n parity | **green** |

### Files touched across Sub-items 1–4 (already saved on disk, NOT committed)

```
supabase/migrations/0332_phase6_verify_payment_permission_and_action.sql   # (applied)

# Sub-item 1
web-admin/lib/constants/order-financial.ts                                  # + PAYMENT_VERIFIED
web-admin/lib/services/order-history-consumer.service.ts                    # + PAYMENT_VERIFIED case
web-admin/lib/services/order-settlement.service.ts                          # + verifyPaymentTx
web-admin/app/api/v1/orders/[id]/payments/[paymentId]/verify/route.ts       # NEW
web-admin/src/features/orders/ui/order-financial/order-payments-credits-tables.tsx
web-admin/messages/en.json + ar.json                                        # + orders.detail.financial.verify.*
web-admin/__tests__/services/verify-payment.service.test.ts                 # NEW (6 tests)
web-admin/__tests__/services/order-history-consumer.service.test.ts         # + 2 tests

# Sub-item 2
web-admin/lib/services/erp-lite-auto-post.util.ts                           # NEW
web-admin/lib/services/ar-invoice.service.ts                                # import from util
web-admin/lib/services/invoice-service.ts                                   # deleted createInvoice + helpers
web-admin/app/actions/payments/invoice-actions.ts                           # createInvoiceAction → thin shim
web-admin/__tests__/services/invoice-service.test.ts                        # DELETED

# Sub-item 3
web-admin/lib/constants/order-financial.ts                                  # + STORED_VALUE_SUB_IDEMPOTENCY_CODE
web-admin/lib/services/order-submit-orchestrator.service.ts                 # use constant

# Sub-item 4
web-admin/src/features/orders/ui/payment-modal-v4.utils.ts                  # + 4 helpers
web-admin/src/features/orders/ui/payment-modal-v4.tsx                       # min + error on check date
web-admin/messages/en.json + ar.json                                        # + checkDateInvalid + checkDateInPast
web-admin/__tests__/features/orders/payment-modal-v4.utils.test.ts          # + 6 tests

# Docs
docs/features/Order_Fin/IMPLEMENTATION_STATUS.md                            # Sub-items 1–4 entries appended
docs/features/Order_Fin/bvm_wiring_phase6_sub5_onward_RESUME.md             # THIS DOC
```

---

## Phase 6 Sub-item 5 — Payment Method settings UI (D9 toggles + currency hint)

### Driver (verbatim from Phase 6 entry RESUME)

`org_payment_methods_cf` carries D9 routing columns (`settlement_type_code`, `credit_application_type`, `requires_cash_drawer`, `default_creation_status`, `allow_status_override`, `is_user_id_required`, `allow_outside_integration`) that today require operators to SQL-edit. The settings surface at `app/dashboard/settings/payments/page.tsx` already lists methods and lets operators edit name/description/channels/limits but does NOT expose the D9 fields.

Phase-1B Stabilization added the Prisma columns (S1); Phase 6 Sub-item 5 surfaces them in the existing dialog.

### Files involved

| Path | Role |
|---|---|
| `web-admin/app/dashboard/settings/payments/page.tsx` | Server-rendered shell; permission gate. **No edit.** |
| `web-admin/src/features/payment-config/ui/payment-settings-page.tsx` | Client tabbed page. **No edit.** |
| `web-admin/src/features/payment-config/ui/payment-method-config-dialog.tsx` | **Edit** — add "BVM routing" Cmx card section. |
| `web-admin/src/features/payment-config/model/payment-method-config-schema.ts` | **Edit** — add 5 D9 fields (optional/nullable). |
| `web-admin/app/actions/payment-config/payment-methods-actions.ts` → `updatePaymentMethodConfig` | **Edit** — forward the 5 new fields with the same `...(input.X !== undefined && { X: input.X })` spread shape used everywhere else. |
| `web-admin/lib/services/payment-config.service.ts` | **No edit** (read-side already projects D9 columns; service returns `eff_*` resolved fields). |
| `web-admin/messages/en.json + ar.json` | **Edit** — add localized labels for the 5 new fields under `paymentConfig.methods.*`. |

### What to add (exact)

Add to `paymentMethodConfigBaseSchema`:

```ts
settlement_type_code: z
  .enum([
    SETTLEMENT_TYPE_CODES.PAY_IN_ADVANCE,
    SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION,
    SETTLEMENT_TYPE_CODES.PAY_ON_DELIVERY,
    SETTLEMENT_TYPE_CODES.CREDIT_INVOICE,
  ])
  .nullable()
  .optional(),
credit_application_type: z
  .enum([
    CREDIT_APPLICATION_TYPES.GIFT_CARD,
    CREDIT_APPLICATION_TYPES.WALLET,
    CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE,
    CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT,
    CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT,
  ])
  .nullable()
  .optional(),
default_creation_status: z.enum(['PENDING', 'COMPLETED']).nullable().optional(),
allow_status_override: z.boolean().nullable().optional(),
is_user_id_required: z.boolean().nullable().optional(),
```

DB-mirror invariant: all enum strings come from `lib/constants/order-financial.ts` — do NOT re-spell them.

Add to the dialog (new Cmx card titled `t('methods.sections.bvmRouting')`):

- `settlement_type_code` — `CmxSelectDropdown`, options + an "Inherit" empty option.
- `credit_application_type` — `CmxSelectDropdown`, options + "Inherit" (only shown when `payment_nature === 'CREDIT_APPLICATION'`).
- `default_creation_status` — `CmxSelectDropdown` with PENDING / COMPLETED + Inherit.
- `allow_status_override` — Cmx tri-state (true / false / inherit). Implement as a `CmxSelectDropdown` with `'true'|'false'|''` because `CmxSwitch` is binary only.
- `is_user_id_required` — same tri-state shape.

Add to the action `updatePaymentMethodConfig`:

```ts
...(input.settlement_type_code !== undefined && { settlement_type_code: input.settlement_type_code }),
...(input.credit_application_type !== undefined && { credit_application_type: input.credit_application_type }),
...(input.default_creation_status !== undefined && { default_creation_status: input.default_creation_status }),
...(input.allow_status_override !== undefined && { allow_status_override: input.allow_status_override }),
...(input.is_user_id_required !== undefined && { is_user_id_required: input.is_user_id_required }),
```

Update `UpdatePaymentMethodConfigInput` type (in the actions file or wherever it lives) to mirror the schema.

i18n keys (under `paymentConfig.methods.*`):

| Key | EN | AR |
|---|---|---|
| `methods.sections.bvmRouting` | `BVM Routing` | `توجيه BVM` |
| `methods.settlementTypeCode` | `Settlement type override` | `تجاوز نوع التسوية` |
| `methods.creditApplicationType` | `Credit application type` | `نوع تطبيق الاعتماد` |
| `methods.defaultCreationStatus` | `Default creation status` | `الحالة الافتراضية عند الإنشاء` |
| `methods.allowStatusOverride` | `Allow status override` | `السماح بتجاوز الحالة` |
| `methods.isUserIdRequired` | `User ID required` | `معرف المستخدم مطلوب` |
| `methods.inheritFromPlatform` | `Inherit (platform default)` | `وراثة (الافتراضي المنصة)` |
| `methods.creationStatuses.PENDING` | `Pending` | `معلّق` |
| `methods.creationStatuses.COMPLETED` | `Completed` | `مكتمل` |

Plus per-value labels for `methods.settlementTypeCodes.*` and `methods.creditApplicationTypes.*` (5 + 4 entries each — copy from existing planner constants in `messages/en.json` if already present, else write them).

### Tests for Sub-item 5

No unit test for a pure UI form. Add a smoke test only if you write a thin pure helper for the tri-state value coercion (`'true' | 'false' | '' → boolean | null`); otherwise tsc + manual UI smoke is the bar.

### Stop-points

- **No migration.** Columns already exist (mig 0325).
- After code edits run: tsc (filtered) + the 196/196 sweep + `npm run check:i18n`.

### IMPLEMENTATION_STATUS entry shape

Mirror the Sub-item 1–4 entries already in `IMPLEMENTATION_STATUS.md`.

---

## Phase 6 Sub-item 6 — `paymentStatus` on `paymentLegSchema` + planner honoring (B7 unblock)

### Driver (verbatim)

`paymentLegSchema` (Zod) currently has no per-leg `paymentStatus`. Phase 1B B7 left this as "planner assumes COMPLETED unless the leg is on a DEFERRED method." Client cannot mark a leg as PENDING explicitly. This is the planned closer for B7.

### Files

| Path | Role |
|---|---|
| `web-admin/lib/validations/new-order-payment-schemas.ts` | **Edit** — add `paymentStatus: z.enum(['COMPLETED', 'PENDING']).optional().default('COMPLETED')` to `paymentLegSchema` (and the other two leg-shaped objects in the same file at lines ~78, ~269, ~384). |
| `web-admin/lib/services/order-settlement-planner.service.ts` | **Edit** — honor explicit `paymentStatus` from leg input; existing fallback (gateway-driven PENDING) only applies when the field is absent or `'COMPLETED'`. |
| `web-admin/lib/services/order-settlement.service.ts` → `settleOrder` | **Edit** — when wiringMode is false, derive `paymentStatus` from the explicit leg field with the same fallback. |
| `web-admin/__tests__/services/order-settlement-planner.service.test.ts` | **Edit** — add tests for explicit PENDING leg, default COMPLETED, and the wallet-balance precheck no-op. |

### Stop-points

- **No migration.** Pure validation + planner change.
- Backwards-compatible because `.default('COMPLETED')` matches the prior behaviour for callers that don't send the field.

### IMPLEMENTATION_STATUS entry shape

Mirror Sub-items 1–4.

### Note about Sub-item 4 follow-up

Sub-item 4 left a follow-up suggestion: "Consider promoting `validateCheckDueDate` into the Zod schema `paymentLegSchema` for server-side enforcement." Sub-item 6 is the natural carrier — add a `.refine` on the CHECK branch in the same change. Use the same `'checkDateInPast'` / `'checkDateInvalid'` message keys to keep client + server in lockstep.

---

## Phase 6 Sub-item 7 — Voucher status triple-column collapse (CONDITIONAL)

### Pre-flight audit (MANDATORY before any code/migration)

Run these read-only Supabase MCP queries before writing the migration:

```sql
-- 1. Any view definition referencing the legacy 'status' column on
-- org_fin_vouchers_mst? Drop is blocked if so.
SELECT n.nspname, c.relname
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class c ON c.oid = r.ev_class
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a
  ON a.attrelid = d.refobjid
 AND a.attnum   = d.refobjsubid
WHERE d.refobjid = 'public.org_fin_vouchers_mst'::regclass
  AND a.attname IN ('status', 'posted_status');

-- 2. Any function referencing it?
SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE pg_get_functiondef(p.oid) ILIKE '%org_fin_vouchers_mst.status%'
   OR pg_get_functiondef(p.oid) ILIKE '%org_fin_vouchers_mst.posted_status%';

-- 3. Grep TypeScript / SQL for raw references:
--    rg -n "status\s*[=,]" web-admin/lib/services/voucher-* web-admin/lib/services/biz-voucher-*
--    rg -n "posted_status" web-admin/
```

### Decision gate

- **Audit shows ANY external reader of `status` / `posted_status`** → defer Sub-item 7. Note it as an open follow-up in the program summary. Phase 6 closes WITHOUT this sub-item.
- **Audit clean** → write `0333_voucher_status_collapse.sql`:
  - `ALTER TABLE org_fin_vouchers_mst DROP COLUMN status RESTRICT;`
  - `ALTER TABLE org_fin_vouchers_mst DROP COLUMN posted_status RESTRICT;`
  - `ALTER TABLE org_fin_vouchers_mst ALTER COLUMN voucher_status SET NOT NULL;`
  - Recreate any indexes / constraints that referenced the dropped columns (include the recreate statements in the same migration).
  - Wrap in `BEGIN/COMMIT` with a `DO $$ ... $$` validation block.
- **STOP for user apply** before code regen.
- After migration applied:
  - Regenerate Prisma: `npx prisma generate`.
  - Remove any `status` / `posted_status` reads in TypeScript.
  - Run tsc + full sweep + i18n.

### Risk

High. This is a load-bearing column. Defer if ANY doubt.

---

## Per-sub-item protocol (apply to every sub-item)

1. **Plan the sub-item** — confirm scope + acceptance criteria.
2. **Implement** with production-ready discipline. Constants must DB-mirror exactly. Use `withTenantContext` for every Prisma call on `org_*` tables. Permission codes must follow `resource:action`.
3. **STOP for user review** if it includes a migration.
4. **Verify** — tsc filtered + sweep + i18n.
5. **Update `IMPLEMENTATION_STATUS.md`** with the sub-item's progress entry.

## Phase 6 close protocol

1. Run every per-sub-item protocol on every sub-item.
2. Run the Phase 6 exit checklist (tsc + full sweep + i18n + nav-parity + permission-parity).
3. Invoke `/documentation` skill → `docs/features/Order_Fin/bvm_wiring_phase6_implementation.md` matching the Phase 4/5 template.
4. Prepend a Phase 6 entry to `docs/features/Order_Fin/CHANGELOG.md`.
5. Flip Phase 6 status to ✅ Done in `IMPLEMENTATION_STATUS.md`.
6. Update memory `project_bvm_wiring_phases.md`.

## Program summary (after Phase 6 closes)

Write `docs/features/Order_Fin/bvm_wiring_program_summary.md`:

- Recap Phases 1A → 6 in chronological order with one paragraph each.
- Public API surface delta (new endpoints, new services, new constants) cumulative.
- Migration log (0290 → 0333).
- Test coverage delta (start vs end count: was 163 at Phase 5 entry, now 196 at end of Sub-item 4).
- Open follow-ups (if any — Sub-item 7 deferral, payment-modal-v4 HYPERPAY wiring follow-up).
- Production-readiness checklist (security, multi-tenancy, i18n, RTL, RBAC).
- Architecture invariants list (the LOCKED items from memory).
- Recommended next-program backlog (e.g. per-order AR_INVOICE_LINKED sub-events, reconciliation UI for vouchers, refund FK direct backlink).

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
         __tests__/services/reconciliation/check-modules.test.ts `
         __tests__/services/order-history-consumer.service.test.ts `
         __tests__/services/verify-payment.service.test.ts `
         __tests__/features/orders/payment-modal-v4.utils.test.ts
# expect: 196/196 pass

npm run check:i18n
# expect: i18n parity check passed

git status
# expect: clean except docs + Sub-items 1–4 working changes (not yet committed)
```

If any of the above fails, investigate before continuing — do not paper over.

---

## Canonical references

| Purpose | Path |
|---|---|
| PRD | `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` |
| Current implementation status | `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` |
| Phase 5 close template | `docs/features/Order_Fin/bvm_wiring_phase5_implementation.md` |
| Phase 4 close template | `docs/features/Order_Fin/bvm_wiring_phase4_implementation.md` |
| Phase 6 priority backlog (full context from program plan) | `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` |
| Changelog | `docs/features/Order_Fin/CHANGELOG.md` |
| Predecessor RESUME (Sub-item 1 in-flight) | `docs/features/Order_Fin/bvm_wiring_phase6_sub1_inflight_RESUME.md` |
