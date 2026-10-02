export const POS_SESSION_PERMISSIONS = {
  VIEW: 'pos_session:view',
  VIEW_ALL: 'pos_session:view_all',
  OPEN: 'pos_session:open',
  PAUSE_RESUME: 'pos_session:pause_resume',
  CLOSE: 'pos_session:close',
  FORCE_CLOSE: 'pos_session:force_close',
  /** POS Session & Cash Drawer Hardening W0-10 (migration 0517) — new. */
  CLOSE_OTHERS: 'pos_session:close_others',
  REPORT_Z: 'pos_session:report_z',
  /** Session management actions E3-1 (migration 0552) — act on another user's session. */
  OPEN_OTHERS: 'pos_session:open_others',
  /** Tenant-wide override: open/close/force-close ANY user's session without the individual *_others grants. */
  FULL_MANAGE_OTHERS: 'pos_session:full_manage_others',
} as const;

export type PosSessionPermission =
  (typeof POS_SESSION_PERMISSIONS)[keyof typeof POS_SESSION_PERMISSIONS];
