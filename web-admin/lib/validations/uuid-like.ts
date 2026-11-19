/**
 * Postgres `uuid` accepts any 8-4-4-4-12 hex form. Zod's `z.string().uuid()` is
 * RFC 4122-only (version + variant nibbles), which rejects demo/seed ids such as
 * `22222222-2222-2222-2222-222222222222` that still round-trip through Postgres.
 */
import { z } from 'zod';

/** Hex UUID shape that matches Postgres `uuid` input (not RFC version/variant). */
export const POSTGRES_UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * String that looks like a Postgres uuid. Prefer this over `z.string().uuid()`
 * for ids that may come from seeded demo rows.
 */
export function zUuidLike(message = 'Invalid UUID') {
  return z.string().regex(POSTGRES_UUID_LIKE, message);
}
