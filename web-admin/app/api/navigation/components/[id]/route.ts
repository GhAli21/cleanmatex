import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/navigation/components/[id]
 * Get a single navigation component (admin only)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants')
    if (tenantsError || !tenants || tenants.length === 0) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 })
    }

    const userRole = tenants[0].user_role?.toLowerCase()
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('sys_components_cd')
      .select('*')
      .eq('comp_id', params.id)
      .single()

    if (error) {
      console.error('Error fetching component:', error)
      return NextResponse.json({ error: 'Component not found' }, { status: 404 })
    }

    return NextResponse.json({ component: data })
  } catch (error) {
    console.error('Error in GET /api/navigation/components/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/navigation/components/[id]
 * Update a navigation component (admin only)
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants')
    if (tenantsError || !tenants || tenants.length === 0) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 })
    }

    const userRole = tenants[0].user_role?.toLowerCase()
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      parent_comp_code,
      label,
      label2,
      comp_path,
      comp_icon,
      main_permission_code,
      display_order,
      is_active,
      is_navigable,
      roles,
      permissions,
      feature_flag,
      badge,
    } = body

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

    // Update component
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    if (parent_comp_code !== undefined) {
      updateData.parent_comp_code = parent_comp_code
      updateData.parent_comp_id = parent_comp_id
      updateData.comp_level = comp_level
    }
    if (label !== undefined) updateData.label = label
    if (label2 !== undefined) updateData.label2 = label2
    if (comp_path !== undefined) updateData.comp_path = comp_path
    if (comp_icon !== undefined) updateData.comp_icon = comp_icon
    if (main_permission_code !== undefined) updateData.main_permission_code = main_permission_code
    if (display_order !== undefined) updateData.display_order = display_order
    if (is_active !== undefined) updateData.is_active = is_active
    if (is_navigable !== undefined) updateData.is_navigable = is_navigable
    if (roles !== undefined) updateData.roles = Array.isArray(roles) ? roles : []
    if (permissions !== undefined) updateData.permissions = Array.isArray(permissions) ? permissions : []
    if (feature_flag !== undefined) updateData.feature_flag = Array.isArray(feature_flag) ? feature_flag : []
    if (badge !== undefined) updateData.badge = badge

    const { data, error } = await supabase
      .from('sys_components_cd')
      .update(updateData)
      .eq('comp_id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating component:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update component' },
        { status: 500 }
      )
    }

    return NextResponse.json({ component: data })
  } catch (error) {
    console.error('Error in PUT /api/navigation/components/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/navigation/components/[id]
 * Delete a navigation component (admin only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: tenants, error: tenantsError } = await supabase.rpc('get_user_tenants')
    if (tenantsError || !tenants || tenants.length === 0) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 })
    }

    const userRole = tenants[0].user_role?.toLowerCase()
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Check if component has children
    const { data: children } = await supabase
      .from('sys_components_cd')
      .select('comp_id')
      .eq('parent_comp_id', params.id)
      .limit(1)

    if (children && children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete component with children. Delete children first.' },
        { status: 400 }
      )
    }

    // Delete component
    const { error } = await supabase
      .from('sys_components_cd')
      .delete()
      .eq('comp_id', params.id)

    if (error) {
      console.error('Error deleting component:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to delete component' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/navigation/components/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
