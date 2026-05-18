'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { createTerminalSchema, updateTerminalSchema, type CreateTerminalFormValues, type UpdateTerminalFormValues } from '../model/terminal-schema';
import { createTerminal, updateTerminal } from '@/app/actions/payment-config/terminals-actions';
import { TERMINAL_TYPES } from '@/lib/constants/payment';
import type { OrgPaymentTerminal } from '@/lib/types/payment';

interface TerminalFormDialogProps {
  terminal?: OrgPaymentTerminal;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TerminalFormDialog({ terminal, open, onClose, onSuccess }: TerminalFormDialogProps) {
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
      serial_no: terminal.serial_no ?? '',
      merchant_id: terminal.merchant_id ?? '',
    } : {
      terminal_type: TERMINAL_TYPES.POS_CARD_TERMINAL,
    },
  });

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
            <CmxSelectDropdown value={form.watch('terminal_type')} onValueChange={(v) => form.setValue('terminal_type', v as never)}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {Object.values(TERMINAL_TYPES).map((ty) => (
                  <CmxSelectDropdownItem key={ty} value={ty}>{t(`terminals.terminalType.${ty}` as never)}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.serialNo')}</label>
            <CmxInput {...form.register('serial_no')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('terminals.merchantId')}</label>
            <CmxInput {...form.register('merchant_id')} />
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
