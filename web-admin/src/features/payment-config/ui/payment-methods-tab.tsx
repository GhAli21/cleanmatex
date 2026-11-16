'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Settings, CreditCard, Plus } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxSwitch } from '@ui/primitives';

import { CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { cmxMessage, CmxStatusBadge } from '@ui/feedback';
import type { OrgPaymentMethodConfig } from '@/lib/types/payment';
import {
  togglePaymentMethodEnabled,
  softDeletePaymentMethodConfig,
} from '@/app/actions/payment-config/payment-methods-actions';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import { EnablePaymentMethodDialog } from './enable-payment-method-dialog';
import { PaymentMethodConfigDialog } from './payment-method-config-dialog';
import { CmxConfirmDialog } from '@ui/feedback';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';

interface PaymentMethodsTabProps {
  methods: OrgPaymentMethodConfig[];
  isLoading?: boolean;
  onRefresh: () => void;
}

/**
 *
 * @param root0
 * @param root0.methods
 * @param root0.isLoading
 * @param root0.onRefresh
 */
export function PaymentMethodsTab({ methods, isLoading, onRefresh }: PaymentMethodsTabProps) {
  const t = useTranslations('paymentConfig');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [configTarget, setConfigTarget] = useState<OrgPaymentMethodConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgPaymentMethodConfig | null>(null);
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});
  const { currencyCode: tenantCurrencyCode, decimalPlaces } = useTenantCurrency();

  const moneyLocale = locale === 'ar' ? 'ar' : 'en';

  const getEnabled = (m: OrgPaymentMethodConfig) =>
    localEnabled[m.id] !== undefined ? localEnabled[m.id] : m.is_enabled;

  const formatAmount = (amount: number | null) =>
    amount == null
      ? '—'
      : formatMoneyAmountWithCode(amount, {
          currencyCode: tenantCurrencyCode,
          decimalPlaces,
          locale: moneyLocale,
        });

  const CopyValue = ({
    value,
    maxLength,
  }: {
    value: string | number | null | undefined;
    maxLength?: number;
  }) => (
    <CmxCopyableCell
      as="span"
      value={value}
      maxLength={maxLength}
      align="left"
      className="px-0 py-0 text-sm text-foreground"
    />
  );

  const handleToggle = (method: OrgPaymentMethodConfig, val: boolean) => {
    setLocalEnabled((prev) => ({ ...prev, [method.id]: val }));
    startTransition(async () => {
      const result = await togglePaymentMethodEnabled(method.id, val);
      if (!result.success) {
        setLocalEnabled((prev) => ({ ...prev, [method.id]: !val }));
        cmxMessage.error(result.error ?? t('methods.toggleError'));
      }
    });
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    const result = await softDeletePaymentMethodConfig(deleteTarget.id);
    if (result.success) {
      cmxMessage.success(t('methods.deactivated'));
      onRefresh();
    } else {
      cmxMessage.error(result.error ?? t('common.error'));
    }
    setDeleteTarget(null);
  };

  if (isLoading) return <CmxSkeletonTable rows={4} columns={5} showHeader />;

  if (!methods.length) {
    return (
      <>
        <div className="mb-4 flex justify-end">
          <CmxButton onClick={() => setShowEnableDialog(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t('methods.enable')}
          </CmxButton>
        </div>
        <CmxEmptyState
          icon={<CreditCard className="h-8 w-8" />}
          title={t('methods.empty.title')}
          description={t('methods.empty.description')}
        />
        <EnablePaymentMethodDialog
          open={showEnableDialog}
          onClose={() => setShowEnableDialog(false)}
          onSuccess={() => { setShowEnableDialog(false); onRefresh(); }}
        />
      </>
    );
  }

  const columns = [
    {
      key: 'payment_method_code',
      header: t('methods.code'),
      render: (m: OrgPaymentMethodConfig) => (
        <CopyValue value={m.payment_method_code} />
      ),
    },
    {
      key: 'display_name',
      header: t('methods.name'),
      render: (m: OrgPaymentMethodConfig) => (
        <div>
          <div className="font-medium">{m.display_name}</div>
          {m.display_name2 && <div className="text-xs text-muted-foreground">{m.display_name2}</div>}
        </div>
      ),
    },
    {
      key: 'payment_nature',
      header: t('methods.paymentNature'),
      render: (m: OrgPaymentMethodConfig) => (
        <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t(`methods.nature.${m.payment_nature}` as never)}</CmxStatusBadge>
      ),
    },
    {
      key: 'routing',
      header: t('methods.routing'),
      render: (m: OrgPaymentMethodConfig) => (
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t('methods.gatewayCode')}</span>
            {m.gateway_code ? <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{m.gateway_code}</CmxStatusBadge> : <span className="text-muted-foreground">—</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t('methods.currencyCode')}</span>
            <CmxStatusBadge size="sm" tone="neutral">{m.currency_code ?? tenantCurrencyCode}</CmxStatusBadge>
          </div>
        </div>
      ),
    },
    {
      key: 'channels',
      header: t('methods.channels.label'),
      render: (m: OrgPaymentMethodConfig) => (
        <div className="flex gap-1 flex-wrap">
          {m.allowed_in_pos && <CmxStatusBadge size="sm" tone="neutral">{t('methods.channels.pos')}</CmxStatusBadge>}
          {m.allowed_in_customer_app && <CmxStatusBadge size="sm" tone="neutral">{t('methods.channels.app')}</CmxStatusBadge>}
          {m.allowed_in_staff_app && <CmxStatusBadge size="sm" tone="neutral">{t('methods.channels.staff')}</CmxStatusBadge>}
          {m.allowed_in_admin_app && <CmxStatusBadge size="sm" tone="neutral">{t('methods.channels.admin')}</CmxStatusBadge>}
        </div>
      ),
    },
    {
      key: 'purposesAndRequirements',
      header: t('methods.purposesAndRequirements'),
      render: (m: OrgPaymentMethodConfig) => (
        <div className="flex max-w-md flex-wrap gap-1">
          {m.allowed_for_pay_now && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t('methods.purposes.payNow')}</CmxStatusBadge>}
          {m.allowed_for_pay_on_collection && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t('methods.purposes.payOnCollection')}</CmxStatusBadge>}
          {m.allowed_for_invoice_payment && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t('methods.purposes.invoicePayment')}</CmxStatusBadge>}
          {m.allowed_for_refund && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{t('methods.purposes.refund')}</CmxStatusBadge>}
          {m.requires_reference && <CmxStatusBadge size="sm" tone="neutral">{t('methods.requiresReference')}</CmxStatusBadge>}
          {m.requires_cash_drawer && <CmxStatusBadge size="sm" tone="neutral">{t('methods.requiresCashDrawer')}</CmxStatusBadge>}
          {m.requires_terminal && <CmxStatusBadge size="sm" tone="neutral">{t('methods.requiresTerminal')}</CmxStatusBadge>}
        </div>
      ),
    },
    {
      key: 'limits',
      header: t('methods.limits'),
      render: (m: OrgPaymentMethodConfig) => (
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">{t('methods.minAmount')}</span>{' '}
            <span className="font-medium">{formatAmount(m.min_amount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('methods.maxAmount')}</span>{' '}
            <span className="font-medium">{formatAmount(m.max_amount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('methods.feeType')}</span>{' '}
            <span className="font-medium">{t(`methods.feeTypes.${m.fee_type}` as never)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'is_enabled',
      header: t('methods.enabled'),
      render: (m: OrgPaymentMethodConfig) => (
        <CmxSwitch
          checked={getEnabled(m)}
          onCheckedChange={(val) => handleToggle(m, val)}
          disabled={isPending}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (m: OrgPaymentMethodConfig) => (
        <div className="flex gap-2 justify-end">
          <CmxButton variant="outline" size="sm" onClick={() => setConfigTarget(m)}>
            <Settings className="h-3.5 w-3.5 me-1" />
            {t('methods.configure')}
          </CmxButton>
          <CmxButton variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(m)}>
            {t('common.deactivate')}
          </CmxButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <CmxButton onClick={() => setShowEnableDialog(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t('methods.enable')}
        </CmxButton>
      </div>

      <CmxDataTable columns={columns} data={methods} />

      <EnablePaymentMethodDialog
        open={showEnableDialog}
        onClose={() => setShowEnableDialog(false)}
        onSuccess={() => { setShowEnableDialog(false); onRefresh(); }}
      />

      {configTarget && (
        <PaymentMethodConfigDialog
          method={configTarget}
          open={!!configTarget}
          onClose={() => setConfigTarget(null)}
          onSuccess={() => { setConfigTarget(null); onRefresh(); }}
        />
      )}

      <CmxConfirmDialog
        open={!!deleteTarget}
        title={t('methods.deactivateConfirm.title')}
        description={t('methods.deactivateConfirm.description')}
        confirmLabel={t('common.deactivate')}
        onConfirm={handleDeactivate}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
