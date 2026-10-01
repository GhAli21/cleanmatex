import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher } from '@/lib/services/voucher-wiring.service';
import {
  LINE_ROLE,
  LINE_ROLE_REQUIREMENTS,
  LINE_ROLE_TO_LINE_TYPE,
  LINE_ROLE_TO_DIRECTION,
  PARTY_TYPE,
  TARGET_TYPE,
  VOUCHER_DIRECTION,
  VOUCHER_TYPE,
} from '@/lib/constants/voucher';
import type { LineRole } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { CASH_GATE_MODES, DRAWER_CASH_IN_OUT_ROLES } from '@/lib/constants/cash-drawer';

/** Stable codes for validation failures this service can throw (§4B.2a-A). */
export const CASH_MOVEMENT_ERRORS = {
  ROLE_NOT_ALLOWED: 'CASH_MOVEMENT_ROLE_NOT_ALLOWED',
  DRAWER_NOT_FOUND: 'CASH_MOVEMENT_DRAWER_NOT_FOUND',
  PARTY_NAME_REQUIRED: 'CASH_MOVEMENT_PARTY_NAME_REQUIRED',
  EXPENSE_CATEGORY_REQUIRED: 'CASH_MOVEMENT_EXPENSE_CATEGORY_REQUIRED',
  AMOUNT_MUST_BE_POSITIVE: 'CASH_MOVEMENT_AMOUNT_MUST_BE_POSITIVE',
} as const;

/** Line roles this dialog may post — mirrors DRAWER_CASH_IN_OUT_ROLES exactly. */
export type DrawerCashMovementRole =
  (typeof DRAWER_CASH_IN_OUT_ROLES.OUT)[number] | (typeof DRAWER_CASH_IN_OUT_ROLES.IN)[number];

const TARGET_TYPE_BY_ROLE: Partial<Record<LineRole, string>> = {
  [LINE_ROLE.EXPENSE_PAYMENT]:   TARGET_TYPE.EXPENSE,
  [LINE_ROLE.SUPPLIER_PAYMENT]:  TARGET_TYPE.SUPPLIER,
  [LINE_ROLE.PETTY_CASH_ISSUE]:  TARGET_TYPE.PETTY_CASH,
  [LINE_ROLE.PETTY_CASH_RETURN]: TARGET_TYPE.PETTY_CASH,
  [LINE_ROLE.CASH_PAY_IN]:       TARGET_TYPE.CASH_DRAWER,
};

const PARTY_TYPE_BY_ROLE: Partial<Record<LineRole, string>> = {
  [LINE_ROLE.SUPPLIER_PAYMENT]: PARTY_TYPE.SUPPLIER,
};

export interface PostDrawerCashMovementInput {
  drawerId: string;
  cashDrawerSessionId: string;
  lineRole: DrawerCashMovementRole;
  amount: number;
  reason: string;
  partyName?: string;
  expenseCategoryCode?: string;
  /** Who the petty cash was issued to / returned by (PETTY_CASH_ISSUE / PETTY_CASH_RETURN only) — free text, same convention as the generic voucher line dialog's employee_id. Optional: attribution, not a requirement. */
  employeeId?: string;
  idempotencyKey: string;
}

export interface PostDrawerCashMovementResult {
  voucherId: string;
  voucherNo: string;
}

function assertAllowedRole(lineRole: string): asserts lineRole is DrawerCashMovementRole {
  const allowed: readonly string[] = [
    ...DRAWER_CASH_IN_OUT_ROLES.OUT,
    ...DRAWER_CASH_IN_OUT_ROLES.IN,
  ];
  if (!allowed.includes(lineRole)) {
    throw new Error(CASH_MOVEMENT_ERRORS.ROLE_NOT_ALLOWED);
  }
}

/**
 * Posts a manual drawer "Cash in / Cash out" movement as a finance voucher
 * (CLF W11, §4B.2a-A — replaces the deleted `recordMovement`/`cash-movement`
 * route). One `PAYMENT_VOUCHER` (OUT: expense / supplier / petty-cash issue)
 * or `RECEIPT_VOUCHER` (IN: cash pay-in / petty-cash return) with a single
 * CASH line, posted through `postAndWireBizVoucher` in INTERACTIVE mode — the
 * cash-drawer ledger gate (W1) recognises the line and updates the drawer in
 * the same transaction, refusing when policy requires an open session and
 * `cashDrawerSessionId` is not one.
 * @param tenantId tenant from the authenticated session
 * @param userId acting user
 * @param input validated request
 * @throws Error with a CASH_MOVEMENT_ERRORS code
 * @throws CashDrawerLedgerError when the gate refuses the cash line
 */
