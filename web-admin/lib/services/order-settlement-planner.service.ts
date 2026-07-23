import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  PAYMENT_NATURE,
  CREDIT_APPLICATION_TYPES,
  STORED_VALUE_LOCK_RANK,
} from '@/lib/constants/order-financial';
import type { ResolvedSettlementLeg } from '@/lib/types/order-financial';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import { resolvePaymentOverpaymentPolicy } from '@/lib/payments/overpayment-policy';
import { computeSettlementOverpaymentMetrics } from '@/lib/payments/settlement-overpayment';
import type {
  SettlementPlan,
  RealPaymentLeg,
  CreditApplicationLeg,
} from '@/lib/types/settlement-plan';

const TOLERANCE = 0.001;

/**
 * Resolves a payment method's default creation status when the D9 config is absent.
 *
 * Fallback priority rationale:
 *  1. Any gateway leg → PROCESSING because the terminal/gateway confirms asynchronously.
 *  2. CASH / CARD → COMPLETED because the cashier collects immediately at the counter.
 *  3. Everything else (BANK_TRANSFER, CHECK, etc.) → PENDING until back-office confirms.
 *
 * This function is only called when defaultCreationStatus is null/empty in D9 config;
 * a configured status always wins.
 *
 * Exported (B31) so every entry point that resolves a payment's creation status —
 * submit, later collection — shares this one fallback instead of each re-deriving
 * its own family rule.
 * @param paymentMethodCode
 * @param gatewayCode
 */
export function resolveDefaultStatus(paymentMethodCode: string, gatewayCode?: string | null): string {
  if (gatewayCode) return 'PROCESSING';
  if (paymentMethodCode === 'CASH' || paymentMethodCode === 'CARD') return 'COMPLETED';
  return 'PENDING';
}

/**
 * Classifies resolved settlement legs into real-payment and credit-application buckets.
 * Pure function — no DB access, no side effects.
 *
 * @param orderId          Target order ID written onto every plan leg.
 * @param totalAmount      Server-computed grand total (authoritative).
 * @param currencyCode     ISO currency code for all legs.
 * @param resolvedLegs     DB-resolved legs from org_payment_methods_cf lookup (with D9 config).
 * @param originalLegs     Raw request legs — zipped by index with resolvedLegs to recover
 *                         check fields (checkNumber/checkBank/checkDate) and card fields
 *                         that are dropped during DB resolution.
 * @param paymentTypeCode  Order payment type (PAY_IN_ADVANCE, INVOICE, etc.) — drives
 *                         outstandingPolicy classification.
 * @param cashDrawerSessionId  Session ID from the request; assigned only to legs that
 *                             requiresCashDrawer=true.
 * @returns SettlementPlan with classified legs, computed amounts, outstandingPolicy,
 *          and shouldCreateReceiptVoucher / shouldCreateArInvoice flags.
 *
 * @example
 * const plan = buildSettlementPlan(
 *   orderId,
 *   serverTotals.saleTotal,
 *   serverTotals.currencyCode,
 *   settlementLegs,
 *   paymentLegs,
 *   'PAY_IN_ADVANCE',
 *   input.cashDrawerSessionId
 * );
 * // plan.shouldCreateReceiptVoucher → true when legs exist
 * // plan.outstandingPolicy          → 'NONE' | 'PAY_ON_COLLECTION' | 'CREDIT_INVOICE'
 */
