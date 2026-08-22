import 'server-only';

import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { evaluateB2BFulfilmentPaymentHold } from '@/lib/services/workflow/b2b-fulfilment-payment-hold.service';

/**
 * Whether the caller is previewing available actions or committing a command.
 * Input-satisfied gates such as POD evidence must not hide the action during
 * discovery; they are enforced when the command payload is present.
 */
export type WorkflowGateEvaluationPhase = 'discover' | 'execute';

/**
 * The order facts read under the workflow command lock. Keeping gate input
 * explicit ensures a gate can never query an unlocked or cross-tenant order.
 * Nullable operational counts mean the family was not loaded; semantic mode
 * then fails closed instead of guessing.
 */
export interface WorkflowGateOrderFacts {
  preparationStatus: string | null;
  rackLocation: string | null;
  paymentTypeCode: string | null;
  outstandingAmount: number | string | null;
  currentStatus?: string | null;
  evaluationPhase?: WorkflowGateEvaluationPhase;
  pieceTrackingEnabled?: boolean | null;
  activeItemCount?: number | null;
  unreadyItemCount?: number | null;
  expectedPieceCount?: number | null;
  activePieceCount?: number | null;
  scannedPieceCount?: number | null;
  readyPieceCount?: number | null;
  openIssueCount?: number | null;
  qaTaskCount?: number | null;
  qaPassedTaskCount?: number | null;
  hasOpenPickupRelease?: boolean | null;
  hasActiveDeliveryStop?: boolean | null;
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
const DIRECT_PICKUP_STATUSES = new Set(['ready']);
const STAGED_PICKUP_STATUSES = new Set(['ready_for_pickup']);
const OTP_POD_METHODS = new Set(['otp']);
const SIGNATURE_POD_METHODS = new Set(['signature', 'mixed']);
const PHOTO_POD_METHODS = new Set(['photo', 'mixed']);

/** Gates that need item, piece, QA, release, stop, or evidence facts. */
export const WORKFLOW_EXTENDED_GATE_CODES = [
  'all_pieces_scanned',
  'all_items_ready',
  'all_pieces_ready',
  'qa_passed',
  'unpaid_cancel_disposition',
  'pickup_collection_settled',
  'delivery_collection_settled',
  'pickup_release_valid',
  'delivery_stop_active',
  'pod_evidence_valid',
  'partial_fulfilment_supported',
  'return_service_available',
] as const;

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
    all_pieces_scanned: {
      code: 'GATE_PIECES_UNSCANNED',
      english: 'Every tracked piece must be scanned before this action.',
      arabic: 'يجب مسح كل قطعة متتبعة قبل هذا الإجراء.',
    },
    all_items_ready: {
      code: 'GATE_ITEMS_NOT_READY',
      english: 'Every active item must be ready before this action.',
      arabic: 'يجب أن تكون كل البنود النشطة جاهزة قبل هذا الإجراء.',
    },
    all_pieces_ready: {
      code: 'GATE_PIECES_NOT_READY',
      english: 'Every tracked piece must be ready before this action.',
      arabic: 'يجب أن تكون كل قطعة متتبعة جاهزة قبل هذا الإجراء.',
    },
    qa_passed: {
      code: 'GATE_QA_NOT_PASSED',
      english: 'Quality must be passed and all issues closed before this action.',
      arabic: 'يجب اجتياز فحص الجودة وإغلاق كل المشكلات قبل هذا الإجراء.',
    },
    unpaid_cancel_disposition: {
      code: 'GATE_UNPAID_CANCEL',
      english: 'An unpaid order cannot be cancelled until finance records a disposition.',
      arabic: 'لا يمكن إلغاء طلب غير مدفوع حتى يسجل المالي التصرف.',
    },
    pickup_collection_settled: {
      code: 'GATE_PICKUP_COLLECTION',
      english: 'Collect the remaining pay-on-collection balance before confirming pickup.',
      arabic: 'اجمع الرصيد المتبقي للدفع عند الاستلام قبل تأكيد الاستلام.',
    },
    delivery_collection_settled: {
      code: 'GATE_DELIVERY_COLLECTION',
      english: 'Collect the remaining pay-on-collection balance before confirming delivery.',
      arabic: 'اجمع الرصيد المتبقي للدفع عند الاستلام قبل تأكيد التسليم.',
    },
    pickup_release_valid: {
      code: 'GATE_PICKUP_RELEASE',
      english: 'Staged pickup requires an open pickup release record.',
      arabic: 'الاستلام المرحلي يتطلب سجل إفراج استلام مفتوحاً.',
    },
    delivery_stop_active: {
      code: 'GATE_DELIVERY_STOP',
      english: 'Delivery confirmation requires an active pending or in-transit stop.',
      arabic: 'تأكيد التسليم يتطلب محطة توصيل نشطة قيد الانتظار أو في الطريق.',
    },
    pod_evidence_valid: {
      code: 'GATE_POD_EVIDENCE',
      english: 'Configured proof-of-delivery evidence is required before completing delivery.',
      arabic: 'إثبات التسليم المطلوب غير مكتمل قبل إكمال التوصيل.',
    },
    partial_fulfilment_supported: {
      code: 'GATE_PARTIAL_UNSUPPORTED',
      english: 'Partial fulfilment is not supported by the current workflow runtime.',
      arabic: 'التنفيذ الجزئي غير مدعوم من وقت تشغيل سير العمل الحالي.',
    },
    return_service_available: {
      code: 'GATE_RETURN_UNSUPPORTED',
      english: 'Returns are not available until the return sub-order service exists.',
      arabic: 'المرتجعات غير متاحة حتى تتوفر خدمة طلب الإرجاع الفرعي.',
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

function missingFactsReason(gateCode: string, locale?: string): WorkflowGateBlockedReason {
  return makeReason(
    'GATE_FACTS_UNAVAILABLE',
    `Gate "${gateCode}" cannot be evaluated because required order facts were not loaded.`,
    `لا يمكن تقييم البوابة "${gateCode}" لأن حقائق الطلب المطلوبة لم تُحمَّل.`,
    locale,
  );
}

function isLoadedNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLoadedBoolean(value: boolean | null | undefined): value is boolean {
  return typeof value === 'boolean';
}

function allow(): WorkflowGateEvaluation {
  return { allowed: true, blockedReasons: [] };
}

function block(gateCode: string, locale?: string): WorkflowGateEvaluation {
  return { allowed: false, blockedReasons: [gateBlockedReason(gateCode, locale)] };
}

function missing(gateCode: string, locale?: string): WorkflowGateEvaluation {
  return { allowed: false, blockedReasons: [missingFactsReason(gateCode, locale)] };
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function resolvePodInput(input?: Record<string, unknown>): {
  methodCode: string;
  hasSignature: boolean;
  photoCount: number;
} {
  const pod = input?.pod && typeof input.pod === 'object' ? (input.pod as Record<string, unknown>) : {};
  const methodCode = normalize(
    firstString(input?.podMethodCode, input?.pod_method_code, pod.methodCode, pod.pod_method_code),
  );
  const signature = firstString(
    input?.signatureEvidenceId,
    input?.signature_evidence_id,
    input?.signatureObjectKey,
    input?.signature_object_key,
    pod.signatureId,
    pod.signatureEvidenceId,
    pod.signatureObjectKey,
  );
  const photos = [
    ...asStringArray(input?.photoEvidenceIds),
    ...asStringArray(input?.photo_evidence_ids),
    ...asStringArray(input?.photoObjectKeys),
    ...asStringArray(input?.photo_object_keys),
    ...asStringArray(pod.photoIds),
    ...asStringArray(pod.photoEvidenceIds),
    ...asStringArray(pod.photoObjectKeys),
  ];
  return {
    methodCode,
    hasSignature: signature.length > 0,
    photoCount: new Set(photos).size,
  };
}

function collectionSettled(order: WorkflowGateOrderFacts): boolean {
  const paymentTypeCode = normalize(order.paymentTypeCode).toUpperCase();
  if (paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE) {
    return !evaluateB2BFulfilmentPaymentHold({
      paymentTypeCode: order.paymentTypeCode,
    }).isBlocked;
  }
  if (paymentTypeCode !== SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION) {
    return true;
  }
  return !hasOutstandingBalance(order.outstandingAmount);
}

/**
 * Returns true when any configured gate needs item, piece, QA, fulfilment, or
 * evidence facts beyond the locked order header.
 *
 * @param gateCodes - Gate codes bound to the candidate action or action set.
 */
export function workflowGateNeedsExtendedFacts(gateCodes: readonly string[]): boolean {
  const needed = new Set<string>(WORKFLOW_EXTENDED_GATE_CODES);
  return gateCodes.some((gateCode) => needed.has(gateCode.trim().toLowerCase()));
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
 *
 * @param gateCode - Semantic gate code selected by the compiled action binding.
 * @param order - Facts from the tenant-scoped order locked by the command.
 * @param mode - Semantic enforcement or controlled legacy-compatibility mode.
 * @param locale - Optional response locale used for blocked-reason text.
 * @param input - Optional command input that can satisfy an input-aware gate.
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
        return allow();
      }
      return block('rack_required', locale);
    }
    case 'prep_stage_complete':
    case 'prep_complete': {
      if (normalize(order.preparationStatus) === PREPARATION_COMPLETED) {
        return allow();
      }
      return block('prep_stage_complete', locale);
    }
    case 'prep_not_completed': {
      if (normalize(order.preparationStatus) !== PREPARATION_COMPLETED) {
        return allow();
      }
      return block('prep_not_completed', locale);
    }
    case 'fin_release_eligible': {
      if (mode === 'legacy') return allow();

      const paymentTypeCode = normalize(order.paymentTypeCode).toUpperCase();
      if (paymentTypeCode === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE) {
        const b2bPaymentHold = evaluateB2BFulfilmentPaymentHold({
          paymentTypeCode: order.paymentTypeCode,
        });
        if (b2bPaymentHold.isBlocked) {
          return block('fin_release_eligible', locale);
        }
        return allow();
      }
      if (hasOutstandingBalance(order.outstandingAmount)) {
        return block('fin_release_eligible', locale);
      }
      return allow();
    }
    case 'all_items_ready': {
      if (!isLoadedNumber(order.unreadyItemCount) || !isLoadedNumber(order.activeItemCount)) {
        return mode === 'semantic' ? missing('all_items_ready', locale) : allow();
      }
      if (order.activeItemCount === 0 || order.unreadyItemCount > 0) {
        return block('all_items_ready', locale);
      }
      return allow();
    }
    case 'all_pieces_scanned': {
      if (!isLoadedBoolean(order.pieceTrackingEnabled)
        || !isLoadedNumber(order.expectedPieceCount)
        || !isLoadedNumber(order.activePieceCount)
        || !isLoadedNumber(order.scannedPieceCount)) {
        return mode === 'semantic' ? missing('all_pieces_scanned', locale) : allow();
      }
      if (!order.pieceTrackingEnabled) return allow();
      if (
        order.expectedPieceCount <= 0
        || order.activePieceCount < order.expectedPieceCount
        || order.scannedPieceCount < order.activePieceCount
      ) {
        return block('all_pieces_scanned', locale);
      }
      return allow();
    }
    case 'all_pieces_ready': {
      if (!isLoadedBoolean(order.pieceTrackingEnabled)
        || !isLoadedNumber(order.expectedPieceCount)
        || !isLoadedNumber(order.activePieceCount)
        || !isLoadedNumber(order.readyPieceCount)) {
        return mode === 'semantic' ? missing('all_pieces_ready', locale) : allow();
      }
      if (!order.pieceTrackingEnabled) return allow();
      if (
        order.expectedPieceCount <= 0
        || order.activePieceCount < order.expectedPieceCount
        || order.readyPieceCount < order.activePieceCount
      ) {
        return block('all_pieces_ready', locale);
      }
      return allow();
    }
    case 'qa_passed': {
      if (!isLoadedNumber(order.openIssueCount)
        || !isLoadedNumber(order.qaTaskCount)
        || !isLoadedNumber(order.qaPassedTaskCount)) {
        return mode === 'semantic' ? missing('qa_passed', locale) : allow();
      }
      if (order.openIssueCount > 0) return block('qa_passed', locale);
      if (order.qaTaskCount === 0 || order.qaPassedTaskCount < order.qaTaskCount) {
        return block('qa_passed', locale);
      }
      return allow();
    }
    case 'unpaid_cancel_disposition': {
      if (mode === 'legacy') return allow();
      if (!hasOutstandingBalance(order.outstandingAmount)) return allow();
      return block('unpaid_cancel_disposition', locale);
    }
    case 'pickup_collection_settled': {
      if (mode === 'legacy') return allow();
      return collectionSettled(order) ? allow() : block('pickup_collection_settled', locale);
    }
    case 'delivery_collection_settled': {
      if (mode === 'legacy') return allow();
      return collectionSettled(order) ? allow() : block('delivery_collection_settled', locale);
    }
    case 'pickup_release_valid': {
      if (!isLoadedBoolean(order.hasOpenPickupRelease)) {
        return mode === 'semantic' ? missing('pickup_release_valid', locale) : allow();
      }
      const status = normalize(order.currentStatus);
      if (STAGED_PICKUP_STATUSES.has(status)) {
        return order.hasOpenPickupRelease ? allow() : block('pickup_release_valid', locale);
      }
      if (DIRECT_PICKUP_STATUSES.has(status)) return allow();
      return mode === 'semantic' ? block('pickup_release_valid', locale) : allow();
    }
    case 'delivery_stop_active': {
      if (!isLoadedBoolean(order.hasActiveDeliveryStop)) {
        return mode === 'semantic' ? missing('delivery_stop_active', locale) : allow();
      }
      return order.hasActiveDeliveryStop ? allow() : block('delivery_stop_active', locale);
    }
    case 'pod_evidence_valid': {
      if ((order.evaluationPhase ?? 'discover') === 'discover') return allow();
      const pod = resolvePodInput(input);
      if (!pod.methodCode) return block('pod_evidence_valid', locale);
      if (OTP_POD_METHODS.has(pod.methodCode)) {
        return mode === 'semantic' ? block('pod_evidence_valid', locale) : allow();
      }
      if (SIGNATURE_POD_METHODS.has(pod.methodCode) && !pod.hasSignature) {
        return block('pod_evidence_valid', locale);
      }
      if (PHOTO_POD_METHODS.has(pod.methodCode) && pod.photoCount < 1) {
        return block('pod_evidence_valid', locale);
      }
      if (
        !SIGNATURE_POD_METHODS.has(pod.methodCode)
        && !PHOTO_POD_METHODS.has(pod.methodCode)
      ) {
        return mode === 'semantic' ? block('pod_evidence_valid', locale) : allow();
      }
      return allow();
    }
    case 'partial_fulfilment_supported':
      return mode === 'semantic' ? block('partial_fulfilment_supported', locale) : allow();
    case 'return_service_available':
      return mode === 'semantic' ? block('return_service_available', locale) : allow();
    default:
      if (mode === 'semantic') {
        return { allowed: false, blockedReasons: [runtimeUnavailableReason(normalizedGate, locale)] };
      }
      return allow();
  }
}

/**
 * Evaluates every configured gate and returns all blockers so the caller can
 * explain the complete corrective path instead of making staff retry one rule
 * at a time.
 *
 * @example
 * evaluateWorkflowGateSet(['rack_required', 'fin_release_eligible'], order, 'semantic')
 *
 * @param gateCodes - All gates configured for the candidate action.
 * @param order - Facts from the tenant-scoped order locked by the command.
 * @param mode - Semantic enforcement or controlled legacy-compatibility mode.
 * @param locale - Optional response locale used for blocked-reason text.
 * @param input - Optional command input that can satisfy an input-aware gate.
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
