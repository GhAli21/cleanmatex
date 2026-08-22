import 'server-only';

import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { evaluateB2BFulfilmentPaymentHold } from '@/lib/services/workflow/b2b-fulfilment-payment-hold.service';

/**
 * The order facts read under the workflow command lock. Keeping gate input
 * explicit ensures a gate can never query an unlocked or cross-tenant order.
 */
export interface WorkflowGateOrderFacts {
  preparationStatus: string | null;
  rackLocation: string | null;
  paymentTypeCode: string | null;
  outstandingAmount: number | string | null;
}

/** A localized reason returned to every channel when a workflow gate blocks. */
export interface WorkflowGateBlockedReason {
  code: string;
  message: string;
  message2?: string;
}

/** Result shape shared by action discovery and command execution. */
export interface WorkflowGateEvaluation {
  allowed: boolean;
  blockedReasons: WorkflowGateBlockedReason[];
}

/**
 * Runtime compatibility mode for a gate evaluation.
 *
 * Semantic profile artifacts must fail closed because their compiler promises
 * enforcement. Legacy configuration retains its historic permissive behavior
 * only while the controlled migration is still in progress.
 */
export type WorkflowGateRuntimeMode = 'semantic' | 'legacy';

const PREPARATION_COMPLETED = 'completed';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isArabic(locale?: string): boolean {
  return locale?.toLowerCase().startsWith('ar') ?? false;
}

function makeReason(
  code: string,
  english: string,
  arabic: string,
  locale?: string,
): WorkflowGateBlockedReason {
  return {
    code,
    message: isArabic(locale) ? arabic : english,
    message2: isArabic(locale) ? english : arabic,
  };
}

function gateBlockedReason(gateCode: string, locale?: string): WorkflowGateBlockedReason {
  const messages: Record<string, { code: string; english: string; arabic: string }> = {
    rack_required: {
      code: 'GATE_RACK_REQUIRED',
      english: 'Rack location is required before this action.',
      arabic: 'موقع الرف مطلوب قبل هذا الإجراء.',
    },
    prep_stage_complete: {
      code: 'GATE_PREP_INCOMPLETE',
      english: 'Preparation must be completed before this action.',
      arabic: 'يجب إكمال التحضير قبل هذا الإجراء.',
    },
    prep_not_completed: {
      code: 'GATE_PREP_ALREADY_COMPLETED',
      english: 'Cancel is only allowed before preparation is completed. Use hold or stop instead.',
      arabic: 'الإلغاء مسموح فقط قبل إكمال التحضير. استخدم التعليق أو الإيقاف بدلاً من ذلك.',
    },
    fin_release_eligible: {
      code: 'GATE_FIN_RELEASE',
      english: 'The order has an outstanding balance and is not eligible for this release.',
      arabic: 'للطلب رصيد مستحق، ولذلك فهو غير مؤهل لهذا الإفراج.',
    },
  };
  const entry = messages[gateCode] ?? {
    code: `GATE_${gateCode.toUpperCase()}`,
    english: `Gate "${gateCode}" blocked this action.`,
    arabic: `البوابة "${gateCode}" منعت هذا الإجراء.`,
  };
  return makeReason(entry.code, entry.english, entry.arabic, locale);
}

function hasOutstandingBalance(value: number | string | null): boolean {
  const amount = Number(value ?? 0);
  // A malformed financial snapshot is unsafe to release. Treat it as owing
  // rather than allowing a potentially unpaid order through fulfilment.
  return !Number.isFinite(amount) || amount > SETTLEMENT_MONEY_EPSILON;
}

function resolveInputRack(input?: Record<string, unknown>): string {
  if (typeof input?.rackLocation === 'string') return input.rackLocation.trim();
  if (typeof input?.rack_location === 'string') return input.rack_location.trim();
  return '';
}

function runtimeUnavailableReason(gateCode: string, locale?: string): WorkflowGateBlockedReason {
  return makeReason(
    'GATE_RUNTIME_UNAVAILABLE',
    `Gate "${gateCode}" is not implemented by this runtime.`,
    `البوابة "${gateCode}" غير مدعومة من وقت التشغيل هذا.`,
    locale,
  );
}

/**
 * Evaluates one gate against facts from the order locked by the enclosing
 * workflow transaction. This is intentionally pure so staff web, mobile, and
 * integrations receive the identical decision without a second data read.
 *
 * @example
 * evaluateWorkflowGate('fin_release_eligible', {
 *   preparationStatus: 'completed', rackLocation: 'A-12',
 *   paymentTypeCode: 'PAY_ON_COLLECTION', outstandingAmount: '4.5000',
 * }, 'semantic')
 */
export function evaluateWorkflowGate(
  gateCode: string,
  order: WorkflowGateOrderFacts,
  mode: WorkflowGateRuntimeMode,
  locale?: string,
  input?: Record<string, unknown>,
): WorkflowGateEvaluation {
  const normalizedGate = gateCode.trim().toLowerCase();

  switch (normalizedGate) {
    case 'rack_required': {
      if (order.rackLocation?.trim() || resolveInputRack(input)) {
        return { allowed: true, blockedReasons: [] };
      }
      return { allowed: false, blockedReasons: [gateBlockedReason('rack_required', locale)] };
    }
    case 'prep_stage_complete':
    case 'prep_complete': {
      if (normalize(order.preparationStatus) === PREPARATION_COMPLETED) {
        return { allowed: true, blockedReasons: [] };
      }
      return { allowed: false, blockedReasons: [gateBlockedReason('prep_stage_complete', locale)] };
    }
    case 'prep_not_completed': {
      if (normalize(order.preparationStatus) !== PREPARATION_COMPLETED) {
        return { allowed: true, blockedReasons: [] };
      }
      return { allowed: false, blockedReasons: [gateBlockedReason('prep_not_completed', locale)] };
    }
    case 'fin_release_eligible': {
      if (mode === 'legacy') return { allowed: true, blockedReasons: [] };

      const paymentTypeCode = normalize(order.paymentTypeCode).toUpperCase();
      if (paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE) {
        const b2bPaymentHold = evaluateB2BFulfilmentPaymentHold({
          paymentTypeCode: order.paymentTypeCode,
        });
        if (b2bPaymentHold.isBlocked) {
          return { allowed: false, blockedReasons: [gateBlockedReason('fin_release_eligible', locale)] };
        }
        return { allowed: true, blockedReasons: [] };
      }
      if (hasOutstandingBalance(order.outstandingAmount)) {
        return { allowed: false, blockedReasons: [gateBlockedReason('fin_release_eligible', locale)] };
      }
      return { allowed: true, blockedReasons: [] };
    }
    default:
      if (mode === 'semantic') {
        return { allowed: false, blockedReasons: [runtimeUnavailableReason(normalizedGate, locale)] };
      }
      return { allowed: true, blockedReasons: [] };
  }
}

/**
 * Evaluates every configured gate and returns all blockers so the caller can
 * explain the complete corrective path instead of making staff retry one rule
 * at a time.
 *
 * @example
 * evaluateWorkflowGateSet(['rack_required', 'fin_release_eligible'], order, 'semantic')
 */
export function evaluateWorkflowGateSet(
  gateCodes: readonly string[],
  order: WorkflowGateOrderFacts,
  mode: WorkflowGateRuntimeMode,
  locale?: string,
  input?: Record<string, unknown>,
): WorkflowGateEvaluation {
  const blockedReasons = gateCodes.flatMap((gateCode) => {
    const result = evaluateWorkflowGate(gateCode, order, mode, locale, input);
    return result.allowed ? [] : result.blockedReasons;
  });

  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
  };
}
