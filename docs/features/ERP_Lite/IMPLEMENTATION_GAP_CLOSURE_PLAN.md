---
version: v1.0.0
last_updated: 2026-03-27
author: CleanMateX AI Assistant
document_id: ERP_LITE_IMPLEMENTATION_GAP_CLOSURE_PLAN_2026_03_27
status: Approved
approved_date: 2026-03-28
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Implementation Gap Closure Plan

## 1. Purpose

This document converts the approved ERP-Lite direction into an execution plan for AI-assisted delivery.

It is based on:

- [validated scope](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md)
- [gap analysis](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/GAP_ANALYSIS_REPORT.md)
- [implementation requirements](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/implementation_requirements.md)

This is not a traditional high-level roadmap only. It is an execution-oriented plan designed for:

- small, reviewable deliveries
- AI-assisted implementation
- strict validation gates
- finance-safe sequencing

---

## 1.1 Canonical Dependencies

This plan must be read together with the canonical approval pack:

- [V1_0_APPROVAL_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_0_APPROVAL_PACK.md)
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

No execution step in this plan should contradict those documents.

---

## 2. Planning Assumptions

### Approved Scope Baseline

The current approved direction is:

- `v1`: accounting backbone + receivables reporting + basic expenses + basic petty cash
- `v2`: bank + supplier/payables/procurement
- `v3`: advanced expenses + advanced petty cash controls + branch profitability + laundry-specific costing

### Repo Reality

CleanMateX already has reusable operational foundations:

- customers and B2B entities
- invoices and payments
- refunds and vouchers
- cash-up reconciliation
- branch-aware inventory
- branch-aware operations
- operational reporting

ERP-Lite-specific foundations still need to be built.

### Delivery Model

This plan assumes heavy AI assistance for:

- documentation
- CRUD scaffolding
- route scaffolding
- UI composition
- report scaffolding
- test scaffolding

But it assumes human review remains mandatory for:

- accounting design
- posting rules
- migration design
- period controls
- reversal logic
- financial report correctness

---

## 3. Delivery Strategy

### Core Principle

Do not build ERP-Lite as one feature branch with many moving parts.

Build it as a sequence of narrow, finance-safe increments where each increment has:

- a small scope
- a clear validation target
- a review gate
- minimal cross-cutting risk

### Required Build Order

1. Platform wiring
2. Finance schema foundation
3. Posting engine
4. Auto-post integrations
5. Finance inquiry and reports
6. Basic expenses and basic petty cash
7. Phase 2 and Phase 3 expansions

### Why This Order

- platform wiring enables gated rollout
- schema before logic reduces churn
- posting before reports reduces report duplication
- reports before advanced procurement improves time-to-value
- basic expenses and petty cash can ride on GL instead of inventing a parallel model

---

## 4. AI-Assisted Delivery Rules

### 4.1 What AI Should Be Used For

AI is suitable for:

- implementation planning
- repetitive CRUD scaffolding
- API route scaffolding
- admin page scaffolding
- DTO/type/schema generation
- report query scaffolding
- test file scaffolding
- documentation and permissions matrices

### 4.2 What AI Must Not Be Trusted On Without Review

Human review is mandatory for:

- debit/credit mapping rules
- reversal and void logic
- branch allocation logic
- financial statement formulas
- migration safety
- tenant isolation correctness
- expense posting behavior
- locking/period-close behavior

### 4.3 AI-Safe Delivery Pattern

Each finance submodule should be delivered in this order:

1. schema and type design
2. service contract definition
3. write path
4. read path
5. UI
6. tests
7. review against accounting rules

---

## 4.4 No-Coding-Before Gates

Do not begin implementation work for a phase until its required approval inputs are explicitly accepted.

- No Phase 0 platform wiring before the approval checklist and operational freeze items are accepted
- No finance schema work before finance core rules and runtime domain contract are accepted
- No posting engine work before posting, idempotency, reversal, and exception rules are accepted
- No runtime governance consumption work before the governance publication contract is accepted
- No finance reporting work before report source-of-truth rules are accepted

---

## 5. Phase Map

