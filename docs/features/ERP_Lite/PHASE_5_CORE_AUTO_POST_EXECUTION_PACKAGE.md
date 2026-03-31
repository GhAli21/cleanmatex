---
version: v1.0.0
last_updated: 2026-03-30
author: CleanMateX AI Assistant
document_id: ERP_LITE_PHASE_5_CORE_AUTO_POST_EXEC_PKG_2026_03_29
status: Complete
implementation_project: cleanmatex
project_context: Tenant Runtime
---

# ERP-Lite Phase 5 Core Auto-Post Integration Execution Package

## 1. Purpose

This document is the implementation-ready package for `Phase 5: Core Auto-Post Integration`.

It defines:
- exact runtime integration boundary in `cleanmatex`
- exact transaction flows included in v1 Phase 5
- exact auto-post policy consumption behavior
- exact stop point before Phase 6 reports and inquiry screens

---

## 2. Scope

Phase 5 includes:
- invoice integration with the governed posting engine
- payment integration with the governed posting engine
- refund integration with the governed posting engine
- runtime loading and enforcement of approved auto-post policy
- business-flow blocking behavior for blocking v1 events
- failure capture in posting logs and exception queue
- controlled retry and repost service invocation paths

Phase 5 does not include:
- expense and petty-cash runtime integrations
- report UI or report queries
- HQ governance authoring features
- new governance schema work
- v2 or v3 event integrations

---

## 3. Exact Runtime Areas

Must cover:
- source transaction to posting-request mapping
- transaction event code selection
- policy lookup and enforcement
- posting-engine invocation
- blocking failure propagation
- success/failure audit linkage back to source transaction

Must preserve:
- strict tenant isolation
- strict single governed posting path
- strict idempotency
- strict visibility of failures

---

## 4. Required Inputs

Phase 5 runtime must use only:

- Phase 2 governance tables
  - `sys_fin_gov_pkg_mst`
  - `sys_fin_map_rule_mst`
  - `sys_fin_map_rule_dtl`
  - `sys_fin_auto_post_mst`
- Phase 3 tenant runtime tables
  - `org_fin_acct_mst`
  - `org_fin_usage_map_mst`
  - `org_fin_period_mst`
  - `org_fin_journal_mst`
  - `org_fin_journal_dtl`
  - `org_fin_post_log_tr`
  - `org_fin_post_exc_tr`
- existing operational source modules in `cleanmatex`
  - invoice/finalization flow
  - payment completion flow
  - refund completion flow

---

## 5. Included V1 Events

Phase 5 must support these v1 core events:

- `ORDER_INVOICED`
- `ORDER_SETTLED_CASH`
- `ORDER_SETTLED_CARD`
- `ORDER_SETTLED_WALLET`
- `PAYMENT_RECEIVED`
- `REFUND_ISSUED`

Phase 5 must not yet integrate:

- `EXPENSE_RECORDED`
- `PETTY_CASH_TOPUP`
- `PETTY_CASH_SPENT`

Those remain for later runtime phases even though they already exist in the v1 event catalog and blocking policy.

---

## 6. Auto-Post Policy Consumption

### 6.1 Ownership Rule

Phase 5 must treat auto-post runtime behavior as HQ-governed.

`cleanmatex` may:
- read the active policy
- enforce the active policy
- surface the policy result in runtime behavior

`cleanmatex` must not:
- allow tenant users to redefine blocking mode for core events
- override required success rules for core events
- bypass policy because a business flow is already near completion

### 6.2 Required Policy Fields

Phase 5 must consume:
- `is_enabled`
- `blocking_mode`
- `required_success`
- `retry_allowed`
- `repost_allowed`
- `failure_action`
- package/policy version context

### 6.3 V1 Runtime Defaults

Until HQ governance UI exists, Phase 5 must still enforce the applied v1 policy data and the approved table in [BLOCKING_POLICY_TABLE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/BLOCKING_POLICY_TABLE.md).

---

## 7. Recommended Integration Sequence

1. add thin runtime adapter for invoice event mapping
2. add thin runtime adapter for payment event mapping
3. add thin runtime adapter for refund event mapping
4. add shared policy lookup helper
5. add blocking failure propagation helpers
6. add integration tests per included event class
7. add controlled retry/repost invocation surface

Phase 5 should prefer thin integration wrappers around the Phase 4 engine, not duplicate orchestration inside source modules.

---

## 8. Expected Deliverables

Code deliverables:
- transaction-to-posting adapter helpers in `cleanmatex`
- policy-consumption helper(s)
- invoice/payment/refund integration points
- targeted tests for blocking and failure behavior

Current implementation note:
- single-invoice invoice creation is integrated
- on-demand invoice creation during payment is integrated
- direct payment completion is integrated
- distributed multi-invoice payment completion is integrated
- refund completion is integrated
- all of the above now use the transaction-aware governed posting path

Documentation deliverables:
- update implementation tracker
- update permission/API documentation if new internal invocation routes or actions are added
- record any narrowed runtime assumptions discovered during integration

---

## 9. Stop Point

Phase 5 stop point reached:

- invoice, payment, and refund flows trigger governed auto-post behavior correctly
- blocking v1 events fail safely inside transaction boundaries
- distributed multi-invoice payment no longer bypasses finance posting

Phase 5 does not:
- introduce reports
- introduce expense/petty-cash integration
- introduce manual finance UI actions for end users
- broaden into v2/v3 treasury or procurement work
