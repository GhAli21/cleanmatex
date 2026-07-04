import type { PageAccessContract } from '@/lib/auth/access-contracts';

export const POS_SESSIONS_ACCESS_CONTRACTS: PageAccessContract[] = [
  {
    routePattern: '/dashboard/internal_fin/pos-sessions',
    label: 'POS Sessions',
    page: {
      permissions: ['pos_session:view'],
      requireAllPermissions: true,
    },
    actions: {
      openPosSession: {
        label: 'Open POS session',
        requirement: { permissions: ['pos_session:open'], requireAllPermissions: true },
      },
      pauseResumePosSession: {
        label: 'Pause or resume POS session',
        requirement: { permissions: ['pos_session:pause_resume'], requireAllPermissions: true },
      },
      closePosSession: {
        label: 'Close POS session',
        requirement: { permissions: ['pos_session:close'], requireAllPermissions: true },
      },
      forceClosePosSession: {
        label: 'Force-close POS session',
        requirement: { permissions: ['pos_session:force_close'], requireAllPermissions: true },
      },
      viewAllPosSessions: {
        label: 'View all POS sessions',
        requirement: { permissions: ['pos_session:view_all'], requireAllPermissions: true },
      },
      closeLinkedCashDrawer: {
        label: 'Close linked cash drawer session',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
      },
    },
    apiDependencies: [
      {
        label: 'V1 Branches',
        method: 'GET',
        path: '/api/v1/branches',
        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],
      },
      {
        label: 'List POS sessions',
        method: 'GET',
        path: '/api/v1/pos-sessions',
        requirement: { permissions: ['pos_session:view'], requireAllPermissions: true },
      },
      {
        label: 'Get my active POS session',
        method: 'GET',
        path: '/api/v1/pos-sessions/my-active',
        requirement: { permissions: ['pos_session:view'], requireAllPermissions: true },
      },
      {
        label: 'Open POS session',
        method: 'POST',
        path: '/api/v1/pos-sessions/open',
        requirement: { permissions: ['pos_session:open'], requireAllPermissions: true },
      },
      {
        label: 'Pause POS session',
        method: 'POST',
        path: '/api/v1/pos-sessions/pause',
        requirement: { permissions: ['pos_session:pause_resume'], requireAllPermissions: true },
      },
      {
        label: 'Resume POS session',
        method: 'POST',
        path: '/api/v1/pos-sessions/resume',
        requirement: { permissions: ['pos_session:pause_resume'], requireAllPermissions: true },
      },
      {
        label: 'Close POS session',
        method: 'POST',
        path: '/api/v1/pos-sessions/close',
        requirement: { permissions: ['pos_session:close'], requireAllPermissions: true },
      },
      {
        label: 'Force-close POS session',
        method: 'POST',
        path: '/api/v1/pos-sessions/force-close',
        requirement: { permissions: ['pos_session:force_close'], requireAllPermissions: true },
      },
      {
        label: 'Get POS session summary',
        method: 'GET',
        path: '/api/v1/pos-sessions/[sessionId]/summary',
        requirement: { permissions: ['pos_session:view'], requireAllPermissions: true },
      },
      {
        label: 'Close linked cash drawer session',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/close-session',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
      },
    ],
    notes: [
      'POS session is user-owned operational lineage; cash drawer session remains physical cash reconciliation truth.',
      'If the linked drawer is still open, the UI requires the drawer close step before retrying POS close.',
    ],
  },
];

export const POS_SESSIONS_DASHBOARD_ACCESS = POS_SESSIONS_ACCESS_CONTRACTS[0]!;
