/**
 * Condition code mapping between UI (lowercase) and catalog (uppercase)
 * Used when persisting/loading piece conditions to org_order_preferences_dtl
 */

import { STAIN_CONDITIONS } from '@/lib/types/order-creation';

const UI_TO_CATALOG: Record<string, string> = {
  bubble: 'BUBBLE',
  coffee: 'COFFEE',
  ink: 'INK',
  grease: 'GREASE',
  bleach: 'BLEACH',
  wine: 'WINE',
  blood: 'BLOOD',
  mud: 'MUD',
  oil: 'OIL',
  button_broken: 'BUTTON_BROKEN',
  button_missing: 'BUTTON_MISSING',
  collar_torn: 'COLLAR_TORN',
  zipper_broken: 'ZIPPER_BROKEN',
  hole: 'HOLE',
  tear: 'TEAR',
  seam_open: 'SEAM_OPEN',
  special_care: 'SPECIAL_CARE',
  delicate: 'DELICATE_COND',
};

const CATALOG_TO_UI: Record<string, string> = {};
for (const [ui, cat] of Object.entries(UI_TO_CATALOG)) {
  CATALOG_TO_UI[cat] = ui;
}

/** Convert UI code (e.g. coffee) to catalog code (e.g. COFFEE) for DB storage */
export function toCatalogCode(uiCode: string): string {
  return UI_TO_CATALOG[uiCode.toLowerCase()] ?? uiCode.toUpperCase();
}

/** Convert catalog code (e.g. COFFEE) to UI code (e.g. coffee) for display */
export function toUICode(catalogCode: string): string {
  return CATALOG_TO_UI[catalogCode.toUpperCase()] ?? catalogCode.toLowerCase();
}

/** Get preference_code and preference_sys_kind for a condition code */
export function getConditionPrefKind(
  code: string
): { preference_code: string; preference_sys_kind: 'condition_stain' | 'condition_damag' } {
  const preference_code = toCatalogCode(code);
  const condition = STAIN_CONDITIONS.find((c) => c.code.toLowerCase() === code.toLowerCase());
  const category = condition?.category ?? 'stain';
  const preference_sys_kind =
    category === 'damage' || category === 'special' ? 'condition_damag' : 'condition_stain';
  return { preference_code, preference_sys_kind };
}
