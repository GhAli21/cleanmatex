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
  },
];
