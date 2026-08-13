import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createAdminSupabaseClient, createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { readCanonicalOrderFinancialSnapshot } from '@/lib/utils/order-financial-snapshot';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';
import { OrderService } from '@/lib/services/order-service';
import type { OrderStatus } from '@/lib/types/workflow';
import {
  WorkflowEngineError,
  executeAction,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { WORKFLOW_SYSTEM_ACTOR } from '@/lib/constants/workflow-system-actor';
import {
  buildLegacyPublicTrackingPath,
  buildPublicTrackingPath,
  normalizePublicTrackingToken,
} from '@/lib/utils/public-order-tracking';

const PUBLIC_TRACKING_SCREEN = 'public_tracking';

interface PublicOrderReference {
  tenantId: string;
  orderNo: string;
}

interface PublicTrackingTokenRow {
  id: string;
  tenant_org_id: string;
  order_no: string;
  public_tracking_token: string | null;
}

interface PublicOrderCustomerRow {
  name: string | null;
  name2: string | null;
  phone: string | null;
  email: string | null;
}

interface PublicOrderProductRow {
  id: string;
  product_name: string | null;
  product_name2: string | null;
  product_code: string | null;
}

interface PublicOrderItemRow {
  id: string;
  quantity: number | string | null;
  total_price: number | string | null;
  product_name?: string | null;
  product_name2?: string | null;
  org_product_data_mst?: PublicOrderProductRow | null;
}

interface PublicOrderQueryRow {
  id: string;
  order_no: string;
  current_status: string | null;
  status: string | null;
  received_at: string | null;
  ready_by: string | null;
  ready_by_at_new: string | null;
  subtotal_amount: number | string | null;
  total_amount: number | string | null;
  payment_status: string | null;
  payment_type_code: string | null;
  total_paid_amount: number | string | null;
  outstanding_amount: number | string | null;
  pay_on_collection_amount: number | string | null;
  priority: string | null;
  customer_notes: string | null;
  branch_id: string | null;
  bag_count: number | string | null;
  rack_location: string | null;
  org_customers_mst?: PublicOrderCustomerRow | null;
  org_order_items_dtl?: PublicOrderItemRow[] | null;
}

interface PublicOrderHistoryRow {
  id: string;
  action_type: string;
  from_value: string | null;
  to_value: string | null;
  done_at: string;
}

interface PublicConfirmLookupRow {
  id: string;
  status: string | null;
  current_status: string | null;
  state_version: number | bigint | null;
}

interface PublicApiResult {
  status: number;
  body: Record<string, unknown>;
}

interface PublicTrackingResolution extends PublicOrderReference {
  orderId: string;
  token: string;
}

function isMissingTrackingTokenColumnError(error: unknown): boolean {
  return error instanceof Error
    && error.message.toLowerCase().includes('public_tracking_token');
}

async function queryPublicTrackingRows(
  sql: Prisma.Sql,
  logContext: Record<string, unknown>,
): Promise<PublicTrackingTokenRow[]> {
  try {
    return await prisma.$queryRaw<PublicTrackingTokenRow[]>(sql);
  } catch (error) {
    if (isMissingTrackingTokenColumnError(error)) {
      logger.warn('Public tracking token columns are not available yet', logContext);
      return [];
    }

    throw error;
  }
}

/**
 * Resolve an opaque public tracking token into the underlying tenant/order
 * reference. Returns null for invalid or missing tokens.
 *
 * @param token Opaque public tracking token from the URL.
 * @returns Resolved reference or null.
 */
export async function resolvePublicTrackingReferenceByToken(
  token: string,
): Promise<PublicTrackingResolution | null> {
  const normalizedToken = normalizePublicTrackingToken(token);
  if (!normalizedToken) {
    return null;
  }

  const rows = await queryPublicTrackingRows(
    Prisma.sql`
      SELECT
        id::text AS id,
        tenant_org_id::text AS tenant_org_id,
        order_no,
        public_tracking_token
      FROM public.org_orders_mst
      WHERE public_tracking_token = ${normalizedToken}
        AND public_tracking_token_revoked_at IS NULL
        AND (
          public_tracking_token_expires_at IS NULL
          OR public_tracking_token_expires_at > CURRENT_TIMESTAMP
        )
      LIMIT 1
    `,
    {
      feature: 'public_order_tracking',
      action: 'resolve_token',
      token: normalizedToken,
    },
  );

  const row = rows[0];
  if (!row || !row.public_tracking_token) {
    return null;
  }

  return {
    orderId: row.id,
    tenantId: row.tenant_org_id,
    orderNo: row.order_no,
    token: row.public_tracking_token,
  };
}

/**
 * Resolve the active public tracking token for a readable tenant/order
 * reference. Returns null when the rollout migration is not yet present.
 *
 * @param reference Tenant/order reference.
 * @returns Active token or null.
 */
export async function resolvePublicTrackingTokenByOrderRef(
  reference: PublicOrderReference,
): Promise<string | null> {
  const rows = await queryPublicTrackingRows(
    Prisma.sql`
      SELECT
        id::text AS id,
        tenant_org_id::text AS tenant_org_id,
        order_no,
        public_tracking_token
      FROM public.org_orders_mst
      WHERE tenant_org_id = CAST(${reference.tenantId} AS uuid)
        AND order_no = ${reference.orderNo}
        AND public_tracking_token IS NOT NULL
        AND btrim(public_tracking_token) <> ''
        AND public_tracking_token_revoked_at IS NULL
        AND (
          public_tracking_token_expires_at IS NULL
          OR public_tracking_token_expires_at > CURRENT_TIMESTAMP
        )
      LIMIT 1
    `,
    {
      feature: 'public_order_tracking',
      action: 'resolve_token_by_order_ref',
      tenantId: reference.tenantId,
      orderNo: reference.orderNo,
    },
  );

  return rows[0]?.public_tracking_token ?? null;
}

/**
 * Resolve the preferred public tracking path for a dashboard order detail
 * screen. Falls back to the legacy readable path while the token migration is
 * still rolling out.
 *
 * @param input Tenant/order identity and optional fallback order number.
 * @returns Preferred public path or null.
 */
export async function getPublicTrackingPathForOrderId(input: {
  tenantId: string;
  orderId: string;
  fallbackOrderNo?: string | null;
}): Promise<string | null> {
  const { tenantId, orderId, fallbackOrderNo } = input;

  const rows = await queryPublicTrackingRows(
    Prisma.sql`
      SELECT
        id::text AS id,
        tenant_org_id::text AS tenant_org_id,
        order_no,
        public_tracking_token
      FROM public.org_orders_mst
      WHERE tenant_org_id = CAST(${tenantId} AS uuid)
        AND id = CAST(${orderId} AS uuid)
        AND public_tracking_token IS NOT NULL
        AND btrim(public_tracking_token) <> ''
        AND public_tracking_token_revoked_at IS NULL
        AND (
          public_tracking_token_expires_at IS NULL
          OR public_tracking_token_expires_at > CURRENT_TIMESTAMP
        )
      LIMIT 1
    `,
    {
      feature: 'public_order_tracking',
      action: 'get_path_by_order_id',
      tenantId,
      orderId,
    },
  );

  const token = rows[0]?.public_tracking_token;
  if (token) {
    return buildPublicTrackingPath(token);
  }

  if (fallbackOrderNo) {
    return buildLegacyPublicTrackingPath(tenantId, fallbackOrderNo);
  }

  return null;
}

/**
 * Shared public order detail response for both legacy and token routes.
 *
 * @param request Incoming request for logging context.
 * @param reference Tenant/order reference.
 * @returns HTTP-style status/body pair.
 */
export async function getPublicOrderTrackingResponse(
  request: NextRequest,
  reference: PublicOrderReference,
): Promise<PublicApiResult> {
  const startedAt = Date.now();
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'public_orders_detail_api',
    action: 'get_public_order_detail',
  });

  try {
    logger.info('Public order detail request received', baseContext);
    const { tenantId, orderNo } = reference;
    const requestContext = {
      ...baseContext,
      tenantId,
      orderNo,
      hasTenantId: tenantId.trim().length > 0,
      hasOrderNo: orderNo.trim().length > 0,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    if (!tenantId || !orderNo) {
      logger.warn('Public order detail request rejected due to missing route params', {
        ...requestContext,
        missingTenantId: !tenantId,
        missingOrderNo: !orderNo,
      });
      return {
        status: 400,
        body: { success: false, error: 'Tenant ID and order number are required' },
      };
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
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
          subtotal_amount,
          total_amount,
          payment_status,
          payment_type_code,
          total_paid_amount,
          outstanding_amount,
          pay_on_collection_amount,
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

    const order = data as PublicOrderQueryRow | null;

    if (error || !order) {
      logger.warn('Public order not found', {
        ...requestContext,
        error: error?.message,
      });

      return {
        status: 404,
        body: {
          success: false,
          error: 'Order not found',
        },
      };
    }

    const history = await OrderService.getOrderHistory(order.id, tenantId) as PublicOrderHistoryRow[];
    const tenantSettings = createTenantSettingsService(supabase);
    const moneyConfig = await tenantSettings.getCurrencyConfig(tenantId);
    const financialSnapshot = readCanonicalOrderFinancialSnapshot(order as unknown as Record<string, unknown>);

    logger.info('Public order tracking success', {
      ...requestContext,
      orderId: order.id,
      orderNo: order.order_no,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: 200,
      body: {
        success: true,
        data: {
          order: {
            id: order.id,
            orderNo: order.order_no,
            status: order.current_status || order.status,
            paymentTypeCode: order.payment_type_code,
            priority: order.priority,
            receivedAt: order.received_at,
            readyBy: order.ready_by_at_new || order.ready_by || null,
            totals: {
              subtotal: financialSnapshot.subtotalAmount,
              total: financialSnapshot.totalAmount,
              paidAmount: financialSnapshot.totalPaidAmount,
              paymentStatus: order.payment_status,
              outstandingAmount: financialSnapshot.outstandingAmount,
              payOnCollectionAmount: financialSnapshot.payOnCollectionAmount,
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
            items: (order.org_order_items_dtl || []).map((item) => ({
              id: item.id,
              name: item.org_product_data_mst?.product_name || item.product_name || null,
              name2: item.org_product_data_mst?.product_name2 || item.product_name2 || null,
              quantity: item.quantity ? Number(item.quantity) : 0,
              totalPrice: item.total_price ? Number(item.total_price) : 0,
            })),
            customerNotes: order.customer_notes,
          },
          timeline: history.map((entry) => ({
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
        },
      },
    };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    logger.error('Public order tracking failed', normalizedError, {
      ...baseContext,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: normalizedError.message,
      },
    };
  }
}

/**
 * Shared public confirm-received response for both legacy and token routes.
 *
 * @param request Incoming request for logging/audit context.
 * @param reference Tenant/order reference.
 * @returns HTTP-style status/body pair.
 */
export async function confirmPublicOrderReceivedResponse(
  request: NextRequest,
  reference: PublicOrderReference,
): Promise<PublicApiResult> {
  const startedAt = Date.now();
  const { tenantId, orderNo } = reference;

  try {
    if (!tenantId || !orderNo) {
      return {
        status: 400,
        body: { success: false, error: 'Tenant ID and order number are required' },
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('org_orders_mst')
      .select('id, status, current_status, state_version')
      .eq('tenant_org_id', tenantId)
      .eq('order_no', orderNo)
      .single();

    const order = data as PublicConfirmLookupRow | null;

    if (error || !order) {
      logger.warn('Public confirm-received order not found', {
        feature: 'public_orders',
        action: 'confirm_received',
        orderNo,
        tenantId,
        error: error?.message,
      });

      return {
        status: 404,
        body: { success: false, error: 'Order not found' },
      };
    }

    const fromStatus = String(order.current_status || order.status || '')
      .trim()
      .toLowerCase() as OrderStatus;

    const allowedFromStatuses: OrderStatus[] = ['ready', 'out_for_delivery', 'delivered'];
    if (!allowedFromStatuses.includes(fromStatus)) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Order cannot be confirmed received in the current state',
        },
      };
    }

    const toStatus: OrderStatus = 'delivered';
    if (fromStatus === 'delivered') {
      return {
        status: 200,
        body: {
          success: true,
          data: { orderId: order.id, status: 'delivered', idempotent: true },
        },
      };
    }

    const notes = 'Customer confirmed receipt via public tracking link';
    const metadata = {
      source: 'public_tracking',
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    };

    try {
      const available = await listAvailableActions({
        tenantId,
        orderId: order.id,
        screen: PUBLIC_TRACKING_SCREEN,
      });
      const result = await executeAction({
        tenantId,
        orderId: order.id,
        screen: PUBLIC_TRACKING_SCREEN,
        actionCode: WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
        expectedStateVersion: available.stateVersion,
        actorUserId: WORKFLOW_SYSTEM_ACTOR.userId,
        actorName: WORKFLOW_SYSTEM_ACTOR.displayName,
        input: {
          notes,
          preferredToStatus: toStatus,
          metadata,
        },
        idempotencyKey:
          request.headers.get('Idempotency-Key')?.trim() ||
          `public-confirm-received:${tenantId}:${order.id}`,
      });

      logger.info('Public confirm-received success (engine)', {
        feature: 'public_orders',
        action: 'confirm_received',
        tenantId,
        orderId: order.id,
        orderNo,
        engine: 'workflow_v2',
        durationMs: Date.now() - startedAt,
      });

      return {
        status: 200,
        body: {
          success: true,
          data: {
            orderId: order.id,
            orderNo,
            status: result.currentStatus || toStatus,
            stateVersion: result.stateVersion,
            engine: 'workflow_v2',
          },
        },
      };
    } catch (engineError) {
      const message =
        engineError instanceof WorkflowEngineError
          ? engineError.message
          : engineError instanceof Error
            ? engineError.message
            : 'Unable to confirm order as received';
      logger.warn('Public confirm-received engine blocked', {
        feature: 'public_orders',
        action: 'confirm_received',
        tenantId,
        orderId: order.id,
        orderNo,
        error: message,
      });
      return {
        status:
          engineError instanceof WorkflowEngineError && engineError.code === 'VERSION_CONFLICT'
            ? 409
            : 400,
        body: {
          success: false,
          error: message,
          code: engineError instanceof WorkflowEngineError ? engineError.code : undefined,
          blockedReasons:
            engineError instanceof WorkflowEngineError ? engineError.blockedReasons : undefined,
        },
      };
    }
  } catch (error) {
    logger.error('Public confirm-received failed', error as Error, {
      feature: 'public_orders',
      action: 'confirm_received',
      tenantId,
      orderNo,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
    };
  }
}
