/**
 * Builds one Change intent from the loaded order and the current Edit draft.
 * A local row that is added and removed in the same draft produces no operation.
 */

import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import type { z } from 'zod';
import {
  identityKey,
  type EditLineDraft,
  type EditOrderBaseline,
  type EditPieceDraft,
  type EditPreferenceDraft,
} from './edit-order-view-model';

export type EditChangeOperation = z.infer<typeof orderChangeRequestSchema>['operations'][number];

export interface EditUnlistedChange {
  target:
    | { kind: 'ORDER' }
    | { kind: 'PERSISTED_ITEM' | 'PERSISTED_PIECE'; id: string }
    | { kind: 'LOCAL_ITEM' | 'LOCAL_PIECE'; clientRef: string };
  field: string;
  value: string;
}

export interface EditOrderDraft extends EditOrderBaseline {
  changeReason?: string;
  /** Screen edits that have no policy operation. Preview still lists them. */
  unlisted?: EditUnlistedChange[];
}

function text(value: string | undefined): string {
  return value?.trim() ?? '';
}

function preferenceContent(preference: EditPreferenceDraft): string {
  return preference.preferenceContent ?? '';
}

function findByKey<T extends { identity: EditPreferenceDraft['identity'] }>(rows: readonly T[], key: string): T | undefined {
  return rows.find((row) => identityKey(row.identity) === key);
}

/**
 * Compare the loaded order with the draft and return persisted-id operations.
 * Header fields that did not change are omitted. Child rows of a removed item are not repeated.
 */
export function buildOrderChangeOperations(baseline: EditOrderBaseline, draft: EditOrderDraft): EditChangeOperation[] {
  const operations: EditChangeOperation[] = [];
  let seq = 1;
  const push = (operation: Omit<EditChangeOperation, 'seq'>) => {
    operations.push({ ...operation, seq } as EditChangeOperation);
    seq += 1;
  };

  const notesChanged = text(baseline.notes) !== text(draft.notes) || text(baseline.customerNotes) !== text(draft.customerNotes);
  if (notesChanged) {
    push({
      code: 'CHANGE_ORDER_NOTES',
      target: { kind: 'ORDER' },
      payload: {
        ...(text(baseline.notes) !== text(draft.notes) ? { notes: draft.notes ?? '' } : {}),
        ...(text(baseline.customerNotes) !== text(draft.customerNotes) ? { customerNotes: draft.customerNotes ?? '' } : {}),
      },
    });
  }
  if (text(baseline.priority) !== text(draft.priority) && draft.priority) {
    push({ code: 'CHANGE_PRIORITY', target: { kind: 'ORDER' }, payload: { priority: draft.priority } });
  }
  if (baseline.serviceSpeed !== draft.serviceSpeed && draft.serviceSpeed) {
    push({ code: 'CHANGE_SERVICE_SPEED', target: { kind: 'ORDER' }, payload: { serviceSpeed: draft.serviceSpeed } });
  }
  if (text(baseline.readyBy) !== text(draft.readyBy) && draft.readyBy) {
    push({ code: 'CHANGE_READY_BY', target: { kind: 'ORDER' }, payload: { readyBy: draft.readyBy } });
  }
  const customerChanged = text(baseline.customerName) !== text(draft.customerName)
    || text(baseline.customerMobile) !== text(draft.customerMobile)
    || text(baseline.customerEmail) !== text(draft.customerEmail);
  if (customerChanged) {
    push({
      code: 'CHANGE_CUSTOMER_SNAPSHOT',
      target: { kind: 'ORDER' },
      payload: {
        ...(text(baseline.customerName) !== text(draft.customerName) ? { customerName: draft.customerName } : {}),
        ...(text(baseline.customerMobile) !== text(draft.customerMobile) ? { customerMobile: draft.customerMobile } : {}),
        ...(text(baseline.customerEmail) !== text(draft.customerEmail) ? { customerEmail: draft.customerEmail } : {}),
      },
    });
  }

  const draftLines = new Map(draft.lines.map((line) => [identityKey(line.identity), line]));
  for (const line of baseline.lines) {
    if (line.identity.kind !== 'persisted') continue;
    const current = draftLines.get(identityKey(line.identity));
    if (!current) {
      push({ code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: line.identity.id }, payload: {} });
      continue;
    }
    appendLineChanges(line, current, push);
  }
  for (const line of draft.lines) {
    if (line.identity.kind !== 'local') continue;
    appendAddedLine(line, push);
  }
  appendPreferenceChanges(baseline.preferences, draft.preferences, { kind: 'ORDER' }, push);
  for (const change of draft.unlisted ?? []) {
    push({ code: 'CHANGE_UNLISTED', target: change.target, payload: { field: change.field, value: change.value } });
  }
  return operations;
}

