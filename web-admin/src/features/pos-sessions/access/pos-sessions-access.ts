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
      openOthersPosSession: {
        label: 'Open POS session for another user',
        requirement: { permissions: ['pos_session:open_others', 'pos_session:full_manage_others'], requireAllPermissions: false },
      },
      closeOthersPosSession: {
        label: 'Close another user\'s POS session',
        requirement: { permissions: ['pos_session:close_others', 'pos_session:full_manage_others'], requireAllPermissions: false },
      },
      forceCloseOthersPosSession: {
        label: 'Force-close another user\'s POS session',
        requirement: { permissions: ['pos_session:close_others', 'pos_session:force_close', 'pos_session:full_manage_others'], requireAllPermissions: false },
      },
      viewAllPosSessions: {
        label: 'View all POS sessions',
        requirement: { permissions: ['pos_session:view_all'], requireAllPermissions: true },
      },
      closeLinkedCashDrawer: {
        label: 'Close linked cash drawer session',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
      },
      viewLinkedCashDrawerSummary: {
        label: 'View linked cash drawer close summary',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
      },
      approveCashDrawerVariance: {
        label: 'Approve over-threshold cash drawer close variance (B16)',
        requirement: { permissions: ['cash_drawer:approve_variance'], requireAllPermissions: true },
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
        label: 'List POS-session filter options',
        method: 'GET',
        path: '/api/v1/pos-sessions/filter-options',
        requirement: { permissions: ['pos_session:view'], requireAllPermissions: true },
        notes: ['Options are restricted to session values visible within the authenticated tenant and selected own/all scope.'],
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
        label: 'Close POS session (self, legacy active-session endpoint)',
        method: 'POST',
        path: '/api/v1/pos-sessions/close',
        requirement: { permissions: ['pos_session:close'], requireAllPermissions: true },
      },
      {
        label: 'Force-close POS session (self, legacy active-session endpoint)',
        method: 'POST',
        path: '/api/v1/pos-sessions/force-close',
        requirement: { permissions: ['pos_session:force_close'], requireAllPermissions: true },
      },
      {
        label: 'Open POS session for another user (row/toolbar action)',
        method: 'POST',
        path: '/api/v1/pos-sessions/open-others',
        requirement: { permissions: ['pos_session:open_others', 'pos_session:full_manage_others'], requireAllPermissions: false },
      },
      {
        label: 'List tenant users for the open-for-user picker',
        method: 'GET',
        path: '/api/v1/pos-sessions/users',
        requirement: { permissions: ['pos_session:open_others', 'pos_session:full_manage_others'], requireAllPermissions: false },
      },
      {
        label: 'Close a specific session by id (own or, with close_others/full_manage_others, another user\'s)',
        method: 'POST',
        path: '/api/v1/pos-sessions/[sessionId]/close',
        requirement: { permissions: ['pos_session:close', 'pos_session:close_others', 'pos_session:full_manage_others'], requireAllPermissions: false },
        notes: ['Actual server rule: own session needs pos_session:close; another user\'s session needs pos_session:close_others OR pos_session:full_manage_others. This any-of listing is a declarative over-approximation — see route code for the exact branch.'],
      },
      {
        label: 'Force-close a specific session by id (own or, with close_others+force_close/full_manage_others, another user\'s)',
        method: 'POST',
        path: '/api/v1/pos-sessions/[sessionId]/force-close',
        requirement: { permissions: ['pos_session:force_close', 'pos_session:close_others', 'pos_session:full_manage_others'], requireAllPermissions: false },
        notes: ['Actual server rule: own session needs pos_session:force_close; another user\'s session needs (pos_session:close_others AND pos_session:force_close) OR pos_session:full_manage_others, and bypasses the drawer-closed check. This any-of listing is a declarative over-approximation — see route code for the exact branch.'],
      },
      {
        label: 'Get POS session summary',
        method: 'GET',
        path: '/api/v1/pos-sessions/[sessionId]/summary',
        requirement: { permissions: ['pos_session:view'], requireAllPermissions: true },
      },
      {
        label: 'List POS session events',
        method: 'GET',
        path: '/api/v1/pos-sessions/[sessionId]/events',
        requirement: { permissions: ['pos_session:view'], requireAllPermissions: true },
        notes: ['The API applies authenticated tenant and own-versus-all session scope server-side.'],
      },
      {
        label: 'Close wizard — count step for the linked cash drawer (CLF-7, CLF-8 slice A)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/count',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
      },
      {
        label: 'Close wizard — finalize the linked cash drawer (CLF-7, CLF-8 slice A)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/close/finalize',
        requirement: { permissions: ['cash_drawer:close_session'], requireAllPermissions: true },
      },
      {
        label: 'Close wizard catalogs (CLF-7)',
        method: 'GET',
        path: '/api/v1/cash-drawers/catalogs',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
      },
      {
        label: 'Close wizard destination-drawer options (CLF-7)',
        method: 'GET',
        path: '/api/v1/cash-drawers',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
      },
      {
        label: 'Cash change rounding policy for the checkout (A6-1b)',
        method: 'GET',
        path: '/api/v1/cash-drawers/rounding-policy',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
      },
      {
        label: 'Close wizard denomination catalog (CLF-7, CLF-8-1)',
        method: 'GET',
        path: '/api/v1/currencies/[code]/denominations',
        requirement: { permissions: ['cash_drawer:view'], requireAllPermissions: true },
      },
      {
        label: 'Approve cash drawer close variance (B16)',
        method: 'POST',
        path: '/api/v1/cash-drawers/[drawerId]/session/[sessionId]/approve-variance',
        requirement: { permissions: ['cash_drawer:approve_variance'], requireAllPermissions: true },
      },
    ],
    notes: [
      'POS session is user-owned operational lineage; cash drawer session remains physical cash reconciliation truth.',
      'If the linked drawer is still open, the UI requires the drawer close step before retrying POS close.',
      'B16: `cash_drawer:approve_variance` is seeded by B27 — the route stays fail-closed (permission denied) until that migration lands and a role is granted it.',
      'Session management actions (E3-1, migration 0552): open_others/close_others/full_manage_others are permission-gated only, with no server-side branch scoping — there is no user-to-branch assignment table in this codebase to enforce it against, same gap as cash_drawer:view_all_branches. Admin force-close of another user\'s session bypasses the drawer-closed requirement by design (abandoned-session recovery); the event is tagged drawerCheckBypassed for audit.',
    ],
  },
];

export const POS_SESSIONS_DASHBOARD_ACCESS = POS_SESSIONS_ACCESS_CONTRACTS[0]!;
