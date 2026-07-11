'use client';

/**
 * B2B account-billing capability dialog (ADR condition #3 — B2B pay-now finishes
 * in Simple; billing this order to the customer's account requires the
 * contract/accounting fields, and when any are missing it is a REQUIRED gate
 * before submit — never a mode change).
 *
 * Collects the account-billing fields (contract, cost center, PO number) and
 * shows the customer's credit-limit status **read-only**. Per Phase 0B the
 * credit-limit exceedance is hard-denied server-side, so this dialog no longer
 * renders the (inert) client override checkbox — an exceedance is surfaced as a
 * hard "payment will be blocked" note; the submit guard enforces it.
 *
 * RHF-free per the program convention: the container threads each field value +
 * setter; the dialog holds no form logic and no engine action (no facade
 * extension). The outstanding-policy choice lives in the separate `PAY_LATER`
 * capability, not here.
 */

import { useTranslations } from 'next-intl';
import { CircleAlert } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxInput } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';

/**
 * One selectable B2B contract (id + human contract number).
 */
export interface B2BContractOption {
  id: string;
  contractNo: string;
}

/**
 * Read-only credit-limit snapshot (server-derived).
 */
export interface B2BCreditLimitInfo {
  creditLimit: number;
  currentBalance: number;
  available: number;
  wouldExceed: boolean;
  /** How much the order total exceeds the available credit (display-only). */
  exceedsBy?: number;
}

/**
 * Props for {@link B2BAccountBillingDialog}. All field values arrive as
 * value + setter pairs (dialog stays RHF-free); credit info is read-only.
 */
export interface B2BAccountBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when this is an unsatisfied REQUIRED gate (shows the badge). */
  required: boolean;

  /** Selected contract id ('' / undefined when none). */
  b2bContractId: string | undefined;
  onB2bContractIdChange: (value: string | undefined) => void;
  /** Selectable contracts for this customer (container-fetched). */
  contracts: B2BContractOption[];
  contractsLoading: boolean;

  costCenterCode: string | undefined;
  onCostCenterCodeChange: (value: string) => void;
  poNumber: string | undefined;
  onPoNumberChange: (value: string) => void;

  /** Credit-limit snapshot to display, or null when none applies. */
  creditLimit: B2BCreditLimitInfo | null;
  currencyCode: string;
  formatAmount: (n: number) => string;
}

/**
 * Renders the B2B account-billing fields inside the shared capability shell.
 *
 * @param props - {@link B2BAccountBillingDialogProps}.
 * @returns The dialog element.
 */
export function B2BAccountBillingDialog({
  open,
  onOpenChange,
  required,
  b2bContractId,
  onB2bContractIdChange,
  contracts,
  contractsLoading,
  costCenterCode,
  onCostCenterCodeChange,
  poNumber,
  onPoNumberChange,
  creditLimit,
  currencyCode,
  formatAmount,
}: B2BAccountBillingDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  const noneLabel = t('b2b.contractOptional');
  const selectedContractLabel =
    contracts.find((contract) => contract.id === b2bContractId)?.contractNo ?? noneLabel;

  return (
    <PaymentCapabilityDialog
      capabilityKey={PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING}
      open={open}
      onOpenChange={onOpenChange}
      title={t('capabilities.B2B_ACCOUNT_BILLING.title')}
      description={t('capabilities.B2B_ACCOUNT_BILLING.description')}
      required={required}
      requiredLabel={t('capabilities.dialog.required')}
      cancelLabel={tCommon('cancel')}
      onCancel={() => onOpenChange(false)}
      confirmLabel={tCommon('done')}
      onConfirm={() => onOpenChange(false)}
      errorFallbackMessage={t('capabilities.dialog.errorFallback')}
      errorCloseLabel={tCommon('close')}
      isRTL={isRTL}
      maxWidthClassName="max-w-lg"
    >
      <div className="flex flex-col gap-3">
        <div>
          <label
            className={`mb-1 block text-sm font-medium text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('b2b.contract')}
          </label>
          <CmxSelectDropdown
            value={b2bContractId || ''}
            onValueChange={(value) => onB2bContractIdChange(value || undefined)}
            isLoading={contractsLoading}
            emptyLabel={noneLabel}
          >
            <CmxSelectDropdownTrigger
              dir={isRTL ? 'rtl' : 'ltr'}
              data-testid="b2b-contract-trigger"
            >
              <CmxSelectDropdownValue displayValue={selectedContractLabel} placeholder={noneLabel} />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              <CmxSelectDropdownItem value="">{noneLabel}</CmxSelectDropdownItem>
              {contracts.map((contract) => (
                <CmxSelectDropdownItem key={contract.id} value={contract.id}>
                  {contract.contractNo}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CmxInput
            value={costCenterCode ?? ''}
            onChange={(event) => onCostCenterCodeChange(event.target.value)}
            label={t('b2b.costCenter')}
            dir="ltr"
            placeholder={t('b2b.costCenterPlaceholder')}
            data-testid="b2b-cost-center-input"
          />
          <CmxInput
            value={poNumber ?? ''}
            onChange={(event) => onPoNumberChange(event.target.value)}
            label={t('b2b.poNumber')}
            dir="ltr"
            placeholder={t('b2b.poNumberPlaceholder')}
            data-testid="b2b-po-number-input"
          />
        </div>

        {creditLimit && creditLimit.creditLimit > 0 ? (
          <div
            className={`rounded-xl border p-3 ${
              creditLimit.wouldExceed ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
            }`}
            data-testid="b2b-credit-limit"
            data-would-exceed={creditLimit.wouldExceed}
          >
            <p className={`flex items-center gap-2 text-sm font-medium text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CircleAlert className="h-4 w-4 text-amber-600" />
              {t('b2b.creditLimit')}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {t('b2b.creditUsed')}: {currencyCode} {formatAmount(creditLimit.currentBalance)} •{' '}
              {t('b2b.creditAvailable')}: {currencyCode} {formatAmount(creditLimit.available)}
              {creditLimit.wouldExceed && (creditLimit.exceedsBy ?? 0) > 0 ? (
                <span className="font-semibold text-amber-800" data-testid="b2b-credit-exceeds-by">
                  {' '}
                  • {t('b2b.creditExceedsBy')}: {currencyCode} {formatAmount(creditLimit.exceedsBy ?? 0)}
                </span>
              ) : null}
            </p>
            {creditLimit.wouldExceed ? (
              <p className="mt-2 text-xs font-medium text-amber-800" data-testid="b2b-credit-exceeded">
                {t('b2b.creditExceeded')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </PaymentCapabilityDialog>
  );
}
