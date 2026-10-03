import type { SessionClosureCountView } from '@features/cash-drawers/api/cash-drawer-api'

/** Count types a supervisor recount can supersede (mirrors `CASH_DRAWER_COUNT_TYPES`). */
const RECOUNTABLE_COUNT_TYPES: readonly string[] = ['CLOSING', 'RECOUNT']

/**
 * The count a recount must supersede for one currency: the latest closing / recount count that no
 * other count has superseded yet (the head of the chain). `null` when the currency was never
 * counted at close — a recount has nothing to replace, so the screen offers none.
 *
 * @param counts the session's counts from the closure view
 * @param currencyCode currency being recounted
 * @returns the head count, or null
 * @example
 * const target = findRecountTarget(closure.counts, 'OMR')
 * if (target) recount({ supersedesCountId: target.countId })
 */
export function findRecountTarget(
  counts: readonly SessionClosureCountView[],
  currencyCode: string
): SessionClosureCountView | null {
  const candidates = counts.filter(
    (count) => count.currencyCode === currencyCode && RECOUNTABLE_COUNT_TYPES.includes(count.countType)
  )
  const superseded = new Set(candidates.map((count) => count.supersedesCountId).filter((id): id is string => !!id))
  return candidates.find((count) => !superseded.has(count.countId)) ?? null
}
