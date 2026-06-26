import type { PageAccessContract } from '@/lib/auth/access-contracts'

const INVENTORY_NOTES = [
  'No explicit UI permission gate; route relies on shell context, navigation visibility, or backend enforcement.',
]

export const INVENTORY_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/inventory',
    label: 'Inventory',
    page: {},
    notes: INVENTORY_NOTES,
  },
  {
    routePattern: '/dashboard/inventory/stock',
    label: 'Inventory Stock',
    page: {},
    notes: INVENTORY_NOTES,
  },
  {
    routePattern: '/dashboard/inventory/machines',
    label: 'Inventory Machines',
    page: {
      permissions: ['inventory:read'],
      requireAllPermissions: true,
    },
    notes: ['Machine registry placeholder route aligned with navigation permissions.'],
  },
]

export const INVENTORY_INVENTORY_ACCESS = INVENTORY_ACCESS_CONTRACTS[0]!
export const INVENTORY_INVENTORY_STOCK_ACCESS = INVENTORY_ACCESS_CONTRACTS[1]!
export const INVENTORY_INVENTORY_MACHINES_ACCESS = INVENTORY_ACCESS_CONTRACTS[2]!
