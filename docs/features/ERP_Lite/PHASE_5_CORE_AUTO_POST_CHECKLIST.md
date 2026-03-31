---
version: v1.0.0
last_updated: 2026-03-29
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_5_CORE_AUTO_POST_CHECKLIST_2026_03_29
status: Draft
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Phase 5 Core Auto-Post Integration Checklist

## 1. Purpose

This document defines the exact checklist for `Phase 5: Core Auto-Post Integration`.

Phase 5 is limited to:
- invoice, payment, and refund integration with the governed posting engine
- runtime enforcement of HQ-governed auto-post policy
- blocking vs non-blocking runtime behavior for approved v1 events
- visible failure handling through posting logs and exception queue
- safe retry and repost entry points for finance recovery

Phase 5 must not:
- introduce new posting logic outside the governed posting engine
- add finance reporting UI
- implement HQ governance authoring UI/backend
- expand into v2 or v3 transaction integrations

---

## 2. Canonical Dependencies

This checklist depends on:

- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [BLOCKING_POLICY_TABLE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/BLOCKING_POLICY_TABLE.md)
- [V1_POSTING_RULES_CATALOG.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_POSTING_RULES_CATALOG.md)
- [PHASE_4_POSTING_ENGINE_CHECKLIST.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_4_POSTING_ENGINE_CHECKLIST.md)
- [PHASE_4_POSTING_ENGINE_EXECUTION_PACKAGE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_4_POSTING_ENGINE_EXECUTION_PACKAGE.md)

---

## 3. Phase 5 Outcome

Phase 5 is complete only when all of the following are true:

- invoice finalization can invoke the governed posting engine
- payment completion can invoke the governed posting engine
- refund completion can invoke the governed posting engine
- runtime consumes HQ-governed auto-post policy without tenant override of core behavior
- blocking events fail visibly and prevent business completion when policy requires it
- non-blocking events remain outside Phase 5 unless explicitly added later
- failures write posting logs and exceptions consistently
- retry and repost can be invoked through controlled service entry points
- no business module hardcodes debit/credit lines or account choices

## 3.1 Current Execution Status

Current status: `Pending`

---

## 4. Integration Checklist

- [ ] freeze invoice integration boundary
- [ ] freeze payment integration boundary
- [ ] freeze refund integration boundary
- [ ] freeze runtime policy-consumption contract
- [ ] freeze blocking-mode enforcement behavior
- [ ] freeze failure-to-exception behavior
- [ ] freeze retry entry behavior
- [ ] freeze repost entry behavior
- [ ] freeze user-facing error/exception response rules

---

## 5. Critical Rules

- [ ] runtime must consume only HQ-governed auto-post policy
- [ ] tenant runtime must not own or override blocking mode for core events
- [ ] invoice, payment, and refund integrations must call the same governed posting-engine service
- [ ] blocking failures must stop business completion
- [ ] silent posting failure is prohibited
- [ ] non-blocking expense and petty-cash flows remain outside Phase 5
- [ ] live transaction handlers must not bypass idempotency protection

---

## 6. Validation Checklist

- [ ] integration tests exist for invoice blocking failure behavior
- [ ] integration tests exist for payment blocking failure behavior
- [ ] integration tests exist for refund blocking failure behavior
- [ ] tests exist for visible exception creation on failed execution
- [ ] tests exist for duplicate logical event protection
- [ ] tests exist for retry and repost service entry behavior
- [ ] tests exist for policy-disabled event handling

---

## 7. Final Readiness Gate

Phase 5 can start safely only when:

- Phase 4 engine boundary is accepted
- the v1 blocking policy remains approved
- this checklist is accepted
- the Phase 5 execution package is accepted
