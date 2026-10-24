import type {
  OrderAdjustmentRow,
  OrderChargeRow,
  OrderCreditApplicationRow,
  OrderDiscountRow,
  OrderFinancialSnapshot,
  OrderFinancialTimelineRow,
  OrderPaymentRow,
  OrderRefundRow,
  OrderTaxRow,
  TaxDocumentSummaryRow,
} from '@/app/actions/orders/get-order-financial';

/** A finance voucher linked to an order money row. */
export interface OrderVoucherReference {
  voucherId: string;
  voucherLineId: string | null;
  source: 'PAYMENT' | 'REFUND' | 'CREDIT_APPLICATION';
}

/**
 *
 */
export type FinancialWarningSeverity = 'info' | 'warning' | 'error';

/**
 *
 */
export interface FinancialWarning {
  code: string;
  severity: FinancialWarningSeverity;
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

/**
 *
 */
export interface OrderArInvoiceView {
  id: string;
  invoiceNo: string;
  status: string;
  amount: number;
  dueDate?: string;
  paidAmount?: number;
  outstandingAmount?: number;
}

/**
 *
 */
export interface OrderTaxDocumentView {
  id?: string;
  documentNo?: string;
  documentType?: string;
  status?: string;
  authorityStatus?: string;
  /** Phase 7+ lifecycle fields from org_tax_documents_mst. */
  triggerEvent?: string;
  fiscalYear?: number;
  sequenceNumber?: number;
  totalAmount?: number;
  taxAmount?: number;
  issuedAt?: string;
  issuedBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  /** ID of the document this one supersedes (credit-note / debit-note chain). */
  supersedesId?: string;
}

/**
 *
 */
export interface OrderFinancialSummaryViewModel {
  orderId: string;
  orderNo: string;
  customerId?: string | null;
  branchId?: string | null;
  currencyCode: string;
  baseCurrency: {
    currencyCode: string | null;
    exchangeRate: number;
    totalAmount: number;
    taxAmount: number;
    paidAmount: number;
    creditAppliedAmount: number;
    outstandingAmount: number;
    arReceivableAmount: number;
  };
  customerName?: string;
  branchName?: string;
  orderStatus?: string;
  createdAt?: string;

  amounts: {
    itemsBaseAmount: number;
    pieceExtraPriceAmount: number;
    preferenceExtraPriceAmount: number;
    serviceChargeAmount: number;
    deliveryChargeAmount: number;
    expressChargeAmount: number;
    otherChargesAmount: number;
    totalChargesAmount: number;
    subtotalAmount: number;
    grossAmount: number;
    discountAmount: number;
    netBeforeTaxAmount: number;
    taxableAmount: number;
    /**
     * Tax-base decomposition (v1.1 §8.11). The tax engine currently emits only
     * `taxableAmount`; the four bucket fields below default to 0 until Phase 5
     * wires bucket classification. Phase 8 will render them in the breakdown.
     */
    nonTaxableAmount: number;
    exemptAmount: number;
    zeroRatedAmount: number;
    outOfScopeAmount: number;
    taxAmount: number;
    roundingAmount: number;
    totalAmount: number;
    totalPaidAmount: number;
    totalCreditAppliedAmount: number;
    pendingCreditApplicationAmount: number;
    failedCreditApplicationAmount: number;
    refundedAmount: number;
    netCollectedAmount: number;
    outstandingAmount: number;
    expectedOutstandingAmount: number;
    overpaidAmount: number;
    payOnCollectionAmount: number;
    arReceivableAmount: number;
    /** Snapshot facts (BF-06), all from the stored snapshot. */
    pendingPaymentAmount: number;
    authorizedPaymentAmount: number;
    failedPaymentAmount: number;
    /** Refunds paid back as real money (cash, card, original method). */
    realPaymentRefundedAmount: number;
    /** Refunds that restored stored value (wallet, gift card). */
    storedValueRestoredAmount: number;
    /** Refunds issued as customer credit. */
    customerCreditIssuedAmount: number;
    /** Cash change handed back at payment. */
    changeReturnedAmount: number;
  };

  payment: {
    paymentTypeCode: string | null;
    paymentStatus: string;
  };

  arInvoice: OrderArInvoiceView | null;
  /** Every AR invoice billing this order, newest first; `arInvoice` is the primary one (BF-07). */
  arInvoices: OrderArInvoiceView[];
  taxDocument: OrderTaxDocumentView | null;
  /** The full tax-document chain, newest first, including credit and debit notes (BF-13). */
  taxDocuments: OrderTaxDocumentView[];

  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  charges: OrderChargeRow[];
  discounts: OrderDiscountRow[];
  taxes: OrderTaxRow[];
  refunds: OrderRefundRow[];
  adjustments: OrderAdjustmentRow[];
  auditTimeline: OrderFinancialTimelineRow[];
  /** Finance voucher links of payments, refunds and credit applications (BF-06). */
  voucherReferences: OrderVoucherReference[];

  warnings: FinancialWarning[];
  reconciliationStatus: 'ok' | 'warning' | 'error';

  /** Raw snapshot for debug tab */
  rawSnapshot: OrderFinancialSnapshot & {
    serviceChargeAmount: number;
    roundingAmount: number;
    arReceivableAmount: number;
    financialEngineVersion: number | null;
    /** Tax pricing mode recorded in the calculation snapshot JSON (Phase 5+). */
    taxPricingModeAtCalculation: string | null;
  };
}

/**
 *
 */
export interface MapOrderFinancialSummaryInput {
  snapshot: OrderFinancialSnapshot;
  charges: OrderChargeRow[];
  discounts: OrderDiscountRow[];
  taxes: OrderTaxRow[];
  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  refunds: OrderRefundRow[];
  adjustments: OrderAdjustmentRow[];
  auditTimeline: OrderFinancialTimelineRow[];
  voucherReferences?: OrderVoucherReference[];
  order?: {
    rounding_adjustment_amount?: number | null;
    status?: string | null;
    received_at?: string | null;
    customer_name?: string | null;
    branch_name?: string | null;
    customer_id?: string | null;
    branch_id?: string | null;
  };
  preferenceExtraTotal?: number;
  pieceExtraTotal?: number;
  arInvoice?: OrderArInvoiceView | null;
  arInvoices?: OrderArInvoiceView[];
  taxDocument?: OrderTaxDocumentView | null;
  taxDocuments?: TaxDocumentSummaryRow[];
}
