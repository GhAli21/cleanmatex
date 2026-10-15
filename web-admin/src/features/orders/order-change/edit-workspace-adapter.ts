import type { OrderChangeContext, OrderChangeContextPreference } from '@/lib/types/order-change';
import type { OrderItem, OrderItemServicePref, PreSubmissionPiece } from '@features/orders/model/new-order-types';
import type { EditUnlistedChange } from './change-builder';
import type { EditOrderBaseline, EditPieceDraft, EditPreferenceDraft, EditRowIdentity } from './edit-order-view-model';
import type { EditOrderController } from './edit-order-controller';

/** Header fields and the current cart. Review copies both into the Edit controller. */
export interface VisualEditDraft {
  notes?: string;
  customerNotes?: string;
  readyBy?: string;
  express?: boolean;
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
  items?: OrderItem[];
  orderServicePrefs?: OrderItemServicePref[];
}

function text(value: string | undefined): string {
  return value ?? '';
}

function visualPreference(preference: OrderChangeContextPreference): OrderItemServicePref | null {
  if (!preference.preferenceId) return null;
  const extra = Number(preference.extraPrice);
  return {
    preference_code: preference.preferenceCode,
    source: 'committed',
    extra_price: Number.isFinite(extra) ? extra : 0,
    preferenceCfId: preference.preferenceId,
    persistedId: preference.id,
  };
}

function preferencesAt(
  context: OrderChangeContext,
  level: string,
  itemId: string | null,
  pieceId: string | null,
): OrderItemServicePref[] {
  return context.preferences.flatMap((preference) => {
    if (preference.level !== level || preference.orderItemId !== itemId || preference.orderItemPieceId !== pieceId) return [];
    const mapped = visualPreference(preference);
    return mapped ? [mapped] : [];
  });
}

/**
 * Project committed rows into the shared workspace.
 * Piece and preference ids stay the database UUIDs.
 */
export function projectEditVisualOrder(context: OrderChangeContext): {
  items: OrderItem[];
  orderServicePrefs: OrderItemServicePref[];
} {
  return {
    orderServicePrefs: preferencesAt(context, 'ORDER', null, null),
    items: context.items.flatMap((item) => {
      if (!item.productId || item.quantity == null || item.quantity < 1) return [];
      const servicePrefs = preferencesAt(context, 'ITEM', item.id, null);
      return [{
        persistedItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        productName2: item.productName2,
        quantity: item.quantity,
        pricePerUnit: Number(item.pricePerUnit),
        totalPrice: Number(item.totalPrice),
        defaultSellPrice: null,
        defaultExpressSellPrice: null,
        serviceCategoryCode: item.serviceCategoryCode ?? undefined,
        servicePrefs: servicePrefs.length > 0 ? servicePrefs : undefined,
        pieces: context.pieces.filter((piece) => piece.orderItemId === item.id).map((piece) => {
          const piecePrefs = preferencesAt(context, 'PIECE', item.id, piece.id);
          return {
            id: piece.id,
            persistedId: piece.id,
            itemId: item.id,
            pieceSeq: piece.pieceSeq,
            servicePrefs: piecePrefs.length > 0 ? piecePrefs : undefined,
          };
        }),
      }];
    }),
  };
}

/**
 * Copy the shared workspace into the Edit controller.
 * The Create reducer is not asked to build the Change.
 */
export function applyVisualDraftToController(
  controller: EditOrderController,
  baseline: EditOrderBaseline,
  visual: VisualEditDraft,
): void {
  controller.load(baseline);
  if (visual.items) applyVisualLines(controller, baseline, visual.items);
  if (visual.orderServicePrefs) {
    syncPreferences(controller, baseline.preferences, visual.orderServicePrefs, 'ORDER', undefined, { kind: 'ORDER' });
  }
  if (text(visual.notes) !== text(baseline.notes)) controller.setNotes(text(visual.notes));
  if (text(visual.customerNotes) !== text(baseline.customerNotes)) controller.setCustomerNotes(text(visual.customerNotes));
  const nextReadyBy = text(visual.readyBy);
  if (visual.readyBy !== undefined && nextReadyBy !== text(baseline.readyBy)) {
    if (nextReadyBy) controller.setReadyBy(nextReadyBy);
    else controller.recordUnlisted({ target: { kind: 'ORDER' }, field: 'order.readyBy', value: '' });
  }
  const baselineExpress = baseline.serviceSpeed === 'EXPRESS';
  if (visual.express !== undefined && visual.express !== baselineExpress) {
    controller.setServiceSpeed(visual.express ? 'EXPRESS' : 'STANDARD');
  }
  const name = text(visual.customerName);
  const mobile = text(visual.customerMobile);
  const email = text(visual.customerEmail);
  if (name !== text(baseline.customerName) || mobile !== text(baseline.customerMobile) || email !== text(baseline.customerEmail)) {
    controller.setCustomerSnapshot({ customerName: name, customerMobile: mobile, customerEmail: email });
  }
}

