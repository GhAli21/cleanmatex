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
        label: 'User activity (audit trail)',
        method: 'GET',
        path: '/api/users/[userId]/activity',
        requirement: { permissions: ['audit:read'] },
        enforcement: 'permission',
        notes: ['Local web-admin route; requirePermission("audit:read"); service-role read of sys_auth_audit_log scoped to the caller tenant.'],
      },
      {
        label: 'Read user code',
        method: 'GET',
        path: '/api/users/[userId]/user-code',
        requirement: { permissions: ['users:read'] },
        enforcement: 'permission',
        notes: ['Local web-admin route; requirePermission("users:read"); tenant-scoped membership read.'],
      },
      {
        label: 'Change user code',
        method: 'PATCH',
        path: '/api/users/[userId]/user-code',
        requirement: { permissions: ['users:update'] },
        enforcement: 'permission',
        notes: ['Local web-admin route; requirePermission("users:update"); platform-wide unique code; change audited by DB trigger (USER_CODE_CHANGED).'],
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