| Phase | Goal | Outcome | Current Status |
|---|---|---|---|
| Phase 0 | Decision freeze and approval | Canonical ERP-Lite direction, governance, and runtime control model are approved | Complete |
| Phase 1 | Platform enablement | ERP-Lite can be gated, navigated, permissioned, and configured | Complete |
| Phase 2 | HQ governance foundation | Phase 2A DB foundation is complete; Phase 2B HQ app layer remains pending in `cleanmatexsaas` | Complete |
| Phase 3 | Tenant finance schema | COA, GL, periods/settings, constants/types exist | Complete |
| Phase 4 | Posting engine | Balanced and idempotent journal batches can be created | Not Started |
| Phase 5 | Core auto-post integration | Invoices, payments, refunds create GL entries | Not Started |
| Phase 6 | V1 finance inquiry and reports | GL inquiry, trial balance, P&L, balance sheet, AR aging | Not Started |
| Phase 7 | Basic expenses and petty cash | simple expense entry, petty cash entry/top-up, posting, listing | Not Started |
| Phase 8 | V1 pilot and hardening | v1 is validated with controlled tenant scenarios | Not Started |
| Phase 9 | V2 treasury + suppliers + AP/PO | treasury and procurement layers | Not Started |
| Phase 10 | V3 advanced controls + profitability + costing | differentiator phase | Not Started |

---

## 5.1 Cross-Project Dependency Markers

Use the following dependency markers for every task and phase:

- `HQ-first` = governance or platform publication work must be approved first in `cleanmatexsaas`
- `Runtime-first` = tenant runtime can proceed independently in `cleanmatex`
- `Parallel` = both projects can progress in parallel after shared approval
- `Review-blocked` = work may be drafted but must pause pending approval/review

---

## 6. Phase 1: Platform Enablement

### Objective

Create the platform shell so ERP-Lite can exist safely as an optional add-on.

### Canonical prerequisites

- Cross-project PRD approved
- ADR-001 to ADR-004 approved
- Finance core rules approved
- Runtime domain contract approved
- Governance publication contract approved
- Phase 0 approval checklist approved

### Dependency marker

`Parallel`

### Deliverables

- ERP-Lite feature flags
- ERP-Lite permissions
- ERP-Lite navigation entries
- ERP-Lite settings
- ERP-Lite i18n namespace
- `/dashboard/erp-lite` shell route
- empty child route placeholders where appropriate
- HQ-governed auto-post runtime policy model

### Database / Platform Changes

- migration for feature flags
- migration for permissions
- migration for `sys_components_cd`
- migration for tenant settings category and keys

### App Changes

- feature flag constants/types
- settings constants/types
- route guards
- nav visibility logic
- runtime contract for enforcing HQ-governed auto-post policy

### Validation

- permissions seed visible in platform data
- navigation appears only when flags and permission allow
- all ERP-Lite routes hidden/blocked correctly when disabled
- `npm run build` succeeds

### Human Review Gate

### Current Status

Phase 1 is complete in `cleanmatex`:

- Phase 1 migrations `0175` through `0178` were created and applied
- ERP-Lite shell routes and navigation are in place
- feature flag and permission consumption is wired
- runtime route/layout guards are implemented
- EN/AR shell and access-state i18n is in place

Remaining validation note:
- Node-based frontend validation is environment-blocked on the current machine (`WSL 1 is not supported`)

Review before Phase 2:

- flag naming
- permission naming
- navigation hierarchy
- settings semantics
- auto-post policy ownership and publishing semantics

### Exit Criteria

- flags, permissions, settings, and navigation are frozen
- route shells are approved
- no finance logic has been implemented prematurely
- HQ/platform ownership of auto-post policy remains explicit

---

## 7. Phase 2: HQ Governance Foundation

### Objective

Define the publishable HQ-governed accounting layer that tenant runtime will consume.

### Canonical prerequisites

- Phase 1 exit criteria met
- ADR-001 to ADR-003 approved
- governance publication contract approved

### Dependency marker

`HQ-first`

### In Scope

- account type master governance
- posting rule governance model
- rule versioning/publication model
- HQ auto-post runtime policy model
- governance package publication readiness

### Validation

- governance ownership remains platform-level
- tenant runtime consumption assumptions are explicit
- no tenant-owned override model is introduced accidentally

### Human Review Gate

Review before Phase 3:

- account type governance boundaries
- publishing/versioning model
- HQ auto-post policy ownership
- tenant consumption constraints

### Exit Criteria

- governance package model is defined
- HQ policy ownership is explicit
- tenant schema work can start without governance ambiguity

---

## 8. Phase 3: Tenant Finance Schema Foundation

### Objective

Create the minimum persistent accounting model for v1.

### Canonical prerequisites

- Phase 2 exit criteria met
- runtime domain contract approved
- finance core rules approved

### Dependency marker

`Review-blocked`

### In Scope

