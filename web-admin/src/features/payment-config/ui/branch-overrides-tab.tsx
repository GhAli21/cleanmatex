'use client';

import { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxSkeletonTable } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { getBranchPaymentMethods, softDeleteBranchPaymentMethod } from '@/app/actions/payment-config/branch-payment-methods-actions';
import { BranchOverrideDialog } from './branch-override-dialog';

interface Branch {
  id: string;
  branch_name: string;
}

interface BranchOverridesTabProps {
  branches: Branch[];
  isLoading?: boolean;
}

type MergedRow = {
  id: string;
  org_payment_method_id: string;
  branch_id: string;
  payment_method_code: string;
  display_name: string;
  display_name2: string | null;
  is_enabled: boolean | null;
  allowed_in_pos: boolean | null;
  allowed_in_customer_app: boolean | null;
  allowed_in_staff_app: boolean | null;
  allowed_for_pay_now: boolean | null;
  allowed_for_pay_on_collection: boolean | null;
  allowed_for_invoice_payment: boolean | null;
  allowed_for_refund: boolean | null;
  cash_drawer_required: boolean;
  terminal_required: boolean;
  is_active: boolean;
  rec_status: number;
};

export function BranchOverridesTab({ branches, isLoading }: BranchOverridesTabProps) {
  const t = useTranslations('paymentConfig');
  const [, startTransition] = useTransition();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id ?? '');
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<MergedRow | null>(null);

  const loadRows = (branchId: string) => {
    if (!branchId) return;
    setFetchLoading(true);
    startTransition(async () => {
      const result = await getBranchPaymentMethods(branchId);
      setFetchLoading(false);
      if (result.success && result.data) {
        setRows(result.data as MergedRow[]);
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  useEffect(() => {
    if (selectedBranchId) loadRows(selectedBranchId);
  }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveOverride = (row: MergedRow) => {
    if (!row.id) return;
    startTransition(async () => {
      const result = await softDeleteBranchPaymentMethod(row.id);
      if (result.success) {
        cmxMessage.success(t('branches.overrideRemoved'));
        loadRows(selectedBranchId);
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  if (isLoading) return <CmxSkeletonTable rows={4} columns={5} showHeader />;

  if (!branches.length) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        {t('branches.noBranches')}
      </div>
    );
  }

  const hasOverride = (row: MergedRow) => !!row.id;

  const columns = [
    {
      key: 'name',
      header: t('methods.name'),
      render: (row: MergedRow) => (
        <div>
          <div className="font-medium">{row.display_name}</div>
          {row.display_name2 && <div className="text-xs text-muted-foreground">{row.display_name2}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('branches.status'),
      render: (row: MergedRow) =>
        hasOverride(row) ? (
          <Badge variant="default">{t('branches.overridden')}</Badge>
        ) : (
          <Badge variant="secondary">{t('branches.inherited')}</Badge>
        ),
    },
    {
      key: 'channels',
      header: t('tabs.channels'),
      render: (row: MergedRow) => {
        if (!hasOverride(row)) return <span className="text-xs text-muted-foreground">{t('branches.fromTenant')}</span>;
        const chips = [
          row.allowed_in_pos && t('methods.channels.pos'),
          row.allowed_in_customer_app && t('methods.channels.app'),
          row.allowed_in_staff_app && t('methods.channels.staff'),
        ].filter(Boolean);
        return chips.length ? (
          <div className="flex flex-wrap gap-1">
            {chips.map((c) => <Badge key={c as string} variant="outline" className="text-xs">{c}</Badge>)}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: 'enabled',
      header: t('terminals.enabled'),
      render: (row: MergedRow) => {
        if (!hasOverride(row)) return <span className="text-xs text-muted-foreground">{t('branches.fromTenant')}</span>;
        return row.is_enabled === true ? (
          <Badge className="bg-green-600 text-white">{t('branches.enabled')}</Badge>
        ) : row.is_enabled === false ? (
          <Badge variant="destructive">{t('branches.disabled')}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row: MergedRow) => (
        <div className="flex gap-2 justify-end">
          <CmxButton variant="outline" size="sm" onClick={() => setOverrideTarget(row)}>
            {hasOverride(row) ? t('common.edit') : t('branches.addOverride')}
          </CmxButton>
          {hasOverride(row) && (
            <CmxButton
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => handleRemoveOverride(row)}
            >
              {t('branches.removeOverride')}
            </CmxButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium shrink-0">{t('branches.selectBranch')}</label>
        <CmxSelectDropdown
          value={selectedBranchId}
          onValueChange={(v) => setSelectedBranchId(v)}
        >
          <CmxSelectDropdownTrigger className="w-56">
            <CmxSelectDropdownValue />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {branches.map((b) => (
              <CmxSelectDropdownItem key={b.id} value={b.id}>{b.branch_name}</CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
      </div>

      {fetchLoading ? (
        <CmxSkeletonTable rows={4} columns={5} showHeader />
      ) : (
        <CmxDataTable columns={columns} data={rows} />
      )}

      {overrideTarget && (
        <BranchOverrideDialog
          branchId={selectedBranchId}
          orgPaymentMethodId={overrideTarget.org_payment_method_id}
          methodName={overrideTarget.display_name}
          existing={overrideTarget.id ? overrideTarget : undefined}
          open={!!overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onSuccess={() => {
            setOverrideTarget(null);
            loadRows(selectedBranchId);
          }}
        />
      )}
    </>
  );
}
