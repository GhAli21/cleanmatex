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
        enforcement: 'auth_only',
        notes: ['Session + tenant_org_id; no granular permission yet.'],
      },
      {
        label: 'Subscription usage',
        method: 'GET',
        path: '/api/v1/subscriptions/usage',
        enforcement: 'auth_only',
        notes: ['Session + tenant_org_id; no granular permission yet.'],
      },
      {
        label: 'Tenant profile',
        method: 'GET',
        path: '/api/v1/tenants/me',
        enforcement: 'auth_only',
        notes: ['Session + tenant_org_id.'],
      },
      {
        label: 'Upgrade subscription',
        method: 'POST',
        path: '/api/v1/subscriptions/upgrade',
        enforcement: 'auth_only',
        notes: ['Session + tenant_org_id; no granular permission yet.'],
      },
      {
        label: 'Cancel subscription',
        method: 'POST',
        path: '/api/v1/subscriptions/cancel',
        enforcement: 'auth_only',
        notes: ['Session + tenant_org_id; no granular permission yet.'],
      },
    ],
    notes: TENANT_ADMIN_NOTES,
  },
]

export const TENANT_ADMIN_TENANT_ADMIN_SUBSCRIPTION_ACCESS = TENANT_ADMIN_ACCESS_CONTRACTS[0]!
