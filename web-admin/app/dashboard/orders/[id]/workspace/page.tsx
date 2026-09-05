import { Suspense } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { getOrderByRef } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  isUuidLike,
  sanitizeOrderDetailsReturnUrl,
} from '@/lib/orders/order-details-navigation';
import { OrderWorkspaceScreen } from '@features/orders/orderdtlworkspace/ui/order-workspace-screen';
import { getOrderWorkspaceWorkflowJourney } from '@features/orders/orderdtlworkspace/ui/order-workspace-workflow-journey.server';
import type { OrderWorkspaceSectionId } from '@features/orders/orderdtlworkspace/ui/order-workspace-types';
import { OrderDetailError } from '../order-detail-error';

interface OrderWorkspacePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tenantOrgId?: string;
    returnUrl?: string;
    returnLabel?: string;
    section?: string;
  }>;
}

function normalizeSection(value?: string): OrderWorkspaceSectionId {
  return ['overview', 'work', 'customer', 'financials', 'activity', 'actions'].includes(value ?? '')
    ? (value as OrderWorkspaceSectionId)
    : 'overview';
}

async function OrderWorkspaceContent({
  orderId,
  searchParams,
}: {
  orderId: string;
  searchParams: Awaited<OrderWorkspacePageProps['searchParams']>;
}) {
  const { tenantId, userId } = await getAuthContext();
  const t = await getTranslations('orders.detail');
  const safeReturnUrl = sanitizeOrderDetailsReturnUrl(searchParams.returnUrl);
  const requestedTenantOrgId = searchParams.tenantOrgId?.trim();

  const errorProps = {
    orderId,
    backToOrders: t('backToOrders'),
    returnUrl: safeReturnUrl,
    returnLabel: searchParams.returnLabel,
  };

  if (!orderId.trim() || (requestedTenantOrgId && requestedTenantOrgId !== tenantId)) {
    return (
      <OrderDetailError
        {...errorProps}
        title={t('errorOrderNotFound')}
        description={t('errorOrderNotFoundDesc')}
        debug={{
          condition: !orderId.trim()
            ? 'Invalid order reference (empty identifier)'
            : 'Requested tenant_org_id does not match authenticated tenant',
          tenantId,
          userId,
        }}
      />
    );
  }

  const result = await getOrderByRef(tenantId, orderId);
  if (!result.success || !result.data) {
    return (
      <OrderDetailError
        {...errorProps}
        title={t('errorOrderNotFound')}
        description={t('errorOrderNotFoundDesc')}
        debug={{
          condition: isUuidLike(orderId)
            ? 'getOrderByRef returned no data for UUID reference'
            : 'getOrderByRef returned no data for order_no reference',
          serverError: result.error,
          tenantId,
          userId,
        }}
      />
    );
  }

  // The workspace is a client-interactive surface; normalize Date/Decimal
  // values at the server boundary so the App Router receives serializable data.
  const serializedOrder = JSON.parse(JSON.stringify(result.data)) as typeof result.data;

  const locale = await getLocale();
  const workflowJourney = await getOrderWorkspaceWorkflowJourney(
    tenantId,
    String(result.data.id),
    locale,
  );

  return (
    <OrderWorkspaceScreen
      order={serializedOrder as unknown as Record<string, unknown>}
      tenantOrgId={tenantId}
      userId={userId ?? ''}
      locale={locale}
      returnUrl={safeReturnUrl}
      returnLabel={searchParams.returnLabel}
      initialSection={normalizeSection(searchParams.section)}
      workflowJourney={workflowJourney}
    />
  );
}

export default async function OrderWorkspacePage({
  params,
  searchParams,
}: OrderWorkspacePageProps) {
  const { id } = await params;
  const search = await searchParams;

  return (
    <Suspense fallback={<div className="min-h-96" aria-busy="true" />}>
      <OrderWorkspaceContent orderId={id} searchParams={search} />
    </Suspense>
  );
}
