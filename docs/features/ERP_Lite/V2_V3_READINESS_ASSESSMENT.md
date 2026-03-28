---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_V2_V3_READINESS_ASSESSMENT_2026_03_28
status: Approved
approved_date: 2026-03-28
---

# ERP-Lite v2 and v3 Readiness Assessment

## 1. Purpose

This document defines what must already exist, what can be reused from v1, and what must be added before implementation of ERP-Lite `v2` and `v3`.

It is intended to prevent:

- v1 design decisions that block future phases
- schema dead-ends
- missing governance foundations
- report/reconciliation drift
- AI-assisted implementation based on incomplete assumptions

---

## 2. Scope Summary

### v2 Scope

- bank reconciliation
- supplier master
- accounts payable
- purchase orders

### v3 Scope

- advanced expenses
- advanced petty cash controls
- branch profitability
- laundry-specific costing

---

## 3. Reuse Expected from v1

Both v2 and v3 are expected to build on the v1 foundation.

The following v1 capabilities should be treated as prerequisites:

- governed account type model
- published governance package model
- tenant chart of accounts
- posted journal model
- posting log and exception model
- auto-post policy framework
- accounting period controls
- finance report source-of-truth rules
- basic expenses and basic petty cash foundations

If any of the above remain weak or unstable, later-phase implementation risk increases significantly.

---

## 4. v2 Readiness Assessment

## 4.1 Business Readiness

Before starting v2, the following should be clear:

- supplier lifecycle expectations
- whether AP is invoice-first or PO-first by default
- whether bank reconciliation is manual-first, import-first, or hybrid in v1 of v2
- whether purchase orders are approval-driven from day one or intentionally lightweight

## 4.2 Database Requirements for v2

Expected major object families:

- supplier master
- supplier contacts if required
- AP invoice header
- AP invoice lines
- AP payment header
- AP payment allocation records
- purchase order header
- purchase order lines
- goods-receipt linkage if introduced later
- bank account master
- bank statement import header
- bank statement lines
- reconciliation match records

Key design considerations:

- all tenant runtime tables must remain tenant-scoped
- supplier/AP control accounts must align with governed account types
- AP documents must keep source references suitable for GL traceability
- bank statement lines must preserve import auditability and raw-source traceability
- reconciliation matches must be reversible and auditable

## 4.3 Runtime and Service Requirements for v2

Expected service areas:

- supplier management
- AP invoice lifecycle
- AP payment lifecycle
- PO lifecycle
- bank import and statement parsing
- matching/reconciliation engine
- AP aging and inquiry

Dependencies on v1 runtime:

- posting engine must already support extension to AP and bank-related event types
- exception handling must support new finance event families
- governance package model must support new event catalog entries and mappings

## 4.4 Governance Requirements for v2

Before starting v2, HQ governance should be able to publish:

- AP-related transaction event codes
- supplier/AP usage codes
- bank-related usage codes
- PO/AP posting rule packages
- v2 auto-post policy extensions if applicable

Strong recommendation:

- do not implement v2 event families ad hoc inside runtime first
- extend HQ governance artifacts before runtime coding starts

## 4.5 Reporting Requirements for v2

Expected finance outputs:

- AP aging
- supplier ledger inquiry
- bank reconciliation status views
- PO/AP operational-finance visibility

These should remain consistent with v1 source-of-truth rules:

- GL-backed financial reports remain GL-driven
- reconciliation reporting may include controlled operational match data
- AP aging should reconcile to control-account behavior

## 4.6 Infrastructure and Operational Requirements for v2

Expected non-schema needs:

- import handling rules for bank statements
- file validation and audit rules for imports
- retry/error handling for parsing failures
- permission model for reconciliation and AP actions
- feature-flag expansion for v2 modules

If file import is involved, define early:

- supported file types
- duplicate import prevention
- import audit trail
- rollback/rematch behavior

## 4.7 v2 Missing Decision Artifacts

Before v2 implementation starts, create:

- `V2_SCOPE_AND_DECISION_PACK.md`
- ADR: Supplier and AP governance model
- ADR: Bank reconciliation model
- ADR: Purchase order to AP flow and posting boundaries
- runtime contract extension for AP and bank reconciliation

## 4.8 v2 Start Gate

Do not start v2 implementation until:

- v1 runtime is trusted in pilot
- AP and bank event families are defined
- v2 governance artifacts are approved
- v2 schema model is reviewed
- reconciliation truth model is explicitly approved

