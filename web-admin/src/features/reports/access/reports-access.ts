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
