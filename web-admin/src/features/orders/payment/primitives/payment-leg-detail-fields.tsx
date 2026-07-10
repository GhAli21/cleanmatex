'use client';

/**
 * PaymentLegDetailFields — the per-method settlement-leg detail fields (L4
 * primitive; single source for both the Full workbench and the capability
 * dialogs).
 *
 * Given one leg + its method's catalog option + config, it renders exactly the
 * fields that method needs — card (terminal/brand/last-4/auth), check
 * (number/bank/due-date), bank transfer (reference), gateway
 * (code/txn-id/reference) — mirroring the legacy Full-view block so the two
 * never drift. No money math and no method logic here: edits flow through the
 * engine's typed `updateLeg`, which owns capping/validation; the check fields
 * additionally mirror to react-hook-form via the optional `on*Change` setters
 * (the component itself stays RHF-free, same convention as the other dialogs).
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import { type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { OrgCardBrandConfig } from '@/lib/types/payment';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import {
  GATEWAY_METHOD_CODES,
  type CheckoutSettlementOption,
  type PaymentTerminalOption,
} from '@features/orders/hooks/use-payment-catalog';
import {
  legHasRequiredPaymentReference,
  validateCheckDueDate,
  todayYyyyMmDd,
} from '@features/orders/ui/payment-modal-v4.utils';
import { CmxInput } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import type { PaymentEngineActions } from '../engine/payment-engine-actions';

/**
 * Props for {@link PaymentLegDetailFields}. Config + the typed `updateLeg`
 * action come from the engine; the check RHF mirror + refs are optional (the
 * Full workbench threads them; the dialogs may omit them).
 */
export interface PaymentLegDetailFieldsProps {
  /** The leg whose method-specific detail fields to render. */
  leg: PaymentLeg;
  /** The leg's index (target for {@link updateLeg}). */
  legIndex: number;
  /** The leg's catalog option (drives `requires_terminal` / `requires_reference`). */
  option: CheckoutSettlementOption | undefined;
  /** Typed engine action — the only way this component mutates a leg. */
  updateLeg: PaymentEngineActions['updateLeg'];
  /** Payment terminals for the branch (card terminal selector). */
  branchPaymentTerminals: PaymentTerminalOption[];
  /** Active card-brand config (card brand selector). */
  cardBrands: OrgCardBrandConfig[];
  /** Method codes that are customer-credit instruments (excluded from the "no details" fallback). */
  creditMethodCodes: string[];

  // ---- optional RHF mirror for the check fields (Full-view parity) ----
  onCheckNumberChange?: (value: string) => void;
  onCheckBankChange?: (value: string) => void;
  onCheckDateChange?: (value: string) => void;
  /** Resolved check-number error (from RHF), shown on the check-number field. */
  checkNumberError?: string;

