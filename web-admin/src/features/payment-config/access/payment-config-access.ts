/**
 * Payment setup contracts are feature-local so the finance configuration UI and
 * its explicit API permissions stay in one canonical place.
 */
import type { PageAccessContract } from '@/lib/auth/access-contracts';

export const PAYMENT_CONFIG_PERMISSIONS = {
  VIEW: 'payment_config:view',
  MANAGE: 'payment_config:manage',
  CASH_DRAWER_VIEW: 'cash_drawer:view',
  CASH_DRAWER_OPEN_SESSION: 'cash_drawer:open_session',
} as const;

export const PAYMENT_CONFIG_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/settings/payments',
    label: 'Payment Setup',
    page: {
      permissions: [PAYMENT_CONFIG_PERMISSIONS.VIEW],
      requireAllPermissions: true,
    },
    actions: {
      updateMethodConfiguration: {
        label: 'Update payment method configuration',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.MANAGE],
          requireAllPermissions: true,
        },
      },
      createOrUpdateTerminals: {
        label: 'Create or update payment terminals',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.MANAGE],
          requireAllPermissions: true,
        },
      },
      updateCardBrands: {
        label: 'Update card brand configuration',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.MANAGE],
          requireAllPermissions: true,
        },
      },
      viewCashDrawers: {
        label: 'View cash drawers',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.CASH_DRAWER_VIEW],
          requireAllPermissions: true,
        },
      },
      openCashDrawerSession: {
        label: 'Open cash drawer session',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.CASH_DRAWER_OPEN_SESSION],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'List payment methods',
        method: 'GET',
        path: '/api/v1/settings/payments/methods',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.VIEW],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update payment method',
        method: 'PATCH',
        path: '/api/v1/settings/payments/methods/[methodId]',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.MANAGE],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List payment terminals',
        method: 'GET',
        path: '/api/v1/settings/payments/terminals',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.VIEW],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create payment terminal',
        method: 'POST',
        path: '/api/v1/settings/payments/terminals',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.MANAGE],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List card brands',
        method: 'GET',
        path: '/api/v1/settings/payments/card-brands',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.VIEW],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update card brand',
        method: 'PATCH',
        path: '/api/v1/settings/payments/card-brands/[brandId]',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.MANAGE],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List cash drawers',
        method: 'GET',
        path: '/api/v1/cash-drawers',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.CASH_DRAWER_VIEW],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Open cash drawer session',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/open-session',
        requirement: {
          permissions: [PAYMENT_CONFIG_PERMISSIONS.CASH_DRAWER_OPEN_SESSION],
          requireAllPermissions: true,
        },
      },
    ],
    notes: ['Canonical payment configuration route. Tab-level mutations all hang off explicit payment_config or cash_drawer permissions.'],
  },
];
