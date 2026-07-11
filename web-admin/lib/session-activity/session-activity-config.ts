/**
 * Session Activity capture and retention constants.
 */

export const SESSION_ACTIVITY_MAX_ENTRIES = 100

/** Skip append when same type+title+route within this window. */
export const SESSION_ACTIVITY_DEDUPE_MS = 5_000

export const SESSION_ACTIVITY_TITLE_MAX = 500

export const SESSION_ACTIVITY_DESCRIPTION_MAX = 2_000

/** Confirm before clearing when entry count exceeds this. */
export const SESSION_ACTIVITY_CLEAR_CONFIRM_THRESHOLD = 10

/** Custom event for mutual-close of top-bar popovers. */
export const TOPBAR_POPOVER_OPEN_EVENT = 'cmx:topbar-popover-open'

export type TopbarPopoverId = 'session-activity' | 'notifications'

export interface TopbarPopoverOpenDetail {
  id: TopbarPopoverId
}
