# Workflow: Create hydration, collection types, Initial rules, Hold

**Date:** 2026-09-03  
**Canonical detail:** `docs/features/Workflow_Order_Advance/future_work_in_wf/04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md`  
**Scope:** Now (no “later”) — tenant + HQ handoff  

---

## Agent operating rules (mandatory — CLAUDE.md)

| Rule | Action |
|------|--------|
| **Migrations** | **Create `.sql` only.** **Never** apply via Supabase CLI, MCP, or any tool. **Stop and wait** for operator to apply locally + remote, regen types, then confirm before next WP. |
| **Skills before code** | Load `/database` (SQL), `/frontend` (UI), `/backend` (API), `/i18n`, `/implementation`, `/code-documentation`, `/documentation` (pack refresh). HQ catalog: switch repo + `/manage-wf-policy-issues-catalog`. |
| **UI** | Cmx only (`@ui/*`). **Reuse** existing stage patterns (ActionBar, worklist, stage-owned complete). **Create reusable** shared component when ≥2 surfaces need the same home-collection UX. |
| **After each WP step** | Run **STATUS-*** + **DOC-*** tasks below before starting the next step. |
| **End of programme slice** | Run **DOC-FINAL** (`/documentation` skill) before sign-off. |

**Operator apply gate:** `0479`–`0488` **applied**. `0488` now seeds the unsigned `WF_V2_HOME_COLLECTION` DRAFT; Check policy + Compile verified clean (`ok: true`, 0 issues, local DB) — next operator gate is **Pilot** (Studio, `workflows.manage`, not run by the agent). HQ H1–H3 **done**. Catalog **1.3.0**. Tenant leftover close-out **done**. Floor smoke HC1/HC2 + H1–H4 remain.

---

## Relationship to live-profile runtime plans (do not confuse)

| Plan | Role |
|------|------|
| [Tenant live runtime 20260827](workflow_live_profile_runtime_20260827.plan.md) | **Platform foundation** — ADR-0010 resolver, Gates 0–5 |
| [HQ live runtime 20260827](F:/jhapp/cleanmatexsaas/.cursor/plans/workflow_live_profile_runtime_20260827.plan.md) | **HQ half** — Check policy, Studio, lifecycle |
| **This plan (20260903)** | **Product layer** — create presets, Initial matrix, HOME_COLLECTION, hold |

---

## Work packages — status

| ID | Work | Repo | Status |
|----|------|------|--------|
| T0 | Hygiene + wildcard INIT fix | tenant | **done** (operator applied 0478, 0481) |
| obs | Observer-exec catalog | tenant | **done** (0479 applied) |
| T1 | Presets + extract create services | tenant | **done** (0480–0482 applied) |
| T2a | Home collection catalog + profile SQL | tenant | **done** (0483–0484 applied) |
| T2b | Runtime adapters + floor UI + i18n | tenant | **done** |
| T3 | Hold edges + engine guards | tenant | **done** (0486 applied) |
| T4 | UX polish, access contracts, full test matrix | tenant | **done** (0485 applied) |
| H1 | Studio Initial rules + preset picker | HQ | **done** |
| H2 | Check-policy issue codes | HQ | **done** (catalog 1.3.0) |
| H3 | Home collection authoring + simulate create | HQ | **done** |
| C9 | live_rpt preset/wildcard reporters | tenant | **done** (`0487` applied) |

---

## Per-step governance tasks (repeat after every WP sub-step)

Copy this checklist into each WP; mark done before moving on.

### STATUS — plan & progress (required)

- [ ] Update **this file** WP table + blocked/done notes
- [ ] Update [04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md](../docs/features/Workflow_Order_Advance/future_work_in_wf/04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md) WP section + migration seq table
- [ ] Update [03_VERSIONED_REMAINING_WORK_PLAN.md](../docs/features/Workflow_Order_Advance/future_work_in_wf/03_VERSIONED_REMAINING_WORK_PLAN.md) V10x-M5 line
- [ ] Update [progress_summary.md](../docs/features/Workflow_Order_Advance/progress_summary.md)
- [ ] Update [current_status.md](../docs/features/Workflow_Order_Advance/current_status.md) “Next (engineering)”
- [ ] Append [CHANGELOG.md](../docs/features/Workflow_Order_Advance/CHANGELOG.md)

### DOC — related docs (required when behaviour/API/schema changes)

