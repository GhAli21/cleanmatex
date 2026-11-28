/**
 * Customer module RBAC codes. Values mirror `sys_auth_permissions.code` exactly.
 * API guards and access contracts retain literal strings for inventory extraction.
 */
export const CUSTOMERS_PERMISSIONS = {
  MANAGE_CREDENTIALS: 'customers:manage_credentials',
} as const;

export type CustomersPermissionCode =
  (typeof CUSTOMERS_PERMISSIONS)[keyof typeof CUSTOMERS_PERMISSIONS];
