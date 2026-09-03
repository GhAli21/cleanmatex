# 04 — Create hydration, fulfilment types, Initial rules, and Hold (implementation plan)

**Date:** 2026-09-03  
**Repos:** `cleanmatex` (tenant + **all** migrations) · `cleanmatexsaas` (HQ Studio authoring / Check policy / catalog)  
**Status:** T0–T4 **done**. HQ H1–H3 **done**. Catalog **1.3.0** (`evidence_without_home_collection`). Tenant leftover close-out **done** (`createOrderInTransaction` preset mapping, home-collection action gates, V10-C1 JSON editors redirect). Floor smoke HC1/HC2 + H1–H4 remain.  
**Authority:** Extends [LIVE_NORMALIZED_PROFILE_RUNTIME.md](../LIVE_NORMALIZED_PROFILE_RUNTIME.md), [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md), [03_VERSIONED_REMAINING_WORK_PLAN.md](03_VERSIONED_REMAINING_WORK_PLAN.md)  
**Companion Cursor plan:** `.cursor/plans/wf_create_hydration_collection_hold_20260903.plan.md`

### Relationship to the 20260827 live-profile programme

| Artifact | Role |
|----------|------|
| Tenant `.cursor/plans/workflow_live_profile_runtime_20260827.plan.md` | **Still active** — platform runtime cutover (Gates 0–5) |
| HQ `.cursor/plans/workflow_live_profile_runtime_20260827.plan.md` | **Still active** — Studio / Check policy / compiler retirement |
| **This document** | **Product capability programme** that assumes ADR-0010 live rows are already the authority |

Do **not** treat this plan as a rewrite or supersession of the 20260827 pair. Finish residual live-runtime todos (assurance, Gate 4 Studio completeness, Gate 5 compiler retirement, final docs) on those plans. Implement create presets / collection / hold WPs here without reopening “artifact vs live rows.”

---

## 0. Expert decisions (locked)

| Decision | Choice | Why |
|----------|--------|-----|
| Full redesign? | **No** | Live profile runtime + sources/types/init rules already exist |
| Grow `order-service.ts`? | **No** | Extract create-workflow + hydrator into dedicated modules |
| HQ varies create columns? | **Yes** — `create_preset_code` on each Initial rule | Typed presets beat free-form column maps and beat hardcoded `if` trees |
| Observer-execute exceptions | **`sys_wf_observer_exec_x_cd`** (0479) | Platform catalog, migration-seeded only — not Studio CRUD |
| New channel codes? | **No** | Use `sys_order_sources_cd` as-is |
| Fulfilment vocabulary | Keep `PICKUP` = branch collect; add `HOME_COLLECTION` + `COLLECTION_AND_DELIVERY` | Market-clear; no historical rename |
| Remote intake | Source flag `requires_remote_intake_confirm` remains fact; rules match **source**; preset owns columns | Avoid duplicating the boolean on every rule |
| Hold / resume | Keep `hold_from_status`; harden allowlist + fail-closed edges | Already production pattern (0436 + engine) |
| Home collection workflow | Ship **now**: status + module + commands + profile bindings | Product asked to pull “later” into Now |
| Agent applies migrations? | **Never** | Create SQL only; operator reviews/applies locally + remote; agent **waits for confirmation** before dependent work |

### Agent governance (every WP)

After **each** sub-step (SQL, code, UI):

1. **STATUS** — Update this plan, [`.cursor/plans/wf_create_hydration_collection_hold_20260903.plan.md`](../../../../.cursor/plans/wf_create_hydration_collection_hold_20260903.plan.md), `progress_summary.md`, `current_status.md`, `03_VERSIONED_REMAINING_WORK_PLAN.md`, `CHANGELOG.md`.
2. **DOC** — Update `testing_guide_and_scenarios.md`, `06_API_Contracts.md`, glossary/README when behaviour changes.
3. **MIG** — If new SQL: list seq + apply order; **stop**; do not run CLI/MCP apply.

Before programme sign-off: **DOC-FINAL** — load `/documentation` skill; refresh full pack under `docs/features/Workflow_Order_Advance/` (see Cursor plan § DOC-FINAL).