- [ ] [testing_guide_and_scenarios.md](../docs/features/Workflow_Order_Advance/testing_guide_and_scenarios.md) — new scenarios (e.g. C5/C6/HC1/HC2)
- [ ] [06_API_Contracts.md](../docs/features/Workflow_Order_Advance/06_API_Contracts.md) — new routes/commands
- [ ] [00_WF_ENTITY_GLOSSARY.md](../docs/features/Workflow_Order_Advance/future_work_in_wf/00_WF_ENTITY_GLOSSARY.md) — new terms if needed
- [ ] [future_work_in_wf/README.md](../docs/features/Workflow_Order_Advance/future_work_in_wf/README.md) — index line
- [ ] TS/constants mirror noted in developer_guide if new catalog codes

### MIG — migration handoff (required when SQL created)

- [ ] List exact seq + filename under `supabase/migrations/`
- [ ] Document apply order in 04 plan § Migration sequencing
- [ ] **Stop. Ask operator to apply + regen types. Do not proceed until confirmed.**

---

## WP task breakdown

### T2a — Catalog + profile seed (SQL only) ✅ created

| Task | Status |
|------|--------|
| T2a.1 Create `0483_wf_home_collection_catalog.sql` | done |
| T2a.2 Create `0484_wf_home_collection_profile_seed.sql` | done |
| T2a.3 Mirror `ORDER_TYPE_IDS`, `WORKFLOW_ACTIONS` | done |
| T2a.4 Unit tests (create resolver HC types) | done |
| T2a.5 STATUS + DOC + MIG handoff | done |
| **Operator:** apply 0483 → 0484, regen types | **done** |

### T2b — Runtime (after operator confirms migrations)

| Task | Status |
|------|--------|
| T2b.1 Load `/frontend`, `/backend`, `/i18n`; find reusable stage adapter pattern | done |
| T2b.2 Stage command adapters: ASSIGN / CONFIRM / FAIL home collection | done |
| T2b.3 Reusable home-collection floor card + detail/list screens | done |
| T2b.4 Workboard / list visibility + deep links | done (worklist via `useScreenOrders`; workboard observers in 0484) |
| T2b.5 EN/AR i18n; `cmxMessage` on command results | done |
| T2b.6 Access contracts if new routes | done (T4) |
| T2b.7 `npm run build` + targeted tests | build **pass** |
| T2b.8 STATUS + DOC | done |

### T3 — Hold hardening

| Task | Status |
|------|--------|
| T3.1 Migration: HOLD edges from allowlisted statuses | done (`0486_wf_hold_edges_expand.sql`) |
| T3.2 Engine guards (nested hold, terminal, resume) | done |
| T3.3 Tests H1–H4 | done (Jest) |
| T3.4 STATUS + DOC + MIG handoff | done |
| **Operator:** apply 0486, regen types | **done** |

### T4 — UX polish + full matrix

| Task | Status |
|------|--------|
| T4.1 Type/source picker labels (PICKUP vs HOME_COLLECTION vs C&D; defaults `POS` / `pos`) | done — New Order gap repaired 2026-09-04; submitted context reaches Initial-rule resolution |
| T4.2 Remote draft banner; home collection floor UX | done |
| T4.3 Full test matrix §9 | done (Jest C5/C6 + manual HC1/HC2 checklist) |
| T4.4 Navigation dual-write + access contracts | done (0485 applied) |
| T4.5 STATUS + DOC | done |

### HQ — H1 / H2 / H3 (cleanmatexsaas)

| Task | Status |
|------|--------|
| H*.n Implement WP per 04 plan §7 | **done** |
| H*.STATUS Update HQ plan + cross-link tenant 04 plan | **done** |

---

## DOC-FINAL — documentation pack (end of programme slice)

**When:** After T2b+T3+T4 (or agreed milestone), before merge/sign-off.

**Skill:** Load `/documentation` (`.claude/skills/documentation/SKILL.md`).

**Scope:** `docs/features/Workflow_Order_Advance/`

| Deliverable | Action |
|-------------|--------|
| README.md | Refresh overview + links |
| developer_guide.md | Create-time presets, home collection flow |
| developer_guide_mermaid.md | Create + HC command sequence diagrams |
| testing_guide_and_scenarios.md | Full §9 matrix |
| user_guide.md / user_guide_mermaid.md | Staff EN/AR flows (branch pickup vs home collection) |
| deploy_guide.md | Migration apply order, HQ deploy notes |
| technical_docs/ | live_runtime + home collection support if needed |
| version.txt | Bump if release tag agreed |
| CHANGELOG.md | Consolidate unreleased entries |

Use `/documentation-pack-repair` only if pack gaps are large; otherwise `/documentation` minimal churn.

---

## Success

- Create path has no retail/remote hardcoded overrides in OrderService.
- HQ can change stamps per profile without tenant code change.
- POS/mobile/retail/QD/home-collection scenarios covered by tests.
- Hold resumes exact prior status; nested/terminal hold rejected.
- Labels distinguish branch pickup vs home collection (EN/AR).