export function buildSettlementPlan(
  orderId: string,
  totalAmount: number,
  currencyCode: string,
  resolvedLegs: ResolvedSettlementLeg[],
  originalLegs: PaymentLeg[],
  paymentTypeCode: string,
  cashDrawerSessionId?: string
): SettlementPlan {
  const realPaymentLegs: RealPaymentLeg[] = [];
  const creditApplicationLegs: CreditApplicationLeg[] = [];

  for (let i = 0; i < resolvedLegs.length; i++) {
    const leg = resolvedLegs[i];
    const orig = originalLegs[i];
    const { settlementOption: option, amount } = leg;

    if (option.paymentNature === PAYMENT_NATURE.REAL_PAYMENT) {
      const defaultCreationStatus =
        option.defaultCreationStatus ||
        resolveDefaultStatus(option.paymentMethodCode, option.gatewayCode);
      const allowStatusOverride = option.allowStatusOverride ?? false;
      const policy = resolvePaymentOverpaymentPolicy({
        paymentMethodCode: option.paymentMethodCode,
        supportsChangeReturn: option.supportsChangeReturn,
        supportsOverpayment: option.supportsOverpayment,
        requiresCashDrawer: option.requiresCashDrawer,
      });
      // BVM Phase 6 Sub-item 6 (B7 closer): explicit per-leg paymentStatus.
      // An explicit `'PENDING'` from the request overrides every fallback;
      // omitting the field (Zod defaults to `'COMPLETED'`) keeps the prior
      // gateway/D9 fallback chain intact.
      const explicitStatus = orig?.paymentStatus;
      // B32 (M8) investigation note: allow_status_override is intentionally
      // NOT enforced against this explicit per-leg override. BVM Phase 6
      // Sub-item 6 (B7 closer) already shipped and tested "explicit PENDING
      // from the checkout request always overrides the fallback, regardless
      // of config" — gating it here would regress that verified production
      // behavior. See B32's own file for the full reasoning; the config
      // field remains captured on the leg (read by validateOverpaymentResolution
      // et al.) but its "override" consumer is the B30 back-office transition
      // surface, not this checkout-time field.
      const resolvedPaymentStatus =
        explicitStatus === 'PENDING' ? 'PENDING' : defaultCreationStatus;

      // changeReturnedAmount is deliberately excluded from RealPaymentLeg.
      // addVoucherLine() derives it as (tenderedAmount − amount) when both are present,
      // keeping the voucher layer as the single source of truth and avoiding drift.
      realPaymentLegs.push({
        legIndex:             i,
        paymentMethodCode:    option.paymentMethodCode,
        orgPaymentMethodId:   option.id,
        amount,
        currencyCode,
        cashDrawerSessionId:  option.requiresCashDrawer ? cashDrawerSessionId : undefined,
        tenderedAmount:       policy.isCash ? leg.cashTendered ?? amount : leg.cashTendered,
        supportsChangeReturn: policy.supportsChangeReturn,
        supportsOverpayment:  policy.supportsOverpayment,
        cardBrandCode:        orig?.card_brand_code ?? undefined,
        cardLast4:            orig?.card_last4 ?? undefined,
        authCode:             orig?.auth_code ?? undefined,
        gatewayCode:          option.gatewayCode ?? undefined,
        gatewayTransactionId: orig?.gateway_transaction_id ?? undefined,
        gatewayReference:     orig?.gateway_reference ?? undefined,
        bankReference:        orig?.bank_reference ?? undefined,
        checkNumber:          orig?.checkNumber ?? undefined,
        checkBank:            orig?.checkBank ?? undefined,
        checkDate:            orig?.checkDate ?? undefined,
        terminalId:           leg.terminalId ?? undefined,
        requiresReference:    option.requiresReference ?? false,
        requiresCashDrawer:   option.requiresCashDrawer,
        requiresTerminal:     option.requiresTerminal ?? false,
        defaultCreationStatus,
        allowStatusOverride,
        resolvedPaymentStatus,
      });
      continue;
    }

    if (option.paymentNature === PAYMENT_NATURE.CREDIT_APPLICATION) {
      // Throw rather than fall back: org_payment_methods_cf rows tagged
      // CREDIT_APPLICATION MUST have credit_application_type set. Silent fallback
      // historically masked data drift between this planner and order-settlement.
      if (!option.creditApplicationType) {
        throw new Error('CREDIT_APPLICATION_TYPE_REQUIRED');
      }
      creditApplicationLegs.push({
        legIndex:          i,
        creditType:        option.creditApplicationType,
        amount,
        currencyCode,
        creditReferenceId: leg.creditReferenceId ?? undefined,
      });
    }
    // DEFERRED_SETTLEMENT / AR_ALLOCATION / INTERNAL_ADJUSTMENT → outstanding; no voucher line
  }

  // Sort credit-application legs into STORED_VALUE_LOCK_ORDER so every submit
  // takes balance-row locks in the same sequence, eliminating the deadlock
  // window when two concurrent submits touch the same customer's balances.
  // Secondary key: original legIndex — preserves caller order within a type.
  creditApplicationLegs.sort((a, b) => {
    const rankDiff = STORED_VALUE_LOCK_RANK[a.creditType] - STORED_VALUE_LOCK_RANK[b.creditType];
    return rankDiff !== 0 ? rankDiff : a.legIndex - b.legIndex;
  });

  const realPaymentAmount         = realPaymentLegs.reduce((s, l) => s + l.amount, 0);
  const creditAppliedAmount       = creditApplicationLegs.reduce((s, l) => s + l.amount, 0);
  const immediateSettlementAmount = realPaymentAmount + creditAppliedAmount;
  const outstandingAmount         = Math.max(0, totalAmount - immediateSettlementAmount);

  let outstandingPolicy: SettlementPlan['outstandingPolicy'] = 'NONE';
  if (outstandingAmount > TOLERANCE) {
    if (paymentTypeCode === 'INVOICE' || paymentTypeCode === 'CREDIT_INVOICE') {
      outstandingPolicy = 'CREDIT_INVOICE';
    } else {
      outstandingPolicy = 'PAY_ON_COLLECTION';
    }
  }

  const overpayment = computeSettlementOverpaymentMetrics({
    totalAmount,
    immediateSettlementAmount,
    realPaymentLegs,
  });

  return {
    orderId,
    totalAmount,
    realPaymentLegs,
    creditApplicationLegs,
    realPaymentAmount,
    creditAppliedAmount,
    immediateSettlementAmount,
    outstandingAmount,
    outstandingPolicy,
    shouldCreateReceiptVoucher: realPaymentLegs.length > 0 || creditApplicationLegs.length > 0,
    shouldCreateArInvoice:      outstandingPolicy === 'CREDIT_INVOICE',
    ...overpayment,
  };
}

