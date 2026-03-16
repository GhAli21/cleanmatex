---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# ERP-Lite Permissions

Permissions for ERP-Lite follow the `resource:action` pattern (e.g. `b2b_customers:view`). They are stored in `sys_auth_permissions` and assigned to roles via `sys_auth_role_default_permissions`.

---

## Permission List

### Main / Section

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite:view` | View Finance & Accounting | عرض المالية والمحاسبة | Access ERP-Lite section (gate for nav) |

### Chart of Accounts

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_coa:view` | View Chart of Accounts | عرض دليل الحسابات | View COA list and hierarchy |
| `erp_lite_coa:create` | Create Account | إنشاء حساب | Add new account |
| `erp_lite_coa:edit` | Edit Chart of Accounts | تعديل دليل الحسابات | Edit account |
| `erp_lite_coa:delete` | Delete Account | حذف حساب | Soft-delete account (when not in use) |

### General Ledger

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_gl:view` | View General Ledger | عرض دفتر الأستاذ العام | View GL entries |
| `erp_lite_gl:edit` | Post GL Entries | ترحيل دفتر الأستاذ | Create manual GL entries |
| `erp_lite_gl:reverse` | Reverse GL Entries | عكس قيود دفتر الأستاذ | Reverse posted entries |

### Financial Reports

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_reports:view` | View Financial Reports | عرض التقارير المالية | P&L, Balance Sheet, Cash Flow |
| `erp_lite_reports:export` | Export Reports | تصدير التقارير | PDF, Excel export |

### AR Aging

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_ar:view` | View AR Aging | عرض تقييم الذمم المدينة | AR aging report |

### Bank Reconciliation

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_bank_recon:view` | View Bank Reconciliation | عرض التسوية البنكية | View bank accounts and transactions |
| `erp_lite_bank_recon:edit` | Reconcile Bank | تسوية البنك | Import, match, reconcile |

### Accounts Payable

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_ap:view` | View AP | عرض حسابات الدائنين | View AP invoices and payments |
| `erp_lite_ap:create` | Create AP Invoice | إنشاء فاتورة مورد | Record supplier invoice |
| `erp_lite_ap:edit` | Edit AP | تعديل حسابات الدائنين | Edit AP, record payment |

### Purchase Orders

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_po:view` | View Purchase Orders | عرض أوامر الشراء | View PO list |
| `erp_lite_po:create` | Create PO | إنشاء أمر شراء | Create purchase order |
| `erp_lite_po:edit` | Edit PO | تعديل أمر الشراء | Edit PO |