/** Count header differences without asking the shared screen to choose an API. */
export function visualHeaderChangeCount(baseline: EditOrderBaseline, visual: VisualEditDraft): number {
  let count = 0;
  if (text(visual.notes) !== text(baseline.notes)) count += 1;
  if (text(visual.customerNotes) !== text(baseline.customerNotes)) count += 1;
  if (visual.readyBy !== undefined && text(visual.readyBy) !== text(baseline.readyBy)) count += 1;
  if (visual.express !== undefined && visual.express !== (baseline.serviceSpeed === 'EXPRESS')) count += 1;
  if (text(visual.customerName) !== text(baseline.customerName)) count += 1;
  if (text(visual.customerMobile) !== text(baseline.customerMobile)) count += 1;
  if (text(visual.customerEmail) !== text(baseline.customerEmail)) count += 1;
  if (visual.items) count += visualLineChangeCount(baseline, visual.items);
  if (visual.orderServicePrefs) count += preferenceChangeCount(baseline.preferences, visual.orderServicePrefs);
  return count;
}

function applyVisualLines(controller: EditOrderController, baseline: EditOrderBaseline, items: readonly OrderItem[]): void {
  const byPersistedId = new Map(items.flatMap((item) => item.persistedItemId ? [[item.persistedItemId, item] as const] : []));
  for (const line of baseline.lines) {
    if (line.identity.kind !== 'persisted') continue;
    const current = byPersistedId.get(line.identity.id);
    if (!current) {
      controller.removeLine(line.identity);
      continue;
    }
    syncPersistedLine(controller, line, current);
  }
  for (const item of items) {
    if (item.persistedItemId) continue;
    const override = moneyOverride(item.priceOverride);
    const identity = controller.addItem({
      productId: item.productId,
      quantity: item.quantity,
      ...(override ? { priceOverride: override } : {}),
      ...(item.overrideReason ? { overrideReason: item.overrideReason } : {}),
    });
    syncPreferences(controller, [], item.servicePrefs, 'ITEM', identity, localTarget('LOCAL_ITEM', identity));
    recordUnlisted(controller, itemExtras(item, localTarget('LOCAL_ITEM', identity)));
    for (const piece of localPieces(item, new Set())) {
      const pieceIdentity = controller.addPiece(identity, pieceFields(piece));
      syncPreferences(controller, [], piece.servicePrefs, 'PIECE', pieceIdentity, localTarget('LOCAL_PIECE', pieceIdentity));
      recordUnlisted(controller, newPieceExtras(piece, localTarget('LOCAL_PIECE', pieceIdentity)));
    }
  }
}

function syncPersistedLine(controller: EditOrderController, line: EditOrderBaseline['lines'][number], item: OrderItem): void {
  const known = new Set(line.pieces.flatMap((piece) => piece.identity.kind === 'persisted' ? [piece.identity.id] : []));
  const kept = new Set((item.pieces ?? []).flatMap((piece) => {
    const id = persistedPieceId(piece, known);
    return id ? [id] : [];
  }));
  const removed = [...known].filter((id) => !kept.has(id));
  const delta = item.quantity - line.quantity;
  if (delta !== 0) {
    controller.setQuantity(line.identity, item.quantity, delta < 0 && removed.length === Math.abs(delta) ? removed : undefined);
  }
  if (delta > 0 && known.size > 0) {
    for (const piece of localPieces(item, known).slice(0, delta)) {
      const pieceIdentity = controller.addPiece(line.identity, pieceFields(piece));
      syncPreferences(controller, [], piece.servicePrefs, 'PIECE', pieceIdentity, localTarget('LOCAL_PIECE', pieceIdentity));
      recordUnlisted(controller, newPieceExtras(piece, localTarget('LOCAL_PIECE', pieceIdentity)));
    }
  }
  syncPreferences(controller, line.preferences, item.servicePrefs, 'ITEM', line.identity, persistedTarget('PERSISTED_ITEM', line.identity));
  recordUnlisted(controller, persistedItemExtras(line, item));
  for (const piece of item.pieces ?? []) {
    const id = persistedPieceId(piece, known);
    if (!id) continue;
    const current = line.pieces.find((row) => row.identity.kind === 'persisted' && row.identity.id === id);
    if (!current) continue;
    syncPreferences(controller, current.preferences, piece.servicePrefs, 'PIECE', current.identity, { kind: 'PERSISTED_PIECE', id });
    recordUnlisted(controller, persistedPieceExtras(current, piece));
  }
}

