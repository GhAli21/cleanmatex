/**
 * BVM Phase 6 Sub-item 5 — D9 routing field helpers.
 *
 * Why:
 * The payment-method-config dialog exposes tenant-override fields on
 * `org_payment_methods_cf` (settlement_type_code, default_creation_status,
 * allow_status_override, is_user_id_required, credit_application_type).
 * Each column treats NULL as "inherit from sys_payment_method_cd default".
 *
 * The HTML form layer only carries strings, so boolean tri-state controls
 * must serialize through `'true' | 'false' | ''` and the form-state layer
 * must round-trip back to `boolean | null`. CmxSwitch is binary-only and
 * cannot express the inherit state, hence the dropdown approach with these
 * pure helpers — kept testable in isolation from the React tree.
 */

/** String form values used by the tri-state CmxSelectDropdown. */
export type TriStateString = 'true' | 'false' | '';

/**
 * Convert a tri-state form string into the persistence value.
 *
 * @param value - Form-layer string. `''` represents the "inherit" selection.
 * @returns `true`, `false`, or `null` (inherit).
 * @example
 *   triStateToBoolean('') // → null  → tenant inherits sys default
 *   triStateToBoolean('true')  // → true
 *   triStateToBoolean('false') // → false
 */
export function triStateToBoolean(value: TriStateString): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/**
 * Convert a persisted boolean override into the form-layer string.
 *
 * @param value - `boolean` for explicit override, `null | undefined` for inherit.
 * @returns Matching `TriStateString` for the dropdown.
 * @example
 *   booleanToTriState(null)  // → ''
 *   booleanToTriState(true)  // → 'true'
 *   booleanToTriState(false) // → 'false'
 */
export function booleanToTriState(value: boolean | null | undefined): TriStateString {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}

/**
 * Convert a nullable string override (e.g. settlement_type_code) into a
 * form-layer string. `''` represents the inherit choice in the dropdown,
 * which must round-trip back to `null` on submit (see {@link formStringToNullable}).
 *
 * @param value - Persisted enum string or `null | undefined` for inherit.
 * @returns Same string, or `''` when the value is absent.
 */
export function nullableStringToFormValue(value: string | null | undefined): string {
  return value ?? '';
}

/**
 * Convert a tri-state-style nullable-string form value back into the
 * persistence shape: `''` → `null` (inherit), anything else → the string.
 *
 * @param value - Form-layer string from the dropdown.
 * @returns `null` for inherit, otherwise the original string.
 */
export function formStringToNullable(value: string): string | null {
  return value === '' ? null : value;
}
