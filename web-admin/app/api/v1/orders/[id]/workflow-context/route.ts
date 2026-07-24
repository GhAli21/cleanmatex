import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

type TemplateJoin = {
  template_code: string | null
  template_name: string | null
} | null

/**
 * GET /api/v1/orders/[id]/workflow-context
 *
 * Session-authenticated, tenant-scoped. Returns the order's workflow template
 * context (from order.workflow_template_id or tenant default in
 * org_tenant_workflow_templates_cf) plus stage enablement flags.
 *
 * Metrics are not loaded here — callers already have order items in UI state.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const { tenantId } = await getAuthContext()
    const supabase = await createClient()

    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('id, workflow_template_id')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle()

    if (orderError) {
      logger.error(
        'workflow-context order lookup failed',
        new Error(orderError.message),
        { tenantId, orderId, feature: 'workflow', action: 'workflow_context' }
      )
      return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Prefer order template; fall back to tenant default assignment
    let templateId = order.workflow_template_id as string | null
    let allowBackSteps = false
    let templateCode: string | null = null
    let templateName: string | null = null
    let isTenantDefault = false

    if (templateId) {
      const { data: tenantTemplate } = await supabase
        .from('org_tenant_workflow_templates_cf')
        .select(
          'template_id, is_default, allow_back_steps, sys_workflow_template_cd(template_code, template_name)'
        )
        .eq('tenant_org_id', tenantId)
        .eq('template_id', templateId)
        .eq('is_active', true)
        .maybeSingle()

      if (tenantTemplate) {
        allowBackSteps = tenantTemplate.allow_back_steps === true
        isTenantDefault = tenantTemplate.is_default === true
        const joined = tenantTemplate.sys_workflow_template_cd as unknown as TemplateJoin
        templateCode = joined?.template_code ?? null
        templateName = joined?.template_name ?? null
      } else {
        const { data: catalog } = await supabase
          .from('sys_workflow_template_cd')
          .select('template_code, template_name')
          .eq('template_id', templateId)
          .maybeSingle()
        templateCode = catalog?.template_code ?? null
        templateName = catalog?.template_name ?? null
      }
    } else {
      const { data: defaultTemplate } = await supabase
        .from('org_tenant_workflow_templates_cf')
        .select(
          'template_id, is_default, allow_back_steps, sys_workflow_template_cd(template_code, template_name)'
        )
        .eq('tenant_org_id', tenantId)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle()

      if (defaultTemplate?.template_id) {
        templateId = defaultTemplate.template_id
        allowBackSteps = defaultTemplate.allow_back_steps === true
        isTenantDefault = true
        const joined = defaultTemplate.sys_workflow_template_cd as unknown as TemplateJoin
        templateCode = joined?.template_code ?? null
        templateName = joined?.template_name ?? null
      }
    }

    if (!templateId) {
      return NextResponse.json({
        orderId,
        flags: {
          template_id: null,
          template_code: null,
          template_name: null,
          template_version_number: null,
          is_tenant_default: false,
          allow_back_steps: false,
          assembly_enabled: false,
          qa_enabled: false,
          packing_enabled: false,
        },
      })
    }

    const [stagesResult, versionResult] = await Promise.all([
      supabase
        .from('sys_workflow_template_stages')
        .select('stage_code')
        .eq('template_id', templateId)
        .eq('is_active', true),
      supabase
        .from('sys_ord_workflow_template_versions')
        .select('version_number')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (stagesResult.error) {
      logger.error(
        'workflow-context stages lookup failed',
        new Error(stagesResult.error.message),
        { tenantId, orderId, templateId, feature: 'workflow', action: 'workflow_context' }
      )
      return NextResponse.json({ error: 'Failed to load workflow stages' }, { status: 500 })
    }

    const stageCodes = new Set(
      (stagesResult.data ?? [])
        .map((s) => String(s.stage_code ?? '').toLowerCase())
        .filter(Boolean)
    )

    return NextResponse.json({
      orderId,
      flags: {
        template_id: templateId,
        template_code: templateCode,
        template_name: templateName,
        template_version_number: versionResult.data?.version_number ?? null,
        is_tenant_default: isTenantDefault,
        allow_back_steps: allowBackSteps,
        assembly_enabled: stageCodes.has('assembly'),
        qa_enabled: stageCodes.has('qa'),
        packing_enabled: stageCodes.has('packing'),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = /unauthorized/i.test(message) ? 401 : 500
    if (status >= 500) {
      logger.error(
        'GET /api/v1/orders/[id]/workflow-context failed',
        error instanceof Error ? error : new Error(message),
        { feature: 'workflow', action: 'workflow_context' }
      )
    }
    return NextResponse.json(
      { error: status === 401 ? 'Unauthorized' : 'Internal server error' },
      { status }
    )
  }
}
