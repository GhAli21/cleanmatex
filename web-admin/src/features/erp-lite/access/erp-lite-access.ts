import type { PageAccessContract } from '@/lib/auth/access-contracts'

const ERP_LITE_NOTES = [
  'Phase 1 shell route only. Finance runtime behavior, APIs, and posting logic are not implemented yet.',
  'Page contract is declarative so navigation, permissions inspector, and rollout docs stay aligned before backend enablement.',
]

export const ERP_LITE_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/erp-lite',
    label: 'Finance & Accounting',
    page: {
      permissions: ['erp_lite:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/coa',
    label: 'Chart of Accounts',
    page: {
      permissions: ['erp_lite_coa:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_gl_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/gl',
    label: 'General Ledger',
    page: {
      permissions: ['erp_lite_gl:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_gl_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/reports',
    label: 'Financial Reports',
    page: {
      permissions: ['erp_lite_reports:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_reports_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/ar',
    label: 'AR Aging',
    page: {
      permissions: ['erp_lite_ar:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_ar_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/expenses',
    label: 'Expenses',
    page: {
      permissions: ['erp_lite_expenses:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_expenses_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/bank-recon',
    label: 'Bank Reconciliation',
    page: {
      permissions: ['erp_lite_bank_recon:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_bank_recon_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/ap',
    label: 'Accounts Payable',
    page: {
      permissions: ['erp_lite_ap:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_ap_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/po',
    label: 'Purchase Orders',
    page: {
      permissions: ['erp_lite_po:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_po_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/branch-pl',
    label: 'Branch P&L',
    page: {
      permissions: ['erp_lite_branch_pl:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_branch_pl_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_NOTES,
  },
]
