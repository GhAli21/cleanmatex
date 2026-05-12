/**
 * Normalizes `GET /api/v1/orders/[id]/state` JSON: some callers used `data.order` while the route returns `order` at top level.
 */
export function getOrderFromStateResponse(json: {
  success?: boolean;
  data?: { order?: unknown };
  order?: unknown;
}): unknown | null {
  if (!json.success) return null;
  return json.data?.order ?? json.order ?? null;
}

/** Customer display fields from `org_orders_mst` row + `org_customers_mst` join on state payload. */
export function mapOrderCustomerFromStateRow(raw: Record<string, unknown>): {
  name: string;
  phone: string;
} {
  const orgCustomer = raw.org_customers_mst as
    | { name?: string; phone?: string; sys_customers_mst?: { name?: string; phone?: string } }
    | undefined;
  const sysCustomer = orgCustomer?.sys_customers_mst;
  const customerData = sysCustomer || orgCustomer;
  return {
    name: customerData?.name || 'Unknown Customer',
    phone: customerData?.phone || 'N/A',
  };
}
