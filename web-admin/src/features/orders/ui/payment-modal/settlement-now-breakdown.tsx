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
        <div className="rounded-xl border border-info-border bg-info-bg/50 px-2.5 py-2">
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            data-testid="payment-simple-settlement-now-toggle"
            aria-expanded={expanded}
            onClick={() => setExpandedOverride(!expanded)}
            className="h-auto w-full min-h-[36px] justify-between rounded-lg px-1.5 py-1 text-xs font-medium text-primary-text hover:bg-info-border/70"
          >
            <span>{labels.tendersSummary}</span>
            <span className="inline-flex items-center gap-1">
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
              className="mt-2 space-y-3 border-t border-info-border pt-2"
            >
              <div className="space-y-1">
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-start"
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
                  <p className="text-xs text-muted-foreground text-start">
                    {labels.noneApplied}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-start"
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
                  <p className="text-xs text-muted-foreground text-start">
                    {labels.noneApplied}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-info-border bg-card px-2 py-1.5">
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
