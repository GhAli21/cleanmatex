# RBAC & User Management — Progress Status

## Feature Overview
RBAC (Role-Based Access Control) screens for `cleanmatex/web-admin`, fully backed by `platform-api` (port 3002).

---

## Implementation Status

### API Layer
| File | Status | Notes |
|------|--------|-------|
| `lib/api/rbac-client.ts` | ✅ Complete | Shared `rbacFetch` wrapper, `RbacApiError`, query param support |
| `lib/api/roles.ts` | ✅ Complete | `TenantRole` type, `code`-based identifier (NOT UUID), all functions take `accessToken` |
| `lib/api/permissions.ts` | ✅ Complete | `TenantPermission` type, `resource:action` codes, category grouping |
| `lib/api/users.ts` | ✅ Complete | Full rewrite — no Supabase, all via platform-api, `UserActionResult` backwards compat |

### Shared Components
| File | Status | Notes |
|------|--------|-------|
| `components/permissions/PermissionAssignmentModal.tsx` | ✅ Complete | Added `accessToken` prop, fixed `role.role_id` → `role.code` |

### Screens
| Screen | Route | Status | Notes |
|--------|-------|--------|-------|
| Users Management | `/dashboard/users` | ✅ Complete | Platform-api backed, accessToken passed, View Details link added |
| User Details & Roles | `/dashboard/users/[userId]` | ✅ Complete | New page: user card, Roles tab, Effective Permissions tab, assign/remove roles |
| Roles Management | `/dashboard/settings/roles` | ✅ Complete | Platform-api backed, `code` identifier, delete confirmation modal |
| Permissions Management | `/dashboard/settings/permissions` | ✅ Complete | New page: category tabs, search, CRUD modals, code format validation |

### User Sub-Components
| File | Status | Notes |
|------|--------|-------|
| `app/dashboard/users/components/user-modal.tsx` | ✅ Complete | `accessToken` prop, removed Supabase admin calls, removed `send_invite` |
| `app/dashboard/users/components/user-table.tsx` | ✅ Complete | Added "Details" link → `/dashboard/users/${user_id}` |
| `app/dashboard/users/components/user-filters-bar.tsx` | ✅ Complete | Dynamic `availableRoles` prop for role filter dropdown |
| `app/dashboard/users/components/user-stats-cards.tsx` | ✅ Complete | Import updated to `@/lib/api/users` |

### Navigation
| Item | Status | Notes |
|------|--------|-------|
| Settings layout — Permissions tab | ✅ Complete | Added `Key` icon + 9th tab at `/dashboard/settings/permissions` |
| `config/navigation.ts` — Permissions sub-item | ✅ Complete | Added under Settings section, admin-only |

### i18n
| File | Status | Notes |
|------|--------|-------|
| `messages/en.json` | ✅ Complete | Added 14 new keys under `settings` namespace |
| `messages/ar.json` | ✅ Complete | Arabic translations for same 14 keys |

### Environment
| Item | Status | Notes |
|------|--------|-------|
| `.env.local` — `NEXT_PUBLIC_PLATFORM_API_URL` | ✅ Complete | `http://localhost:3002/api/hq/v1` |
| `.env.local.example` | ✅ Complete | Updated with platform API URL |

### Documentation
| File | Status |
|------|--------|
| `docs/dev/RBAC_And_User_Managment/progress_status.md` | ✅ Complete |
| `docs/dev/RBAC_And_User_Managment/developer_guide.md` | ✅ Complete |
| `docs/dev/RBAC_And_User_Managment/user_guide.md` | ✅ Complete |

### Build
| Step | Status |
|------|--------|
| `npm run build` in `web-admin` | ✅ Passing — 0 TypeScript errors |

---

## Architecture Decision Record
**Decision:** All RBAC data flows exclusively through `platform-api`. No direct Supabase queries from RBAC screens.

**Rationale:** Platform-api handles dual Supabase Auth + DB user creation, permission rebuilding, role hierarchies, and tenant isolation — none of which can be safely replicated in the client.

**Token:** `session.access_token` from `useAuth()` passed as `Authorization: Bearer` header to all platform-api calls.
