import type { PageAccessContract } from '@/lib/auth/access-contracts'

const CUSTOMERS_NOTES = [
  'No explicit UI permission gate; route relies on shell context, navigation visibility, or backend enforcement.',
]

export const CUSTOMERS_ACCESS_CONTRACTS: PageAccessContract[] = [
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
    apiDependencies: [
      {
        label: 'List customers',
        method: 'GET',
        path: '/api/v1/customers',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Customer statistics',
        method: 'GET',
        path: '/api/v1/customers?includeStats=true',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
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
        label: 'Export customers',
        method: 'GET',
        path: '/api/v1/customers/export',
        notes: ['Auth-only export route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: CUSTOMERS_NOTES,
  },
  {
    routePattern: '/dashboard/customers/account-receipt',
    label: 'Customer Account Receipt',
    page: {
      permissions: ['customers:receipt_allocate'],
      requireAllPermissions: true,
    },
    notes: ['Standalone customer account receipt allocation screen.'],
  },
  {
    routePattern: '/dashboard/customers/stored-value',
    label: 'Stored Value',
    page: {
      permissions: ['stored_value:view_balances'],
      requireAllPermissions: true,
    },
    notes: ['Stored value balances route requires the dedicated stored value viewer permission from navigation.'],
  },
  {
    routePattern: '/dashboard/customers/[id]',
    label: 'Customer Details',
    page: {},
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
        label: 'Customer preferences',
        method: 'GET',
        path: '/api/v1/customers/[id]/service-prefs',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update customer preferences',
        method: 'POST',
        path: '/api/v1/customers/[id]/service-prefs',
        requirement: {
          permissions: ['customers:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Catalog service preferences',
        method: 'GET',
        path: '/api/v1/catalog/service-preferences',
        requirement: {
          permissions: ['orders:read'],
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
    notes: CUSTOMERS_NOTES,
  },
]

export const CUSTOMERS_CUSTOMERS_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[0]!
export const CUSTOMERS_CUSTOMERS_ACCOUNT_RECEIPT_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[1]!
export const CUSTOMERS_CUSTOMERS_STORED_VALUE_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[2]!
export const CUSTOMERS_CUSTOMERS_ID_ACCESS = CUSTOMERS_ACCESS_CONTRACTS[3]!
