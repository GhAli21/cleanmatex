# AR Invoice v1 / v1.5 / v2 — Implementation Status

## 2026-05-28 — Phase 1B Stabilization Session Impact

A pre-Phase-2 audit (session: `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose.md`) surfaced three AR-Invoice-related issues, all fixed:

1. **Permission rename** — `invoices:view` (referenced in 5 sites but never seeded) renamed to `invoices:read` (the actual seeded permission). Non-admin roles can now access AR invoice screens. Sites updated: `app/api/v1/ar/invoices/route.ts`, `app/api/v1/ar/invoices/[id]/route.ts`, `config/navigation.ts`, `src/features/billing/access/billing-access.ts` (5 lines).

2. **AR receivable-only contract** — see new ADR: [`ADR_ar_invoice_is_receivable_only.md`](ADR_ar_invoice_is_receivable_only.md). `org_invoice_mst` rows now represent AR receivables only — fully-paid cash/card/gateway orders no longer produce AR ledger debits. This fixes PRD acceptance criterion #11 which was previously claimed complete but was actually never working correctly.

3. **Defense-in-depth guard** — `ensureCanonicalArInvoiceArtifactsTx` now refuses to write `INVOICE_ISSUED` AR ledger debits when `outstanding_amount === 0` AND `payment_type_code` is neither `INVOICE` nor `CREDIT_INVOICE` nor `PAY_ON_COLLECTION`. This protects against any future caller that creates an AR invoice row for a cash-paid order.

**Related:**
- Order Financial side of the session: see `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` and `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md`.
- Canonical ADR: [`ADR_ar_invoice_is_receivable_only.md`](ADR_ar_invoice_is_receivable_only.md)

**Feature:** AR Invoice  
**Location:** `cleanmatex` only  
**Primary UI area:** `web-admin/app/dashboard/internal_fin/invoices` + `web-admin/app/dashboard/internal_fin/ar/*`  
**Canonical header table:** `public.org_invoice_mst`  
**Status:** Completed  
**Last Updated:** 2026-05-22

## Summary

This tracker records implementation progress for the AR Invoice rollout through v1, the v1.5 canonical cleanup bridge, and the V2 AR operations layer. It is the operational companion to the approved docs pack in [CleanMateX_Full_AR_Invoice_Docs_Pack](./CleanMateX_Full_AR_Invoice_Docs_Pack).

Implementation rules:

- all DB work is additive only through new migrations
- migrations are created here but never applied by the assistant
- `org_invoice_mst` remains the canonical AR invoice header
- Business Voucher remains the canonical money-movement source
- every tenant-scoped read/write must enforce `tenant_org_id`
- every phase update must refresh this file and the related feature docs

## Phase Tracker

| Phase | Scope | Status | Notes | Updated |
|---|---|---|---|---|
| 1 | Data assessment and rollout design | Completed | Repo-derived current-state assessment documented in `PHASE_1_DATA_ASSESSMENT.md` and rollout decisions captured | 2026-05-22 |
| 2 | Schema, permissions, and navigation migrations | Completed | User applied `0313`–`0316`; post-apply validation identified a legacy invoice status default mismatch and additive safety migration `0317_ar_invoice_header_defaults_fix.sql` was drafted; follow-up nav seed `0320_ar_invoice_ledger_navigation.sql` added for the dedicated AR ledger route | 2026-05-22 |
| 3 | Constants, types, and validation | Completed | Canonical AR constants, DTO/read-model types, Zod schemas, create idempotency fields, and Prisma schema sync are live in `web-admin` | 2026-05-22 |
| 4 | Service layer | Completed | AR invoice, allocation, adjustment, customer balance, ledger, statement, and aging services now run with tenant context, idempotency storage, audit history, and outbox events | 2026-05-22 |
| 5 | API layer | Completed | `/api/v1/ar/*` routes added with explicit permission checks and Zod validation | 2026-05-22 |
| 6 | UI and access contracts | Completed | Canonical invoice hub, multi-step create wizard, detail action dialogs, print routes, updated navigation, updated access contracts, and EN/AR keys added | 2026-05-22 |
| 7 | Reports, statements, and notifications | Completed | Aging, statements, invoice/statement print payloads, and AR outbox event emission are wired; notification delivery remains downstream-worker territory | 2026-05-22 |
| 8 | Validation and hardening | Completed | `npm run typecheck`, targeted AR tests, `npm run check:i18n`, and `npm run build` passed after the AR rollout | 2026-05-22 |
| 9 | Documentation closure | Completed | Permissions docs, API contracts, UI flow docs, release notes, test matrix, and feature tracker refreshed in-repo | 2026-05-22 |
| 10 | V1.5 cleanup bridge | Completed | Legacy invoice creation, payment allocation, refund, cancel, and checkout settlement paths now bridge into canonical AR artifacts where applicable | 2026-05-22 |
| 11 | V2 AR operations | Completed | Credits, disputes, dunning, and statement-cycle migrations, APIs, UI routes, navigation, access contracts, and docs are implemented | 2026-05-22 |
| 12 | Operational closeout pack | Completed | Production-readiness audit, UAT/runbook, finance cleanup roadmap, and test guide added for rollout and post-release support | 2026-05-22 |

