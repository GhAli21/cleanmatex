'use client';

import { useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import {
  createCashDrawerSchema,
  updateCashDrawerSchema,
  type CreateCashDrawerFormValues,
} from '../model/cash-drawer-schema';
import { createCashDrawer, updateCashDrawer } from '@/app/actions/payment-config/cash-drawers-actions';
import { DRAWER_TYPES } from '@/lib/constants/payment';
import type { OrgCashDrawer } from '@/lib/types/payment';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

interface CashDrawerFormDialogProps {
  drawer?: OrgCashDrawer;
  branches: Array<{ id: string; branch_name: string }>;
  terminals: Array<{ id: string; terminal_name: string; terminal_code: string; branch_id: string | null }>;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NO_TERMINAL_VALUE = '__no_terminal__';

export function CashDrawerFormDialog({
  drawer,
  branches,
  terminals,
  open,
  onClose,
  onSuccess,
}: CashDrawerFormDialogProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const isEdit = !!drawer;
  const { currencyCode: tenantCurrencyCode } = useTenantCurrency();

  const form = useForm<CreateCashDrawerFormValues>({
    resolver: zodResolver(isEdit ? updateCashDrawerSchema : createCashDrawerSchema) as Resolver<CreateCashDrawerFormValues>,
    defaultValues: drawer ? {
      drawer_name: drawer.drawer_name,
      drawer_name2: drawer.drawer_name2 ?? '',
      drawer_type: drawer.drawer_type,
      branch_id: drawer.branch_id,
      currency_code: drawer.currency_code,
      requires_session: drawer.requires_session,
      opening_float_required: drawer.opening_float_required,
      max_cash_limit: drawer.max_cash_limit ?? undefined,
      assigned_terminal_id: drawer.assigned_terminal_id ?? undefined,
    } : {
      drawer_type: DRAWER_TYPES.COUNTER,
      branch_id: branches[0]?.id,
      currency_code: tenantCurrencyCode,
      requires_session: true,
      opening_float_required: true,
      assigned_terminal_id: undefined,
    },
  });

  useEffect(() => {
    form.setValue('currency_code', tenantCurrencyCode);
  }, [form, tenantCurrencyCode]);

  const selectedBranchId = form.watch('branch_id');
  const branchScopedTerminals = terminals.filter((terminal) => !selectedBranchId || terminal.branch_id === null || terminal.branch_id === selectedBranchId);

  const handleSubmit = (values: CreateCashDrawerFormValues) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateCashDrawer(drawer!.id, {
            branch_id: values.branch_id,
            drawer_name: values.drawer_name,
            drawer_name2: values.drawer_name2,
            drawer_type: values.drawer_type,
            requires_session: values.requires_session,
            opening_float_required: values.opening_float_required,
            max_cash_limit: values.max_cash_limit,
            assigned_terminal_id: values.assigned_terminal_id,
          })
        : await createCashDrawer({
            ...values,
            currency_code: tenantCurrencyCode,
          });
      if (result.success) {
        cmxMessage.success(t('cashDrawers.saved'));
        form.reset();
        onSuccess();
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{isEdit ? t('cashDrawers.edit') : t('cashDrawers.add')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 py-2">
          {!isEdit && (
            <div>
              <label className="text-sm font-medium">{t('cashDrawers.code')}</label>
              <CmxInput {...form.register('drawer_code')} placeholder="DRW-001" className="font-mono" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.name')}</label>
            <CmxInput {...form.register('drawer_name')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.name2')}</label>
            <CmxInput {...form.register('drawer_name2')} dir="rtl" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.drawerType')}</label>
            <CmxSelectDropdown value={form.watch('drawer_type')} onValueChange={(v) => form.setValue('drawer_type', v as never)}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {Object.values(DRAWER_TYPES).map((dt) => (
                  <CmxSelectDropdownItem key={dt} value={dt}>{t(`cashDrawers.drawerTypeLabel.${dt}` as never)}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.branch')}</label>
            <CmxSelectDropdown value={form.watch('branch_id') ?? ''} onValueChange={(v) => form.setValue('branch_id', v)}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {branches.map((branch) => (
                  <CmxSelectDropdownItem key={branch.id} value={branch.id}>{branch.branch_name}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.currency')}</label>
            <CmxInput value={tenantCurrencyCode} disabled className="font-mono" />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('cashDrawers.currencyLockedHint')}
            </p>
            {form.formState.errors.currency_code && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.currency_code.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.maxCashLimit')}</label>
            <CmxInput
              type="number"
              step="0.001"
              {...form.register('max_cash_limit', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.assignedTerminal')}</label>
            <CmxSelectDropdown
              value={form.watch('assigned_terminal_id') ?? NO_TERMINAL_VALUE}
              onValueChange={(value) => form.setValue('assigned_terminal_id', value === NO_TERMINAL_VALUE ? undefined : value)}
            >
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value={NO_TERMINAL_VALUE}>{t('cashDrawers.unassignedTerminal')}</CmxSelectDropdownItem>
                {branchScopedTerminals.map((terminal) => (
                  <CmxSelectDropdownItem key={terminal.id} value={terminal.id}>
                    {terminal.terminal_name} ({terminal.terminal_code})
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t('cashDrawers.requiresSession')}</span>
            <CmxSwitch checked={!!form.watch('requires_session')} onCheckedChange={(v) => form.setValue('requires_session', v)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t('cashDrawers.openingFloatRequired')}</span>
            <CmxSwitch checked={!!form.watch('opening_float_required')} onCheckedChange={(v) => form.setValue('opening_float_required', v)} />
          </div>
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</CmxButton>
            <CmxButton type="submit" disabled={isPending}>{isPending ? t('common.saving') : t('common.save')}</CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
