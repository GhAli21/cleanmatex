import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher } from '@/lib/services/voucher-wiring.service';
import { executeAllocationPreviewTx } from '@/lib/services/customer-receipt-excess-executor.service';
import { getAllocationPreview } from '@/lib/services/customer-receipt-allocation-preview.service';
import { validateAllocationPreview } from '@/lib/services/customer-receipt-allocation-validator.service';
import { resolveReceiptAllocationPolicy } from '@/lib/services/customer-receipt-allocation-policy.service';
import {
  CUSTOMER_RECEIPT_POST_ERRORS,
  CUSTOMER_RECEIPT_PREVIEW_STATUSES,
  RECEIPT_ALLOCATION_WARNING_CODES,
} from '@/lib/types/customer-receipt-allocation';
import {
  SETTLEMENT_MONEY_EPSILON,
  VOUCHER_SOURCE_TYPES,
} from '@/lib/constants/settlement-catalog';
import {
  LINE_ROLE,
  LINE_TYPE,
  PARTY_TYPE,
  TARGET_TYPE,
  VOUCHER_DIRECTION,
  VOUCHER_TYPE,
} from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { CASH_GATE_MODES } from '@/lib/constants/cash-drawer';
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
 * Posts a standalone customer account receipt (CLF W6, ADR-057).
 *
 * One RECEIPT_VOUCHER with one `CUSTOMER_CREDIT_RECEIPT` line carrying the
 * whole tender, posted through `postAndWireBizVoucher` in INTERACTIVE mode —
 * the cash-drawer ledger gate decides the drawer/session for a cash line and
 * refuses when policy requires an open session and none is open. The confirmed
 * allocation preview stays the single writer of the business effects (order
 * payments, AR/B2B allocations, advance/wallet/credit fallback); no wiring
 * handler applies money for this line role, so nothing is applied twice.
 *
 * Everything runs in one transaction: a gate refusal or an allocation failure
 * rolls back the voucher, the line and every allocation.
 * @param tenantId tenant from the authenticated session
 * @param userId acting user
 * @param input validated request
 * @returns the posted voucher id/no
 * @throws Error with a CUSTOMER_RECEIPT_POST_ERRORS / RECEIPT_ALLOCATION_WARNING_CODES code
 * @throws CashDrawerLedgerError when the gate refuses the cash line
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
        throw new Error(CUSTOMER_RECEIPT_POST_ERRORS.METHOD_UNAVAILABLE);
      }

      // Reject incomplete tender details up front with stable codes (the
      // voucher-line validator would otherwise throw untranslatable text).
      const methodCode = method.payment_method_code;
      const isCash = methodCode === PAYMENT_METHODS.CASH;
      if (isCash && input.cashTendered != null && input.cashTendered < input.receiptAmount) {
        throw new Error(CUSTOMER_RECEIPT_POST_ERRORS.CASH_TENDERED_TOO_LOW);
      }
      const bankReference = input.bankReference?.trim() || undefined;
      if (methodCode === PAYMENT_METHODS.BANK_TRANSFER && !bankReference) {
        throw new Error(CUSTOMER_RECEIPT_POST_ERRORS.BANK_REFERENCE_REQUIRED);
      }
      const checkNumber = input.checkNumber?.trim() || undefined;
      const checkBank = input.checkBank?.trim() || undefined;
      if (methodCode === PAYMENT_METHODS.CHECK && (!checkNumber || !checkBank || !input.checkDate)) {
        throw new Error(CUSTOMER_RECEIPT_POST_ERRORS.CHECK_DETAILS_REQUIRED);
      }

      const voucher = await createBizVoucher(
        tenantId,
        {
          voucher_type: VOUCHER_TYPE.RECEIPT,
          direction: VOUCHER_DIRECTION.IN,
          party_type: PARTY_TYPE.CUSTOMER,
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

      // One line for the whole tender. The session id is only a hint — the
      // gate resolves the drawer from it and stamps the session it decides.
      await addVoucherLine(
        tenantId,
        voucher.id,
        {
          line_type: LINE_TYPE.RECEIPT,
          line_role: LINE_ROLE.CUSTOMER_CREDIT_RECEIPT,
          direction: VOUCHER_DIRECTION.IN,
          target_type: TARGET_TYPE.CUSTOMER,
          target_id: input.customerId,
          customer_id: input.customerId,
          branch_id: input.branchId ?? undefined,
          payment_method_code: methodCode,
          org_payment_method_id: method.id,
          // The receipt is taken now: the allocation below books every order
          // payment / stored-value credit as COMPLETED, so the tender line is too.
          payment_status: 'COMPLETED',
          amount: input.receiptAmount,
          currency_code: input.currencyCode,
          cash_drawer_session_id: method.requires_cash_drawer
            ? (input.cashDrawerSessionId ?? undefined)
            : undefined,
          tendered_amount: isCash ? (input.cashTendered ?? input.receiptAmount) : undefined,
          gateway_code: method.gateway_code ?? undefined,
          bank_reference: bankReference,
          check_number: checkNumber,
          check_bank: checkBank,
          check_date: input.checkDate,
          description: 'Customer account receipt',
          idempotency_key: `${input.idempotencyKey}_line`,
        },
        userId,
        undefined,
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
        paymentMethodCode: methodCode,
      });

      await postAndWireBizVoucher(
        tenantId,
        voucher.id,
        userId,
        CASH_GATE_MODES.INTERACTIVE,
        `${input.idempotencyKey}_vch_post`,
        tx
      );

      return {
        voucherId: voucher.id,
        voucherNo: voucher.voucher_no,
        previewId: input.previewId,
        receiptAmount: input.receiptAmount,
      };
    })
  );
}
