# Order Financial — Independent Forensic Validation (18 June 2026)

**Reviewer:** Independent multi-disciplinary validation pass (Opus) — architecture, finance/accounting, DB/RLS, payments/BVM, AR/B2B, frontend/UX, QA, compliance.
**Method:** Evidence-first. Codebase + live local database (`supabase_local` MCP, read-only) are the source of truth; docs/ADRs/plans/prior reports treated as references only.
**Constraints honored:** No production code modified, no migrations applied, no destructive SQL, no implementation started. This is validation + reporting only.

---

## Verdict (one line)

🟡 **PARTIALLY VALID — Production-ready after a small set of HIGH fixes.** No **open** runtime blocker: the one prior critical blocker (`SAVE_TO_CUSTOMER_WALLET` audit CHECK) was fixed by migration `0378` and **verified live** (FK present + validated, old CHECK gone, 0 orphans). The core financial engine, real-payment/credit separation, BVM wiring, AR-invoice-wins logic, and submit idempotency are **production-grade**. Remaining gaps are an RLS hole on one fiscal table, AR/B2B allocation idempotency asymmetry, unwired feature-flag kill-switches, and deferred tax-base decomposition.

Full verdict + classification → [00_EXECUTIVE_SUMMARY.md](./00_EXECUTIVE_SUMMARY.md).

---

## Report index

| File | Contents |
|------|----------|
| [00_EXECUTIVE_SUMMARY.md](./00_EXECUTIVE_SUMMARY.md) | Verdict, classification, blocker counts, top findings, final call |
| [03_IMPLEMENTATION_STATUS_DASHBOARD.md](./03_IMPLEMENTATION_STATUS_DASHBOARD.md) | Per-area status table (✅/🟡/🔴/❓) with evidence |
| [05_GAPS_AND_BUGS.md](./05_GAPS_AND_BUGS.md) | **Master findings list** F-01…F-18 (severity, evidence, fix, tests) |
| [06_CRITICAL_BLOCKERS.md](./06_CRITICAL_BLOCKERS.md) | Release blockers (currently: 0 open; 1 resolved this session) |
| [07_DATABASE_FINDINGS.md](./07_DATABASE_FINDINGS.md) | RLS, idempotency indexes, FKs, constraints, catalog drift, backfill previews |
| [08_BACKEND_API_FINDINGS.md](./08_BACKEND_API_FINDINGS.md) | Services, transaction boundaries, idempotency, API routes, permission/flag checks |
| [10_FRONTEND_UX_FINDINGS.md](./10_FRONTEND_UX_FINDINGS.md) | Payment modal, labels, allocation UX, feature-flag UI gating |
| [11_TEST_COVERAGE_FINDINGS.md](./11_TEST_COVERAGE_FINDINGS.md) | Useful vs false-positive tests; missing matrix |
| [14_DOCS_AND_ADR_ALIGNMENT.md](./14_DOCS_AND_ADR_ALIGNMENT.md) | Code-vs-docs alignment (incl. where code is ahead of docs) |
| [15_PRODUCTION_READINESS_CHECKLIST.md](./15_PRODUCTION_READINESS_CHECKLIST.md) | Go/no-go checklist with status + required action |
| [16_RECOMMENDED_IMPLEMENTATION_PLAN.md](./16_RECOMMENDED_IMPLEMENTATION_PLAN.md) | Phased plan + exact migrations + exact tests to add |
| [21_FINAL_RECOMMENDATION.md](./21_FINAL_RECOMMENDATION.md) | Shortest safe path to GA; biggest hidden risk |

### Additional numbered files (completed in the deep-dive re-verify pass)

