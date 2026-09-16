import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  getBizVoucherDetailAction,
  getVoucherLinkedEffectsAction,
} from '@/app/actions/finance/voucher-actions';
import { VoucherDetailClient } from './voucher-detail-client';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import { canAccess } from '@/lib/services/feature-flags.service';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { FEATURE_INTERNAL_FIN_VOUCHERS_ACCESS } from '@features/finance/vouchers/access/vouchers-access'

interface PageProps {
  params: Promise<{ voucherId: string }>;
}

/**
 *
 * @param root0
 * @param root0.params
 */
export default async function VoucherDetailPage({ params }: PageProps) {
  const { voucherId } = await params;
  const t = await getTranslations('finance.vouchers');
  const tCommon = await getTranslations('common');

  const auth = await getAuthContext();
  const canView = await hasPermissionServer('fin_vouchers:view');
  if (!canView) {
    return (
    <RequireAnyPermission permissions={FEATURE_INTERNAL_FIN_VOUCHERS_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    </RequireAnyPermission>
  );
  }

  const result = await getBizVoucherDetailAction(voucherId);
  if (!result.success || !result.data) {
    const msg = result.error ?? '';
    // Only show 404 for genuine "not found" — surface all other errors
    if (msg.toLowerCase().includes('not found') || msg === '') {
      notFound();
    }
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {msg}
        </div>
      </div>
    );
  }

  const voucher = result.data;
  const relatedOrderId = voucher.related?.order?.id ?? voucher.order_id ?? null;

  // Voucher.outstanding_amount is unallocated-on-this-voucher, not order due.
  // When the voucher is linked, surface the B02 order outstanding separately.
  let orderOutstandingAmount: number | null = null;
  if (relatedOrderId) {
    const order = await withTenantContext(auth.tenantId, () =>
      prisma.org_orders_mst.findFirst({
        where: { id: relatedOrderId, tenant_org_id: auth.tenantId },
        select: { outstanding_amount: true },
      }),
    );
    if (order) {
      orderOutstandingAmount = Number(order.outstanding_amount ?? 0);
    }
  }

  const postedLike = voucher.voucher_status === VOUCHER_STATUS.POSTED
    || voucher.voucher_status === VOUCHER_STATUS.REVERSED
    || voucher.voucher_status === VOUCHER_STATUS.PARTIALLY_REVERSED;
  const linkedEffectsResult = postedLike
    ? await getVoucherLinkedEffectsAction(voucherId)
    : null;
  const unwindEnabled = await canAccess(auth.tenantId, 'order_fin_voucher_unwind');

  return (
    <div className="space-y-6 overflow-x-hidden p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/internal_fin/vouchers"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('backToVouchers')}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{voucher.voucher_no}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('voucherDetail')}</p>
        </div>
      </div>

      <VoucherDetailClient
        voucher={voucher}
        userRole={auth.userRole}
        linkedEffects={linkedEffectsResult?.data ?? null}
        orderOutstandingAmount={orderOutstandingAmount}
        unwindEnabled={unwindEnabled}
      />
    </div>
  );
}
