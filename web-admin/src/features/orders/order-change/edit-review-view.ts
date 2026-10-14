/**
 * Turns a Preview response into the Review dialog model.
 * The dialog does not choose a route from this shape.
 */

import type { EditChangeOperation } from './change-builder';

export interface EditReviewWarning {
  seq: number;
  decision: string;
  reasonCode: string;
  gateCode: string;
  requiresAcknowledgement: boolean;
  requiresReason: boolean;
}

export interface EditReviewOperation {
  seq: number;
  code: string;
  target: string;
}

export interface EditReviewView {
  status: string;
  currentTotal: string;
  estimatedTotal: string | null;
  financialOutcome: string | null;
  operations: EditReviewOperation[];
  warnings: EditReviewWarning[];
  conflict: boolean;
}

function targetLabel(operation: EditChangeOperation): string {
  if ('id' in operation.target && operation.target.id) return operation.target.id;
  if ('clientRef' in operation.target && operation.target.clientRef) return operation.target.clientRef;
  return operation.target.kind;
}

export function readEditReview(body: unknown, operations: readonly EditChangeOperation[], currentTotal: string): EditReviewView {
  const envelope = body as {
    status?: string;
    error?: { code?: string };
    data?: {
      status?: string;
      originalTotal?: string;
      projectedTotal?: string | null;
      financial?: { outcome?: string } | null;
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
  return {
    status,
    currentTotal: data?.originalTotal ?? currentTotal,
    estimatedTotal: data?.projectedTotal ?? null,
    financialOutcome: data?.financial?.outcome ?? null,
    operations: operations.map((operation) => ({ seq: operation.seq, code: operation.code, target: targetLabel(operation) })),
    warnings: (data?.decisions ?? []).filter((decision) => decision.decision !== 'ALLOW').map((decision) => ({
      seq: decision.seq,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      gateCode: decision.operationCode ?? decision.reasonCode,
      requiresAcknowledgement: decision.requiresAcknowledgement === true,
      requiresReason: decision.requiresReason === true,
    })),
    conflict: envelope.error?.code === 'REVIEW_CHANGED' || envelope.error?.code === 'VERSION_CONFLICT' || status === '409',
  };
}
