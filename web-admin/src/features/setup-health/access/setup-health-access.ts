/**
 * Setup Health page contract (docs/features/Setup_Health/PLAN.md §3.2): read-only
 * screen + list API gated by setup_health:view; the summary API (layout banner,
 * home card) is sign-in only so the banner reaches every role.
 */
import type { PageAccessContract } from '@/lib/auth/access-contracts';
import { SETUP_HEALTH_PERMISSIONS } from '@/lib/constants/permissions/setup-health-perm';

export const SETUP_HEALTH_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/setup-health',
    label: 'Setup Health',
    page: {
      permissions: [SETUP_HEALTH_PERMISSIONS.VIEW],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'List setup health checks',
        method: 'GET',
        path: '/api/v1/setup-health',
        requirement: {
          permissions: [SETUP_HEALTH_PERMISSIONS.VIEW],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Setup health summary (banner / home card)',
        method: 'GET',
        path: '/api/v1/setup-health/summary',
        notes: ['Sign-in only by design: the setup blocker banner must reach cashiers too.'],
      },
    ],
    notes: [
      'Fix buttons open tenant screens only when the user holds the check fix_permission (sys_setup_health_check_cd); otherwise "contact support".',
    ],
  },
];
export const SETUP_HEALTH_SETUP_HEALTH_ACCESS =
  SETUP_HEALTH_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/setup-health')!
