/**
 * Shared mappers for Processing modal / Simple processing dialog.
 * Keeps piece UUID checks and DB→UI mapping consistent across both surfaces.
 */

import type { ItemPiece, OrderItemPiece, ProcessingStep } from '@/types/order';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when the id is a real DB piece UUID (batch-update drops synthetic ids).
 */
export function isPieceUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * Map DB piece row to UI ItemPiece. `is_ready` is the source of truth for Ready.
 */
export function mapDbPieceToItemPiece(
  dbPiece: OrderItemPiece & { is_ready?: boolean | null },
  itemId: string
): ItemPiece {
  const isReady = dbPiece.is_ready ?? false;
  const pieceStatus = dbPiece.piece_status;

  return {
    id: dbPiece.id,
    itemId,
    pieceNumber: dbPiece.piece_seq,
    isReady: isReady || pieceStatus === 'ready',
    currentStep: dbPiece.last_step as ProcessingStep | undefined,
    notes: dbPiece.notes || '',
    rackLocation: dbPiece.rack_location || '',
    isRejected: dbPiece.is_rejected || false,
    has_stain: dbPiece.has_stain || null,
    has_damage: dbPiece.has_damage || null,
    barcode: dbPiece.barcode || null,
    piece_code: dbPiece.piece_code || null,
    scan_state: dbPiece.scan_state || null,
    piece_status: pieceStatus || null,
    piece_stage: dbPiece.piece_stage || null,
    is_ready: isReady ?? null,
    packingPrefCode: dbPiece.packing_pref_code || null,
    servicePrefs: dbPiece.service_prefs || undefined,
    colorPrefs: dbPiece.color_prefs || undefined,
  };
}

export type NormalizedOrderState = {
  order: Record<string, unknown> | null;
  items: Array<Record<string, unknown>>;
  customer: Record<string, unknown> | null;
};

/**
 * Normalize `/api/v1/orders/[id]/state` response shapes used by processing UIs.
 */
export function normalizeOrderStateResponse(json: unknown): NormalizedOrderState {
  const body = json as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return { order: null, items: [], customer: null };
  }

  let order: Record<string, unknown> | null = null;
  let items: Array<Record<string, unknown>> = [];

  if (body.success && body.order && Array.isArray(body.items)) {
    order = body.order as Record<string, unknown>;
    items = body.items as Array<Record<string, unknown>>;
  } else if (body.success && body.data && typeof body.data === 'object') {
    const data = body.data as Record<string, unknown>;
    order = (data.order as Record<string, unknown>) || null;
    items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  } else if (body.order && Array.isArray(body.items)) {
    order = body.order as Record<string, unknown>;
    items = body.items as Array<Record<string, unknown>>;
  }

  const customer =
    (body.customer as Record<string, unknown> | undefined) ||
    (order?.customer as Record<string, unknown> | undefined) ||
    null;

  return { order, items, customer };
}

/**
 * Whether two piece snapshots differ for Simple dialog Update dirty-check.
 */
export function hasSimplePieceChanged(
  current: ItemPiece,
  original: ItemPiece | undefined
): boolean {
  if (!original) return true;
  return (
    (current.is_ready ?? false) !== (original.is_ready ?? false) ||
    (current.notes || '') !== (original.notes || '') ||
    (current.rackLocation || '') !== (original.rackLocation || '') ||
    current.isRejected !== original.isRejected
  );
}