**Skills before write:** `/database`, `/frontend`, `/backend`, `/i18n`, `/implementation` per CLAUDE.md. **UI:** Cmx only; reuse existing stage/worklist patterns; extract reusable component when shared across ≥2 surfaces.

---

## 1. Problem statement

Today create mixes three concerns inside `OrderService.computeCreateOrderWorkflowState`:

1. Profile Initial-rule match (correct direction).
2. Hardcoded retail / remote-intake overrides (bypasses HQ).
3. Ad-hoc physical intake stamps (not profile-configurable).

Meanwhile:

- Initial rules already support `order_source_code`, `order_type_id`, `is_retail`, `is_quick_drop`.
- POS can still land in `draft` when a wildcard online rule wins.
- `PICKUP` means counter collect, but product also needs **home collection** of dirty items.
- Hold/resume already stores `hold_from_status`, but profile edges are processing-centric and need hardening for multi-status hold.

---

## 2. Target architecture

```text
Create request (POS / submit-order / API)
  │
  ├─ OrderService.createOrder*          ← persist + money + pieces ONLY
  │     calls ↓
  ├─ resolveOrderCreateWorkflowState()  ← NEW orchestrator (workflow/)
  │     ├─ WorkflowPolicyResolver       ← assignment + initial rules (+ presets)
  │     ├─ resolveInitialStatus()       ← matchers already exist
  │     └─ hydrateOrderCreateColumns()  ← NEW pure hydrator from create_preset
  │
  └─ INSERT org_orders_mst
        status / current_* / physical_intake_* / preparation_* / hold_from_status null
```

### 2.1 Do **not** put in `order-service.ts`

| Concern | New home |
|---------|----------|
| Initial status matching | Keep `initial-status-resolver.service.ts` |
| Create-time column bag | `order-create-hydrator.ts` (pure) |
| Orchestration (facts → status → hydrate) | `order-create-workflow.service.ts` |
| Preset codes / TS mirror | `lib/constants/workflow-create-presets.ts` |
| Create facts normalization | `order-create-facts.ts` |

`OrderService` only: call orchestrator → merge returned fields into insert payload → continue money/pieces/audit.

### 2.2 Three dimensions (unchanged, enforced)

| Dimension | Catalog | Not the same as |
|-----------|---------|-----------------|
| Entry channel | `sys_order_sources_cd` | Workflow command channel (`staff_web`/`pos`/`mobile`) |
| Fulfilment pattern | `sys_order_type_cd` | Source |
| Runtime actor | Execution `command_channel` | Source |

---

## 3. Schema design

### 3.1 Create presets (HQ-configurable hydration)

**New catalog:** `sys_wf_create_presets_cd`

| Column | Type | Purpose |
|--------|------|---------|
| `create_preset_code` | TEXT PK | Stable code |
| `name` / `name2` | TEXT | EN/AR Studio labels |
| `physical_intake_status` | TEXT NOT NULL | `pending_dropoff` \| `received` \| `not_applicable` |
| `stamp_physical_intake` | BOOLEAN NOT NULL | Set `physical_intake_at/by/info` from create actor when true |
| `stamp_received` | BOOLEAN NOT NULL | Set `received_at` (+ use `received_info` if provided) |
| `preparation_status` | TEXT NOT NULL | `pending` \| `in_progress` \| `completed` |
| `stamp_prepared` | BOOLEAN NOT NULL | Set `prepared_at/by` when true |
| `is_active`, audit, `rec_*` | standard | |

**Seed presets (minimum production set):**

| Code | Intake | Stamp intake | Prep | Stamp prep | Typical use |
|------|--------|--------------|------|------------|-------------|
| `REMOTE_DRAFT` | `pending_dropoff` | false | `pending` | false | Mobile / bot / API when remote confirm required |
| `POS_IN_HAND` | `received` | true | `pending` | false | POS/staff goods on counter → processing |
| `POS_QUICK_DROP` | `received` | true | `pending` | false | POS QD → intake |
| `RETAIL_SOLD` | `received` | true | `completed` | true | Retail → delivered |
| `STAFF_IN_HAND` | `received` | true | `pending` | false | web_admin / staff_mobile / kiosk |
| `HOME_COLLECTION_PENDING` | `pending_dropoff` | false | `pending` | false | Dirty items still at customer |
| `BRANCH_DEFAULT` | `received` | true | `pending` | false | Catch-all in-plant start |

