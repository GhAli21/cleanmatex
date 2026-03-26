import type { PageAccessContract } from '@/lib/auth/access-contracts'

const SETTINGS_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const SETTINGS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/settings',
    label: 'Settings',
    page: {},
    apiDependencies: [
      {
        label: 'Settings categories',
        method: 'GET',
        path: '/api/settings/categories',
        notes: ['Auth-only settings route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/general',
    label: 'General Settings',
    page: {},
    apiDependencies: [
      {
        label: 'Tenant profile',
        method: 'GET',
        path: '/api/v1/tenants/me',
        notes: ['Auth-only tenant route used by settings forms.'],
      },
      {
        label: 'Settings categories',
        method: 'GET',
        path: '/api/settings/categories',
        notes: ['Auth-only settings route.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/allsettings',
    label: 'All Settings',
    page: {},
    apiDependencies: [
      {
        label: 'Tenant profile',
        method: 'GET',
        path: '/api/v1/tenants/me',
        notes: ['Auth-only tenant route used by the all settings screen.'],
      },
      {
        label: 'Settings catalog',
        method: 'GET',
        path: '/api/settings/catalog',
        notes: ['Auth-only settings route.'],
      },
      {
        label: 'Effective settings',
        method: 'GET',
        path: '/api/settings/tenants/me/effective',
        notes: ['Auth-only settings route.'],
      },
      {
        label: 'Update override',
        method: 'PATCH',
        path: '/api/settings/tenants/me/overrides',
        notes: ['Auth-only settings route.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/users',
    label: 'Settings Users',
    page: {},
    apiDependencies: [
      {
        label: 'List users',
        method: 'GET',
        path: '/tenant-api/tenants/[tenantId]/users',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'Update user',
        method: 'PATCH',
        path: '/tenant-api/tenants/[tenantId]/users/[userId]',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/branding',
    label: 'Branding Settings',
    page: {},
    apiDependencies: [
      {
        label: 'Upload tenant logo',
        method: 'POST',
        path: '/api/v1/tenants/me/logo',
        notes: ['Auth-only tenant route.'],
      },
      {
        label: 'Delete tenant logo',
        method: 'DELETE',
        path: '/api/v1/tenants/me/logo',
        notes: ['Auth-only tenant route.'],
      },
      {
        label: 'Update tenant profile',
        method: 'PATCH',
        path: '/api/v1/tenants/me',
        notes: ['Auth-only tenant route.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/subscription',
    label: 'Settings Subscription',
    page: {},
    apiDependencies: [
      {
        label: 'Subscription usage',
        method: 'GET',
        path: '/api/v1/subscriptions/usage',
        notes: ['Auth-only subscription route.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/finance',
    label: 'Finance Settings',
    page: {},
    apiDependencies: [
      {
        label: 'Effective settings',
        method: 'GET',
        path: '/api/settings/tenants/me/effective',
        notes: ['Auth-only settings route.'],
      },
      {
        label: 'Update overrides',
        method: 'PATCH',
        path: '/api/settings/tenants/me/overrides',
        notes: ['Auth-only settings route.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/navigation',
    label: 'Navigation Settings',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/preferences',
    label: 'Settings Preferences',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/branches/[id]',
    label: 'Branch Settings',
    page: {},
    apiDependencies: [
      {
        label: 'List branches',
        method: 'GET',
        path: '/api/v1/branches',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Branch settings explain',
        method: 'GET',
        path: '/api/settings/tenants/me/explain/[settingCode]',
        notes: ['Auth-only settings route.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflows',
    label: 'Workflows',
    page: {},
    apiDependencies: [
      {
        label: 'Workflow config list',
        method: 'GET',
        path: '/api/v1/workflows/config',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflows/new',
    label: 'New Workflow',
    page: {},
    apiDependencies: [
      {
        label: 'Create workflow config',
        method: 'POST',
        path: '/api/v1/workflows/config',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflows/[id]/edit',
    label: 'Edit Workflow',
    page: {},
    apiDependencies: [
      {
        label: 'Workflow config list',
        method: 'GET',
        path: '/api/v1/workflows/config',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
      {
        label: 'Update workflow config',
        method: 'PATCH',
        path: '/api/v1/workflows/config',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflow-roles',
    label: 'Workflow Roles',
    page: {
      permissions: ['settings:workflow_roles:view'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Users with workflow roles',
        method: 'GET',
        path: '/api/workflow-roles/users',
        notes: ['Auth-only workflow roles route; page access is permission-gated in the frontend contract.'],
      },
      {
        label: 'Assign workflow role',
        method: 'POST',
        path: '/api/workflow-roles',
        notes: ['Auth-only workflow roles route.'],
      },
      {
        label: 'Remove workflow role',
        method: 'DELETE',
        path: '/api/workflow-roles/[id]',
        notes: ['Auth-only workflow roles route.'],
      },
    ],
  },
  {
    routePattern: '/dashboard/settings/roles',
    label: 'Roles Management',
    page: {
      permissions: ['*:*', 'settings:*'],
      permissionPrefixes: ['roles:'],
      tenantRoles: ['admin', 'tenant_admin'],
    },
    apiDependencies: [
      {
        label: 'List roles',
        method: 'GET',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'Create role',
        method: 'POST',
        path: '/tenant-api/roles',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Update role',
        method: 'PATCH',
        path: '/tenant-api/roles/[roleCode]',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Delete role',
        method: 'DELETE',
        path: '/tenant-api/roles/[roleCode]',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Assign role permissions',
        method: 'POST',
        path: '/tenant-api/roles/[roleCode]/permissions',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
  },
  {
    routePattern: '/dashboard/settings/permissions',
    label: 'Permissions Management',
    page: {
      permissions: ['*:*', 'settings:*'],
      permissionPrefixes: ['permissions:'],
      tenantRoles: ['admin', 'tenant_admin'],
    },
    apiDependencies: [
      {
        label: 'Permissions by category',
        method: 'GET',
        path: '/tenant-api/permissions/by-category',
        notes: ['Platform API via rbacFetch; permission enforcement is upstream and not declared in local web-admin API routes.'],
      },
      {
        label: 'Create permission',
        method: 'POST',
        path: '/tenant-api/permissions',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Update permission',
        method: 'PATCH',
        path: '/tenant-api/permissions/[permissionCode]',
        notes: ['Platform API via rbacFetch.'],
      },
      {
        label: 'Delete permission',
        method: 'DELETE',
        path: '/tenant-api/permissions/[permissionCode]',
        notes: ['Platform API via rbacFetch.'],
      },
    ],
  },
]

export const SETTINGS_WORKFLOW_ROLES_ACCESS =
  SETTINGS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/settings/workflow-roles')!

export const SETTINGS_ROLES_ACCESS =
  SETTINGS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/settings/roles')!

export const SETTINGS_PERMISSIONS_ACCESS =
  SETTINGS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/settings/permissions')!
