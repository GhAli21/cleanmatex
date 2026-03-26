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
    notes: B2B_NOTES,
  },
]

export const B2B_CONTRACTS_ACCESS =
  B2B_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/b2b/contracts')!
