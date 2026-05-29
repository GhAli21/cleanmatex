'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  CmxCard,
  CmxCardHeader,
  CmxCardTitle,
  CmxCardContent,
} from '@ui/primitives/cmx-card';
import type { LinkedEffectsResult } from '@/lib/types/voucher-wiring';
import type { CmxDataTableSimpleColumn } from '@ui/data-display';
import { VoucherDetailCopyValue, VoucherDetailDataTable } from './voucher-detail-data-table';

interface VoucherLinkedEffectsPanelProps {
  effects: LinkedEffectsResult;
}

function formatAmount(amount: { toString(): string }, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(amount));
}

export function VoucherLinkedEffectsPanel({ effects }: VoucherLinkedEffectsPanelProps) {
  const t = useTranslations('finance.vouchers.linkedEffects');
  const locale = useLocale();
  const textAlign = locale === 'ar' ? 'right' : 'left';

  const hasAny =
    effects.orderPayments.length > 0 ||
    effects.cashDrawerMovements.length > 0 ||
    effects.creditApplications.length > 0;

  if (!hasAny) {
    return (
      <CmxCard>
        <CmxCardContent className="py-6 text-center text-sm text-muted-foreground">
          {t('noEffects')}
        </CmxCardContent>
      </CmxCard>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {effects.orderPayments.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="text-base">{t('orderPayments')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="p-0">
            <VoucherDetailDataTable
              columns={[
                { key: 'id', header: t('effectId'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
                { key: 'order_id', header: t('orderRef'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.order_id} maxLength={12} align={textAlign} /> },
                { key: 'amount', header: t('amountLabel'), sortable: false, align: 'right', render: (row) => <VoucherDetailCopyValue value={Number(row.amount)} displayValue={formatAmount(row.amount, locale)} align="right" className="font-medium" /> },
                { key: 'payment_method_code', header: t('methodOrType'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.payment_method_code} align={textAlign} /> },
                { key: 'line_id', header: t('lineId'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.line_id} maxLength={12} align={textAlign} /> },
                { key: 'payment_status', header: t('paymentStatus'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.payment_status} align={textAlign} /> },
              ] satisfies CmxDataTableSimpleColumn<LinkedEffectsResult['orderPayments'][number]>[]}
              data={effects.orderPayments}
              emptyStateTitle={t('noEffects')}
            />
          </CmxCardContent>
        </CmxCard>
      )}

      {effects.cashDrawerMovements.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="text-base">{t('cashMovements')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="p-0">
            <VoucherDetailDataTable
              columns={[
                { key: 'id', header: t('effectId'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
                { key: 'session_id', header: t('sessionId'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.session_id} maxLength={12} align={textAlign} /> },
                { key: 'amount', header: t('amountLabel'), sortable: false, align: 'right', render: (row) => <VoucherDetailCopyValue value={Number(row.amount)} displayValue={formatAmount(row.amount, locale)} align="right" className="font-medium" /> },
                { key: 'movement_type', header: t('movementType'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.movement_type} align={textAlign} /> },
                { key: 'line_id', header: t('lineId'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.line_id} maxLength={12} align={textAlign} /> },
              ] satisfies CmxDataTableSimpleColumn<LinkedEffectsResult['cashDrawerMovements'][number]>[]}
              data={effects.cashDrawerMovements}
              emptyStateTitle={t('noEffects')}
            />
          </CmxCardContent>
        </CmxCard>
      )}

      {effects.creditApplications.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="text-base">{t('creditApplications')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="p-0">
            <VoucherDetailDataTable
              columns={[
                { key: 'id', header: t('effectId'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
                { key: 'order_id', header: t('orderRef'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.order_id} maxLength={12} align={textAlign} /> },
                { key: 'amount', header: t('amountLabel'), sortable: false, align: 'right', render: (row) => <VoucherDetailCopyValue value={Number(row.amount)} displayValue={formatAmount(row.amount, locale)} align="right" className="font-medium" /> },
                { key: 'credit_type', header: t('methodOrType'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.credit_type} align={textAlign} /> },
                { key: 'line_id', header: t('lineId'), sortable: false, render: (row) => <VoucherDetailCopyValue value={row.line_id} maxLength={12} align={textAlign} /> },
              ] satisfies CmxDataTableSimpleColumn<LinkedEffectsResult['creditApplications'][number]>[]}
              data={effects.creditApplications}
              emptyStateTitle={t('noEffects')}
            />
          </CmxCardContent>
        </CmxCard>
      )}
    </div>
  );
}
