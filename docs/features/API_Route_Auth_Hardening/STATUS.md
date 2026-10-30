# API Route Auth Hardening (BF-23) — STATUS

**Plan:** [PLAN.md](PLAN.md)
**Overall:** DRAFT — waiting for owner approval of the plan and decisions D1–D4.

| Step | Title | Status |
|---|---|---|
| 0 | Confirm callers, role coverage, D2/D3 facts | Not started |
| 1 | Orders routes (#1–#14) | Not started |
| 2 | Catalog and pricing routes (#15–#23) | Not started |
| 3 | Settings, workflow, roles routes (#24–#28) | Not started |
| 4 | Services and `server-auth.ts` fallback | Not started |
| 5 | Retire navigation write endpoints + drop `sys_components_cd` write policies (D2) | Not started |
| 6 | Access contracts + platform inventories | Not started |
| 7 | Repo rule test (`api-route-auth-guard`) | Not started |
| 8 | Verify, QA scenarios, close BF-23 | Not started |
| — | Gap C: revoke Supabase session on session end (D3), separate package | Not started |

## Log

- **2026-10-30 (plan drafted, no code):** re-verified BF-23 on the remote DB. `org_users_mst` has `UNIQUE (user_id)`, so `tenants[0]` always equals the session tenant — the original "wrong tenant" premise does not hold. The real gaps are: the 30 routes skip server session validation (Gap A) and permission checks (Gap B); session end does not revoke the Supabase session (Gap C); tenant `super_admin` can write global navigation (Gap D). Inventory, permission mapping and steps in PLAN.md.
