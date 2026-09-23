/**
 * Cash-control settings admin screen contract (POS Session & Cash Drawer
 * Hardening, W0-5). Kept feature-local, matching the payment-config contract
 * pattern (`@features/payment-config/access/payment-config-access.ts`).
 *
 * Note: `derive --apply --prune-stale` renamed the `updateCashControlSettings`
 * action to `manage` (matching the `useHasPermissionCode('cash_control:manage')`
 * call site in the screen) but also force-commented every nested `requirement`
 * block below it as a false-positive "stale" match — its scanner doesn't
 * distinguish a nested `requirement` object from a top-level stale key. Those
 * `requirement` blocks were restored by hand; they are real and required for
 * `check --wire` to pass.
 */
import type { PageAccessContract } from '@/lib/auth/access-contracts';
import { FINANCE_PERMISSIONS } from '@/lib/constants/permissions/finance-perm';

export const CASH_DRAWERS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/settings/payments/cash-control-settings',
    label: 'Cash Control Settings',
    page: {
      permissions: [FINANCE_PERMISSIONS.CASH_CONTROL_VIEW],
      requireAllPermissions: true,
    },
    actions: {
      manage: {
        label: 'Manage cash-control policy settings',
        requirement: {
          permissions: [FINANCE_PERMISSIONS.CASH_CONTROL_MANAGE],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Load cash-control settings',
        method: 'GET',
        path: '/api/v1/settings/payments/cash-control',
        requirement: {
          permissions: [FINANCE_PERMISSIONS.CASH_CONTROL_VIEW],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update cash-control settings',
        method: 'PUT',
        path: '/api/v1/settings/payments/cash-control',
        requirement: {
          permissions: [FINANCE_PERMISSIONS.CASH_CONTROL_MANAGE],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'v1 manages TENANT scope only — the resolver service already supports BRANCH/USER/DRAWER overrides; the scope picker UI is a documented follow-up (STATUS.md D19).',
    ],
  },
];
