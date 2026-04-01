---
version: v1.0.0
last_updated: 2026-03-29
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_4_POSTING_ENGINE_EXEC_PKG_2026_03_29
status: Complete
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Phase 4 Posting Engine Execution Package

## 1. Purpose

This document is the implementation-ready package for `Phase 4: Posting Engine`.

It defines:
- exact posting-engine boundary in `cleanmatex`
- exact service responsibilities
- exact dependencies on applied Phase 2 and Phase 3 schema
- exact stop point before Phase 5 auto-post integration

---

## 2. Scope

Phase 4 includes:
- posting-engine service/module structure
- governance package lookup and validation
- deterministic rule resolution
- amount resolution for approved v1 amount sources
- account resolution using tenant mappings and governed resolvers
- journal creation and validation
- posting log write/update behavior
- posting exception write/update behavior
- retry and repost service handling

Phase 4 does not include:
- business-module hooks for invoices, payments, refunds, expenses, or petty cash
- page-level finance reports
- HQ governance authoring UI/backend

---

## 3. Exact Runtime Areas

Must cover:
- normalized posting request handling
- package/rule selection
- amount resolution
- account resolution
- journal build and validation
- commit orchestration
- posting audit persistence
- exception persistence

Must preserve:
- future-safe support for `v1`, `v2`, and `v3` governance packages
- strict idempotency
- strict journal immutability
- strict tenant isolation

---

## 4. Required Inputs

Phase 4 runtime must use only:

- Phase 2 governance tables
  - `sys_fin_gov_pkg_mst`
  - `sys_fin_map_rule_mst`
  - `sys_fin_map_rule_dtl`
  - `sys_fin_usage_code_cd`
  - `sys_fin_resolver_cd`
  - `sys_fin_auto_post_mst`
- Phase 3 tenant tables
  - `org_fin_acct_mst`
  - `org_fin_usage_map_mst`
  - `org_fin_period_mst`
  - `org_fin_journal_mst`
  - `org_fin_journal_dtl`
  - `org_fin_post_log_tr`
  - `org_fin_post_exc_tr`

---

## 5. Posting Engine Service Boundary

Phase 4 should be implemented as one governed runtime module in `cleanmatex`.

Recommended service slices:

1. `posting-request-normalizer`
   - validates minimum runtime payload shape
2. `posting-governance-resolver`
   - loads active published package, active rule, and policy context
3. `posting-amount-resolver`
   - resolves approved amount sources from normalized payload
4. `posting-account-resolver`
   - resolves tenant accounts from usage mappings or governed resolvers
5. `posting-validator`
   - validates journal balance, account validity, period status, and runtime constraints
6. `posting-journal-writer`
   - writes journal master/detail only after validation passes
7. `posting-audit-writer`
   - writes posting logs and exception queue rows
8. `posting-engine-service`
   - orchestrates preview, execute, retry, and repost flows

The implementation may collapse some helpers, but must preserve one single governed execution path.

---

## 6. Core Design Decisions

### 6.1 Execution Modes

Phase 4 must support:
- `preview`
- `execute`
- `retry`
- `repost`

### 6.2 Rule Selection

Rule selection must follow the approved runtime order:
1. active status
2. package applicability
3. event match
4. effective date window
5. exact condition match
6. highest specificity
7. lowest `priority_no`
8. highest `version_no`
9. latest `effective_from`

Any unresolved tie must fail with `AMBIGUOUS_RULE`.

### 6.3 Amount Resolution

Phase 4 must support these v1 amount sources:
- `NET_AMOUNT`
- `TAX_AMOUNT`
- `GROSS_AMOUNT`
- `DISCOUNT_AMOUNT`
- `DELIVERY_FEE_AMOUNT`
- `ROUNDING_AMOUNT`

`CUSTOM_EXPR` should remain unsupported in Phase 4 unless explicitly approved during implementation.

### 6.4 Account Resolution

Phase 4 must support these v1 resolution paths:
- usage-code mapping to tenant account
- `PAYMENT_METHOD_MAP` governed resolver

Future resolution types may exist in the contract, but they are not required to be implemented in Phase 4 unless a v1 rule actually needs them.

### 6.5 Idempotency

Phase 4 must enforce canonical idempotency:

`{tenant_org_id}:{txn_event_code}:{source_doc_id}:{posting_version}`

The engine must never create a second posted journal for the same logical idempotency key.

### 6.6 Retry vs Repost

- `retry` re-attempts the same logical event after transient or technical failure
- `repost` creates a new controlled attempt after remediation

Both must preserve prior attempt history in `org_fin_post_log_tr`.

---

## 7. Suggested Implementation Sequence

1. create module/service skeleton
2. implement request normalizer
3. implement governance resolver
4. implement deterministic rule resolution
5. implement amount resolver
6. implement account resolver
7. implement journal validator
8. implement journal writer
9. implement posting audit/exception writer
10. implement execute flow
11. implement retry/repost flow
12. add unit tests

---

## 8. Expected Deliverables

Code deliverables:
- posting-engine module/services in `cleanmatex`
- runtime helpers/types/constants as needed
- unit tests for critical posting paths

Documentation deliverables:
- update implementation tracker
- update any contract-aligned implementation notes if Phase 4 behavior narrows runtime choices

---

## 9. Stop Point

Phase 4 stops when the governed posting engine works against the applied schema.

Phase 4 does not:
- call the engine from invoice/payment/refund flows
- expose user-triggered operational posting flows
- enable auto-post from business transactions

Those belong to `Phase 5`.
