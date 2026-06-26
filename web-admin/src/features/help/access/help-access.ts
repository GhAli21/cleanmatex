import type { PageAccessContract } from '@/lib/auth/access-contracts'
import { HELP_PERMISSIONS } from '@/lib/constants/permissions/help'

export { HELP_PERMISSIONS }

export const HELP_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/help',
    label: 'Help',
    page: {},
    actions: {
      openPlatformInventories: {
        label: 'Open Platform Inventories',
        requirement: {
          permissions: [HELP_PERMISSIONS.PLATFORM_INVENTORIES],
          requireAllPermissions: true,
        },
        notes: [
          'Gates the Platform Inventories card on this page and the /dashboard/help/platform-inventories route.',
        ],
      },
    },
    notes: [
      'Help hub has no page-level permission gate.',
      'Platform Inventories requires help:platform_inventories — see Actions below.',
    ],
  },
  {
    routePattern: '/dashboard/help/platform-inventories',
    label: 'Platform Inventories',
    page: {
      permissions: [HELP_PERMISSIONS.PLATFORM_INVENTORIES],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Platform inventories browser API',
        method: 'GET',
        path: '/api/dev/platform-inventories',
        requirement: {
          permissions: [HELP_PERMISSIONS.PLATFORM_INVENTORIES],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Read-only inventory browser; requires help:platform_inventories.'],
  },
]

export const HELP_HELP_ACCESS = HELP_ACCESS_CONTRACTS[0]!
export const HELP_HELP_PLATFORM_INVENTORIES_ACCESS = HELP_ACCESS_CONTRACTS[1]!

export const PLATFORM_INVENTORIES_PERMISSION = HELP_PERMISSIONS.PLATFORM_INVENTORIES
