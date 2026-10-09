/**
 * Navigation Service
 * 
 * Fetches and processes navigation items from sys_components_cd table
 * Filters by user permissions and builds parent chain
 */

import { createClient } from '@/lib/supabase/server'
import { getIcon } from '@/lib/utils/icon-registry'
import type { NavigationSection, NavigationItem, UserRole } from '@/config/navigation'

/**
 *
 */
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
 * Menu gate from sys_components_cd.main_permission_code.
 * Null or blank means every signed-in user. This wins over navigation.ts permissions.
 * @param mainPermissionCode Value stored on the menu row
 * @returns One-code list, or undefined when the row is open to every signed-in user
 */
function menuPermissionList(mainPermissionCode: string | null | undefined): string[] | undefined {
  const code = mainPermissionCode?.trim()
  return code ? [code] : undefined
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
    // Every signed-in role uses the same permission menu. Admins are not a separate path.
    console.log('Jh In getNavigationFromDatabase() [ 3 ] : userRole', userRole);
    console.log('Jh In getNavigationFromDatabase() [ 4 ] : userPermissions length', userPermissions.length);
    console.log('Jh In getNavigationFromDatabase() [ 5 ] : featureFlags length', Object.keys(featureFlags).length);
    const supabase = await createClient()

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
      //data: data,
      error: error,
    });
    
    if (error) {
      console.error('Error in Jh In getNavigationFromDatabase() [ 10 ] : Database function error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
    
    if (error) {
      console.error('Error in Jh In getNavigationFromDatabase() [ 11 ] : Error fetching navigation from database:', error)
      return []
    }

    if (!data || data.length === 0) {
      // A successful empty result is the database answer. Do not replace it with navigation.ts.
      console.warn('No navigation items returned for user', {
        userRole,
        permissionsCount: userPermissions.length,
      })
      return []
    }

    // Transform database records to NavigationSection format
    const transformed = transformToNavigationSections(data as NavigationItemDB[])
    console.log('Transformed navigation from database:', transformed.length, 'sections')
    return transformed
  } catch (error) {
    console.error('Error in getNavigationFromDatabase:', error)
    return []
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
 * @param item
 * @param childrenMap
 * @param itemMap
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
    label2: item.label2 || undefined,
    icon: item.comp_icon || 'Home', // Store icon name as string
    path: item.comp_path || `#${item.comp_code}`,
    roles: item.roles && item.roles.length > 0 ? (item.roles as UserRole[]) : undefined,
    // main_permission_code is the menu gate. The jsonb permissions column is not.
    permissions: menuPermissionList(item.main_permission_code),
    requireAllPermissions: false,
    featureFlag: item.feature_flag && item.feature_flag.length > 0 ? item.feature_flag[0] : undefined,
    badge: item.badge || undefined,
    children: navigationChildren.length > 0 ? navigationChildren : undefined,
  } as any // Type assertion needed because icon is string, not LucideIcon
}

/**
 * Transform a database item to NavigationItem (child)
 * @param item
 */
function transformItemToNavigationItem(
  item: NavigationItemDB
): NavigationItem | null {
  // Parse JSONB arrays
  const rolesArray = Array.isArray(item.roles) ? item.roles : (item.roles ? JSON.parse(JSON.stringify(item.roles)) : [])
  const featureFlagArray = Array.isArray(item.feature_flag) ? item.feature_flag : (item.feature_flag ? JSON.parse(JSON.stringify(item.feature_flag)) : [])

  return {
    key: item.comp_code,
    label: item.label || item.comp_code,
    label2: item.label2 || undefined,
    path: item.comp_path || `#${item.comp_code}`,
    roles: rolesArray && rolesArray.length > 0 ? (rolesArray as UserRole[]) : undefined,
    // main_permission_code wins over the jsonb permissions column and over navigation.ts.
    permissions: menuPermissionList(item.main_permission_code),
    requireAllPermissions: false,
    featureFlag: featureFlagArray && featureFlagArray.length > 0 ? featureFlagArray[0] : undefined,
  }
}