---

## 5. v3 Readiness Assessment

## 5.1 Business Readiness

Before starting v3, the following must be explicitly decided:

- branch profitability grain
- costing grain
  - per order
  - per service
  - per branch
  - per customer
- allocation basis for labor, delivery, utilities, and overhead
- whether branch P&L is operational profitability, finance profitability, or both

Without these decisions, v3 reporting will become arbitrary.

## 5.2 Database Requirements for v3

Expected object families:

- advanced expense workflow entities
- petty cash custodian/control entities
- branch allocation rules
- profitability fact or summary objects
- costing configuration objects
- allocation basis definitions
- cost component mappings

Key design considerations:

- avoid embedding costing logic directly in report queries only
- preserve traceability from profitability output back to posted finance data and controlled allocation rules
- support branch dimension consistently across runtime and reporting objects

## 5.3 Runtime and Service Requirements for v3

Expected service areas:

- advanced expense approval flow
- petty cash review/reconciliation flow
- branch allocation engine
- profitability calculation service
- costing calculation service

Dependencies on v1 and v2:

- stable posted finance truth
- stable expense and petty cash foundation
- stable branch dimension usage
- stable AP/PO and treasury behavior if those costs affect profitability

## 5.4 Governance Requirements for v3

Before starting v3, HQ governance should be able to define or approve:

- allowed cost component categories
- approved allocation methods
- profitability reporting structure
- advanced expense workflow policy if standardized across tenants

Not everything in v3 must be HQ-hardcoded, but the governance boundary must be clear.

## 5.5 Reporting Requirements for v3

Expected outputs:

- branch P&L
- customer profitability if approved later
- service profitability if approved later
- cost composition views
- petty cash control visibility

Critical rule:

- profitability outputs must always distinguish posted finance truth from derived allocation logic

## 5.6 Infrastructure and Operational Requirements for v3

Expected non-schema needs:

- background recalculation strategy if profitability is expensive to compute
- clear re-run logic for costing calculations after configuration changes
- versioned allocation assumptions
- stronger auditability for advanced expense and petty cash controls

If calculation jobs become heavy, decide early whether you need:

- synchronous calculation
- queued recalculation
- materialized summary strategy

## 5.7 v3 Missing Decision Artifacts

Before v3 implementation starts, create:

- `V3_SCOPE_AND_DECISION_PACK.md`
- ADR: Branch profitability source-of-truth model
- ADR: Laundry-specific costing model
- ADR: Advanced petty cash control model
- runtime/reporting contract extension for profitability and costing

## 5.8 v3 Start Gate

Do not start v3 implementation until:

- v2 finance base is stable
- branch and cost dimensions are approved
- profitability truth model is approved
- costing and allocation assumptions are approved
- recalculation strategy is approved

---

## 6. Cross-Phase Design Guidance

To keep v1 compatible with v2 and v3, current implementation should preserve room for:

- new transaction event families
- new usage codes
- additional subledgers
- bank and supplier dimensions
- branch dimension on relevant runtime objects
- allocation or costing reference fields where appropriate

This does not mean overbuilding v1.

It means:

- avoid naming that assumes only AR exists
- avoid hardcoding customer-only ledger logic if AP is coming
- avoid report models that cannot expand to supplier or branch dimensions
- avoid petty cash design that cannot grow into custodian-based controls later

---

## 7. Infrastructure Checklist by Phase

| Area | v1 | v2 | v3 |
|---|---|---|---|
| Governance publication model | required | extend | extend |
| Event catalog | required | extend | extend if needed |
| Tenant COA and GL | required | reuse | reuse |
| Posting engine | required | extend | reuse/extend |
| Exception queue | required | extend | extend |
| Accounting periods | required | reuse | reuse |
| Import infrastructure | optional | required for bank import | optional |
| Supplier/AP subledger | not required | required | reuse |
| Branch profitability infrastructure | not required | optional prep only | required |
| Costing/allocation engine | not required | not required | required |
| Background job strategy | optional | optional | likely required |

---

## 8. Recommended Next-Step Strategy

Recommended sequence:

1. finalize and approve v1 canonical pack
2. implement v1 without blocking future event or subledger extension
3. before starting v2, create v2 decision pack and ADRs
4. before starting v3, create v3 decision pack and ADRs

This is the safest way to preserve both delivery speed and architecture quality.