/**
 * Validates infrastructure preconditions for the settlement plan.
 * Runs BEFORE voucher creation so failures leave no orphaned DB rows.
 *
 * All Prisma queries scoped to tenantOrgId via withTenantContext.
 *
 * @param plan        Built by buildSettlementPlan(); only realPaymentLegs are checked.
 * @param tenantOrgId Tenant organisation ID; enforces row-level isolation on drawer/gateway lookups.
 * @returns Promise<void> on success.
 * @throws Error('PAYMENT_REFERENCE_REQUIRED') — requiresReference=true leg has no reference field.
 * @throws Error('CASH_TENDERED_LESS_THAN_AMOUNT') — tenderedAmount < leg.amount on a CASH leg.
 * @throws Error('CASH_DRAWER_SESSION_REQUIRED') — requiresCashDrawer=true but no session ID, or
 *         session ID not found in org_cash_drawer_sessions_mst for this tenant.
 * @throws Error('CASH_DRAWER_SESSION_CLOSED') — referenced drawer session exists but is not OPEN.
 * @throws Error('GATEWAY_NOT_CONFIGURED') — leg carries a gatewayCode but no active
 *         org_payment_gateway_cf row exists for that gateway code and tenant.
 *
 * @example
 * await validateSettlementPlan(plan, tenantId);
 * // Throws on first failing leg; caller catches and maps to HTTP 422.
 */
