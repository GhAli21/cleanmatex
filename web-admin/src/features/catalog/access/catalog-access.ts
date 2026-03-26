import type { PageAccessContract } from '@/lib/auth/access-contracts'

const CATALOG_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const CATALOG_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/catalog/services',
    label: 'Catalog Services',
    page: {},
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/services/new',
    label: 'New Catalog Service',
    page: {},
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/services/[id]',
    label: 'Catalog Service Details',
    page: {},
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/pricing',
    label: 'Catalog Pricing',
    page: {},
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/pricing/[id]',
    label: 'Pricing Details',
    page: {},
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/addons',
    label: 'Catalog Add-ons',
    page: {},
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/categories',
    label: 'Catalog Categories',
    page: {},
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/preferences',
    label: 'Preferences Catalog',
    page: {
      permissions: ['orders:service_prefs_view', 'orders:read', 'config:preferences_manage'],
    },
    actions: {
      editServicePreferences: {
        label: 'Edit service preferences',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      editPackingPreferences: {
        label: 'Edit packing preferences',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      manageBundles: {
        label: 'Create, edit, and delete bundles',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      editPreferenceKinds: {
        label: 'Edit preference kinds',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
    },
  },
  {
    routePattern: '/dashboard/catalog/customer-categories',
    label: 'Customer Categories',
    page: {
      permissions: ['config:preferences_manage'],
      requireAllPermissions: true,
    },
    actions: {
      manageCustomerCategories: {
        label: 'Create, edit, and delete customer categories',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
    },
  },
]

export const CATALOG_PREFERENCES_ACCESS =
  CATALOG_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/catalog/preferences')!

export const CATALOG_CUSTOMER_CATEGORIES_ACCESS =
  CATALOG_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/catalog/customer-categories')!
