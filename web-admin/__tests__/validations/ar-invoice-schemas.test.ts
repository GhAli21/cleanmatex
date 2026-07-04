import {
  applyArCreditSchema,
  allocateArPaymentSchema,
  createArStatementCycleSchema,
  createArInvoiceFromOrdersSchema,
  createArInvoiceSchema,
  reverseArPaymentAllocationSchema,
  resolveArDisputeSchema,
  runArDunningSchema,
} from '@/lib/validations/ar-invoice-schemas';

describe('ar-invoice-schemas', () => {
  it('accepts allocation with a voucher reference and rejects a legacy payment_id key', () => {
    // AR allocations are voucher-referenced only — the legacy payment-row
    // reference was removed with the dropped payments ledger (ADR-002 / 0395).
    const withVoucher = allocateArPaymentSchema.safeParse({
      voucher_id: '550e8400-e29b-41d4-a716-446655440000',
      allocated_amount: 12.5,
      applied_at: '2026-05-22',
    });
    expect(withVoucher.success).toBe(true);

    const legacyKey = allocateArPaymentSchema.strict().safeParse({
      payment_id: '550e8400-e29b-41d4-a716-446655440000',
      allocated_amount: 12.5,
      applied_at: '2026-05-22',
    });
    expect(legacyKey.success).toBe(false);
  });

  it('accepts reversal payloads with reason and reversal date', () => {
    const result = reverseArPaymentAllocationSchema.safeParse({
      reason: 'Customer payment bounced',
      reversed_at: '2026-05-22',
      idempotency_key: 'reverse-1',
    });

    expect(result.success).toBe(true);
  });

  it('requires at least one order id for order-based issuance', () => {
    const result = createArInvoiceFromOrdersSchema.safeParse({
      order_ids: [],
      currency_code: 'OMR',
    });

    expect(result.success).toBe(false);
  });

  it('accepts manual AR invoices with at least one line item', () => {
    const result = createArInvoiceSchema.safeParse({
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      invoice_type_cd: 'MANUAL_AR',
      currency_code: 'OMR',
      currency_ex_rate: 1,
      subtotal: 10,
      discount: 0,
      tax: 0.5,
      total: 10.5,
      lines: [
        {
          description: 'Laundry service',
          quantity: 1,
          unit_price: 10,
          subtotal_amount: 10,
          discount_amount: 0,
          taxable_amount: 10,
          tax_amount: 0.5,
          total_amount: 10.5,
          currency_code: 'OMR',
          line_type: 'SERVICE',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts AR credit applications with canonical source ledger input', () => {
    const result = applyArCreditSchema.safeParse({
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      invoice_id: '660e8400-e29b-41d4-a716-446655440000',
      source_ledger_id: '770e8400-e29b-41d4-a716-446655440000',
      applied_amount: 5.25,
      notes: 'Apply overpayment credit',
    });

    expect(result.success).toBe(true);
  });

  it('rejects dispute resolution statuses outside the canonical set', () => {
    const result = resolveArDisputeSchema.safeParse({
      status_cd: 'OPEN',
      resolution_summary: 'Not allowed',
    });

    expect(result.success).toBe(false);
  });

  it('accepts dunning actions with supported stage and action codes', () => {
    const result = runArDunningSchema.safeParse({
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      stage_cd: 'FINAL_NOTICE',
      action_cd: 'EMAIL',
      notes: 'Final warning before hold',
    });

    expect(result.success).toBe(true);
  });

  it('accepts statement cycles with customer lists for custom scope', () => {
    const result = createArStatementCycleSchema.safeParse({
      cycle_code: 'B2B-MONTH-END',
      cycle_name: 'Month End',
      cadence_cd: 'MONTHLY',
      customer_scope_cd: 'CUSTOM_LIST',
      day_of_month: 28,
      issue_day_offset: 1,
      due_terms_days: 30,
      customer_ids: [
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440000',
      ],
      is_active: true,
    });

    expect(result.success).toBe(true);
  });
});
