/**
 * RBAC catalog constants.
 *
 * Roles and permissions live in global catalogs (`sys_auth_roles`, `sys_auth_permissions`,
 * `sys_auth_role_default_permissions`) that are shared by every organization. A change made by one
 * organization would therefore affect all of them, so the platform API only lets HQ operators write
 * to them (HqIdentityGuard on POST/PATCH/DELETE of `tenant-api/roles` and `tenant-api/permissions`).
 * The tenant screens are read-only; flip this only together with a per-organization role model.
 */
export const RBAC_CATALOG_TENANT_WRITABLE = false;
