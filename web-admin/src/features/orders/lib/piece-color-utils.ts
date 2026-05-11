/**
 * Piece color helpers — multi-select `colorCodes` + legacy single `color`, and DB JSON column shapes.
 */

import type { PreSubmissionPiece } from '../model/new-order-types';

export function pieceColorCodesForDisplay(piece: Pick<PreSubmissionPiece, 'color' | 'colorCodes'>): string[] {
  if (piece.colorCodes?.length) return [...piece.colorCodes];
  if (piece.color != null && piece.color !== '') return [piece.color];
  return [];
}

/** Map org_order_item_pieces_dtl.color JSON/string from API/edit load into UI fields. */
export function normalizePieceColorsFromDb(raw: unknown): Pick<PreSubmissionPiece, 'color' | 'colorCodes'> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    return raw === '' ? {} : { color: raw, colorCodes: [raw] };
  }
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as { codes?: unknown; primary?: unknown };
    if (Array.isArray(o.codes)) {
      const codes = (o.codes as unknown[]).filter((c): c is string => typeof c === 'string' && c !== '');
      if (codes.length === 0) return {};
      return { colorCodes: codes, color: codes[0] };
    }
    if (typeof o.primary === 'string' && o.primary !== '') {
      return { color: o.primary, colorCodes: [o.primary] };
    }
  }
  return {};
}

export function extractColorCodesFromApiPiece(pb: Record<string, unknown>): string[] {
  const { color, colorCodes } = normalizePieceColorsFromDb(pb.color);
  if (colorCodes?.length) return colorCodes;
  return color ? [color] : [];
}