Hydrator is **pure**: `(preset, actor, now, optionalNotes) → column bag`. No DB I/O. No money fields.

### 3.2 Wire preset onto Initial rules

```sql
ALTER TABLE sys_wf_prof_ver_init_cf
  ADD COLUMN create_preset_code TEXT
    REFERENCES sys_wf_create_presets_cd(create_preset_code);
```

- **Required** for Check policy / Pilot / Publish (fail closed if null on active rule).
- Deep clone / save-policy / live resolver must copy and return the column.
- Tenant resolver fails create with `PROFILE_INITIAL_RULES_INVALID` if matched rule has null/unknown preset.

### 3.3 Order types (Now)

Add to `sys_order_type_cd` (+ TS `ORDER_TYPE_IDS` mirror):

| `order_type_id` | EN | AR sense | Meaning |
|-----------------|----|----------|---------|
| `HOME_COLLECTION` | Home collection | استلام من المنزل | Driver collects dirty → plant; customer may later branch-pickup |
| `COLLECTION_AND_DELIVERY` | Collection & delivery | جمع وتوصيل | Dirty collect + clean delivery |

**Keep** `PICKUP` = customer collects finished goods at branch.  
**Do not** add `PICKUP AND DELIVERY`.  
**Do not** rename existing types.

UI labels (tenant + HQ):

| Code | Staff EN | Customer EN | AR |
|------|----------|-------------|-----|
| `PICKUP` | Collect at branch | Collect at branch | استلام من الفرع |
| `HOME_COLLECTION` | Home collection | We’ll collect from you | استلام من المنزل |
| `COLLECTION_AND_DELIVERY` | Collection & delivery | Collect & deliver | جمع وتوصيل |
| `DELIVERY` | Delivery | Delivery | توصيل |

### 3.4 Home-collection workflow catalog (Now)

**T2 seeds all platform catalogs the runtime needs** (migration **0483**), then binds them on live profile versions (**0484**). Do not hand-edit generated pins.

| Layer | Tables | 0483 / 0484 |
|-------|--------|-------------|
| Fulfilment types | `sys_order_type_cd` | 0483 |
| Statuses | `sys_wf_statuses_cd` | 0483 |
| Screen | `sys_wf_screens_cd`, `sys_wf_screen_status_cd` | 0483 |
| Graph | `sys_wf_transitions_cd`, `sys_wf_actions_cd`, `sys_wf_action_trans_cd` | 0483 |
| Initial-rule catalog | `sys_wf_initial_rules_cd` | 0483 |
| Create preset | `sys_wf_create_presets_cd` | already **0480** (`HOME_COLLECTION_PENDING`) |
| Evidence channel CHECK | `sys_wf_prof_ver_evidence_cf` constraint | 0483 widen |
| Profile policy | `sys_wf_prof_ver_module_cf`, `mod_st_cf`, `exec_cf`, `exec_ch_cf`, `init_cf`, `evidence_cf` | 0484 |

**Statuses** (`sys_wf_statuses_cd`):

| Code | Role |
|------|------|
| `awaiting_collection` | Booked; waiting for inbound driver job |
| `out_for_collection` | Driver en route / assigned to collect dirty items |

**Screen / module** (`sys_wf_screens_cd`):

| `screen_key` | Role |
|--------------|------|
| `home_collection` | Owns inbound collection statuses; Workboard / driver surfaces |

**Actions** (`sys_wf_actions_cd`):

| Code | From → To (typical) |
|------|---------------------|
| `ASSIGN_HOME_COLLECTION` | `awaiting_collection` → `out_for_collection` |
| `CONFIRM_HOME_COLLECTION` | `out_for_collection` → plant start (`intake` or `preparing` / `processing` per profile edge) |
| `FAIL_HOME_COLLECTION` | `out_for_collection` → `awaiting_collection` (retry; audit note required) |

