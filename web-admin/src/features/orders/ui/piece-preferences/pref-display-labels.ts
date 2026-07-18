/**
 * Shared bilingual preference display labels (catalog name/name2 → locale map).
 * Used by New Order chips, Processing readonly chips, and Processing prefs dialog.
 */

import type { PreferenceKind } from '@/lib/types/service-preferences';

export type PrefCatalogEntry = {
  code: string;
  name: string;
  name2?: string | null;
};

export type PrefNameByCodeInputs = {
  servicePrefs?: PrefCatalogEntry[];
  packingPrefs?: PrefCatalogEntry[];
  stains?: PrefCatalogEntry[];
  damages?: PrefCatalogEntry[];
  colors?: PrefCatalogEntry[];
};

type GetBilingual = (name?: string | null, name2?: string | null) => string;

/**
 * Humanize a machine code when catalog label is missing (never returns empty if code present).
 */
export function humanizePrefCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  return trimmed.replace(/_/g, ' ');
}

function setMultiCase(map: Map<string, string>, code: string, label: string): void {
  const trimmed = code.trim();
  if (!trimmed || !label.trim()) return;
  map.set(trimmed, label);
  map.set(trimmed.toUpperCase(), label);
  map.set(trimmed.toLowerCase(), label);
}

/**
 * Build code → locale display name map from preference catalogs.
 */
export function buildPrefNameByCode(
  inputs: PrefNameByCodeInputs,
  getBilingual: GetBilingual
): Map<string, string> {
  const map = new Map<string, string>();
  const addAll = (entries?: PrefCatalogEntry[]) => {
    for (const p of entries ?? []) {
      if (!p?.code) continue;
      const label = getBilingual(p.name, p.name2 ?? null) || humanizePrefCode(p.code);
      setMultiCase(map, p.code, label);
    }
  };
  addAll(inputs.servicePrefs);
  addAll(inputs.packingPrefs);
  addAll(inputs.stains);
  addAll(inputs.damages);
  addAll(inputs.colors);
  return map;
}

/**
 * Resolve a preference code to a display label.
 */
export function labelForPrefCode(
  code: string | null | undefined,
  nameByCode?: Map<string, string> | null
): string {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return '';
  if (nameByCode?.size) {
    const hit =
      nameByCode.get(trimmed) ??
      nameByCode.get(trimmed.toUpperCase()) ??
      nameByCode.get(trimmed.toLowerCase());
    if (hit?.trim()) return hit;
  }
  return humanizePrefCode(trimmed);
}

/**
 * Resolve preference_sys_kind / kind_code to a bilingual section/toolbar label.
 */
export function labelForPrefKind(
  kindCode: string | null | undefined,
  preferenceKinds: PreferenceKind[] | null | undefined,
  getBilingual: GetBilingual
): string {
  const code = (kindCode ?? '').trim();
  if (!code) return '';
  const kind = (preferenceKinds ?? []).find(
    (k) =>
      k.kind_code === code ||
      k.kind_code?.toLowerCase() === code.toLowerCase()
  );
  if (kind) {
    const label = getBilingual(kind.name, kind.name2 ?? null);
    if (label.trim()) return label;
  }
  return humanizePrefCode(code);
}
