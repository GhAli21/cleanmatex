/**
 * Core draft-string utilities for money input fields and keypad components.
 * A "draft" is the raw string the user is typing (e.g. "12.5" before committing
 * "12.500"). Distinct from the canonical numeric value reported to business logic.
 */

/**
 * Remove non-numeric chars, collapse leading zeros, enforce single decimal point,
 * and cap fraction length to the given decimal places.
 *
 * Examples (dp=3):
 *   '007'     → '7'
 *   '00.5'    → '0.5'
 *   '0'       → '0'
 *   '.5'      → '0.5'
 *   '1..23'   → '1.23'
 *   '1.23456' → '1.234'
 * @param raw
 * @param decimalPlaces
 */
export function sanitizeMoneyDraft(raw: string, decimalPlaces: number): string {
  let value = raw.replace(/[^\d.]/g, '')

  if (value.startsWith('.')) value = `0${value}`

  const dotIdx = value.indexOf('.')
  if (dotIdx !== -1) {
    const intPart = value.slice(0, dotIdx)
    let fracPart = value.slice(dotIdx + 1).replace(/\./g, '')
    if (fracPart.length > decimalPlaces) fracPart = fracPart.slice(0, decimalPlaces)
    const normInt = intPart.replace(/^0+(?=\d)/, '') || '0'
    value = `${normInt}.${fracPart}`
  } else {
    value = value.replace(/^0+(?=\d)/, '') || value
  }

  return value
}

/**
 * Parse a draft string to a canonical number. Returns 0 for incomplete drafts like ".".
 * @param value
 */
export function parseMoneyDraft(value: string): number {
  if (!value || value === '.') return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Format a canonical number back to a display string.
 * Keeps full fixed-point precision — no trailing zero stripping.
 * "10.500 KWD" not "10.5 KWD".
 * @param value
 * @param decimalPlaces
 * @param showZero
 */
export function formatMoneyDraft(
  value: number | null | undefined,
  decimalPlaces: number,
  showZero: boolean
): string {
  if (value == null || !Number.isFinite(value)) return ''
  if (value === 0) return showZero ? (0).toFixed(decimalPlaces) : ''
  return value.toFixed(decimalPlaces)
}

/**
 * Apply a single keypad key press to the current draft string.
 * Quick-add keys must match /^\+\d+$/ (e.g. "+10", "+50").
 * @param currentDraft
 * @param key
 * @param decimalPlaces
 */
/**
 * True when the draft already has a full fractional part (e.g. "1.000" at dp=3).
 * Further digit appends would be truncated by {@link sanitizeMoneyDraft} and look
 * like a dead keypad — POS UX starts a new entry instead.
 */
function isCompleteMoneyDraft(draft: string, decimalPlaces: number): boolean {
  if (decimalPlaces <= 0) return false
  const dot = draft.indexOf('.')
  if (dot === -1) return false
  return draft.length - dot - 1 >= decimalPlaces
}

export function applyKeypadInput(
  currentDraft: string,
  key: string,
  decimalPlaces: number
): string {
  if (key === 'backspace') return currentDraft.slice(0, -1)
  if (key === 'clear') return ''

  if (/^\+\d+$/.test(key)) {
    const increment = Number.parseInt(key.slice(1), 10)
    const next = parseMoneyDraft(currentDraft) + increment
    return next > 0 ? next.toFixed(decimalPlaces) : ''
  }

  if (key === '.') {
    if (currentDraft.includes('.')) return currentDraft
    return currentDraft === '' ? '0.' : `${currentDraft}.`
  }

  // Digit: if the value is already fully padded (common after blur / Exact),
  // replace instead of appending — append would be a no-op at max decimals.
  if (/^\d$/.test(key) && isCompleteMoneyDraft(currentDraft, decimalPlaces)) {
    return sanitizeMoneyDraft(key, decimalPlaces)
  }

  return sanitizeMoneyDraft(`${currentDraft}${key}`, decimalPlaces)
}
