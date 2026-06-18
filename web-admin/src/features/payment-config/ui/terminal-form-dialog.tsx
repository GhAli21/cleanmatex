'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { createTerminalSchema, updateTerminalSchema, type CreateTerminalFormValues } from '../model/terminal-schema';
import { createTerminal, updateTerminal } from '@/app/actions/payment-config/terminals-actions';
import { TERMINAL_TYPES } from '@/lib/constants/payment';
import type { OrgPaymentTerminal } from '@/lib/types/payment';

interface TerminalFormDialogProps {
  terminal?: OrgPaymentTerminal;
  branches: Array<{ id: string; branch_name: string }>;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NO_BRANCH_VALUE = '__no_branch__';

/**
 *
 * @param root0
 * @param root0.terminal
 * @param root0.branches
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 */
export function TerminalFormDialog({ terminal, branches, open, onClose, onSuccess }: TerminalFormDialogProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const isEdit = !!terminal;

  const form = useForm<CreateTerminalFormValues>({
    resolver: zodResolver(isEdit ? updateTerminalSchema : createTerminalSchema) as Resolver<CreateTerminalFormValues>,
    defaultValues: terminal ? {
      terminal_name: terminal.terminal_name,
      terminal_name2: terminal.terminal_name2 ?? '',
      terminal_type: terminal.terminal_type,
      gateway_code: terminal.gateway_code ?? '',
      branch_id: terminal.branch_id ?? undefined,
      serial_no: terminal.serial_no ?? '',
      merchant_id: terminal.merchant_id ?? '',
      terminal_external_id: terminal.terminal_external_id ?? '',
    } : {
      terminal_type: TERMINAL_TYPES.POS_CARD_TERMINAL,
      branch_id: undefined,
    },
  });

  const terminalType = useWatch({ control: form.control, name: 'terminal_type' });
  const branchId = useWatch({ control: form.control, name: 'branch_id' });

  const handleSubmit = (values: CreateTerminalFormValues) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateTerminal(terminal!.id, values)
        : await createTerminal(values);
      if (result.success) {
        cmxMessage.success(t('terminals.saved'));
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
          <CmxDialogTitle>{isEdit ? t('terminals.edit') : t('terminals.add')}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 py-2">
          {!isEdit && (
            <div>
              <label className="text-sm font-medium">{t('terminals.code')}</label>
              <CmxInput {...form.register('terminal_code')} placeholder="TRM-001" className="font-mono" />
              {form.formState.errors.terminal_code && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.terminal_code.message}</p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">{t('terminals.name')}</label>
            <CmxInput {...form.register('terminal_name')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.name2')}</label>
            <CmxInput {...form.register('terminal_name2')} dir="rtl" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.type')}</label>
            <CmxSelectDropdown value={terminalType} onValueChange={(v) => form.setValue('terminal_type', v as never)}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {Object.values(TERMINAL_TYPES).map((ty) => (
                  <CmxSelectDropdownItem key={ty} value={ty}>{t(`terminals.terminalType.${ty}` as never)}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.branch')}</label>
            <CmxSelectDropdown
              value={branchId ?? NO_BRANCH_VALUE}
              onValueChange={(value) => form.setValue('branch_id', value === NO_BRANCH_VALUE ? undefined : value)}
            >
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value={NO_BRANCH_VALUE}>{t('terminals.unassignedBranch')}</CmxSelectDropdownItem>
                {branches.map((branch) => (
                  <CmxSelectDropdownItem key={branch.id} value={branch.id}>{branch.branch_name}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.gateway')}</label>
            <CmxInput {...form.register('gateway_code')} placeholder="HYPERPAY" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.serialNo')}</label>
            <CmxInput {...form.register('serial_no')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.merchantId')}</label>
            <CmxInput {...form.register('merchant_id')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.externalId')}</label>
            <CmxInput {...form.register('terminal_external_id')} />
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
