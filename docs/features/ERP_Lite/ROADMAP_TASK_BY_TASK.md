---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_ROADMAP_TASK_BY_TASK_2026_03_28
status: Approved
approved_date: 2026-03-28
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Roadmap Task by Task

## 1. Purpose

This document translates the ERP-Lite roadmap into a task-by-task execution plan suitable for AI-assisted delivery.

It defines for each phase:

- tasks
- expected inputs
- expected outputs
- responsibility
- short implementation guideline
- AI usage guidance
- acceptance criteria

This document should be used together with:

- [V1_0_APPROVAL_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_0_APPROVAL_PACK.md)
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)
- [ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md)

---

## 2. Responsibility Model

### Roles

#### Product Owner / Final Approver

Usually you.

Responsible for:

- scope approval
- accounting policy approval
- migration approval
- go/no-go decisions

#### Developer / Implementer

Responsible for:

- final code implementation
- migration drafting
- validation execution
- defect fixing

#### AI Assistant

Responsible for:

- task decomposition
- draft docs
- code scaffolding
- API and UI scaffolding
- test scaffolding
- review support

#### Finance Reviewer

If available, reviews:

- journal semantics
- tax/VAT behavior
- report correctness
- exception/repost behavior

---

## 3. AI Usage Rules

### Use AI For

- documentation drafting
- implementation plans
- schema draft suggestions
- CRUD/API scaffolding
- UI scaffolding
- report scaffolding
- test scaffolding
- code review checklists

### Do Not Trust AI Without Review For

- debit/credit semantics
- tax logic
- posting failure behavior
- reconciliation behavior
- migration safety
- branch profitability formulas
- cost allocation formulas

### Standard AI Prompt Template

```text
You are implementing a finance-critical ERP-Lite module for CleanMateX.

Follow these rules strictly:
1. Use the approved PRD, ADRs, and roadmap documents only.
2. Keep HQ governance in cleanmatexsaas and tenant runtime in cleanmatex.
3. Never hardcode debit/credit mapping in UI.
4. Use config-driven, versioned, auditable posting logic.
5. Preserve tenant isolation and branch awareness.
6. Prefer minimal diffs and reuse existing patterns unless there is a clearly approved need to improve or extend them.
7. For finance logic, state assumptions explicitly.
8. Add validation and tests for posting behavior.
9. If a migration is needed, create the file only and stop for review.
10. Before finalizing, report:
- what changed
- why
- files touched
- validation run
- risks/follow-ups
```

---

## 3.1 Task Metadata Rules

Each implementation task should explicitly state:

- `Source document`
- `Dependency marker`
- `Task class`: design, approval, implementation, or validation
- `Signoff`

Dependency marker values:

- `HQ-first`
- `Runtime-first`
- `Parallel`
- `Review-blocked`

---

## 4. Master Timeline

| Phase | Duration | Outcome |
|---|---|---|
| Phase 0 | 1 week | Decisions frozen |
| Phase 1 | 1-2 weeks | Platform enablement complete |
| Phase 2 | 2-3 weeks | HQ governance foundation defined |
| Phase 3 | 2-3 weeks | Tenant finance schema drafted |
| Phase 4 | 3-4 weeks | Posting engine complete |
| Phase 5 | 2-3 weeks | Auto-post live for core flows |
| Phase 6 | 3-4 weeks | V1 finance inquiry and reports complete |
| Phase 7 | 2 weeks | Basic expenses and petty cash complete |
| Phase 8 | 2 weeks | V1 pilot and hardening complete |
| Phase 9 | 6-10 weeks | V2 complete |
| Phase 10 | 6-10 weeks | V3 complete |

## 4.1 Current Implementation Status

| Phase | Current Status | Notes |
|---|---|---|
| Phase 0 | Complete | Canonical approval pack and operational freeze documents are approved. |
| Phase 1 | Complete | Feature flags, permissions, navigation, settings, ERP-Lite shell routes, access contracts, route guards, and EN/AR shell messages are implemented in `cleanmatex`. |
| Phase 2+ | Not Started | Next implementation start point is Phase 2 HQ governance foundation, followed by Phase 3 tenant finance schema. |

---

