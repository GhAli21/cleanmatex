/**
 * The UoM library's rule error. Carries the same code the database raises for
 * the same rule (lib/constants/uom.ts), so a service maps both to one message.
 */
import { parseUomErrorCode, type UomErrorCode } from '@/lib/constants/uom';

/** A unit rule the input breaks; `details` carries the figures for the message. */
export class UomRuleError extends Error {
  readonly code: UomErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(code: UomErrorCode, message: string, details: Record<string, string> = {}) {
    super(`${code}: ${message}`);
    this.name = 'UomRuleError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Turns a database error that carries a `UOM_*` / `MEASURE_*` code into a UomRuleError, so a
 * service keeps the rule (and the route its 404/409/422 mapping) instead of a generic failure.
 * Anything else returns, and the caller throws its own error.
 * @param message the database error message
 * @throws UomRuleError when the message starts with a known unit rule code
 */
export function throwIfUomRule(message: string | null | undefined): void {
  const code = parseUomErrorCode(message);
  if (code) throw new UomRuleError(code, (message ?? '').replace(/^[A-Z_]+:\s*/, ''));
}
