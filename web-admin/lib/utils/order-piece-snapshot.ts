/**
 * Order edit-history snapshot for piece rows.
 * Item qty/price history does not record color, brand, notes, packing, or
 * stain/damage on the piece itself.
 */

export interface PieceSnapshot {
  productId: string | null;
  productName: string | null;
  pieceSeq: number;
  colorCodes: string;
  brand: string | null;
  hasStain: boolean;
  hasDamage: boolean;
  notes: string | null;
  rackLocation: string | null;
  packingPrefCode: string | null;
}

export interface PieceChange {
  productName: string | null;
  pieceSeq: number;
  changeType: 'added' | 'removed' | 'modified';
  oldColorCodes?: string | null;
  newColorCodes?: string | null;
  oldBrand?: string | null;
  newBrand?: string | null;
  oldHasStain?: boolean;
  newHasStain?: boolean;
  oldHasDamage?: boolean;
  newHasDamage?: boolean;
  oldNotes?: string | null;
  newNotes?: string | null;
  oldRackLocation?: string | null;
  newRackLocation?: string | null;
  oldPackingPrefCode?: string | null;
  newPackingPrefCode?: string | null;
}

export interface PieceChangeSet {
  added: PieceChange[];
  removed: PieceChange[];
  modified: PieceChange[];
}

export function normalizePieceColorCodes(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object') {
    const o = raw as { codes?: unknown; primary?: unknown };
    if (Array.isArray(o.codes)) {
      return (o.codes as unknown[])
        .filter((code): code is string => typeof code === 'string' && code.trim() !== '')
        .map((code) => code.trim())
        .sort()
        .join(',');
    }
    if (typeof o.primary === 'string') return o.primary.trim();
  }
  return '';
}

export function pieceSnapshotKey(row: PieceSnapshot): string {
  return `${row.productId ?? ''}|${row.pieceSeq}`;
}

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export function comparePieceSnapshots(
  before: PieceSnapshot[] | undefined,
  after: PieceSnapshot[] | undefined
): PieceChangeSet {
  const beforeMap = new Map((before ?? []).map((row) => [pieceSnapshotKey(row), row]));
  const afterMap = new Map((after ?? []).map((row) => [pieceSnapshotKey(row), row]));

  const added: PieceChange[] = [];
  const removed: PieceChange[] = [];
  const modified: PieceChange[] = [];

  for (const [key, oldRow] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push({
        productName: oldRow.productName,
        pieceSeq: oldRow.pieceSeq,
        changeType: 'removed',
        oldColorCodes: oldRow.colorCodes || null,
        oldBrand: textOrNull(oldRow.brand),
        oldHasStain: oldRow.hasStain,
        oldHasDamage: oldRow.hasDamage,
        oldNotes: textOrNull(oldRow.notes),
        oldRackLocation: textOrNull(oldRow.rackLocation),
        oldPackingPrefCode: textOrNull(oldRow.packingPrefCode),
      });
    }
  }

  for (const [key, newRow] of afterMap) {
    const oldRow = beforeMap.get(key);
    if (!oldRow) {
      added.push({
        productName: newRow.productName,
        pieceSeq: newRow.pieceSeq,
        changeType: 'added',
        newColorCodes: newRow.colorCodes || null,
        newBrand: textOrNull(newRow.brand),
        newHasStain: newRow.hasStain,
        newHasDamage: newRow.hasDamage,
        newNotes: textOrNull(newRow.notes),
        newRackLocation: textOrNull(newRow.rackLocation),
        newPackingPrefCode: textOrNull(newRow.packingPrefCode),
      });
      continue;
    }

    const colorChanged = (oldRow.colorCodes || '') !== (newRow.colorCodes || '');
    const brandChanged = textOrNull(oldRow.brand) !== textOrNull(newRow.brand);
    const stainChanged = Boolean(oldRow.hasStain) !== Boolean(newRow.hasStain);
    const damageChanged = Boolean(oldRow.hasDamage) !== Boolean(newRow.hasDamage);
    const notesChanged = textOrNull(oldRow.notes) !== textOrNull(newRow.notes);
    const rackChanged = textOrNull(oldRow.rackLocation) !== textOrNull(newRow.rackLocation);
    const packingChanged = textOrNull(oldRow.packingPrefCode) !== textOrNull(newRow.packingPrefCode);

    if (
      colorChanged ||
      brandChanged ||
      stainChanged ||
      damageChanged ||
      notesChanged ||
      rackChanged ||
      packingChanged
    ) {
      modified.push({
        productName: newRow.productName ?? oldRow.productName,
        pieceSeq: newRow.pieceSeq,
        changeType: 'modified',
        ...(colorChanged && {
          oldColorCodes: oldRow.colorCodes || null,
          newColorCodes: newRow.colorCodes || null,
        }),
        ...(brandChanged && {
          oldBrand: textOrNull(oldRow.brand),
          newBrand: textOrNull(newRow.brand),
        }),
        ...(stainChanged && {
          oldHasStain: oldRow.hasStain,
          newHasStain: newRow.hasStain,
        }),
        ...(damageChanged && {
          oldHasDamage: oldRow.hasDamage,
          newHasDamage: newRow.hasDamage,
        }),
        ...(notesChanged && {
          oldNotes: textOrNull(oldRow.notes),
          newNotes: textOrNull(newRow.notes),
        }),
        ...(rackChanged && {
          oldRackLocation: textOrNull(oldRow.rackLocation),
          newRackLocation: textOrNull(newRow.rackLocation),
        }),
        ...(packingChanged && {
          oldPackingPrefCode: textOrNull(oldRow.packingPrefCode),
          newPackingPrefCode: textOrNull(newRow.packingPrefCode),
        }),
      });
    }
  }

  return { added, removed, modified };
}

export function pieceChangeCount(changes: PieceChangeSet | undefined): number {
  if (!changes) return 0;
  return changes.added.length + changes.removed.length + changes.modified.length;
}

export function describePieceChange(change: PieceChange): string {
  const name = change.productName ?? 'item';
  return `${name} #${change.pieceSeq}`;
}