  // ---- optional refs (Full-view validation focus) ----
  checkNumberInputRef?: RefObject<HTMLInputElement | null>;
  checkDateInputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * Renders the method-specific detail fields for one settlement leg.
 *
 * @param props - {@link PaymentLegDetailFieldsProps}.
 * @returns The detail fields, or a "no extra details" note for plain methods.
 */
export function PaymentLegDetailFields({
  leg,
  legIndex,
  option,
  updateLeg,
  branchPaymentTerminals,
  cardBrands,
  creditMethodCodes,
  onCheckNumberChange,
  onCheckBankChange,
  onCheckDateChange,
  checkNumberError,
  checkNumberInputRef,
  checkDateInputRef,
}: PaymentLegDetailFieldsProps) {
  const t = useTranslations('newOrder.payment');
  const isRTL = useRTL();

  const referenceError =
    option?.requires_reference && !legHasRequiredPaymentReference(leg, true)
      ? t('splitPayment.validation.referenceRequiredField')
      : undefined;

  const isPlainMethod =
    !creditMethodCodes.includes(leg.method) &&
    leg.method !== PAYMENT_METHODS.CARD &&
    leg.method !== PAYMENT_METHODS.CHECK &&
    leg.method !== PAYMENT_METHODS.BANK_TRANSFER &&
    !GATEWAY_METHOD_CODES.includes(leg.method);

  return (
    <div className="space-y-3">
      {option?.requires_terminal && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('splitPayment.paymentTerminal')}
            <span aria-hidden="true" className="ms-1 text-rose-600">*</span>
            <span className="sr-only">{t('workspace.requiredField')}</span>
          </label>
          <CmxSelectDropdown
            value={leg.terminalId ?? ''}
            onValueChange={(value) => updateLeg(legIndex, 'terminalId', value || undefined)}
          >
            <CmxSelectDropdownTrigger>
              <CmxSelectDropdownValue
                displayValue={
                  leg.terminalId
                    ? branchPaymentTerminals.find((terminal) => terminal.id === leg.terminalId)
                        ?.terminal_name ?? leg.terminalId
                    : ''
                }
                placeholder={t('splitPayment.paymentTerminalPlaceholder')}
              />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              <CmxSelectDropdownItem value="">
                {t('splitPayment.paymentTerminalPlaceholder')}
              </CmxSelectDropdownItem>
              {branchPaymentTerminals.map((terminal) => (
                <CmxSelectDropdownItem key={terminal.id} value={terminal.id}>
                  {isRTL
                    ? terminal.terminal_name2 || terminal.terminal_name
                    : terminal.terminal_name}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
          {!leg.terminalId?.trim() ? (
            <p className="mt-1 text-xs text-rose-600">
              {t('splitPayment.validation.terminalRequiredField')}
            </p>
          ) : null}
        </div>
      )}

      {leg.method === PAYMENT_METHODS.CARD && (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('splitPayment.cardBrand')}
            </label>
            <CmxSelectDropdown
              value={leg.card_brand_code ?? ''}
              onValueChange={(value) => updateLeg(legIndex, 'card_brand_code', value || undefined)}
            >
              <CmxSelectDropdownTrigger>
                <CmxSelectDropdownValue
                  displayValue={
                    leg.card_brand_code
                      ? cardBrands.find((brand) => brand.card_brand_code === leg.card_brand_code)
                          ?.name ?? leg.card_brand_code
                      : ''
                  }
                  placeholder={t('splitPayment.cardBrandPlaceholder')}
                />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value="">
                  {t('splitPayment.cardBrandPlaceholder')}
                </CmxSelectDropdownItem>
                {cardBrands.map((brand) => (
                  <CmxSelectDropdownItem key={brand.card_brand_code} value={brand.card_brand_code}>
                    {isRTL ? brand.name2 || brand.name : brand.name}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <CmxInput
            label={t('splitPayment.cardLast4')}
            value={leg.card_last4 ?? ''}
            dir="ltr"
            maxLength={4}
            inputMode="numeric"
            placeholder="0000"
            onChange={(event) =>
              updateLeg(
                legIndex,
                'card_last4',
                event.target.value.replace(/\D/g, '').slice(0, 4) || undefined,
              )
            }
          />
          <CmxInput
            label={t('splitPayment.authCode')}
            required={option?.requires_reference}
            value={leg.auth_code ?? ''}
            dir="ltr"
            placeholder="—"
            error={referenceError}
            onChange={(event) => updateLeg(legIndex, 'auth_code', event.target.value || undefined)}
          />
        </div>
      )}

      {leg.method === PAYMENT_METHODS.CHECK && (
        <div className="grid gap-3 md:grid-cols-3">
          <CmxInput
            ref={checkNumberInputRef}
            label={t('splitPayment.checkNumber')}
            required
            value={leg.checkNumber ?? ''}
            dir="ltr"
            error={checkNumberError}
            placeholder={t('checkNumber.placeholder')}
            onChange={(event) => {
              const nextValue = event.target.value || undefined;
              updateLeg(legIndex, 'checkNumber', nextValue);
              onCheckNumberChange?.(nextValue ?? '');
            }}
          />
          <CmxInput
            label={t('splitPayment.checkBankName')}
            value={leg.checkBank ?? ''}
            dir="ltr"
            placeholder="—"
            onChange={(event) => {
              const nextValue = event.target.value || undefined;
              updateLeg(legIndex, 'checkBank', nextValue);
              onCheckBankChange?.(nextValue ?? '');
            }}
          />
          <CmxInput
            ref={checkDateInputRef}
            type="date"
            label={t('splitPayment.checkDueDate')}
            value={leg.checkDate ?? ''}
            // Floor the picker at today's local date so the operator cannot
            // tender a back-dated check; validateCheckDueDate also catches
            // pasted/typed values that bypass the picker.
            min={todayYyyyMmDd()}
            error={
              validateCheckDueDate(leg.checkDate)
                ? t(`splitPayment.${validateCheckDueDate(leg.checkDate)!}`)
                : undefined
            }
            onChange={(event) => {
              const nextValue = event.target.value || undefined;
              updateLeg(legIndex, 'checkDate', nextValue);
              onCheckDateChange?.(nextValue ?? '');
            }}
          />
        </div>
      )}

      {leg.method === PAYMENT_METHODS.BANK_TRANSFER && (
        <CmxInput
          label={t('splitPayment.bankReference')}
          required={option?.requires_reference}
          value={leg.bank_reference ?? ''}
          dir="ltr"
          placeholder="—"
          error={referenceError}
          onChange={(event) => updateLeg(legIndex, 'bank_reference', event.target.value || undefined)}
        />
      )}

      {GATEWAY_METHOD_CODES.includes(leg.method) && (
        <div className="grid gap-3 md:grid-cols-3">
          <CmxInput
            label={t('splitPayment.gatewayCode')}
            value={leg.gateway_code ?? ''}
            dir="ltr"
            placeholder="—"
            readOnly
          />
          <CmxInput
            label={t('splitPayment.gatewayTransactionId')}
            required={option?.requires_reference}
            value={leg.gateway_transaction_id ?? ''}
            dir="ltr"
            placeholder="—"
            error={referenceError}
            onChange={(event) =>
              updateLeg(legIndex, 'gateway_transaction_id', event.target.value || undefined)
            }
          />
          <CmxInput
            label={t('splitPayment.gatewayReference')}
            required={option?.requires_reference}
            value={leg.gateway_reference ?? ''}
            dir="ltr"
            placeholder="—"
            error={referenceError}
            onChange={(event) =>
              updateLeg(legIndex, 'gateway_reference', event.target.value || undefined)
            }
          />
        </div>
      )}

      {leg.method === PAYMENT_METHODS.CARD && (
        <div
          className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 ${
            isRTL ? 'flex-row-reverse' : ''
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-cyan-700" />
          {t('security.cardPayment')}
        </div>
      )}

      {isPlainMethod ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          {t('workspace.noDetailsDescription')}
        </div>
      ) : null}
    </div>
  );
}
