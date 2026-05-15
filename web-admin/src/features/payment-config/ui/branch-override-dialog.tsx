'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { upsertBranchPaymentMethod } from '@/app/actions/payment-config/branch-payment-methods-actions';

const schema = z.object({
  is_enabled: z.boolean().nullable(),
  allowed_in_pos: z.boolean().nullable(),
  allowed_in_customer_app: z.boolean().nullable(),
  allowed_in_staff_app: z.boolean().nullable(),
  allowed_for_pay_now: z.boolean().nullable(),
  allowed_for_pay_on_collection: z.boolean().nullable(),
  allowed_for_invoice_payment: z.boolean().nullable(),
  allowed_for_refund: z.boolean().nullable(),
  cash_drawer_required: z.boolean(),
  terminal_required: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface BranchOverrideDialogProps {
  branchId: string;
  orgPaymentMethodId: string;
  methodName: string;
  existing?: {
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
  };
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BranchOverrideDialog({
  branchId,
  orgPaymentMethodId,
  methodName,
  existing,
  open,
  onClose,
  onSuccess,
}: BranchOverrideDialogProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      is_enabled: existing?.is_enabled ?? null,
      allowed_in_pos: existing?.allowed_in_pos ?? null,
      allowed_in_customer_app: existing?.allowed_in_customer_app ?? null,
      allowed_in_staff_app: existing?.allowed_in_staff_app ?? null,
      allowed_for_pay_now: existing?.allowed_for_pay_now ?? null,
      allowed_for_pay_on_collection: existing?.allowed_for_pay_on_collection ?? null,
      allowed_for_invoice_payment: existing?.allowed_for_invoice_payment ?? null,
      allowed_for_refund: existing?.allowed_for_refund ?? null,
      cash_drawer_required: existing?.cash_drawer_required ?? false,
      terminal_required: existing?.terminal_required ?? false,
    },
  });

  const handleSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await upsertBranchPaymentMethod({
        branch_id: branchId,
        org_payment_method_id: orgPaymentMethodId,
        ...values,
      });
      if (result.success) {
        cmxMessage.success(t('branches.saved'));
        onSuccess();
      } else {
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  const BoolSwitch = ({ field }: { field: keyof FormValues }) => {
    const val = form.watch(field);
    return (
      <CmxSwitch
        checked={val === true}
        onCheckedChange={(v) => form.setValue(field, v)}
        disabled={isPending}
      />
    );
  };

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('branches.overrideFor', { method: methodName })}</CmxDialogTitle>
        </CmxDialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 py-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('branches.enableSection')}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('branches.isEnabled')}</span>
              <BoolSwitch field="is_enabled" />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('branches.channelsSection')}</p>
            {(
              [
                ['allowed_in_pos', t('methods.channels.pos')],
                ['allowed_in_customer_app', t('methods.channels.app')],
                ['allowed_in_staff_app', t('methods.channels.staff')],
              ] as [keyof FormValues, string][]
            ).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <BoolSwitch field={field} />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('branches.purposesSection')}</p>
            {(
              [
                ['allowed_for_pay_now', t('branches.allowedForPayNow')],
                ['allowed_for_pay_on_collection', t('branches.allowedForCollection')],
                ['allowed_for_invoice_payment', t('branches.allowedForInvoice')],
                ['allowed_for_refund', t('branches.allowedForRefund')],
              ] as [keyof FormValues, string][]
            ).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <BoolSwitch field={field} />
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('branches.requirementsSection')}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('branches.cashDrawerRequired')}</span>
              <CmxSwitch
                checked={!!form.watch('cash_drawer_required')}
                onCheckedChange={(v) => form.setValue('cash_drawer_required', v)}
                disabled={isPending}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('branches.terminalRequired')}</span>
              <CmxSwitch
                checked={!!form.watch('terminal_required')}
                onCheckedChange={(v) => form.setValue('terminal_required', v)}
                disabled={isPending}
              />
            </div>
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('common.cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : t('common.save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
