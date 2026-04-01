---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_GO_LIVE_CHECKLIST_2026_04_01
status: Active
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Go-Live Checklist

## 1. Purpose

This checklist is for the production rollout day of ERP-Lite.

## 2. Go-Live Preconditions

- [ ] pilot tenant passed
- [ ] UAT signoff completed
- [ ] HQ governance package approved and published
- [ ] rollout tenant list confirmed
- [ ] ERP-Lite plan/flag strategy confirmed
- [ ] permission mapping by role confirmed
- [ ] finance owner available during rollout window
- [ ] operations owner available during rollout window
- [ ] rollback / disable plan agreed

## 3. Before Enabling

- [ ] verify target tenant COA exists
- [ ] verify usage mappings exist
- [ ] verify accounting period is open
- [ ] verify required branches exist
- [ ] verify petty cash mappings if used
- [ ] verify bank account setup if used
- [ ] verify published package version to be used

## 4. Enablement Steps

- [ ] enable `erp_lite_enabled`
- [ ] enable required sub-flags only
- [ ] verify ERP-Lite navigation visibility
- [ ] verify intended users can access ERP-Lite
- [ ] verify unintended users cannot access ERP-Lite

## 5. Production Smoke Tests

- [ ] create test invoice and confirm posting
- [ ] create test payment and confirm posting
- [ ] verify GL inquiry updates
- [ ] verify trial balance updates
- [ ] verify AR aging updates
- [ ] create one expense and verify posting
- [ ] create one petty cash movement and verify posting
- [ ] if AP enabled, create one AP invoice and one AP payment
- [ ] if bank recon enabled, import one statement sample and verify matching path
- [ ] if branch profitability enabled, verify Branch P&L loads

## 6. Monitoring

- [ ] monitor first posting logs
- [ ] monitor first exceptions
- [ ] capture first journal numbers
- [ ] capture first reconciliation IDs
- [ ] capture first allocation/cost run IDs if v3 is enabled

## 7. Hold / Rollback Conditions

Hold rollout if any of these happen:

- [ ] finance posting produces incorrect journals
- [ ] tenant isolation issue found
- [ ] users without permissions access ERP-Lite
- [ ] core reports materially mismatch posted reality
- [ ] high-severity production error repeats

## 8. Go-Live Outcome

- Result: `Go` / `Go with monitoring` / `Hold`
- Start time:
- End time:
- Enabled tenant(s):
- High-severity issues:
- Follow-up owners:

## 9. Related Documents

- [ERP_LITE_UAT_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_UAT_PACK.md)
- [ERP_LITE_PILOT_TENANT_CHECKLIST.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_PILOT_TENANT_CHECKLIST.md)
- [ERP_LITE_REMAINING_ITEMS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_REMAINING_ITEMS.md)
