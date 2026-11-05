import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateJWTWithTenant } from '@/lib/middleware/jwt-tenant-validator';
import { createClient } from '@/lib/supabase/server';
import { WorkflowSettingsSchema } from '@/lib/validations/workflow-schema';

/**
 *
 * @param request
 */
export async function GET(request: NextRequest) {
  const auth = await validateJWTWithTenant(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { tenantId } = auth;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('org_workflow_settings_cf')
      .select('*', { count: 'exact' })
      .eq('tenant_org_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: { page, limit, total: count || 0, totalPages: count ? Math.ceil(count / limit) : 0 },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 *
 * @param request
 */
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission('settings:workflow')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { tenantId } = auth;
    const supabase = await createClient();
    const body = await request.json();

    // Ensure tenant-scoped updates only
    const parsed = WorkflowSettingsSchema.partial({ id: true, created_at: true, updated_at: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid workflow settings' }, { status: 400 });
    }

    const payload = parsed.data as any;
    payload.tenant_org_id = tenantId;

    // Upsert by (tenant_org_id, service_category_code)
    const { data, error } = await supabase
      .from('org_workflow_settings_cf')
      .upsert(payload, { onConflict: 'tenant_org_id,service_category_code' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

