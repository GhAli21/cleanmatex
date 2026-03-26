import type { PageAccessContract } from '@/lib/auth/access-contracts'

const CORE_NOTES = [
  'No explicit UI permission gate; route relies on shell context, navigation visibility, or backend enforcement.',
]

export const CORE_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard',
    label: 'Dashboard',
    page: {},
    apiDependencies: [
      {
        label: 'Workflow stats widget',
        method: 'GET',
        path: '/api/dashboard/workflow-stats',
        notes: ['Auth-only dashboard widget route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Overdue orders widget',
        method: 'GET',
        path: '/api/orders/overdue',
        notes: ['Auth-only dashboard widget route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
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
    apiDependencies: [
      {
        label: 'List subscription plans',
        method: 'GET',
        path: '/api/v1/subscriptions/plans',
        notes: ['Auth-only subscription route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Subscription usage',
        method: 'GET',
        path: '/api/v1/subscriptions/usage',
        notes: ['Auth-only subscription route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Tenant profile',
        method: 'GET',
        path: '/api/v1/tenants/me',
        notes: ['Auth-only tenant profile route used by the subscription screen.'],
      },
      {
        label: 'Upgrade subscription',
        method: 'POST',
        path: '/api/v1/subscriptions/upgrade',
        notes: ['Auth-only subscription route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Cancel subscription',
        method: 'POST',
        path: '/api/v1/subscriptions/cancel',
        notes: ['Auth-only subscription route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
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
    notes: CORE_NOTES,
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
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/users',
    label: 'Users',
    page: {},
    apiDependencies: [
      {
        label: 'List users',
        method: 'GET',
        path: '/tenant-api/tenants/[tenantId]/users',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'User statistics',
        method: 'GET',
        path: '/tenant-api/tenants/[tenantId]/users/stats',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Role options',
        method: 'GET',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/users/new',
    label: 'New User',
    page: {},
    apiDependencies: [
      {
        label: 'Create user',
        method: 'POST',
        path: '/tenant-api/tenants/[tenantId]/users',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'Role options',
        method: 'GET',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
    notes: CORE_NOTES,
  },
  {
    routePattern: '/dashboard/users/[userId]',
    label: 'User Details',
    page: {},
    apiDependencies: [
      {
        label: 'Get user',
        method: 'GET',
        path: '/tenant-api/tenants/[tenantId]/users/[userId]',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'Update user',
        method: 'PATCH',
        path: '/tenant-api/tenants/[tenantId]/users/[userId]',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Role options',
        method: 'GET',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
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
