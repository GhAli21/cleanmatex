import { mapOrderFinancialSummaryView } from '@/src/features/orders/lib/map-order-financial-summary-view';
import type { MapOrderFinancialSummaryInput } from '@/src/features/orders/model/order-financial-summary-view';

function buildInput(
  overrides: Partial<MapOrderFinancialSummaryInput> = {}
): MapOrderFinancialSummaryInput {
  return {
    snapshot: {
      orderId: 'order-1',
      orderNo: 'ORD-1',
      currencyCode: 'OMR',
      paymentTypeCode: 'CREDIT_INVOICE',
      paymentStatus: 'PARTIALLY_PAID',
      subtotalAmount: 2,
      itemsBaseAmount: 2,
      pieceExtraPriceAmount: 0,
      preferenceExtraPriceAmount: 0,
      serviceChargeAmount: 0,
      deliveryChargeAmount: 0,
      expressChargeAmount: 0,
      otherChargesAmount: 0,
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      taxableAmount: 2,
      nonTaxableAmount: 0,
      exemptAmount: 0,
      zeroRatedAmount: 0,
      outOfScopeAmount: 0,
      totalTaxAmount: 0.14,
      totalAmount: 2.14,
      totalPaidAmount: 1,
      pendingPaymentAmount: 0,
      authorizedPaymentAmount: 0,
      failedPaymentAmount: 0,
      totalCreditAppliedAmount: 0.15,
      pendingCreditApplicationAmount: 0,
      failedCreditApplicationAmount: 0,
      refundedAmount: 0,
      realPaymentRefundedAmount: 0,
      storedValueRestoredAmount: 0,
      customerCreditIssuedAmount: 0,
      netCollectedAmount: 1,
      outstandingAmount: 0.84,
      overpaidAmount: 0,
      payOnCollectionAmount: 0,
      arReceivableAmount: 0.84,
      currencyExRate: 9.75,
      baseCurCurrencyCode: 'SAR',
      baseCurTotalAmount: 20.865,
      baseCurTaxAmount: 1.365,
      baseCurPaidAmount: 9.75,
      baseCurCreditAppliedAmount: 1.4625,
      baseCurOutstandingAmount: 8.19,
      baseCurArReceivableAmount: 8.19,
      arInvoiceId: null,
      arInvoiceNo: null,
      arInvoiceStatus: null,
      taxDocumentId: null,
      taxDocumentNo: null,
      taxDocumentStatus: null,
      taxDocumentType: null,
      financialSnapshotStatus: 'CURRENT',
      financialMismatchWarningCount: 0,
      financialCalculationSnapshot: null,
      financialCalculationHash: null,
      financialCalculationTraceId: null,
      changeReturnedAmount: 0,
      roundingAmount: 0,
      financialEngineVersion: 1,
    } as MapOrderFinancialSummaryInput['snapshot'],
    charges: [],
    discounts: [],
    taxes: [],
    payments: [],
    creditApplications: [],
    refunds: [],
    adjustments: [],
    auditTimeline: [],
    ...overrides,
  };
}

