import type { PageAccessContract } from '@/lib/auth/access-contracts'

const TENANT_ADMIN_NOTES = [
  'No explicit UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const TENANT_ADMIN_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/tenant-admin/subscription',
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
    notes: TENANT_ADMIN_NOTES,
  },
]

export const TENANT_ADMIN_TENANT_ADMIN_SUBSCRIPTION_ACCESS = TENANT_ADMIN_ACCESS_CONTRACTS[0]!
