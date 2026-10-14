/**
 * Edit identity is the persisted row, not the product.
 * Create continues to group lines by product. This model is only for a Change.
 */

import type { OrderChangeContext } from '@/lib/types/order-change';

export type EditRowIdentity =
  | { kind: 'persisted'; id: string }
  | { kind: 'local'; clientRef: string };

export interface EditPreferenceDraft {
  identity: EditRowIdentity;
  preferenceId: string;
  preferenceCode: string;
  preferenceContent?: string;
}

export interface EditPieceDraft {
  identity: EditRowIdentity;
  color?: string;
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  preferences: EditPreferenceDraft[];
}

export interface EditLineDraft {
  identity: EditRowIdentity;
  productId: string;
  quantity: number;
  priceOverride?: string;
  overrideReason?: string;
  selectedPieceIds?: string[];
  pieces: EditPieceDraft[];
  preferences: EditPreferenceDraft[];
}

export interface EditOrderBaseline {
  orderId: string;
  expectedEditStateVersion: number;
  expectedWfStateVersion: number;
  sourceContext: string;
  priority?: string;
  serviceSpeed?: 'STANDARD' | 'EXPRESS';
  readyBy?: string;
  notes?: string;
  customerNotes?: string;
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
  lines: EditLineDraft[];
  preferences: EditPreferenceDraft[];
}

export interface LoadedEditPreference {
  id?: string;
  preference_code?: string;
  preference_id?: string;
  preferenceCfId?: string | null;
  preference_content?: string;
}

export interface LoadedEditPiece {
  id?: string;
  color?: string;
  brand?: string;
  has_stain?: boolean;
  has_damage?: boolean;
  notes?: string;
  service_prefs?: LoadedEditPreference[];
}

export interface LoadedEditItem {
  id?: string;
  product_id?: string;
  quantity?: number;
  price_override?: number | string | null;
  override_reason?: string | null;
  pieces?: LoadedEditPiece[];
  service_prefs?: LoadedEditPreference[];
}

export interface LoadedEditOrder {
  edit_state_version?: number | null;
  state_version?: number | null;
  priority?: string | null;
  service_speed?: string | null;
  ready_by?: string | null;
  ready_by_at?: string | null;
  internal_notes?: string | null;
  notes?: string | null;
  customer_notes?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  customer_email?: string | null;
  items?: LoadedEditItem[];
  order_service_prefs?: LoadedEditPreference[];
}

export type EditBaselineResult =
  | { ok: true; baseline: EditOrderBaseline }
  | { ok: false; code: 'EDIT_BASELINE_INVALID' };

function persistedPreference(row: LoadedEditPreference): EditPreferenceDraft | null {
  if (!row.id || !row.preference_code) return null;
  const preferenceId = row.preference_id ?? row.preferenceCfId;
  if (!preferenceId) return null;
  return {
    identity: { kind: 'persisted', id: row.id },
    preferenceId,
    preferenceCode: row.preference_code,
    preferenceContent: row.preference_content,
  };
}

function priceOverride(value: number | string | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const text = typeof value === 'number' ? value.toFixed(4) : value;
  return /^\d+(\.\d{1,4})?$/.test(text) ? text : undefined;
}

/**
 * Copy a loaded order into Edit identities.
 * A line or piece without its database id is rejected so a Change cannot target the product instead.
 */
export function mapLoadedOrderToEditBaseline(order: LoadedEditOrder, orderId: string): EditBaselineResult {
  const editVersion = order.edit_state_version;
  const workflowVersion = order.state_version;
  if (!orderId || editVersion == null || editVersion < 1 || workflowVersion == null || workflowVersion < 1) {
    return { ok: false, code: 'EDIT_BASELINE_INVALID' };
  }
  const lines: EditLineDraft[] = [];
  for (const item of order.items ?? []) {
    if (!item.id || !item.product_id || item.quantity == null || item.quantity < 1) {
      return { ok: false, code: 'EDIT_BASELINE_INVALID' };
    }
    const pieces: EditPieceDraft[] = [];
    for (const piece of item.pieces ?? []) {
      if (!piece.id) return { ok: false, code: 'EDIT_BASELINE_INVALID' };
      pieces.push({
        identity: { kind: 'persisted', id: piece.id },
        color: piece.color,
        brand: piece.brand,
        hasStain: piece.has_stain,
        hasDamage: piece.has_damage,
        notes: piece.notes,
        preferences: (piece.service_prefs ?? []).flatMap((row) => {
          const preference = persistedPreference(row);
          return preference ? [preference] : [];
        }),
      });
    }
    lines.push({
      identity: { kind: 'persisted', id: item.id },
      productId: item.product_id,
      quantity: item.quantity,
      priceOverride: priceOverride(item.price_override),
      overrideReason: item.override_reason ?? undefined,
      pieces,
      preferences: (item.service_prefs ?? []).flatMap((row) => {
        const preference = persistedPreference(row);
        return preference ? [preference] : [];
      }),
    });
  }
  const speed = order.service_speed === 'STANDARD' || order.service_speed === 'EXPRESS' ? order.service_speed : undefined;
  const readyBy = order.ready_by ?? order.ready_by_at ?? undefined;
  return {
    ok: true,
    baseline: {
      orderId,
      expectedEditStateVersion: editVersion,
      expectedWfStateVersion: workflowVersion,
      sourceContext: 'order-edit',
      priority: order.priority ?? undefined,
      serviceSpeed: speed,
      readyBy: readyBy ?? undefined,
      notes: order.internal_notes ?? order.notes ?? undefined,
      customerNotes: order.customer_notes ?? undefined,
      customerName: order.customer_name ?? undefined,
      customerMobile: order.customer_mobile ?? undefined,
      customerEmail: order.customer_email ?? undefined,
      lines,
      preferences: (order.order_service_prefs ?? []).flatMap((row) => {
        const preference = persistedPreference(row);
        return preference ? [preference] : [];
      }),
    },
  };
}