- `org_fin_chart_of_accounts_mst`
- `org_fin_gl_batches_mst` if batch header is used
- `org_fin_gl_entries_tr`
- yes do it optional period/fiscal metadata tables if needed for clean design , yes do it 
- `web-admin/lib/constants/erp-lite.ts`
- `web-admin/lib/types/erp-lite.ts`
- Zod schemas for finance inputs

### Required Design Decisions

- account type model
- account code uniqueness per tenant
- branch field behavior on GL entries
- source reference model
- batch vs line-only design
- reversal strategy
- soft-delete rules for accounts

### Validation

- migrations created only, not applied by agent
- RLS policies present
- indexes present
- Prisma/schema alignment prepared if applicable
- types compile

### Human Review Gate

Mandatory review of:

- schema names
- object naming lengths
- FK patterns
- period handling model
- reversal fields

### Exit Criteria

- finance schema package is drafted
- runtime entities align with runtime domain contract
- no migration is applied by the agent
- schema is ready for user review and later application

---

## 9. Phase 4: Posting Engine

### Objective

Create the governed posting engine that resolves approved rules into balanced journals.

### Canonical prerequisites

- Phase 3 exit criteria met
- ADR-002 approved
- finance core rules approved
- runtime domain contract approved
- governance publication contract approved

### Dependency marker

`HQ-first`

### Deliverables

- governed posting engine service contract
- deterministic rule resolution behavior
- balanced journal creation path
- posting log behavior
- idempotency enforcement path
- controlled failure and exception creation path

### Validation

- posting for approved test scenarios balances
- duplicate logical posting does not create duplicate journal effect
- no-rule and ambiguous-rule fail safely
- posting logs and exceptions are auditable

### Human Review Gate

Review before Phase 5:

- rule determinism
- duplicate prevention
- journal immutability behavior
- reversal readiness
- governance package consumption assumptions

### Exit Criteria

- governed posting path exists as one canonical runtime path
- deterministic failure behavior is defined and validated
- posting outputs are traceable to governance package and rule version

---

## 10. Phase 5: Auto-Post Core Flows

### Objective

Connect invoices, payments, and refunds to the governed posting path.

### Canonical prerequisites

- Phase 4 exit criteria met
- ADR-003 approved
- published auto-post policy model approved

### Dependency marker

`HQ-first`

### Deliverables

- invoice auto-post integration
- payment auto-post integration
- refund auto-post integration
- policy enforcement for blocking/non-blocking behavior
- visible runtime exception flow

### Validation

- invoice, payment, and refund behavior follows policy
- blocking flows do not silently succeed on posting failure
- non-blocking failures create visible finance exceptions

### Exit Criteria

- core auto-post sources are live in controlled form
- retry/repost behavior is auditable
- runtime does not redefine HQ policy

---

## 11. Phase 6: Finance Inquiry and Reports

### Objective

Provide finance-safe inquiry and v1 reports based on approved source-of-truth rules.

### Canonical prerequisites

- Phase 5 exit criteria met
- report source-of-truth rules approved in finance core rules and runtime contract

### Dependency marker

`Runtime-first`

### Deliverables

- GL inquiry
- trial balance
- P&L
- balance sheet
- AR aging

### Validation

- reports reconcile to approved posted journal truth
- AR aging follows approved finance-controlled logic
- tax visibility aligns with approved VAT/tax model

### Exit Criteria

- v1 reports are aligned with source-of-truth rules
- no report depends on uncontrolled operational-only calculations

---

## 12. Phase 7: Basic Expenses and Basic Petty Cash

### Objective

Add basic expense and petty cash behavior on top of the approved GL foundation.

### Canonical prerequisites

- Phase 6 exit criteria met
- v1 scope approval includes basic expenses and basic petty cash

### Dependency marker

`Runtime-first`

### Deliverables

- basic expense entry flow
- petty cash expense flow
- petty cash top-up flow
- posting behavior for these flows
- simple inquiry/listing views

### Validation

- expense and petty cash effects post through governed logic
- cash and petty cash balances remain traceable
- exceptions remain visible and auditable

### Exit Criteria

- v1 finance scope is complete at runtime level
- no parallel shadow accounting model exists outside GL

---

## 9. Phase 4: Posting Engine

### Objective

Create finance services that generate balanced, idempotent GL entries.

### In Scope

- `createGlEntriesForInvoice()`
- `createGlEntriesForPayment()`
- `createGlEntriesForRefund()`
- idempotency checks by source reference
- debit=credit validation
- batch creation and reversal support

