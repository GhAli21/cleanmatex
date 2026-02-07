/**
 * Navigation Configuration
 *
 * Defines the sidebar navigation structure with:
 * - Role-based access control
 * - Feature flag dependencies
 * - Icons and routing
 */

import type { LucideIcon } from 'lucide-react'
import {
  Home,
  PackageSearch,
  ScanBarcode,
  Truck,
  PackageCheck,
  Users,
  Tags,
  Receipt,
  BarChart3,
  Boxes,
  Settings,
  LifeBuoy,
  ClipboardCheck,
  Settings2,
  CheckCircle,
  CircleCheck,
  Bug
} from 'lucide-react'

export type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer'

export interface NavigationSection {
  key: string
  label: string
  icon: LucideIcon
  path: string
  roles?: UserRole[]  // Optional: role-based access (fallback)
  permissions?: string[]  // Optional: permission-based access (e.g., ['orders:read'])
  requireAllPermissions?: boolean  // If true, require ALL permissions; if false, require ANY
  featureFlag?: string
  badge?: string
  children?: NavigationItem[]
}

export interface NavigationItem {
  key: string
  label: string
  path: string
  roles?: UserRole[]  // Optional: role-based access
  permissions?: string[]  // Optional: permission-based access
  requireAllPermissions?: boolean  // If true, require ALL permissions; if false, require ANY
  featureFlag?: string
}

/**
 * Main navigation configuration
 * Order is fixed as per PRD-007 specification
 */
