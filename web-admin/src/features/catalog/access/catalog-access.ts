import type { PageAccessContract } from '@/lib/auth/access-contracts'
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions/admin-perm'

export const CATALOG_SECTION_PERMISSIONS = [ADMIN_PERMISSIONS.MANAGE] as const

export { ADMIN_PERMISSIONS }

const CATALOG_SECTION_PAGE = {
  permissions: [ADMIN_PERMISSIONS.MANAGE],
  requireAllPermissions: true,
} as const

const CATALOG_CHILD_NOTES = [
  'Catalog section child route; page gate and nav parent require admin:manage. Linked APIs enforce access separately.',
]

export const CATALOG_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/catalog',
    label: 'Catalog & Pricing',
    page: CATALOG_SECTION_PAGE,
    notes: [
      'Section hub route; redirects to catalog services. Nav visibility requires admin:manage.',
    ],
  },
  {
    routePattern: '/dashboard/catalog/services',
    label: 'Catalog Services',
    page: CATALOG_SECTION_PAGE,
    apiDependencies: [
      {
        label: 'List products',
        method: 'GET',
        path: '/api/v1/products',
        requirement: {
          permissions: ['catalog:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Export products',
        method: 'GET',
        path: '/api/v1/products/export',
        enforcement: 'auth_only',
        notes: ['Template/download export used by ImportModal/ExportModal on services screen.'],
      },
      {
        label: 'Import products',
        method: 'POST',
        path: '/api/v1/products/import',
        enforcement: 'auth_only',
        notes: ['Bulk import used by ImportModal on services screen.'],
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/services/new',
    label: 'New Catalog Service',
    page: CATALOG_SECTION_PAGE,
    apiDependencies: [
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
        notes: ['GET with ?enabled=true query filter.'],
      },
      {
        label: 'Create product',
        method: 'POST',
        path: '/api/v1/products',
        enforcement: 'auth_only',
      },
      {
        label: 'Upload product image',
        method: 'POST',
        path: '/api/v1/products/[id]/image',
        enforcement: 'auth_only',
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/services/[id]',
    label: 'Catalog Service Details',
    page: CATALOG_SECTION_PAGE,
    apiDependencies: [
      {
        label: 'Get product',
        method: 'GET',
        path: '/api/v1/products/[id]',
        enforcement: 'auth_only',
      },
      {
        label: 'Update product',
        method: 'PATCH',
        path: '/api/v1/products/[id]',
        enforcement: 'auth_only',
      },
      {
        label: 'Delete product image',
        method: 'DELETE',
        path: '/api/v1/products/[id]/image',
        enforcement: 'auth_only',
      },
      {
        label: 'Upload product image',
        method: 'POST',
        path: '/api/v1/products/[id]/image',
        enforcement: 'auth_only',
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/pricing',
    label: 'Catalog Pricing',
    page: CATALOG_SECTION_PAGE,
    apiDependencies: [
      {
        label: 'List price lists',
        method: 'GET',
        path: '/api/v1/price-lists',
        enforcement: 'auth_only',
      },
      {
        label: 'Create price list',
        method: 'POST',
        path: '/api/v1/price-lists',
        enforcement: 'auth_only',
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/pricing/[id]',
    label: 'Pricing Details',
    page: CATALOG_SECTION_PAGE,
    apiDependencies: [
      {
        label: 'Get price list',
        method: 'GET',
        path: '/api/v1/price-lists/[id]',
        enforcement: 'auth_only',
      },
      {
        label: 'Update price list',
        method: 'PATCH',
        path: '/api/v1/price-lists/[id]',
        enforcement: 'auth_only',
      },
      {
        label: 'Manage price list items',
        method: 'POST',
        path: '/api/v1/price-lists/[id]/items',
        enforcement: 'auth_only',
      },
      {
        label: 'Update price list item',
        method: 'PATCH',
        path: '/api/v1/price-lists/[id]/items/[itemId]',
        enforcement: 'auth_only',
      },
      {
        label: 'Export pricing',
        method: 'GET',
        path: '/api/v1/pricing/export',
        enforcement: 'auth_only',
      },
      {
        label: 'Import all products',
        method: 'POST',
        path: '/api/v1/pricing/import-all-products',
        enforcement: 'auth_only',
      },
      {
        label: 'Search products for price list items',
        method: 'GET',
        path: '/api/v1/products/search',
        enforcement: 'auth_only',
        notes: ['Used by price-list-item modal product picker.'],
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/addons',
    label: 'Catalog Add-ons',
    page: CATALOG_SECTION_PAGE,
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/categories',
    label: 'Catalog Categories',
    page: CATALOG_SECTION_PAGE,
    apiDependencies: [
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
      },
      {
        label: 'List enabled categories',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
        notes: ['GET with ?enabled=true query filter.'],
      },
      {
        label: 'Toggle category enablement',
        method: 'POST',
        path: '/api/v1/categories/enable',
        enforcement: 'auth_only',
        notes: ['Session + tenant; no granular permission on local route.'],
      },
    ],
    notes: CATALOG_CHILD_NOTES,
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
        method: 'PUT',
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
        method: 'PUT',
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
    routePattern: '/dashboard/catalog/order-sources',
    label: 'Order channels (sources)',
    page: {
      permissions: ['config:preferences_manage'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'List order sources for tenant',
        method: 'GET',
        path: '/api/v1/catalog/order-sources',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update allowed order sources',
        method: 'PUT',
        path: '/api/v1/catalog/order-sources',
        requirement: {
          permissions: ['config:preferences_manage'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: [
      'Child under catalog nav (parent requires admin:manage). Page gate uses config:preferences_manage.',
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

export const CATALOG_ORDER_SOURCES_ACCESS =
  CATALOG_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/catalog/order-sources')!
export const CATALOG_CATALOG_ACCESS =
  CATALOG_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/catalog')!

export const CATALOG_SERVICES_ACCESS =
  CATALOG_ACCESS_CONTRACTS.find((contract) => contract.routePattern === '/dashboard/catalog/services')!
