import { validateAllocationPreview } from '@/lib/services/customer-receipt-allocation-validator.service';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
  CUSTOMER_RECEIPT_PREVIEW_STATUSES,
  RECEIPT_ALLOCATION_WARNING_CODES,
} from '@/lib/types/customer-receipt-allocation';
import type { ReceiptAllocationPolicyRow } from '@/lib/services/customer-receipt-allocation-policy.service';

const basePolicy: ReceiptAllocationPolicyRow = {
  id: 'policy-1',
  tenant_org_id: 'tenant-1',
  branch_id: null,
  policy_code: 'DEFAULT',
  allocation_mode: 'AUTO_OLDEST_DUE',
  fallback_destination: 'CUSTOMER_ADVANCE',
  include_ar_invoices: true,
  include_b2b_statements: true,
  include_pay_on_collection_orders: true,
  include_open_order_balances: true,
  priority_ar_invoices: 1,
  priority_b2b_statements: 2,
  priority_pay_on_collection_orders: 3,
  priority_open_order_balances: 4,
  allow_partial_last_target: true,
  require_same_currency: true,
  allow_cross_branch_allocation: false,
  require_confirmation_before_posting: true,
  max_targets_per_allocation: 50,
};

describe('customer-receipt-allocation-validator.service', () => {
  it('rejects draft preview when confirmation is required', () => {
    expect(() =>
      validateAllocationPreview({
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        currencyCode: 'OMR',
        policy: basePolicy,
        preview: {
          previewId: 'prev-1',
          previewStatus: CUSTOMER_RECEIPT_PREVIEW_STATUSES.DRAFT,
          receiptAmount: 10,
          currentOrderAllocationAmount: 0,
          excessAmount: 10,
          remainingUnallocatedAmount: 0,
          allocations: [
            {
              lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.CUSTOMER_ADVANCE_RECEIPT,
              targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_ADVANCE,
              targetId: 'cust-1',
              allocationAmount: 10,
              isPartial: false,
            },
          ],
          fallbackAllocation: null,
          warnings: [],
        },
      })
    ).toThrow(RECEIPT_ALLOCATION_WARNING_CODES.BLOCKED);
  });

  it('accepts confirmed preview with balanced allocations', () => {
    expect(() =>
      validateAllocationPreview({
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        currencyCode: 'OMR',
        policy: basePolicy,
        preview: {
          previewId: 'prev-1',
          previewStatus: CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED,
          receiptAmount: 25,
          currentOrderAllocationAmount: 0,
          excessAmount: 25,
          remainingUnallocatedAmount: 0,
          allocations: [
            {
              lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.INVOICE_PAYMENT,
              targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE,
              targetId: '11111111-1111-1111-1111-111111111111',
              allocationAmount: 25,
              isPartial: false,
            },
          ],
          fallbackAllocation: null,
          warnings: [],
        },
      })
    ).not.toThrow();
  });

  it('rejects invoice role with order target mismatch', () => {
    expect(() =>
      validateAllocationPreview({
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        currencyCode: 'OMR',
        policy: basePolicy,
        requireConfirmed: false,
        preview: {
          previewId: 'prev-1',
          previewStatus: CUSTOMER_RECEIPT_PREVIEW_STATUSES.DRAFT,
          receiptAmount: 10,
          currentOrderAllocationAmount: 0,
          excessAmount: 10,
          remainingUnallocatedAmount: 0,
          allocations: [
            {
              lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.INVOICE_PAYMENT,
              targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER,
              targetId: '11111111-1111-1111-1111-111111111111',
              allocationAmount: 10,
              isPartial: false,
            },
          ],
          fallbackAllocation: null,
          warnings: [],
        },
      })
    ).toThrow(RECEIPT_ALLOCATION_WARNING_CODES.UNBALANCED);
  });
});
