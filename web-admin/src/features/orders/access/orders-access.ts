import type { PageAccessContract } from '@/lib/auth/access-contracts'

const ORDER_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const ORDERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/orders',
    label: 'Orders',
    page: {},
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
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]',
    label: 'Order Details',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/orders/[id]/edit',
    label: 'Edit Order',
    page: {},
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
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/ready/[id]/print/[type]',
    label: 'Print Ready Document',
    page: {},
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
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/delivery',
    label: 'Delivery',
    page: {},
    notes: ORDER_NOTES,
  },
  {
    routePattern: '/dashboard/receipts/[orderId]',
    label: 'Receipt Details',
    page: {},
    notes: ORDER_NOTES,
  },
]

export const NEW_ORDER_ACCESS =
  ORDERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/orders/new')!