| File | Contents |
|------|----------|
| [01_SCOPE_INSPECTED.md](./01_SCOPE_INSPECTED.md) | Full inspection scope + commands + explicitly-not-inspected list |
| [02_ARCHITECTURE_MAP.md](./02_ARCHITECTURE_MAP.md) | Actual (code-derived) architecture across all finance subsystems |
| [04_IMPLEMENTED_FEATURES.md](./04_IMPLEMENTED_FEATURES.md) | Per-feature evidence: how it works, tables/files, behavior, risks |
| [09_API_FINDINGS.md](./09_API_FINDINGS.md) | Route-layer findings (CSRF/permission/flag/validation/idempotency) |
| [12_DATA_INTEGRITY_AND_BACKFILL_PREVIEWS.md](./12_DATA_INTEGRITY_AND_BACKFILL_PREVIEWS.md) | Read-only SELECT previews (D-1…D-8) |
| [13_BUSINESS_RULES_DISCOVERED.md](./13_BUSINESS_RULES_DISCOVERED.md) | Rules the code actually enforces (incl. implied/undocumented) |
| [17_FILES_TO_MODIFY.md](./17_FILES_TO_MODIFY.md) | Exact change map per finding |
| [18_MIGRATIONS_NEEDED.md](./18_MIGRATIONS_NEEDED.md) | 0379–0383 specs (additive, approval-gated) |
| [19_TESTS_TO_ADD_OR_REWRITE.md](./19_TESTS_TO_ADD_OR_REWRITE.md) | GA + hardening test matrix |
| [20_OPEN_QUESTIONS.md](./20_OPEN_QUESTIONS.md) | Decisions needed (product/accounting/security) |
| [22_FOLLOWUP_DEEP_DIVE.md](./22_FOLLOWUP_DEEP_DIVE.md) | **Re-verify pass: corrections + confirmations + remaining ❓** |

> **⚠️ Read 22 for corrections.** The deep-dive re-verify pass **corrected a first-pass over-claim**: AR invoice allocation **is** idempotent (via `org_idempotency_keys`); only B2B lacks it. F-02 was revised High→Medium. It also added **F-10** (collect-payment default key not event-unique) and confirmed i18n EN/AR parity passes. The full 21-file skeleton now exists; 03/05/00 reflect the corrected counts.

---

## What was inspected (scope)

**Migrations (read in full or in part):** `0301` (voucher lines), `0337` (payment target / credit lifecycle), `0354`/`0360`/`0368`/`0378` (overpay disposition + FK fix), `0357` (settlement catalogs), plus DB-level inspection of constraints/indexes/RLS for the finance schema. Migration directory spans `0300`–`0377` for finance/order/voucher/AR/B2B/tax/notification.

**Database (live, read-only via MCP):** RLS + policy coverage across **78** finance tables; unique/idempotency index sweep on payment/voucher/wallet/advance/credit-note/cash/invoice/preview tables; constraint definitions on `org_fin_overpay_disp_dtl`, `sys_fin_overpay_res_cd`; column introspection of `org_tax_doc_seq_counters`; catalog completeness of `sys_fin_overpay_res_cd`.

**Backend services (read first-hand):** `order-financial-write.service` (recalc engine), `overpayment-resolution-validator.service`, `overpayment-disposition.service`, `order-submit-orchestrator.service`, wiring handlers (`order-payment`, `invoice-payment`, `statement-payment`, `cash-drawer`), `customer-open-balance-query.service`, `b2b-statement-payment.service`, `ar-invoice.service` (header), `tax-document-sequence.service`, `stored-value.service` (signatures + isolation check).

**API routes:** `submit-order`, `customer-receipts/allocation/post`; route inventory for collect-payment, payments, verify, open-balances, AR allocations, finance reports.

**Frontend:** `extra-receipt-handling-card.tsx`, payment-modal V4 family inventory, summary-card labels in `messages/en.json`.

**Constants/Zod:** `settlement-catalog.ts`, `voucher.ts`, `order-financial.ts`, `customer-receipt-allocation` types/validations.

**Tests:** the `__tests__/services`, `__tests__/constants`, `__tests__/payments`, `__tests__/db` finance suites; mock vs real-DB pattern; `settlement-catalog.test.ts` (rewritten this session).

**Commands/searches used:** `Glob` over finance services/migrations/routes; `Grep` for risk markers, feature-flag literals, financial table usage; `supabase_local` MCP read-only SQL (RLS, indexes, constraints, columns, catalog rows, orphan previews); first-hand `Read` of the files above.

**Explicitly NOT fully verified (need follow-up):** full body of `ar-invoice.service.ts` allocate/reverse idempotency; cash drawer session open/close + reconciliation reports; refund/reversal accounting end-to-end; gateway capture/callback lifecycle; i18n AR parity (`npm run check:i18n` not run); promotions/loyalty engines; mobile/offline POS paths. These are marked **❓ not verified** in the dashboard with what's needed to confirm.