function visualLineChangeCount(baseline: EditOrderBaseline, items: readonly OrderItem[]): number {
  const byPersistedId = new Map(items.flatMap((item) => item.persistedItemId ? [[item.persistedItemId, item] as const] : []));
  let count = 0;
  for (const item of items) {
    if (item.persistedItemId) continue;
    count += 1;
    count += preferenceChangeCount([], item.servicePrefs) + itemExtras(item).length;
    for (const piece of item.pieces ?? []) {
      count += preferenceChangeCount([], piece.servicePrefs) + newPieceExtras(piece).length;
    }
  }
  for (const line of baseline.lines) {
    if (line.identity.kind !== 'persisted') continue;
    const current = byPersistedId.get(line.identity.id);
    if (!current) {
      count += 1;
      continue;
    }
    if (current.quantity !== line.quantity) count += 1;
    count += preferenceChangeCount(line.preferences, current.servicePrefs);
    count += persistedItemExtras(line, current).length;
    const known = new Set(line.pieces.flatMap((piece) => piece.identity.kind === 'persisted' ? [piece.identity.id] : []));
    const delta = current.quantity - line.quantity;
    const addedPieces = delta > 0 && known.size > 0 ? localPieces(current, known).slice(0, delta) : [];
    for (const piece of addedPieces) {
      count += preferenceChangeCount([], piece.servicePrefs) + newPieceExtras(piece).length;
    }
    for (const piece of current.pieces ?? []) {
      const id = persistedPieceId(piece, known);
      if (!id) continue;
      const baselinePiece = line.pieces.find((row) => row.identity.kind === 'persisted' && row.identity.id === id);
      if (!baselinePiece) continue;
      count += preferenceChangeCount(baselinePiece.preferences, piece.servicePrefs);
      count += persistedPieceExtras(baselinePiece, piece).length;
    }
  }
  return count;
}

function persistedPieceId(piece: NonNullable<OrderItem['pieces']>[number], known: ReadonlySet<string>): string | undefined {
  if (piece.persistedId && known.has(piece.persistedId)) return piece.persistedId;
  return known.has(piece.id) ? piece.id : undefined;
}

function localPieces(item: OrderItem, known: ReadonlySet<string>): NonNullable<OrderItem['pieces']> {
  return (item.pieces ?? []).filter((piece) => !persistedPieceId(piece, known));
}

function pieceFields(piece: NonNullable<OrderItem['pieces']>[number]): { color?: string; brand?: string; hasStain?: boolean; hasDamage?: boolean; notes?: string } {
  return {
    color: piece.color,
    brand: piece.brand,
    hasStain: piece.hasStain,
    hasDamage: piece.hasDamage,
    notes: piece.notes,
  };
}

function moneyOverride(value: number | null | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value.toFixed(4);
}

const PREFERENCE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function syncPreferences(
  controller: EditOrderController,
  baseline: readonly EditPreferenceDraft[],
  visual: readonly OrderItemServicePref[] | undefined,
  level: 'ORDER' | 'ITEM' | 'PIECE',
  parent: EditRowIdentity | undefined,
  target: EditUnlistedChange['target'],
): void {
  const rows = visual ?? [];
  const kept = new Set(rows.flatMap((row) => row.persistedId ? [row.persistedId] : []));
  for (const row of baseline) {
    if (row.identity.kind !== 'persisted' || kept.has(row.identity.id)) continue;
    controller.removePreference(row.identity);
  }
  for (const row of rows) {
    if (row.persistedId) continue;
    if (row.preferenceCfId && PREFERENCE_UUID.test(row.preferenceCfId)) {
      controller.addPreference({
        level,
        parent,
        preferenceId: row.preferenceCfId,
        preferenceCode: row.preference_code,
      });
      continue;
    }
    controller.recordUnlisted({ target, field: 'preference.code', value: row.preference_code });
  }
}

