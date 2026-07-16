'use client';

/**
 * Compact Settlement Now breakdown for the Simple receipt rail.
 *
 * Progressive disclosure: totals stay primary; Real payments vs Credits /
 * stored value expand when multi-tender or credits are applied. Locale-agnostic
 * — the caller resolves all labels/values.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { SummaryRow } from './summary-row';

/**
 * One settled-now line (real tender or credit/stored-value).
 */
export interface SettlementNowLineItem {
  label: string;
  value: string;
}

/**
 * Props for {@link SettlementNowBreakdown}.
 */
export interface SettlementNowBreakdownProps {
  currencyCode: string;
  formatAmount: (n: number) => string;
  amountAppliedToOrder: number;
  realPaymentItems: SettlementNowLineItem[];
  creditItems: SettlementNowLineItem[];
  totalsLoading?: boolean;
  isRTL?: boolean;
  labels: {
    totalSettledNow: string;
    realPaymentsReceived: string;
    creditsApplied: string;
    noneApplied: string;
    /** Already resolved, e.g. "3 tenders · tap to expand". */
    tendersSummary: string;
    expand: string;
    collapse: string;
  };
  moneyEpsilon?: number;
}

/**
 * Simple-receipt Settlement Now block with optional expand for tender mix.
 *
 * @param props - {@link SettlementNowBreakdownProps}.
 * @returns The breakdown element.
 */
export function SettlementNowBreakdown({
  currencyCode,
  formatAmount,
  amountAppliedToOrder,
  realPaymentItems,
  creditItems,
  totalsLoading,
  isRTL = false,
  labels,
  moneyEpsilon = 0.0001,
}: SettlementNowBreakdownProps) {
  const tenderCount = realPaymentItems.length + creditItems.length;
  const hasDetail =
    tenderCount > 1 ||
    creditItems.length > 0 ||
    (realPaymentItems.length === 1 && amountAppliedToOrder > moneyEpsilon);
  const shouldAutoExpand = tenderCount > 1 || creditItems.length > 0;
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const expanded = expandedOverride ?? shouldAutoExpand;

  return (
    <div data-testid="payment-simple-settlement-now" className="space-y-1">
      <SummaryRow
        label={labels.totalSettledNow}
        value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`}
        loading={totalsLoading}
      />

      {hasDetail && amountAppliedToOrder > moneyEpsilon ? (
        <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 px-2.5 py-2">
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            data-testid="payment-simple-settlement-now-toggle"
            aria-expanded={expanded}
            onClick={() => setExpandedOverride(!expanded)}
            className={`h-auto w-full min-h-[36px] justify-between rounded-lg px-1.5 py-1 text-xs font-medium text-cyan-900 hover:bg-cyan-100/70 ${
              isRTL ? 'flex-row-reverse' : ''
            }`}
          >
            <span>{labels.tendersSummary}</span>
            <span className={`inline-flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {expanded ? labels.collapse : labels.expand}
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              )}
            </span>
          </CmxButton>

          {expanded ? (
            <div
              data-testid="payment-simple-settlement-now-detail"
              className="mt-2 space-y-3 border-t border-cyan-100 pt-2"
            >
              <div className="space-y-1">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                    isRTL ? 'text-right' : 'text-left'
                  }`}
                >
                  {labels.realPaymentsReceived}
                </p>
                {realPaymentItems.length > 0 ? (
                  realPaymentItems.map((item) => (
                    <SummaryRow
                      key={`real-${item.label}-${item.value}`}
                      label={item.label}
                      value={item.value}
                    />
                  ))
                ) : (
                  <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {labels.noneApplied}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                    isRTL ? 'text-right' : 'text-left'
                  }`}
                >
                  {labels.creditsApplied}
                </p>
                {creditItems.length > 0 ? (
                  creditItems.map((item) => (
                    <SummaryRow
                      key={`credit-${item.label}-${item.value}`}
                      label={item.label}
                      value={item.value}
                    />
                  ))
                ) : (
                  <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {labels.noneApplied}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-cyan-200 bg-white px-2 py-1.5">
                <SummaryRow
                  label={labels.totalSettledNow}
                  value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`}
                  bold
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
