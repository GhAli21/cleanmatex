import type { PageAccessContract } from '@/lib/auth/access-contracts'

export const REPORTS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/reports',
    label: 'Reports',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/orders',
    label: 'Orders Report',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/payments',
    label: 'Payments Report',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/invoices',
    label: 'Invoices Report',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/revenue',
    label: 'Revenue Report',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/financial',
    label: 'Financial Report',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/customers',
    label: 'Customers Report',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/print',
    label: 'Print Reports',
    page: {
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
  },
  {
    routePattern: '/dashboard/reports/reconciliation',
    label: 'Reconciliation Reports',
    page: {
      permissions: ['finance_reports:view'],
      requireAllPermissions: true,
      featureFlags: ['advanced_analytics'],
      requireAllFeatureFlags: true,
    },
    notes: ['D-09 read-only reconciliation report views.'],
  },
  {
    routePattern: '/dashboard/reports/cash-variance',
    label: 'Cash Variance by Cashier',
    page: {
      permissions: ['cash_drawer:view_reports'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Cash variance by cashier report (C4)',
        method: 'GET',
        path: '/api/v1/cash-drawers/variance-report',
        requirement: { permissions: ['cash_drawer:view_reports'], requireAllPermissions: true },
        enforcement: 'permission',
        notes: ['Limited server-side to the permitted branches of the actor; branchId can only narrow it.'],
      },
      {
        label: 'Branch picker',
        method: 'GET',
        path: '/api/v1/branches',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
    ],
    notes: ['C4 per-cashier variance history. Nav entry: migration 0560 / navigation.ts reports_cash_variance.'],
  },
  {
    routePattern: '/dashboard/reports/cash-variance/print',
    label: 'Cash Variance by Cashier (print)',
    page: {
      permissions: ['cash_drawer:view_reports'],
      requireAllPermissions: true,
    },
  },
]

export const REPORTS_REPORTS_ACCESS = REPORTS_ACCESS_CONTRACTS[0]!
export const REPORTS_REPORTS_ORDERS_ACCESS = REPORTS_ACCESS_CONTRACTS[1]!
export const REPORTS_REPORTS_PAYMENTS_ACCESS = REPORTS_ACCESS_CONTRACTS[2]!
export const REPORTS_REPORTS_INVOICES_ACCESS = REPORTS_ACCESS_CONTRACTS[3]!
export const REPORTS_REPORTS_REVENUE_ACCESS = REPORTS_ACCESS_CONTRACTS[4]!
export const REPORTS_REPORTS_FINANCIAL_ACCESS = REPORTS_ACCESS_CONTRACTS[5]!
export const REPORTS_REPORTS_CUSTOMERS_ACCESS = REPORTS_ACCESS_CONTRACTS[6]!
export const REPORTS_REPORTS_PRINT_ACCESS = REPORTS_ACCESS_CONTRACTS[7]!
export const REPORTS_REPORTS_RECONCILIATION_ACCESS = REPORTS_ACCESS_CONTRACTS[8]!
export const REPORTS_REPORTS_CASH_VARIANCE_ACCESS = REPORTS_ACCESS_CONTRACTS[9]!
export const REPORTS_REPORTS_CASH_VARIANCE_PRINT_ACCESS = REPORTS_ACCESS_CONTRACTS[10]!
