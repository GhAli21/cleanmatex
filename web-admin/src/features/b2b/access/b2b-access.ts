import type { PageAccessContract } from '@/lib/auth/access-contracts'

const B2B_NOTES = [
  'No explicit UI permission gate beyond the route contract; route relies on feature flags, navigation visibility, and backend enforcement.',
]

export const B2B_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/b2b/customers',
    label: 'B2B Customers',
    page: {
      permissions: ['b2b_customers:view'],
      featureFlags: ['b2b_contracts'],
      requireAllPermissions: true,
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'List customers',
        method: 'GET',
        path: '/api/v1/customers?type=b2b',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
    ],
  },
  {
    routePattern: '/dashboard/b2b/customers/new',
    label: 'New B2B Customer',
    page: {
      permissions: ['b2b_customers:view'],
      featureFlags: ['b2b_contracts'],
      requireAllPermissions: true,
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Create customer',
        method: 'POST',
        path: '/api/v1/customers',
        requirement: {
          permissions: ['customers:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List B2B customer categories',
        method: 'GET',
        path: '/api/v1/customer-categories?is_b2b=true&active_only=true',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: B2B_NOTES,
  },
  {
    routePattern: '/dashboard/b2b/customers/[id]',
    label: 'B2B Customer Details',
    page: {
      permissions: ['b2b_customers:view'],
      featureFlags: ['b2b_contracts'],
      requireAllPermissions: true,
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Get customer details',
        method: 'GET',
        path: '/api/v1/customers/[id]',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List customer B2B contacts',
        method: 'GET',
        path: '/api/v1/b2b-contacts?customer_id=[id]',
        requirement: {
          permissions: ['b2b_contacts:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List customer B2B contracts',
        method: 'GET',
        path: '/api/v1/b2b-contracts?customer_id=[id]',
        requirement: {
          permissions: ['b2b_contracts:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List customer B2B statements',
        method: 'GET',
        path: '/api/v1/b2b-statements?customer_id=[id]',
        requirement: {
          permissions: ['b2b_statements:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: B2B_NOTES,
  },
  {
    routePattern: '/dashboard/b2b/customers/[id]/edit',
    label: 'Edit B2B Customer',
    page: {
      permissions: ['b2b_customers:view'],
      featureFlags: ['b2b_contracts'],
      requireAllPermissions: true,
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Get customer details',
        method: 'GET',
        path: '/api/v1/customers/[id]',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update customer',
        method: 'PATCH',
        path: '/api/v1/customers/[id]',
        requirement: {
          permissions: ['customers:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List B2B customer categories',
        method: 'GET',
        path: '/api/v1/customer-categories?is_b2b=true&active_only=true',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: B2B_NOTES,
  },
  {
    routePattern: '/dashboard/b2b/contracts',
    label: 'B2B Contracts',
    page: {
      permissions: ['b2b_contracts:view'],
      featureFlags: ['b2b_contracts'],
      requireAllPermissions: true,
      requireAllFeatureFlags: true,
    },
    actions: {
      createContract: {
        label: 'Create contract',
        requirement: {
          permissions: ['b2b_contracts:create'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List contracts',
        method: 'GET',
        path: '/api/v1/b2b-contracts',
        requirement: {
          permissions: ['b2b_contracts:view'],
          requireAllPermissions: true,
        },
        notes: ['Used to load the contracts table and empty state.'],
      },
      {
        label: 'Create contract',
        method: 'POST',
        path: '/api/v1/b2b-contracts',
        requirement: {
          permissions: ['b2b_contracts:create'],
          requireAllPermissions: true,
        },
        notes: ['Used when submitting the create contract dialog.'],
      },
    ],
  },
  {
    routePattern: '/dashboard/b2b/statements',
    label: 'B2B Statements',
    page: {
      permissions: ['b2b_statements:view'],
      featureFlags: ['b2b_contracts'],
      requireAllPermissions: true,
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'List overdue statements',
        method: 'GET',
        path: '/api/v1/b2b/overdue-statements',
        requirement: {
          permissions: ['b2b_statements:view'],
          requireAllPermissions: true,
        },
      },
    ],
  },
  {
    routePattern: '/dashboard/b2b/statements/[id]',
    label: 'B2B Statement Details',
    page: {
      permissions: ['b2b_statements:view'],
      featureFlags: ['b2b_contracts'],
      requireAllPermissions: true,
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Get statement details',
        method: 'GET',
        path: '/api/v1/b2b-statements/[id]',
        requirement: {
          permissions: ['b2b_statements:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Print statement',
        method: 'GET',
        path: '/api/v1/b2b-statements/[id]/print',
        requirement: {
          permissions: ['b2b_statements:view'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: B2B_NOTES,
  },
]

export const B2B_CONTRACTS_ACCESS =
  B2B_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/b2b/contracts')!
