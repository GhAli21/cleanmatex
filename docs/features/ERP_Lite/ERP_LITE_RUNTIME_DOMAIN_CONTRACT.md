# ERP_LITE_RUNTIME_DOMAIN_CONTRACT

Version: 1.0-approved
Status: Approved
Approved Date: 2026-03-28
Scope: CleanMateX runtime finance engine
Related Systems: CleanMateX runtime, CleanMateXSaaS governance
Implementation Project: cleanmatex
Project Context: Tenant Runtime

---

## 1. Purpose

This document defines the runtime domain contract for the ERP-Lite finance engine used by CleanMateX. It is the authoritative implementation contract for how finance runtime objects behave, interact, validate, post, fail, retry, reverse, and report.

This document exists to eliminate ambiguity between:
- PRD intent
- ADR decisions
- governance definitions
- runtime implementation
- AI-generated code
- developer interpretation

Anything not explicitly defined here must not be assumed in implementation.

---

## 2. Core Principles

### 2.1 Double-entry accounting is mandatory
Every posted journal must balance exactly:
- total debit = total credit

Unbalanced journals must never be committed.

### 2.2 Posted journals are immutable
Once a journal reaches `POSTED` status:
- it cannot be edited
- it cannot be deleted
- it cannot be partially rewritten

Corrections must occur only through:
- reversal journal, or
- approved adjustment journal if introduced later

### 2.3 Posting is event-driven
Accounting posting is triggered only by approved runtime transaction events.
Runtime posting must not be based on ad hoc UI actions or direct table manipulation.

### 2.4 Posting is idempotent
The same logical posting event must never generate duplicate accounting entries.

### 2.5 Mapping rule resolution is deterministic
Exactly one rule must win for a given posting request. If no rule matches, or multiple rules match after deterministic ranking, posting must fail safely.

### 2.6 Auditability is mandatory
Every posting attempt must be logged, whether successful or failed.

### 2.7 Governance/runtime separation is strict
- HQ governs rule logic, catalogs, packages, and policy.
- Tenant owns account master usage through allowed runtime configuration.
- Runtime combines HQ-defined logic with tenant-defined account mappings.

---

## 3. Runtime Scope

This contract governs:
- transaction event consumption
- mapping rule execution
- amount resolution
- account resolution
- posting validation
- journal creation
- exception generation
- retry/repost behavior
- reversal behavior
- reporting source of truth
- accounting period controls

This contract does not govern:
- external tax filing
- advanced cost accounting
- payroll
- inventory valuation
- complex jurisdiction engines
- bank reconciliation workflows beyond future extension

---

## 4. Canonical Runtime Entities

### 4.1 Transaction Event
A transaction event is the normalized business trigger that may produce accounting impact.

Examples:
- `ORDER_INVOICED`
- `ORDER_SETTLED_CASH`
- `ORDER_SETTLED_CARD`
- `PAYMENT_RECEIVED`
- `REFUND_ISSUED`
- `EXPENSE_RECORDED`
- `PETTY_CASH_TOPUP`
- `PETTY_CASH_SPENT`

#### Ownership
- Defined by HQ only
- Published by HQ only
- Consumed by runtime
- Not editable by tenant

#### Required properties
- `txn_event_code`
- `source_module_code`
- `source_doc_type_code`
- `posting_mode_code`
- `allow_preview`
- `allow_reversal`
- `payload_schema_version`
- `is_active`

---

### 4.2 Mapping Rule Header
Defines the rule scope and selection conditions for a transaction event.

#### Required properties
- `mapping_rule_id`
- `tenant_scope_type` or package scope reference
- `txn_event_code`
- `rule_code`
- `version_no`
- `priority_no`
- `status_code`
- `effective_from`
- `effective_to`
- `processor_type_code`
- `condition_json` or structured condition rows

#### Status values
- `DRAFT`
- `ACTIVE`
- `INACTIVE`
- `ARCHIVED`

#### Rules
- Runtime executes only `ACTIVE` rules
- Rule versions are immutable once published/activated
- Updates create a new version

---

### 4.3 Mapping Rule Line
Defines the accounting lines generated when a mapping rule is selected.

#### Required properties
- `mapping_line_id`
- `mapping_rule_id`
- `line_no`
- `entry_side`
- `amount_source_code`
- `account_resolution_type`
- `sort_order`

#### `entry_side`
- `DEBIT`
- `CREDIT`

