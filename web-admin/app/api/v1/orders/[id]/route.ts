/**
 * GET /api/v1/orders/[id]
 * Fetch a single order by ID for detail/edit views.
 * Used by the edit order page; enforces tenant isolation via session.
 */

import { NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { getOrderById } from '@/lib/db/orders';
import { prisma } from '@/lib/db/prisma';

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
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

    const order = await getOrderById(tenantId, id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Load pieces for all order items (for edit screen)
    const itemIds = (order.items ?? []).map((i: { id: string }) => i.id);
    const piecesList =
      itemIds.length > 0
        ? await prisma.org_order_item_pieces_dtl.findMany({
            where: {
              order_id: id,
              tenant_org_id: tenantId,
              order_item_id: { in: itemIds },
            },
            orderBy: [{ order_item_id: 'asc' }, { piece_seq: 'asc' }],
          })
        : [];

    const piecesByItemId = piecesList.reduce<Record<string, typeof piecesList>>(
      (acc, p) => {
        const key = p.order_item_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      },
      {}
    );

    // Option B: Fallback — resolve product names from catalog for items with null product_name
    const itemsMissingName = (order.items ?? []).filter(
      (item: Record<string, unknown>) => !item.product_name && item.product_id
    );
    const productNameMap: Record<string, { product_name: string | null; product_name2: string | null }> = {};
    if (itemsMissingName.length > 0) {
      const missingProductIds = [
        ...new Set(itemsMissingName.map((i: Record<string, unknown>) => i.product_id as string)),
      ];
      const catalogProducts = await prisma.org_product_data_mst.findMany({
        where: { tenant_org_id: tenantId, id: { in: missingProductIds } },
        select: { id: true, product_name: true, product_name2: true },
      });
      for (const p of catalogProducts) {
        productNameMap[p.id] = { product_name: p.product_name ?? null, product_name2: p.product_name2 ?? null };
      }
    }

    const customer = order.customer as { name?: string; phone?: string; email?: string } | undefined;
    const customerName = customer?.name ?? null;
    const customerMobile = customer?.phone ?? null;
    const customerEmail = customer?.email ?? null;

    const serializedOrder = {
      ...order,
      customer_name: customerName,
      customer_mobile: customerMobile,
      customer_email: customerEmail,
      customer_notes: order.customer_notes ?? null,
      internal_notes: order.internal_notes ?? null,
      payment_notes: order.payment_notes ?? null,
      notes: order.internal_notes ?? order.customer_notes ?? '',
      is_express: order.priority === 'express',
      ready_by_at: order.ready_by ?? order.ready_by_at_new ?? null,
      subtotal: toNumber(order.subtotal) ?? 0,
      discount: toNumber(order.discount) ?? 0,
      tax: toNumber(order.tax) ?? 0,
      total: toNumber(order.total) ?? 0,
      paid_amount: toNumber(order.paid_amount) ?? null,
      bag_count: toNumber(order.bag_count) ?? null,
      priority_multiplier: toNumber(order.priority_multiplier) ?? null,
      items: (order.items ?? []).map((item: Record<string, unknown>) => {
        const itemPieces = (item.id && piecesByItemId[item.id as string]) || [];
        const catalog = (!item.product_name && item.product_id)
          ? productNameMap[item.product_id as string]
          : undefined;
        return {
          ...item,
          product_name: (item.product_name as string | null) ?? catalog?.product_name ?? null,
          product_name2: (item.product_name2 as string | null) ?? catalog?.product_name2 ?? null,
          price_per_unit: toNumber(item.price_per_unit) ?? 0,
          total_price: toNumber(item.total_price) ?? 0,
          quantity: toNumber(item.quantity) ?? 1,
          quantity_ready: toNumber(item.quantity_ready) ?? 0,
          price_override: toNumber(item.price_override) ?? null,
          default_sell_price: toNumber(item.default_sell_price) ?? null,
          default_express_sell_price: toNumber(item.default_express_sell_price) ?? null,
          pieces: itemPieces.map((p) => ({
            id: p.id,
            color: p.color ?? undefined,
            brand: p.brand ?? undefined,
            has_stain: p.has_stain ?? false,
            has_damage: p.has_damage ?? false,
            notes: p.notes ?? undefined,
            rack_location: p.rack_location ?? undefined,
            metadata: (p.metadata as Record<string, unknown>) ?? undefined,
          })),
        };
      }),
    };

    return NextResponse.json({
      success: true,
      data: serializedOrder,
    });
  } catch (error) {
    console.error('GET /api/v1/orders/[id] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch order';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
