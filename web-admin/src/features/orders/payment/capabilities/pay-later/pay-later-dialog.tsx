'use client';

/**
 * Pay-later (balance-policy) capability dialog.
 *
 * Lets the cashier choose how the remaining balance settles — pay in full now,
 * pay on collection, or leave it as an outstanding invoice (B2B AR). Ported from
 * the legacy `payment-full-view` balance-policy section. Selecting an option
 * calls the typed `changeOutstandingPolicy` action; the engine owns the policy
 * effect (leg reconciliation, deferred-explanation) and the server re-validates
 * `OUTSTANDING_POLICY_REQUIRED` on submit — no policy logic here.
 *
 * Live-commit (engine owns state — ADR state-survival); the footer is a single
 * "Done" that closes. Distinct from the B2B account-billing capability, which
 * collects the contract/accounting fields (not the policy choice).
 */

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';

/**
 * Typed engine actions the pay-later dialog may call — nothing more.
 */
export type PayLaterDialogActions = Pick<
  PaymentEngineActions,
  'changeOutstandingPolicy'
>;

/**
 * Props for {@link PayLaterDialog}.
 */
export interface PayLaterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PayLaterDialogActions;
  /** Currently effective outstanding policy (engine-derived). */
  selectedPolicy: OutstandingPolicy;
}

/**
 * The three balance-policy options in stable render order, each mapped to its
 * (reused) title/description i18n keys under `newOrder.payment`.
 */
const POLICY_OPTIONS: ReadonlyArray<{
  policy: OutstandingPolicy;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    policy: 'NONE',
    titleKey: 'rightRail.fullPaymentRequired',
    descriptionKey: 'rightRail.fullPaymentRequiredHelp',
  },
  {
    policy: 'PAY_ON_COLLECTION',
    titleKey: 'remainder.payOnCollection',
    descriptionKey: 'rightRail.payOnCollectionHelp',
  },
  {
    policy: 'CREDIT_INVOICE',
    titleKey: 'remainder.invoiceOutstanding',
    descriptionKey: 'rightRail.invoiceOutstandingHelp',
  },
];

/**
 * Renders the balance-policy chooser inside the shared capability shell.
 *
 * @param props - {@link PayLaterDialogProps}.
 * @returns The dialog element.
 */
export function PayLaterDialog({
  open,
  onOpenChange,
  actions,
  selectedPolicy,
}: PayLaterDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  return (
    <PaymentCapabilityDialog
      capabilityKey={PAYMENT_CAPABILITY.PAY_LATER}
      open={open}
      onOpenChange={onOpenChange}
      title={t('capabilities.PAY_LATER.title')}
      description={t('capabilities.PAY_LATER.description')}
      cancelLabel={tCommon('cancel')}
      onCancel={() => onOpenChange(false)}
      confirmLabel={tCommon('done')}
      onConfirm={() => onOpenChange(false)}
      errorFallbackMessage={t('capabilities.dialog.errorFallback')}
      errorCloseLabel={tCommon('close')}
      isRTL={isRTL}
      maxWidthClassName="max-w-lg"
    >
      <div
        role="radiogroup"
        aria-label={t('capabilities.PAY_LATER.title')}
        className="flex flex-col gap-2"
        data-testid="pay-later-option-list"
      >
        {POLICY_OPTIONS.map((option) => {
          const selected = selectedPolicy === option.policy;
          return (
            <button
              key={option.policy}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`pay-later-option-${option.policy}`}
              onClick={() => actions.changeOutstandingPolicy(option.policy)}
              className={`w-full rounded-2xl border px-4 py-3 transition-colors ${
                isRTL ? 'text-right' : 'text-left'
              } ${
                selected
                  ? 'border-teal-500 bg-teal-50 text-slate-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold">{t(option.titleKey)}</span>
              <span className="mt-1 block text-xs text-slate-500">{t(option.descriptionKey)}</span>
            </button>
          );
        })}
      </div>
    </PaymentCapabilityDialog>
  );
}
