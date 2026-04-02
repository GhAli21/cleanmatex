# User Management & RBAC — Progress Status

**Feature:** Full Tenant RBAC & User Management in cleanmatex (web-admin)
**Plan file:** `/home/dellunix/.claude/plans/virtual-fluttering-wren.md`
**Last updated:** 2026-04-03
**Status:** ✅ Implementation Complete

---

## Phase Checklist

### Phase 1 — Frontend API Client Extension

| # | File | Status |
|---|------|--------|
| 1 | `web-admin/lib/api/user-rbac.ts` | ✅ Done |

New functions: `getUserRolesExtended`, `getUserWorkflowRoles`, `assignRoles`, `removeRole`, `assignWorkflowRoles`, `getPermissionOverrides`, `setPermissionOverrides`, `setResourcePermissionOverrides`, `rebuildPermissions`, `getEffectivePermissions`.

---

### Phase 2 — React Hooks

| # | File | Status |
|---|------|--------|
| 2 | `web-admin/lib/hooks/use-tenant-roles.ts` | ✅ Done |
| 3 | `web-admin/lib/hooks/use-tenant-permissions.ts` | ✅ Done |
| 4 | `web-admin/lib/hooks/use-user-role-assignments.ts` | ✅ Done |

Exported hooks: `useUserRoleAssignments(userId)`, `useUserPermissionOverrides(userId)`, `useEffectivePermissions(userId)`.

---

### Phase 3 — New UI Components

| # | File | Status |
|---|------|--------|
| 5 | `src/features/users/ui/rbac/assign-roles-dialog.tsx` | ✅ Done |
| 6 | `src/features/users/ui/rbac/assign-workflow-roles-dialog.tsx` | ✅ Done |
| 7 | `src/features/users/ui/rbac/permission-override-dialog.tsx` | ✅ Done |
| 8 | `src/features/users/ui/rbac/user-roles-tab.tsx` | ✅ Done |
| 9 | `src/features/users/ui/rbac/index.ts` | ✅ Done |
| 10 | `src/features/users/ui/user-profile-tab.tsx` | ✅ Done |
| 11 | `src/features/users/ui/user-activity-tab.tsx` | ✅ Done |
| 12 | `src/features/users/ui/user-detail-screen.tsx` | ✅ Done |
| 13 | `app/dashboard/users/[userId]/page.tsx` | ✅ Done — 2-line wrapper |

---

### Phase 4 — Existing Component Enhancements

| # | File | Status |
|---|------|--------|
| 14 | `src/features/users/ui/user-filters-bar.tsx` | ✅ Done |

Changes: real bulk activate/deactivate/delete via platform-api, delete confirmation dialog, workflow role filter dropdown.

---

### Phase 5 — i18n

| # | File | Status |
|---|------|--------|
| 15 | `messages/en.json` — `users.detail` + `users.rbac` + `users.filters` | ✅ Done |
| 16 | `messages/ar.json` — `users.detail` extra keys + `users.rbac` block + `users.filters` keys | ✅ Done |

---

### Phase 6 — Documentation

| # | File | Status |
|---|------|--------|
| 17a | `docs/features/user_management/progress_status.md` | ✅ This file |
| 17b | `docs/features/user_management/developer_guide.md` | ✅ Done |
| 17c | `docs/features/user_management/user_guide.md` | ✅ Done |

---

## Architecture Notes

- Resource-scoped roles live in `org_auth_user_resource_roles` (separate table, NOT extra columns on `org_auth_user_roles`)
- All RBAC API calls go through `platform-api` (port 3002) via `rbacFetch()` — never direct Supabase
- DB still uses RLS; platform-api enforces tenant isolation server-side
- `useAuth()` provides `session.access_token` (JWT) and `currentTenant.tenant_id`
