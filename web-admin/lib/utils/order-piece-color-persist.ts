/**
 * Resolve catalog color codes (+ optional tenant CF ids) for piece persistence.
 */

export type PieceColorInputLike = {
  color?: string;
  colorCodes?: string[];
  colorCfIds?: (string | null | undefined)[];
};

export function effectivePieceColorsForPersist(
  piece: PieceColorInputLike | undefined
): { codes: string[]; cfIds: (string | null | undefined)[] } {
  if (!piece) return { codes: [], cfIds: [] };
  const codes =
    piece.colorCodes != null && piece.colorCodes.length > 0
      ? [...piece.colorCodes]
      : piece.color != null && piece.color !== ''
        ? [piece.color]
        : [];
  const rawCf = piece.colorCfIds ?? [];
  const cfIds = codes.map((_, i) => rawCf[i] ?? null);
  return { codes, cfIds };
}