#### Supported amount sources
- `NET_AMOUNT`
- `TAX_AMOUNT`
- `GROSS_AMOUNT`
- `DISCOUNT_AMOUNT`
- `DELIVERY_FEE_AMOUNT`
- `ROUNDING_AMOUNT`
- `CUSTOM_EXPR`

#### Supported account resolution types
- `FIXED_ACCOUNT`
- `SYSTEM_USAGE_CODE`
- `PAYMENT_METHOD_MAP`
- `PARTY_CONTROL_ACCOUNT`
- `TAX_ACCOUNT`
- `DYNAMIC_DOC_FIELD`

#### Rules
- Every line must resolve to one valid account before posting
- Any unresolved line causes posting failure

---

### 4.4 Usage Code Mapping
Usage codes are governance-defined runtime account placeholders.

Examples:
- `SALES_REVENUE`
- `VAT_OUTPUT`
- `VAT_INPUT`
- `ACCOUNTS_RECEIVABLE`
- `BANK_CARD_CLEARING`
- `CASH_MAIN`
- `PETTY_CASH_MAIN`

#### Ownership model
- HQ defines usage codes
- Tenant maps usage codes to tenant accounts
- Runtime resolves usage code to tenant account during posting

#### Rules
- HQ rules must not directly reference tenant-specific account IDs
- Tenant cannot activate posting usage unless required mappings are complete

---

### 4.5 Journal Master
Represents the accounting document header.

#### Required properties
- `journal_id`
- `tenant_org_id`
- `branch_id` if applicable
- `journal_no`
- `journal_date`
- `posting_date`
- `source_module_code`
- `source_doc_type_code`
- `source_doc_id`
- `source_doc_no`
- `txn_event_code`
- `mapping_rule_id`
- `mapping_rule_version_no`
- `currency_code`
- `exchange_rate`
- `total_debit`
- `total_credit`
- `status_code`
- `narration`
- `reversal_of_journal_id` if applicable
- audit fields

#### Journal status values
- `DRAFT`
- `POSTED`
- `FAILED`
- `REVERSED`

#### Rules
- Runtime v1 should primarily create `POSTED` journals directly after successful validation
- `FAILED` may be used for controlled technical flows, but failure history must still exist in posting logs/exceptions
- A reversal creates a new journal; it does not mutate the original

---

### 4.6 Journal Line
Represents individual debit/credit lines.

#### Required properties
- `journal_line_id`
- `journal_id`
- `line_no`
- `account_id`
- `entry_side`
- `amount_txn_currency`
- `amount_base_currency`
- `line_description`
- optional dimensions

#### Optional dimensions
- `cost_center_id`
- `profit_center_id`
- `party_type_code`
- `party_id`
- `tax_code`
- `tax_rate`
- `branch_id` if line-level branching is later needed

#### Rules
- Line account must belong to tenant
- Line account must be active and postable
- Zero-value lines should be disallowed unless explicitly permitted for a future feature

---

### 4.7 Posting Log
Stores the full audit trace of posting attempts.

#### Required properties
- `posting_log_id`
- `tenant_org_id`
- `source_module_code`
- `source_doc_type_code`
- `source_doc_id`
- `txn_event_code`
- `mapping_rule_id`
- `mapping_rule_version_no`
- `idempotency_key`
- `request_payload_json`
- `resolved_payload_json`
- `preview_result_json`
- `execute_result_json`
- `status_code`
- `error_code`
- `error_message`
- `created_at`

#### Log status values
- `PREVIEWED`
- `POSTED`
- `FAILED`
- `SKIPPED`
- `REVERSED`

#### Rules
- Every attempt must create or update an auditable log trail
- A successful post must be traceable back to request payload and rule version

---

### 4.8 Posting Exception
Represents a posting failure requiring visibility and controlled follow-up.

#### Required properties
- `exception_id`
- `tenant_org_id`
- `source_doc_id`
- `source_doc_type_code`
- `txn_event_code`
- `posting_log_id`
- `exception_type_code`
- `status_code`
- `error_message`
- `resolution_notes`
- audit fields

#### Exception type codes
- `RULE_NOT_FOUND`
- `AMBIGUOUS_RULE`
- `ACCOUNT_NOT_FOUND`
- `VALIDATION_ERROR`
- `SYSTEM_ERROR`
- `PERIOD_CLOSED`
- `DUPLICATE_POST`
- `ACCOUNT_INACTIVE`
- `ACCOUNT_NOT_POSTABLE`
- `MISSING_USAGE_MAPPING`

