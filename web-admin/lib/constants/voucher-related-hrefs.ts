/** Dashboard hrefs for voucher related records. Keep in sync with App Router paths. */
export const VOUCHER_RELATED_HREFS = {
  order: (orderId: string) => `/dashboard/orders/${orderId}/full`,
  customer: (customerId: string) => `/dashboard/customers/${customerId}`,
  invoice: (invoiceId: string) => `/dashboard/internal_fin/invoices/${invoiceId}`,
  voucher: (voucherId: string) => `/dashboard/internal_fin/vouchers/${voucherId}`,
  branch: (branchId: string) => `/dashboard/settings/branches/${branchId}`,
  cashDrawerSession: (drawerId: string, sessionId: string) =>
    `/dashboard/internal_fin/cash-drawers/${drawerId}/session/${sessionId}`,
  storedValue: '/dashboard/customers/stored-value',
  vouchersList: '/dashboard/internal_fin/vouchers',
} as const
