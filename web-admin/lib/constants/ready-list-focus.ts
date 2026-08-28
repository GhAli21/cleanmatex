/**
 * Ready-list desk query. Filters stack in the URL so Pickup desk can alias
 * `/dashboard/ready?focus=counter` and still add `due=1` / `norack=1` / `staged=1`.
 */

export const READY_LIST_FOCUS_QUERY = 'focus' as const
export const READY_LIST_STAGED_QUERY = 'staged' as const
export const READY_LIST_UNRELEASED_QUERY = 'unreleased' as const
export const READY_LIST_DUE_QUERY = 'due' as const
export const READY_LIST_NO_RACK_QUERY = 'norack' as const
export const READY_LIST_PAGE_QUERY = 'page' as const

export const READY_LIST_API = {
  STAGED: 'ready_staged',
  UNRELEASED: 'ready_unreleased',
  DUE: 'ready_due',
  NO_RACK: 'ready_norack',
} as const

/** Statuses that still belong on the Ready host page (not delivered / OFD). */
export const READY_AREA_STATUSES = ['ready', 'ready_for_pickup'] as const

const DESK_FOCUS_VALUES = new Set(['counter', 'pickup', 'desk'])

/** Combinable Ready-area list query. Status chips OR; due/rack AND. */
export interface ReadyListQuery {
  /** Pickup-desk alias chrome; does not by itself hide `ready`. */
  desk: boolean
  /** `ready_for_pickup` (released, waiting). */
  staged: boolean
  /** `ready` (not released; includes direct counter handover). */
  unreleased: boolean
  collectionDue: boolean
  missingRack: boolean
  page: number
}

export const EMPTY_READY_LIST_QUERY: ReadyListQuery = {
  desk: false,
  staged: false,
  unreleased: false,
  collectionDue: false,
  missingRack: false,
  page: 1,
}

/** Worklist narrowing produced by a Ready desk query. */
export interface ReadyListWorklistNarrow {
  statusNarrow?: string[]
  collectionDue?: boolean
  missingRack?: boolean
}

function isOn(raw: string | null | undefined): boolean {
  const token = raw?.trim().toLowerCase() ?? ''
  return token === '1' || token === 'true' || token === 'yes'
}

