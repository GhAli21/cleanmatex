/**
 * P1B-11: Review lists each recalculated discount and asks to acknowledge a removal (rule #15, D21).
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({ decimalPlaces: 3 }) }));
jest.mock('@features/orders/hooks/use-service-speeds', () => ({ useServiceSpeeds: () => ({ labelOf: (code: string) => code }) }));
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) =>
    `${namespace}.${key}${values ? ` ${JSON.stringify(values)}` : ''}`,
}));

import { EditReviewDialog } from '@features/orders/order-change/edit-review-dialog';
import type { EditReviewView } from '@features/orders/order-change/edit-review-view';

const change = (outcome: 'CHANGED' | 'REMOVED') => ({
  key: `DISCOUNT_RULE:${outcome}`, adjustmentId: 'order:d1', sourceType: 'DISCOUNT_RULE', sourceId: outcome, promotionId: null,
  sourceName: 'Weekday 10%', sourceName2: null, outcome, reason: outcome === 'REMOVED' ? 'MIN_ORDER_NOT_MET' as const : null,
  previousAmount: '1.0000', amount: outcome === 'REMOVED' ? '0.0000' : '1.5000',
});

const review: EditReviewView = {
  status: 'ACKNOWLEDGEMENT_REQUIRED', currentTotal: '10.000', estimatedTotal: '9.000', financialOutcome: null,
  operations: [{ seq: 2, code: 'CHANGE_ITEM_QUANTITY', target: 'PERSISTED_ITEM', before: {}, after: {} }],
  warnings: [], conflict: false, priceChangedSeqs: [], currencyCode: 'OMR',
  discountChanges: [change('CHANGED'), change('REMOVED')],
};

it('shows each discount change and acknowledges a removal with its gate code', () => {
  const onAcknowledge = jest.fn();
  render(
    <EditReviewDialog open review={review} history={[]} applying={false} conflict={false} applyFailure={null}
      onOpenChange={jest.fn()} onAcknowledge={onAcknowledge} onReason={jest.fn()} onReviewAgain={jest.fn()} onApply={jest.fn()} onReload={jest.fn()} />,
  );
  expect(screen.getByText(/orders\.edit\.review\.discounts\.changed .*Weekday 10%/)).toBeInTheDocument();
  expect(screen.getByText(/orders\.edit\.review\.discounts\.removed .*Weekday 10%/)).toBeInTheDocument();
  // Only the removal asks for acknowledgement.
  const boxes = screen.getAllByRole('checkbox');
  expect(boxes).toHaveLength(1);
  fireEvent.click(boxes[0]);
  expect(onAcknowledge).toHaveBeenCalledWith(2, 'DISCOUNT_REMOVED:DISCOUNT_RULE:REMOVED');
});
