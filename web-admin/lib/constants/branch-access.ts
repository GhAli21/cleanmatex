/**
 * Branch scoping of cash-drawer and POS-session operations (B3).
 * Values mirror the DB: the permission codes are seeded in migrations 0517 / the base RBAC seed,
 * and `branch` is the `resource_type` used in `org_auth_user_resource_permissions`.
 */

/** Holders see every branch (management / finance oversight). Seeded in migration 0517. */
export const BRANCH_ACCESS_ALL_BRANCHES_PERMISSION = 'cash_drawer:view_all_branches';

/** A user's extra branch: a resource grant of this permission on a `branch` resource. */
export const BRANCH_ACCESS_GRANT_PERMISSION = 'cash_drawer:view';

/** `org_auth_user_resource_permissions.resource_type` for a branch grant. */
export const BRANCH_ACCESS_RESOURCE_TYPE = 'branch';

/** Stable error code returned with HTTP 403 when a branch is outside the actor's scope. */
export const BRANCH_ACCESS_ERROR = 'DRAWER_BRANCH_FORBIDDEN';
