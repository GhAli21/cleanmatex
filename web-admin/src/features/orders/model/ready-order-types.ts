export interface PaymentSummary {
  status: string;
  total: number;
  paid: number;
  remaining: number;
}

/** One invoice for an order (for payment target selection when order has many invoices) */
export interface ReadyOrderInvoice {
  id: string;
  invoiceNo: string | null;
  total: number;
  paidAmount: number;
  remaining: number;
}

export interface ReadyOrderItem {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
}

export interface ReadyOrderCustomer {
  name: string;
  phone: string;
}

export interface ReadyOrder {
  id: string;
  orderNo: string;
  customer: ReadyOrderCustomer;
  items: ReadyOrderItem[];
  total: number;
  rackLocation: string;
  readyBy: string;
  paymentSummary?: PaymentSummary;
  primaryInvoiceId?: string | null;
  /** All order invoices (for choosing which invoice to pay when many) */
  invoices?: ReadyOrderInvoice[];
}

export interface ReadyOrderStateResponse {
  success: boolean;
  order?: any;
  items?: any[];
  paymentSummary?: PaymentSummary;
  primaryInvoiceId?: string | null;
  invoices?: Array<{
    id: string;
    invoice_no: string | null;
    total: number;
    paid_amount: number;
    remaining: number;
  }>;
  error?: string;
}

/**
 * Map the `/api/v1/orders/{orderId}/state` response into a `ReadyOrder`.
 *
 * This keeps the mapping logic shared between the Ready detail screen
 * and any print-preview screens.
 */
export function mapReadyOrderFromStateResponse(
  response: ReadyOrderStateResponse,
): ReadyOrder | null {
  if (!response.success || !response.order) {
    return null;
  }

  const raw: any = response.order;
  const cust = raw.org_customers_mst || raw.customer;
  const sysCust = cust?.sys_customers_mst;

  const customer: ReadyOrderCustomer = {
    name: sysCust?.name || cust?.name || 'Unknown Customer',
    phone: sysCust?.phone || cust?.phone || '',
  };

  const items: ReadyOrderItem[] = (response.items || []).map((it: any) => ({
    id: String(it.id),
    productName: it.product_name || it.org_product_data_mst?.product_name || 'Item',
    quantity: Number(it.quantity ?? 0),
    totalPrice: Number(it.total_price ?? 0),
  }));

  const totalVal = Number(raw.total ?? raw.total_amount ?? 0);

  const fallbackSummary: PaymentSummary = {
    status: raw.payment_status || 'pending',
    total: totalVal,
    paid: Number(raw.paid_amount ?? 0),
    remaining: Math.max(0, totalVal - Number(raw.paid_amount ?? 0)),
  };

  const invoices: ReadyOrderInvoice[] = (response.invoices ?? []).map((inv: any) => ({
    id: String(inv.id),
    invoiceNo: inv.invoice_no ?? null,
    total: Number(inv.total ?? 0),
    paidAmount: Number(inv.paid_amount ?? 0),
    remaining: Number(inv.remaining ?? 0),
  }));

  return {
    id: String(raw.id),
    orderNo: raw.order_no || '',
    customer,
    items,
    total: totalVal,
    rackLocation: raw.rack_location || '',
    readyBy: raw.ready_by || raw.ready_by_at_new || '',
    paymentSummary: response.paymentSummary ?? fallbackSummary,
    primaryInvoiceId: response.primaryInvoiceId ?? null,
    invoices,
  };
}