describe('mapOrderFinancialSummaryView', () => {
  it('maps base-currency reporting snapshot values', () => {
    const view = mapOrderFinancialSummaryView(buildInput());

    expect(view.baseCurrency).toEqual({
      currencyCode: 'SAR',
      exchangeRate: 9.75,
      totalAmount: 20.865,
      taxAmount: 1.365,
      paidAmount: 9.75,
      creditAppliedAmount: 1.4625,
      outstandingAmount: 8.19,
      arReceivableAmount: 8.19,
    });
  });

  it('prefers AR invoice outstanding amount when an invoice exists', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        arInvoice: {
          id: 'ar-1',
          invoiceNo: 'ARI-000016',
          status: 'OVERDUE',
          amount: 0.99,
          outstandingAmount: 0.99,
        },
      })
    );

    expect(view.amounts.arReceivableAmount).toBeCloseTo(0.99);
  });

  it('emits a warning when invoice and order outstanding amounts diverge', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        arInvoice: {
          id: 'ar-1',
          invoiceNo: 'ARI-000016',
          status: 'OVERDUE',
          amount: 0.99,
          outstandingAmount: 0.99,
        },
      })
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AR_RECEIVABLE_MISMATCH',
          messageKey: 'arReceivableMismatch',
        }),
      ])
    );
  });

  it('BF-11: a stored zero net collected is a real zero, never recomputed', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        snapshot: {
          ...buildInput().snapshot,
          refundedAmount: 0.5,
          realPaymentRefundedAmount: 0.25,
          netCollectedAmount: 0,
        },
      }),
    );

    expect(view.amounts.netCollectedAmount).toBe(0);
  });

  it('uses real-payment refunds (not total refunds) when net collected is absent', () => {
    const snapshot = {
      ...buildInput().snapshot,
      refundedAmount: 0.5,
      realPaymentRefundedAmount: 0.25,
    } as Partial<MapOrderFinancialSummaryInput['snapshot']>;
    delete snapshot.netCollectedAmount;
    const view = mapOrderFinancialSummaryView(
      buildInput({ snapshot: snapshot as MapOrderFinancialSummaryInput['snapshot'] }),
    );

    expect(view.amounts.netCollectedAmount).toBe(0.75);
  });

  it('keeps a processed overcharge refund settled instead of recreating overpayment from gross paid', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        snapshot: {
          ...buildInput().snapshot,
          totalAmount: 0.7,
          totalPaidAmount: 1.4,
          realPaymentRefundedAmount: 0.7,
          netCollectedAmount: 0.7,
          outstandingAmount: 0,
          overpaidAmount: 0,
          paymentStatus: 'PAID',
        },
      }),
    );

    expect(view.amounts.overpaidAmount).toBe(0);
    expect(view.payment.paymentStatus).toBe('PAID');
  });

  it('flags mixed-case pending payments with the canonical warning code', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        payments: [
          {
            id: 'pay-1',
            payment_method_code: 'CARD',
            payment_nature_snapshot: 'REAL_PAYMENT',
            amount: 1,
            payment_status: 'processing',
            received_by: null,
            gateway_code: null,
            gateway_reference: null,
            branch_payment_method_id: null,
            created_at: new Date().toISOString(),
            fin_voucher_id: null,
          },
        ],
      }),
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PENDING_PAYMENT_COUNTED_AS_PAID',
        }),
      ]),
    );
  });

  it('flags mixed-case authorized payments with the canonical warning code', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        payments: [
          {
            id: 'pay-2',
            payment_method_code: 'CARD',
            payment_nature_snapshot: 'REAL_PAYMENT',
            amount: 1,
            payment_status: 'authorized',
            received_by: null,
            gateway_code: null,
            gateway_reference: null,
            branch_payment_method_id: null,
            created_at: new Date().toISOString(),
            fin_voucher_id: null,
          },
        ],
      }),
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'AUTHORIZED_PAYMENT_COUNTED_AS_PAID',
        }),
      ]),
    );
  });

  it('uses canonical snapshot service charge amount instead of legacy header fallback', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        snapshot: {
          ...buildInput().snapshot,
          serviceChargeAmount: 0.3,
          totalChargesAmount: 0.3,
        },
        charges: [
          {
            id: 'charge-1',
            charge_type: 'SERVICE_CHARGE',
            label: 'Service',
            label2: null,
            amount: 0.1,
            currency_code: 'OMR',
          },
        ],
      }),
    );

    expect(view.amounts.serviceChargeAmount).toBeCloseTo(0.3);
  });

  it('derives gift-card warning input from canonical credit applications instead of legacy header aliases', () => {
    const view = mapOrderFinancialSummaryView(
      buildInput({
        snapshot: {
          ...buildInput().snapshot,
          totalCreditAppliedAmount: 0.15,
        },
        creditApplications: [
          {
            id: 'credit-1',
            credit_type: 'GIFT_CARD',
            application_status: 'APPLIED',
            credit_source_id: 'gc-1',
            applied_amount: 0.1,
            currency_code: 'OMR',
            reference_no: 'GC-0001',
            applied_by: null,
            applied_at: new Date().toISOString(),
            fin_voucher_id: null,
          },
        ],
      }),
    );

    expect(view.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'GIFT_CARD_DOUBLE_COUNTED',
        }),
      ]),
    );
  });

  describe('tax-base decomposition (v1.1 §8.11)', () => {
    it('passes through all five tax-base buckets from the canonical snapshot', () => {
      const view = mapOrderFinancialSummaryView(
        buildInput({
          snapshot: {
            ...buildInput().snapshot,
            taxableAmount: 100,
            nonTaxableAmount: 5,
            exemptAmount: 10,
            zeroRatedAmount: 15,
            outOfScopeAmount: 20,
          },
        }),
      );

      expect(view.amounts.taxableAmount).toBeCloseTo(100);
      expect(view.amounts.nonTaxableAmount).toBeCloseTo(5);
      expect(view.amounts.exemptAmount).toBeCloseTo(10);
      expect(view.amounts.zeroRatedAmount).toBeCloseTo(15);
      expect(view.amounts.outOfScopeAmount).toBeCloseTo(20);
    });

    it('defaults the four non-taxable bucket fields to zero when the snapshot omits them (engine pre-Phase 5)', () => {
      const view = mapOrderFinancialSummaryView(buildInput());

      expect(view.amounts.nonTaxableAmount).toBe(0);
      expect(view.amounts.exemptAmount).toBe(0);
      expect(view.amounts.zeroRatedAmount).toBe(0);
      expect(view.amounts.outOfScopeAmount).toBe(0);
    });
  });

  describe('credit application lifecycle (v1.1 §10.x)', () => {
    it('passes pending and failed credit buckets through from the snapshot', () => {
      const view = mapOrderFinancialSummaryView(
        buildInput({
          snapshot: {
            ...buildInput().snapshot,
            pendingCreditApplicationAmount: 7,
            failedCreditApplicationAmount: 3,
          },
        }),
      );

      expect(view.amounts.pendingCreditApplicationAmount).toBeCloseTo(7);
      expect(view.amounts.failedCreditApplicationAmount).toBeCloseTo(3);
    });
  });

  describe('Reusable View Phase 1 regressions', () => {
    const charge = (
      charge_type: string,
      amount: number,
      is_voided: boolean,
    ): MapOrderFinancialSummaryInput['charges'][number] =>
      ({
        id: `${charge_type}-${amount}`,
        charge_type,
        label: null,
        label2: null,
        amount,
        currency_code: 'OMR',
        is_voided,
        voided_at: null,
        voided_by: null,
        void_reason: null,
      }) as MapOrderFinancialSummaryInput['charges'][number];

    it('BF-01: delivery and express come from the snapshot, not from rows (voided rows ignored)', () => {
      const view = mapOrderFinancialSummaryView(
        buildInput({
          snapshot: {
            ...buildInput().snapshot,
            deliveryChargeAmount: 0.5,
            expressChargeAmount: 0,
            totalChargesAmount: 0.5,
          },
          charges: [
            charge('DELIVERY', 0.5, false),
            charge('DELIVERY', 0.7, true),
            charge('EXPRESS', 1, true),
          ],
        }),
      );

      expect([
        view.amounts.deliveryChargeAmount,
        view.amounts.expressChargeAmount,
        view.amounts.totalChargesAmount,
      ]).toEqual([0.5, 0, 0.5]);
    });

    it('BF-01: the row fallback (field absent) excludes voided rows', () => {
      const snapshot = { ...buildInput().snapshot } as Partial<
        MapOrderFinancialSummaryInput['snapshot']
      >;
      delete snapshot.deliveryChargeAmount;
      const view = mapOrderFinancialSummaryView(
        buildInput({
          snapshot: snapshot as MapOrderFinancialSummaryInput['snapshot'],
          charges: [charge('DELIVERY', 0.5, false), charge('DELIVERY', 0.7, true)],
        }),
      );

      expect(view.amounts.deliveryChargeAmount).toBe(0.5);
    });

    it('BF-02: no false mismatch when a refund reopened the balance (server D005 value)', () => {
      // total 2.14, paid 1, credits 0.15 → naive 0.99; a 0.2 rebill reopen → 1.19.
      const view = mapOrderFinancialSummaryView(
        buildInput({
          snapshot: {
            ...buildInput().snapshot,
            outstandingAmount: 1.19,
            expectedOutstandingAmount: 1.19,
          },
        }),
      );

      expect(view.amounts.expectedOutstandingAmount).toBe(1.19);
      expect(view.warnings.map((w) => w.code)).not.toContain('OUTSTANDING_MISMATCH');
    });

    it('BF-05: rounding and pay-on-collection come from the snapshot, not the page prop', () => {
      const view = mapOrderFinancialSummaryView(
        buildInput({
          snapshot: {
            ...buildInput().snapshot,
            paymentTypeCode: 'PAY_ON_COLLECTION',
            roundingAmount: 0.005,
            payOnCollectionAmount: 0.5,
          },
          order: { rounding_adjustment_amount: 9 },
        }),
      );

      expect([view.amounts.roundingAmount, view.amounts.payOnCollectionAmount]).toEqual([
        0.005, 0.5,
      ]);
    });

    it('BF-06: snapshot facts and voucher references reach the business view', () => {
      const view = mapOrderFinancialSummaryView(
        buildInput({
          snapshot: {
            ...buildInput().snapshot,
            pendingPaymentAmount: 0.1,
            authorizedPaymentAmount: 0.2,
            failedPaymentAmount: 0.3,
            realPaymentRefundedAmount: 0.4,
            storedValueRestoredAmount: 0.5,
            customerCreditIssuedAmount: 0.6,
            changeReturnedAmount: 0.7,
          },
          voucherReferences: [{ voucherId: 'v1', voucherLineId: null, source: 'PAYMENT' }],
        }),
      );

      expect(view.amounts).toMatchObject({
        pendingPaymentAmount: 0.1,
        authorizedPaymentAmount: 0.2,
        failedPaymentAmount: 0.3,
        realPaymentRefundedAmount: 0.4,
        storedValueRestoredAmount: 0.5,
        customerCreditIssuedAmount: 0.6,
        changeReturnedAmount: 0.7,
      });
      expect(view.voucherReferences).toEqual([
        { voucherId: 'v1', voucherLineId: null, source: 'PAYMENT' },
      ]);
    });
  });
});
