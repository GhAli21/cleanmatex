/**
 * cmx-api entry to the shared clock package (Time & Timezone MASTER_PLAN_v2 §6, §7.10).
 * Nest code takes a `Clock` (systemClock at the request boundary, fixedClock in tests) and uses
 * the dt* helpers; the CommonJS build of @cmx/clock bundles the Temporal polyfill.
 */
export {
  systemClock,
  fixedClock,
  actionClock,
  dtNow,
  dtToday,
  dtTodayOrNull,
  dtAtLocal,
  dtBusinessDate,
  buildClockBlock,
  parseInstant,
  parseCivilDate,
  isClockError,
  ClockError,
  CLOCK_ERROR_HTTP_STATUS,
} from '@cmx/clock';
export type { Clock, ClockBlock, ClockErrorCode, CivilDate, Instant } from '@cmx/clock';
