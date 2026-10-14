import type { OrderChangeContext, OrderChangeContextPreference } from '@/lib/types/order-change';
import type { OrderItem, OrderItemServicePref } from '@features/orders/model/new-order-types';
import type { EditOrderBaseline } from './edit-order-view-model';
import type { EditOrderController } from './edit-order-controller';

/** Header fields the shared workspace can show. Line edits stay on the Edit controller. */
export interface VisualEditDraft {
  notes?: string;
  customerNotes?: string;
  readyBy?: string;
  express?: boolean;
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
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
 * Copy the shared workspace header into the Edit controller.
 * The Create reducer is not asked to build the Change.
 */
export function applyVisualDraftToController(
  controller: EditOrderController,
  baseline: EditOrderBaseline,
  visual: VisualEditDraft,
): void {
  controller.load(baseline);
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
  return count;
}
