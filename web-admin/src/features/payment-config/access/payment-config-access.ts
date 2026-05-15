export const PAYMENT_CONFIG_PERMISSIONS = {
  CONFIGURE: 'payments:configure',
  VIEW_METHODS: 'payments:view_methods',
  CASH_DRAWER_VIEW: 'cash_drawer:view',
  CASH_DRAWER_OPEN: 'cash_drawer:open',
  CASH_DRAWER_CLOSE: 'cash_drawer:close',
  CASH_DRAWER_CASH_IN: 'cash_drawer:cash_in',
  CASH_DRAWER_CASH_OUT: 'cash_drawer:cash_out',
  CASH_DRAWER_CASH_DROP: 'cash_drawer:cash_drop',
  CASH_DRAWER_VIEW_MOVEMENTS: 'cash_drawer:view_movements',
  CASH_DRAWER_FORCE_CLOSE: 'cash_drawer:force_close',
} as const;
