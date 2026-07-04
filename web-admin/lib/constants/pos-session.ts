export const POS_SESSION_STATUS = {
  OPEN: 'OPEN',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
  FORCE_CLOSED: 'FORCE_CLOSED',
} as const;

export type PosSessionStatus =
  (typeof POS_SESSION_STATUS)[keyof typeof POS_SESSION_STATUS];

export const POS_SESSION_EVENT_TYPE = {
  OPEN: 'OPEN',
  AUTO_OPEN: 'AUTO_OPEN',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  CLOSE: 'CLOSE',
  FORCE_CLOSE: 'FORCE_CLOSE',
  AUTO_LINK_DRAWER: 'AUTO_LINK_DRAWER',
} as const;

export type PosSessionEventType =
  (typeof POS_SESSION_EVENT_TYPE)[keyof typeof POS_SESSION_EVENT_TYPE];

export const POS_SESSION_PERMISSIONS = {
  VIEW: 'pos_session:view',
  VIEW_ALL: 'pos_session:view_all',
  OPEN: 'pos_session:open',
  PAUSE_RESUME: 'pos_session:pause_resume',
  CLOSE: 'pos_session:close',
  FORCE_CLOSE: 'pos_session:force_close',
} as const;

export const POS_SESSION_IDEMPOTENCY_RESOURCE = {
  ENSURE_ORDER_ENTRY: 'pos_session:ensure_order_entry',
  OPEN: 'pos_session:open',
  PAUSE: 'pos_session:pause',
  RESUME: 'pos_session:resume',
  CLOSE: 'pos_session:close',
  FORCE_CLOSE: 'pos_session:force_close',
  AUTO_LINK_DRAWER: 'pos_session:auto_link_drawer',
} as const;
