import type { PageAccessContract } from '@/lib/auth/access-contracts'

const CORE_NOTES = [
  'No explicit UI permission gate; route relies on shell context, navigation visibility, or backend enforcement.',
]

export const CORE_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard',
    label: 'Dashboard',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/help',
    label: 'Help',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/jhtestui',
    label: 'JWT Test',
    page: {},
    notes: ['Debug route with no explicit UI permission gate.'],
  },
  {
    routePattern: '/dashboard/subscription',
    label: 'Subscription',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/customers',
    label: 'Customers',
    page: {},
    actions: {
      useB2bCustomerOptions: {
        label: 'Use B2B customer options',
        requirement: {
          featureFlags: ['b2b_contracts'],
          requireAllFeatureFlags: true,
        },
      },
    },
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/customers/[id]',
    label: 'Customer Details',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/users',
    label: 'Users',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/users/new',
    label: 'New User',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/users/[userId]',
    label: 'User Details',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/inventory',
    label: 'Inventory',
    page: {},
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/inventory/stock',
    label: 'Inventory Stock',
    page: {},
    notes: CORE_NOTES,
  },
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
]
