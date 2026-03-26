import type { PageAccessContract } from '@/lib/auth/access-contracts'

const CATALOG_NOTES = [
  'No explicit page-level UI permission gate; route relies on navigation visibility and backend enforcement.',
]

export const CATALOG_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/catalog/services',
    label: 'Catalog Services',
    page: {},
    apiDependencies: [
      {
        label: 'List products',
        method: 'GET',
        path: '/api/v1/products',
        notes: ['Local route used by the catalog services list screen.'],
      },
    ],
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/services/new',
    label: 'New Catalog Service',
    page: {},
    apiDependencies: [
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories?enabled=true',
      },
      {
        label: 'Create product',
        method: 'POST',
        path: '/api/v1/products',
      },
      {
        label: 'Upload product image',
        method: 'POST',
        path: '/api/v1/products/[id]/image',
      },
    ],
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/services/[id]',
    label: 'Catalog Service Details',
    page: {},
    apiDependencies: [
      {
        label: 'Get product',
        method: 'GET',
        path: '/api/v1/products/[id]',
      },
      {
        label: 'Update product',
        method: 'PATCH',
        path: '/api/v1/products/[id]',
      },
      {
        label: 'Delete product image',
        method: 'DELETE',
        path: '/api/v1/products/[id]/image',
      },
      {
        label: 'Upload product image',
        method: 'POST',
        path: '/api/v1/products/[id]/image',
      },
    ],
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/pricing',
    label: 'Catalog Pricing',
    page: {},
    apiDependencies: [
      {
        label: 'List price lists',
        method: 'GET',
        path: '/api/v1/price-lists',
      },
      {
        label: 'Create price list',
        method: 'POST',
        path: '/api/v1/price-lists',
      },
      {
        label: 'Pricing history',
        method: 'GET',
        path: '/api/v1/pricing/history',
      },
      {
        label: 'Download pricing template',
        method: 'GET',
        path: '/api/v1/pricing/template',
      },
      {
        label: 'Import pricing',
        method: 'POST',
        path: '/api/v1/pricing/import',
      },
    ],
    notes: CATALOG_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/pricing/[id]',
    label: 'Pricing Details',
    page: {},
    apiDependencies: [
      {
        label: 'Get price list',
        method: 'GET',
        path: '/api/v1/price-lists/[id]',
      },
      {
        label: 'Update price list',
        method: 'PATCH',
        path: '/api/v1/price-lists/[id]',
      },
      {
        label: 'Manage price list items',
        method: 'POST',
        path: '/api/v1/price-lists/[id]/items',
      },
      {
        label: 'Update price list item',
        method: 'PATCH',
        path: '/api/v1/price-lists/[id]/items/[itemId]',
      },
      {
        label: 'Export pricing',
        method: 'GET',
        path: '/api/v1/pricing/export',
      },
      {
        label: 'Import all products',
        method: 'POST',
        path: '/api/v1/pricing/import-all-products',
      },
    ],
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
    apiDependencies: [
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories',
      },
      {
        label: 'List enabled categories',
        method: 'GET',
        path: '/api/v1/categories?enabled=true',
      },
      {
        label: 'Toggle category enablement',
        method: 'POST',
        path: '/api/v1/categories/enable',
        notes: ['Auth-only local route; explicit permission requirement not recorded in local API inventory.'],
      },
    ],
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
    apiDependencies: [
      {
        label: 'List service preferences',
        method: 'GET',
        path: '/api/v1/catalog/service-preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List packing preferences',
        method: 'GET',
        path: '/api/v1/catalog/packing-preferences',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Admin service preferences',
        method: 'POST',
        path: '/api/v1/catalog/service-preferences/admin',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update service preference',
        method: 'PATCH',
        path: '/api/v1/catalog/service-preferences/[code]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delete service preference',
        method: 'DELETE',
        path: '/api/v1/catalog/service-preferences/[code]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Admin packing preferences',
        method: 'POST',
        path: '/api/v1/catalog/packing-preferences/admin',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update packing preference',
        method: 'PATCH',
        path: '/api/v1/catalog/packing-preferences/[code]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delete packing preference',
        method: 'DELETE',
        path: '/api/v1/catalog/packing-preferences/[code]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'List preference bundles',
        method: 'GET',
        path: '/api/v1/catalog/preference-bundles',
        requirement: {
          permissions: ['orders:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create preference bundle',
        method: 'POST',
        path: '/api/v1/catalog/preference-bundles',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update preference bundle',
        method: 'PATCH',
        path: '/api/v1/catalog/preference-bundles/[id]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delete preference bundle',
        method: 'DELETE',
        path: '/api/v1/catalog/preference-bundles/[id]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Admin preference kinds',
        method: 'POST',
        path: '/api/v1/catalog/preference-kinds/admin',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delete preference kind',
        method: 'DELETE',
        path: '/api/v1/catalog/preference-kinds/admin',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
    ],
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
    apiDependencies: [
      {
        label: 'List customer categories',
        method: 'GET',
        path: '/api/v1/customer-categories',
        requirement: {
          permissions: ['customers:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Check category code',
        method: 'GET',
        path: '/api/v1/customer-categories/check-code',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create customer category',
        method: 'POST',
        path: '/api/v1/customer-categories',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update customer category',
        method: 'PATCH',
        path: '/api/v1/customer-categories/[code]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delete customer category',
        method: 'DELETE',
        path: '/api/v1/customer-categories/[code]',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
    ],
  },
]

export const CATALOG_PREFERENCES_ACCESS =
  CATALOG_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/catalog/preferences')!

export const CATALOG_CUSTOMER_CATEGORIES_ACCESS =
  CATALOG_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/catalog/customer-categories')!