export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    key: 'home',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
    roles: ['super_admin', 'admin', 'operator'],
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: PackageSearch,
    path: '/dashboard/orders',
    roles: ['super_admin', 'admin', 'operator'],
    children: [
      {
        key: 'orders_list',
        label: 'All Orders',
        path: '/dashboard/orders',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_new',
        label: 'New Order',
        path: '/dashboard/orders/new',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_preparation',
        label: 'Preparation',
        path: '/dashboard/preparation',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_processing',
        label: 'Processing',
        path: '/dashboard/processing',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_assembly',
        label: 'Assembly',
        path: '/dashboard/assembly',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_qa',
        label: 'Quality Check',
        path: '/dashboard/qa',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_ready',
        label: 'Ready',
        path: '/dashboard/ready',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_packing',
        label: 'Packing',
        path: '/dashboard/packing',
        roles: ['super_admin', 'admin', 'operator'],
      },
      {
        key: 'orders_delivery',
        label: 'Delivery',
        path: '/dashboard/delivery',
        roles: ['super_admin', 'admin', 'operator'],
      },
    ],
  }, 
  {
    key: 'assembly',
    label: 'AssemblyJh',
    icon: ScanBarcode,
    path: '/dashboard/assembly',
    roles: ['admin', 'operator'],
  },
  {
    key: 'drivers',
    label: 'Drivers & Routes',
    icon: Truck,
    path: '/dashboard/drivers',
    roles: ['admin'],
    featureFlag: 'driver_app',
    children: [
      {
        key: 'drivers_list',
        label: 'All Drivers',
        path: '/dashboard/drivers',
        roles: ['admin'],
        featureFlag: 'driver_app',
      },
      {
        key: 'drivers_routes',
        label: 'Routes',
        path: '/dashboard/drivers/routes',
        roles: ['admin'],
        featureFlag: 'driver_app',
      },
    ],
  },
  {
    key: 'delivery',
    label: 'Delivery',
    icon: Truck,
    path: '/dashboard/delivery',
    roles: ['admin', 'operator'],
  },
  {
    key: 'customers',
    label: 'Customers',
    icon: Users,
    path: '/dashboard/customers',
    roles: ['admin', 'operator'],
  },
  {
    key: 'catalog',
    label: 'Catalog & Pricing',
    icon: Tags,
    path: '/dashboard/catalog',
    roles: ['admin'],
    children: [
      {
        key: 'catalog_services',
        label: 'Services',
        path: '/dashboard/catalog/services',
        roles: ['admin'],
      },
      {
        key: 'catalog_pricing',
        label: 'Pricing',
        path: '/dashboard/catalog/pricing',
        roles: ['admin'],
      },
      {
        key: 'catalog_addons',
        label: 'Add-ons',
        path: '/dashboard/catalog/addons',
        roles: ['admin'],
      },
    ],
  },
  {
    key: 'billing',
    label: 'Invoices & Payments',
    icon: Receipt,
    path: '/dashboard/billing',
    roles: ['admin', 'operator'],
    children: [
      {
        key: 'billing_invoices',
        label: 'Invoices',
        path: '/dashboard/billing/invoices',
        roles: ['admin', 'operator'],
      },
      {
        key: 'billing_vouchers',
        label: 'Receipt Vouchers',
        path: '/dashboard/billing/vouchers',
        roles: ['admin', 'super_admin', 'operator'],
      },
      {
        key: 'billing_payments',
        label: 'Payments',
        path: '/dashboard/billing/payments',
        roles: ['admin', 'operator'],
      },
      {
        key: 'billing_cashup',
        label: 'Cash Up',
        path: '/dashboard/billing/cashup',
        roles: ['admin', 'operator'],
      },
    ],
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    icon: BarChart3,
    path: '/dashboard/reports',
    roles: ['admin'],
    featureFlag: 'advanced_analytics',
    children: [
      {
        key: 'reports_orders',
        label: 'Orders & Sales',
        path: '/dashboard/reports/orders',
        roles: ['admin'],
      },
      {
        key: 'reports_payments',
        label: 'Payments',
        path: '/dashboard/reports/payments',
        roles: ['admin'],
      },
      {
        key: 'reports_invoices',
        label: 'Invoices',
        path: '/dashboard/reports/invoices',
        roles: ['admin'],
      },
      {
        key: 'reports_revenue',
        label: 'Revenue',
        path: '/dashboard/reports/revenue',
        roles: ['admin'],
      },
      {
        key: 'reports_customers',
        label: 'Customers',
        path: '/dashboard/reports/customers',
        roles: ['admin'],
      },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory & Machines',
    icon: Boxes,
    path: '/dashboard/inventory',
    roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
    children: [
      {
        key: 'inventory_stock',
        label: 'Stock',
        path: '/dashboard/inventory/stock',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
      },
      {
        key: 'inventory_machines',
        label: 'Machines',
        path: '/dashboard/inventory/machines',
        roles: ['admin', 'super_admin', 'tenant_admin', 'operator'],
      },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/dashboard/settings',
    roles: ['admin'],
    children: [
      {
        key: 'settings_general',
        label: 'General',
        path: '/dashboard/settings/general',
        roles: ['admin'],
      },
      {
        key: 'settings_users',
        label: 'Team Members',
        path: '/dashboard/settings/users',
        roles: ['admin'],
      },
      {
        key: 'settings_roles',
        label: 'Roles & Permissions',
        path: '/dashboard/settings/roles',
        roles: ['admin'],
      },
      {
        key: 'settings_workflow_roles',
        label: 'Workflow Roles',
        path: '/dashboard/settings/workflow-roles',
        roles: ['admin'],
      },
      {
        key: 'settings_branding',
        label: 'Branding',
        path: '/dashboard/settings/branding',
        roles: ['admin'],
      },
      {
        key: 'settings_subscription',
        label: 'Subscription',
        path: '/dashboard/settings/subscription',
        roles: ['admin'],
      },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    icon: LifeBuoy,
    path: '/dashboard/help',
    roles: ['admin', 'operator'],
  },
  {
    key: 'jhtestui',
    label: 'JWT Test',
    icon: Bug,
    path: '/dashboard/jhtestui',
    roles: ['admin'],
  },
]

/**
 * Get navigation items for a specific role and permissions
 * @param role User role
 * @param featureFlags Enabled feature flags
 * @param permissions User permissions (optional, for granular control)
 * @returns Filtered navigation sections
 */
export function getNavigationForRole(
  role: UserRole | null,
  featureFlags: Record<string, boolean> = {},
  permissions: string[] = []
): NavigationSection[] {
  // If no role provided, return empty array (no default access)
  if (!role) {
    return []
  }

  return NAVIGATION_SECTIONS.filter((section) => {
    // STRICT FILTERING: Section must have either roles OR permissions defined
    // If neither is specified, deny access (no fallback to public)
    const hasRoleRequirement = section.roles && section.roles.length > 0
    const hasPermissionRequirement = section.permissions && section.permissions.length > 0

    // If section has no role or permission requirements, deny access
    if (!hasRoleRequirement && !hasPermissionRequirement) {
      return false
    }

    // Check role permission (if roles specified)
    if (hasRoleRequirement && !section.roles!.includes(role)) {
      return false
    }

    // Check permissions (if permissions specified)
    // If both roles and permissions are specified, user must satisfy both
    if (hasPermissionRequirement) {
      const hasPermission = section.requireAllPermissions
        ? section.permissions!.every(p => permissions.includes(p))
        : section.permissions!.some(p => permissions.includes(p))
      
      if (!hasPermission) {
        return false
      }
    }

    // Check feature flag if required
    if (section.featureFlag && !featureFlags[section.featureFlag]) {
      return false
    }

    // Filter children if present
    if (section.children) {
      section.children = section.children.filter((child) => {
        const childHasRoleRequirement = child.roles && child.roles.length > 0
        const childHasPermissionRequirement = child.permissions && child.permissions.length > 0

        // If child has no role or permission requirements, deny access
        if (!childHasRoleRequirement && !childHasPermissionRequirement) {
          return false
        }

        // Check child role permission
        if (childHasRoleRequirement && !child.roles!.includes(role)) {
          return false
        }

        // Check child permissions
        if (childHasPermissionRequirement) {
          const hasChildPermission = child.requireAllPermissions
            ? child.permissions!.every(p => permissions.includes(p))
            : child.permissions!.some(p => permissions.includes(p))
          if (!hasChildPermission) {
            return false
          }
        }

        // Check child feature flag
        if (child.featureFlag && !featureFlags[child.featureFlag]) {
          return false
        }

        return true
      })
      
      // Remove section if it has no valid children after filtering
      if (section.children.length === 0) {
        return false
      }
    }

    return true
  })
}

/**
 * Find navigation item by path
 * @param path Current route path
 * @returns Matching navigation section or null
 */
export function findNavigationByPath(path: string): NavigationSection | null {
  for (const section of NAVIGATION_SECTIONS) {
    if (section.path === path) {
      return section
    }
    if (section.children) {
      const child = section.children.find((c) => c.path === path)
      if (child) {
        return section
      }
    }
  }
  return null
}

/**
 * Check if path is active
 * @param currentPath Current route path
 * @param itemPath Navigation item path
 * @returns True if path matches or is a child route
 */
export function isPathActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) {
    return true
  }
  // Check if current path starts with item path (child route)
  return currentPath.startsWith(itemPath + '/')
}
