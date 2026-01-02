/**
 * Navigation Service
 * 
 * Fetches and processes navigation items from sys_components_cd table
 * Filters by user permissions and builds parent chain
 */

import { createClient } from '@/lib/supabase/server'
import { getIcon, ICON_REGISTRY } from '@/lib/utils/icon-registry'
import type { NavigationSection, NavigationItem, UserRole } from '@/config/navigation'
import { NAVIGATION_SECTIONS, getNavigationForRole } from '@/config/navigation'

/**
 * Get basic navigation for super_admin as last resort
 * This ensures super_admin always has navigation even if everything else fails
 */
function getBasicNavigationForSuperAdmin(): NavigationSection[] {
  console.warn('Using basic navigation fallback for super_admin')
  return [
    {
      key: 'home',
      label: 'Dashboard',
      icon: 'Home',
      path: '/dashboard',
      roles: ['super_admin'],
    },
    {
      key: 'orders',
      label: 'Orders',
      icon: 'PackageSearch',
      path: '/dashboard/orders',
      roles: ['super_admin'],
    },
    {
      key: 'customers',
      label: 'Customers',
      icon: 'Users',
      path: '/dashboard/customers',
      roles: ['super_admin'],
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: 'Settings',
      path: '/dashboard/settings',
      roles: ['super_admin'],
    },
  ] as any
}

export interface NavigationItemDB {
  comp_id: string
  parent_comp_id: string | null
  comp_code: string
  parent_comp_code: string | null
  label: string | null
  label2: string | null
  comp_path: string | null
  comp_icon: string | null
  badge: string | null
  display_order: number | null
  comp_level: number | null
  is_leaf: boolean | null
  roles: any // JSONB array from database
  permissions: any // JSONB array from database
  require_all_permissions: boolean | null
  feature_flag: any // JSONB array from database
  main_permission_code: string | null
}

/**
 * Get navigation items from database filtered by permissions
 * @param userPermissions User's permission codes
 * @param userRole User's role
 * @param featureFlags Enabled feature flags
 * @returns Navigation sections array
 */
