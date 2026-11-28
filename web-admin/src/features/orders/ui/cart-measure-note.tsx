/**
 * CartMeasureNote - the measure line under a measured cart item: "3.5 kg (measured 3.2 kg)" with a re-measure action.
 * Shows the server's billed figure once the cart quote answered; before that, the typed measure.
 * @module orders/ui
 */
'use client';

import { Ruler } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { CartQuoteLineMeasure } from '@/lib/types/cart-quote';
import type { OrderItemMeasure, OrderItemUom } from '../model/new-order-types';

/** Props of {@link CartMeasureNote}. */
export interface CartMeasureNoteProps {
  uom: OrderItemUom;
  /** What staff typed. */
  measure?: OrderItemMeasure;
  /** The server's answer for this line; absent before the first quote. */
  quoted?: CartQuoteLineMeasure | null;
  /** The server's price of one unit, formatted; shown after the billed quantity it multiplies. */
  unitPrice?: string;
  /** Opens the Measure dialog; absent when the line cannot be re-measured. */
  onEdit?: () => void;
}

/**
 * @param props - {@link CartMeasureNoteProps}
 * @returns the measure text and the re-measure button
 */
export function CartMeasureNote({ uom, measure, quoted, unitPrice, onEdit }: CartMeasureNoteProps) {
  const t = useTranslations('uom');
  const ar = useLocale() === 'ar';
  const symbol = ar && uom.symbol2 ? uom.symbol2 : uom.symbol;
  const typed = measure?.length && measure?.width ? `${measure.length} × ${measure.width}` : measure?.measuredQty ?? '';
  const measuredText = quoted ? quoted.measuredQty : typed;
  const text = quoted
    ? (quoted.billedQty === quoted.measuredQty
      ? `${quoted.billedQty} ${symbol}`
      : t('measure.lineNote', { measured: `${quoted.measuredQty} ${symbol}`, billed: `${quoted.billedQty} ${symbol}` }))
    : measuredText ? `${measuredText} ${symbol}` : t('errors.MEASURE_REQUIRED');

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="cart-measure-note">
      <Ruler className="h-3 w-3 shrink-0" aria-hidden />
      <bdi dir="ltr" className="tabular-nums">{quoted && unitPrice ? `${text} × ${unitPrice}` : text}</bdi>
      {onEdit && (
        <CmxButton type="button" variant="ghost" size="xs" className="h-auto p-0.5" onClick={onEdit} aria-label={t('measure.edit')}>
          {t('measure.edit')}
        </CmxButton>
      )}
    </div>
  );
}
