/**
 * Turns a Preview response into the Review dialog model.
 * The dialog does not choose a route from this shape.
 */

import type { EditChangeOperation } from './change-builder';

/** A policy gate stays attached to the operation the operator must review. */
export interface EditReviewWarning {
  seq: number;
  decision: string;
  reasonCode: string;
  gateCode: string;
  requiresAcknowledgement: boolean;
  requiresReason: boolean;
}

/** Display metadata accompanies the signed snapshots; identities are never display labels. */
export interface EditReviewOperation {
  seq: number;
  code: string;
  target: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  titleKey?: string;
  targetLabel?: string | null;
  targetLabel2?: string | null;
  preferenceKind?: string | null;
  effect?: 'add' | 'change' | 'remove';
  /** Server-selected fields keep the summary aligned with the signed change. */
  changedKeys?: string[];
  /** Display names for nested service-speed price changes; IDs remain lookup keys only. */
  itemLabels?: Array<{ orderItemId: string; label: string | null; label2: string | null }>;
}

/** Review state preserves the existing status and financial summary contract. */
export interface EditReviewView {
  status: string;
  currentTotal: string;
  estimatedTotal: string | null;
  financialOutcome: string | null;
  operations: EditReviewOperation[];
  warnings: EditReviewWarning[];
  conflict: boolean;
  currencyCode?: string | null;
  timezone?: string | null;
}

function targetLabel(operation: EditChangeOperation): string {
  // Only the target kind is a safe fallback when a rejected preview has no display facts.
  return operation.target.kind;
}

/**
 * Maps Preview without reconstructing signed values or looking up target identities in the browser.
 *
 * @param body - Preview envelope, including structured failures without audit facts.
 * @param operations - Submitted operations used to retain sequence and target kind.
 * @param currentTotal - Committed total shown when Preview cannot supply one.
 * @param display - Order currency and timezone used only when the envelope omits them.
 * @returns Review presentation model without changing signed snapshots.
 */
export function readEditReview(body: unknown, operations: readonly EditChangeOperation[], currentTotal: string, display?: { currencyCode: string | null; timezone?: string | null }): EditReviewView {
  const envelope = body as {
    status?: string;
    error?: { code?: string };
    data?: {
      status?: string;
      originalTotal?: string;
      projectedTotal?: string | null;
      financial?: { outcome?: string } | null;
      currencyCode?: string | null;
      timezone?: string | null;
      operationAudits?: Array<Partial<EditReviewOperation> & { seq: number; beforeValues?: Record<string, unknown>; afterValues?: Record<string, unknown> }>;
      decisions?: Array<{
        seq: number;
        decision: string;
        reasonCode: string;
        operationCode?: string;
        requiresAcknowledgement?: boolean;
        requiresReason?: boolean;
      }>;
    };
  };
  const data = envelope.data;
  const status = data?.status ?? envelope.status ?? envelope.error?.code ?? 'DENIED';
  const audits = new Map((data?.operationAudits ?? []).map((audit) => [audit.seq, audit]));
  return {
    status,
    currentTotal: data?.originalTotal ?? currentTotal,
    estimatedTotal: data?.projectedTotal ?? null,
    financialOutcome: data?.financial?.outcome ?? null,
    currencyCode: data?.currencyCode ?? display?.currencyCode ?? null,
    timezone: data?.timezone ?? display?.timezone ?? null,
    operations: operations.map((operation) => ({
      seq: operation.seq,
      code: operation.code,
      target: targetLabel(operation),
      before: audits.get(operation.seq)?.beforeValues ?? audits.get(operation.seq)?.before ?? {},
      after: audits.get(operation.seq)?.afterValues ?? audits.get(operation.seq)?.after ?? {},
      titleKey: audits.get(operation.seq)?.titleKey,
      targetLabel: audits.get(operation.seq)?.targetLabel,
      targetLabel2: audits.get(operation.seq)?.targetLabel2,
      preferenceKind: audits.get(operation.seq)?.preferenceKind,
      effect: audits.get(operation.seq)?.effect,
      changedKeys: audits.get(operation.seq)?.changedKeys,
      itemLabels: audits.get(operation.seq)?.itemLabels,
    })),
    warnings: (data?.decisions ?? []).filter((decision) => decision.decision !== 'ALLOW').map((decision) => ({
      seq: decision.seq,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      gateCode: decision.operationCode ?? decision.reasonCode,
      requiresAcknowledgement: decision.requiresAcknowledgement === true,
      requiresReason: decision.requiresReason === true,
    })),
    conflict: envelope.error?.code === 'REVIEW_CHANGED' || envelope.error?.code === 'VERSION_CONFLICT' || envelope.error?.code === 'POLICY_CHANGED_REVIEW_REQUIRED' || status === '409',
  };
}