export async function validateSettlementPlan(
  plan: SettlementPlan,
  tenantOrgId: string
): Promise<void> {
  const orderedSettlementLegs = [
    ...plan.realPaymentLegs.map((leg) => ({
      legIndex: leg.legIndex,
      amount: leg.amount,
      paymentMethodCode: leg.paymentMethodCode,
      supportsOverpayment: leg.supportsOverpayment,
      isCreditApplication: false,
    })),
    ...plan.creditApplicationLegs.map((leg) => ({
      legIndex: leg.legIndex,
      amount: leg.amount,
      paymentMethodCode: leg.creditType,
      supportsOverpayment: false,
      isCreditApplication: true,
    })),
  ].sort((a, b) => a.legIndex - b.legIndex);
  let appliedBeforeLeg = 0;
  for (const leg of orderedSettlementLegs) {
    const excessBeforeLeg = Math.max(0, appliedBeforeLeg - plan.totalAmount);
    const excessAfterLeg = Math.max(0, appliedBeforeLeg + leg.amount - plan.totalAmount);
    const excessIntroducedByLeg = excessAfterLeg - excessBeforeLeg;

    if (excessIntroducedByLeg > TOLERANCE) {
      const canRetainExcess =
        !leg.isCreditApplication &&
        (leg.paymentMethodCode !== 'CASH'
          ? leg.supportsOverpayment
          : leg.supportsOverpayment);
      if (!canRetainExcess) {
        throw new Error('METHOD_OVERPAYMENT_NOT_ALLOWED');
      }
    }

    appliedBeforeLeg += leg.amount;
  }

  // Total excess without disposition is enforced by validateOverpaymentResolution()
  // in the submit orchestrator (ADR-047 Phase 2).

  return withTenantContext(tenantOrgId, async () => {
    for (const leg of plan.realPaymentLegs) {
      if (leg.requiresReference) {
        const hasRef =
          leg.gatewayReference || leg.gatewayTransactionId ||
          leg.bankReference || leg.checkNumber ||
          (leg.paymentMethodCode === 'CARD' && leg.authCode);
        if (!hasRef) {
          throw new Error('PAYMENT_REFERENCE_REQUIRED');
        }
      }

      if (leg.requiresTerminal && !leg.terminalId) {
        throw new Error('PAYMENT_TERMINAL_REQUIRED');
      }

      if (leg.paymentMethodCode === 'CASH') {
        if (leg.tenderedAmount === undefined) {
          throw new Error('CASH_TENDERED_REQUIRED');
        }
        if (leg.tenderedAmount < leg.amount) {
          throw new Error('CASH_TENDERED_LESS_THAN_AMOUNT');
        }
        if (leg.tenderedAmount - leg.amount > TOLERANCE && !leg.supportsChangeReturn) {
          throw new Error('CASH_CHANGE_NOT_ALLOWED');
        }
      } else if (leg.tenderedAmount !== undefined && leg.tenderedAmount > leg.amount + TOLERANCE) {
        if (!leg.supportsOverpayment) {
          throw new Error('METHOD_OVERPAYMENT_NOT_ALLOWED');
        }
      }

      if (leg.requiresCashDrawer && !leg.cashDrawerSessionId) {
        throw new Error('CASH_DRAWER_SESSION_REQUIRED');
      }

      if (leg.cashDrawerSessionId) {
        const session = await prisma.org_cash_drawer_sessions_mst.findFirst({
          where:  { id: leg.cashDrawerSessionId, tenant_org_id: tenantOrgId },
          select: { status: true },
        });
        if (!session) throw new Error('CASH_DRAWER_SESSION_REQUIRED');
        if (session.status !== 'OPEN') throw new Error('CASH_DRAWER_SESSION_CLOSED');
      }

      if (leg.gatewayCode) {
        const gwConfig = await prisma.sys_payment_gateway_cd.findFirst({
          where:  { code: leg.gatewayCode, is_active: true },
          select: { code: true },
        });
        if (!gwConfig) throw new Error('GATEWAY_NOT_CONFIGURED');
      }
    }
  });
}