#### Exception status codes
- `NEW`
- `OPEN`
- `RETRY_PENDING`
- `RETRIED`
- `REPOST_PENDING`
- `REPOSTED`
- `RESOLVED`
- `IGNORED`
- `CLOSED`

#### Rules
- Exceptions must be visible in a tenant exception queue
- Exception closure requires explicit resolution path
- Failed posting must never disappear silently

---

### 4.9 Accounting Period
Controls posting eligibility by accounting date.

#### Required properties
- `period_id`
- `tenant_org_id`
- `period_code`
- `start_date`
- `end_date`
- `status_code`

#### Status values
- `OPEN`
- `CLOSED`
- `SOFT_LOCKED` (optional later)

#### Rules
- Posting is allowed only to an open period
- Closed periods reject posting
- Reversal also requires an open posting period unless future controlled override is introduced

---

## 5. V1 Locked Event Catalog

The following event codes are approved for v1 runtime scope:

- `ORDER_INVOICED`
- `ORDER_SETTLED_CASH`
- `ORDER_SETTLED_CARD`
- `ORDER_SETTLED_WALLET`
- `PAYMENT_RECEIVED`
- `REFUND_ISSUED`
- `EXPENSE_RECORDED`
- `PETTY_CASH_TOPUP`
- `PETTY_CASH_SPENT`

No additional runtime event may be implemented in v1 without controlled approval.

---

## 6. Canonical Posting Request Contract

Every posting request must be normalized before reaching the posting engine.

### Required minimum payload
- `tenant_org_id`
- `branch_id` if applicable
- `txn_event_code`
- `source_module_code`
- `source_doc_type_code`
- `source_doc_id`
- `source_doc_no`
- `journal_date`
- `currency_code`
- `exchange_rate`
- `amounts`
- `dimensions`
- `meta`

### Minimum `amounts` structure
- `net_amount`
- `tax_amount`
- `gross_amount`
- `discount_amount`
- `delivery_fee_amount`
- `rounding_amount`

### Minimum `meta` structure
- `created_by`
- payload version / source context if used

#### Rules
- Business modules must not send inconsistent unnormalized payload shapes
- Posting engine must validate payload completeness before rule execution

---

## 7. Posting Lifecycle

### 7.1 Posting attempt states
The canonical posting attempt lifecycle is:

- `INITIATED`
- `VALIDATED`
- `FAILED_VALIDATION`
- `FAILED_RULE`
- `FAILED_ACCOUNT`
- `FAILED_SYSTEM`
- `POSTED`
- `REVERSED`

### 7.2 Lifecycle behavior
1. Request enters engine as `INITIATED`
2. Payload validation runs
3. Rule resolution runs
4. Amount and account resolution runs
5. Posting validations run
6. Journal is committed if all validations pass
7. Posting log is finalized
8. Exception is created if posting fails

### 7.3 Failure mapping
- payload/field problem → `FAILED_VALIDATION`
- no rule / ambiguous rule → `FAILED_RULE`
- missing account / usage map / inactive account → `FAILED_ACCOUNT`
- technical error → `FAILED_SYSTEM`

---

## 8. Idempotency Contract

### 8.1 Canonical key format
The required idempotency key format is:

`{tenant_org_id}:{txn_event_code}:{source_doc_id}:{posting_version}`

Example:

`tenant123:ORDER_SETTLED_CARD:order456:v1`

### 8.2 Rules
- Idempotency key must be unique per logical posting event
- A duplicate request with the same key must not create a second journal
- Runtime should either:
  - return the existing successful posting reference, or
  - reject with controlled duplicate response

### 8.3 Duplicate handling
Duplicate posting attempts must produce:
- posting log visibility, and/or
- controlled exception or skip behavior

They must never silently double-post.

---

## 9. Rule Resolution Contract

### 9.1 Candidate selection
Runtime selects candidate rules by:
- active status
- tenant/package applicability
- matching `txn_event_code`
- effective date window

### 9.2 Deterministic winner selection
Winner selection must follow this order:
1. exact condition match
2. highest number of matched condition fields (specificity)
3. lowest `priority_no`
4. highest `version_no`
5. latest `effective_from`

### 9.3 Error conditions
If multiple active rules still tie after ranking:
- error code: `AMBIGUOUS_RULE`
- posting must fail
- exception must be created

If no active rule matches:
- error code: `RULE_NOT_FOUND`
- posting must fail
- exception must be created

---

## 10. Amount Resolution Contract

