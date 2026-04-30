/**
 * UI model for piece-level preferences as chips, mapped to/from PreSubmissionPiece
 * for org_order_preferences_dtl alignment (preference_code, preference_sys_kind, prefs_no).
 */

import { getConditionPrefKind } from '@/lib/utils/condition-codes';
import { toUICode } from '@/lib/utils/condition-codes';
import type { OrderItemServicePref, PreSubmissionPiece } from '../model/new-order-types';

/** Default source for new-order UI before server assigns ORDER_CREATE / ORDER_EDIT */
export const DEFAULT_PREFS_SOURCE_UI = 'ORDER_CREATE';

export interface SelectedPreference {
  /** Stable key for React lists and remove/copy */
  id: string;
  /** Temp piece id (PreSubmissionPiece.id); maps to order_item_piece_id after persist */
  pieceId: string;
  preference_id: string | null;
  preference_code: string;
  preference_sys_kind: string;
  prefs_owner_type: string;
  prefs_source: string;
  preference_category?: string | null;
  extra_price: number;
  prefs_no: number;
  prefs_level: 'PIECE';
}

function newPrefId(pieceId: string, prefsNo: number, kind: string, code: string): string {
  return `${pieceId}:${prefsNo}:${kind}:${code}`;
}

/**
 * Derive chip list from a pre-submit piece. prefs_no is sequential within the piece
 * (conditions, then service prefs, then packing, then color).
 */
export function pieceToSelectedPreferences(
  piece: PreSubmissionPiece,
  options?: { prefsSource?: string }
): SelectedPreference[] {
  const prefsSource = options?.prefsSource ?? DEFAULT_PREFS_SOURCE_UI;
  const out: SelectedPreference[] = [];
  let n = 0;

  const conditions = piece.conditions ?? [];
  for (const code of conditions) {
    n += 1;
    const { preference_code, preference_sys_kind } = getConditionPrefKind(code);
    out.push({
      id: newPrefId(piece.id, n, preference_sys_kind, preference_code),
      pieceId: piece.id,
      preference_id: null,
      preference_code,
      preference_sys_kind,
      prefs_owner_type: 'USER',
      prefs_source: prefsSource,
      extra_price: 0,
      prefs_no: n,
      prefs_level: 'PIECE',
    });
  }

  const sPrefs = piece.servicePrefs ?? [];
  for (const sp of sPrefs) {
    n += 1;
    out.push({
      id: newPrefId(piece.id, n, 'service_prefs', sp.preference_code),
      pieceId: piece.id,
      preference_id: null,
      preference_code: sp.preference_code,
      preference_sys_kind: 'service_prefs',
      prefs_owner_type: 'USER',
      prefs_source: sp.source || prefsSource,
      extra_price: Number(sp.extra_price ?? 0),
      prefs_no: n,
      prefs_level: 'PIECE',
    });
  }

  if (piece.packingPrefCode) {
    n += 1;
    out.push({
      id: newPrefId(piece.id, n, 'packing_prefs', piece.packingPrefCode),
      pieceId: piece.id,
      preference_id: null,
      preference_code: piece.packingPrefCode,
      preference_sys_kind: 'packing_prefs',
      prefs_owner_type: 'SYSTEM',
      prefs_source: prefsSource,
      extra_price: 0,
      prefs_no: n,
      prefs_level: 'PIECE',
    });
  }

  if (piece.color) {
    n += 1;
    out.push({
      id: newPrefId(piece.id, n, 'color', piece.color),
      pieceId: piece.id,
      preference_id: null,
      preference_code: piece.color,
      preference_sys_kind: 'color',
      prefs_owner_type: 'USER',
      prefs_source: prefsSource,
      extra_price: 0,
      prefs_no: n,
      prefs_level: 'PIECE',
    });
  }

  return out;
}

/**
 * Merge chip selections back into a piece; preserves id, itemId, pieceSeq, notes, brand, etc.
 */
export function applySelectedPreferencesToPiece(
  base: PreSubmissionPiece,
  preferences: SelectedPreference[]
): PreSubmissionPiece {
  const forPiece = preferences.filter((p) => p.pieceId === base.id).sort((a, b) => a.prefs_no - b.prefs_no);

  const conditions: string[] = [];
  const servicePrefs: OrderItemServicePref[] = [];
  let packingPrefCode: string | undefined;
  let color: string | undefined;

  for (const p of forPiece) {
    const kind = p.preference_sys_kind;
    if (kind === 'condition_stain' || kind === 'condition_damag') {
      conditions.push(toUICode(p.preference_code));
    } else if (kind === 'service_prefs') {
      servicePrefs.push({
        preference_code: p.preference_code,
        source: p.prefs_source || DEFAULT_PREFS_SOURCE_UI,
        extra_price: Number(p.extra_price ?? 0),
      });
    } else if (kind === 'packing_prefs') {
      packingPrefCode = p.preference_code;
    } else if (kind === 'color') {
      color = p.preference_code;
    }
  }

  return {
    ...base,
    conditions: conditions.length > 0 ? conditions : undefined,
    servicePrefs: servicePrefs.length > 0 ? servicePrefs : undefined,
    packingPrefCode: packingPrefCode || undefined,
    color: color || undefined,
  };
}

/**
 * Replace preferences for one piece in a flat list (all pieces), renumbering prefs_no for that piece.
 */
export function renumberPreferencesForPiece(
  allPrefs: SelectedPreference[],
  pieceId: string
): SelectedPreference[] {
  const others = allPrefs.filter((p) => p.pieceId !== pieceId);
  const mine = allPrefs
    .filter((p) => p.pieceId === pieceId)
    .sort((a, b) => a.prefs_no - b.prefs_no);
  const renumbered = mine.map((p, i) => ({
    ...p,
    prefs_no: i + 1,
    id: newPrefId(pieceId, i + 1, p.preference_sys_kind, p.preference_code),
  }));
  return [...others, ...renumbered];
}
