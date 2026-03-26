import type { PageAccessContract } from '@/lib/auth/access-contracts'

const ORDER_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const ORDERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/orders',
    label: 'Orders',
    page: {},
    apiDependencies: [
      {
        label: 'List orders',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/new',
    label: 'New Order',
    page: {},
    actions: {
      priceOverride: {
        label: 'Use price override controls',
        requirement: {
          permissions: ['pricing:override'],
          requireAllPermissions: true,
        },
      },
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
        label: 'Preview payment',
        method: 'POST',
        path: '/api/v1/orders/preview-payment',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create order with payment',
        method: 'POST',
        path: '/api/v1/orders/create-with-payment',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Resolve preferences',
        method: 'POST',
        path: '/api/v1/preferences/resolve',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Suggest preferences',
        method: 'GET',
        path: '/api/v1/preferences/suggest',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Repeat last order',
        method: 'GET',
        path: '/api/v1/preferences/last-order',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Default guest customer',
        method: 'GET',
        path: '/api/v1/tenant-settings/default-guest-customer',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Search customers',
        method: 'GET',
        path: '/api/v1/customers',
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
        label: 'List B2B contracts',
        method: 'GET',
        path: '/api/v1/b2b-contracts?customer_id=[customerId]',
        requirement: {
          permissions: ['b2b_contracts:view'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories?enabled=true',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'List products',
        method: 'GET',
        path: '/api/v1/products',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]',
    label: 'Order Details',
    page: {},
    apiDependencies: [
      {
        label: 'Get order',
        method: 'GET',
        path: '/api/v1/orders/[id]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Order transitions',
        method: 'GET',
        path: '/api/v1/orders/[id]/transitions',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]/edit',
    label: 'Edit Order',
    page: {},
    apiDependencies: [
      {
        label: 'Get order',
        method: 'GET',
        path: '/api/v1/orders/[id]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Editability',
        method: 'GET',
        path: '/api/v1/orders/[id]/editability',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Lock order',
        method: 'POST',
        path: '/api/v1/orders/[id]/lock',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Unlock order',
        method: 'POST',
        path: '/api/v1/orders/[id]/unlock',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Update order',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]/prepare',
    label: 'Prepare Order',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]/full',
    label: 'Full Order Details',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/preparation',
    label: 'Preparation',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/preparation/[orderId]',
    label: 'Preparation Details',
    page: {},
    apiDependencies: [
      {
        label: 'Preparation preview',
        method: 'GET',
        path: '/api/v1/preparation/[id]/preview',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Preparation items',
        method: 'POST',
        path: '/api/v1/preparation/[id]/items',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Preparation item update',
        method: 'PATCH',
        path: '/api/v1/preparation/[id]/items/[itemId]',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Complete preparation',
        method: 'POST',
        path: '/api/v1/preparation/[id]/complete',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/processing',
    label: 'Processing',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/processing/[id]',
    label: 'Processing Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Processing steps',
        method: 'GET',
        path: '/api/v1/processing-steps/[category]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Order pieces',
        method: 'GET',
        path: '/api/v1/orders/[id]/pieces',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Batch update order',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Split order',
        method: 'POST',
        path: '/api/v1/orders/[id]/split',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Transition order',
        method: 'POST',
        path: '/api/v1/orders/[id]/transition',
        requirement: {
          permissions: ['orders:transition'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/assembly',
    label: 'Assembly',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/assembly/[id]',
    label: 'Assembly Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Assembly dashboard',
        method: 'GET',
        path: '/api/v1/assembly/dashboard',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/qa',
    label: 'Quality Check',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/qa/[id]',
    label: 'Quality Check Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Create issue',
        method: 'POST',
        path: '/api/v1/orders/[id]/issue',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/ready',
    label: 'Ready',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/ready/[id]',
    label: 'Ready Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/ready/[id]/print/[type]',
    label: 'Print Ready Document',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Order history',
        method: 'GET',
        path: '/api/v1/orders/[id]/history',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Print invoice and payments report',
        method: 'GET',
        path: '/api/v1/orders/[id]/report/invoices-payments-rprt',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Print payments report',
        method: 'GET',
        path: '/api/v1/orders/[id]/report/payments-rprt',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/packing',
    label: 'Packing',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/packing/[id]',
    label: 'Packing Details',
    page: {},
    apiDependencies: [
      {
        label: 'Order state',
        method: 'GET',
        path: '/api/v1/orders/[id]/state',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Batch update order',
        method: 'PATCH',
        path: '/api/v1/orders/[id]/batch-update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/delivery',
    label: 'Delivery',
    page: {},
    apiDependencies: [
      {
        label: 'List delivery orders',
        method: 'GET',
        path: '/api/v1/orders',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List delivery routes',
        method: 'GET',
        path: '/api/v1/delivery/routes',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/receipts/[orderId]',
    label: 'Receipt Details',
    page: {},
    apiDependencies: [
      {
        label: 'Get order',
        method: 'GET',
        path: '/api/v1/orders/[id]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'List receipts for order',
        method: 'GET',
        path: '/api/v1/receipts/orders/[orderId]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Create receipt for order',
        method: 'POST',
        path: '/api/v1/receipts/orders/[orderId]',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Resend receipt',
        method: 'POST',
        path: '/api/v1/receipts/[id]/resend',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: ORDER_NOTES,
  },
]

export const NEW_ORDER_ACCESS =
  ORDERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/orders/new')!
