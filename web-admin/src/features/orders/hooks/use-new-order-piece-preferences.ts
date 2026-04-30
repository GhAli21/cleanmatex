/**
 * Actions for piece-level preference chips; writes through new-order dispatch only.
 */

'use client';

import { useCallback } from 'react';
import type { OrderItem, OrderItemServicePref, PreSubmissionPiece } from '../model/new-order-types';
import { useNewOrderStateWithDispatch } from './use-new-order-state';
import {
  applySelectedPreferencesToPiece,
  pieceToSelectedPreferences,
  renumberPreferencesForPiece,
  type SelectedPreference,
} from '../lib/selected-piece-preference';

function findItemByPieceId(items: OrderItem[], pieceId: string): OrderItem | null {
  for (const item of items) {
    if (item.pieces?.some((p) => p.id === pieceId)) return item;
  }
  return null;
}

function pieceChargeFromPieces(pieces: PreSubmissionPiece[]): number {
  return pieces.reduce(
    (sum, p) => sum + (p.servicePrefs ?? []).reduce((s, pref) => s + (pref.extra_price ?? 0), 0),
    0
  );
}

function newChipId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface AddPreferenceInput {
  preference_code: string;
  preference_sys_kind: string;
  preference_id?: string | null;
  prefs_owner_type?: string;
  prefs_source?: string;
  preference_category?: string | null;
  extra_price?: number;
}