## 5. Phase 0: Decision Freeze

### Task 0.1 Approve cross-project product scope

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- approval

**Input**
- PRD draft
- validated scope report
- your notes

**Output**
- approved cross-project scope

**Responsible**
- You
- AI assists with summary and diffs

**Guideline**
- Lock what belongs in v1, v2, v3.

**Acceptance**
- no unresolved scope ambiguity

### Task 0.2 Approve architecture decisions

**Source document**
- ADR-001 to ADR-004

**Dependency marker**
- `Review-blocked`

**Task class**
- approval

**Input**
- ADR drafts

**Output**
- approved ADRs

**Responsible**
- You
- finance reviewer if available
- AI assists with clarification

**Guideline**
- Do not start implementation before governance, mapping, auto-post, and VAT direction are approved.

**Acceptance**
- ADRs marked approved or updated with explicit changes

### Task 0.3 Freeze cross-project ownership split

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- approval

**Input**
- cross-project PRD

**Output**
- agreed split between `cleanmatex` and `cleanmatexsaas`

**Responsible**
- You
- AI assists with traceability matrix

**Acceptance**
- no unclear ownership for account types, mappings, runtime posting, or reports

**Signoff**
- You
- finance reviewer if available

### Task 0.4 Freeze operational control layer

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- approval

**Input**
- canonical finance rules
- runtime domain contract

**Output**
- frozen operational contract for Phase 0 and Phase 1 work

**Responsible**
- You
- finance reviewer if available
- AI assists with comparison and change summary

**Guideline**
- Do not allow coding to begin until posting lifecycle, exception lifecycle, idempotency, reversal, and report source-of-truth behavior are accepted.

**Acceptance**
- no unresolved contradiction between finance rules and runtime contract

**Signoff**
- You

---

## 6. Phase 1: Platform Enablement

### Task 1.1 Build Phase 0 checklist

**Source document**
- [APPROVAL_CHECKLIST_FOR_PHASE_0.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/APPROVAL_CHECKLIST_FOR_PHASE_0.md)
- [V1_0_APPROVAL_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_0_APPROVAL_PACK.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- approved PRD/ADRs
- implementation requirements

**Output**
- exact checklist for flags, permissions, settings, nav, route shells

**Responsible**
- AI drafts
- developer finalizes
- you approve

**Guideline**
- Produce exact names, not vague placeholders.

**Acceptance**
- checklist is implementation-ready

**Signoff**
- You

### Task 1.2 Define feature flags

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Parallel`

**Task class**
- design

**Input**
- v1/v2/v3 scope

**Output**
- complete ERP-Lite flag matrix

**Responsible**
- AI drafts
- developer confirms
- you approve

**Guideline**
- include parent and child flags
- align plan gating with HQ rules

**Acceptance**
- final list of flags approved

**Signoff**
- You

### Task 1.3 Define permissions

**Source document**
- [APPROVAL_CHECKLIST_FOR_PHASE_0.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/APPROVAL_CHECKLIST_FOR_PHASE_0.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Parallel`

**Task class**
- design

**Input**
- feature screens and actions

**Output**
- permission matrix

**Responsible**
- AI drafts
- developer validates
- you approve

**Guideline**
- separate view, create, edit, reverse, repost, approve where needed

**Acceptance**
- permission codes finalized

**Signoff**
- You

### Task 1.4 Define tenant settings

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- posting and VAT/tax policies

**Output**
- settings list and defaults

**Responsible**
- AI drafts
- developer validates
- you approve

**Guideline**
- include auto-post controls and failure policies

**Note**
- authoritative auto-post runtime behavior configuration is platform-level; tenant runtime should consume approved policy rather than define core posting behavior independently

**Acceptance**
- settings list finalized

**Signoff**
- You

### Task 1.5 Define navigation and route shell

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- design

**Input**
- screen list

**Output**
- route structure and nav entries

**Responsible**
- AI drafts
- developer implements
- you approve

**Guideline**
- keep route names stable and predictable

**Acceptance**
- route shell approved

**Signoff**
- You

### Task 1.6 Implement platform shell

**Source document**
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)

**Dependency marker**
- `Parallel`

