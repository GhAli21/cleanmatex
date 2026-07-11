'use client';

import { CmxSkeleton } from '@ui/primitives';
import { SummaryRow } from './summary-row';

/** One pre-formatted row (label + already-localized value string). */
export interface OrderValueBreakdownRow {
  id: string;
  label: string;
  value: string;
  negative?: boolean;
}

/**
 * The full order-value story, grouped for display: gross charges, applied
 * discounts (rule/manual/promo), tax lines, and the final total row.
 */
export interface OrderValueBreakdownModel {
  grossRows: OrderValueBreakdownRow[];
  discountRows: OrderValueBreakdownRow[];
  taxRows: OrderValueBreakdownRow[];
  totalRow: OrderValueBreakdownRow;
}

/** Localized section labels/help copy for {@link OrderValueBreakdownPanel}. */
export interface OrderValueBreakdownLabels {
  grossValue: string;
  grossValueHelp: string;
  discounts: string;
  discountsHelp: string;
  taxes: string;
  taxesHelp: string;
}

/** Props for {@link OrderValueBreakdownPanel}. */
export interface OrderValueBreakdownPanelProps {
  model: OrderValueBreakdownModel;
  labels: OrderValueBreakdownLabels;
  isRTL: boolean;
  /** True while server totals are loading and tax rows aren't final yet. */
  taxLoading?: boolean;
}

/**
 * Renders the order value → discounts → tax story as three grouped cards.
 * Extracted from `payment-full-view.tsx` in Phase 4 (Simple discounts +
 * full-story receipt) so the Full-view financial inspector and the Simple
 * receipt render the exact same breakdown from one source — the container
 * computes `model` once (via `totals` from the canonical server-side
 * calculation) and passes it to both faces. Locale-agnostic: labels and
 * formatted values arrive as props.
 */
export function OrderValueBreakdownPanel({
  model,
  labels,
  isRTL,
  taxLoading,
}: OrderValueBreakdownPanelProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <p className="text-sm font-semibold text-slate-900">{labels.grossValue}</p>
          <p className="mt-1 text-xs text-slate-500">{labels.grossValueHelp}</p>
        </div>
        <div className="mt-3 space-y-2">
          {model.grossRows.map((row) => (
            <SummaryRow key={row.id} label={row.label} value={row.value} />
          ))}
        </div>
      </div>

      {model.discountRows.length > 0 ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className="text-sm font-semibold text-rose-900">{labels.discounts}</p>
            <p className="mt-1 text-xs text-rose-700">{labels.discountsHelp}</p>
          </div>
          <div className="mt-3 space-y-2">
            {model.discountRows.map((row) => (
              <SummaryRow key={row.id} label={row.label} value={row.value} negative />
            ))}
          </div>
        </div>
      ) : null}

      {taxLoading ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className="text-sm font-semibold text-amber-950">{labels.taxes}</p>
            <p className="mt-1 text-xs text-amber-700">{labels.taxesHelp}</p>
          </div>
          <div className="mt-3 space-y-2">
            <CmxSkeleton className="h-4 w-full" />
            <CmxSkeleton className="h-4 w-3/4" />
          </div>
        </div>
      ) : model.taxRows.length > 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className="text-sm font-semibold text-amber-950">{labels.taxes}</p>
            <p className="mt-1 text-xs text-amber-700">{labels.taxesHelp}</p>
          </div>
          <div className="mt-3 space-y-2">
            {model.taxRows.map((row) => (
              <SummaryRow key={row.id} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
