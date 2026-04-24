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
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';
import { OrderService } from '@/lib/services/order-service';

/**
 * Returns public order detail payload by tenant and order number.
 *
 * @param _request Incoming HTTP request.
 * @param params Route context object.
 * @param params.params Route params promise containing tenantId and orderNo.
 * @returns JSON response with public order details and timeline.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ tenantId: string; orderNo: string }> },
) {
    const startedAt = Date.now();
    const baseContext = buildPublicApiLogContext(_request, {
        feature: 'public_orders_detail_api',
        action: 'get_public_order_detail',
    });

    try {
        logger.info('Public order detail request received', baseContext);
        const { tenantId, orderNo } = await params;
        const requestContext = {
            ...baseContext,
            tenantId,
            orderNo,
            hasTenantId: tenantId.trim().length > 0,
            hasOrderNo: orderNo.trim().length > 0,
            userAgent: _request.headers.get('user-agent') ?? 'unknown',
        };

        logger.info('Public order detail route parameters parsed', requestContext);

        if (!tenantId || !orderNo) {
            logger.warn('Public order detail request rejected due to missing route params', {
                ...requestContext,
                missingTenantId: !tenantId,
                missingOrderNo: !orderNo,
            });
            return NextResponse.json(
                { success: false, error: 'Tenant ID and order number are required' },
                { status: 400 },
            );
        }

        const supabase = await createAdminSupabaseClient();
        logger.info('Executing public order detail query', {
            ...requestContext,
            table: 'org_orders_mst',
        });

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
                ...requestContext,
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

        logger.info('Public order detail base query succeeded', {
            ...requestContext,
            orderId: order.id,
        });

        // Fetch status history for timeline using existing service
        logger.info('Fetching public order timeline history', {
            ...requestContext,
            orderId: order.id,
        });
        const history = await OrderService.getOrderHistory(order.id, tenantId);
        logger.info('Public order timeline history fetched', {
            ...requestContext,
            orderId: order.id,
            historyCount: history.length,
        });

        const tenantSettings = createTenantSettingsService(supabase);
        logger.info('Fetching tenant money config for public order detail', requestContext);
        const moneyConfig = await tenantSettings.getCurrencyConfig(tenantId);
        logger.info('Tenant money config fetched for public order detail', {
            ...requestContext,
            currencyCode: moneyConfig.currencyCode,
            decimalPlaces: moneyConfig.decimalPlaces,
        });

        const durationMs = Date.now() - startedAt;
        logger.info('Public order tracking success', {
            ...requestContext,
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
            moneyConfig: {
                currencyCode: moneyConfig.currencyCode,
                decimalPlaces: moneyConfig.decimalPlaces,
            },
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
        const normalizedError =
            error instanceof Error ? error : new Error(String(error));
        logger.error('Public order tracking failed', normalizedError, {
            ...baseContext,
            durationMs,
        });

        return NextResponse.json(
            {
                success: false,
                error: normalizedError.message,
            },
            { status: 500 },
        );
    }
}