export async function getNavigationFromDatabase(
  userPermissions: string[],
  userRole: UserRole,
  featureFlags: Record<string, boolean> = {}
): Promise<NavigationSection[]> {
  try {
    
    console.log('Jh In getNavigationFromDatabase() [ 3 ] : userRole', userRole);
    console.log('Jh In getNavigationFromDatabase() [ 4 ] : userPermissions length', userPermissions.length);
    console.log('Jh In getNavigationFromDatabase() [ 5 ] : featureFlags length', Object.keys(featureFlags).length);
    const supabase = await createClient()

    // Test: Try to read directly from the table to verify RLS and data access
    const { data: directData, error: directError } = await supabase
      .from('sys_components_cd')
      .select('comp_code, label, is_active, is_navigable, comp_level, parent_comp_code')
      .eq('is_active', true)
      .eq('is_navigable', true)
      .limit(10);
    
    console.log('Direct table query test:', {
      directDataLength: directData?.length || 0,
      directData: directData,
      directError: directError,
      sampleItems: directData?.slice(0, 3).map((item: any) => ({
        comp_code: item.comp_code,
        label: item.label,
        comp_level: item.comp_level,
        has_parent: !!item.parent_comp_code,
      })),
    });

    // Convert feature flags object to JSONB array format
    const featureFlagArray = Object.keys(featureFlags).filter(
      (key) => featureFlags[key] === true
    )

    // Call the database function
    // The function expects p_feature_flags as JSONB array
    // Pass empty array if no permissions to avoid NULL issues
    const functionParams = {
      p_user_permissions: userPermissions.length > 0 ? userPermissions : [],
      p_user_role: userRole || null,
      p_feature_flags: featureFlagArray.length > 0 ? featureFlagArray : [],
    };
    
    console.log('Jh In getNavigationFromDatabase() [ 6 ] : Calling get_navigation_with_parents_jh with:', functionParams);
    
    const { data, error } = await supabase.rpc('get_navigation_with_parents_jh', functionParams)
    
    console.log('Jh In getNavigationFromDatabase() [ 1 ] : data received:', {
      dataLength: data?.length || 0,
      data: data,
      error: error,
    });
    
    if (error) {
      console.error('Database function error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
    
    if (error) {
      console.error('Error fetching navigation from database:', error)
      // Return empty array if error (no default fallback)
      const fallback = getSystemNavigationFallback(userRole || null, userPermissions, featureFlags)
      // Ensure super_admin always gets navigation items
      if (fallback.length === 0 && userRole === 'super_admin') {
        return getBasicNavigationForSuperAdmin()
      }
      return fallback
    }

    if (!data || data.length === 0) {
      console.warn('No navigation items found in database for user, using fallback', {
        userRole,
        permissionsCount: userPermissions.length,
      })
      // Use fallback navigation when database returns empty
      const fallback = getSystemNavigationFallback(userRole || null, userPermissions, featureFlags)
      console.log('Fallback navigation returned:', fallback.length, 'sections')
      
      // Ensure super_admin always gets navigation items
      if (fallback.length === 0 && userRole === 'super_admin') {
        console.error('CRITICAL: Fallback returned empty for super_admin! This should never happen.')
        // Return basic navigation as last resort
        return getBasicNavigationForSuperAdmin()
      }
      
      return fallback
    }

    // Transform database records to NavigationSection format
    const transformed = transformToNavigationSections(data as NavigationItemDB[])
    console.log('Transformed navigation from database:', transformed.length, 'sections')
    return transformed
  } catch (error) {
    console.error('Error in getNavigationFromDatabase:', error)
    // Return empty array on error (no default fallback)
    return getSystemNavigationFallback(userRole || null, userPermissions, featureFlags)
  }
}

/**
 * Transform database records to NavigationSection[] format
 * @param dbItems Database records
 * @returns Navigation sections array
 */
function transformToNavigationSections(
  dbItems: NavigationItemDB[]
): NavigationSection[] {
  // Create a map for quick lookup
  const itemMap = new Map<string, NavigationItemDB>()
  const childrenMap = new Map<string, NavigationItemDB[]>()

  // Index all items
  dbItems.forEach((item) => {
    itemMap.set(item.comp_code, item)

    if (item.parent_comp_code) {
      if (!childrenMap.has(item.parent_comp_code)) {
        childrenMap.set(item.parent_comp_code, [])
      }
      childrenMap.get(item.parent_comp_code)!.push(item)
    }
  })

  // Build navigation sections (top-level items only)
  const sections: NavigationSection[] = []

  dbItems.forEach((item) => {
    // Only process top-level items (no parent)
    if (!item.parent_comp_code && item.comp_level === 0) {
      const section = transformItemToSection(item, childrenMap, itemMap)
      if (section) {
        sections.push(section)
      }
    }
  })

  // Sort by display_order
  sections.sort((a, b) => {
    const itemA = itemMap.get(a.key)
    const itemB = itemMap.get(b.key)
    const orderA = itemA?.display_order ?? 999
    const orderB = itemB?.display_order ?? 999
    return orderA - orderB
  })

  return sections
}

/**
 * Transform a single database item to NavigationSection
 */
function transformItemToSection(
  item: NavigationItemDB,
  childrenMap: Map<string, NavigationItemDB[]>,
  itemMap: Map<string, NavigationItemDB>
): NavigationSection | null {
  const icon = getIcon(item.comp_icon)

  // Get children if any
  const children = childrenMap.get(item.comp_code) || []
  const navigationChildren: NavigationItem[] = children
    .map((child) => transformItemToNavigationItem(child))
    .filter((child): child is NavigationItem => child !== null)
    .sort((a, b) => {
      const childA = itemMap.get(a.key)
      const childB = itemMap.get(b.key)
      const orderA = childA?.display_order ?? 999
      const orderB = childB?.display_order ?? 999
      return orderA - orderB
    })

  // Return icon name as string for JSON serialization (will be converted to component on client)
  return {
    key: item.comp_code,
    label: item.label || item.comp_code,
    icon: item.comp_icon || 'Home', // Store icon name as string
    path: item.comp_path || `#${item.comp_code}`,
    roles: item.roles && item.roles.length > 0 ? (item.roles as UserRole[]) : undefined,
    permissions: item.permissions && item.permissions.length > 0 ? item.permissions : undefined,
    requireAllPermissions: item.require_all_permissions || false,
    featureFlag: item.feature_flag && item.feature_flag.length > 0 ? item.feature_flag[0] : undefined,
    badge: item.badge || undefined,
    children: navigationChildren.length > 0 ? navigationChildren : undefined,
  } as any // Type assertion needed because icon is string, not LucideIcon
}

/**
 * Transform a database item to NavigationItem (child)
 */
function transformItemToNavigationItem(
  item: NavigationItemDB
): NavigationItem | null {
  // Parse JSONB arrays
  const rolesArray = Array.isArray(item.roles) ? item.roles : (item.roles ? JSON.parse(JSON.stringify(item.roles)) : [])
  const permissionsArray = Array.isArray(item.permissions) ? item.permissions : (item.permissions ? JSON.parse(JSON.stringify(item.permissions)) : [])
  const featureFlagArray = Array.isArray(item.feature_flag) ? item.feature_flag : (item.feature_flag ? JSON.parse(JSON.stringify(item.feature_flag)) : [])

  return {
    key: item.comp_code,
    label: item.label || item.comp_code,
    path: item.comp_path || `#${item.comp_code}`,
    roles: rolesArray && rolesArray.length > 0 ? (rolesArray as UserRole[]) : undefined,
    permissions: permissionsArray && permissionsArray.length > 0 ? permissionsArray : undefined,
    requireAllPermissions: item.require_all_permissions || false,
    featureFlag: featureFlagArray && featureFlagArray.length > 0 ? featureFlagArray[0] : undefined,
  }
}

/**
 * Get icon name from LucideIcon component
 * Reverse lookup to convert component to name string for JSON serialization
 */
function getIconName(iconComponent: any): string {
  if (!iconComponent || typeof iconComponent !== 'function') {
    return 'Home'
  }

  // Find the icon name by comparing component references
  const iconNames = Object.keys(ICON_REGISTRY)
  for (const name of iconNames) {
    if (ICON_REGISTRY[name] === iconComponent) {
      return name
    }
  }

  return 'Home'
}

/**
 * Get system navigation fallback (hardcoded)
 * Converts icon components to strings for JSON serialization
 * Filters by role and permissions to ensure security
 * Returns empty array if no role/permissions provided (no default access)
 * @param userRole User's role (null if not authenticated)
 * @param userPermissions User's permissions (empty array if none)
 * @param featureFlags Feature flags (optional)
 * @returns Hardcoded navigation sections with icon names as strings, filtered by permissions
 */
export function getSystemNavigationFallback(
  userRole: UserRole | null = null,
  userPermissions: string[] = [],
  featureFlags: Record<string, boolean> = {}
): NavigationSection[] {
  // If no role provided, return empty array (no default access)
  if (!userRole) {
    console.warn('getSystemNavigationFallback: No user role provided')
    return []
  }

  console.log('getSystemNavigationFallback called with:', {
    userRole,
    permissionsCount: userPermissions.length,
    featureFlagsCount: Object.keys(featureFlags).length,
  })

  try {
  // Get filtered navigation by role/permissions
  const filtered = getNavigationForRole(userRole, featureFlags, userPermissions)
    
    console.log('getNavigationForRole returned:', filtered.length, 'sections')
  
  // Convert icon components to strings for JSON serialization
    const result = filtered.map((section) => {
      try {
        return {
    ...section,
    icon: getIconName(section.icon), // Convert component to string name
        }
      } catch (iconError) {
        console.error('Error converting icon for section:', section.key, iconError)
        return {
          ...section,
          icon: 'Home', // Fallback icon name
        }
      }
    }) as any // Type assertion needed because icon is string, not LucideIcon
    
    console.log('getSystemNavigationFallback returning:', result.length, 'sections')
    return result
  } catch (error) {
    console.error('Error in getSystemNavigationFallback:', error)
    // Return basic navigation as fallback for super_admin
    if (userRole === 'super_admin') {
      return getBasicNavigationForSuperAdmin()
    }
    return []
  }
}

/**
 * Filter navigation by additional rules (roles, feature flags)
 * This is handled by the database function, but kept for compatibility
 */
export function filterByAdditionalRules(
  items: NavigationSection[],
  userRole: UserRole,
  featureFlags: Record<string, boolean>
): NavigationSection[] {
  return items.filter((section) => {
    // Check roles
    if (section.roles && section.roles.length > 0 && !section.roles.includes(userRole)) {
      return false
    }

    // Check feature flags
    if (section.featureFlag && !featureFlags[section.featureFlag]) {
      return false
    }

    // Filter children
    if (section.children) {
      section.children = section.children.filter((child) => {
        if (child.roles && child.roles.length > 0 && !child.roles.includes(userRole)) {
          return false
        }
        if (child.featureFlag && !featureFlags[child.featureFlag]) {
          return false
        }
        return true
      })
    }

    return true
  })
}