function appendLineChanges(
  baseline: EditLineDraft,
  draft: EditLineDraft,
  push: (operation: Omit<EditChangeOperation, 'seq'>) => void,
): void {
  if (baseline.identity.kind !== 'persisted') return;
  if (baseline.quantity !== draft.quantity) {
    push({
      code: 'CHANGE_ITEM_QUANTITY',
      target: { kind: 'PERSISTED_ITEM', id: baseline.identity.id },
      payload: {
        quantity: draft.quantity,
        ...(draft.selectedPieceIds ? { selectedPieceIds: draft.selectedPieceIds } : {}),
      },
    });
  }
  const draftPieces = new Map(draft.pieces.map((piece) => [identityKey(piece.identity), piece]));
  for (const piece of baseline.pieces) {
    if (piece.identity.kind !== 'persisted') continue;
    const current = draftPieces.get(identityKey(piece.identity));
    if (!current) {
      push({ code: 'REMOVE_PIECE', target: { kind: 'PERSISTED_PIECE', id: piece.identity.id }, payload: {} });
      continue;
    }
    appendPreferenceChanges(piece.preferences, current.preferences, { kind: 'PERSISTED_PIECE', id: piece.identity.id }, push);
  }
  for (const piece of draft.pieces) {
    if (piece.identity.kind !== 'local') continue;
    push({
      code: 'ADD_PIECE',
      target: { kind: 'PERSISTED_ITEM', id: baseline.identity.id },
      payload: piecePayload(piece),
    });
    for (const preference of piece.preferences) {
      if (preference.identity.kind !== 'local') continue;
      push({
        code: 'ADD_PREFERENCE',
        target: { kind: 'LOCAL_PIECE', clientRef: piece.identity.clientRef },
        payload: preferencePayload(preference),
      });
    }
  }
  appendPreferenceChanges(baseline.preferences, draft.preferences, { kind: 'PERSISTED_ITEM', id: baseline.identity.id }, push);
}

function appendAddedLine(line: EditLineDraft, push: (operation: Omit<EditChangeOperation, 'seq'>) => void): void {
  if (line.identity.kind !== 'local') return;
  push({
    code: 'ADD_ITEM',
    target: { kind: 'ORDER' },
    payload: {
      clientRef: line.identity.clientRef,
      productId: line.productId,
      quantity: line.quantity,
      ...(line.priceOverride ? { priceOverride: line.priceOverride, ...(line.overrideReason ? { overrideReason: line.overrideReason } : {}) } : {}),
    },
  });
  for (const piece of line.pieces) {
    if (piece.identity.kind !== 'local') continue;
    push({
      code: 'ADD_PIECE',
      target: { kind: 'LOCAL_ITEM', clientRef: line.identity.clientRef },
      payload: piecePayload(piece),
    });
    for (const preference of piece.preferences) {
      if (preference.identity.kind !== 'local') continue;
      push({
        code: 'ADD_PREFERENCE',
        target: { kind: 'LOCAL_PIECE', clientRef: piece.identity.clientRef },
        payload: preferencePayload(preference),
      });
    }
  }
  for (const preference of line.preferences) {
    if (preference.identity.kind !== 'local') continue;
    push({
      code: 'ADD_PREFERENCE',
      target: { kind: 'LOCAL_ITEM', clientRef: line.identity.clientRef },
      payload: preferencePayload(preference),
    });
  }
}

function appendPreferenceChanges(
  baseline: readonly EditPreferenceDraft[],
  draft: readonly EditPreferenceDraft[],
  target: EditChangeOperation extends { code: 'ADD_PREFERENCE'; target: infer T } ? T : never,
  push: (operation: Omit<EditChangeOperation, 'seq'>) => void,
): void {
  const draftPreferences = new Map(draft.map((preference) => [identityKey(preference.identity), preference]));
  for (const preference of baseline) {
    if (preference.identity.kind !== 'persisted') continue;
    const current = findByKey(draft, identityKey(preference.identity));
    if (!current) {
      push({ code: 'REMOVE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: preference.identity.id }, payload: {} });
      continue;
    }
    if (preferenceContent(preference) !== preferenceContent(current)) {
      push({
        code: 'CHANGE_PREFERENCE',
        target: { kind: 'PERSISTED_PREFERENCE', id: preference.identity.id },
        payload: { preferenceContent: current.preferenceContent ?? '' },
      });
    }
  }
  for (const preference of draft) {
    if (preference.identity.kind !== 'local' || draftPreferences.get(identityKey(preference.identity)) == null) continue;
    if (target.kind === 'ORDER' || target.kind === 'PERSISTED_ITEM' || target.kind === 'PERSISTED_PIECE' || target.kind === 'LOCAL_ITEM' || target.kind === 'LOCAL_PIECE') {
      push({ code: 'ADD_PREFERENCE', target, payload: preferencePayload(preference) });
    }
  }
}

function piecePayload(piece: EditPieceDraft): { clientRef: string; color?: string; brand?: string; hasStain?: boolean; hasDamage?: boolean; notes?: string } {
  if (piece.identity.kind !== 'local') return { clientRef: '' };
  return {
    clientRef: piece.identity.clientRef,
    ...(piece.color ? { color: piece.color } : {}),
    ...(piece.brand ? { brand: piece.brand } : {}),
    ...(piece.hasStain != null ? { hasStain: piece.hasStain } : {}),
    ...(piece.hasDamage != null ? { hasDamage: piece.hasDamage } : {}),
    ...(piece.notes ? { notes: piece.notes } : {}),
  };
}

function preferencePayload(preference: EditPreferenceDraft): { clientRef: string; preferenceId: string; preferenceCode: string; preferenceContent?: string } {
  return {
    clientRef: preference.identity.kind === 'local' ? preference.identity.clientRef : '',
    preferenceId: preference.preferenceId,
    preferenceCode: preference.preferenceCode,
    ...(preference.preferenceContent != null ? { preferenceContent: preference.preferenceContent } : {}),
  };
}