### Required Rules

- invoice: DR AR, CR revenue, CR VAT if applicable
- payment: DR cash/bank, CR AR
- refund/reversal: reverse prior effect or apply configured refund rule

### Implementation Notes

- posting logic lives in service layer only
- no posting logic inside UI
- no duplicated posting formulas in report layer

### Validation

- targeted unit tests for each posting function
- edge cases:
  - partial payment
  - overpayment handling rules
  - refund after payment
  - invoice with tax
- idempotency verified

### Human Review Gate

Mandatory review of accounting mappings before auto-post is enabled.

---

## 10. Phase 5: Auto-Post Core Flows

### Objective

Attach the posting engine to existing transactional flows.

### Integration Points

- invoice creation/update finalization
- payment completion
- refund processing

### Scope

- HQ-policy-aware auto-post behavior
- safe error behavior
- no double-posting
- audit visibility from transaction to GL batch

### Key Decision

If posting fails, the plan must define whether:

- business transaction is blocked
- or transaction succeeds and posting enters exception state

Recommended initial rule:

- for v1, do not silently swallow posting failures
- finance-critical posting must either complete or raise a visible exception path
- runtime behavior must be enforced from HQ/platform policy, not ad hoc tenant-side configuration

### Validation

- create invoice -> GL exists
- create payment -> GL exists
- refund payment -> reversing GL exists
- transaction references resolve correctly

### Human Review Gate

Review actual end-to-end journal results from sample tenant scenarios before Phase 6.
Review HQ-governed auto-post policy before runtime activation.

---

## 11. Phase 6: Finance Inquiry and Reports

### Objective

Expose finance outputs that make ERP-Lite valuable to owners and finance users.

### In Scope

- COA management UI
- GL inquiry UI
- trial balance
- profit and loss
- balance sheet
- AR aging

### Reuse Opportunities

- existing reports page patterns or develop new reports page patterns for best
- existing KPI card/report table/chart components
- existing tenant auth and filter conventions

### Required Report Rules

- reports should read from accounting structures where relevant
- AR aging can read from invoice/customer operational sources if intentionally designed, but must stay consistent with GL assumptions
- filters must include date range and branch where relevant

### Validation

- report totals reconcile with sample postings
- balances match known invoice/payment scenarios
- branch filters behave predictably
- bilingual labels render correctly

### Human Review Gate

Finance review required for:

- trial balance totals
- P&L structure
- balance sheet grouping
- AR bucket logic

---

## 12. Phase 7: Basic Expenses and Basic Petty Cash

### Objective

Add simple expense capture and basic petty cash handling without waiting for full advanced workflows.

### In Scope

- expense category
- branch assignment
- amount
- date
- notes
- pay-from account or payment source as designed
- petty cash source/cashbox selection where applicable
- petty cash top-up entry
- basic petty cash running balance
- posting to expense and cash/bank/payable account
- expense list and basic filters

### Explicitly Out of Scope in This Phase

- approvals
- reimbursements
- claim workflow
- attachments-heavy process
- policy engine
- advanced allocations
- petty cash custodian assignment workflow
- petty cash count sheet workflow
- petty cash reconciliation workflow
- inter-branch petty cash controls

### Design Goal

Basic expenses should feel like a finance control entry, not a full HR expense claim module.
Basic petty cash should feel like lightweight operational treasury control, not a full treasury suite.

### Validation

- expense creates balanced journal entries
- petty cash top-up creates balanced journal entries
- petty cash expenses reduce available petty cash balance correctly
- branch-scoped expense reporting works where intended
- list/detail works
- permissions gate create/view correctly

### Human Review Gate

Review:

- expense account mapping defaults
- branch behavior
- posting rules for immediate cash vs payable-style treatment
- petty cash account/cashbox behavior

---

## 13. Phase 9: V2 Treasury, Suppliers, AP, PO

### Objective

Expand ERP-Lite from receivables/accounting core into treasury and procurement control.

### Phase 9A: Bank Reconciliation

Deliverables:

- bank accounts
- bank transaction import
- matching workflow
- reconciliation status model
- reconciliation UI

### Phase 9B: Supplier Master

Deliverables:

- supplier master
- payment terms
- branch/vendor references as needed

### Phase 9C: Purchase Orders

Deliverables:

- PO master/detail
- status lifecycle
- receiving linkage
- inventory impact integration where approved

### Phase 9D: Accounts Payable

Deliverables:

- supplier invoices
- AP payments
- AP aging
- GL posting

