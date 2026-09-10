# Rack & Bags Modal

Reusable rack/locker/bag/hanging entry dialog, wired into `WorkflowActionBar` (cross-cutting — reaches every screen that mounts it) and into the Ready Details bespoke release button.

## Docs in this folder

| File | Covers |
|---|---|
| [PRD.md](./PRD.md) | Problem, decision, scope |
| [STATUS.md](./STATUS.md) | Phase-by-phase progress (current status of truth) |
| [migrations.md](./migrations.md) | `0497_org_orders_locker_hanging.sql` — created, not yet applied |
| [api-routes.md](./api-routes.md) | `GET /rack-bags`, extended `POST /batch-update` |
| [ui-component.md](./ui-component.md) | `RackBagsModal`, `CmxCountPicker`, reach across screens |
| [i18n-keys.md](./i18n-keys.md) | EN/AR keys added |
| [testing_guide_and_scenarios.md](./testing_guide_and_scenarios.md) | Owner-runnable manual QA scenarios |
| [CHANGELOG.md](./CHANGELOG.md) | What shipped, in order |

## Pack completeness note

This is a scoped UI/backend feature, not a new platform surface — the following standard pack files are deliberately not produced, per the `/documentation` skill's guidance to reflect repository truth rather than pad the pack:

- `development_plan.md` — superseded by `PRD.md` (this feature's plan is small enough to live there) and the throwaway harness plan file referenced in `PRD.md`.
- `progress_summary.md` — `STATUS.md` already serves this role; a second file would duplicate it.
- `developer_guide_mermaid.md` / `user_guide_mermaid.md` — no diagram-worthy flow beyond what `ui-component.md`'s prose already covers (a single dialog + one retry step).
- `deploy_guide.md` — no infrastructure or deployment change; the only deploy-relevant step is applying migration `0497`, covered in `migrations.md`.
- `user_guide.md` — folded into `testing_guide_and_scenarios.md` since the "how to use it" and "how to test it" content are the same for this feature (a staff-facing dialog with no separate configuration).

No RBAC permissions, navigation entries, tenant settings, feature flags, or plan limits were added by this feature — `orders:update` / `orders:transition` (both pre-existing) cover all writes.
