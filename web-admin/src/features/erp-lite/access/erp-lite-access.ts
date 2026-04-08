import type { PageAccessContract } from '@/lib/auth/access-contracts'

const ERP_LITE_RUNTIME_NOTES = [
  'This ERP-Lite area has active tenant runtime implementation behind the declared permission and feature-flag gate.',
  'The page contract is still the navigation and permissions-inspector source of truth for this route.',
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
    notes: ERP_LITE_RUNTIME_NOTES,
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
    apiDependencies: [
      {
        label: 'Create tenant account',
        method: 'POST',
        path: 'app/actions/erp-lite/coa-actions.createErpLiteAccountAction',
        requirement: {
          permissions: ['erp_lite_coa:create'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
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
    notes: ERP_LITE_RUNTIME_NOTES,
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
    notes: ERP_LITE_RUNTIME_NOTES,
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
    notes: ERP_LITE_RUNTIME_NOTES,
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
    notes: ERP_LITE_RUNTIME_NOTES,
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
    apiDependencies: [
      {
        label: 'Create bank account',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteBankAccountAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create statement batch',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteBankStatementAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create manual statement line',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteBankStatementLineAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Bulk import statement lines',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.importErpLiteBankStatementLinesAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create bank reconciliation',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteBankReconAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create bank match',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteBankMatchAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Reverse bank match',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.reverseErpLiteBankMatchAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Close bank reconciliation',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.closeErpLiteBankReconAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Lock bank reconciliation',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.lockErpLiteBankReconAction',
        requirement: {
          permissions: ['erp_lite_bank_recon:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
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
    apiDependencies: [
      {
        label: 'Create supplier',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteSupplierAction',
        requirement: {
          permissions: ['erp_lite_ap:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create AP invoice',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteApInvoiceAction',
        requirement: {
          permissions: ['erp_lite_ap:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create AP payment',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLiteApPaymentAction',
        requirement: {
          permissions: ['erp_lite_ap:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
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
    apiDependencies: [
      {
        label: 'Create purchase order',
        method: 'POST',
        path: 'app/actions/erp-lite/v2-actions.createErpLitePurchaseOrderAction',
        requirement: {
          permissions: ['erp_lite_po:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/readiness',
    label: 'Finance Readiness',
    page: {
      permissions: ['erp_lite:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_readiness_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_RUNTIME_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/usage-maps',
    label: 'Usage Mapping Console',
    page: {
      permissions: ['erp_lite_usage_map:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_usage_map_enabled'],
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Create usage map',
        method: 'POST',
        path: 'app/actions/erp-lite/ops-actions.createUsageMapAction',
        requirement: {
          permissions: ['erp_lite_usage_map:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Activate usage map',
        method: 'POST',
        path: 'app/actions/erp-lite/ops-actions.activateUsageMapAction',
        requirement: {
          permissions: ['erp_lite_usage_map:edit'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Deactivate usage map',
        method: 'POST',
        path: 'app/actions/erp-lite/ops-actions.deactivateUsageMapAction',
        requirement: {
          permissions: ['erp_lite_usage_map:edit'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/exceptions',
    label: 'Exception Workbench',
    page: {
      permissions: ['erp_lite:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_exceptions_enabled'],
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Resolve exception',
        method: 'POST',
        path: 'app/actions/erp-lite/ops-actions.resolveExceptionAction',
        requirement: {
          permissions: ['erp_lite_post_audit:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/periods',
    label: 'Period Management',
    page: {
      permissions: ['erp_lite:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_periods_enabled'],
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Create period',
        method: 'POST',
        path: 'app/actions/erp-lite/ops-actions.createPeriodAction',
        requirement: {
          permissions: ['erp_lite:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Close period',
        method: 'POST',
        path: 'app/actions/erp-lite/ops-actions.closePeriodAction',
        requirement: {
          permissions: ['erp_lite:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
  },
  {
    routePattern: '/dashboard/erp-lite/posting-audit',
    label: 'Posting Audit Viewer',
    page: {
      permissions: ['erp_lite_post_audit:view'],
      requireAllPermissions: true,
      featureFlags: ['erp_lite_enabled', 'erp_lite_post_audit_enabled'],
      requireAllFeatureFlags: true,
    },
    notes: ERP_LITE_RUNTIME_NOTES,
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
    apiDependencies: [
      {
        label: 'Create allocation rule',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.createErpLiteAllocationRuleAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create allocation run',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.createErpLiteAllocationRunAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Add allocation line',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.addErpLiteAllocationRunLineAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Post allocation run',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.postErpLiteAllocationRunAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:post'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create cost component',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.createErpLiteCostComponentAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create cost run',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.createErpLiteCostRunAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Add cost run detail',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.addErpLiteCostRunDetailAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Post cost run',
        method: 'POST',
        path: 'app/actions/erp-lite/branch-pl-actions.postErpLiteCostRunAction',
        requirement: {
          permissions: ['erp_lite_branch_pl:post'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ERP_LITE_RUNTIME_NOTES,
  },
]
