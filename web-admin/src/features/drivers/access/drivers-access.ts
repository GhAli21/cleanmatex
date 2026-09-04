import type { PageAccessContract } from '@/lib/auth/access-contracts';

const DRIVER_NOTES = [
  'Driver management screens gated by drivers:read permission. driver_app gates the separate, future driver mobile app — not this staff dispatcher UI.',
];

export const DRIVERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/drivers',
    label: 'Drivers',
    page: {
      permissions: ['drivers:read'],
      requireAllPermissions: true,
    },
    notes: DRIVER_NOTES,
  },
  {
    routePattern: '/dashboard/drivers/routes',
    label: 'Driver Routes',
    page: {
      permissions: ['drivers:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'List delivery routes',
        method: 'GET',
        path: '/api/v1/delivery/routes',
        notes: ['Auth-only list route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Create delivery route',
        method: 'POST',
        path: '/api/v1/delivery/routes',
        notes: ['Auth-only create route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: DRIVER_NOTES,
  },
];
export const DRIVERS_DRIVERS_ACCESS =
  DRIVERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/drivers')!
export const DRIVERS_DRIVERS_ROUTES_ACCESS =
  DRIVERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/drivers/routes')!