## Current Decisions

| Decision | Chosen Value | Why |
|---|---|---|
| Route strategy | Extend `internal_fin` | Minimizes churn and reuses existing invoice pages/services |
| Overpayment policy | Store as customer credit | Needed for real AR workflows and later allocation |
| Sensitive-doc control | Controlled approval | Standard invoices direct; credit/debit/write-off/void require elevated approval |
| AR aging source | Shared finance read model | Avoids parallel AR calculation logic |
| Invoice numbering | DB sequence function | Replaces count-based issuance for new AR flows |

## Deliverables Checklist

- [x] Phase 1 assessment doc updated
- [x] Cleanup migration created
- [x] Header upgrade migration created
- [x] Supporting AR tables migration created
- [x] Permission seed migration created
- [x] Navigation seed migration created
- [x] AR constants/types/Zod added
- [x] Prisma schema synced to applied AR tables and header fields
- [x] Post-apply default fix migration drafted as `0317_ar_invoice_header_defaults_fix.sql`
- [x] AR services added
- [x] AR API routes added
- [x] AR UI routes/screens added
- [x] Access contracts updated
- [x] Permissions docs updated
- [x] EN/AR messages updated
- [x] Print/export routes and screens added
- [x] Targeted AR validation/service/tenant-isolation tests added
- [x] V2 credits/disputes/dunning/statement-cycle UI routes added
- [x] V2 navigation and contract docs updated
- [x] Legacy invoice and payment flows bridged into canonical AR artifacts
- [x] Production readiness audit added
- [x] UAT and rollout runbook added
- [x] Finance cleanup roadmap added
- [x] Test guide added
- [x] Validation commands green

## 2026-05-29 — BVM Wiring Phase 3 integration

- `createArInvoiceFromOrders` now accepts an optional `tx?: PrismaTx` so callers can join the writer to their own transaction (submit-order does this to commit order header + voucher + AR invoice atomically).
- New input flag `issueImmediately?: boolean` (default `false`):
  - `false` (preserves existing API route DRAFT semantics, no behavior change for `POST /api/v1/ar/invoices/from-orders` callers)
  - `true` (used by submit-order): status derived via `deriveArInvoiceStatus({ currentStatus: OPEN, … })`, `issued_at` + `issued_by` populated atomically, AR ledger `INVOICE_ISSUED` DEBIT appended, `AR_INVOICE_ISSUED` outbox event emitted, status-history `actionCd = 'CREATE_FROM_ORDERS_ISSUED'`
- New input flag `gift_card_applied_amount?: number` mirrored onto `org_invoice_mst.gift_card_applied_amount` for reporting parity with the legacy `createInvoice` adapter.
- `ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction` now fires inside the writer with the same `assertBlockingInvoiceAutoPostSucceeded` gating used by the legacy adapter.
- Test coverage: 5 new cases in `__tests__/services/ar-invoice.service.test.ts` (issueImmediately on/off, gift_card mirror, ERP-lite BLOCKING gate, caller-tx atomic invariant).
- Follow-up tracked in `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md`: extract `assertBlockingInvoiceAutoPostSucceeded` into a shared util once legacy `createInvoice` retires.

## Risks And Watchpoints

- current invoice numbering is count-based in some legacy non-AR services and must remain isolated from the sequence-based AR issuance path
- future changes to AR codes must keep DB strings, constants, Zod enums, and docs aligned