### Expense Management

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_expenses:view` | View Expenses | عرض المصروفات | View expense claims |
| `erp_lite_expenses:create` | Submit Expense | تقديم مصروف | Submit expense claim |
| `erp_lite_expenses:approve` | Approve Expense | الموافقة على المصروف | Approve/reject expense |

### Branch P&L

| Permission Code | Name | Name2 | Description |
|-----------------|------|-------|-------------|
| `erp_lite_branch_pl:view` | View Branch P&L | عرض قائمة دخل الفروع | Branch profitability report |

---

## Role Assignments

| Role | Permissions |
|------|-------------|
| super_admin | All erp_lite_* permissions |
| tenant_admin | All erp_lite_* permissions |
| tenant_finance | All erp_lite_* permissions (view + edit) |
| tenant_manager | erp_lite:view, erp_lite_reports:view, erp_lite_ar:view, erp_lite_branch_pl:view |
| tenant_operator | None (or erp_lite_reports:view if needed) |

---

## Migration Template

```sql
-- ERP-Lite permissions
INSERT INTO sys_auth_permissions (code, name, name2, category, description, description2, category_main, is_active, is_enabled, rec_status, created_at, created_by)
VALUES
  ('erp_lite:view', 'View Finance & Accounting', 'عرض المالية والمحاسبة', 'crud', 'Access ERP-Lite section', 'الوصول لقسم المالية والمحاسبة', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_coa:view', 'View Chart of Accounts', 'عرض دليل الحسابات', 'crud', 'View COA', 'عرض دليل الحسابات', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_coa:create', 'Create Account', 'إنشاء حساب', 'crud', 'Add new account', 'إضافة حساب جديد', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_coa:edit', 'Edit Chart of Accounts', 'تعديل دليل الحسابات', 'crud', 'Edit account', 'تعديل الحساب', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_gl:view', 'View General Ledger', 'عرض دفتر الأستاذ العام', 'crud', 'View GL entries', 'عرض قيود دفتر الأستاذ', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_gl:edit', 'Post GL Entries', 'ترحيل دفتر الأستاذ', 'crud', 'Create manual GL entries', 'إنشاء قيود يدوية', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_reports:view', 'View Financial Reports', 'عرض التقارير المالية', 'crud', 'P&L, Balance Sheet, Cash Flow', 'قائمة الدخل، الميزانية، التدفق النقدي', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_reports:export', 'Export Reports', 'تصدير التقارير', 'crud', 'Export PDF/Excel', 'تصدير PDF/Excel', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_ar:view', 'View AR Aging', 'عرض تقييم الذمم المدينة', 'crud', 'AR aging report', 'تقرير تقييم الذمم المدينة', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_bank_recon:view', 'View Bank Reconciliation', 'عرض التسوية البنكية', 'crud', 'View bank recon', 'عرض التسوية البنكية', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_bank_recon:edit', 'Reconcile Bank', 'تسوية البنك', 'crud', 'Import and reconcile', 'استيراد وتسوية', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_ap:view', 'View AP', 'عرض حسابات الدائنين', 'crud', 'View AP', 'عرض حسابات الدائنين', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_ap:create', 'Create AP Invoice', 'إنشاء فاتورة مورد', 'crud', 'Record supplier invoice', 'تسجيل فاتورة المورد', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_ap:edit', 'Edit AP', 'تعديل حسابات الدائنين', 'crud', 'Edit AP, record payment', 'تعديل AP، تسجيل الدفع', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_po:view', 'View Purchase Orders', 'عرض أوامر الشراء', 'crud', 'View POs', 'عرض أوامر الشراء', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_po:create', 'Create PO', 'إنشاء أمر شراء', 'crud', 'Create PO', 'إنشاء أمر شراء', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_po:edit', 'Edit PO', 'تعديل أمر الشراء', 'crud', 'Edit PO', 'تعديل أمر الشراء', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_expenses:view', 'View Expenses', 'عرض المصروفات', 'crud', 'View expense claims', 'عرض مطالبات المصروفات', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_expenses:create', 'Submit Expense', 'تقديم مصروف', 'crud', 'Submit expense claim', 'تقديم مطالبة مصروف', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_expenses:approve', 'Approve Expense', 'الموافقة على المصروف', 'crud', 'Approve/reject expense', 'الموافقة/الرفض على المصروف', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('erp_lite_branch_pl:view', 'View Branch P&L', 'عرض قائمة دخل الفروع', 'crud', 'Branch profitability', 'ربحية الفروع', 'ERP_LITE', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- Assign to super_admin, tenant_admin (example: expand per role as needed)
INSERT INTO sys_auth_role_default_permissions (role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by)
SELECT r, p, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM (VALUES ('super_admin'), ('tenant_admin')) AS roles(r)
CROSS JOIN (VALUES
  ('erp_lite:view'), ('erp_lite_coa:view'), ('erp_lite_coa:create'), ('erp_lite_coa:edit'), ('erp_lite_coa:delete'),
  ('erp_lite_gl:view'), ('erp_lite_gl:edit'), ('erp_lite_gl:reverse'),
  ('erp_lite_reports:view'), ('erp_lite_reports:export'),
  ('erp_lite_ar:view'),
  ('erp_lite_bank_recon:view'), ('erp_lite_bank_recon:edit'),
  ('erp_lite_ap:view'), ('erp_lite_ap:create'), ('erp_lite_ap:edit'),
  ('erp_lite_po:view'), ('erp_lite_po:create'), ('erp_lite_po:edit'),
  ('erp_lite_expenses:view'), ('erp_lite_expenses:create'), ('erp_lite_expenses:approve'),
  ('erp_lite_branch_pl:view')
) AS perms(p)
ON CONFLICT (role_code, permission_code) DO NOTHING;
```

---

## Navigation Integration

Each screen in `sys_components_cd` uses `main_permission_code` to gate access:

| comp_code | main_permission_code |
|-----------|----------------------|
| erp_lite | erp_lite:view |
| erp_lite_coa | erp_lite_coa:view |
| erp_lite_gl | erp_lite_gl:view |
| erp_lite_reports | erp_lite_reports:view |
| erp_lite_ar | erp_lite_ar:view |
| erp_lite_bank_recon | erp_lite_bank_recon:view |
| erp_lite_ap | erp_lite_ap:view |
| erp_lite_po | erp_lite_po:view |
| erp_lite_expenses | erp_lite_expenses:view |
| erp_lite_branch_pl | erp_lite_branch_pl:view |

---

## See Also

- [RBAC QUICK_REFERENCE](../RBAC/QUICK_REFERENCE.md)
- [B2B implementation_requirements](../B2B_Feature/implementation_requirements.md) — permission pattern
