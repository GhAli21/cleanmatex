/**
 * Label printing settings form model (HFC P4, A-46/A-49). Pure: no React, no fetch.
 *
 * The form edits the overrides of one scope: tenant-wide (all branches) or one branch. Every field holds a string:
 * INHERIT (= "Use default", saved as null) or the value (size code, 'true' / 'false', copies '1'..'10').
 * The default shown for INHERIT is the value of the level above: system default for the tenant scope,
 * tenant override (else system default) for a branch.
 */
import {
  LABEL_TYPES,
  LABEL_TYPE_FIELDS,
  LABEL_TYPE_SIZES,
  MAX_LABEL_COPIES,
  MIN_LABEL_COPIES,
  type LabelPrintingField,
  type LabelPrintingValues,
  type LabelType,
} from '@/lib/services/labels/label-types';

export const INHERIT = '__inherit__';

export type LabelScope = 'tenant' | 'branch';
export type LabelFormValues = Record<LabelType, Partial<Record<LabelPrintingField, string>>>;

/** GET /api/v1/settings/label-printing payload (subset the form needs). */
export interface LabelPrintingConfigView {
  systemDefaults: LabelPrintingValues[];
  tenantOverrides: LabelPrintingValues[];
  branchOverrides: LabelPrintingValues[];
  effective: Array<LabelPrintingValues & { sources: Partial<Record<LabelPrintingField, string>> }>;
}

const BOOLEAN_FIELDS: readonly LabelPrintingField[] = ['showQr', 'showCustomerName', 'showOrderBarcode'];

/** Kind of control for a field. */
export function fieldKind(field: LabelPrintingField): 'size' | 'boolean' | 'copies' {
  if (field === 'sizeCode') return 'size';
  if (field === 'copies') return 'copies';
  return 'boolean';
}

/** Concrete options of a field (INHERIT is added by the control). */
export function fieldOptions(type: LabelType, field: LabelPrintingField): string[] {
  switch (fieldKind(field)) {
    case 'size':
      return [...LABEL_TYPE_SIZES[type]];
    case 'copies':
      return Array.from({ length: MAX_LABEL_COPIES - MIN_LABEL_COPIES + 1 }, (_, i) => String(MIN_LABEL_COPIES + i));
    default:
      return ['true', 'false'];
  }
}

/** DB value -> form string (null -> INHERIT). */
export function encodeValue(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return INHERIT;
  return String(v);
}

/** Form string -> DB value for the field (INHERIT or an unknown value -> null). */
export function decodeValue(field: LabelPrintingField, v: string | undefined): string | number | boolean | null {
  if (v === undefined || v === INHERIT || v === '') return null;
  const kind = fieldKind(field);
  if (kind === 'boolean') return v === 'true' ? true : v === 'false' ? false : null;
  if (kind === 'copies') {
    const n = Number(v);
    return Number.isInteger(n) && n >= MIN_LABEL_COPIES && n <= MAX_LABEL_COPIES ? n : null;
  }
  return v;
}

function rowOf(rows: readonly LabelPrintingValues[], type: LabelType): LabelPrintingValues | undefined {
  return rows.find((r) => r.labelType === type);
}

/** Overrides of the edited scope -> form values (every applicable field present). */
export function toFormValues(overrides: readonly LabelPrintingValues[]): LabelFormValues {
  const out = {} as LabelFormValues;
  for (const type of LABEL_TYPES) {
    const row = rowOf(overrides, type);
    out[type] = {};
    for (const field of LABEL_TYPE_FIELDS[type]) out[type][field] = encodeValue(row?.[field]);
  }
  return out;
}

/** Form values -> PUT rows (one per label type; all-null rows tell the server to remove the override). */
export function toSaveRows(values: LabelFormValues): LabelPrintingValues[] {
  return LABEL_TYPES.map((type) => {
    const row: LabelPrintingValues = {
      labelType: type,
      sizeCode: null,
      showQr: null,
      showCustomerName: null,
      showOrderBarcode: null,
      copies: null,
    };
    for (const field of LABEL_TYPE_FIELDS[type]) {
      (row as unknown as Record<string, unknown>)[field] = decodeValue(field, values[type]?.[field]);
    }
    return row;
  });
}

/** The value INHERIT stands for in this scope, as a form string, or null when nothing above sets it. */
export function inheritedValue(
  config: Pick<LabelPrintingConfigView, 'systemDefaults' | 'tenantOverrides'>,
  scope: LabelScope,
  type: LabelType,
  field: LabelPrintingField,
): string | null {
  const sys = rowOf(config.systemDefaults, type)?.[field];
  const tenant = scope === 'branch' ? rowOf(config.tenantOverrides, type)?.[field] : null;
  const v = tenant ?? sys;
  return v === null || v === undefined ? null : String(v);
}

/** Number of fields that differ from the saved values. */
export function countChanges(saved: LabelFormValues, current: LabelFormValues): number {
  let n = 0;
  for (const type of LABEL_TYPES) {
    for (const field of LABEL_TYPE_FIELDS[type]) {
      if ((saved[type]?.[field] ?? INHERIT) !== (current[type]?.[field] ?? INHERIT)) n += 1;
    }
  }
  return n;
}

export function isBooleanField(field: LabelPrintingField): boolean {
  return BOOLEAN_FIELDS.includes(field);
}
