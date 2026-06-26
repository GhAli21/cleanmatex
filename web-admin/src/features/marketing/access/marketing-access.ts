import type { PageAccessContract } from '@/lib/auth/access-contracts';

export const MARKETING_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/marketing',
    label: 'Marketing',
    page: {
      permissions: ['promotions:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
    ],
},
  {
    routePattern: '/dashboard/marketing/campaigns',
    label: 'Campaigns',
    page: {
      permissions: ['notifications:manage'],
      requireAllPermissions: true,
      featureFlags: ['campaigns_enabled'],
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
    ],
    actions: {
      create: {
        label: 'Create',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      export: {
        label: 'Export',
        requirement: {
          permissions: ['orders:export'],
          requireAllPermissions: true,
        },
      },
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
},
  {
    routePattern: '/dashboard/marketing/campaigns/[id]',
    label: 'Campaigns',
    page: {
      permissions: ['notifications:manage'],
      requireAllPermissions: true,
      featureFlags: ['campaigns_enabled'],
      requireAllFeatureFlags: true,
    },
    apiDependencies: [
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
    ],
},
  {
    routePattern: '/dashboard/marketing/discount-rules',
    label: 'Discount Rules',
    page: {
      permissions: ['discount_rules:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: discount-rule-actions',
        method: 'POST',
        path: '/app/actions/marketing/discount-rule-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
    ],
    actions: {
      create: {
        label: 'Create',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      export: {
        label: 'Export',
        requirement: {
          permissions: ['orders:export'],
          requireAllPermissions: true,
        },
      },
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
},
  {
    routePattern: '/dashboard/marketing/gift-cards',
    label: 'Gift Cards',
    page: {
      permissions: ['gift_cards:read'],
      requireAllPermissions: true,
    },
    actions: {
      activate: {
        label: 'Activate',
        requirement: {
          permissions: ['gift_cards:activate'],
          requireAllPermissions: true,
        },
      },
      adjust: {
        label: 'Adjust',
        requirement: {
          permissions: ['gift_cards:adjust'],
          requireAllPermissions: true,
        },
      },
      issue: {
        label: 'Issue',
        requirement: {
          permissions: ['gift_cards:issue'],
          requireAllPermissions: true,
        },
      },
      sell: {
        label: 'Sell',
        requirement: {
          permissions: ['gift_cards:sell'],
          requireAllPermissions: true,
        },
      },
      void: {
        label: 'Void',
        requirement: {
          permissions: ['gift_cards:void'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: gift-card-actions',
        method: 'POST',
        path: '/app/actions/marketing/gift-card-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
        requirement: {
          permissions: ['gift_cards:activate', 'gift_cards:adjust', 'gift_cards:issue', 'gift_cards:sell', 'gift_cards:void'],
          requireAllPermissions: true,
        },
      },
    ],
},
  {
    routePattern: '/dashboard/marketing/gift-cards/liability',
    label: 'Liability',
    page: {
      permissions: ['gift_cards:read'],
      requireAllPermissions: true,
    },
    actions: {
      create: {
        label: 'Create',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      export: {
        label: 'Export',
        requirement: {
          permissions: ['orders:export'],
          requireAllPermissions: true,
        },
      },
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
      activate: {
        label: 'Activate',
        requirement: {
          permissions: ['gift_cards:activate'],
          requireAllPermissions: true,
        },
      },
      adjust: {
        label: 'Adjust',
        requirement: {
          permissions: ['gift_cards:adjust'],
          requireAllPermissions: true,
        },
      },
      issue: {
        label: 'Issue',
        requirement: {
          permissions: ['gift_cards:issue'],
          requireAllPermissions: true,
        },
      },
      sell: {
        label: 'Sell',
        requirement: {
          permissions: ['gift_cards:sell'],
          requireAllPermissions: true,
        },
      },
      void: {
        label: 'Void',
        requirement: {
          permissions: ['gift_cards:void'],
          requireAllPermissions: true,
        },
      },
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: gift-card-actions',
        method: 'POST',
        path: '/app/actions/marketing/gift-card-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
        requirement: {
          permissions: ['gift_cards:activate', 'gift_cards:adjust', 'gift_cards:issue', 'gift_cards:sell', 'gift_cards:void'],
          requireAllPermissions: true,
        },
      },
    ],
},
  {
    routePattern: '/dashboard/marketing/loyalty',
    label: 'Loyalty',
    page: {
      permissions: ['loyalty:view_config'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: loyalty-actions',
        method: 'POST',
        path: '/app/actions/marketing/loyalty-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
    ],
    actions: {
      create: {
        label: 'Create',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      export: {
        label: 'Export',
        requirement: {
          permissions: ['orders:export'],
          requireAllPermissions: true,
        },
      },
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
},
  {
    routePattern: '/dashboard/marketing/promos',
    label: 'Promos',
    page: {
      permissions: ['promotions:read'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: promo-actions',
        method: 'POST',
        path: '/app/actions/marketing/promo-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
    ],
    actions: {
      create: {
        label: 'Create',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      export: {
        label: 'Export',
        requirement: {
          permissions: ['orders:export'],
          requireAllPermissions: true,
        },
      },
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
},
  {
    routePattern: '/dashboard/marketing/promotions',
    label: 'Promotions',
    page: {
      permissions: ['promotions:view'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Notifications Campaigns',
        method: 'GET',
        path: '/api/v1/notifications/campaigns',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Campaigns [Id]',
        method: 'GET',
        path: '/api/v1/notifications/campaigns/[id]',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Status',
        method: 'PATCH',
        path: '/api/v1/notifications/campaigns/[id]/status',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: '[Id] Test',
        method: 'POST',
        path: '/api/v1/notifications/campaigns/[id]/test',
        requirement: {
          permissions: ['notifications:manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Server action: promotions-actions',
        method: 'POST',
        path: '/app/actions/marketing/promotions-actions',
        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],
      },
    ],
    actions: {
      create: {
        label: 'Create',
        requirement: {
          permissions: ['orders:create'],
          requireAllPermissions: true,
        },
      },
      export: {
        label: 'Export',
        requirement: {
          permissions: ['orders:export'],
          requireAllPermissions: true,
        },
      },
      read: {
        label: 'Read',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      update: {
        label: 'Update',
        requirement: {
          permissions: ['orders:update'],
          requireAllPermissions: true,
        },
      },
    },
},
];
export const MARKETING_MARKETING_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing')!
export const MARKETING_MARKETING_CAMPAIGNS_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/campaigns')!
export const MARKETING_MARKETING_CAMPAIGNS_DETAIL_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/campaigns/[id]')!
export const MARKETING_MARKETING_DISCOUNT_RULES_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/discount-rules')!
export const MARKETING_MARKETING_GIFT_CARDS_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/gift-cards')!
export const MARKETING_MARKETING_GIFT_CARDS_LIABILITY_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/gift-cards/liability')!
export const MARKETING_MARKETING_LOYALTY_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/loyalty')!
export const MARKETING_MARKETING_PROMOS_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/promos')!
export const MARKETING_MARKETING_PROMOTIONS_ACCESS =
  MARKETING_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/marketing/promotions')!
