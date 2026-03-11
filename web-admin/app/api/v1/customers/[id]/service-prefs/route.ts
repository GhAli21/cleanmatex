/**
 * GET/POST/DELETE /api/v1/customers/:id/service-prefs
 * Customer standing service preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { addCustomerServicePrefSchema } from '@/lib/validations/service-preferences-schemas';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { id: customerId } = await params;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('org_customer_service_prefs')
      .select('id, customer_id, preference_code, source, is_active')
      .eq('tenant_org_id', tenantId)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (error) {
      log.error('[API] GET /customers/.../service-prefs error', new Error(error.message), {
        feature: 'customer_service_prefs',
        action: 'get',
      });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch customer preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    log.error('[API] GET /customers/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_service_prefs',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer preferences' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const { id: customerId } = await params;
    const body = await request.json();

    const parsed = addCustomerServicePrefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.from('org_customer_service_prefs').insert({
      tenant_org_id: tenantId,
      customer_id: customerId,
      preference_code: parsed.data.preference_code,
      source: parsed.data.source,
      is_active: true,
      created_by: userId,
      created_info: userName,
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Preference already exists for this customer' },
          { status: 409 }
        );
      }
      log.error('[API] POST /customers/.../service-prefs error', new Error(error.message), {
        feature: 'customer_service_prefs',
        action: 'add',
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] POST /customers/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_service_prefs',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to add customer preference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { id: customerId } = await params;
    const { searchParams } = new URL(request.url);
    const prefId = searchParams.get('prefId');

    if (!prefId) {
      return NextResponse.json(
        { success: false, error: 'prefId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('org_customer_service_prefs')
      .update({ is_active: false })
      .eq('tenant_org_id', tenantId)
      .eq('customer_id', customerId)
      .eq('id', prefId);

    if (error) {
      log.error('[API] DELETE /customers/.../service-prefs error', new Error(error.message), {
        feature: 'customer_service_prefs',
        action: 'remove',
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] DELETE /customers/.../service-prefs error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'customer_service_prefs',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to remove customer preference' },
      { status: 500 }
    );
  }
}