export async function postDrawerCashMovement(
  tenantId: string,
  userId: string,
  input: PostDrawerCashMovementInput,
): Promise<PostDrawerCashMovementResult> {
  assertAllowedRole(input.lineRole);
  if (!(input.amount > 0)) {
    throw new Error(CASH_MOVEMENT_ERRORS.AMOUNT_MUST_BE_POSITIVE);
  }

  const direction = LINE_ROLE_TO_DIRECTION[input.lineRole];
  const lineType = LINE_ROLE_TO_LINE_TYPE[input.lineRole];
  const requirements = LINE_ROLE_REQUIREMENTS[input.lineRole];
  const partyName = input.partyName?.trim() || undefined;
  const expenseCategoryCode = input.expenseCategoryCode?.trim() || undefined;
  const employeeId = input.employeeId?.trim() || undefined;

  if (requirements?.requiredFields.includes('party_name') && !partyName) {
    throw new Error(CASH_MOVEMENT_ERRORS.PARTY_NAME_REQUIRED);
  }
  if (requirements?.requiredFields.includes('expense_category_code') && !expenseCategoryCode) {
    throw new Error(CASH_MOVEMENT_ERRORS.EXPENSE_CATEGORY_REQUIRED);
  }

  return withTenantContext(tenantId, () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.org_fin_vouchers_mst.findFirst({
        where: { tenant_org_id: tenantId, idempotency_key: input.idempotencyKey },
        select: { id: true, voucher_no: true },
      });
      if (existing) {
        return { voucherId: existing.id, voucherNo: existing.voucher_no };
      }

      const drawer = await tx.org_cash_drawers_mst.findFirst({
        where: { id: input.drawerId, tenant_org_id: tenantId, is_active: true },
        select: { id: true, branch_id: true, currency_code: true },
      });
      if (!drawer) {
        throw new Error(CASH_MOVEMENT_ERRORS.DRAWER_NOT_FOUND);
      }

      // Best-effort tenant CASH method row — informational only; the gate
      // resolves requires_cash_drawer from payment_method_code regardless.
      const method = await tx.org_payment_methods_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          payment_method_code: PAYMENT_METHODS.CASH,
          is_active: true,
          is_enabled: true,
        },
        select: { id: true },
      });

      const voucherType = direction === VOUCHER_DIRECTION.OUT ? VOUCHER_TYPE.PAYMENT : VOUCHER_TYPE.RECEIPT;

      const voucher = await createBizVoucher(
        tenantId,
        {
          voucher_type: voucherType,
          direction,
          party_type: (PARTY_TYPE_BY_ROLE[input.lineRole] as never) ?? PARTY_TYPE.OTHER,
          party_name: partyName,
          branch_id: drawer.branch_id ?? undefined,
          source_module: 'CASH_DRAWER',
          source_ref_type: 'CASH_DRAWER_MOVEMENT',
          source_ref_id: input.drawerId,
          currency_code: drawer.currency_code,
          total_amount: input.amount,
          idempotency_key: input.idempotencyKey,
          description: input.reason,
        },
        userId,
        tx,
      );

      await addVoucherLine(
        tenantId,
        voucher.id,
        {
          line_type: lineType,
          line_role: input.lineRole,
          direction,
          target_type: (TARGET_TYPE_BY_ROLE[input.lineRole] as never) ?? undefined,
          branch_id: drawer.branch_id ?? undefined,
          payment_method_code: PAYMENT_METHODS.CASH,
          org_payment_method_id: method?.id,
          payment_status: 'COMPLETED',
          amount: input.amount,
          currency_code: drawer.currency_code,
          cash_drawer_session_id: input.cashDrawerSessionId,
          tendered_amount: input.amount,
          party_name: partyName,
          expense_category_code: expenseCategoryCode,
          employee_id: employeeId,
          description: input.reason,
          idempotency_key: `${input.idempotencyKey}_line`,
        },
        userId,
        undefined,
        tx,
      );

      await postAndWireBizVoucher(
        tenantId,
        voucher.id,
        userId,
        CASH_GATE_MODES.INTERACTIVE,
        `${input.idempotencyKey}_vch_post`,
        tx,
      );

      return { voucherId: voucher.id, voucherNo: voucher.voucher_no };
    }),
  );
}