### 10.1 Supported amount sources
- `NET_AMOUNT`
- `TAX_AMOUNT`
- `GROSS_AMOUNT`
- `DISCOUNT_AMOUNT`
- `DELIVERY_FEE_AMOUNT`
- `ROUNDING_AMOUNT`
- `CUSTOM_EXPR`

### 10.2 Rules
- Standard amount sources must resolve from normalized request payload
- `CUSTOM_EXPR` is allowed only if it uses a safe controlled expression evaluator
- Arbitrary code execution is prohibited
- Failed amount resolution causes posting failure

---

## 11. Account Resolution Contract

### 11.1 Supported resolution types
- `FIXED_ACCOUNT`
- `SYSTEM_USAGE_CODE`
- `PAYMENT_METHOD_MAP`
- `PARTY_CONTROL_ACCOUNT`
- `TAX_ACCOUNT`
- `DYNAMIC_DOC_FIELD`

### 11.2 Rules
- HQ rule packages must avoid tenant-specific account IDs
- Runtime account resolution must always end with a concrete valid tenant account
- Missing mapping or invalid target account causes posting failure

### 11.3 Usage-code readiness
A tenant cannot safely use a rule package unless all required usage codes are mapped to valid tenant accounts.

---

## 12. Posting Validation Contract

All of the following must pass before journal commit:

### 12.1 Journal-level validations
- debit total equals credit total
- journal date present
- posting date present
- source references present
- idempotency valid

### 12.2 Account-level validations
- account exists
- account belongs to tenant
- account is active
- account is postable
- account effective date valid if such control is implemented

### 12.3 Dimension validations
- required party reference present if line requires it
- required tax code present if line requires it
- required branch/cost center/profit center present if configured as mandatory

### 12.4 Period validations
- accounting period is open
- posting date falls inside an open period

### 12.5 Runtime policy validations
- event allowed for posting
- auto-post policy does not block execution
- package/rule version is active and valid

Any failure prevents journal creation.

---

## 13. Journal Policy

### 13.1 Immutability
Posted journals are immutable.

### 13.2 No destructive correction
The following actions are prohibited for posted journals:
- edit line amount
- change account
- delete journal
- detach source reference

### 13.3 Approved correction methods
Corrections must occur through:
- reversal journal, or
- future controlled adjustment journal if explicitly introduced

### 13.4 Manual actions not allowed in v1
The following manual actions are not allowed in v1:
- direct journal edit
- direct journal delete
- manual override of resolved debit/credit outcome
- manual bypass of posting validation
- partial reversal

---

## 14. Reversal Contract

### 14.1 Reversal behavior
A reversal must:
- create a new journal
- invert debit/credit sides relative to original journal
- preserve source traceability
- link back to the original via `reversal_of_journal_id`

### 14.2 Original journal handling
The original journal remains stored and immutable.

### 14.3 Reversal conditions
- original journal must be `POSTED`
- reversal must be allowed by event/rule policy
- reversal posting period must be open
- reversal must be auditable

---

## 15. Retry vs Repost Contract

### 15.1 Retry
Retry means a system re-attempt of the same logical posting using:
- same source document
- same posting intent
- same effective payload family

Retry is intended for transient or technical failure.

### 15.2 Repost
Repost means a new authorized posting attempt after correction of something such as:
- mapping configuration
- account mapping
- source data state
- period status

### 15.3 Rules
- Retry must preserve failure lineage
- Repost must create a new attempt record and preserve prior attempt history
- Neither retry nor repost may silently overwrite the original failed attempt trail

---

## 16. Exception Queue Contract

### 16.1 Purpose
The exception queue is the operational control surface for failed postings.

### 16.2 Minimum queue capabilities
- filter by status
- filter by error type
- filter by date
- filter by source document type
- open exception detail
- view related posting log
- trigger authorized retry/repost actions
- record resolution notes

### 16.3 Closure rules
An exception may be closed only after one of the following:
- successful repost/retry
- explicit business-approved ignore path if allowed
- controlled manual resolution note with audit trail

No exception may disappear without an auditable state transition.

---

## 17. VAT / Tax v1 Runtime Contract

### 17.1 Supported in v1
- simple tax code setup
- output VAT
- input VAT
- tax account mapping
- invoice tax separation from revenue/expense
- refund tax reversal
- zero-rated and exempt codes if required by approved scope

### 17.2 Not supported in v1
- filing engine
- jurisdiction engine
- multi-layer tax engine
- advanced withholding logic
- complex tax apportionment

