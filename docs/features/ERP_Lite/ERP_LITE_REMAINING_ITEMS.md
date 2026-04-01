---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_REMAINING_ITEMS_2026_04_01
status: Active
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Remaining Items

## 1. Purpose

This document lists the exact items still remaining after the ERP-Lite implementation phases in `cleanmatex` are complete.

It is a release close-out document, not a feature-planning document.

## 2. Current Truth

The following are complete in `cleanmatex`:

- Phase 0 through Phase 10 implementation
- applied ERP-Lite schema through `0195`
- tenant regression test pack
- tenant i18n parity validation
- tenant `web-admin` production build

## 3. Remaining Items

### 3.1 cleanmatexsaas Validation

Still remaining:

- run clean `platform-api` build validation in `cleanmatexsaas`
- run clean `platform-web` build validation in `cleanmatexsaas`
- confirm the implemented HQ governance screens and authoring flows compile in that sibling environment

Why it remains:

- the local `cleanmatexsaas` environment previously lacked `nest` and `next` binaries during implementation-time validation

### 3.2 HQ Governance Production Content

Still remaining:

- create the real ERP-Lite governance package(s) to be used in production
- validate the real posting rules and auto-post policy content
- approve and publish the actual production governance package version

Why it remains:

- the framework and authoring flow are implemented, but production business content still has to be curated and published

### 3.3 Role / Plan / Flag Rollout Verification

Still remaining:

- verify intended plans expose the correct ERP-Lite modules
- verify tenant roles have the intended `erp_lite_*:view` permissions
- verify non-entitled plans and roles do not see or use ERP-Lite routes/actions

### 3.4 Tenant UAT and Signoff

Still remaining:

- run the ERP-Lite UAT pack with real business users
- obtain finance signoff on journals, reports, AP/AR aging, and profitability outputs
- obtain operations signoff on expenses, petty cash, supplier, PO, AP, and bank-reconciliation flows

### 3.5 Production Rollout Control

Still remaining:

- choose pilot tenant(s)
- decide phased rollout order
- monitor first-live posting, inquiry, and reconciliation outcomes
- capture go-live issues and apply non-breaking fixes if needed

## 4. Not Remaining

These are not open implementation items anymore in `cleanmatex`:

- ERP-Lite tenant schema
- posting engine
- v1 auto-post
- v1 reports
- basic expenses and petty cash
- v2 treasury, suppliers, AP, PO runtime
- v3 advanced controls, allocation-aware branch profitability, and costing runtime foundations

## 5. Release Recommendation

ERP-Lite is ready for:

- controlled UAT
- pilot rollout
- HQ governance content publication

ERP-Lite is not yet fully closed operationally until:

- `cleanmatexsaas` build validation is clean
- production governance content is published
- UAT signoff is complete

## 6. Related Documents

- [IMPLEMENTATION_STATUS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_STATUS.md)
- [ERP_LITE_UAT_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_UAT_PACK.md)
- [PHASE_8_V1_PILOT_AND_HARDENING_CHECKLIST.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/PHASE_8_V1_PILOT_AND_HARDENING_CHECKLIST.md)
