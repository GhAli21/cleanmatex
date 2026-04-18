# CleanMateX Mobile Apps

This directory is reserved for Flutter-based mobile applications in the CleanMateX platform.

## Intended Scope

Planned app surfaces include:

- customer application
- driver application
- store or staff mobile experience

## Current Repository State

At the current repository state, this area now contains a real bootstrap workspace under `apps/` and `packages/`, plus the mobile documentation and governance layer.

Treat anything beyond the current scaffold as planned scope unless concrete feature or package implementation exists on disk.

## Guidance

- use `docs/plan/master_plan_cc_01.md` and relevant feature docs for roadmap context
- use `cmx_mobile_apps/.clauderc` as implementation guidance only, not as proof that a mobile module is already fully implemented
- use `cmx_mobile_apps/AGENTS.md`, `cmx_mobile_apps/CLAUDE.md`, and `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md` as the authoritative mobile instruction layer
- use `cmx_mobile_apps/.codex/skills/` for mobile-specific coding, architecture, UI/UX, i18n/RTL, and testing guidance
- use `cmx_mobile_apps/apps/` and `cmx_mobile_apps/packages/` as the active bootstrap workspace
- when app code and folders are added, create colocated app READMEs and feature/module docs that reflect real implementation status

## Related Documentation

- `../README.md`
- `../docs/README.md`
- `../docs/plan/master_plan_cc_01.md`
- `.clauderc`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/MOBILE_FOUNDATION_DECISIONS.md`
- `docs/Implementation_docs/customer_app_production_milestone_plan.md`
- `docs/Implementation_docs/mobile_skill_set_plan.md`
