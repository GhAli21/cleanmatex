import type { PageAccessContract } from '@/lib/auth/access-contracts'
import { AUTH_CONFIG_PERMISSIONS } from '@/lib/constants/permissions/auth-config-perm'

/**
 * Access contracts for the auth-session feature (User Session Lifecycle).
 * Phase 1: Security & Sessions settings. Sessions screens are added in a later phase.
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
]

export const AUTH_SESSION_SETTINGS_SECURITY_ACCESS = AUTH_SESSION_ACCESS_CONTRACTS[0]!
