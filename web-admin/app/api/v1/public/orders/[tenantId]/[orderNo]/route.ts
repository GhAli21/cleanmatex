/**
 * Public Order Tracking API
 * GET /api/v1/public/orders/[tenantId]/[orderNo]
 *
 * Fully public, read-only endpoint to fetch limited, customer-facing
 * order details by tenant + order number.
 *
 * IMPORTANT:
 * - Still enforces tenant isolation by always filtering with tenant_org_id.
 * - Does NOT require authentication; anyone with the URL can access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { OrderService } from '@/lib/services/order-service';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ tenantId: string; orderNo: string }> },
) {
    const startedAt = Date.now();

    try {
        const { tenantId, orderNo } = await params;

        if (!tenantId || !orderNo) {
            return NextResponse.json(
                { success: false, error: 'Tenant ID and order number are required' },
                { status: 400 },
            );
        }

        const supabase = await createClient();

        // Fetch core order data with customer + items needed for public view
        const { data: order, error } = await supabase
            .from('org_orders_mst')
            .select(
                `
          id,
          order_no,
          current_status,
          status,
          received_at,
          ready_by,
          ready_by_at_new,
          subtotal,
          total,
          payment_status,
          paid_amount,
          priority,
          customer_notes,
          branch_id,
          bag_count,
          rack_location,
          org_customers_mst(
            id,
            name,
            name2,
            phone,
            email
          ),
          org_order_items_dtl(
            id,
            quantity,
            total_price,
            org_product_data_mst(
              id,
              product_name,
              product_name2,
              product_code
            )
          )
        `,
            )
            .eq('tenant_org_id', tenantId)
            .eq('order_no', orderNo)
            .single();

        if (error || !order) {
            logger.warn('Public order not found', {
                feature: 'public_orders',
                action: 'get_public_order',
                orderNo,
                tenantId,
                error: error?.message,
            });

            return NextResponse.json(
                {
                    success: false,
                    error: 'Order not found',
                },
                { status: 404 },
            );
        }

        // Fetch status history for timeline using existing service
        const history = await OrderService.getOrderHistory(order.id, tenantId);

        const durationMs = Date.now() - startedAt;
        logger.info('Public order tracking success', {
            feature: 'public_orders',
            action: 'get_public_order',
            tenantId,
            orderId: order.id,
            orderNo: order.order_no,
            durationMs,
        });

        // Shape data for public consumer – hide internal-only fields
        const responsePayload = {
            order: {
                id: order.id,
                orderNo: order.order_no as string,
                status: order.current_status || order.status,
                priority: order.priority,
                receivedAt: order.received_at,
                readyBy: order.ready_by_at_new || order.ready_by || null,
                totals: {
                    subtotal: order.subtotal ? Number(order.subtotal) : null,
                    total: order.total ? Number(order.total) : null,
                    paidAmount: order.paid_amount ? Number(order.paid_amount) : null,
                    paymentStatus: order.payment_status,
                },
                bagCount: order.bag_count ? Number(order.bag_count) : null,
                rackLocation: order.rack_location,
                customer: order.org_customers_mst
                    ? {
                        name: order.org_customers_mst.name,
                        name2: order.org_customers_mst.name2,
                        phone: order.org_customers_mst.phone,
                        email: order.org_customers_mst.email,
                    }
                    : null,
                items: (order.org_order_items_dtl || []).map((item: any) => ({
                    id: item.id,
                    name: item.org_product_data_mst?.product_name || item.product_name || null,
                    name2: item.org_product_data_mst?.product_name2 || item.product_name2 || null,
                    quantity: item.quantity ? Number(item.quantity) : 0,
                    totalPrice: item.total_price ? Number(item.total_price) : 0,
                })),
                customerNotes: order.customer_notes,
            },
            timeline: history.map((entry: any) => ({
                id: entry.id,
                type: entry.action_type,
                from: entry.from_value,
                to: entry.to_value,
                doneAt: entry.done_at,
            })),
        };

        return NextResponse.json(
            {
                success: true,
                data: responsePayload,
            },
            { status: 200 },
        );
    } catch (error) {
        const durationMs = Date.now() - startedAt;
        logger.error('Public order tracking failed', error as Error, {
            feature: 'public_orders',
            action: 'get_public_order',
            durationMs,
        });

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 },
        );
    }
}


