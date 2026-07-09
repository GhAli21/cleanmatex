import {
  buildCashDrawerClosePreview,
  type CashDrawerSessionCloseSummary,
} from '@features/cash-drawers/api/cash-drawer-api';

function summary(overrides: Partial<CashDrawerSessionCloseSummary> = {}): CashDrawerSessionCloseSummary {
  return {
    session: {
      id: 'session-001',
      session_no: 'SES-000007',
      status: 'OPEN',
      opened_at: '2026-07-09T00:00:00.000Z',
      opening_float_amount: '10.0000',
      currency_code: 'OMR',
    },
    movements: [],
    payments: [],
    totalCashIn: '3.0000',
    totalCashOut: '1.0000',
    totalPayments: '7.5000',
    ...overrides,
  };
}

describe('buildCashDrawerClosePreview', () => {
  it('uses opening float plus linked cash payments for POS close expected cash', () => {
    const preview = buildCashDrawerClosePreview(summary(), '17.500');

    expect(preview.openingFloat).toBe(10);
    expect(preview.cashCollected).toBe(7.5);
    expect(preview.expectedCash).toBe(17.5);
    expect(preview.variance).toBe(0);
  });

  it('keeps drawer movements visible as audit context without folding them into expected cash', () => {
    const preview = buildCashDrawerClosePreview(summary(), '19.500');

    expect(preview.movementCashIn).toBe(3);
    expect(preview.movementCashOut).toBe(1);
    expect(preview.movementNet).toBe(2);
    expect(preview.expectedCash).toBe(17.5);
    expect(preview.variance).toBe(2);
  });

  it('prefers cash-drawer service reconciliation totals when the API provides them', () => {
    const preview = buildCashDrawerClosePreview(
      summary({
        reconciliation: {
          openingFloat: '20.0000',
          cashCollected: '8.0000',
          movementCashIn: '4.0000',
          movementCashOut: '1.0000',
          movementNet: '3.0000',
          expectedCash: '28.0000',
          movementExpectedCash: '23.0000',
          paymentCount: 2,
          movementCount: 3,
          currencyCode: 'OMR',
        },
      }),
      '29.000'
    );

    expect(preview.expectedCash).toBe(28);
    expect(preview.paymentCount).toBe(2);
    expect(preview.movementCount).toBe(3);
    expect(preview.variance).toBe(1);
  });
});