Reuse delivery-stop / route patterns where safe (assign, POD optional later). V1 home collection may start **order-level** (no stop table) if stop reuse is risky; prefer stop reuse only when evidence shows parity. **Decision for first ship:** order-level commands + audit; stop/route integration as immediate follow-on in same programme if delivery stop model fits with `fulfilment_channel` extended to `home_collection`.

**Evidence channel:** extend `sys_wf_prof_ver_evidence_cf` check to allow `home_collection` (photo optional). OTP remains fail-closed until OTP programme.

### 3.5 Hold / resume (harden, do not redesign)

Already present:

- Column `org_orders_mst.hold_from_status`
- `HOLD_ORDER_WORK` → `on_hold` + store previous status
- `RESUME_ORDER_WORK` → restore `hold_from_status`
- `STOP_ORDER_WORK` → `stopped` + clear

**Now additions:**

1. Profile switch or module policy: **holdable status allowlist** (default: all non-terminal plant statuses except `draft` if product wants). Prefer `sys_wf_prof_ver_switches_cf` key `hold_allowed_statuses` JSON array **or** explicit HOLD edges from each allowed `from_status` (edges are clearer for Check policy).
2. Engine: reject HOLD if already `on_hold`, or from terminal (`delivered`, `cancelled`, `stopped`, `closed`).
3. Engine: resume **always** uses `hold_from_status` (already); fail if missing.
4. Seed SIMPLE / ROUTED_POD: HOLD edges from every plant status that should support hold (not only `processing`).
5. Nested hold: **reject** (do not overwrite).

No second column name (`pre_hold_status`); keep `hold_from_status`.

---

## 4. Initial-rule scenario matrix (seed + Studio)

Lower `priority` wins. Null matcher = wildcard. Every active rule **must** have `create_preset_code`.

### 4.1 Core POS / mobile (Demo + production defaults)

| Priority | Source | Type | Retail | QD | Initial status | Preset |
|----------|--------|------|--------|----|----------------|--------|
| 10 | `pos` | * | true | * | `delivered` | `RETAIL_SOLD` |
| 20 | `pos` | * | false | true | `intake` | `POS_QUICK_DROP` |
| 30 | `pos` | * | false | false | `processing` | `POS_IN_HAND` |
| 40 | `customer_mobile_app` | `HOME_COLLECTION` | false | * | `awaiting_collection` | `HOME_COLLECTION_PENDING` |
| 45 | `customer_mobile_app` | `COLLECTION_AND_DELIVERY` | false | * | `awaiting_collection` | `HOME_COLLECTION_PENDING` |
| 50 | `customer_mobile_app` | * | false | * | `draft` | `REMOTE_DRAFT` |
| 55 | `whatsapp_bot` / `api_partner` / `b2b_portal` | * | false | * | `draft` | `REMOTE_DRAFT` |
| 60 | `web_admin` / `staff_mobile_app` / `kiosk` | * | true | * | `delivered` | `RETAIL_SOLD` |
| 70 | `web_admin` / `staff_mobile_app` / `kiosk` | * | false | true | `intake` | `STAFF_IN_HAND` |
| 80 | `web_admin` / `staff_mobile_app` / `kiosk` | * | false | false | `processing` | `STAFF_IN_HAND` |
| 100 | * | * | * | * | profile default (`intake` or `processing`) | `BRANCH_DEFAULT` |

**Forbidden:** any rule with all matchers NULL that sets `draft` (the current `INIT_ONLINE_DRAFT` wildcard bug).

**Quick drop + remote:** if source requires remote confirm, QD does **not** skip draft — remote goods are not at branch. Rule specificity: remote sources match before QD plant shortcuts.

**Retail + mobile:** default **forbid** auto-`delivered` (payment/custody). Prefer Check policy warn or no retail rule for remote sources; or start `draft` with `REMOTE_DRAFT`.

**After `CONFIRM_PHYSICAL_INTAKE`:** transition sets plant status; hydrator is create-only. Intake confirm may stamp `physical_intake_*` via existing intake command (do not duplicate).

**`EXPRESS`:** never drives initial status (SLA/pricing only).

### 4.2 Edges after create (not Initial rules)

