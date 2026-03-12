/**
 * POST /api/v1/orders/:id/items/:itemId/apply-bundle/:bundleCode
 * Apply a preference bundle to an order item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderItemPreferenceService } from '@/lib/services/order-item-preference.service';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { checkPlanFlag } from '@/lib/services/plan-flags.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string; bundleCode: string }> }
) {
  try {
    const authCheck = await requirePermission('orders:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId, userId, userName } = authCheck;

    const supabase = await createClient();

    const bundlesEnabled = await checkPlanFlag(tenantId, 'bundles_enabled', supabase);
    if (!bundlesEnabled) {
      return NextResponse.json(
        { success: false, error: 'Care Packages not available on your plan' },
        { status: 403 }
      );
    }

    const { id: orderId, itemId, bundleCode } = await params;

    // Verify order item exists
    const { data: item, error: itemError } = await supabase
      .from('org_order_items_dtl')
      .select('id, order_id, tenant_org_id')
      .eq('id', itemId)
      .eq('order_id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, error: 'Order item not found' },
        { status: 404 }
      );
    }

    // Get bundle
    const { data: bundle } = await supabase
      .from('org_preference_bundles_cf')
      .select('preference_codes')
      .eq('tenant_org_id', tenantId)
      .eq('bundle_code', bundleCode)
      .eq('is_active', true)
      .single();

    if (!bundle || !bundle.preference_codes?.length) {
      return NextResponse.json(
        { success: false, error: 'Bundle not found or inactive' },
        { status: 404 }
      );
    }

    // Get service pref prices from catalog
    const servicePrefs = await PreferenceCatalogService.getServicePreferences(
      supabase,
      tenantId,
      null
    );
    const priceMap = new Map(servicePrefs.map((s) => [s.code, s.default_extra_price]));

    // Add each preference from bundle (skip if already on item)
    const existingPrefs = await OrderItemPreferenceService.getItemServicePrefs(
      supabase,
      tenantId,
      itemId
    );
    const existingCodes = new Set(existingPrefs.map((p) => p.preference_code));

    for (const code of bundle.preference_codes as string[]) {
      if (existingCodes.has(code)) continue;

      const extraPrice = priceMap.get(code) ?? 0;
      const result = await OrderItemPreferenceService.addItemServicePref(
        supabase,
        tenantId,
        orderId,
        itemId,
        { preference_code: code, source: 'bundle', extra_price: extraPrice },
        userId,
        userName
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      existingCodes.add(code);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[API] POST /orders/.../apply-bundle error', error instanceof Error ? error : new Error(String(error)), {
      feature: 'order_item_preference',
      action: 'apply_bundle',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to apply bundle' },
      { status: 500 }
    );
  }
}
