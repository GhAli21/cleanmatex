import type { PageAccessContract } from '@/lib/auth/access-contracts';

const NOTIFICATIONS_NOTES = [
  'Notification routes aligned with navigation.ts permission gates.',
];

export const NOTIFICATIONS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/notifications',
    label: 'Notification Center',
    page: {
      permissions: ['notifications:read'],
      requireAllPermissions: true,
    },
    notes: NOTIFICATIONS_NOTES,
  },
  {
    routePattern: '/dashboard/notifications/delivery-log',
    label: 'Delivery Log',
    page: {
      permissions: ['notifications:view_log'],
      requireAllPermissions: true,
    },
    notes: NOTIFICATIONS_NOTES,
  },
  {
    routePattern: '/dashboard/notifications/settings',
    label: 'Channel Settings',
    page: {
      permissions: ['notifications:configure'],
      requireAllPermissions: true,
    },
    notes: NOTIFICATIONS_NOTES,
    actions: {
      configureWhatsAppTemplates: {
        label: 'Configure approved WhatsApp templates',
        requirement: {
          permissions: ['notifications:configure'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Read WhatsApp providers',
        method: 'GET',
        path: '/api/v1/notifications/settings/providers',
        requirement: { permissions: ['notifications:configure'] },
      },
      {
        label: 'Add WhatsApp provider',
        method: 'POST',
        path: '/api/v1/notifications/settings/providers',
        requirement: { permissions: ['notifications:configure'] },
      },
      {
        label: 'Save and activate approved WhatsApp templates',
        method: 'PUT',
        path: '/api/v1/notifications/settings/providers',
        requirement: { permissions: ['notifications:configure'] },
      },
      {
        label: 'Notifications Settings',
        method: 'GET',
        path: '/api/v1/notifications/settings',
        requirement: {
          permissions: ['notifications:configure'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Notifications User Prefs',
        method: 'GET',
        path: '/api/v1/notifications/user-prefs',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
    ],
  },
];
export const NOTIFICATIONS_NOTIFICATIONS_ACCESS =
  NOTIFICATIONS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/notifications')!
export const NOTIFICATIONS_NOTIFICATIONS_DELIVERY_LOG_ACCESS =
  NOTIFICATIONS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/notifications/delivery-log')!
export const NOTIFICATIONS_NOTIFICATIONS_SETTINGS_ACCESS =
  NOTIFICATIONS_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/notifications/settings')!