| Start | First command | Next |
|-------|---------------|------|
| `intake` (QD) | Confirm intake / start prep | `preparing` |
| `draft` | `CONFIRM_PHYSICAL_INTAKE` | `preparing` or `processing` per edge |
| `awaiting_collection` | `ASSIGN_HOME_COLLECTION` | `out_for_collection` |
| `out_for_collection` | `CONFIRM_HOME_COLLECTION` | plant status per edge + stamp intake received |

---

## 5. Check policy / issue codes (HQ catalog)

Add via HQ `/manage-wf-policy-issues-catalog` (do **not** hand-edit tenant generated pin):

| Code | Gate | Intent |
|------|------|--------|
| `initial_rule_preset_missing` | block Pilot/Publish | Active init rule without `create_preset_code` |
| `initial_rule_preset_unknown` | block | Preset not in catalog / inactive |
| `initial_rule_preset_status_mismatch` | block | e.g. `REMOTE_DRAFT` with initial `processing` |
| `initial_rule_wildcard_draft` | block | All-null matchers + `draft` |
| `initial_rule_coverage_gap` | warn→block | Known create archetypes (POS retail/QD/normal, mobile default) unmatched |
| `home_collection_type_without_module` | block | Type used in init rule but `home_collection` module Off / missing |
| `home_collection_missing_confirm_edge` | block | No `CONFIRM_HOME_COLLECTION` from `out_for_collection` |
| `evidence_without_home_collection` | block | Home-collection evidence row while `home_collection` module is Off |
| `hold_edge_incomplete` | warn | `on_hold` exists but HOLD not bound from claimed plant statuses |

Tenant `sys_wf_prof_ver_live_rpt` gets **structural** subset only (preset missing/unknown, wildcard draft) via new migration after 0478 — mirror existing 0477/0478 pattern. Narrative stays in HQ catalog.

Compatible preset↔status matrix (validator):

| Preset | Allowed initial statuses |
|--------|--------------------------|
| `REMOTE_DRAFT` | `draft` |
| `POS_IN_HAND` / `STAFF_IN_HAND` / `BRANCH_DEFAULT` | `intake`, `preparing`, `processing` |
| `POS_QUICK_DROP` | `intake` |
| `RETAIL_SOLD` | `delivered`, `ready` (prefer `delivered`; never `closed`) |
| `HOME_COLLECTION_PENDING` | `awaiting_collection` |

---

## 6. Tenant implementation work packages

### WP-T0 — Hygiene (unblock Demo)

1. Operator applies **0478** (owner/observer + Cancel/Hold exceptions).
2. New migration **0479+** (after listing max seq): repair Demo / seed Initial rules — remove wildcard draft; seed POS/mobile/retail/QD matrix for SIMPLE + ROUTED_POD (presets may land in same or next migration).
3. Regression: create POS order → not `draft`.

### WP-T1 — Create preset schema + resolver + extract services

1. Migration: `sys_wf_create_presets_cd` + seed + `sys_wf_prof_ver_init_cf.create_preset_code`.
2. Update save-policy / deep-clone / live load SQL paths that touch init_cf.
3. `WorkflowPolicyResolver` + resolution types include `create_preset_code`.
4. New modules under `web-admin/lib/services/workflow/`:
   - `order-create-facts.ts`
   - `order-create-hydrator.ts`
   - `order-create-workflow.service.ts`
5. Thin `OrderService.computeCreateOrderWorkflowState` → delegate; **delete** retail/`closed`→`ready` and remote intake shortcuts from OrderService.
6. Fail closed: unmatched rule, missing preset, invalid preset/status combo.
7. Unit tests: hydrator matrix; resolver match + preset; create path unit/integration.

### WP-T2 — Order types + home collection catalog + profile seed

**T2a (SQL — created; operator apply pending):**

1. Migration **0483**: types, statuses, screen, transitions, actions, `action_trans`, `initial_rules_cd`; evidence channel CHECK. **Created.**
2. Migration **0484**: profile module + mod_st + executables + mobile init rules (40/45) on all live versions. **Created.**
3. TS mirrors + unit tests (create resolver). **Done.**
4. **STATUS + DOC + MIG handoff.** **Done.**
5. **Operator:** apply `0483` → `0484`, regen types. **Agent waits.**

