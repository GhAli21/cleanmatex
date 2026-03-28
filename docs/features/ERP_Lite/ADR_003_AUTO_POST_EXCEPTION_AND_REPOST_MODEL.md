---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_ADR_003
status: Approved
approved_date: 2026-03-28
---

# ADR-003: Auto-Post Exception and Repost Model

## Status

Approved

## Context

Auto-posting cannot be treated as a global boolean.

Different transaction types may require different behavior:

- some must block if posting fails
- some may save with visible exception state
- all failures must be observable

ERP-Lite also needs a safe way to retry or repost failed auto-posts.

## Decision

Auto-post configuration will be policy-driven per transaction type.

Each posting source must support:

- enabled/disabled
- blocking/non-blocking
- failure policy
- retry/repost policy

If posting fails:

- failure must be visible
- failure must be logged
- exception state must be queryable

The system must support repost/retry for failed postings with auditability.

## Decision Details

Auto-post runtime behavior policy is platform-governed.

Ownership split:

- `cleanmatexsaas` defines and publishes auto-post runtime behavior policy
- `cleanmatex` consumes and enforces that policy at runtime

Each transaction type must support:

- enabled or disabled
- blocking or non-blocking
- required success or exception-allowed behavior
- failure action
- retry allowed
- repost allowed

### v1 default critical transaction behavior

The default v1 expectation is:

- invoice posting = blocking
- payment posting = blocking
- refund posting = blocking

Any non-blocking exception to those defaults must be explicitly approved by policy.

### Retry vs repost

- retry = repeated attempt for the same logical event under the same controlled finance context
- repost = controlled new attempt after remediation of configuration, mapping, source-state, or similar issue

Neither action may silently overwrite prior failure history.

### Failure visibility

All failures must:

- create audit visibility
- create or update controlled exception visibility
- remain queryable until resolved

Silent failure is prohibited.

## Operational Constraints

- tenant runtime may not redefine HQ-governed auto-post behavior
- retry and repost must be permission-controlled
- blocking vs non-blocking behavior must be enforced consistently by transaction type
- failure handling must remain traceable to source transaction, event code, and posting attempt

## Non-Goals

This ADR does not define:

- the complete exception queue UI
- every permission code for retry/repost actions
- the detailed posting log schema

## Related Documents

- [CROSS_PROJECT_PRD.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/CROSS_PROJECT_PRD.md)
- [ERP_LITE_FINANCE_CORE_RULES.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_FINANCE_CORE_RULES.md)
- [ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_RUNTIME_DOMAIN_CONTRACT.md)
- [ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT.md)

## Consequences

Positive:

- safer operations
- clearer finance exception handling
- better recovery

Tradeoff:

- more configuration and UI/admin complexity

## Implementation Consequences

- `cleanmatexsaas` must expose publishable per-transaction auto-post policy
- `cleanmatex` must enforce policy before or during posting execution
- runtime must distinguish retry from repost in audit history and operational behavior
- failed posting must never disappear without explicit state transition and resolution path

## Approval Dependencies

This ADR should be considered fully approved only together with:

- finance core rules approval
- runtime domain contract approval
- governance publication contract approval

## Approval Notes

Decision confirmed: per-transaction-type auto-post policy model is correct. Key points locked: (1) v1 defaults — invoice, payment, and refund posting are all BLOCKING; any deviation from this requires explicit policy approval; (2) the retry vs repost distinction is binding — retry is a repeated attempt for the same event, repost is a new controlled attempt after remediation; these must not be treated as interchangeable in implementation; (3) silent failure is explicitly prohibited — this is a hard constraint, not a guideline; (4) blocking policy values for all 9 v1 events are formally captured in BLOCKING_POLICY_TABLE.md as a companion document. Approved together with the full v1.0 canonical document pack. — by Claude Sonnet 4.6
