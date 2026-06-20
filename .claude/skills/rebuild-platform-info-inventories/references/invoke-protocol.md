# Invoke protocol — `/rebuild-platform-info-inventories`

**Conditional invoke only.** Do not add this skill to the mandatory preload table in CLAUDE.md / AGENTS.md.

## Invocation format

```
/rebuild-platform-info-inventories
Mode: refresh | repair | rebuild-all | validate-only
Scope: surface=<...> [route=...] [path=...] [flagKey=...] [permissionCode=...]
Reason: <short why>
```

## Trigger table

| You changed… | Mode | Scope |
|--------------|------|-------|
| `*-access.ts` or page-access-registry | `refresh` | `surface=page`, `route=<path>` |
| `navigation.ts` or nav migration | `refresh` | `surface=navigation` |
| API `requirePermission` / auth guard | `refresh` | `surface=api`, `path=app/api/...` |
| Service `requireFeature` / plan limit | `refresh` | `surface=service` or `plan-limit` |
| New permission code (after migration) | `refresh` | `surface=permission`, `permissionCode=...` |
| New feature flag usage | `refresh` | `surface=feature-flag`, `flagKey=...` |
| Items in DRIFT_REPORT | `repair` | drift IDs |
| Quarterly / major release | `rebuild-all` | — |
| Pre-push / CI | `validate-only` | — |

## Co-invoke

| Task | Also load |
|------|-----------|
| New permission code | `/create-update-rbac-permission` |
| Nav menu item | `/navigation` |
| Dashboard page gate | edit `*-access.ts`, then this skill |
| Role permission matrix | `/update-rbac-role` (separate from this skill) |

## Out of scope

- Dashboard layout runtime blocker
- Hand-editing GENERATED markdown or merged JSON
- Applying DB migrations (create files only)
