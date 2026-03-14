/**
 * Credit Limit Service
 * Check B2B customer credit limit before order creation
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';

export interface CreditLimitResult {
  allowed: boolean;
  currentBalance: number;
  creditLimit: number;
  available: number;
  orderTotal: number;
  wouldExceed: boolean;
  /** When true, customer is on credit hold (dunning) - block new orders */
  isCreditHold?: boolean;
}

export async function checkCreditLimit(
  customerId: string,
  additionalAmount: number
): Promise<CreditLimitResult> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data: customer, error: custError } = await supabase
    .from('org_customers_mst')
    .select('id, type, credit_limit, is_credit_hold')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .single();

  if (custError || !customer) {
    logger.warn('Customer not found for credit check', {
      feature: 'b2b',
      action: 'checkCreditLimit',
      customerId,
    });
    return {
      allowed: true,
      currentBalance: 0,
      creditLimit: 0,
      available: 0,
      orderTotal: additionalAmount,
      wouldExceed: false,
    };
  }

  const isB2B = customer.type === 'b2b' || customer.type === 'B2B';
  const creditLimit = Number(customer.credit_limit) ?? 0;
  const isCreditHold = Boolean(customer.is_credit_hold);

  if (isB2B && isCreditHold) {
    return {
      allowed: false,
      currentBalance: 0,
      creditLimit,
      available: 0,
      orderTotal: additionalAmount,
      wouldExceed: true,
      isCreditHold: true,
    };
  }

  if (!isB2B || creditLimit <= 0) {
    return {
      allowed: true,
      currentBalance: 0,
      creditLimit: 0,
      available: 0,
      orderTotal: additionalAmount,
      wouldExceed: false,
    };
  }

  const { data: invoices } = await supabase
    .from('org_invoice_mst')
    .select('total, paid_amount')
    .eq('tenant_org_id', tenantId)
    .eq('customer_id', customerId)
    .in('status', ['pending', 'partial', 'issued']);

  const currentBalance =
    invoices?.reduce((sum, inv) => {
      const total = Number(inv.total) ?? 0;
      const paid = Number(inv.paid_amount) ?? 0;
      return sum + (total - paid);
    }, 0) ?? 0;

  const available = Math.max(0, creditLimit - currentBalance);
  const wouldExceed = currentBalance + additionalAmount > creditLimit;

  return {
    allowed: !wouldExceed,
    currentBalance,
    creditLimit,
    available,
    orderTotal: additionalAmount,
    wouldExceed,
  };
}