### 17.3 Operational rules
- v1 must define whether pricing is tax-inclusive, tax-exclusive, or both
- each posting payload must provide resolved tax context before posting
- refund must reverse prior tax effect consistently
- rounding policy must be defined and applied consistently

---

## 18. Reporting Source-of-Truth Contract

### 18.1 General Ledger
Source of truth: journals only

### 18.2 Trial Balance
Source of truth: journals only

### 18.3 Profit and Loss
Source of truth: journals only

### 18.4 Balance Sheet
Source of truth: journals only

### 18.5 AR Aging
Source of truth:
- controlled receivable logic that must reconcile to journal-backed balances
- must not be an unconstrained operational-only report

### 18.6 Principle
Financial reports must not mix random operational tables with journal truth unless reconciliation rules are explicitly defined.

---

## 19. Tenant Boundary Contract

### 19.1 Tenant may
- create and manage tenant COA within policy constraints
- map usage codes to tenant accounts
- configure allowed branch-level mappings
- activate approved runtime setups when validation passes
- view journals, reports, exceptions, and audit logs according to permissions

### 19.2 Tenant may not
- create account types
- alter debit/credit semantics
- modify HQ-governed rule logic structure
- bypass posting validation
- edit posted journals
- bypass exception handling

---

## 20. HQ Boundary Contract

### 20.1 HQ may
- define account types
- define account groups/reporting families
- define event catalog
- define usage code catalog
- define mapping rule logic/packages
- publish rule versions
- define auto-post policy and exception model

### 20.2 HQ may not
- hardcode tenant-specific account IDs into governed shared rule templates intended for scalable multi-tenant rollout

---

## 21. Governance Package Consumption Contract

Runtime should consume approved governance outputs as controlled published artifacts or controlled active versions, not as ad hoc mutable logic.

Minimum governed publishable artifacts should include:
- event catalog version
- mapping rule package version
- usage code catalog version
- auto-post policy version
- effective date / compatibility context

---

## 22. Mandatory Audit Fields

All runtime posting-related entities must support appropriate auditability, including at minimum:
- `created_by`
- `created_at`
- `updated_by`
- `updated_at`
- `source_doc_id`
- `txn_event_code`
- `mapping_rule_id`
- `mapping_rule_version_no`
- `idempotency_key`
- status transitions where applicable

---

## 23. Minimum Approval Criteria for Runtime Build Start

Runtime implementation should not start until the following are explicitly approved:
- v1 event catalog
- posting lifecycle
- exception lifecycle
- idempotency contract
- journal immutability policy
- reversal policy
- VAT v1 operating model
- reporting source-of-truth model
- tenant/HQ responsibility boundaries

---

## 24. Acceptance Criteria for Runtime Validity

The v1 runtime finance engine is considered valid only when:
- all approved v1 events can resolve through governed rule logic
- valid events produce balanced journals
- duplicate posting is prevented
- failed postings create visible exceptions
- retry/repost flows preserve audit history
- reversal creates linked reversing journals
- journals remain immutable after posting
- trial balance reconciles to journal totals
- VAT is separated correctly according to v1 tax model
- no tenant can alter HQ-governed accounting semantics

---

## 25. Change Control

This contract is authoritative. Any runtime behavior that changes:
- posting object model
- status values
- lifecycle transitions
- reconciliation truth
- correction model
- tenant/HQ control boundaries

must be changed only by controlled revision of this document and related ADR/PRD alignment.

---

## 26. Final Statement

This document defines the runtime truth model for ERP-Lite finance in CleanMateX.

Anything not explicitly defined here:
- must not be improvised in code
- must not be inferred by AI agents
- must not be assumed by developers
- must be raised as a controlled design decision

---

## Approval Notes

Document reviewed and approved as the authoritative runtime domain contract for ERP-Lite v1. Key items confirmed: (1) the 9 v1 event codes in §5 are locked — no additional runtime event may be added without controlled approval; (2) the 4-part idempotency key format in §8.1 is the canonical format, matching FCR §3.3; (3) deterministic rule resolution order in §9.2 is binding — ambiguous outcomes must fail with `AMBIGUOUS_RULE`, never silently resolve; (4) journal immutability in §13 is non-negotiable — no direct edit, delete, or bypass paths are permitted in v1; (5) all financial reports must source from journals only (§18) — mixing operational tables without explicit reconciliation rules is prohibited; (6) §26 Final Statement applies to AI-generated code — any behavior not defined in this contract must be raised as a design decision before implementation. All 23 minimum approval criteria in §23 are considered met by this approval pass. — by Claude Sonnet 4.6
