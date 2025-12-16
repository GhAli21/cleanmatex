import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Helper function to check if user has admin access or navigation management permissions
 */
async function checkNavigationAccess(supabase: ReturnType<typeof createClient>) {
  // Get user's tenants
  const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants')
  if (tenantsError || !tenants || tenants.length === 0) {
    return { allowed: false, error: 'No tenant access' }
  }

  const userRole = tenants[0].user_role?.toLowerCase()
  
  // Get user permissions
  const { data: permissionsData, error: permsError } = await supabase.rpc('get_user_permissions')
  const userPermissions: string[] = permsError
    ? []
    : (permissionsData || []).map((p: { permission_code: string }) => p.permission_code)

  // Check if user has admin role or relevant permissions
  const isAdmin = userRole === 'super_admin' || 
                  userRole === 'tenant_admin' ||
                  userPermissions.includes('*:*') ||
                  userPermissions.includes('settings:*') ||
                  userPermissions.includes('navigation:*') ||
                  userPermissions.includes('settings:read') ||
                  userPermissions.some(p => p.startsWith('navigation:'))

  if (!isAdmin) {
    return { 
      allowed: false, 
      error: 'Admin access or navigation management permissions required yours is : ' + userRole
    }
  }

  return { allowed: true }
}

/**
 * GET /api/navigation/components
 * Get all navigation components (admin only)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access
    const accessCheck = await checkNavigationAccess(supabase)
    if (!accessCheck.allowed) {
      return NextResponse.json({ error: accessCheck.error }, { status: 403 })
    }

    // Fetch all components (including inactive for admin management)
    const { data, error } = await supabase
      .from('sys_components_cd')
      .select('*')
      .order('comp_level', { ascending: true })
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching components:', error)
      return NextResponse.json({ error: 'Failed to fetch components' }, { status: 500 })
    }

    return NextResponse.json({ components: data || [] })
  } catch (error) {
    console.error('Error in GET /api/navigation/components:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/navigation/components
 * Create a new navigation component (admin only)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access
    const accessCheck = await checkNavigationAccess(supabase)
    if (!accessCheck.allowed) {
      return NextResponse.json({ error: accessCheck.error }, { status: 403 })
    }

    const body = await request.json()
    const {
      comp_code,
      parent_comp_code,
      label,
      label2,
      comp_path,
      comp_icon,
      main_permission_code,
      display_order,
      is_active = true,
      is_navigable = true,
      roles = [],
      permissions = [],
      feature_flag = [],
      badge,
    } = body

    // Validate required fields
    if (!comp_code || !label) {
      return NextResponse.json(
        { error: 'comp_code and label are required' },
        { status: 400 }
      )
    }

    // Get parent_comp_id if parent_comp_code is provided
    let parent_comp_id = null
    if (parent_comp_code) {
      const { data: parent } = await supabase
        .from('sys_components_cd')
        .select('comp_id')
        .eq('comp_code', parent_comp_code)
        .single()

      if (parent) {
        parent_comp_id = parent.comp_id
      }
    }

    // Determine comp_level
    const comp_level = parent_comp_id ? 1 : 0

    // Insert new component
    const { data, error } = await supabase
      .from('sys_components_cd')
      .insert({
        comp_code,
        parent_comp_id,
        parent_comp_code,
        label,
        label2,
        comp_path: comp_path || `#${comp_code}`,
        comp_icon: comp_icon || 'Home',
        main_permission_code,
        display_order: display_order ?? 0,
        comp_level,
        is_leaf: !parent_comp_id, // Will be updated if children are added
        is_navigable,
        is_active,
        is_system: true,
        is_for_tenant_use: true,
        roles: Array.isArray(roles) ? roles : [],
        permissions: Array.isArray(permissions) ? permissions : [],
        feature_flag: Array.isArray(feature_flag) ? feature_flag : [],
        badge,
        rec_status: 1,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating component:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create component' },
        { status: 500 }
      )
    }

    // Update parent's is_leaf if this is a child
    if (parent_comp_id) {
      await supabase
        .from('sys_components_cd')
        .update({ is_leaf: false })
        .eq('comp_id', parent_comp_id)
    }

    return NextResponse.json({ component: data }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/navigation/components:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
