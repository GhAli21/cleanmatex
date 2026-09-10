import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { ACTIVE_ORDER_STATUS_CODES } from '@/lib/constants/order-types';

export interface OrderRackBagsFields {
  rackLocation: string;
  lockerLocation: string;
  lockerCode: string;
  bagCount: number;
  hangingCount: number;
  customerId: string | null;
}

export interface CustomerOtherRackedOrdersSummary {
  hasOtherRackedOrders: boolean;
  rackCount: number;
  totalBags: number;
  totalHanging: number;
  orderNos: string[];
}

const EMPTY_CUSTOMER_RACK_WARNING: CustomerOtherRackedOrdersSummary = {
  hasOtherRackedOrders: false,
  rackCount: 0,
  totalBags: 0,
  totalHanging: 0,
  orderNos: [],
};

/** Tenant-scoped read of the current rack/locker/bag/hanging fields for one order. */
export async function getOrderRackBagsFields(input: {
  tenantId: string;
  orderId: string;
}): Promise<OrderRackBagsFields | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('org_orders_mst')
    .select('rack_location, locker_location, locker_code, bag_count, hanging_count, customer_id')
    .eq('id', input.orderId)
    .eq('tenant_org_id', input.tenantId)
    .single();

  if (error || !data) return null;

  return {
    rackLocation: data.rack_location?.trim() ?? '',
    lockerLocation: data.locker_location?.trim() ?? '',
    lockerCode: data.locker_code?.trim() ?? '',
    bagCount: data.bag_count ?? 1,
    hangingCount: data.hanging_count ?? 0,
    customerId: data.customer_id ?? null,
  };
}

/**
 * Summarizes this customer's *other* active orders that already have a
 * rack or locker assigned, so staff can spot a conflict before assigning
 * a new one. Tenant + customer scoped; excludes the current order and any
 * order in a terminal status.
 */
export async function getCustomerOtherRackedOrdersSummary(input: {
  tenantId: string;
  customerId: string | null;
  excludeOrderId: string;
}): Promise<CustomerOtherRackedOrdersSummary> {
  if (!input.customerId) return { ...EMPTY_CUSTOMER_RACK_WARNING };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('org_orders_mst')
    .select('id, order_no, rack_location, locker_location, bag_count, hanging_count')
    .eq('tenant_org_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .neq('id', input.excludeOrderId)
    .in('current_status', ACTIVE_ORDER_STATUS_CODES)
    .or('rack_location.not.is.null,locker_location.not.is.null');

  if (error || !data || data.length === 0) return { ...EMPTY_CUSTOMER_RACK_WARNING };

  const racked = data.filter((row) => row.rack_location?.trim() || row.locker_location?.trim());
  if (racked.length === 0) return { ...EMPTY_CUSTOMER_RACK_WARNING };

  const totalBags = racked.reduce((sum, row) => sum + (row.bag_count ?? 0), 0);
  const totalHanging = racked.reduce((sum, row) => sum + (row.hanging_count ?? 0), 0);

  return {
    hasOtherRackedOrders: true,
    rackCount: racked.length,
    totalBags,
    totalHanging,
    orderNos: racked.map((row) => row.order_no).filter(Boolean) as string[],
  };
}
