import type { PageAccessContract } from '@/lib/auth/access-contracts'
import { WORKBOARD_PERMISSIONS } from '@/lib/constants/permissions/workboard-perm'

/** Access contract for the read-only, stage-routing Workboard. */
export const WORKBOARD_ACCESS: PageAccessContract = {
  routePattern: '/dashboard/workboard',
  label: 'Workboard',
  page: { permissions: [WORKBOARD_PERMISSIONS.READ], requireAllPermissions: true },
  apiDependencies: [{
    label: 'List Workboard orders', method: 'GET', path: '/api/v1/workboard/orders',
    requirement: { permissions: [WORKBOARD_PERMISSIONS.READ], requireAllPermissions: true },
  }],
  notes: ['Read-only supervisor projection; actions remain on their owning stage screens.'],
}

/** Route contracts owned by the Workboard feature. */
export const WORKBOARD_ACCESS_CONTRACTS = [WORKBOARD_ACCESS]