export function useNewOrderPiecePreferences() {
  const { state, updateItemPieces, updateItemServicePrefs } = useNewOrderStateWithDispatch();

  const syncChargeForItem = useCallback(
    (productId: string, pieces: PreSubmissionPiece[], itemServicePrefs: OrderItemServicePref[] | undefined) => {
      const charge = pieceChargeFromPieces(pieces);
      updateItemServicePrefs(productId, itemServicePrefs ?? [], charge);
    },
    [updateItemServicePrefs]
  );

  const setPiecePreferences = useCallback(
    (productId: string, nextPieces: PreSubmissionPiece[]) => {
      const item = state.items.find((i) => i.productId === productId);
      if (!item) return;
      updateItemPieces(productId, nextPieces);
      syncChargeForItem(productId, nextPieces, item.servicePrefs);
    },
    [state.items, updateItemPieces, syncChargeForItem]
  );

  /** Flattened prefs for all pieces (derived; for bulk copy helpers) */
  const getAllPreferencesFlat = useCallback((): SelectedPreference[] => {
    const out: SelectedPreference[] = [];
    for (const item of state.items) {
      for (const p of item.pieces ?? []) {
        out.push(...pieceToSelectedPreferences(p));
      }
    }
    return out;
  }, [state.items]);

  const addPreference = useCallback(
    (pieceId: string, data: AddPreferenceInput) => {
      const item = findItemByPieceId(state.items, pieceId);
      if (!item?.pieces) return;
      const piece = item.pieces.find((x) => x.id === pieceId);
      if (!piece) return;

      const current = pieceToSelectedPreferences(piece);
      let baseList = current;
      if (data.preference_sys_kind === 'packing_prefs') {
        baseList = current.filter((c) => c.preference_sys_kind !== 'packing_prefs');
      }
      if (data.preference_sys_kind === 'color') {
        baseList = baseList.filter((c) => c.preference_sys_kind !== 'color');
      }
      const chip: SelectedPreference = {
        id: newChipId(),
        pieceId,
        preference_id: data.preference_id ?? null,
        preference_code: data.preference_code,
        preference_sys_kind: data.preference_sys_kind,
        prefs_owner_type: data.prefs_owner_type ?? 'USER',
        prefs_source: data.prefs_source ?? 'ORDER_CREATE',
        preference_category: data.preference_category,
        extra_price: Number(data.extra_price ?? 0),
        prefs_no: baseList.length + 1,
        prefs_level: 'PIECE',
      };
      const mergedList = renumberPreferencesForPiece([...baseList, chip], pieceId);
      const forPiece = mergedList.filter((x) => x.pieceId === pieceId);
      const updatedPiece = applySelectedPreferencesToPiece(piece, forPiece);
      const nextPieces = item.pieces.map((x) => (x.id === pieceId ? updatedPiece : x));
      setPiecePreferences(item.productId, nextPieces);
    },
    [state.items, setPiecePreferences]
  );

  const removePreference = useCallback(
    (uiId: string) => {
      const flat = getAllPreferencesFlat();
      const target = flat.find((p) => p.id === uiId);
      if (!target) return;
      const item = findItemByPieceId(state.items, target.pieceId);
      if (!item?.pieces) return;
      const piece = item.pieces.find((x) => x.id === target.pieceId);
      if (!piece) return;

      const without = flat.filter((p) => p.id !== uiId);
      const renumbered = renumberPreferencesForPiece(without, target.pieceId);
      const forPiece = renumbered.filter((p) => p.pieceId === target.pieceId);
      const updatedPiece = applySelectedPreferencesToPiece(piece, forPiece);
      const nextPieces = item.pieces.map((x) => (x.id === target.pieceId ? updatedPiece : x));
      setPiecePreferences(item.productId, nextPieces);
    },
    [state.items, getAllPreferencesFlat, setPiecePreferences]
  );

  const copyAllPreferences = useCallback(
    (sourcePieceId: string, targetPieceIds: string[]) => {
      const sourceItem = findItemByPieceId(state.items, sourcePieceId);
      if (!sourceItem?.pieces) return;
      const source = sourceItem.pieces.find((p) => p.id === sourcePieceId);
      if (!source) return;
      const template = pieceToSelectedPreferences(source);

      const productToPieces = new Map<string, PreSubmissionPiece[]>();
      for (const item of state.items) {
        if (item.pieces?.length) {
          productToPieces.set(item.productId, [...item.pieces]);
        }
      }

      for (const tid of targetPieceIds) {
        if (tid === sourcePieceId) continue;
        const item = findItemByPieceId(state.items, tid);
        if (!item) continue;
        const arr = productToPieces.get(item.productId);
        if (!arr) continue;
        const idx = arr.findIndex((p) => p.id === tid);
        if (idx < 0) continue;
        const tp = arr[idx];
        const duplicated: SelectedPreference[] = template.map((t, i) => ({
          ...t,
          id: newChipId(),
          pieceId: tid,
          prefs_no: i + 1,
        }));
        arr[idx] = applySelectedPreferencesToPiece(tp, duplicated);
      }

      for (const [productId, pieces] of productToPieces) {
        setPiecePreferences(productId, pieces);
      }
    },
    [state.items, setPiecePreferences]
  );

  const copySinglePreference = useCallback(
    (sourcePreferenceUiId: string, targetPieceIds: string[]) => {
      const flat = getAllPreferencesFlat();
      const src = flat.find((p) => p.id === sourcePreferenceUiId);
      if (!src) return;

      const productToPieces = new Map<string, PreSubmissionPiece[]>();
      for (const item of state.items) {
        if (item.pieces?.length) {
          productToPieces.set(item.productId, [...item.pieces]);
        }
      }

      for (const tid of targetPieceIds) {
        const item = findItemByPieceId(state.items, tid);
        if (!item) continue;
        const arr = productToPieces.get(item.productId);
        if (!arr) continue;
        const idx = arr.findIndex((p) => p.id === tid);
        if (idx < 0) continue;
        const tp = arr[idx];
        const current = pieceToSelectedPreferences(tp);
        const chip: SelectedPreference = {
          id: newChipId(),
          pieceId: tid,
          preference_id: src.preference_id,
          preference_code: src.preference_code,
          preference_sys_kind: src.preference_sys_kind,
          prefs_owner_type: src.prefs_owner_type,
          prefs_source: src.prefs_source,
          preference_category: src.preference_category,
          extra_price: src.extra_price,
          prefs_no: current.length + 1,
          prefs_level: 'PIECE',
        };
        const merged = renumberPreferencesForPiece([...current, chip], tid);
        const forPiece = merged.filter((p) => p.pieceId === tid);
        arr[idx] = applySelectedPreferencesToPiece(tp, forPiece);
      }

      for (const [productId, pieces] of productToPieces) {
        setPiecePreferences(productId, pieces);
      }
    },
    [state.items, getAllPreferencesFlat, setPiecePreferences]
  );

  const updatePieceFields = useCallback(
    (pieceId: string, updates: Partial<PreSubmissionPiece>) => {
      const item = findItemByPieceId(state.items, pieceId);
      if (!item?.pieces) return;
      const nextPieces = item.pieces.map((p) => (p.id === pieceId ? { ...p, ...updates } : p));
      setPiecePreferences(item.productId, nextPieces);
    },
    [state.items, setPiecePreferences]
  );

  return {
    addPreference,
    removePreference,
    copyAllPreferences,
    copySinglePreference,
    pieceToSelectedPreferences,
    updatePieceFields,
  };
}
