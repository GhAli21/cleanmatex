import type { PageAccessContract } from '@/lib/auth/access-contracts'
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions/admin-perm'

export const CATALOG_SECTION_PERMISSIONS = [ADMIN_PERMISSIONS.MANAGE] as const

export { ADMIN_PERMISSIONS }

const CATALOG_CHILD_NOTES = [
  'Catalog section child route; page gate and nav parent require admin:manage. Linked APIs enforce access separately.',
]

export const CATALOG_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/catalog',
    label: 'Catalog & Pricing',
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    notes: [
      'Section hub route; redirects to catalog services. Nav visibility requires admin:manage.',
    ],
  },
  {
    routePattern: '/dashboard/catalog/services',
    label: 'Catalog Services',
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'List products',
        method: 'GET',
        path: '/api/v1/products',
        requirement: {
          permissions: ['products:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Export products',
        method: 'GET',
        path: '/api/v1/products/export',
        requirement: {
          permissions: ['products:export'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Import products',
        method: 'POST',
        path: '/api/v1/products/import',
        requirement: {
          permissions: ['products:create'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/services/new',
    label: 'New Catalog Service',
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
      },
      {
        label: 'Create product',
        method: 'POST',
        path: '/api/v1/products',
        requirement: {
          permissions: ['products:create'],
          requireAllPermissions: true,
        },
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
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Get product',
        method: 'GET',
        path: '/api/v1/products/[id]',
        requirement: {
          permissions: ['products:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update product',
        method: 'PATCH',
        path: '/api/v1/products/[id]',
        requirement: {
          permissions: ['products:update'],
          requireAllPermissions: true,
        },
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
      {
        label: 'List this product speed rules',
        method: 'GET',
        path: '/api/v1/catalog/speed-rules',
        requirement: {
          permissions: ['pricing:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Price this product at each speed',
        method: 'GET',
        path: '/api/v1/catalog/speed-rules/resolve',
        requirement: {
          permissions: ['pricing:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Add a speed rule',
        method: 'POST',
        path: '/api/v1/catalog/speed-rules',
        requirement: {
          permissions: ['pricing:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Edit a speed rule',
        method: 'PATCH',
        path: '/api/v1/catalog/speed-rules/[id]',
        requirement: {
          permissions: ['pricing:update'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/pricing',
    label: 'Catalog Pricing',
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'List price lists',
        method: 'GET',
        path: '/api/v1/price-lists',
        requirement: {
          permissions: ['pricing:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create price list',
        method: 'POST',
        path: '/api/v1/price-lists',
        requirement: {
          permissions: ['pricing:create'],
          requireAllPermissions: true,
        },
      },
    ],
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/speed-pricing',
    label: 'Speed Pricing',
    page: {
      permissions: ['pricing:read'],
      requireAllPermissions: true,
    },
    actions: {
      create: {
        label: 'Add rule',
        requirement: { permissions: ['pricing:create'], requireAllPermissions: true },
      },
      update: {
        label: 'Edit, activate or deactivate rule',
        requirement: { permissions: ['pricing:update'], requireAllPermissions: true },
      },
      delete: {
        label: 'Delete rule',
        requirement: { permissions: ['pricing:delete'], requireAllPermissions: true },
      },
      bulk: {
        label: 'Add rules for a category; retire or restore product rules',
        requirement: { permissions: ['pricing:bulk'], requireAllPermissions: true },
      },
    },
    apiDependencies: [
      {
        label: 'List speed rules',
        method: 'GET',
        path: '/api/v1/catalog/speed-rules',
        requirement: {
          permissions: ['pricing:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Create speed rule',
        method: 'POST',
        path: '/api/v1/catalog/speed-rules',
        requirement: {
          permissions: ['pricing:create'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Read speed rule',
        method: 'GET',
        path: '/api/v1/catalog/speed-rules/[id]',
        requirement: {
          permissions: ['pricing:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update speed rule',
        method: 'PATCH',
        path: '/api/v1/catalog/speed-rules/[id]',
        requirement: {
          permissions: ['pricing:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Delete speed rule',
        method: 'DELETE',
        path: '/api/v1/catalog/speed-rules/[id]',
        requirement: {
          permissions: ['pricing:delete'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Bulk create speed rules for a category',
        method: 'POST',
        path: '/api/v1/catalog/speed-rules/bulk',
        requirement: {
          permissions: ['pricing:bulk'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Retire or restore product speed rules',
        method: 'POST',
        path: '/api/v1/catalog/speed-rules/bulk-status',
        requirement: {
          permissions: ['pricing:bulk'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Which speed rule applies',
        method: 'GET',
        path: '/api/v1/catalog/speed-rules/resolve',
        requirement: {
          permissions: ['pricing:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Product picker',
        method: 'GET',
        path: '/api/v1/products',
        requirement: {
          permissions: ['products:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Category menu',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
      },
      {
        label: 'Branch menu',
        method: 'GET',
        path: '/api/v1/branches',
        enforcement: 'auth_only',
      },
      {
        label: 'Service speed menu',
        method: 'GET',
        path: '/api/v1/lookups/service-speeds',
        enforcement: 'auth_only',
      },
    ],
    notes: [
      'Child under catalog nav. Reuses the existing pricing:* codes (P0-05), so no permission migration; navigation in 0691.',
    ],
  },
  {
    routePattern: '/dashboard/catalog/pricing/[id]',
    label: 'Pricing Details',
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'Get price list',
        method: 'GET',
        path: '/api/v1/price-lists/[id]',
        requirement: {
          permissions: ['pricing:read'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update price list',
        method: 'PATCH',
        path: '/api/v1/price-lists/[id]',
        requirement: {
          permissions: ['pricing:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Manage price list items',
        method: 'POST',
        path: '/api/v1/price-lists/[id]/items',
        requirement: {
          permissions: ['pricing:update'],
          requireAllPermissions: true,
        },
      },
      {
        label: 'Update price list item',
        method: 'PUT',
        path: '/api/v1/price-lists/[id]/items/[itemId]',
        requirement: {
          permissions: ['pricing:update'],
          requireAllPermissions: true,
        },
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
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    notes: CATALOG_CHILD_NOTES,
  },
  {
    routePattern: '/dashboard/catalog/categories',
    label: 'Catalog Categories',
    page: {
      permissions: ['admin:manage'],
      requireAllPermissions: true,
    },
    apiDependencies: [
      {
        label: 'List categories',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
      },
      {
        label: 'List enabled categories',
        method: 'GET',
        path: '/api/v1/categories',
        enforcement: 'auth_only',
        notes: ['Session-only: validated session (validateJWTWithTenant); reference data read by order and processing screens (BF-23).'],
      },
      {
        label: 'Toggle category enablement',
        method: 'POST',
        path: '/api/v1/categories',
        requirement: {
          permissions: ['products:categories'],
          requireAllPermissions: true,
        },
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
