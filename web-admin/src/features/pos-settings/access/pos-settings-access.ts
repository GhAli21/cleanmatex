/**
 * POS settings page contract (POS Session & Cash Drawer Hardening): the POS-session slice of the
 * tenant cash-control policy. Drawer and cash-handling policy stays on
 * /dashboard/settings/payments/cash-control-settings (see cash-drawers-access.ts). Both pages share one
 * settings API and the same permissions: `cash_control:view` (page) / `cash_control:manage` (save).
 */
import type { PageAccessContract } from '@/lib/auth/access-contracts';
import { FINANCE_PERMISSIONS } from '@/lib/constants/permissions/finance-perm';

export const POS_SETTINGS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/settings/pos-settings',
    label: 'POS Settings',
    page: {
      permissions: [FINANCE_PERMISSIONS.CASH_CONTROL_VIEW],
      requireAllPermissions: true,
    },
    actions: {
      manage: {
        label: 'Manage POS-session policy settings',
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
        label: 'Update cash-control settings (POS-session fields only)',
        method: 'PUT',
        path: '/api/v1/settings/payments/cash-control',
        requirement: {
          permissions: [FINANCE_PERMISSIONS.CASH_CONTROL_MANAGE],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'Tabs: Session requirement, Shift lifecycle; the active tab is the ?tab= query value. One form and one Save across the tabs; only the changed POS-session fields are sent.',
      'v1 manages TENANT scope only — the resolver service already supports BRANCH/USER/DRAWER overrides (STATUS.md D19).',
    ],
  },
];
