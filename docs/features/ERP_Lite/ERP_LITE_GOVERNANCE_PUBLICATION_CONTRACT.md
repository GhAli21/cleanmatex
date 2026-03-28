---
version: v1.0.0
last_updated: 2026-03-28
author: CleanMateX AI Assistant
document_id: ERP_LITE_GOVERNANCE_PUBLICATION_CONTRACT_2026_03_28
status: Approved
approved_date: 2026-03-28
owner: HQ Governance (`cleanmatexsaas`)
implementation_project: cleanmatexsaas
project_context: Platform Level HQ
---

# ERP-Lite Governance Publication Contract

## 1. Purpose

This document defines what HQ governance publishes for ERP-Lite and how tenant runtime consumes it safely.

It exists to prevent runtime from depending on ad hoc mutable governance data.

---

## 2. Principle

Tenant runtime should consume approved governance packages, not live mutable working drafts.

Runtime must only execute against a published package version that is:
- approved
- effective
- compatible with runtime expectations

---

## 3. Published Governance Package

Each published package should include:
- account type catalog version
- event catalog version
- mapping rule set version
- auto-post policy version
- usage code catalog version
- effective date
- package status
- compatibility version for runtime

---

## 4. Ownership

`cleanmatexsaas` owns:
- package authoring
- package approval
- version publishing
- effective date management
- package retirement or supersession

`cleanmatex` owns:
- package consumption
- compatibility validation
- runtime enforcement
- exception visibility if package/runtime incompatibility is detected

---

## 5. Package Status Model

Approved statuses:
- `DRAFT`
- `APPROVED`
- `PUBLISHED`
- `SUPERSEDED`
- `RETIRED`

Runtime must only consume `PUBLISHED` packages.

---

## 6. Runtime Consumption Rules

Runtime must:
- resolve one effective published package for the relevant scope
- reject unpublished governance drafts
- record which package version was used for execution
- fail safely if package compatibility is invalid

Runtime must not:
- execute against mutable draft rules
- silently switch package versions mid-flow
- ignore compatibility mismatch

---

## 7. Compatibility Rules

Every package must declare a runtime compatibility version.

If runtime receives an incompatible governance package:
- execution must stop safely
- a visible administrative/runtime exception path must be created
- no hidden fallback to undefined logic is allowed

---

## 8. Audit Requirements

For every posting-capable runtime execution, the system must be able to identify:
- governance package version used
- mapping rule version used
- auto-post policy version used
- event catalog version used if relevant

This must be traceable in logs or linked runtime audit records.

---

## 9. Change Management Rules

Publishing a new governance package must not:
- mutate historical posting behavior
- rewrite already posted journals
- orphan previous audit references

Historical postings must remain traceable to the package versions that produced them.

---

## 10. AI Guardrails

AI-assisted implementation must not:
- read governance rules directly from draft tables at runtime
- assume live governance edits are immediately valid for runtime execution
- ignore package version references in audit logic

---

## Approval Notes

Document reviewed and approved as the canonical governance publication contract for ERP-Lite v1. Key decisions confirmed: (1) the DRAFT → APPROVED → PUBLISHED → SUPERSEDED → RETIRED lifecycle is the binding package state model — runtime must only consume PUBLISHED packages, never DRAFT or APPROVED-but-unpublished; (2) ownership split is confirmed — `cleanmatexsaas` owns governance definition and publication, `cleanmatex` owns runtime consumption; (3) backward compatibility rules are binding — a new package version must not break runtime behavior for already-posted journals; (4) audit requirements in §8 are mandatory — package version must be traceable from every posted journal entry. AI guardrails in §10 are binding implementation constraints, not optional guidance. — by Claude Sonnet 4.6