**T2b (runtime — blocked until step 5 confirmed):**

4. Stage command adapters for ASSIGN / CONFIRM / FAIL (reuse existing stage-owned pattern).
5. Reusable home-collection floor UI (extend worklist/ActionBar; new shared component only if ≥2 surfaces).
6. Workboard / list visibility + deep links.
7. i18n EN/AR; `cmxMessage` on command results.
8. Access contracts if new routes.
9. **STATUS + DOC** after T2b complete.

### WP-T3 — Hold hardening

1. Seed HOLD/RESUME edges from allowlisted statuses on SIMPLE + ROUTED_POD.
2. Engine guards: no nested hold; no hold from terminal; resume requires `hold_from_status`.
3. Tests: hold from `preparing` and `ready`; resume restores exact status.
4. **STATUS + DOC + MIG handoff** (if new migration).

### WP-T4 — Tenant UX polish

1. New Order / type picker: clear labels for PICKUP vs HOME_COLLECTION vs COLLECTION_AND_DELIVERY.
2. Remote draft banner: pending physical intake.
3. Home collection floor card: assign / confirm / fail with notes.
4. Access contracts + permissions if new screens/APIs (golden path).
5. `npm run build`, i18n check, eslint, targeted db-integration tests.
6. **STATUS + DOC**.

### DOC-FINAL — documentation pack (programme end)

Load **`/documentation`** (`.claude/skills/documentation/SKILL.md`). Refresh or fill gaps in `docs/features/Workflow_Order_Advance/`: README, developer_guide (+ mermaid), testing_guide, user_guide (+ mermaid), deploy_guide, technical_docs, version.txt, CHANGELOG. Reflect operator-applied migration state and final API contracts only — no invented routes.

---

## 7. HQ implementation work packages (`cleanmatexsaas`)

### WP-H1 — Studio Initial rules UI

1. Source / type / retail / QD matchers as searchable selects from catalogs (not free text). **Done** (HQ Studio).
2. **Create preset** required select with EN/AR description + preview of columns stamped. **Done**.
3. Priority editor with conflict warning (same matchers). **Done** (same-priority overlap).
4. Ban UI path that saves all-null + draft. **Done** (Studio + `assertWritableInitialRules`).

### WP-H2 — Check policy + catalog

1. Issue codes in §5 via `/manage-wf-policy-issues-catalog`. **Done** (catalog **1.3.0**; pin regenerated, including `evidence_without_home_collection`).
2. Validator matrix preset↔status. **Done** (`initial_rule_preset_status_mismatch`).
3. Coverage archetypes for POS and mobile. **Done** (`initial_rule_coverage_gap` warn).
4. Pin regenerate → tenant sync process (existing catalog pin workflow). **Done**. Tenant **0487 applied** — `live_rpt` emits the three reporter codes.

### WP-H3 — Home collection authoring

1. Module toggle `home_collection`. **Done** (existing Studio modules + validator `home_collection_type_without_module`).
2. Execution bindings for new actions/channels. **Done** (`home_collection_missing_confirm_edge`).
3. Evidence channel `home_collection` optional photo. **Done**.
4. Simulate create: show resolved status + hydrated columns for a fact bag. **Done** (`POST .../simulate-create` + Studio matchers tab).

---

## 8. `order-service.ts` size — expert answer

**Yes, there is a better way — and it is mandatory for this programme.**

| Pattern | Apply |
|---------|--------|
| Facade | `OrderService` keeps create/update/list orchestration |
| Domain services | Workflow create resolution lives under `lib/services/workflow/` |
| Pure functions | Hydrator + initial matcher + order-control transition (already pure) |
| Constants mirror DB | `workflow-create-presets.ts`, order types |
| No god-object growth | New create columns never added as private methods on OrderService |

Target: `computeCreateOrderWorkflowState` becomes ~10 lines calling `resolveOrderCreateWorkflowState`.

---

## 9. Testing matrix (must pass before merge)

