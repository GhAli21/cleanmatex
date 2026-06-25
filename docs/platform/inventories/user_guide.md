---
version: v1.0.0
last_updated: 2026-06-25
audience: tenant_admin, super_admin, developers
---

# Platform Inventories — User Guide

Read-only reference for **who can access what** in CleanMateX: permissions, feature flags, navigation gates, and access contracts.

Use this screen when you need to answer:

- “What permission does this page require?”
- “Which feature flag gates this menu item?”
- “Does navigation match the access contract for this route?”

---

## Who can use it

| Requirement | Details |
|-------------|---------|
| **Permission** | `help:platform_inventories` |
| **Typical roles** | All roles (seeded via migration `0385` on every `sys_auth_roles` row) |
| **Read-only** | You cannot change gates from this screen — it is for review only |

---

## How to open Platform Inventories

### From Help

1. Open the sidebar → **Help**
2. Click **Open Platform Inventories** on the Platform Inventories card  
   **URL:** `/dashboard/help/platform-inventories`

### From the permissions shield (any page)

1. Click the **shield** icon in the top bar (permissions inspector)
2. Click **View full inventory in Help →**  
   This opens Platform Inventories filtered to the **current page route** (`?route=/dashboard/...`)

---

## Screen layout

```
┌─────────────────────────────────────────────────────────────┐
│  Platform Inventories                                        │
│  Read-only view of access contracts, permissions, flags…     │
│  Generated: <date> · <git sha>                               │
│  Route filter: /dashboard/...  (when opened from shield)     │
├─────────────────────────────────────────────────────────────┤
│  [ Search inventories… ]                                     │
├─────────────────────────────────────────────────────────────┤
│  Access contracts | Permissions | Feature flags | Navigation │
│  | Summary                                                   │
├─────────────────────────────────────────────────────────────┤
│  <paginated table for active tab>                            │
└─────────────────────────────────────────────────────────────┘
```

- **Search** — filters rows on the active tab (permission codes, routes, file paths, flag keys, etc.)
- **Pagination** — 25 rows per page (contracts, permissions, flags, navigation)
- **Generated timestamp** — when the inventory snapshot was last rebuilt

---

## Tabs — what each one shows

### Access contracts (start here)

**Best source for page-level gates.**

| Column | Meaning |
|--------|---------|
| `routePattern` | Dashboard route (e.g. `/dashboard/orders/[id]`) |
| `label` | Human label from the contract |
| `permissions` | Page-level permission codes required |
| `featureFlags` | Plan/tenant flags required on the page |
| `actions` | Count of action-level gates (buttons, API deps) |
| `sourceFile` | `*-access.ts` file that defines the contract |

Use this tab to verify **what a screen requires before a user can open it**.

### Permissions

**Code scan — where permission checks appear in source.**

| Column | Meaning |
|--------|---------|
| `permissionCode` | Full code (`orders:create`, `invoices:update`, …) |
| `surface` | Where checked: `screen`, `api`, `hook`, `service`, … |
| `file` | Source file path |
| `line` | Line number |
| `route` | Dashboard route if applicable; otherwise file path |

> **Important:** This tab is an **audit trail**, not the canonical page-gate list.  
> Prefer **Access contracts** for “what does this page need?”  
> API routes are listed here with `surface: api`.

### Feature flags

Where feature flags are referenced in code (UI, services, API).

| Column | Meaning |
|--------|---------|
| `flagKey` | Flag key (e.g. `campaigns_enabled`) |
| `surface` | `screen`, `api`, `service`, … |
| `file` / `line` | Location in codebase |
| `context` | Short context string from extractor |

For plan-bound flags and catalog metadata, see [FEATURE_FLAGS_REFERENCE](../feature_flags/FEATURE_FLAGS_REFERENCE.md).

### Navigation

Sidebar / menu entries from `navigation.ts` (and DB `sys_components_cd` mirror).

| Column | Meaning |
|--------|---------|
| `path` | Menu path |
| `label` / `key` | Display label and stable key |
| `permissions` | Permissions on the nav item |
| `featureFlag` | Flag required to show the item |

Compare with **Access contracts** for the same `path` to confirm nav and contract agree.

### Summary

High-level counts:

- Access contracts, permission usages, flag usages, settings, plan limits
- Navigation entries, flag catalog entries
- Generation timestamp and git SHA

---

## Authority — which source to trust

When sources disagree, use this order:

1. **Runtime** — what the app actually enforces (API, guards, UI)
2. **Access contracts** (`*-access.ts`) + **navigation** (`navigation.ts`)
3. **Merged inventory** (what this Help screen shows)
4. **GENERATED_*.md** in `docs/platform/inventories/` (same data, markdown)
5. **Legacy docs** — link to generated views; may be stale if not rebuilt

---

## Common tasks

### “Why can’t this user see menu item X?”

1. Open Platform Inventories → **Navigation** tab → search for the path
2. Note `permissions` and `featureFlag`
3. Switch to **Access contracts** → search same route
4. Confirm the user’s role has those permissions and the tenant/plan has the flag enabled

### “What permission do I need for this page?”

1. Open the page in web-admin
2. Click shield → **View full inventory in Help**
3. **Access contracts** tab (pre-filtered by route) → read `permissions` and `featureFlags`

### “Is our documentation up to date?”

Check **Generated** date at the top. If it is older than your last RBAC/nav/flag change, ask your dev team to run a rebuild (see [For developers](#for-developers) below).

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Red error: “Platform inventory file not found” | Production deploy missing bundled JSON | Dev team: run `npm run rebuild:platform-info-inventories`, commit `web-admin/data/platform/platform-info-inventory.json`, redeploy |
| Page loads but data looks old | Snapshot not rebuilt after code changes | Dev team: rebuild + redeploy |
| Permissions tab shows file paths in `route` | Component is not a dashboard `page.tsx` — normal for feature UI files | Use **Access contracts** for route-level gates |
| Nav vs contract mismatch | Drift between `navigation.ts` and `*-access.ts` | Dev team: fix contract or nav, run `npm run check:platform-info-inventories` |

---

## For developers

| Topic | Document |
|-------|----------|
| Rebuild commands, CI, drift | [platform-inventories-maintenance.md](../../dev/platform-inventories-maintenance.md) |
| File index, authority ladder | [inventories/README.md](README.md) |
| Agent skill | `/rebuild-platform-info-inventories` |
| PR checklist | `.github/pull_request_template.md` (Platform gating section) |

**Quick rebuild (repo root):**

```bash
npm run rebuild:platform-info-inventories
npm run check:platform-info-inventories
```

Commit updated `docs/platform/inventories/*` and `web-admin/data/platform/platform-info-inventory.json`, then deploy web-admin.

---

## Related guides

- [RBAC User Guide](../../features/RBAC/user_guide.md) — roles and permissions management
- [PERMISSIONS_REFERENCE](../permissions/PERMISSIONS_REFERENCE.md) — all permission codes
- [FEATURE_FLAGS_REFERENCE](../feature_flags/FEATURE_FLAGS_REFERENCE.md) — flag catalog
- [NAVIGATION_PERMISSIONS](../permissions/NAVIGATION_PERMISSIONS.md) — navigation permission matrix
