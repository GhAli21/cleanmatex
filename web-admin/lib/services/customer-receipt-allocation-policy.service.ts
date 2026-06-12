import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS,
  DEFAULT_RECEIPT_ALLOCATION_POLICY_CODE,
} from '@/lib/constants/settlement-catalog';
import { RECEIPT_ALLOCATION_WARNING_CODES } from '@/lib/types/customer-receipt-allocation';
import type { ReceiptAllocationPolicySnapshot } from '@/lib/types/customer-receipt-allocation';

export interface ReceiptAllocationPolicyRow {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  policy_code: string;
  allocation_mode: string;
  fallback_destination: string;
  include_ar_invoices: boolean;
  include_b2b_statements: boolean;
  include_pay_on_collection_orders: boolean;
  include_open_order_balances: boolean;
  priority_ar_invoices: number;
  priority_b2b_statements: number;
  priority_pay_on_collection_orders: number;
  priority_open_order_balances: number;
  allow_partial_last_target: boolean;
  require_same_currency: boolean;
  allow_cross_branch_allocation: boolean;
  require_confirmation_before_posting: boolean;
  max_targets_per_allocation: number;
}

export interface ResolvePolicyParams {
  tenantId: string;
  branchId?: string | null;
  policyCode?: string | null;
}

function mapPolicyRow(row: ReceiptAllocationPolicyRow): ReceiptAllocationPolicySnapshot {
  return {
    policyId: row.id,
    policyCode: row.policy_code,
    allocationMode: row.allocation_mode as ReceiptAllocationPolicySnapshot['allocationMode'],
    fallbackDestination:
      row.fallback_destination as ReceiptAllocationPolicySnapshot['fallbackDestination'],
    requireConfirmationBeforePosting: row.require_confirmation_before_posting,
    allowPartialLastTarget: row.allow_partial_last_target,
    requireSameCurrency: row.require_same_currency,
  };
}

/**
 * Resolves effective receipt allocation policy: branch-specific → tenant default.
 */
export async function resolveReceiptAllocationPolicy(
  params: ResolvePolicyParams
): Promise<ReceiptAllocationPolicyRow> {
  const { tenantId, branchId, policyCode } = params;

  if (policyCode) {
    const explicit = await prisma.$queryRaw<ReceiptAllocationPolicyRow[]>`
      SELECT *
      FROM org_fin_rcpt_alloc_policy_cf
      WHERE tenant_org_id = ${tenantId}::uuid
        AND policy_code = ${policyCode}
        AND is_active = true
        AND rec_status = 1
        AND (branch_id IS NULL OR branch_id = ${branchId ?? null}::uuid)
      ORDER BY branch_id NULLS LAST
      LIMIT 1
    `;
    if (explicit[0]) return explicit[0];
  }

  if (branchId) {
    const branchPolicy = await prisma.$queryRaw<ReceiptAllocationPolicyRow[]>`
      SELECT *
      FROM org_fin_rcpt_alloc_policy_cf
      WHERE tenant_org_id = ${tenantId}::uuid
        AND branch_id = ${branchId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `;
    if (branchPolicy[0]) return branchPolicy[0];
  }

  const tenantDefault = await prisma.$queryRaw<ReceiptAllocationPolicyRow[]>`
    SELECT *
    FROM org_fin_rcpt_alloc_policy_cf
    WHERE tenant_org_id = ${tenantId}::uuid
      AND branch_id IS NULL
      AND is_active = true
      AND rec_status = 1
    ORDER BY is_default DESC, policy_code = ${DEFAULT_RECEIPT_ALLOCATION_POLICY_CODE} DESC, created_at ASC
    LIMIT 1
  `;

  if (tenantDefault[0]) return tenantDefault[0];

  throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.POLICY_MISSING);
}

export async function getReceiptAllocationPolicySnapshot(
  params: ResolvePolicyParams
): Promise<ReceiptAllocationPolicySnapshot> {
  const row = await resolveReceiptAllocationPolicy(params);
  return mapPolicyRow(row);
}

export function buildFallbackAllocationLine(
  fallbackDestination: string,
  amount: number,
  customerId: string
): {
  lineRole: string;
  targetType: string;
  targetId: string;
  allocationAmount: number;
  isPartial: boolean;
} | null {
  if (amount <= 0.001) return null;

  switch (fallbackDestination) {
    case CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS.CUSTOMER_ADVANCE:
      return {
        lineRole: 'CUSTOMER_ADVANCE_RECEIPT',
        targetType: 'CUSTOMER_ADVANCE',
        targetId: customerId,
        allocationAmount: amount,
        isPartial: false,
      };
    case CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS.CUSTOMER_CREDIT:
      return {
        lineRole: 'CUSTOMER_CREDIT_ISSUE',
        targetType: 'CUSTOMER_CREDIT',
        targetId: customerId,
        allocationAmount: amount,
        isPartial: false,
      };
    case CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS.WALLET_TOPUP:
      return {
        lineRole: 'WALLET_TOPUP',
        targetType: 'WALLET_TOPUP',
        targetId: customerId,
        allocationAmount: amount,
        isPartial: false,
      };
    case CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS.BLOCK_AND_REQUIRE_MANUAL_ACTION:
      return null;
    default:
      return {
        lineRole: 'CUSTOMER_ADVANCE_RECEIPT',
        targetType: 'CUSTOMER_ADVANCE',
        targetId: customerId,
        allocationAmount: amount,
        isPartial: false,
      };
  }
}
