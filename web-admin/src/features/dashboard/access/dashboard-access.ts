import type { PageAccessContract } from '@/lib/auth/access-contracts'

const DASHBOARD_NOTES = [
  'No explicit UI permission gate; route relies on shell context, navigation visibility, or backend enforcement.',
]

export const DASHBOARD_ACCESS_CONTRACTS: PageAccessContract[] = [
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
    notes: DASHBOARD_NOTES,
  },
]

export const DASHBOARD_ACCESS = DASHBOARD_ACCESS_CONTRACTS[0]!
