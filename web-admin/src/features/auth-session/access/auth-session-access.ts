import type { PageAccessContract } from '@/lib/auth/access-contracts'
import { AUTH_CONFIG_PERMISSIONS } from '@/lib/constants/permissions/auth-config-perm'
import { USER_SESSIONS_PERMISSIONS } from '@/lib/constants/permissions/user-sessions-perm'

/**
 * Access contracts for the auth-session feature (User Session Lifecycle).
 * Security & Sessions settings, self-service Account security, and the tenant-wide Active sessions screen.
 */
export const AUTH_SESSION_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/settings/security',
    label: 'Security & Sessions',
    page: {
      permissions: [AUTH_CONFIG_PERMISSIONS.READ],
      requireAllPermissions: true,
    },
    actions: {
      update: {
        label: 'Change tenant security and session settings',
        requirement: {
          permissions: [AUTH_CONFIG_PERMISSIONS.UPDATE],
          requireAllPermissions: true,
          // Customizing is also a plan capability; the API and screen enforce the flag too.
          featureFlags: ['session_timeout_control'],
          requireAllFeatureFlags: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Load security settings',
        method: 'GET',
        path: '/api/settings/auth-config',
        requirement: {
          permissions: [AUTH_CONFIG_PERMISSIONS.READ],
          requireAllPermissions: true,
        },
        enforcement: 'permission',
      },
      {
        label: 'Save security settings',
        method: 'PUT',
        path: '/api/settings/auth-config',
        requirement: {
          permissions: [AUTH_CONFIG_PERMISSIONS.UPDATE],
          requireAllPermissions: true,
          featureFlags: ['session_timeout_control'],
          requireAllFeatureFlags: true,
        },
        enforcement: 'permission',
        notes: ['Plan flag session_timeout_control is enforced in the use-case (updateTenantAuthConfig); DB triggers re-check bounds and is_allow_tenant_change.'],
      },
    ],
  },
  {
    routePattern: '/dashboard/account/security',
    label: 'Account security',
    // Self-service: every signed-in user manages their own password and devices; identity comes from the session.
    page: {},
    notes: ['Self-service screen: no RBAC permission; every API only touches the signed-in user own account and sessions.'],
    apiDependencies: [
      { label: 'List my sessions', method: 'GET', path: '/api/auth/sessions/me', enforcement: 'auth_only' },
      { label: 'Sign out one of my other devices', method: 'DELETE', path: '/api/auth/sessions/me/[id]', enforcement: 'auth_only' },
      { label: 'Sign out all my other devices', method: 'POST', path: '/api/auth/sessions/me/revoke-others', enforcement: 'auth_only' },
      { label: 'Read my password rules', method: 'GET', path: '/api/auth/password/policy', enforcement: 'auth_only' },
      { label: 'Change my password', method: 'POST', path: '/api/auth/password/change', enforcement: 'auth_only' },
      { label: 'Email me a password link', method: 'POST', path: '/api/auth/password/link', enforcement: 'auth_only' },
    ],
  },
  {
    routePattern: '/dashboard/users/sessions',
    label: 'Active sessions',
    page: {
      permissions: [USER_SESSIONS_PERMISSIONS.READ],
      requireAllPermissions: true,
    },
    actions: {
      revoke: {
        label: 'Sign users out',
        requirement: {
          permissions: [USER_SESSIONS_PERMISSIONS.REVOKE],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List tenant sessions',
        method: 'GET',
        path: '/api/users/sessions',
        requirement: { permissions: [USER_SESSIONS_PERMISSIONS.READ], requireAllPermissions: true },
        enforcement: 'permission',
      },
      {
        label: 'Sign users out',
        method: 'POST',
        path: '/api/users/sessions/revoke',
        requirement: { permissions: [USER_SESSIONS_PERMISSIONS.REVOKE], requireAllPermissions: true },
        enforcement: 'permission',
      },
    ],
  },
]

export const AUTH_SESSION_SETTINGS_SECURITY_ACCESS = AUTH_SESSION_ACCESS_CONTRACTS[0]!
