/**
 * Owns an Edit draft and is the only caller of the Change preview and apply routes.
 * Create submission stays on the New Order hook.
 */

import type { OrderChangeEditPolicyInfo } from '@/lib/types/order-change';
import { buildOrderChangeOperations, type EditOrderDraft, type EditUnlistedChange } from './change-builder';
import {
  sameIdentity,
  type EditLineDraft,
  type EditOrderBaseline,
  type EditPieceDraft,
  type EditPreferenceDraft,
  type EditRowIdentity,
} from './edit-order-view-model';

export interface EditOrderControllerOptions {
  createId?: () => string;
  fetchImpl?: typeof fetch;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
}

export interface EditPreviewResult {
  ok: boolean;
  status: number;
  body: unknown;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localRef(createId: () => string): EditRowIdentity {
  return { kind: 'local', clientRef: createId() };
}

/**
 * One Edit session. Loading replaces the draft. Commit reads the draft and does not call Create.
 */
export function createEditOrderController(options: EditOrderControllerOptions = {}) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const fetchImpl = () => options.fetchImpl ?? fetch;
  const requestHeaders = async (): Promise<Record<string, string>> => ({
    'Content-Type': 'application/json',
    ...(await options.headers?.() ?? {}),
  });
  let baseline: EditOrderBaseline | null = null;
  let draft: EditOrderDraft | null = null;
  let loadedPolicy: { editPolicyId: string | null; policyRevision: number | null } | null = null;
  let reviewProof: string | null = null;
  let calculationFingerprint: string | null = null;
  let idempotencyKey: string | null = null;
  let gateDecisions: Array<{ seq: number; gateCode: string; acknowledgementChallenge?: string; overrideReason?: string }> = [];

  function invalidateReview(): void {
    reviewProof = null;
    calculationFingerprint = null;
    idempotencyKey = null;
  }

  function requireDraft(): EditOrderDraft {
    if (!draft || !baseline) throw new Error('EDIT_NOT_LOADED');
    return draft;
  }

  function line(identity: EditRowIdentity): EditLineDraft | undefined {
    return requireDraft().lines.find((row) => sameIdentity(row.identity, identity));
  }

