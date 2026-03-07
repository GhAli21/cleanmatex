/**
 * Order Editability Check API
 * GET /api/v1/orders/[id]/editability
 * Returns whether an order can be edited
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { isOrderEditable } from '@/lib/utils/order-editability';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantIdFromSession();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID required' },
        { status: 401 }
      );
    }

    // Fetch order
    const order = await prisma.org_orders_mst.findFirst({
      where: {
        id,
        tenant_org_id: tenantId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check editability
    const editability = isOrderEditable(order as any);

    return NextResponse.json({
      success: true,
      data: editability,
    });
  } catch (error) {
    console.error('Error checking order editability:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check editability',
      },
      { status: 500 }
    );
  }
}
