import type { OrderChangeContext, OrderChangeContextPreference } from '@/lib/types/order-change';
import type { OrderItem, OrderItemServicePref } from '@features/orders/model/new-order-types';
import type { EditOrderBaseline } from './edit-order-view-model';
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
  if (text(visual.notes) !== text(baseline.notes)) controller.setNotes(text(visual.notes));
  if (text(visual.customerNotes) !== text(baseline.customerNotes)) controller.setCustomerNotes(text(visual.customerNotes));
  if (visual.readyBy && visual.readyBy !== text(baseline.readyBy)) controller.setReadyBy(visual.readyBy);
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
  if (visual.readyBy && visual.readyBy !== text(baseline.readyBy)) count += 1;
  if (visual.express !== undefined && visual.express !== (baseline.serviceSpeed === 'EXPRESS')) count += 1;
  if (text(visual.customerName) !== text(baseline.customerName)) count += 1;
  if (text(visual.customerMobile) !== text(baseline.customerMobile)) count += 1;
  if (text(visual.customerEmail) !== text(baseline.customerEmail)) count += 1;
  if (visual.items) count += visualLineChangeCount(baseline, visual.items);
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
    for (const piece of localPieces(item, new Set())) {
      controller.addPiece(identity, pieceFields(piece));
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
      controller.addPiece(line.identity, pieceFields(piece));
    }
  }
}

function visualLineChangeCount(baseline: EditOrderBaseline, items: readonly OrderItem[]): number {
  const byPersistedId = new Map(items.flatMap((item) => item.persistedItemId ? [[item.persistedItemId, item] as const] : []));
  let count = items.filter((item) => !item.persistedItemId).length;
  for (const line of baseline.lines) {
    if (line.identity.kind !== 'persisted') continue;
    const current = byPersistedId.get(line.identity.id);
    if (!current) {
      count += 1;
      continue;
    }
    if (current.quantity !== line.quantity) count += 1;
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