  return {
    load(next: EditOrderBaseline): void {
      baseline = clone(next);
      draft = clone(next);
      reviewProof = null;
      calculationFingerprint = null;
      idempotencyKey = null;
      gateDecisions = [];
    },
    rememberLoadedPolicy(policy: OrderChangeEditPolicyInfo): void {
      loadedPolicy = { editPolicyId: policy.editPolicyId, policyRevision: policy.policyRevision };
    },
    commitKey(): string {
      if (!idempotencyKey) idempotencyKey = createId();
      return idempotencyKey;
    },
    hasReviewProof(): boolean {
      return reviewProof != null && calculationFingerprint != null;
    },
    isLoaded(): boolean {
      return baseline != null;
    },
    operationCount(): number {
      return baseline && draft ? buildOrderChangeOperations(baseline, draft).length : 0;
    },
    buildOperations() {
      if (!baseline || !draft) return [];
      return buildOrderChangeOperations(baseline, draft);
    },
    setNotes(notes: string): void {
      requireDraft().notes = notes;
      invalidateReview();
    },
    setCustomerNotes(notes: string): void {
      requireDraft().customerNotes = notes;
      invalidateReview();
    },
    setPriority(priority: string): void {
      requireDraft().priority = priority;
      invalidateReview();
    },
    setServiceSpeed(serviceSpeed: 'STANDARD' | 'EXPRESS'): void {
      requireDraft().serviceSpeed = serviceSpeed;
      invalidateReview();
    },
    setReadyBy(readyBy: string): void {
      requireDraft().readyBy = readyBy;
      invalidateReview();
    },
    recordUnlisted(change: EditUnlistedChange): void {
      const current = requireDraft();
      current.unlisted = [...(current.unlisted ?? []), change];
      invalidateReview();
    },
    setChangeReason(changeReason: string): void {
      requireDraft().changeReason = changeReason;
      invalidateReview();
    },
    acknowledge(seq: number, gateCode: string): void {
      requireDraft();
      gateDecisions = [...gateDecisions.filter((gate) => gate.seq !== seq), { seq, gateCode, acknowledgementChallenge: 'acknowledged' }];
      invalidateReview();
    },
    setOverrideReason(seq: number, gateCode: string, overrideReason: string): void {
      requireDraft();
      const current = gateDecisions.find((gate) => gate.seq === seq);
      gateDecisions = [
        ...gateDecisions.filter((gate) => gate.seq !== seq),
        { seq, gateCode, acknowledgementChallenge: current?.acknowledgementChallenge, overrideReason },
      ];
      invalidateReview();
    },
    setCustomerSnapshot(snapshot: { customerName?: string; customerMobile?: string; customerEmail?: string }): void {
      const current = requireDraft();
      if (snapshot.customerName !== undefined) current.customerName = snapshot.customerName;
      if (snapshot.customerMobile !== undefined) current.customerMobile = snapshot.customerMobile;
      if (snapshot.customerEmail !== undefined) current.customerEmail = snapshot.customerEmail;
      invalidateReview();
    },
    addItem(input: { productId: string; quantity: number; priceOverride?: string; overrideReason?: string }): EditRowIdentity {
      const identity = localRef(createId);
      requireDraft().lines.push({
        identity,
        productId: input.productId,
        quantity: input.quantity,
        priceOverride: input.priceOverride,
        overrideReason: input.overrideReason,
        pieces: [],
        preferences: [],
      });
      invalidateReview();
      return identity;
    },
    removeLine(identity: EditRowIdentity): void {
      const current = requireDraft();
      current.lines = current.lines.filter((row) => !sameIdentity(row.identity, identity));
      invalidateReview();
    },
    setQuantity(identity: EditRowIdentity, quantity: number, selectedPieceIds?: string[]): void {
      const current = line(identity);
      if (!current) throw new Error('EDIT_LINE_NOT_FOUND');
      current.quantity = quantity;
      current.selectedPieceIds = selectedPieceIds;
      invalidateReview();
    },
    addPiece(parent: EditRowIdentity, piece: Omit<EditPieceDraft, 'identity' | 'preferences'> & { preferences?: EditPreferenceDraft[] }): EditRowIdentity {
      const current = line(parent);
      if (!current) throw new Error('EDIT_LINE_NOT_FOUND');
      const identity = localRef(createId);
      current.pieces.push({ ...piece, identity, preferences: piece.preferences ?? [] });
      invalidateReview();
      return identity;
    },
    removePiece(parent: EditRowIdentity, piece: EditRowIdentity): void {
      const current = line(parent);
      if (!current) throw new Error('EDIT_LINE_NOT_FOUND');
      current.pieces = current.pieces.filter((row) => !sameIdentity(row.identity, piece));
      invalidateReview();
    },
    addPreference(input: {
      level: 'ORDER' | 'ITEM' | 'PIECE';
      parent?: EditRowIdentity;
      preferenceId: string;
      preferenceCode: string;
      preferenceContent?: string;
    }): EditRowIdentity {
      const current = requireDraft();
      const identity = localRef(createId);
      const preference: EditPreferenceDraft = {
        identity,
        preferenceId: input.preferenceId,
        preferenceCode: input.preferenceCode,
        preferenceContent: input.preferenceContent,
      };
      if (input.level === 'ORDER') {
        current.preferences.push(preference);
        invalidateReview();
        return identity;
      }
      if (!input.parent) throw new Error('EDIT_PARENT_REQUIRED');
      if (input.level === 'ITEM') {
        const parent = line(input.parent);
        if (!parent) throw new Error('EDIT_LINE_NOT_FOUND');
        parent.preferences.push(preference);
        invalidateReview();
        return identity;
      }
      const parentLine = current.lines.find((row) => row.pieces.some((piece) => sameIdentity(piece.identity, input.parent as EditRowIdentity)));
      const parentPiece = parentLine?.pieces.find((piece) => sameIdentity(piece.identity, input.parent as EditRowIdentity));
      if (!parentPiece) throw new Error('EDIT_PIECE_NOT_FOUND');
      parentPiece.preferences.push(preference);
      invalidateReview();
      return identity;
    },
    changePreference(identity: EditRowIdentity, preferenceContent: string): void {
      const current = requireDraft();
      const rows = [
        ...current.preferences,
        ...current.lines.flatMap((row) => row.preferences),
        ...current.lines.flatMap((row) => row.pieces.flatMap((piece) => piece.preferences)),
      ];
      const preference = rows.find((row) => sameIdentity(row.identity, identity));
      if (!preference) throw new Error('EDIT_PREFERENCE_NOT_FOUND');
      preference.preferenceContent = preferenceContent;
      invalidateReview();
    },
    removePreference(identity: EditRowIdentity): void {
      const current = requireDraft();
      current.preferences = current.preferences.filter((row) => !sameIdentity(row.identity, identity));
      for (const row of current.lines) {
        row.preferences = row.preferences.filter((preference) => !sameIdentity(preference.identity, identity));
        for (const piece of row.pieces) {
          piece.preferences = piece.preferences.filter((preference) => !sameIdentity(preference.identity, identity));
        }
      }
      invalidateReview();
    },
    async preview(orderId: string): Promise<EditPreviewResult> {
      if (!baseline || !draft) throw new Error('EDIT_NOT_LOADED');
      const operations = buildOrderChangeOperations(baseline, draft);
      if (operations.length === 0) return { ok: true, status: 200, body: { ok: true, status: 'NO_CHANGE' } };
      const response = await fetchImpl()(`/api/v1/orders/${orderId}/changes/preview`, {
        method: 'POST',
        headers: await requestHeaders(),
        body: JSON.stringify({
          expectedEditStateVersion: draft.expectedEditStateVersion,
          expectedWfStateVersion: draft.expectedWfStateVersion,
          sourceContext: draft.sourceContext,
          changeReason: draft.changeReason,
          operations,
          ...(loadedPolicy ? { expectedPolicy: loadedPolicy } : {}),
          ...(gateDecisions.length > 0 ? { gateDecisions } : {}),
        }),
      });
      const body = await response.json() as { data?: { reviewProof?: string | null; calculationFingerprint?: string | null } };
      reviewProof = body.data?.reviewProof ?? null;
      calculationFingerprint = body.data?.calculationFingerprint ?? null;
      return { ok: response.ok, status: response.status, body };
    },
    async apply(orderId: string, suppliedKey: string): Promise<EditPreviewResult> {
      if (!baseline || !draft) throw new Error('EDIT_NOT_LOADED');
      if (!reviewProof || !calculationFingerprint) throw new Error('EDIT_REVIEW_REQUIRED');
      const operations = buildOrderChangeOperations(baseline, draft);
      const response = await fetchImpl()(`/api/v1/orders/${orderId}/changes`, {
        method: 'POST',
        headers: { ...(await requestHeaders()), 'Idempotency-Key': suppliedKey },
        body: JSON.stringify({
          expectedEditStateVersion: draft.expectedEditStateVersion,
          expectedWfStateVersion: draft.expectedWfStateVersion,
          sourceContext: draft.sourceContext,
          changeReason: draft.changeReason,
          operations,
          ...(loadedPolicy ? { expectedPolicy: loadedPolicy } : {}),
          ...(gateDecisions.length > 0 ? { gateDecisions } : {}),
          reviewProof,
          calculationFingerprint,
        }),
      });
      const body = await response.json() as { ok?: boolean; data?: { reviewProof?: string | null; calculationFingerprint?: string | null } };
      if (response.ok || response.status === 409 || response.status === 422) invalidateReview();
      return { ok: response.ok, status: response.status, body };
    },
  };
}

export type EditOrderController = ReturnType<typeof createEditOrderController>;
