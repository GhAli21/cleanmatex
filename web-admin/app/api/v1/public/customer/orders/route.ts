import { NextRequest, NextResponse } from 'next/server';

import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim();
}

/**
 * Returns customer-visible order summaries for an authorized mobile session.
 *
 * @param request Incoming HTTP request with tenantId query and Bearer token.
 * @returns JSON response containing order summaries or a structured error.
 */
export async function GET(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_orders_public_api',
    action: 'get_orders',
  });

  try {
    logger.info('Customer orders request received', baseContext);
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const verificationToken = extractBearerToken(request);
    const requestContext = {
      ...baseContext,
      tenantId,
      hasVerificationToken: Boolean(verificationToken),
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    logger.info('Customer orders request parameters parsed', requestContext);

    if (!tenantId || !verificationToken) {
      logger.warn('Customer orders request rejected due to missing auth inputs', {
        ...requestContext,
        missingTenantId: !tenantId,
        missingVerificationToken: !verificationToken,
      });
      return NextResponse.json(
        { success: false, error: 'tenantId and bearer token are required' },
        { status: 400 },
      );
    }

    logger.info('Resolving customer mobile session for orders request', requestContext);
    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken,
    });

    if (!session) {
      logger.warn('Customer orders request unauthorized: session not resolved', {
        ...requestContext,
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session' },
        { status: 401 },
      );
    }

    logger.info('Customer mobile session resolved for orders request', {
      ...requestContext,
      customerId: session.customerId,
      sessionTenantOrgId: session.tenantOrgId,
      normalizedPhone: session.phoneNumber,
    });

    const supabase = await createAdminSupabaseClient();
    const tenantSettings = createTenantSettingsService(supabase);
    const moneyConfig = await tenantSettings.getCurrencyConfig(tenantId);

    logger.info('Executing customer orders query', {
      ...requestContext,
      table: 'org_orders_mst',
      queryLimit: 25,
      phoneFilter: session.phoneNumber,
    });

    const { data: orders, error } = await supabase
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
        total_items,
        bag_count,
        total,
        payment_status,
        order_source_code,
        physical_intake_status,
        physical_intake_at,
        physical_intake_info,
        received_info,
        created_at,
        sys_order_sources_cd(
          order_source_code,
          name,
          name2,
          requires_remote_intake_confirm
        ),
        org_customers_mst!inner(phone)
      `,
      )
      .eq('tenant_org_id', tenantId)
      .eq('org_customers_mst.phone', session.phoneNumber)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      logger.error('Customer orders query failed', error, {
        ...requestContext,
        tenantId,
      });
      throw error;
    }

    logger.info('Customer orders query succeeded', {
      ...requestContext,
      tenantId,
      ordersCount: orders?.length ?? 0,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          currencyCode: moneyConfig.currencyCode,
          orders: (orders ?? []).map((order: any) => ({
            id: order.id,
            orderNo: order.order_no,
            status: order.current_status || order.status,
            receivedAt: order.received_at,
            readyBy: order.ready_by_at_new || order.ready_by || null,
            totalItems: order.total_items ? Number(order.total_items) : null,
            bagCount: order.bag_count ? Number(order.bag_count) : null,
            total: order.total ? Number(order.total) : null,
            paymentStatus: order.payment_status ?? null,
            currencyCode: moneyConfig.currencyCode,
            orderSourceCode: order.order_source_code ?? null,
            physicalIntakeStatus: order.physical_intake_status ?? null,
            physicalIntakeAt: order.physical_intake_at ?? null,
            physicalIntakeInfo: order.physical_intake_info ?? null,
            receivedInfo: order.received_info ?? null,
            createdAt: order.created_at ?? null,
            orderSource: order.sys_order_sources_cd
              ? {
                  code: order.sys_order_sources_cd.order_source_code,
                  name: order.sys_order_sources_cd.name,
                  name2: order.sys_order_sources_cd.name2,
                  requiresRemoteIntakeConfirm:
                    order.sys_order_sources_cd.requires_remote_intake_confirm,
                }
              : null,
          })),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    logger.error('Customer orders request failed with unhandled exception', normalizedError, {
      ...baseContext,
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
