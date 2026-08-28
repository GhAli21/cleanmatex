/**
 * Ready-list desk presets. Canonical URL is `/dashboard/ready?focus={value}`.
 * A later “Pickup desk” nav item should point at `?focus=counter`, not a second page.
 */

export const READY_LIST_FOCUS = {
  ALL: 'all',
  COUNTER: 'counter',
  SHELF: 'shelf',
  COLLECTION: 'collection',
  NO_RACK: 'no_rack',
} as const

export type ReadyListFocus = (typeof READY_LIST_FOCUS)[keyof typeof READY_LIST_FOCUS]

export const READY_LIST_FOCUS_QUERY = 'focus' as const
export const READY_LIST_FOCUS_API_QUERY = 'ready_focus' as const

/** Statuses that still belong on the Ready host page (not delivered / OFD). */
export const READY_AREA_STATUSES = ['ready', 'ready_for_pickup'] as const

const FOCUS_VALUES = new Set<string>(Object.values(READY_LIST_FOCUS))

/** Synonyms so a Pickup-desk bookmark can use either token. */
const FOCUS_ALIASES: Record<string, ReadyListFocus> = {
  pickup: READY_LIST_FOCUS.COUNTER,
  desk: READY_LIST_FOCUS.COUNTER,
  not_released: READY_LIST_FOCUS.SHELF,
}

/** Worklist narrowing produced by a Ready desk preset. */
export interface ReadyListWorklistNarrow {
  statusNarrow?: string[]
  collectionDue?: boolean
  missingRack?: boolean
}

/**
 * Maps a query string to a known Ready-list focus. Unknown values fall back to all.
 *
 * @param raw `focus` / `ready_focus` query value
 * @returns Canonical desk preset
 * @example
 * parseReadyListFocus('pickup') // 'counter'
 */
export function parseReadyListFocus(raw: string | null | undefined): ReadyListFocus {
  const token = raw?.trim().toLowerCase() ?? ''
  if (!token || token === READY_LIST_FOCUS.ALL) return READY_LIST_FOCUS.ALL
  if (FOCUS_VALUES.has(token)) return token as ReadyListFocus
  return FOCUS_ALIASES[token] ?? READY_LIST_FOCUS.ALL
}

/**
 * Converts a desk preset into server worklist filters. Membership stays Ready-area.
 *
 * @param focus Canonical desk preset
 * @returns Narrowing flags for `listStageWorklistOrderPage`
 */
export function readyListFocusToWorklist(focus: ReadyListFocus): ReadyListWorklistNarrow {
  switch (focus) {
    case READY_LIST_FOCUS.COUNTER:
      return { statusNarrow: ['ready_for_pickup'] }
    case READY_LIST_FOCUS.SHELF:
      return { statusNarrow: ['ready'] }
    case READY_LIST_FOCUS.COLLECTION:
      return { collectionDue: true }
    case READY_LIST_FOCUS.NO_RACK:
      return { missingRack: true }
    default:
      return {}
  }
}

/**
 * Builds the Ready list path for chips, returnUrl, and a future Pickup-desk alias.
 *
 * @param focus Canonical desk preset
 * @returns `/dashboard/ready` or `/dashboard/ready?focus=counter`
 */
export function readyListPath(focus: ReadyListFocus = READY_LIST_FOCUS.ALL): string {
  if (focus === READY_LIST_FOCUS.ALL) return '/dashboard/ready'
  return `/dashboard/ready?${READY_LIST_FOCUS_QUERY}=${focus}`
}
