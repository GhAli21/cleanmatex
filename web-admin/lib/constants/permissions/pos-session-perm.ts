export const POS_SESSION_PERMISSIONS = {
  VIEW: 'pos_session:view',
  VIEW_ALL: 'pos_session:view_all',
  OPEN: 'pos_session:open',
  PAUSE_RESUME: 'pos_session:pause_resume',
  CLOSE: 'pos_session:close',
  FORCE_CLOSE: 'pos_session:force_close',
} as const;

export type PosSessionPermission =
  (typeof POS_SESSION_PERMISSIONS)[keyof typeof POS_SESSION_PERMISSIONS];