| ID | Scenario | Expect |
|----|----------|--------|
| C1 | POS, not QD, not retail | `processing` + `POS_IN_HAND` stamps |
| C2 | POS, QD, not retail | `intake` + received intake |
| C3 | POS, retail | `delivered` + prep completed stamps |
| C4 | Mobile, remote flag true | `draft` + `pending_dropoff`, no intake stamp |
| C5 | Mobile + HOME_COLLECTION | `awaiting_collection` + pending preset |
| C6 | Mobile + COLLECTION_AND_DELIVERY | same inbound start |
| C7 | Unmatched facts | 422 `PROFILE_INITIAL_RULE_UNMATCHED` |
| C8 | Rule without preset | fail closed (seed/CI + runtime) |
| C9 | Wildcard draft rule | Check policy / live_rpt blocks |
| H1 | Hold from processing | `on_hold`, `hold_from_status=processing` |
| H2 | Resume | back to processing, column cleared |
| H3 | Hold from preparing | resume → preparing |
| H4 | Nested hold / terminal hold | reject |
| HC1 | ASSIGN then CONFIRM home collection | plant status + intake received |
| HC2 | FAIL home collection | back to awaiting + audit note |

---

## Migration sequencing (cleanmatex only)

Do **not** edit applied `0470`–`0478`. After operator applies 0478, create **new** files:

| Seq | File | Purpose |
|-----|------|---------|
| **0479** | `sys_wf_observer_exec_x_cd` | Platform observer-execute catalog + live_rpt JOIN (**created**) |
| **0480** | `sys_wf_create_presets_cd` | Create presets + `init_cf.create_preset_code` (**created**) |
| **0481** | `wf_init_rules_create_matrix` | POS/mobile/staff Initial-rule matrix + presets (**created**) |
| **0482** | `wf_init_create_preset_clone_save` | Clone + save_policy wire preset (**applied**) |
| **0483** | `wf_home_collection_catalog` | Global home-collection catalogs + evidence channel (**created — operator apply**) |
| **0484** | `wf_home_collection_profile_seed` | Live profile module/exec/init rules (**applied**) |
| **0485** | `nav_home_collection` | Sidebar dual-write for `/dashboard/home-collection` (**applied**) |
| **0486** | `wf_hold_edges_expand` | HOLD edges from allowlisted plant statuses + observer exceptions (**applied**) |
| **0487** | `wf_live_rpt_create_presets` | live_rpt reporter rows: missing/unknown create preset + wildcard-draft (**applied**) |

Exact seq numbers were taken after applied **0478**. Agents never apply.

---

## 11. Documentation / progress updates (same programme)

- This file = canonical plan.  
- Update [README.md](README.md) index.  
- Update [03_VERSIONED_REMAINING_WORK_PLAN.md](03_VERSIONED_REMAINING_WORK_PLAN.md) with WP IDs as Must for current train.  
- CHANGELOG + `current_status.md` + `progress_summary.md` + `testing_guide_and_scenarios.md` as WPs land.  
- `06_API_Contracts.md` — create returns hydrated fields implicitly; home collection command APIs.  
- Glossary: create preset, HOME_COLLECTION vs PICKUP.

---

## 12. Out of scope (explicit)

- Tenant Workflow Studio  
- Renaming historical `PICKUP` rows  
- OTP-required home collection  
- Partial fulfilment / returns  
- Automatic reassignment of open orders to new profiles  
- Applying migrations by agent  

---

## 13. Delivery order (recommended)

```text
T0 hygiene → T1 presets+extract → H1/H2 Studio+catalog
  → T3 hold → T2 home collection catalog+runtime → H3
  → T4 UX + access + docs + full test matrix
```

Home collection UI can ship behind module Off until HQ publishes bindings; schema and tenant adapters still land Now so Pilot tenants can enable without a second redesign.

---

## 14. Success criteria

1. No create-time workflow `if` trees in `order-service.ts`.  
2. HQ can change create stamps per profile via Initial rule + preset without a tenant deploy.  
3. POS / mobile / retail / QD / home-collection scenarios match §4 with tests.  
4. Hold resumes to exact prior status from any allowlisted plant status.  
5. EN/AR labels never show bare ambiguous “Pickup” for home collection.  
6. Check policy blocks wildcard draft and missing presets before Pilot.
