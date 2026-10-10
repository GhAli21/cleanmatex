/**
 * Cash taken on an open POS session belongs to the drawer that session is already
 * linked to. Other open drawers stay out of the choice list so payment does not
 * ask the cashier to pick again. When the link is set but that session is not
 * open, the list is empty (`linkedMissing`) instead of offering a different drawer.
 */
export function cashDrawerChoicesForPosSession<T extends { session: { id: string } }>(
  choices: readonly T[],
  linkedSessionId: string | null,
): { choices: T[]; linkedMissing: boolean } {
  if (!linkedSessionId) return { choices: [...choices], linkedMissing: false };
  const linked = choices.filter((choice) => choice.session.id === linkedSessionId);
  if (linked.length === 0) return { choices: [], linkedMissing: true };
  return { choices: linked, linkedMissing: false };
}
