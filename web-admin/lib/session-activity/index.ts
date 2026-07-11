/**
 * Session Activity — public lib exports.
 */

export {
  SESSION_ACTIVITY_CLEAR_CONFIRM_THRESHOLD,
  SESSION_ACTIVITY_DEDUPE_MS,
  SESSION_ACTIVITY_DESCRIPTION_MAX,
  SESSION_ACTIVITY_MAX_ENTRIES,
  SESSION_ACTIVITY_TITLE_MAX,
  TOPBAR_POPOVER_OPEN_EVENT,
  type TopbarPopoverId,
  type TopbarPopoverOpenDetail,
} from './session-activity-config'
export {
  recordSessionMessage,
  shouldCaptureSessionMessage,
} from './record-session-message'
export {
  redactSessionDescription,
  redactSessionTitle,
} from './redact-session-message'
export { sessionActivityStore } from './session-activity-store'
export type {
  RecordSessionMessageInput,
  SessionActivityDisplayMethod,
  SessionActivityEntry,
  SessionActivityListener,
  SessionActivityMessageType,
  SessionActivityState,
} from './session-activity.types'
