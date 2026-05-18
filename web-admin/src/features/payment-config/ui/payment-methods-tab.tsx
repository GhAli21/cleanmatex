'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, CreditCard, Plus } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxSwitch } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import type { OrgPaymentMethodConfig } from '@/lib/types/payment';
import {
  togglePaymentMethodEnabled,
  softDeletePaymentMethodConfig,
} from '@/app/actions/payment-config/payment-methods-actions';
import { EnablePaymentMethodDialog } from './enable-payment-method-dialog';
import { PaymentMethodConfigDialog } from './payment-method-config-dialog';
import { CmxConfirmDialog } from '@ui/feedback';

interface PaymentMethodsTabProps {
  methods: OrgPaymentMethodConfig[];
  isLoading?: boolean;
  onRefresh: () => void;
}

export function PaymentMethodsTab({ methods, isLoading, onRefresh }: PaymentMethodsTabProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [configTarget, setConfigTarget] = useState<OrgPaymentMethodConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgPaymentMethodConfig | null>(null);
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});

  const getEnabled = (m: OrgPaymentMethodConfig) =>
    localEnabled[m.id] !== undefined ? localEnabled[m.id] : m.is_enabled;

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
        <Badge variant="outline">{t(`methods.nature.${m.payment_nature}` as never)}</Badge>
      ),
    },
    {
      key: 'channels',
      header: t('methods.channels.label'),
      render: (m: OrgPaymentMethodConfig) => (
        <div className="flex gap-1 flex-wrap">
          {m.allowed_in_pos && <Badge variant="secondary">{t('methods.channels.pos')}</Badge>}
          {m.allowed_in_customer_app && <Badge variant="secondary">{t('methods.channels.app')}</Badge>}
          {m.allowed_in_staff_app && <Badge variant="secondary">{t('methods.channels.staff')}</Badge>}
          {m.allowed_in_admin_app && <Badge variant="secondary">{t('methods.channels.admin')}</Badge>}
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
