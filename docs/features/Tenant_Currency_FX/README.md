# Tenant Currency & FX

**Status:** Plan complete (`implementation_plan_01.md`). See its §0.4/§0.5 for the closure/hardening history.

**User guide, developer guide, deployment guide, and manual QA checklist for this feature live in the sibling repo** (it's a cross-repo feature; `cleanmatexsaas` is the documented single hub, per `RESUME_HERE.md`):

- `cleanmatexsaas/docs/features/Currency_Setup/user_guide.md` — Part B is tenant-admin-facing (Currencies & FX screen usage)
- `cleanmatexsaas/docs/features/Currency_Setup/developer_guide.md` — architecture across both repos, including the tenant-side services under `web-admin/lib/services/fx/`
- `cleanmatexsaas/docs/features/Currency_Setup/deploy_guide.md` — the full migration sequence (all migrations are created in this repo, per the standing "cleanmatex owns all migrations" rule)
- `cleanmatexsaas/docs/features/Currency_Setup/testing_scenarios.md` — manual QA checklist, Part B covers the tenant-side screens

`implementation_plan_01.md` in this folder remains the historical build log for the tenant side; `RESUME_HERE.md` in the sibling repo is the authoritative cross-repo resume/status doc.