**Task class**
- implementation

**Input**
- approved flags, permissions, settings, routes

**Output**
- shell routes and gated navigation

**Responsible**
- developer implements
- AI scaffolds

**Guideline**
- no accounting logic yet

**Acceptance**
- build succeeds
- nav and routes gated correctly

**Signoff**
- You

---

## 7. Phase 2: HQ Governance Foundation

### Task 2.1 Define account type master model

**Source document**
- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- ADR-001

**Output**
- account type master specification

**Responsible**
- AI drafts
- developer validates
- you approve

**Guideline**
- no tenant custom types
- no tenant debit/credit override

**Acceptance**
- governance model approved

**Signoff**
- You

### Task 2.2 Define mapping rule model

**Source document**
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- ADR-002

**Output**
- posting rule entity model

**Responsible**
- AI drafts
- developer validates
- you approve

**Guideline**
- must support conditions, multi-line, versioning

**Acceptance**
- rule model approved

**Signoff**
- You

### Task 2.3 Define publishing/versioning model

**Source document**
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- mapping rule model

**Output**
- HQ version lifecycle model

**Responsible**
- AI drafts
- developer validates
- you approve

**Guideline**
- every tenant runtime execution must reference a version

**Acceptance**
- versioning design approved

**Signoff**
- You

### Task 2.4 Define HQ auto-post runtime policy model

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- ADR-003
- cross-project PRD

**Output**
- HQ-governed auto-post policy model by transaction type

**Responsible**
- AI drafts
- developer validates
- you approve

**Guideline**
- define what is centrally locked, what is published, and what runtime may only observe or enforce

**Acceptance**
- policy model approved

**Signoff**
- You

### Task 2.5 Define HQ admin UI scope

