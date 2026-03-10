import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + (error?.message ?? ''));
  }
  return { tenantId: tenants[0].tenant_id as string };
}

interface StepResult {
  step_id: string;
  status: 'success' | 'error' | 'skipped';
  summary: string | null;
  details: Record<string, unknown> | null;
  error_message: string | null;
}

/** Fix product names: backfill product_name/product_name2 from catalog for items missing them */
async function fixProductNames(
  tenantId: string,
  orderId: string,
  dryRun: boolean
): Promise<StepResult> {
  try {
    const items = await prisma.org_order_items_dtl.findMany({
      where: {
        order_id: orderId,
        tenant_org_id: tenantId,
        product_name: null,
      },
      select: { id: true, product_id: true },
    });

    if (items.length === 0) {
      return {
        step_id: 'fix_product_names',
        status: 'success',
        summary: null,
        details: { items_fixed: 0, dry_run: dryRun },
        error_message: null,
      };
    }

    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
    const products = await prisma.org_product_data_mst.findMany({
      where: { tenant_org_id: tenantId, id: { in: productIds } },
      select: { id: true, product_name: true, product_name2: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const itemsToFix = items.filter((i) => i.product_id && productMap.has(i.product_id));

    if (itemsToFix.length === 0) {
      return {
        step_id: 'fix_product_names',
        status: 'success',
        summary: 'No matching products found in catalog.',
        details: { items_fixed: 0, dry_run: dryRun },
        error_message: null,
      };
    }

    if (!dryRun) {
      await prisma.$transaction(
        itemsToFix.map((item) => {
          const product = productMap.get(item.product_id!)!;
          return (prisma.org_order_items_dtl as any).update({
            where: { id: item.id, tenant_org_id: tenantId },
            data: {
              product_name: product.product_name ?? null,
              product_name2: product.product_name2 ?? null,
            },
          });
        })
      );
    }

    return {
      step_id: 'fix_product_names',
      status: 'success',
      summary: dryRun
        ? `${itemsToFix.length} item(s) would have product names restored from catalog.`
        : `${itemsToFix.length} item(s) had product names restored from catalog.`,
      details: { items_fixed: itemsToFix.length, dry_run: dryRun },
      error_message: null,
    };
  } catch (e) {
    return {
      step_id: 'fix_product_names',
      status: 'error',
      summary: null,
      details: null,
      error_message: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { tenantId } = await getAuthContext();
    const supabase = await createClient();

    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('id')
      .eq('id', orderId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const steps: string[] = Array.isArray(body.steps)
      ? body.steps
      : ['complete_order_item_pieces'];
    const dryRun = Boolean(body.dryRun);

    // Separate JS-handled steps from RPC-handled steps
    const rpcSteps = steps.filter((s) => s !== 'fix_product_names');
    const doFixProductNames = steps.includes('fix_product_names');

    const allStepResults: StepResult[] = [];

    // Run RPC steps if any
    if (rpcSteps.length > 0) {
      const { data: fixResult, error: rpcError } = await supabase.rpc('fix_order_data', {
        p_tenant_org_id: tenantId,
        p_steps: rpcSteps,
        p_order_id: orderId,
        p_dry_run: dryRun,
      });

      if (rpcError) {
        return NextResponse.json(
          { success: false, error: rpcError.message ?? 'Fix failed' },
          { status: 500 }
        );
      }

      if (fixResult && Array.isArray(fixResult.steps)) {
        allStepResults.push(...fixResult.steps);
      }
    }

    // Run fix_product_names step if requested
    if (doFixProductNames) {
      const result = await fixProductNames(tenantId, orderId, dryRun);
      allStepResults.push(result);
    }

    const hasError = allStepResults.some((s) => s.status === 'error');
    const hasSuccess = allStepResults.some((s) => s.status === 'success');
    const overall = hasError ? (hasSuccess ? 'partial' : 'error') : 'success';

    return NextResponse.json({
      success: true,
      data: { overall, steps: allStepResults, dry_run: dryRun },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
