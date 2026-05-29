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
} from '@/app/actions/orders/get-order-financial';

export type FinancialWarningSeverity = 'info' | 'warning' | 'error';

export interface FinancialWarning {
  code: string;
  severity: FinancialWarningSeverity;
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

export interface OrderArInvoiceView {
  id: string;
  invoiceNo: string;
  status: string;
  amount: number;
  dueDate?: string;
  paidAmount?: number;
  outstandingAmount?: number;
}

export interface OrderTaxDocumentView {
  id?: string;
  documentNo?: string;
  documentType?: string;
  status?: string;
  authorityStatus?: string;
}

export interface OrderFinancialSummaryViewModel {
  orderId: string;
  orderNo: string;
  currencyCode: string;
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
    taxAmount: number;
    roundingAmount: number;
    totalAmount: number;
    totalPaidAmount: number;
    totalCreditAppliedAmount: number;
    refundedAmount: number;
    netCollectedAmount: number;
    outstandingAmount: number;
    expectedOutstandingAmount: number;
    overpaidAmount: number;
    payOnCollectionAmount: number;
    invoiceAmount: number;
  };

  payment: {
    paymentTypeCode: string | null;
    paymentStatus: string;
  };

  arInvoice: OrderArInvoiceView | null;
  taxDocument: OrderTaxDocumentView | null;

  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  charges: OrderChargeRow[];
  discounts: OrderDiscountRow[];
  taxes: OrderTaxRow[];
  refunds: OrderRefundRow[];
  adjustments: OrderAdjustmentRow[];
  auditTimeline: OrderFinancialTimelineRow[];

  warnings: FinancialWarning[];
  reconciliationStatus: 'ok' | 'warning' | 'error';

  /** Raw snapshot for debug tab */
  rawSnapshot: OrderFinancialSnapshot & {
    serviceChargeAmount: number;
    roundingAmount: number;
    netReceivableAmount: number;
    financialEngineVersion: number | null;
  };
}

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
  order?: {
    service_charge?: number | null;
    rounding_adjustment_amount?: number | null;
    net_receivable_amount?: number | null;
    financial_engine_version?: number | null;
    gift_card_applied_amount?: number | null;
    vat_amount?: number | null;
    status?: string | null;
    received_at?: string | null;
    customer_name?: string | null;
    branch_name?: string | null;
  };
  preferenceExtraTotal?: number;
  pieceExtraTotal?: number;
  arInvoice?: OrderArInvoiceView | null;
  taxDocument?: OrderTaxDocumentView | null;
}