function preferenceChangeCount(baseline: readonly EditPreferenceDraft[], visual: readonly OrderItemServicePref[] | undefined): number {
  const rows = visual ?? [];
  const kept = new Set(rows.flatMap((row) => row.persistedId ? [row.persistedId] : []));
  const removed = baseline.filter((row) => row.identity.kind === 'persisted' && !kept.has(row.identity.id)).length;
  return removed + rows.filter((row) => !row.persistedId).length;
}

function recordUnlisted(controller: EditOrderController, changes: readonly EditUnlistedChange[]): void {
  for (const change of changes) controller.recordUnlisted(change);
}

function localTarget(kind: 'LOCAL_ITEM' | 'LOCAL_PIECE', identity: EditRowIdentity): EditUnlistedChange['target'] {
  if (identity.kind !== 'local') throw new Error('EDIT_TARGET_KIND');
  return { kind, clientRef: identity.clientRef };
}

function persistedTarget(kind: 'PERSISTED_ITEM' | 'PERSISTED_PIECE', identity: EditRowIdentity): EditUnlistedChange['target'] {
  if (identity.kind !== 'persisted') throw new Error('EDIT_TARGET_KIND');
  return { kind, id: identity.id };
}

function itemExtras(item: OrderItem, target: EditUnlistedChange['target'] = { kind: 'ORDER' }): EditUnlistedChange[] {
  return textChanges(target, [
    ['item.notes', '', text(item.notes)],
    ['item.packing', '', text(item.packingPrefCode)],
    ['item.stainNotes', '', text(item.stainNotes)],
    ['item.damageNotes', '', text(item.damageNotes)],
    ...flagChange('item.stain', undefined, item.hasStain),
    ...flagChange('item.damage', undefined, item.hasDamage),
  ]);
}

function persistedItemExtras(line: EditOrderBaseline['lines'][number], item: OrderItem): EditUnlistedChange[] {
  if (line.identity.kind !== 'persisted') return [];
  const target: EditUnlistedChange['target'] = { kind: 'PERSISTED_ITEM', id: line.identity.id };
  return textChanges(target, [
    ['item.priceOverride', line.priceOverride ?? '', moneyOverride(item.priceOverride) ?? ''],
    ['item.overrideReason', text(line.overrideReason), text(item.overrideReason ?? undefined)],
    ['item.notes', '', text(item.notes)],
    ['item.packing', '', text(item.packingPrefCode)],
    ['item.stainNotes', '', text(item.stainNotes)],
    ['item.damageNotes', '', text(item.damageNotes)],
    ...flagChange('item.stain', undefined, item.hasStain),
    ...flagChange('item.damage', undefined, item.hasDamage),
  ]);
}

function persistedPieceExtras(piece: EditPieceDraft, visual: PreSubmissionPiece): EditUnlistedChange[] {
  if (piece.identity.kind !== 'persisted') return [];
  const target: EditUnlistedChange['target'] = { kind: 'PERSISTED_PIECE', id: piece.identity.id };
  return textChanges(target, [
    ['piece.color', text(piece.color), text(visual.color)],
    ['piece.brand', text(piece.brand), text(visual.brand)],
    ['piece.notes', text(piece.notes), text(visual.notes)],
    ['piece.conditions', '', (visual.conditions ?? []).join(',')],
    ['piece.packing', '', text(visual.packingPrefCode)],
    ...flagChange('piece.stain', piece.hasStain, visual.hasStain),
    ...flagChange('piece.damage', piece.hasDamage, visual.hasDamage),
  ]);
}

function newPieceExtras(piece: PreSubmissionPiece, target: EditUnlistedChange['target'] = { kind: 'ORDER' }): EditUnlistedChange[] {
  return textChanges(target, [
    ['piece.conditions', '', (piece.conditions ?? []).join(',')],
    ['piece.packing', '', text(piece.packingPrefCode)],
  ]);
}

function textChanges(target: EditUnlistedChange['target'], rows: Array<[string, string, string]>): EditUnlistedChange[] {
  return rows.flatMap(([field, before, after]) => before === after ? [] : [{ target, field, value: after }]);
}

function flagChange(field: string, before: boolean | undefined, after: boolean | undefined): Array<[string, string, string]> {
  const left = before === true;
  const right = after === true;
  if (left === right) return [];
  return [[field, left ? 'true' : '', right ? 'true' : '']];
}
