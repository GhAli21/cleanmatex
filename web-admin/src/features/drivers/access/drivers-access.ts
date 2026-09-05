import type { PageAccessContract } from '@/lib/auth/access-contracts';

const DRIVER_NOTES = [
  'Driver management screens gated by drivers:read permission. driver_app gates the separate, future driver mobile app — not this staff dispatcher UI.',
];

/**
 * Canonical dashboard access contracts for driver management and dispatch.
 * Keep route permissions and client API dependencies together so permission
 * inventory generation can expose changes before a dispatcher loses access.
 */
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
      permissions: ['drivers:read', 'orders:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: '[Id] Active Stop',
        method: 'GET',
        path: '/api/v1/delivery/orders/[id]/active-stop',
        notes: ['Requires orders:read; prefilters active stops so an already-routed order cannot be selected.'],
      },
      {
        label: 'Server action: drivers-actions',
        method: 'POST',
        path: '/app/actions/drivers/drivers-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
      {
        label: 'List delivery routes',
        method: 'GET',
        path: '/api/v1/delivery/routes',
        notes: ['Requires drivers:read.'],
      },
      {
        label: 'Create delivery route',
        method: 'POST',
        path: '/api/v1/delivery/routes',
        notes: ['Requires delivery:routes; command locks and validates every selected order.'],
      },
      {
        label: 'Read route manifest',
        method: 'GET',
        path: '/api/v1/delivery/routes/[id]',
        notes: ['Requires drivers:read and orders:read.'],
      },
      {
        label: 'Assign route driver',
        method: 'POST',
        path: '/api/v1/delivery/routes/[id]/assign',
        notes: ['Requires delivery:assign.'],
      },
      {
        label: 'Add orders to route',
        method: 'POST',
        path: '/api/v1/delivery/routes/[id]/orders',
        notes: ['Requires delivery:routes; planned routes only.'],
      },
      {
        label: 'Remove route stop',
        method: 'DELETE',
        path: '/api/v1/delivery/routes/[id]/stops/[stopId]',
        notes: ['Requires delivery:routes; planned routes only.'],
      },
      {
        label: 'Cancel route',
        method: 'POST',
        path: '/api/v1/delivery/routes/[id]/cancel',
        notes: ['Requires delivery:routes; delivered stops remain unchanged.'],
      },
    ],
    notes: DRIVER_NOTES,
    actions: {
      assign: {
        label: 'Assign',
        requirement: {
          permissions: ['delivery:assign'],
          requireAllPermissions: true,
        },
      },
      routes: {
        label: 'Routes',
        requirement: {
          permissions: ['delivery:routes'],
          requireAllPermissions: true,
        },
      },
    },
  },
];
/** Access contract consumed by the driver management dashboard route. */
export const DRIVERS_DRIVERS_ACCESS =
  DRIVERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/drivers')!
/** Access contract consumed by the dispatcher route-planning dashboard route. */
export const DRIVERS_DRIVERS_ROUTES_ACCESS =
  DRIVERS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/drivers/routes')!
