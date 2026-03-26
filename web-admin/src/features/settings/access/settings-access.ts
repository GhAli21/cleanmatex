import type { PageAccessContract } from '@/lib/auth/access-contracts'

const SETTINGS_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const SETTINGS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/settings',
    label: 'Settings',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/general',
    label: 'General Settings',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/allsettings',
    label: 'All Settings',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/users',
    label: 'Settings Users',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/branding',
    label: 'Branding Settings',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/subscription',
    label: 'Settings Subscription',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/finance',
    label: 'Finance Settings',
    page: {},
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
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflows',
    label: 'Workflows',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflows/new',
    label: 'New Workflow',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflows/[id]/edit',
    label: 'Edit Workflow',
    page: {},
    notes: SETTINGS_NOTES,
  },
  {
    routePattern: '/dashboard/settings/workflow-roles',
    label: 'Workflow Roles',
    page: {
      permissions: ['settings:workflow_roles:view'],
      requireAllPermissions: true,
    },
  },
  {
    routePattern: '/dashboard/settings/roles',
    label: 'Roles Management',
    page: {
      permissions: ['*:*', 'settings:*'],
      permissionPrefixes: ['roles:'],
      tenantRoles: ['admin', 'tenant_admin'],
    },
  },
  {
    routePattern: '/dashboard/settings/permissions',
    label: 'Permissions Management',
    page: {
      permissions: ['*:*', 'settings:*'],
      permissionPrefixes: ['permissions:'],
      tenantRoles: ['admin', 'tenant_admin'],
    },
  },
]

export const SETTINGS_WORKFLOW_ROLES_ACCESS =
  SETTINGS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/settings/workflow-roles')!

export const SETTINGS_ROLES_ACCESS =
  SETTINGS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/settings/roles')!

export const SETTINGS_PERMISSIONS_ACCESS =
  SETTINGS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/settings/permissions')!