### Validation

- PO and AP flows reconcile with stock and GL rules
- bank recon matching behaves correctly for common scenarios

### Human Review Gate

Mandatory review of:

- supplier invoice posting logic
- GRN/PO/AP relationships
- bank reconciliation semantics

---

## 14. Phase 10: V3 Advanced Expenses, Petty Cash, Branch P&L, Costing

### Objective

Build the laundry-specific differentiators after the accounting base is stable.

### In Scope

- advanced expense approvals
- petty cash custodian controls
- petty cash reconciliation and audit workflow
- petty cash exception review
- branch allocation rules
- branch P&L
- laundry-specific cost allocation
- customer or service profitability if approved

### Guardrail

Do not release branch P&L as “profitability” until cost logic is credible.

### Validation

- revenue and expense allocations reconcile
- branch P&L totals tie back to finance totals
- cost model assumptions documented

---

## 15. Micro-Delivery Backlog Structure

Every phase should be split into tickets or implementation slices using this template:

1. `schema`
- migration only
- no UI yet

2. `types_and_validation`
- TS types
- constants
- Zod schemas

3. `service_write_path`
- create/update/post logic

4. `service_read_path`
- list/detail/report queries

5. `api_surface`
- routes/actions

6. `ui_shell`
- pages/tables/forms

7. `tests_and_docs`
- targeted tests
- implementation docs updated

This reduces AI drift and makes review easier.

---

## 16. Validation Strategy

### Required Validation Order

1. format
2. lint
3. typecheck
4. targeted tests
5. build

### Additional Finance Validation

For finance-related deliveries, also require:

- journal sample review
- tenant isolation review
- branch behavior review
- reversal behavior review
- report reconciliation check

### Minimum Test Categories

- unit tests for posting functions
- integration tests for auto-post triggers
- regression tests for invoice/payment flows
- report correctness tests for known scenarios

---

## 17. Human Approval Gates

These are mandatory stop points.

### Gate 1: After Platform Wiring

Approve:

- flags
- permissions
- navigation
- settings

### Gate 2: After Finance Schema

Approve:

- COA model
- GL model
- reversal structure

### Gate 3: After Posting Engine

Approve:

- accounting rules
- sample journals
- idempotency behavior

### Gate 4: After Core Reports

Approve:

- trial balance
- P&L
- balance sheet
- AR aging

### Gate 5: After Basic Expenses

Approve:

- expense posting rules
- branch handling
- role permissions
- petty cash behavior and control boundaries

---

## 18. Suggested File and Module Targets

### Likely New Documentation

- `docs/features/ERP_Lite/IMPLEMENTATION_STATUS.md`
- `docs/features/ERP_Lite/API.md`
- `docs/features/ERP_Lite/TEST_PLAN.md`
- all documentations required in the project documentation rules

### Likely New Code Areas

- `web-admin/lib/constants/erp-lite.ts`
- `web-admin/lib/types/erp-lite.ts`
- `web-admin/lib/validations/erp-lite-*.ts`
- `web-admin/lib/services/erp-lite/`
- `web-admin/app/api/v1/erp-lite/`
- `web-admin/app/dashboard/erp-lite/`
- `web-admin/src/features/erp-lite/`

### Likely Migration Families

- feature flags
- permissions + navigation
- settings
- COA/GL schema
- expenses schema
- phase 2 bank/AP/PO schema

---

## 19. Estimated Sequence

### Phase 0

- 1 to 2 weeks

### Phase 2 to Phase 7

- 8 to 12 weeks total with AI-assisted delivery and disciplined review

### Phase 9

- 6 to 10 weeks

### Phase 10

- 6 to 10 weeks

These are planning estimates only and depend heavily on review speed and how much accounting behavior changes during implementation.

---

## 20. Recommended Immediate Next Actions

1. Approve this plan and the validated scope together
2. Execute the Phase 1 platform enablement checklist
3. Define the v1 accounting mappings explicitly before coding
4. Start Phase 2 HQ governance foundations before creating Phase 3 schema migrations
5. Do not begin reports before posting engine design is approved

---

## 21. Final Execution Recommendation

Proceed with ERP-Lite using an AI-assisted, phased delivery model.

The safest and most effective sequence is:

- platform shell first
- accounting foundation second
- auto-posting third
- reports fourth
- basic expenses fifth
- treasury/procurement later
- profitability last

That sequence matches the actual repo state, minimizes rework, and gives CleanMateX the fastest path to a credible ERP-Lite release.
