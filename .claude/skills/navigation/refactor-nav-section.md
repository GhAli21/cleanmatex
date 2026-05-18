---
name: refactor-nav-section
description: Full workflow for refactoring a navigation section — rename, convert leaf to expandable section, add children, seed permissions, map roles, and keep navigation.ts in sync with sys_components_cd. Load alongside /navigation and /database skills. Invoked automatically by the nav-refactor-specialist agent.
user-invocable: true
---

# Refactor Navigation Section — Full Workflow

**When to use:** Any time a nav entry needs to be renamed, converted from a flat link to an expandable section, have children added/removed, or have its permissions and role mappings updated.

**Always load alongside:**
- `/navigation` — SQL patterns, dual-write rules, migration templates
- `/database` — migration naming conventions

---

## What "refactor a nav section" covers

| Change type | Steps required |
|---|---|
| Rename label | `navigation.ts` label + DB UPDATE (`label`, `label2`) |
| Convert flat leaf → expandable section | `is_leaf = false`, add `children[]` in `navigation.ts`, insert child rows in DB |
| Add a new child page | `navigation.ts` child entry + DB child INSERT + `parent_comp_id` resolution |
| Change roles | `navigation.ts` `roles[]` + DB `roles` JSONB — both in same change |
| Add/update permissions | `sys_auth_permissions` INSERT + `sys_auth_role_default_permissions` INSERT |
| Sync `.agents` skill | Copy `.claude/skills/navigation/SKILL.md` → `.agents/skills/navigation/SKILL.md` |

---

## Step-by-step checklist

### Phase 1 — Understand current state

- [ ] Read the current entry in `web-admin/config/navigation.ts` (find by `key`)
- [ ] Identify: is it currently `is_leaf = true` (flat) or already a node with `children[]`?
- [ ] List all child pages that belong under this section
- [ ] Confirm the full role set: `super_admin`, `tenant_admin`, `admin`, `branch_manager`, `operator`, `viewer`
- [ ] Confirm all permission codes the section needs

### Phase 2 — navigation.ts (frontend sidebar)

- [ ] **Rename:** update `label` string on the section entry
- [ ] **Convert to node:** add `children[]` array — move the original `path` into the first child entry
- [ ] **Child entries:** add objects with `key`, `label`, `path`, `roles`, `permissions?`
- [ ] **`roles[]`:** update on parent and every child to the agreed role set
- [ ] **`UserRole` type:** if a new role code is introduced, add it to the union at line 36
- [ ] **Parity check:** `roles[]` in `navigation.ts` must exactly match `roles` JSONB in DB — same codes

### Phase 3 — DB migration

Find next migration number:
```powershell
Get-ChildItem supabase/migrations/ -Filter "*.sql" | Where-Object { $_.Name -match "^\d{4}_" } | Sort-Object Name | Select-Object -Last 3
```

File name: `{seq}_nav_{short_description}.sql`

**Canonical section order (ref: 0251, 0275):**

```
BEGIN;

-- 0. sys_auth_permissions     INSERT  (ON CONFLICT DO NOTHING)
-- 1. sys_auth_role_default_permissions INSERT (CROSS JOIN + NOT EXISTS, per role group)
-- 2. sys_components_cd parent INSERT / ON CONFLICT DO UPDATE
-- 3. sys_components_cd children INSERT / ON CONFLICT DO UPDATE
-- 4. Resolve parent_comp_id UPDATE
-- 5. Ensure parent is_leaf = false UPDATE

COMMIT;
```

**Mandatory columns for every sys_components_cd INSERT/UPDATE:**

| Group | Columns |
|---|---|
| Bilingual | `label`, `label2`, `description`, `description2` |
| Hierarchy | `comp_level`, `display_order`, `parent_comp_code`, `parent_comp_id` |
| Flags | `is_leaf`, `is_navigable`, `is_active`, `is_system`, `is_for_tenant_use` |
| Access | `roles` (JSONB), `main_permission_code` |
| Audit | `rec_status`, `updated_at = CURRENT_TIMESTAMP` |

**sys_auth_permissions columns:**
`code, name, name2, category, description, description2, category_main, is_active, is_enabled, rec_status, created_at, created_by`

**sys_auth_role_default_permissions columns:**
`role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by`

**Permission matrix — standard role assignments:**

| Role | Typical access |
|---|---|
| `super_admin`, `tenant_admin`, `admin` | All permissions for the feature |
| `branch_manager` | Create, read, update, operational actions — no delete/export |
| `operator` | Create, read, update, limited actions — no delete/export/merge |
| `viewer` | Read + history only |

Use **separate INSERT blocks per role group** when subsets differ.
Use `CROSS JOIN` + `NOT EXISTS` — **never** `ON CONFLICT DO NOTHING` on `sys_auth_role_default_permissions`.

### Phase 4 — Parity validation

- [ ] `roles[]` in `navigation.ts` === `roles` JSONB in migration (same codes)
- [ ] Every `key` in `navigation.ts` matches `comp_code` in DB INSERT
- [ ] Every `path` in `navigation.ts` matches `comp_path` in DB INSERT
- [ ] `label` in `navigation.ts` matches `label` (EN) in DB INSERT
- [ ] `label2` (AR) set in DB INSERT — never NULL on a new or renamed row
- [ ] `messages/en.json` → `navigation` block updated with new label value
- [ ] `messages/ar.json` → `navigation` block updated with new Arabic label value
- [ ] `NAV_TRANSLATION_KEY_MAP` in `cmx-sidebar.tsx` contains an entry for the key (add if missing)
- [ ] `main_permission_code` exists in `sys_auth_permissions`
- [ ] `parent_comp_id` resolution UPDATE present for every child
- [ ] Final `is_leaf = false` UPDATE present for the parent

### Phase 5 — Build & sync

- [ ] Run `npm run build` inside `web-admin/` — fix all TypeScript errors
- [ ] If `SKILL.md` was updated: copy `.claude/skills/navigation/SKILL.md` → `.agents/skills/navigation/SKILL.md`

---

## Common mistakes

| Mistake | Consequence |
|---|---|
| Only updating `navigation.ts`, not DB | Sidebar shows item; RBAC/API denies access |
| Only updating DB, not `navigation.ts` | DB correct; sidebar never shows item |
| Updating DB label but not `messages/en.json` + `messages/ar.json` | super_admin/tenant_admin still see the old label (they use the hardcoded fallback path, not the DB) |
| Updating i18n files but not the DB `label`/`label2` | All other roles (admin, operator, viewer…) still see the old label |
| Missing `label2`/`description2` in INSERT | Breaks Arabic UI for non-admin roles |
| `ON CONFLICT DO NOTHING` on role-permission table | Silent partial-conflict failures |
| Missing `parent_comp_id` resolution UPDATE | Child rows have NULL FK; tree query breaks |
| Missing final `is_leaf = false` UPDATE | Expand toggle never renders |
| `roles[]` in `navigation.ts` differs from DB JSONB | Sidebar and RBAC disagree |
| New role code missing from `UserRole` type | TypeScript build error |
| Not running `npm run build` | Shipping broken TypeScript |

---

## References

- SQL templates → `/navigation` SKILL.md
- Reference migrations: `0251_marketing_gifts_promotions_navigation_and_permissions.sql`, `0275_nav_customer_management_section.sql`
- Frontend sidebar: `web-admin/config/navigation.ts`
- Skills sync: `.claude/skills/navigation/SKILL.md` ↔ `.agents/skills/navigation/SKILL.md`
