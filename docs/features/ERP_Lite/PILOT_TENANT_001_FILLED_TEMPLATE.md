---
version: v1.0.0
last_updated: 2026-04-01
author: CleanMateX AI Assistant
document_id: ERP_LITE_PILOT_TENANT_001_TEMPLATE_2026_04_01
status: Template
implementation_project: cross-project
project_context:
  - cleanmatexsaas (Platform Level HQ)
  - cleanmatex (Tenant Runtime)
---

# ERP-Lite Pilot Tenant 001 Filled Template

## 1. Purpose

This is a ready-to-fill template for the first ERP-Lite pilot tenant.

## 2. Pilot Tenant Record

- Tenant name: `________________`
- Tenant ID: `________________`
- Plan: `________________`
- Pilot start date: `________________`
- Finance owner: `________________`
- Operations owner: `________________`
- HQ governance owner: `________________`

## 3. Pre-Pilot Setup

- [ ] `erp_lite_enabled` enabled
- [ ] intended ERP-Lite sub-flags enabled
- [ ] intended tenant roles assigned ERP-Lite permissions
- [ ] published HQ governance package selected for pilot
- [ ] accounting period open
- [ ] baseline COA loaded
- [ ] usage mappings loaded
- [ ] branches configured
- [ ] petty cash account mapping configured if needed
- [ ] bank account configured if needed

## 4. Pilot Data Readiness

- [ ] sample customer invoices available
- [ ] sample refund scenario available
- [ ] petty cash box available
- [ ] suppliers available
- [ ] AP invoice and AP payment sample data available
- [ ] bank statement sample available
- [ ] multi-branch sample available for profitability

## 5. Pilot Execution Results

### 5.1 Access

- [ ] Finance & Accounting visible for intended users only
- [ ] unauthorized access blocked

### 5.2 Core Finance

- [ ] invoice posting works
- [ ] payment posting works
- [ ] refund posting works
- [ ] duplicate posting blocked
- [ ] failure path visible

### 5.3 Reports

- [ ] GL inquiry accepted
- [ ] trial balance accepted
- [ ] P&L accepted
- [ ] balance sheet accepted
- [ ] AR aging accepted

### 5.4 Expenses and Petty Cash

- [ ] expense flow accepted
- [ ] petty cash flow accepted
- [ ] approval flow accepted
- [ ] reconciliation flow accepted

### 5.5 AP / PO / Treasury

- [ ] supplier flow accepted
- [ ] PO flow accepted
- [ ] AP invoice flow accepted
- [ ] AP payment flow accepted
- [ ] bank statement import accepted
- [ ] bank matching accepted
- [ ] bank reconciliation accepted

### 5.6 Profitability and Costing

- [ ] allocation rule flow accepted
- [ ] allocation run flow accepted
- [ ] Branch P&L accepted
- [ ] cost component flow accepted
- [ ] cost run flow accepted
- [ ] cost summary accepted

## 6. Captured Evidence

- Sample journal numbers:
- Sample posting log IDs:
- Sample exception IDs:
- Report screenshots:
- Reconciliation IDs:
- Allocation run IDs:
- Cost run IDs:

## 7. Decision

- Result: `Pass` / `Pass with follow-ups` / `Fail`
- High-severity issues:
- Required fixes before wider rollout:
- Notes:

## 8. Signoff

- Finance owner:
- Operations owner:
- HQ governance owner:
- Signoff date:

## 9. Related Documents

- [ERP_LITE_PILOT_TENANT_CHECKLIST.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_PILOT_TENANT_CHECKLIST.md)
- [ERP_LITE_UAT_PACK.md](/home/dellunix/jhapp/cleanmatex/docs/features/ERP_Lite/ERP_LITE_UAT_PACK.md)