function parsePage(raw: string | null | undefined): number {
  const page = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function applyLegacyFocus(focus: string, query: ReadyListQuery): ReadyListQuery {
  if (DESK_FOCUS_VALUES.has(focus)) return { ...query, desk: true }
  if (focus === 'shelf' || focus === 'not_released') return { ...query, unreleased: true }
  if (focus === 'collection') return { ...query, collectionDue: true }
  if (focus === 'no_rack') return { ...query, missingRack: true }
  return query
}

/**
 * Reads stacked Ready-list API flags. Legacy exclusive `ready_focus` still maps.
 * Callers must apply this only on the Ready floor (`ready` / `ready_release`).
 *
 * @param params Orders API search params
 */
export function parseReadyListQueryFromApi(
  params: Pick<URLSearchParams, 'get'>,
): ReadyListQuery {
  const fromFlags: ReadyListQuery = {
    desk: false,
    staged: isOn(params.get(READY_LIST_API.STAGED)),
    unreleased: isOn(params.get(READY_LIST_API.UNRELEASED)),
    collectionDue: isOn(params.get(READY_LIST_API.DUE)),
    missingRack: isOn(params.get(READY_LIST_API.NO_RACK)),
    page: 1,
  }
  const legacy = params.get('ready_focus')?.trim().toLowerCase() ?? ''
  return applyLegacyFocus(legacy, fromFlags)
}

/**
 * Reads stacked Ready-list params. Legacy exclusive `focus=shelf|collection|no_rack`
 * still works; `focus=counter` is Pickup desk (both handover statuses) and can stack.
 *
 * @param params Current URL search params
 */
export function parseReadyListQuery(
  params: Pick<URLSearchParams, 'get'>,
): ReadyListQuery {
  const fromFlags: ReadyListQuery = {
    desk: false,
    staged: isOn(params.get(READY_LIST_STAGED_QUERY)),
    unreleased: isOn(params.get(READY_LIST_UNRELEASED_QUERY)),
    collectionDue: isOn(params.get(READY_LIST_DUE_QUERY)),
    missingRack: isOn(params.get(READY_LIST_NO_RACK_QUERY)),
    page: parsePage(params.get(READY_LIST_PAGE_QUERY)),
  }
  const focus = params.get(READY_LIST_FOCUS_QUERY)?.trim().toLowerCase() ?? ''
  return applyLegacyFocus(focus, fromFlags)
}

/**
 * Maps a desk query into worklist filters. Neither or both status chips → full Ready area.
 *
 * @param query Parsed list query
 */
export function readyListQueryToWorklist(query: ReadyListQuery): ReadyListWorklistNarrow {
  const narrow: ReadyListWorklistNarrow = {}
  if (query.staged && !query.unreleased) {
    narrow.statusNarrow = ['ready_for_pickup']
  } else if (query.unreleased && !query.staged) {
    narrow.statusNarrow = ['ready']
  }
  if (query.collectionDue) narrow.collectionDue = true
  if (query.missingRack) narrow.missingRack = true
  return narrow
}

/**
 * API query flags for `GET /api/v1/orders` (Ready floor only).
 *
 * @param query Parsed list query
 */
export function readyListQueryToApiFilters(
  query: ReadyListQuery,
): Record<string, string> {
  const filters: Record<string, string> = {}
  if (query.staged) filters[READY_LIST_API.STAGED] = '1'
  if (query.unreleased) filters[READY_LIST_API.UNRELEASED] = '1'
  if (query.collectionDue) filters[READY_LIST_API.DUE] = '1'
  if (query.missingRack) filters[READY_LIST_API.NO_RACK] = '1'
  return filters
}

function flag(params: URLSearchParams, key: string, on: boolean): void {
  if (on) params.set(key, '1')
  else params.delete(key)
}

/**
 * Writes a stacked Ready-list URL. Pickup desk keeps `focus=counter`.
 *
 * @param query Desk query
 * @returns `/dashboard/ready` plus query string
 */
export function readyListPath(query: ReadyListQuery = EMPTY_READY_LIST_QUERY): string {
  const params = new URLSearchParams()
  if (query.desk) params.set(READY_LIST_FOCUS_QUERY, 'counter')
  flag(params, READY_LIST_STAGED_QUERY, query.staged)
  flag(params, READY_LIST_UNRELEASED_QUERY, query.unreleased)
  flag(params, READY_LIST_DUE_QUERY, query.collectionDue)
  flag(params, READY_LIST_NO_RACK_QUERY, query.missingRack)
  if (query.page > 1) params.set(READY_LIST_PAGE_QUERY, String(query.page))
  const qs = params.toString()
  return qs ? `/dashboard/ready?${qs}` : '/dashboard/ready'
}

/** True when any status/due/rack toggle is on (Pickup-desk chrome does not count). */
export function readyListHasFilters(query: ReadyListQuery): boolean {
  return query.staged || query.unreleased || query.collectionDue || query.missingRack
}

/** i18n suffix under `workflow.ready.focus.empty.*` for the current combination. */
export function readyListEmptyKey(
  query: ReadyListQuery,
): 'all' | 'desk' | 'counter' | 'shelf' | 'collection' | 'no_rack' | 'filtered' {
  const flagCount =
    Number(query.staged) +
    Number(query.unreleased) +
    Number(query.collectionDue) +
    Number(query.missingRack)
  if (flagCount === 0) return query.desk ? 'desk' : 'all'
  if (flagCount > 1) return 'filtered'
  if (query.staged) return 'counter'
  if (query.unreleased) return 'shelf'
  if (query.collectionDue) return 'collection'
  return 'no_rack'
}

/** Ready host page and its catalog alias — the only screens that accept desk flags. */
export function isReadyFloorScreen(screen: string | null | undefined): boolean {
  const key = screen?.trim().toLowerCase() ?? ''
  return key === 'ready' || key === 'ready_release'
}