**Source document**
- [CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CLEANMATEXSAAS_GOVERNANCE_IMPLEMENTATION_PLAN.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- governance model

**Output**
- HQ screen list and admin flows

**Responsible**
- AI drafts
- developer validates
- you approve

**Acceptance**
- governance UI scope approved

**Signoff**
- You

---

## 8. Phase 3: Tenant Finance Schema

### Task 3.1 Define tenant COA schema

**Source document**
- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- HQ account type model

**Output**
- tenant COA schema draft

**Responsible**
- AI drafts
- developer finalizes
- you review

**Guideline**
- tenant-owned, policy-constrained

**Acceptance**
- schema approved

**Signoff**
- You

### Task 3.2 Define GL schema

**Source document**
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- posting engine requirements

**Output**
- GL entries and batch schema

**Responsible**
- AI drafts
- developer finalizes
- you review

**Guideline**
- support source references, branch, audit, reversal

**Acceptance**
- schema approved

**Signoff**
- You

### Task 3.3 Define posting execution log and exception schema

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- ADR-003

**Output**
- exception queue / log schema

**Responsible**
- AI drafts
- developer finalizes
- you review

**Guideline**
- failures must be visible and recoverable

**Acceptance**
- exception design approved

**Signoff**
- You

### Task 3.4 Define VAT/tax runtime schema

**Source document**
- [ADR_004_VAT_TAX_V1_SCOPE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_004_VAT_TAX_V1_SCOPE.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- ADR-004

**Output**
- simple tax/VAT runtime model

**Responsible**
- AI drafts
- developer finalizes
- you review

**Acceptance**
- v1 tax model approved

**Signoff**
- You

### Task 3.5 Define basic expenses and petty cash schema

**Source document**
- [ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- design

**Input**
- v1 scope

**Output**
- expense and petty cash runtime schema draft

**Responsible**
- AI drafts
- developer finalizes
- you review

**Guideline**
- keep v1 simple

**Acceptance**
- schema approved

**Signoff**
- You

### Task 3.6 Create migration files

**Source document**
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- implementation

**Input**
- approved schema designs

**Output**
- migration SQL files only

**Responsible**
- developer writes
- AI assists
- you review/apply

**Guideline**
- never apply migrations automatically

**Acceptance**
- migration files ready for review

**Signoff**
- You

---

## 9. Phase 4: Posting Engine

### Task 4.1 Build posting engine contracts

**Source document**
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- implementation

**Input**
- mapping model

**Output**
- service interfaces and execution contract

**Responsible**
- AI drafts
- developer implements

**Acceptance**
- service boundaries clear

**Signoff**
- Developer
- You

### Task 4.2 Build mapping evaluator

**Source document**
- [ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_002_POSTING_ENGINE_AND_MAPPING_GOVERNANCE.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- implementation

**Input**
- versioned rule model

**Output**
- mapping execution logic

**Responsible**
- developer implements
- AI scaffolds/tests

**Guideline**
- config-driven only

**Acceptance**
- evaluator handles conditions and multi-line rules

**Signoff**
- Developer
- You

### Task 4.3 Build accounting validation

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- journal model

**Output**
- debit/credit validation

**Responsible**
- developer implements
- AI scaffolds tests

**Acceptance**
- unbalanced entries rejected

**Signoff**
- Developer
- You

### Task 4.4 Build execution audit trail

**Source document**
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- posting engine

**Output**
- mapping execution log

**Responsible**
- developer implements
- AI scaffolds

**Acceptance**
- every execution logged

**Signoff**
- Developer
- You

### Task 4.5 Build repost/retry mechanism

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- exception model

**Output**
- repost/retry service logic

**Responsible**
- developer implements
- AI scaffolds

**Acceptance**
- failed posting can be retried with auditability

**Signoff**
- Developer
- You

### Task 4.6 Write posting engine tests

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Parallel`

**Task class**
- validation

**Input**
- core posting rules

**Output**
- unit and integration tests

**Responsible**
- AI drafts tests
- developer finalizes

**Acceptance**
- invoice/payment/refund cases covered

**Signoff**
- Developer
- You

---

## 10. Phase 5: Core Auto-Post Integration

### Task 5.1 Define transaction policy matrix

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- ADR-003

**Output**
- policy matrix per transaction type

**Responsible**
- AI drafts
- you approve

**Acceptance**
- policy matrix finalized

**Signoff**
- You

### Task 5.2 Integrate invoice auto-post

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- implementation

**Input**
- invoice flow + posting engine

**Output**
- invoice posting integration

**Responsible**
- developer implements
- AI scaffolds/tests

**Acceptance**
- invoice journals created correctly

**Signoff**
- Developer
- You

### Task 5.3 Integrate payment auto-post

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `HQ-first`

**Task class**
- implementation

**Input**
- payment flow + posting engine

**Output**
- payment posting integration

**Responsible**
- developer implements
- AI scaffolds/tests

**Acceptance**
- payment journals created correctly

**Signoff**
- Developer
- You

### Task 5.4 Integrate refund auto-post

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ADR_004_VAT_TAX_V1_SCOPE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_004_VAT_TAX_V1_SCOPE.md)

**Dependency marker**
- `HQ-first`

**Task class**
- implementation

**Input**
- refund flow + posting engine

**Output**
- refund/reversal posting integration

**Responsible**
- developer implements
- AI scaffolds/tests

**Acceptance**
- refunds handled correctly

**Signoff**
- Developer
- You

### Task 5.5 Implement failure visibility

**Source document**
- [ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_003_AUTO_POST_EXCEPTION_AND_REPOST_MODEL.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- exception model

**Output**
- visible exception list / status

**Responsible**
- developer implements
- AI scaffolds UI

**Acceptance**
- posting failures visible to authorized users

**Signoff**
- Developer
- You

---

## 11. Phase 6: V1 Finance Inquiry and Reports

### Task 6.1 Build COA UI

**Source document**
- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- COA schema and APIs

**Output**
- tenant COA management UI

**Responsible**
- AI scaffolds
- developer finalizes

**Acceptance**
- user can manage COA within policy constraints

**Signoff**
- Developer
- You

### Task 6.2 Build GL inquiry

**Source document**
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- GL data

**Output**
- GL list/detail UI

**Responsible**
- AI scaffolds
- developer finalizes

**Acceptance**
- journal inquiry works with filters

**Signoff**
- Developer
- You

### Task 6.3 Build AR aging

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- invoices/customers + postings

**Output**
- AR aging report

**Responsible**
- AI scaffolds
- developer finalizes
- you review

**Acceptance**
- aging buckets correct

**Signoff**
- You
- finance reviewer if available

### Task 6.4 Build trial balance

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- GL data

**Output**
- trial balance report

**Responsible**
- AI scaffolds
- developer finalizes
- you review

**Acceptance**
- totals reconcile

**Signoff**
- You
- finance reviewer if available

### Task 6.5 Build P&L

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- GL and account types

**Output**
- P&L report

**Responsible**
- AI scaffolds
- developer finalizes
- you review

**Acceptance**
- P&L structure approved

**Signoff**
- You
- finance reviewer if available

### Task 6.6 Build balance sheet

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_001_ACCOUNT_TYPE_GOVERNANCE_MODEL.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- GL and account types

**Output**
- balance sheet report

**Responsible**
- AI scaffolds
- developer finalizes
- you review

**Acceptance**
- balance sheet approved

**Signoff**
- You
- finance reviewer if available

### Task 6.7 Build VAT/tax visibility

**Source document**
- [ADR_004_VAT_TAX_V1_SCOPE.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ADR_004_VAT_TAX_V1_SCOPE.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- tax-aware postings

**Output**
- tax visibility in reports or finance views

**Responsible**
- developer implements
- AI assists

**Acceptance**
- tax amounts visible and traceable

**Signoff**
- You

---

## 12. Phase 7: Basic Expenses and Basic Petty Cash

### Task 7.1 Build expense categories and entry flow

**Source document**
- [ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- expense schema

**Output**
- expense create/list flow

**Responsible**
- AI scaffolds
- developer finalizes

**Acceptance**
- expense entry works

**Signoff**
- Developer
- You

### Task 7.2 Build petty cash expense flow

**Source document**
- [ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- petty cash schema

**Output**
- petty cash expense entry flow

**Responsible**
- AI scaffolds
- developer finalizes

**Acceptance**
- petty cash expense works

**Signoff**
- Developer
- You

### Task 7.3 Build petty cash top-up flow

**Source document**
- [ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_VALIDATED_SCOPE_AND_DECISION_REPORT.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- petty cash model

**Output**
- petty cash top-up functionality

**Responsible**
- developer implements
- AI assists

**Acceptance**
- top-up works and posts correctly

**Signoff**
- Developer
- You

### Task 7.4 Build running balance view

**Source document**
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- petty cash transactions

**Output**
- running petty cash balance view

**Responsible**
- AI scaffolds
- developer finalizes

**Acceptance**
- balances update correctly

**Signoff**
- Developer
- You

### Task 7.5 Build expense and petty cash posting tests

**Source document**
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)

**Dependency marker**
- `Parallel`

**Task class**
- validation

**Input**
- final runtime flows

**Output**
- tests for expense and petty cash posting

**Responsible**
- AI drafts
- developer finalizes

**Acceptance**
- scenarios pass

**Signoff**
- Developer
- You

---

## 13. Phase 8: V1 Pilot and Hardening

### Task 8.1 Prepare pilot scenarios

**Source document**
- [ROLLOUT_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ROLLOUT_PLAN.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- v1 feature set

**Output**
- test scenarios for real tenants

**Responsible**
- AI drafts
- you approve

**Acceptance**
- pilot scenario set ready

**Signoff**
- You

### Task 8.2 Run pilot validation

**Source document**
- [ROLLOUT_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ROLLOUT_PLAN.md)

**Dependency marker**
- `Parallel`

**Task class**
- validation

**Input**
- pilot scenarios

**Output**
- findings list

**Responsible**
- developer runs
- AI summarizes
- you review

**Acceptance**
- critical issues identified

**Signoff**
- You
- finance reviewer if available

### Task 8.3 Fix priority defects

**Source document**
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)

**Dependency marker**
- `Parallel`

**Task class**
- implementation

**Input**
- pilot findings

**Output**
- corrected v1

**Responsible**
- developer implements
- AI assists

**Acceptance**
- critical blockers resolved

**Signoff**
- Developer
- You

### Task 8.4 Final v1 readiness review

**Source document**
- [V1_0_APPROVAL_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/V1_0_APPROVAL_PACK.md)
- [ROLLOUT_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ROLLOUT_PLAN.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- approval

**Input**
- stable v1

**Output**
- release readiness decision

**Responsible**
- you
- finance reviewer if available
- AI assists with summary

**Acceptance**
- go/no-go decision made

**Signoff**
- You
- finance reviewer if available

---

## 14. Phase 9: V2 Task Set

### Task 9.1 Define bank account and statement model

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `HQ-first`

**Task class**
- design

**Input**
- approved v2 scope

**Output**
- bank account and statement model

**Responsible**
- AI drafts
- developer validates
- you approve

**Guideline**
- do not create a parallel treasury model outside the governed finance foundation

**Acceptance**
- bank model approved

**Signoff**
- You

### Task 9.2 Build bank statement import and matching

**Source document**
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- approved bank model

**Output**
- bank statement import and matching behavior

**Responsible**
- developer implements
- AI scaffolds

**Acceptance**
- import and matching work with auditability

**Signoff**
- Developer
- You

### Task 9.3 Define supplier master and AP model

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- approved v2 scope

**Output**
- supplier and AP model

**Responsible**
- AI drafts
- developer validates
- you approve

**Acceptance**
- supplier/AP model approved

**Signoff**
- You

### Task 9.4 Build AP invoice and AP payment flows

**Source document**
- [IMPLEMENTATION_GAP_CLOSURE_PLAN.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_GAP_CLOSURE_PLAN.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- approved AP model

**Output**
- AP invoice and payment runtime flows

**Responsible**
- developer implements
- AI scaffolds/tests

**Acceptance**
- AP flows work on governed finance logic

**Signoff**
- Developer
- You

### Task 9.5 Build purchase order workflow

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- approved v2 procurement scope

**Output**
- purchase order workflow

**Responsible**
- developer implements
- AI scaffolds

**Guideline**
- do not overlap this work with unstable v1 corrections

**Acceptance**
- PO workflow operates with approved boundaries

**Signoff**
- Developer
- You

---

## 15. Phase 10: V3 Task Set

### Task 10.1 Define advanced expenses workflow

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- approved v3 scope

**Output**
- advanced expenses workflow design

**Responsible**
- AI drafts
- developer validates
- you approve

**Acceptance**
- advanced workflow approved

**Signoff**
- You

### Task 10.2 Define advanced petty cash controls

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Review-blocked`

**Task class**
- design

**Input**
- approved v3 scope

**Output**
- advanced petty cash control model

**Responsible**
- AI drafts
- developer validates
- you approve

**Acceptance**
- advanced petty cash control model approved

**Signoff**
- You

### Task 10.3 Build branch profitability model

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- approved profitability design

**Output**
- branch profitability model and outputs

**Responsible**
- developer implements
- AI scaffolds

**Acceptance**
- profitability output is business-credible

**Signoff**
- You
- finance reviewer if available

### Task 10.4 Build laundry-specific costing

**Source document**
- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)

**Dependency marker**
- `Runtime-first`

**Task class**
- implementation

**Input**
- approved costing design

**Output**
- laundry-specific costing model and reports

**Responsible**
- developer implements
- AI scaffolds

**Guideline**
- only start after v2 finance base is trusted

**Acceptance**
- costing logic is accepted as credible and consistent

**Signoff**
- You
- finance reviewer if available

---

## 16. Acceptance Gates By Phase

| Phase | Gate |
|---|---|
| Phase 0 | scope and ADR approval |
| Phase 1 | platform shell approved |
| Phase 2 | governance model approved |
| Phase 3 | schema approved and migration files reviewed |
| Phase 4 | sample journals approved |
| Phase 5 | auto-post works or fails visibly by policy |
| Phase 6 | reports reconcile correctly |
| Phase 7 | expenses and petty cash behave correctly |
| Phase 8 | pilot sign-off |
| Phase 9 | treasury/procurement sign-off |
| Phase 10 | profitability/costing sign-off |

---

## 17. Final Guideline

Use this loop for every task:

1. define exact scope
2. let AI draft
3. implement minimally
4. validate
5. human review gate
6. fix
7. approve
8. move to next task

This is the safest way to use AI assistance for ERP-Lite without losing finance correctness.
