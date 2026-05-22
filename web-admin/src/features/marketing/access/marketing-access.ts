import type { PageAccessContract } from '@/lib/auth/access-contracts';

const MARKETING_NOTES = [
  'Requires promotions:read / gift_cards:read / discount_rules:read permissions.',
];

export const MARKETING_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/marketing',
    label: 'Marketing',
    page: {
      permissions: ['promotions:read'],
      requireAllPermissions: true,
    },
    notes: MARKETING_NOTES,
  },
  {
    routePattern: '/dashboard/marketing/promos',
    label: 'Promo Codes',
    page: {
      permissions: ['promotions:read'],
      requireAllPermissions: true,
    },
    actions: {
      create: {
        label: 'Create promo code',
        requirement: {
          permissions: ['promotions:write'],
          requireAllPermissions: true,
        },
      },
      edit: {
        label: 'Edit promo code',
        requirement: {
          permissions: ['promotions:write'],
          requireAllPermissions: true,
        },
      },
      archive: {
        label: 'Archive promo code',
        requirement: {
          permissions: ['promotions:write'],
          requireAllPermissions: true,
        },
      },
    },
    notes: MARKETING_NOTES,
  },
  {
    routePattern: '/dashboard/marketing/gift-cards',
    label: 'Gift Cards',
    page: {
      permissions: ['gift_cards:read'],
      requireAllPermissions: true,
    },
    actions: {
      issue: {
        label: 'Issue gift card',
        requirement: {
          permissions: ['gift_cards:issue'],
          requireAllPermissions: true,
        },
      },
      adjust: {
        label: 'Adjust gift card balance',
        requirement: {
          permissions: ['gift_cards:adjust'],
          requireAllPermissions: true,
        },
      },
      cancel: {
        label: 'Cancel gift card',
        requirement: {
          permissions: ['gift_cards:adjust'],
          requireAllPermissions: true,
        },
      },
    },
    notes: MARKETING_NOTES,
  },
  {
    routePattern: '/dashboard/marketing/gift-cards/liability',
    label: 'Gift Card Liability',
    page: {
      permissions: ['gift_cards:read'],
      requireAllPermissions: true,
    },
    notes: MARKETING_NOTES,
  },
  {
    routePattern: '/dashboard/marketing/discount-rules',
    label: 'Discount Rules',
    page: {
      permissions: ['discount_rules:read'],
      requireAllPermissions: true,
    },
    actions: {
      create: {
        label: 'Create discount rule',
        requirement: {
          permissions: ['discount_rules:write'],
          requireAllPermissions: true,
        },
      },
      edit: {
        label: 'Edit discount rule',
        requirement: {
          permissions: ['discount_rules:write'],
          requireAllPermissions: true,
        },
      },
      archive: {
        label: 'Archive discount rule',
        requirement: {
          permissions: ['discount_rules:write'],
          requireAllPermissions: true,
        },
      },
    },
    notes: MARKETING_NOTES,
  },
  {
    routePattern: '/dashboard/marketing/loyalty',
    label: 'Loyalty Program',
    page: {
      permissions: ['loyalty:view_config'],
      requireAllPermissions: true,
    },
    notes: ['Loyalty configuration route with explicit navigation-aligned permission gate.'],
  },
  {
    routePattern: '/dashboard/marketing/promotions',
    label: 'Promotions',
    page: {
      permissions: ['promotions:view'],
      requireAllPermissions: true,
    },
    notes: ['Promotions route distinct from promo-code management.'],
  },
];
