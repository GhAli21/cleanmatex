---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_PILOT_TENANT_CHECKLIST_2026_04_01
status: Active
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Pilot Tenant Checklist

## 1. Purpose

This document is the short operational checklist for rolling out ERP-Lite to one pilot tenant.

Use it after the broader UAT pack is accepted.

## 2. Pilot Tenant Record

- Tenant name:
- Tenant ID:
- Plan:
- Pilot start date:
- Finance owner:
- Operations owner:
- HQ governance owner:

## 3. Pre-Pilot Setup

- [ ] `erp_lite_enabled` is enabled for the pilot tenant
- [ ] only the intended ERP-Lite sub-flags are enabled
- [ ] target roles have the correct `erp_lite_*:view` permissions
- [ ] published HQ governance package exists for pilot usage
- [ ] pilot tenant has open accounting period
- [ ] pilot tenant has baseline COA and usage mappings
- [ ] pilot tenant has required branches configured
- [ ] pilot tenant has at least one petty cash account mapping if petty cash is included
- [ ] pilot tenant has at least one bank account if treasury/AP is included

## 4. Pilot Data Readiness

- [ ] at least 2 customer invoices ready for posting validation
- [ ] at least 1 refund scenario available
- [ ] at least 1 petty cash box available
- [ ] at least 2 suppliers available if AP/PO is included
- [ ] at least 1 AP invoice and 1 AP payment scenario available
- [ ] at least 1 bank statement import scenario available
- [ ] at least 2 branches available if branch profitability is included

## 5. Pilot Execution

### 5.1 Access

- [ ] Finance & Accounting navigation is visible for intended users only
- [ ] unauthorized users do not see or cannot access ERP-Lite routes

### 5.2 Core Finance

- [ ] invoice posting works
- [ ] payment posting works
- [ ] refund posting works
- [ ] duplicate posting is blocked
- [ ] posting failures create visible exception behavior

### 5.3 Reports

- [ ] GL inquiry is readable and correct
- [ ] trial balance is correct
- [ ] P&L is correct
- [ ] balance sheet is correct
- [ ] AR aging is correct

### 5.4 Expenses and Petty Cash

- [ ] expense entry works
- [ ] petty cash movements work
- [ ] approval request / approve / reject works
- [ ] petty cash reconciliation / exception / close / lock works

### 5.5 AP / PO / Treasury

- [ ] supplier create/list works
- [ ] PO create/list works
- [ ] AP invoice create/list works
- [ ] AP payment works and updates balances correctly
- [ ] bank statement import works
- [ ] bank match and reverse work
- [ ] bank reconciliation close/lock works

### 5.6 Profitability and Costing

- [ ] allocation rule create works
- [ ] allocation run create / line / post works
- [ ] branch P&L shows direct and allocated values clearly
- [ ] cost component create works
- [ ] cost run create / detail / post works
- [ ] latest cost summary is visible and reasonable

## 6. Monitoring During Pilot

- [ ] sample journal numbers recorded
- [ ] sample posting log IDs recorded
- [ ] sample exception IDs recorded if failures occur
- [ ] report screenshots captured
- [ ] AP/bank reconciliation IDs captured
- [ ] allocation/cost run IDs captured

## 7. Pilot Exit Decision

- [ ] finance owner signs off
- [ ] operations owner signs off
- [ ] HQ governance owner signs off
- [ ] no high-severity defect remains
- [ ] no tenant-isolation defect remains
- [ ] no blocking permission/flag issue remains

## 8. Outcome

- Result: `Pass` / `Pass with follow-ups` / `Fail`
- Required fixes before wider rollout:
- Notes:

## 9. Related Documents

- [ERP_LITE_UAT_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_UAT_PACK.md)
- [ERP_LITE_REMAINING_ITEMS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_REMAINING_ITEMS.md)
- [IMPLEMENTATION_STATUS.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/IMPLEMENTATION_STATUS.md)
