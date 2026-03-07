/**
 * useOrderEditDirty Hook
 * Detects if the order form has unsaved changes compared to original data
 */

'use client';

import { useMemo } from 'react';
import { useNewOrderState } from '../ui/context/new-order-context';
import type { OrderItem, PreSubmissionPiece } from '../model/new-order-types';

function normalizeReadyByAt(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function piecesEqual(
  a: PreSubmissionPiece[] | undefined,
  b: Array<Record<string, unknown>> | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i];
    const pb = b[i] as { piece_seq?: number; color?: string; brand?: string; has_stain?: boolean; has_damage?: boolean; notes?: string; rack_location?: string };
    const paSeq = pa.pieceSeq ?? i + 1;
    const pbSeq = pb.piece_seq ?? i + 1;
    if (
      paSeq !== pbSeq ||
      (pa.color ?? '') !== (pb.color ?? '') ||
      (pa.brand ?? '') !== (pb.brand ?? '') ||
      (pa.hasStain ?? false) !== (pb.has_stain ?? false) ||
      (pa.hasDamage ?? false) !== (pb.has_damage ?? false) ||
      (pa.notes ?? '') !== (pb.notes ?? '') ||
      (pa.rackLocation ?? '') !== (pb.rack_location ?? '')
    ) {
      return false;
    }
  }
  return true;
}

function itemsEqual(current: OrderItem[], original: Array<Record<string, unknown>> | undefined): boolean {
  if (!original) return current.length === 0;
  if (current.length !== original.length) return false;

  const origMap = new Map(original.map((o) => [(o.product_id ?? o.productId) as string, o]));

  for (const item of current) {
    const orig = origMap.get(item.productId);
    if (!orig) return false;

    const o = orig as {
      quantity?: number;
      price_per_unit?: number;
      notes?: string;
      pieces?: Array<Record<string, unknown>>;
      price_override?: number | null;
      override_reason?: string | null;
    };

    if (
      item.quantity !== (o.quantity ?? 1) ||
      item.pricePerUnit !== (o.price_per_unit ?? 0) ||
      (item.notes ?? '') !== (o.notes ?? '') ||
      (item.priceOverride ?? null) !== (o.price_override ?? null) ||
      (item.overrideReason ?? null) !== (o.override_reason ?? null) ||
      !piecesEqual(item.pieces, o.pieces)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Returns true if the current form state differs from the original order data
 */
export function useOrderEditDirty(): { isDirty: boolean } {
  const state = useNewOrderState();

  const isDirty = useMemo(() => {
    if (!state.isEditMode || !state.originalOrderData) return false;

    const orig = state.originalOrderData as Record<string, unknown>;

    if (
      (state.customer?.id ?? null) !== (orig.customer_id ?? null) ||
      (state.branchId ?? null) !== (orig.branch_id ?? null) ||
      (state.notes ?? '') !== (orig.notes ?? '') ||
      state.express !== (orig.is_express ?? false) ||
      (state.customerNameSnapshot ?? '') !== (orig.customer_name ?? '') ||
      (state.customerMobile ?? '') !== (orig.customer_mobile ?? '') ||
      (state.customerEmail ?? '') !== (orig.customer_email ?? '')
    ) {
      return true;
    }

    const origReadyBy = normalizeReadyByAt(orig.ready_by_at as string | Date | null);
    const currReadyBy = normalizeReadyByAt(state.readyByAt);
    if (origReadyBy !== currReadyBy) return true;

    if (!itemsEqual(state.items, orig.items as Array<Record<string, unknown>> | undefined)) {
      return true;
    }

    return false;
  }, [
    state.isEditMode,
    state.originalOrderData,
    state.customer?.id,
    state.branchId,
    state.notes,
    state.express,
    state.customerNameSnapshot,
    state.customerMobile,
    state.customerEmail,
    state.readyByAt,
    state.items,
  ]);

  return { isDirty };
}
