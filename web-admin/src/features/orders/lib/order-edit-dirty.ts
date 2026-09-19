/**
 * Edit-order dirty detection.
 *
 * Compares live form state to the GET `/api/v1/orders/[id]` payload stored as
 * `originalOrderData`. The customer-details tab writes `customerNotes` and
 * `customerSnapshotOverride`, not `notes` / `customerNameSnapshot`, so those
 * must be compared explicitly or Save stays disabled.
 */

import type {
  CustomerSnapshotOverride,
  OrderItem,
  OrderItemServicePref,
  PreSubmissionPiece,
} from '../model/new-order-types';
import {
  extractColorCodesFromApiPiece,
  pieceColorCodesForDisplay,
} from './piece-color-utils';

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function readyByIso(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function prefRowsEqual(
  current: Array<Pick<OrderItemServicePref, 'preference_code' | 'extra_price' | 'preferenceCfId'>> | undefined,
  original: unknown
): boolean {
  const next = (current ?? []).map((row) => ({
    code: text(row.preference_code),
    extra: money(row.extra_price),
    id: text(row.preferenceCfId),
  }));
  const origRows = Array.isArray(original) ? original : [];
  const prev = origRows.map((row) => {
    const r = row as {
      preference_code?: unknown;
      extra_price?: unknown;
      preferenceCfId?: unknown;
      preference_cf_id?: unknown;
    };
    return {
      code: text(r.preference_code),
      extra: money(r.extra_price),
      id: text(r.preferenceCfId ?? r.preference_cf_id),
    };
  });
  if (next.length !== prev.length) return false;
  const sortKey = (a: { code: string; id: string }) => `${a.code}|${a.id}`;
  next.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  prev.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return next.every((row, i) =>
    row.code === prev[i]?.code && row.extra === prev[i]?.extra && row.id === prev[i]?.id
  );
}

function piecesEqual(
  current: PreSubmissionPiece[] | undefined,
  original: unknown
): boolean {
  const next = current ?? [];
  const prev = Array.isArray(original) ? original : [];
  if (next.length !== prev.length) return false;

  for (let i = 0; i < next.length; i++) {
    const pa = next[i];
    const pb = prev[i] as {
      piece_seq?: number;
      pieceSeq?: number;
      color?: unknown;
      brand?: string;
      has_stain?: boolean;
      hasStain?: boolean;
      has_damage?: boolean;
      hasDamage?: boolean;
      notes?: string;
      rack_location?: string;
      rackLocation?: string;
      packing_pref_code?: string;
      packingPrefCode?: string;
      packing_cf_id?: string | null;
      packingCfId?: string | null;
      service_prefs?: unknown;
      servicePrefs?: unknown;
    };
    const colorA = JSON.stringify([...pieceColorCodesForDisplay(pa)].sort());
    const colorB = JSON.stringify([...extractColorCodesFromApiPiece(pb)].sort());
    if (
      (pa.pieceSeq ?? i + 1) !== (pb.piece_seq ?? pb.pieceSeq ?? i + 1) ||
      colorA !== colorB ||
      text(pa.brand) !== text(pb.brand) ||
      Boolean(pa.hasStain) !== Boolean(pb.has_stain ?? pb.hasStain) ||
      Boolean(pa.hasDamage) !== Boolean(pb.has_damage ?? pb.hasDamage) ||
      text(pa.notes) !== text(pb.notes) ||
      text(pa.rackLocation) !== text(pb.rack_location ?? pb.rackLocation) ||
      text(pa.packingPrefCode) !== text(pb.packing_pref_code ?? pb.packingPrefCode) ||
      text(pa.packingCfId) !== text(pb.packing_cf_id ?? pb.packingCfId) ||
      !prefRowsEqual(pa.servicePrefs, pb.service_prefs ?? pb.servicePrefs)
    ) {
      return false;
    }
  }
  return true;
}

function itemsEqual(current: OrderItem[], original: unknown): boolean {
  const prev = Array.isArray(original) ? original : [];
  if (current.length !== prev.length) return false;

  const origByProduct = new Map(
    prev.map((row) => {
      const o = row as { product_id?: unknown; productId?: unknown };
      return [text(o.product_id ?? o.productId), row as Record<string, unknown>];
    })
  );

  for (const item of current) {
    const orig = origByProduct.get(text(item.productId));
    if (!orig) return false;
    if (
      item.quantity !== Number(orig.quantity ?? 1) ||
      money(item.pricePerUnit) !== money(orig.price_per_unit ?? orig.pricePerUnit) ||
      text(item.notes) !== text(orig.notes) ||
      (item.priceOverride ?? null) !== (orig.price_override ?? orig.priceOverride ?? null) ||
      text(item.overrideReason) !== text(orig.override_reason ?? orig.overrideReason) ||
      text(item.packingPrefCode) !== text(orig.packing_pref_code ?? orig.packingPrefCode) ||
      text(item.packingCfId) !== text(orig.packing_cf_id ?? orig.packingCfId) ||
      money(item.packingPrefCharge) !== money(orig.packing_pref_charge ?? orig.packingPrefCharge) ||
      !prefRowsEqual(item.servicePrefs, orig.service_prefs ?? orig.servicePrefs) ||
      !piecesEqual(item.pieces, orig.pieces)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Live edit-form fields that can enable Save Changes.
 */
export interface OrderEditDirtyCurrent {
  customerId: string | null;
  branchId: string | null;
  notes: string;
  customerNotes: string;
  paymentNotes: string;
  express: boolean;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  readyByAt: string | Date | null | undefined;
  items: OrderItem[];
  orderServicePrefs: OrderItemServicePref[];
}

/**
 * GET order payload (snake_case) stored on `originalOrderData`.
 */
export interface OrderEditDirtyOriginal {
  customer_id?: string | null;
  branch_id?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  customer_notes?: string | null;
  payment_notes?: string | null;
  is_express?: boolean;
  customer_name?: string | null;
  customer_mobile?: string | null;
  customer_email?: string | null;
  ready_by_at?: string | Date | null;
  items?: unknown;
  order_service_prefs?: unknown;
}

/**
 * Effective customer snapshot shown / submitted from the customer-details tab.
 *
 * @param override - Order-only override from the customer tab
 * @param snapshot - Values loaded from the order header
 */
export function resolveEditCustomerSnapshot(
  override: CustomerSnapshotOverride | null | undefined,
  snapshot: { name?: string; mobile?: string; email?: string }
): { name: string; mobile: string; email: string } {
  return {
    name: text(override?.name ?? snapshot.name),
    mobile: text(override?.phone ?? snapshot.mobile),
    email: text(override?.email ?? snapshot.email),
  };
}

/**
 * True when the edit form differs from the loaded order on any persistable field.
 *
 * @param current - Live reducer fields (customer tab already resolved)
 * @param original - Raw GET order object
 */
export function isOrderEditFormDirty(
  current: OrderEditDirtyCurrent,
  original: OrderEditDirtyOriginal | null | undefined
): boolean {
  if (!original) return false;

  if (text(current.customerId) !== text(original.customer_id)) return true;
  if (text(current.branchId) !== text(original.branch_id)) return true;
  if (current.express !== Boolean(original.is_express)) return true;
  if (text(current.notes) !== text(original.internal_notes ?? original.notes)) return true;
  if (text(current.customerNotes) !== text(original.customer_notes)) return true;
  if (text(current.paymentNotes) !== text(original.payment_notes)) return true;
  if (text(current.customerName) !== text(original.customer_name)) return true;
  if (text(current.customerMobile) !== text(original.customer_mobile)) return true;
  if (text(current.customerEmail) !== text(original.customer_email)) return true;
  if (readyByIso(current.readyByAt) !== readyByIso(original.ready_by_at)) return true;
  if (!prefRowsEqual(current.orderServicePrefs, original.order_service_prefs)) return true;
  if (!itemsEqual(current.items, original.items)) return true;

  return false;
}