export function sameIdentity(left: EditRowIdentity, right: EditRowIdentity): boolean {
  if (left.kind !== right.kind) return false;
  return left.kind === 'persisted' ? left.id === (right as { id: string }).id : left.clientRef === (right as { clientRef: string }).clientRef;
}

export function identityKey(identity: EditRowIdentity): string {
  return identity.kind === 'persisted' ? `persisted:${identity.id}` : `local:${identity.clientRef}`;
}

/**
 * Build the Edit baseline from the Change context.
 * Lines stay separate even when they share a product. A preference without a catalog id is left out.
 */
export function mapChangeContextToEditBaseline(context: OrderChangeContext): EditBaselineResult {
  const preferencesFor = (level: string, itemId: string | null, pieceId: string | null): EditPreferenceDraft[] => (
    context.preferences.flatMap((preference) => {
      if (preference.level !== level || preference.orderItemId !== itemId || preference.orderItemPieceId !== pieceId) return [];
      if (!preference.preferenceId) return [];
      return [{
        identity: { kind: 'persisted' as const, id: preference.id },
        preferenceId: preference.preferenceId,
        preferenceCode: preference.preferenceCode,
        preferenceContent: preference.preferenceContent ?? undefined,
      }];
    })
  );
  return mapLoadedOrderToEditBaseline({
    edit_state_version: context.editStateVersion,
    state_version: context.wfStateVersion,
    priority: context.order.priority,
    service_speed: context.order.serviceSpeed,
    ready_by: context.order.readyBy,
    internal_notes: context.order.notes,
    customer_notes: context.order.customerNotes,
    customer_name: context.order.customerSnapshot.name,
    customer_mobile: context.order.customerSnapshot.mobile,
    customer_email: context.order.customerSnapshot.email,
    items: context.items.map((item) => ({
      id: item.id,
      product_id: item.productId ?? undefined,
      quantity: item.quantity ?? undefined,
      pieces: context.pieces.filter((piece) => piece.orderItemId === item.id).map((piece) => ({
        id: piece.id,
        service_prefs: preferencesFor('PIECE', item.id, piece.id).map((preference) => ({
          id: preference.identity.kind === 'persisted' ? preference.identity.id : undefined,
          preference_code: preference.preferenceCode,
          preference_id: preference.preferenceId,
          preference_content: preference.preferenceContent,
        })),
      })),
      service_prefs: preferencesFor('ITEM', item.id, null).map((preference) => ({
        id: preference.identity.kind === 'persisted' ? preference.identity.id : undefined,
        preference_code: preference.preferenceCode,
        preference_id: preference.preferenceId,
        preference_content: preference.preferenceContent,
      })),
    })),
    order_service_prefs: preferencesFor('ORDER', null, null).map((preference) => ({
      id: preference.identity.kind === 'persisted' ? preference.identity.id : undefined,
      preference_code: preference.preferenceCode,
      preference_id: preference.preferenceId,
      preference_content: preference.preferenceContent,
    })),
  }, context.orderId);
}

export function deniedOperationReasons(decisions: readonly { operationCode: string; decision: string; reasonCode: string }[]): Record<string, string> {
  const reasons: Record<string, string> = {};
  for (const decision of decisions) {
    if (decision.decision === 'DENY') reasons[decision.operationCode] = decision.reasonCode;
  }
  return reasons;
}

