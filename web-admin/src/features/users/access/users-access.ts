import type { PageAccessContract } from '@/lib/auth/access-contracts'

const USERS_NOTES = [
  'No explicit UI permission gate; route relies on shell context, navigation visibility, or backend enforcement.',
]

export const USERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/users',
    label: 'Users',
    page: {},
    apiDependencies: [
      {
        label: 'List users',
        method: 'GET',
        path: '/tenant-api/tenants/[tenantId]/users',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'User statistics',
        method: 'GET',
        path: '/tenant-api/tenants/[tenantId]/users/stats',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Role options',
        method: 'GET',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
    notes: USERS_NOTES,
  },
  {
    routePattern: '/dashboard/users/new',
    label: 'New User',
    page: {},
    apiDependencies: [
      {
        label: 'Create user',
        method: 'POST',
        path: '/tenant-api/tenants/[tenantId]/users',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'Role options',
        method: 'GET',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
    notes: USERS_NOTES,
  },
  {
    routePattern: '/dashboard/users/[userId]',
    label: 'User Details',
    page: {},
    apiDependencies: [
      {
        label: 'Get user',
        method: 'GET',
        path: '/tenant-api/tenants/[tenantId]/users/[userId]',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'Update user',
        method: 'PATCH',
        path: '/tenant-api/tenants/[tenantId]/users/[userId]',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Role options',
        method: 'GET',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
    notes: USERS_NOTES,
  },
]

export const USERS_USERS_ACCESS = USERS_ACCESS_CONTRACTS[0]!
export const USERS_USERS_NEW_ACCESS = USERS_ACCESS_CONTRACTS[1]!
export const USERS_USERS_USERID_ACCESS = USERS_ACCESS_CONTRACTS[2]!
