/**
 * Detects Postgres "malformed value for a typed column" failures so routes can
 * answer 400 instead of 500.
 *
 * Needed because several request fields (branchId, customerId, …) intentionally
 * accept any string — those ids come from the database via the UI, so format
 * validation at the edge was redundant ceremony. The trade-off is that a
 * malformed value now reaches Postgres, which rejects it with SQLSTATE 22P02
 * rather than returning no rows. That is bad client input, not a server fault.
 */

/** Postgres invalid_text_representation — e.g. a non-UUID string for a uuid column. */
const INVALID_TEXT_REPRESENTATION = '22P02';

/**
 * True when the error is Postgres rejecting a malformed input value
 * (e.g. `invalid input syntax for type uuid: "MAIN-BRANCH"`).
 *
 * Matches the SQLSTATE on Supabase errors (`code`) and Prisma raw-query errors
 * (`meta.code`), falling back to the message text for wrappers that drop it.
 *
 * @param error - Unknown value caught in a route handler
 */
export function isInvalidDbInputError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown } | null;
  };

  if (
    candidate.code === INVALID_TEXT_REPRESENTATION ||
    candidate.meta?.code === INVALID_TEXT_REPRESENTATION
  ) {
    return true;
  }

  return (
    typeof candidate.message === 'string' &&
    /invalid input syntax for type/i.test(candidate.message)
  );
}
