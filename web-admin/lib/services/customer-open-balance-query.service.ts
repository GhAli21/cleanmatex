import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  AR_INVOICE_STATUSES,
  isArInvoiceOpenBalanceStatus,
} from '@/lib/constants/ar-invoice';
import type { OpenBalanceTarget } from '@/lib/types/customer-receipt-allocation';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
} from '@/lib/types/customer-receipt-allocation';
import { STATEMENT_STATUSES } from '@/lib/constants/b2b';
import type { ReceiptAllocationPolicyRow } from '@/lib/services/customer-receipt-allocation-policy.service';

export interface LoadOpenBalanceTargetsParams {
  tenantId: string;
  customerId: string;
  currencyCode: string;
  policy: ReceiptAllocationPolicyRow;
  excludeOrderId?: string | null;
  branchId?: string | null;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}

/**
 * Loads eligible open-balance targets for customer receipt allocation.
 * AR invoice wins over linked order per feature pack §3.
 */
export async function loadCustomerOpenBalanceTargets(
  params: LoadOpenBalanceTargetsParams
): Promise<OpenBalanceTarget[]> {
  const { tenantId, customerId, currencyCode, policy, excludeOrderId, branchId } = params;
  const targets: OpenBalanceTarget[] = [];

  if (policy.include_ar_invoices) {
    const invoices = await prisma.org_invoice_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        customer_id: customerId,
        is_active: true,
        rec_status: 1,
        status: {
          in: [
            AR_INVOICE_STATUSES.OPEN,
            AR_INVOICE_STATUSES.PARTIALLY_PAID,
            AR_INVOICE_STATUSES.OVERDUE,
            AR_INVOICE_STATUSES.DISPUTED,
          ],
        },
      },
      select: {
        id: true,
        invoice_no: true,
        invoice_date: true,
        due_date: true,
        outstanding_amount: true,
        total: true,
        paid_amount: true,
        currency_code: true,
        branch_id: true,
        status: true,
      },
      orderBy: [{ due_date: 'asc' }, { invoice_date: 'asc' }, { invoice_no: 'asc' }],
    });

    for (const invoice of invoices) {
      if (!isArInvoiceOpenBalanceStatus(invoice.status ?? AR_INVOICE_STATUSES.OPEN)) continue;
      const outstanding =
        toNumber(invoice.outstanding_amount) ||
        Math.max(0, toNumber(invoice.total) - toNumber(invoice.paid_amount));
      if (outstanding <= 0.001) continue;
      if (policy.require_same_currency && invoice.currency_code !== currencyCode) continue;
      if (!policy.allow_cross_branch_allocation && branchId && invoice.branch_id && invoice.branch_id !== branchId) {
        continue;
      }

      targets.push({
        targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE,
        targetId: invoice.id,
        documentNo: invoice.invoice_no,
        documentDate: invoice.invoice_date?.toISOString().slice(0, 10) ?? null,
        dueDate: invoice.due_date?.toISOString().slice(0, 10) ?? null,
        outstandingAmount: outstanding,
        currencyCode: invoice.currency_code,
        lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.INVOICE_PAYMENT,
        priority: policy.priority_ar_invoices,
        branchId: invoice.branch_id,
      });
    }
  }

  const orderIdsWithOpenInvoice = new Set<string>();
  if (policy.include_ar_invoices) {
    const linked = await prisma.org_invoice_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        customer_id: customerId,
        order_id: { not: null },
        is_active: true,
        rec_status: 1,
        status: {
          in: [
            AR_INVOICE_STATUSES.OPEN,
            AR_INVOICE_STATUSES.PARTIALLY_PAID,
            AR_INVOICE_STATUSES.OVERDUE,
            AR_INVOICE_STATUSES.DISPUTED,
          ],
        },
      },
      select: { order_id: true, outstanding_amount: true, total: true, paid_amount: true },
    });
    for (const row of linked) {
      if (!row.order_id) continue;
      const outstanding =
        toNumber(row.outstanding_amount) ||
        Math.max(0, toNumber(row.total) - toNumber(row.paid_amount));
      if (outstanding > 0.001) {
        orderIdsWithOpenInvoice.add(row.order_id);
      }
    }
  }

  if (policy.include_open_order_balances || policy.include_pay_on_collection_orders) {
    const orders = await prisma.org_orders_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        customer_id: customerId,
        rec_status: 1,
        outstanding_amount: { gt: 0 },
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      },
      select: {
        id: true,
        order_no: true,
        created_at: true,
        payment_due_date: true,
        outstanding_amount: true,
        currency_code: true,
        branch_id: true,
        payment_type_code: true,
        cancelled_at: true,
      },
      orderBy: [{ payment_due_date: 'asc' }, { created_at: 'asc' }, { order_no: 'asc' }],
    });

    for (const order of orders) {
      if (order.cancelled_at) continue;
      if (orderIdsWithOpenInvoice.has(order.id)) continue;
      const outstanding = toNumber(order.outstanding_amount);
      if (outstanding <= 0.001) continue;
      const orderCurrency = order.currency_code ?? currencyCode;
      if (policy.require_same_currency && orderCurrency !== currencyCode) continue;
      if (!policy.allow_cross_branch_allocation && branchId && order.branch_id && order.branch_id !== branchId) {
        continue;
      }

      const isPayOnCollection = order.payment_type_code === 'PAY_ON_COLLECTION';
      if (isPayOnCollection && !policy.include_pay_on_collection_orders) continue;
      if (!isPayOnCollection && !policy.include_open_order_balances) continue;

      targets.push({
        targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER,
        targetId: order.id,
        documentNo: order.order_no,
        documentDate: order.created_at?.toISOString().slice(0, 10) ?? null,
        dueDate: order.payment_due_date?.toISOString().slice(0, 10) ?? null,
        outstandingAmount: outstanding,
        currencyCode: orderCurrency,
        lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.ORDER_PAYMENT,
        priority: isPayOnCollection
          ? policy.priority_pay_on_collection_orders
          : policy.priority_open_order_balances,
        branchId: order.branch_id,
      });
    }
  }

  if (policy.include_b2b_statements) {
    const statements = await prisma.$queryRaw<
      Array<{
        id: string;
        statement_no: string;
        period_to: Date | null;
        due_date: Date | null;
        balance_amount: number;
        currency_cd: string | null;
      }>
    >`
      SELECT
        s.id,
        s.statement_no,
        s.period_to,
        s.due_date,
        COALESCE(s.balance_amount, 0)::float8 AS balance_amount,
        s.currency_cd
      FROM org_b2b_statements_mst s
      WHERE s.tenant_org_id = ${tenantId}::uuid
        AND s.customer_id = ${customerId}::uuid
        AND COALESCE(s.is_active, true) = true
        AND COALESCE(s.rec_status, 1) = 1
        AND COALESCE(s.balance_amount, 0) > 0
        AND s.status_cd IN (${STATEMENT_STATUSES.ISSUED}, ${STATEMENT_STATUSES.PARTIAL}, ${STATEMENT_STATUSES.OVERDUE})
      ORDER BY s.due_date ASC NULLS LAST, s.period_to ASC NULLS LAST, s.statement_no ASC
    `;

    for (const statement of statements) {
      if (statement.balance_amount <= 0.001) continue;
      const statementCurrency = statement.currency_cd ?? currencyCode;
      if (policy.require_same_currency && statementCurrency !== currencyCode) continue;

      targets.push({
        targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.B2B_STATEMENT,
        targetId: statement.id,
        documentNo: statement.statement_no,
        documentDate: statement.period_to?.toISOString().slice(0, 10) ?? null,
        dueDate: statement.due_date?.toISOString().slice(0, 10) ?? null,
        outstandingAmount: statement.balance_amount,
        currencyCode: statementCurrency,
        lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.STATEMENT_PAYMENT,
        priority: policy.priority_b2b_statements,
        branchId: null,
      });
    }
  }

  return targets;
}

export async function listCustomerOpenBalancesForApi(
  tenantId: string,
  customerId: string,
  options: { branchId?: string; currencyCode?: string; excludeOrderId?: string } = {}
): Promise<OpenBalanceTarget[]> {
  const { resolveReceiptAllocationPolicy } = await import(
    '@/lib/services/customer-receipt-allocation-policy.service'
  );
  const policy = await resolveReceiptAllocationPolicy({
    tenantId,
    branchId: options.branchId,
  });
  const currencyCode = options.currencyCode ?? 'OMR';

  return loadCustomerOpenBalanceTargets({
    tenantId,
    customerId,
    currencyCode,
    policy,
    excludeOrderId: options.excludeOrderId,
    branchId: options.branchId,
  });
}
