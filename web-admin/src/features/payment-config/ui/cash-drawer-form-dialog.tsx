'use client';

import { useEffect, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import {
  createCashDrawerSchema,
  updateCashDrawerSchema,
  type CreateCashDrawerFormValues,
} from '../model/cash-drawer-schema';
import { createCashDrawer, updateCashDrawer } from '@/app/actions/payment-config/cash-drawers-actions';
import { DRAWER_TYPES } from '@/lib/constants/payment';
import { isUserCreatableDrawerType } from '@/lib/constants/cash-drawer';
import type { OrgCashDrawer } from '@/lib/types/payment';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { fetchCashDrawerCatalogs } from '@features/cash-drawers/api/cash-drawer-api';

interface CashDrawerFormDialogProps {
  drawer?: OrgCashDrawer;
  branches: Array<{ id: string; branch_name: string }>;
  terminals: Array<{ id: string; terminal_name: string; terminal_code: string; branch_id: string | null }>;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NO_TERMINAL_VALUE = '__no_terminal__';

/**
 *
 * @param root0
 * @param root0.drawer
 * @param root0.branches
 * @param root0.terminals
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 */
export function CashDrawerFormDialog({
  drawer,
  branches,
  terminals,
  open,
  onClose,
  onSuccess,
}: CashDrawerFormDialogProps) {
  const t = useTranslations('paymentConfig');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!drawer;
  const { currencyCode: tenantCurrencyCode } = useTenantCurrency();

  const form = useForm<CreateCashDrawerFormValues>({
    resolver: zodResolver(isEdit ? updateCashDrawerSchema : createCashDrawerSchema) as Resolver<CreateCashDrawerFormValues>,
    defaultValues: drawer ? {
      drawer_name: drawer.drawer_name,
      drawer_name2: drawer.drawer_name2 ?? '',
      // PENDING_DEPOSIT drawers never reach this form (the tab hides Edit, the action rejects it).
      drawer_type: isUserCreatableDrawerType(drawer.drawer_type) ? drawer.drawer_type : DRAWER_TYPES.COUNTER,
      branch_id: drawer.branch_id,
      currency_code: drawer.currency_code,
      max_cash_limit: drawer.max_cash_limit ?? undefined,
      variance_approval_threshold: drawer.variance_approval_threshold ?? undefined,
      assigned_terminal_id: drawer.assigned_terminal_id ?? undefined,
    } : {
      drawer_type: DRAWER_TYPES.COUNTER,
      branch_id: branches[0]?.id,
      currency_code: tenantCurrencyCode,
      assigned_terminal_id: undefined,
    },
  });

  useEffect(() => {
    form.setValue('currency_code', tenantCurrencyCode);
  }, [form, tenantCurrencyCode]);

  const selectedBranchId = useWatch({ control: form.control, name: 'branch_id' });
  const drawerType = useWatch({ control: form.control, name: 'drawer_type' });
  const assignedTerminalId = useWatch({ control: form.control, name: 'assigned_terminal_id' });
  const catalogsQuery = useQuery({
    queryKey: ['cash-drawers', 'catalogs'],
    enabled: open,
    queryFn: fetchCashDrawerCatalogs,
    staleTime: 5 * 60_000,
  });
  const creatableTypes = (catalogsQuery.data?.drawerTypes ?? [])
    .filter((dt) => isUserCreatableDrawerType(dt.code))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const selectedTypeRow = creatableTypes.find((dt) => dt.code === drawerType);
  const branchScopedTerminals = terminals.filter((terminal) => !selectedBranchId || terminal.branch_id === null || terminal.branch_id === selectedBranchId);

  const handleSubmit = (values: CreateCashDrawerFormValues) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateCashDrawer(drawer!.id, {
            branch_id: values.branch_id,
            drawer_name: values.drawer_name,
            drawer_name2: values.drawer_name2,
            drawer_type: values.drawer_type,
            max_cash_limit: values.max_cash_limit,
            variance_approval_threshold: values.variance_approval_threshold,
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
            <CmxSelectDropdown value={drawerType} onValueChange={(v) => form.setValue('drawer_type', v as never)}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {creatableTypes.length > 0
                  ? creatableTypes.map((dt) => (
                      <CmxSelectDropdownItem key={dt.code} value={dt.code}>
                        {locale === 'ar' && dt.name2 ? dt.name2 : dt.name}
                      </CmxSelectDropdownItem>
                    ))
                  : [DRAWER_TYPES.COUNTER, DRAWER_TYPES.SAFE, DRAWER_TYPES.DRIVER_BAG, DRAWER_TYPES.TEMPORARY].map((dt) => (
                      <CmxSelectDropdownItem key={dt} value={dt}>{t(`cashDrawers.drawerTypeLabel.${dt}` as never)}</CmxSelectDropdownItem>
                    ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          {selectedTypeRow ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">{t('cashDrawers.typeCapabilities')}</span>
              <Badge variant="outline">{selectedTypeRow.isMobile ? t('cashDrawers.capMobile') : t('cashDrawers.capFixed')}</Badge>
              <Badge variant="outline">
                {selectedTypeRow.canReceiveDisposition ? t('cashDrawers.capReceivesDisposition') : t('cashDrawers.capNoDisposition')}
              </Badge>
            </div>
          ) : null}
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.branch')}</label>
            <CmxSelectDropdown value={selectedBranchId ?? ''} onValueChange={(v) => form.setValue('branch_id', v)}>
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
            <label className="text-sm font-medium">{t('cashDrawers.varianceApprovalThreshold')}</label>
            <CmxInput
              type="number"
              step="0.001"
              {...form.register('variance_approval_threshold', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('cashDrawers.varianceApprovalThresholdHint')}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">{t('cashDrawers.assignedTerminal')}</label>
            <CmxSelectDropdown
              value={assignedTerminalId ?? NO_TERMINAL_VALUE}
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
          <p className="text-xs text-muted-foreground">{t('cashDrawers.policyMovedHint')}</p>
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</CmxButton>
            <CmxButton type="submit" disabled={isPending}>{isPending ? t('common.saving') : t('common.save')}</CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
