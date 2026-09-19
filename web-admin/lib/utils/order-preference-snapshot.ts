/**
 * Order edit-history snapshot for preference rows.
 * History must keep preference_sys_kind, preference_content, and
 * preference_code (before and after), not only extra_price.
 */

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export interface PreferenceSnapshot {
  preferenceCode: string;
  preferenceSysKind: string | null;
  preferenceContent: string | null;
  preferenceId: string | null;
  extraPrice: number;
  prefsLevel: string;
  productId: string | null;
  productName: string | null;
  pieceSeq: number | null;
}

export interface PreferenceChange {
  prefsLevel: string;
  productName: string | null;
  pieceSeq: number | null;
  changeType: 'added' | 'removed' | 'modified';
  /** Legacy history rows stored a single code instead of old/new. */
  preferenceCode?: string;
  oldPreferenceCode?: string | null;
  newPreferenceCode?: string | null;
  oldPreferenceSysKind?: string | null;
  newPreferenceSysKind?: string | null;
  oldPreferenceContent?: string | null;
  newPreferenceContent?: string | null;
  oldExtraPrice?: number;
  newExtraPrice?: number;
}

export interface PreferenceChangeSet {
  added: PreferenceChange[];
  removed: PreferenceChange[];
  modified: PreferenceChange[];
}

export function preferenceSnapshotKey(row: PreferenceSnapshot): string {
  const identity = row.preferenceId || row.preferenceCode;
  return `${row.prefsLevel}|${row.productId ?? ''}|${row.pieceSeq ?? ''}|${identity}`;
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return textOrNull(a) === textOrNull(b);
}

export function comparePreferenceSnapshots(
  before: PreferenceSnapshot[] | undefined,
  after: PreferenceSnapshot[] | undefined
): PreferenceChangeSet {
  const beforeMap = new Map((before ?? []).map((row) => [preferenceSnapshotKey(row), row]));
  const afterMap = new Map((after ?? []).map((row) => [preferenceSnapshotKey(row), row]));

  const added: PreferenceChange[] = [];
  const removed: PreferenceChange[] = [];
  const modified: PreferenceChange[] = [];

  for (const [key, oldRow] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push({
        prefsLevel: oldRow.prefsLevel,
        productName: oldRow.productName,
        pieceSeq: oldRow.pieceSeq,
        changeType: 'removed',
        oldPreferenceCode: oldRow.preferenceCode,
        oldPreferenceSysKind: textOrNull(oldRow.preferenceSysKind),
        oldPreferenceContent: textOrNull(oldRow.preferenceContent),
        oldExtraPrice: oldRow.extraPrice,
      });
    }
  }

  for (const [key, newRow] of afterMap) {
    const oldRow = beforeMap.get(key);
    if (!oldRow) {
      added.push({
        prefsLevel: newRow.prefsLevel,
        productName: newRow.productName,
        pieceSeq: newRow.pieceSeq,
        changeType: 'added',
        newPreferenceCode: newRow.preferenceCode,
        newPreferenceSysKind: textOrNull(newRow.preferenceSysKind),
        newPreferenceContent: textOrNull(newRow.preferenceContent),
        newExtraPrice: newRow.extraPrice,
      });
      continue;
    }

    const codeChanged = !sameText(oldRow.preferenceCode, newRow.preferenceCode);
    const kindChanged = !sameText(oldRow.preferenceSysKind, newRow.preferenceSysKind);
    const contentChanged = !sameText(oldRow.preferenceContent, newRow.preferenceContent);
    const priceChanged = Number(oldRow.extraPrice) !== Number(newRow.extraPrice);

    if (codeChanged || kindChanged || contentChanged || priceChanged) {
      modified.push({
        prefsLevel: newRow.prefsLevel,
        productName: newRow.productName ?? oldRow.productName,
        pieceSeq: newRow.pieceSeq ?? oldRow.pieceSeq,
        changeType: 'modified',
        oldPreferenceCode: oldRow.preferenceCode,
        newPreferenceCode: newRow.preferenceCode,
        oldPreferenceSysKind: textOrNull(oldRow.preferenceSysKind),
        newPreferenceSysKind: textOrNull(newRow.preferenceSysKind),
        oldPreferenceContent: textOrNull(oldRow.preferenceContent),
        newPreferenceContent: textOrNull(newRow.preferenceContent),
        oldExtraPrice: oldRow.extraPrice,
        newExtraPrice: newRow.extraPrice,
      });
    }
  }

  return { added, removed, modified };
}

export function preferenceChangeCount(changes: PreferenceChangeSet | undefined): number {
  if (!changes) return 0;
  return changes.added.length + changes.removed.length + changes.modified.length;
}

export function preferenceChangeCodes(change: PreferenceChange): {
  oldCode: string | null;
  newCode: string | null;
} {
  return {
    oldCode:
      change.oldPreferenceCode ??
      (change.changeType !== 'added' ? change.preferenceCode ?? null : null),
    newCode:
      change.newPreferenceCode ??
      (change.changeType !== 'removed' ? change.preferenceCode ?? null : null),
  };
}

export function describePreferenceTarget(change: PreferenceChange): string {
  const level = (change.prefsLevel ?? '').trim() || 'ORDER';
  if (change.productName) {
    const item = change.pieceSeq != null
      ? `${change.productName} #${change.pieceSeq}`
      : change.productName;
    return `${level} · ${item}`;
  }
  return level;
}

export function describePreferenceChange(change: PreferenceChange): string {
  const { oldCode, newCode } = preferenceChangeCodes(change);
  const code = newCode ?? oldCode ?? 'preference';
  const kind = change.newPreferenceSysKind ?? change.oldPreferenceSysKind;
  const target = describePreferenceTarget(change);
  return kind ? `${kind}:${code} (${target})` : `${code} (${target})`;
}
