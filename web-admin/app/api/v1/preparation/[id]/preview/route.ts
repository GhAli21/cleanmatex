/**
 * Preparation: Price preview
 * GET /api/v1/preparation/[id]/preview
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPreparationEnabled } from '@/lib/config/features';
import { TenantSettingsService } from '@/lib/services/tenant-settings.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isPreparationEnabled()) {
      return NextResponse.json({ success: false, error: 'Feature disabled' }, { status: 403 });
    }
    const { id: orderId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_org_id;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID not found' }, { status: 400 });
    }

    const { data: items, error } = await supabase
      .from('org_order_items_dtl')
      .select('quantity, total_price')
      .eq('tenant_org_id', tenantId)
      .eq('order_id', orderId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const subtotal = (items || []).reduce((sum, it) => sum + Number(it.total_price || 0), 0);
    const tenantSettings = new TenantSettingsService();
    const taxRateRaw = await tenantSettings.getSettingValue(tenantId, 'TENANT_TAX_RATE');
    const taxRate = taxRateRaw != null ? Number(taxRateRaw) : 0.05;
    const tax = subtotal * (Number.isFinite(taxRate) ? taxRate : 0.05);
    const total = subtotal + tax;
    const totalItems = (items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0);

    return NextResponse.json({
      success: true,
      data: { subtotal, tax, total, total_items: totalItems },
    });
  } catch (error) {
    console.error('GET /api/v1/preparation/[id]/preview error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


