import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { executeAllocationPreviewTx } from '@/lib/services/customer-receipt-excess-executor.service';
import { getAllocationPreview } from '@/lib/services/customer-receipt-allocation-preview.service';
import { validateAllocationPreview } from '@/lib/services/customer-receipt-allocation-validator.service';
import { resolveReceiptAllocationPolicy } from '@/lib/services/customer-receipt-allocation-policy.service';
import {
  CUSTOMER_RECEIPT_PREVIEW_STATUSES,
  RECEIPT_ALLOCATION_WARNING_CODES,
} from '@/lib/types/customer-receipt-allocation';
import {
  SETTLEMENT_MONEY_EPSILON,
  VOUCHER_SOURCE_TYPES,
} from '@/lib/constants/settlement-catalog';
import { VOUCHER_TYPE, VOUCHER_STATUS } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { PostCustomerReceiptRequest } from '@/lib/validations/customer-receipt-allocation-schema';

/**
 *
 */
export interface PostCustomerReceiptResult {
  voucherId: string;
  voucherNo: string;
  previewId: string;
  receiptAmount: number;
}

/**
 * Posts a standalone customer account receipt: creates audit voucher, applies
 * confirmed allocation preview, and records cash drawer ingress when applicable.
 * @param tenantId
 * @param userId
 * @param input
 */
export async function postCustomerAccountReceipt(
  tenantId: string,
  userId: string,
  input: PostCustomerReceiptRequest
): Promise<PostCustomerReceiptResult> {
  return withTenantContext(tenantId, () =>
    prisma.$transaction(async (tx) => {
      const existingVoucher = await tx.org_fin_vouchers_mst.findFirst({
        where: { tenant_org_id: tenantId, idempotency_key: input.idempotencyKey },
        select: { id: true, voucher_no: true },
      });
      if (existingVoucher) {
        return {
          voucherId: existingVoucher.id,
          voucherNo: existingVoucher.voucher_no,
          previewId: input.previewId,
          receiptAmount: input.receiptAmount,
        };
      }

      const preview = await getAllocationPreview(tenantId, input.previewId);
      if (!preview) {
        throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.POLICY_MISSING);
      }
      if (preview.previewStatus === CUSTOMER_RECEIPT_PREVIEW_STATUSES.POSTED) {
        throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.IDEMPOTENCY_CONFLICT);
      }
      if (preview.previewStatus !== CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED) {
        throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.BLOCKED);
      }
      if (Math.abs(preview.receiptAmount - input.receiptAmount) > SETTLEMENT_MONEY_EPSILON) {
        throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.UNBALANCED);
      }
      if (preview.remainingUnallocatedAmount > SETTLEMENT_MONEY_EPSILON) {
        throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.EXCESS_UNRESOLVED);
      }

      const policy = await resolveReceiptAllocationPolicy({
        tenantId,
        branchId: input.branchId ?? null,
      });
      validateAllocationPreview({
        tenantId,
        customerId: input.customerId,
        currencyCode: input.currencyCode,
        preview,
        policy,
        requireConfirmed: true,
      });

      const method = await tx.org_payment_methods_cf.findFirst({
        where: {
          id: input.paymentMethodId,
          tenant_org_id: tenantId,
          is_active: true,
          is_enabled: true,
        },
        select: {
          id: true,
          payment_method_code: true,
          requires_cash_drawer: true,
          gateway_code: true,
        },
      });
      if (!method) {
        throw new Error('Selected payment method is not available');
      }

      const isCash = method.payment_method_code === PAYMENT_METHODS.CASH;
      if (isCash && input.cashTendered != null && input.cashTendered < input.receiptAmount) {
        throw new Error('CASH_TENDERED_LESS_THAN_AMOUNT');
      }

      const voucher = await createBizVoucher(
        tenantId,
        {
          voucher_type: VOUCHER_TYPE.RECEIPT,
          direction: 'IN',
          party_type: 'CUSTOMER',
          customer_id: input.customerId,
          branch_id: input.branchId ?? undefined,
          source_module: 'CUSTOMERS',
          source_ref_type: VOUCHER_SOURCE_TYPES.CUSTOMER_ACCOUNT_PAYMENT,
          source_ref_id: input.previewId,
          currency_code: input.currencyCode,
          total_amount: input.receiptAmount,
          idempotency_key: input.idempotencyKey,
          description: 'Customer account receipt',
        },
        userId,
        tx
      );

      await executeAllocationPreviewTx({
        tx,
        tenantId,
        userId,
        customerId: input.customerId,
        sourceOrderId: voucher.id,
        currencyCode: input.currencyCode,
        voucherId: voucher.id,
        previewId: input.previewId,
        idempotencyKey: input.idempotencyKey,
        paymentMethodCode: method.payment_method_code,
      });

      if (isCash && method.requires_cash_drawer) {
        if (!input.cashDrawerSessionId) {
          throw new Error('CASH_DRAWER_SESSION_REQUIRED');
        }
        const session = await tx.org_cash_drawer_sessions_mst.findFirst({
          where: {
            id: input.cashDrawerSessionId,
            tenant_org_id: tenantId,
            status: 'OPEN',
          },
          select: { id: true, cash_drawer_id: true, branch_id: true, currency_code: true },
        });
        if (!session) {
          throw new Error('CASH_DRAWER_SESSION_REQUIRED');
        }
        await tx.org_cash_drawer_movements_dtl.create({
          data: {
            tenant_org_id: tenantId,
            branch_id: session.branch_id ?? input.branchId ?? null,
            cash_drawer_id: session.cash_drawer_id,
            cash_drawer_session_id: session.id,
            movement_type: 'CASH_SALE',
            direction: 'IN',
            amount: input.receiptAmount,
            currency_code: input.currencyCode ?? session.currency_code,
            fin_voucher_id: voucher.id,
            performed_by: userId,
            performed_at: new Date(),
            is_active: true,
            rec_status: 1,
            created_by: userId,
          },
        });

        const change =
          input.cashTendered != null && input.cashTendered > input.receiptAmount
            ? input.cashTendered - input.receiptAmount
            : 0;
        if (change > SETTLEMENT_MONEY_EPSILON) {
          await tx.org_cash_drawer_movements_dtl.create({
            data: {
              tenant_org_id: tenantId,
              branch_id: session.branch_id ?? input.branchId ?? null,
              cash_drawer_id: session.cash_drawer_id,
              cash_drawer_session_id: session.id,
              movement_type: 'CASH_OUT',
              direction: 'OUT',
              amount: change,
              currency_code: input.currencyCode ?? session.currency_code,
              fin_voucher_id: voucher.id,
              performed_by: userId,
              performed_at: new Date(),
              is_active: true,
              rec_status: 1,
              created_by: userId,
            },
          });
        }
      }

      await tx.org_fin_vouchers_mst.updateMany({
        where: { id: voucher.id, tenant_org_id: tenantId },
        data: {
          voucher_status: VOUCHER_STATUS.POSTED,
          posting_status: 'POSTED',
          paid_amount: input.receiptAmount,
          outstanding_amount: 0,
          posted_at: new Date(),
          posted_by: userId,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      return {
        voucherId: voucher.id,
        voucherNo: voucher.voucher_no,
        previewId: input.previewId,
        receiptAmount: input.receiptAmount,
      };
    })
  );
}
