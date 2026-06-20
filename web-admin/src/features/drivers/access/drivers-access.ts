import type { PageAccessContract } from '@/lib/auth/access-contracts';

const DRIVER_NOTES = [
  'Driver management screens gated by driver_app feature flag and drivers:read permission.',
];

export const DRIVERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/drivers',
    label: 'Drivers',
    page: {
      permissions: ['drivers:read'],
      requireAllPermissions: true,
      featureFlags: ['driver_app'],
      requireAllFeatureFlags: true,
    },
    notes: DRIVER_NOTES,
  },
  {
    routePattern: '/dashboard/drivers/routes',
    label: 'Driver Routes',
    page: {
      permissions: ['drivers:read'],
      requireAllPermissions: true,
      featureFlags: ['driver_app'],
      requireAllFeatureFlags: true,
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
