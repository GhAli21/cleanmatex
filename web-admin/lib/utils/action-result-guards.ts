/**
 * Narrowing helpers for server-action style results `{ success: true, ... } | { success: false, error }`.
 * Use when TypeScript does not narrow inside async `.then()` callbacks.
 */
export function getActionErrorMessage<T extends { success: true }>(
  result: T | { success: false; error: string }
): string | null {
  if (result.success) return null;
  return (result as { success: false; error: string }).error;
}

/** After `getActionErrorMessage(result) === null`, narrows `result` to the success branch. */
export function assertActionSuccess<T extends { success: true }>(
  result: T | { success: false; error: string }
): asserts result is T {
  if (!result.success) {
    throw new Error((result as { success: false; error: string }).error);
  }
}
