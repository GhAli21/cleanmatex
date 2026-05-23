/**
 * Shared finance contract shapes for future `cmx-api` modules.
 *
 * These interfaces intentionally mirror the canonical web-admin finance
 * surfaces so NestJS modules can adopt the same vocabulary without recreating a
 * parallel business-logic stack.
 */

/**
 * AR invoice summary contract used by list and detail endpoints.
 */
export interface ArInvoiceSummaryContract {
  id: string;
  invoiceNo: string;
  customerId?: string;
  customerName?: string;
  orderId?: string;
  orderNo?: string;
  status: string;
  invoiceTypeCode?: string;
  currencyCode: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  invoiceDate?: string;
  dueDate?: string;
}

/**
 * Payment contract for invoice, order, and customer payment timelines.
 */
export interface PaymentTransactionContract {
  id: string;
  invoiceId?: string;
  orderId?: string;
  customerId?: string;
  voucherId?: string;
  paymentMethodCode: string;
  paymentTypeCode?: string;
  paymentKind?: string;
  status: string;
  currencyCode: string;
  paidAmount: number;
  paidAt?: string;
  transactionId?: string;
}

/**
 * Voucher contract shared by list, detail, and posting/readiness flows.
 */
export interface VoucherContract {
  id: string;
  voucherNo: string;
  voucherType: string;
  voucherStatus: string;
  direction?: string;
  branchId?: string;
  partyType?: string;
  partyId?: string;
  currencyCode: string;
  totalAmount: number;
  postedAt?: string;
}

/**
 * Order financial snapshot contract used by order detail, print, and reporting
 * surfaces that need finance truth without re-deriving it client-side.
 */
export interface OrderFinancialSummaryContract {
  orderId: string;
  currencyCode: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  paidAmount: number;
  creditAppliedAmount: number;
  refundedAmount: number;
  adjustmentAmount: number;
  outstandingAmount: number;
}

/**
 * Paginated list contract used by future finance modules in `cmx-api`.
 */
export interface FinancePageContract<TItem> {
  data: TItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
