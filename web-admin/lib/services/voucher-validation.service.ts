/**
 * BVM Voucher Validation Service
 * All business-rule validation for vouchers and lines.
 * Pure functions — no DB writes. Throws on violation.
 */

import {
  VOUCHER_STATUS,
  VOUCHER_TYPE,
  LINE_ROLE_REQUIREMENTS,
  CASHIER_ALLOWED_VOUCHER_TYPES,
  CASHIER_ALLOWED_LINE_ROLES,
} from '../constants/voucher';
import type { VoucherStatus, VoucherType, LineRole } from '../types/voucher';
import type { CreateVoucherLineInput } from '../types/voucher';

// ── Status transition table ───────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [VOUCHER_STATUS.DRAFT]:    [VOUCHER_STATUS.POSTED, VOUCHER_STATUS.CANCELLED],
  [VOUCHER_STATUS.POSTED]:   [VOUCHER_STATUS.REVERSED, VOUCHER_STATUS.PARTIALLY_REVERSED],
  [VOUCHER_STATUS.CANCELLED]:           [],
  [VOUCHER_STATUS.REVERSED]:            [],
  [VOUCHER_STATUS.PARTIALLY_REVERSED]:  [VOUCHER_STATUS.REVERSED],
};

// ── Exported validators ───────────────────────────────────────────────────────

/**
 * Assert that a voucher status transition is valid.
 * Throws if the transition is not permitted.
 */
export function validateStatusTransition(current: VoucherStatus, next: VoucherStatus): void {
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(
      `Invalid voucher status transition: ${current} → ${next}. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }
}

/**
 * Assert that a voucher in current status can be mutated (DRAFT only).
 * Throws for any other status.
 */
export function assertVoucherIsMutable(voucherStatus: VoucherStatus, context = 'edit'): void {
  if (voucherStatus !== VOUCHER_STATUS.DRAFT) {
    throw new Error(
      `Cannot ${context} a voucher with status ${voucherStatus}. Only DRAFT vouchers may be modified.`
    );
  }
}

/**
 * Validate that the user's role permits the requested voucher_type + line_role combination.
 * Throws a PermissionError if the cashier attempts a disallowed combination.
 */
export function validateRoleForVoucher(
  userRole: string,
  voucherType: VoucherType,
  lineRole?: LineRole
): void {
  if (userRole !== 'cashier') return;

  const allowedTypes: readonly string[] = CASHIER_ALLOWED_VOUCHER_TYPES;
  if (!allowedTypes.includes(voucherType)) {
    throw new Error(
      `Role 'cashier' is not permitted to create vouchers of type '${voucherType}'. Allowed: ${allowedTypes.join(', ')}`
    );
  }

  if (lineRole) {
    const allowedRoles: readonly string[] = CASHIER_ALLOWED_LINE_ROLES;
    if (!allowedRoles.includes(lineRole)) {
      throw new Error(
        `Role 'cashier' is not permitted to use line role '${lineRole}'. Allowed: ${allowedRoles.join(', ')}`
      );
    }
  }
}

/**
 * Validate a single voucher line input against business rules.
 * Checks required fields per line_role, payment method references, and amount sign.
 */
export function validateVoucherLine(input: CreateVoucherLineInput, userRole?: string): void {
  if (input.amount < 0) {
    throw new Error('Line amount must be >= 0');
  }

  if (input.card_last4 && input.card_last4.length > 4) {
    throw new Error('card_last4 must be 4 characters or fewer');
  }

  // Role-specific requirements per line_role
  const requirements = LINE_ROLE_REQUIREMENTS[input.line_role];
  if (requirements) {
    for (const field of requirements.requiredFields) {
      if (!input[field as keyof CreateVoucherLineInput]) {
        throw new Error(`Line role '${input.line_role}' requires field '${field}'`);
      }
    }

    if (requirements.targetTypes.length > 0 && input.target_type) {
      if (!requirements.targetTypes.includes(input.target_type)) {
        throw new Error(
          `Line role '${input.line_role}' requires target_type one of: ${requirements.targetTypes.join(', ')}`
        );
      }
    }
  }

  // Payment method reference validation
  if (input.payment_method_code === 'BANK_TRANSFER' && !input.bank_reference) {
    throw new Error('bank_reference is required for BANK_TRANSFER payment method');
  }

  if (input.payment_method_code === 'CHECK') {
    if (!input.check_number) throw new Error('check_number is required for CHECK payment method');
    if (!input.check_bank)   throw new Error('check_bank is required for CHECK payment method');
    if (!input.check_date)   throw new Error('check_date is required for CHECK payment method');
  }

  // Cash: derive change_returned_amount from tendered_amount (validated at service layer)
  if (input.payment_method_code === 'CASH' && input.tendered_amount !== undefined) {
    if (input.tendered_amount < input.amount) {
      throw new Error('tendered_amount must be >= amount for cash payments');
    }
  }

  // Cashier role check
  if (userRole) {
    validateRoleForVoucher(userRole, VOUCHER_TYPE.RECEIPT, input.line_role as LineRole);
  }
}

/**
 * Validate a voucher is ready for posting.
 * Checks: has at least one active DRAFT line, header total matches sum of line amounts.
 */
export function validateVoucherForPosting(
  voucherTotalAmount: number,
  lines: Array<{ amount: number | { toNumber: () => number }; line_status: string; is_active: boolean }>
): void {
  const activeLines = lines.filter(l => l.is_active && l.line_status === 'DRAFT');

  if (activeLines.length === 0) {
    throw new Error('Voucher must have at least one active DRAFT line before posting');
  }

  const linesTotal = activeLines.reduce((sum, l) => {
    const amt = typeof l.amount === 'object' ? l.amount.toNumber() : l.amount;
    return sum + amt;
  }, 0);

  // Allow small floating-point tolerance
  const headerTotal = typeof voucherTotalAmount === 'number'
    ? voucherTotalAmount
    : Number(voucherTotalAmount);

  if (Math.abs(linesTotal - headerTotal) > 0.0001) {
    throw new Error(
      `Voucher total (${headerTotal}) does not match sum of active line amounts (${linesTotal.toFixed(4)})`
    );
  }
}
