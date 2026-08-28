# 01 — HQ Studio validation gaps (all profile-setup situations)

**Date:** 2026-08-27  
**For:** cleanmatexsaas Workflow Studio — Validation, Check policy, Compile, Pilot, Publish, Assign  
**Companion:** [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md), [02_HQ_STUDIO_ISSUE_CODE_SPEC.md](02_HQ_STUDIO_ISSUE_CODE_SPEC.md)  
**Plan:** [03_VERSIONED_REMAINING_WORK_PLAN.md](03_VERSIONED_REMAINING_WORK_PLAN.md)

## 1. How to use this document

Every row is a **situation an operator can create in Studio**. For each:

- **Block** = fail Check policy / Compile / Pilot / Publish (or Assign, if labelled).
- **Warn** = allow publish; show bilingual explanation and a fix hint.
- **Assign-time** = compile may pass; Assign must still fail or warn.

Soft Studio graph dashed arrows and readiness badges are **not** sufficient. Pilot and Publish must stay disabled until Check policy is clean.

**Glossary:** full definitions and examples — [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md). Short form (do not collapse these):

| Term | Meaning |
|------|---------|
| Tenant **page** | A Next.js URL (`/dashboard/ready`, `/dashboard/delivery`, `/track/{token}`). Static today; not created/destroyed by module On/Off. |
| Studio **module** (`screen_key`) | Who owns the executable (`ready_release`, `pickup_handover`, `driver_delivery`, `public_tracking`). |
| **ActionBar** | Generic `WorkflowActionBar` on plant/Ready/Delivery pages. Ready **hides** `RELEASE_FOR_PICKUP` because the fulfilment panel owns it. |
| **Stage card** | Pickup and delivery confirm use dedicated cards/services, not the generic ActionBar command. |

Sources:

- Live HQ compiler: `WfSemanticProfileCompilerService` (hard errors only; no warning severity today).
- DB helper: `sys_wf_prof_ver_validate_live` (policy row, initial rules, one primary owner, exec channel, from-status owner visibility).
- Tenant runtime: profile resolution, artifact/exec/channel/gates, Ready pickup panel, delivery complete, public tracking.
- Coverage matrix §9 and ADR-SAAS-MNG-0009 / 0010.

## 2. Already hard-validated (keep; wire to fields)

Do not re-invent these. Map them to the offending Studio field instead of a compile dump only.

| Today’s code | Situation |
|--------------|-----------|
| `profile_policy_missing` | No active policy row |
| `profile_no_enabled_modules` | No enabled module |
| `unsupported_capability_enabled` | Partial pickup/delivery, returns, required OTP, conditional routing |
| `stage_sequence_blank_status` / `stage_sequence_duplicate_status` | Blank or duplicate stage codes |
| `module_status_without_enabled_module` | Status membership on a disabled module |
| `status_owner_not_primary_module` | `visibility_mode=owner` on a non-`primary_owner` module |
| `status_multiple_primary_owners` | Two modules own the same status |
| `execution_binding_duplicate` | Duplicate `screen:from:action:to` |
| `execution_without_enabled_module` | Exec on disabled module |
| `execution_on_observer_module` | Observer cannot execute |
| `execution_not_from_status_owner` | **Extend, do not keep as-is.** Today it flags legal `CONFIRM_PICKUP` from `ready` on `pickup_handover` because `ready` is owned by `ready_release`. HQ even uses that string as the example. The wrong “fix” is moving the action onto Ready. See §3.C. |
| `execution_status_not_in_stage_sequence` | from/to not in `stage_sequence` |
| `execution_status_without_owner` | from/to lack a primary owner |
| `execution_without_channel` | Exec has no active channel |
| `public_channel_execution_forbidden` | `public_web` except permitted public confirm |
| `public_channel_non_hard_gate_forbidden` | Public + warning/override |
| Gate catalog family | Inactive gate, schema version mismatch, warning/override capability, override permission/reason length, missing message key |
| `initial_rule_missing` | No active initial rule |
| `initial_rule_status_not_in_stage_sequence` | Initial status not in sequence |
| `initial_rule_status_without_owner` | Initial status has no owner |
| `initial_rule_ambiguous` | Same priority + overlapping matchers |
| `graph_missing_fulfilment_end` | No fulfilment / plant-end in sequence |
| `initial_status_unreachable_fulfilment` | BFS from that initial never reaches fulfilment |
| `pickup_module_missing` | `pickup_enabled` without `pickup_handover` |
| `delivery_release_module_missing` / `delivery_module_missing` | Delivery flags without Ready / `driver_delivery` |
| `public_tracking_module_missing` | Public-tracking flag without module |
| `rack_release_module_missing` | Rack-before-release without Ready |
| `pickup_policy_without_pickup` / `delivery_policy_without_delivery` | Policy flags without owning mode |
| Evidence family | Duplicate method, OTP required/standalone, evidence without pickup/delivery, invalid counts, CONFIRM_DELIVERY evidence mismatch |

**Known hole in uniqueness:** uniqueness is `screen:from:action:to`. Channels are nested. A floor owner can publish with only `mobile` / `api` and **no** `staff_web`. Tenant ActionBar is then empty.

**Known hole in `validate_live`:** it does not check fulfilment coupling, `staff_web`, known gate evaluators, evidence consistency, skip-edge determinism, or create-path exhaustiveness.

## 3. Must add — publishes today, breaks tenant tomorrow

### A. Module coupling (floor UX)

Tenant pages for Off modules **already exist**. Off means “this profile must not own that stage”, not “build a new page”.

| Situation | Why tenant breaks | Suggested code |
|-----------|-------------------|----------------|
| `pickup_handover` On, `ready_release` Off | Module On does not create a pickup URL. The pickup **card** mounts only on Ready Details. | `pickup_without_ready_release` |
| `ready_release` On, `pickup_handover` Off, while pickup flags/notes/evidence On | Ready can `RELEASE_FOR_PICKUP`; the pickup card queries `pickup_handover` and shows `notConfigured`. | `pickup_handover_missing_for_counter` |
| `driver_delivery` On, `ready_release` Off | Delivery Details exists, but no `RELEASE_FOR_DELIVERY` owner. Worklist stays empty; confirm never becomes legal. | `delivery_without_ready_release` |
| `public_tracking` On for **released counter pickup**, without Ready + `RELEASE_FOR_PICKUP` | `/track` still loads. From `ready` tenant returns `PICKUP_RELEASE_REQUIRED`. From `ready_for_pickup` it runs pickup complete (not a public `CONFIRM_PICKUP` binding). | `public_tracking_requires_pickup_release` |
| `workboard` as `primary_owner` | Runtime strips commands; Workboard is observer-only. | `workboard_must_be_observer` |
| Enabled module with zero status memberships | Floor URL still exists (nav is not profile-filtered today); worklist always empty. | `module_without_status_membership` |
| Enabled `primary_owner` with no executable | Plant/Ready: ActionBar empty. Pickup/delivery: dedicated card `notConfigured`. | `owner_module_without_execution` |
| Prep / assembly / QA / packing Off but still in sequence with **no** skip edge from previous owner | Order lands on unowned/unexecutable status. | `disabled_stage_without_skip_edge` |
| `processing` missing from sequence | Coverage matrix: core plant stage. Warn only for documented retail-only profiles. | `core_processing_missing` |

### B. Action, channel, permission

| Situation | Why tenant breaks | Suggested code |
|-----------|-------------------|----------------|
| Floor owner exec without `staff_web` | Plant/Ready ActionBar empty, **or** pickup/delivery card `notConfigured`. Same channel rule; different UI. | `staff_web_channel_missing` |
| Public confirm without `public_web` | `/track` page still loads; confirm fails closed. | `public_web_channel_missing` |
| Duplicate binding including channel | Same action twice on `staff_web`. | Tighten uniqueness to `screen:from:action:to:channel` |
| Exec `permission_code` missing / unknown / inactive | Button never appears or 403. | `execution_permission_invalid` |
| Bind `MARK_READY` | Retired. Plant uses stage complete. Ready module uses release. Pickup module uses `CONFIRM_PICKUP`. | `legacy_mark_ready_forbidden` |
| Bind return exec while returns unsupported | Runtime fail-closed. | `return_action_not_supported` |
| `cross_cutting_command` on a normal stage | Wrong ownership. Allow only `canceling`, `order_control`, `public_tracking`. | `invalid_cross_cutting_module` |
| Terminal status with a forward plant action | Illegal lifecycle. | `terminal_status_forward_action` |

### C. Ready ≠ pickup ≠ delivery

**Read this first.** Tenant **Ready Details** (`/dashboard/ready/[id]`) is one **page** that hosts **two Studio modules**. Binding an action to the wrong module is not the same as putting a button on the Ready URL.

| What the operator sees | Studio module (`screen_key`) | Action that module owns |
|------------------------|------------------------------|-------------------------|
| Ready list + Ready Details | `ready_release` | `RELEASE_FOR_PICKUP`, `RELEASE_FOR_DELIVERY` (make available / send to driver) |
| Pickup card **on that same Ready Details page** | `pickup_handover` | `CONFIRM_PICKUP` (physical handover, settlement, release-record close) |

The tenant pickup card always lists and executes `CONFIRM_PICKUP` with `screen = pickup_handover`. The pickup server always calls `executeAction({ screen: 'pickup_handover', actionCode: 'CONFIRM_PICKUP' })`. Binding that action onto `ready_release` in Studio does **not** make the card work; it hides the card (`notConfigured`) and can surface a generic Ready ActionBar button that **skips** pickup completion.

**Existing compiler conflict:** `execution_not_from_status_owner` fires when `pickup_handover` (primary owner of `ready_for_pickup`) executes `CONFIRM_PICKUP` from `ready` (owned by `ready_release`). That **is** the legal direct-counter path if pickup **observes** `ready`. HQ presets currently bind that direct action onto `ready_release` to dodge the compiler — that matches the tenant runtime **incorrectly**. Exception: a fulfilment command module may execute from an observed `from_status`; do not “fix” by changing `screen_key` to the status owner.

Same split for delivery:

| What the operator sees | Studio module | Action that module owns |
|------------------------|---------------|-------------------------|
| Delivery list + Delivery Details | `driver_delivery` | Staff `CONFIRM_DELIVERY` (complete service / POD) |
| Customer `/track/{token}` | `public_tracking` | Public `CONFIRM_DELIVERY` from `out_for_delivery` with `public_web` only |

Public **released pickup** (`ready_for_pickup`) does **not** bind `CONFIRM_PICKUP` onto `public_tracking`. The `/track` adapter calls the pickup complete service, which still executes `pickup_handover` / `CONFIRM_PICKUP`. From `ready`, public confirm is rejected (`PICKUP_RELEASE_REQUIRED`).

| Situation | Why tenant breaks | Suggested code |
|-----------|-------------------|----------------|
| `CONFIRM_PICKUP` executable bound on `ready_release` (or any screen other than `pickup_handover`) | Pickup card queries `pickup_handover` and finds nothing. Real confirm API still requires `pickup_handover`. Ready ActionBar must not own handover. | `pickup_action_on_wrong_module` |
| Staff `CONFIRM_DELIVERY` bound on Ready or pickup | Staff complete always uses `screen = driver_delivery`. Ready/pickup pages must not own that executable. | `delivery_action_on_wrong_module` |
| Public `CONFIRM_DELIVERY` bound on `driver_delivery` (or without `public_web`) | `/track` lists `public_tracking` + `public_web`. Staff delivery complete must not be the public channel. | `delivery_action_on_wrong_module` |
| `RELEASE_FOR_PICKUP` / `RELEASE_FOR_DELIVERY` bound on pickup or delivery modules | Release is `ready_release` even though the pickup **card** sits on the Ready **page**. | `release_action_on_wrong_module` |
| `delivery_stop_active` on simple (no-stop) profiles | Floor confirm always `GATE_DELIVERY_STOP`. | `delivery_stop_gate_on_simple_profile` |
| Simple delivery without `driver_delivery` + `CONFIRM_DELIVERY` + `staff_web` | Delivery **card** `notConfigured` (not “missing Delivery page”). | `staff_delivery_execution_missing` |
| Routed delivery without POD evidence / `pod_evidence_valid` | Weak or empty proof. | `routed_delivery_evidence_incomplete` |
| Exec `requires_evidence=true` (generic flag) | Engine `EVIDENCE_RUNTIME_UNAVAILABLE`. Use compiled evidence rows + POD gate. | `generic_requires_evidence_forbidden` |
| OTP required or OTP-only | Runtime rejects OTP. Keep existing `evidence_otp_*`. Warn if OTP listed optional. | `evidence_otp_optional_dead` (Warn) |
| `pickup_handover` On without `CONFIRM_PICKUP` from `ready` and/or `ready_for_pickup` | Pickup card `notConfigured`. Direct from `ready` also needs observer membership (next row) plus the compiler exception above. | `pickup_execution_missing` |
| Direct pickup from `ready` not declared as pickup observing `ready` | Matrix: observe `ready` only for explicit direct counter. | `direct_pickup_from_ready_not_declared` |
| Public tracking + counter pickup without `RELEASE_FOR_PICKUP` | `/track` cannot confirm from `ready`; needs staged `ready_for_pickup`. This is **not** “put CONFIRM_PICKUP on public_tracking”. | `public_pickup_requires_release_path` |
| Bind `CONFIRM_PICKUP` on `public_tracking` from `ready` / `ready_for_pickup` | Public adapter must not become a second pickup owner. Released pickup still executes `pickup_handover`. | `public_cannot_own_pickup_action` |

### D. Initial rules (order create)

Same-priority overlap is already blocked. **Exhaustiveness is not.**

| Situation | Tenant | Suggested code |
|-----------|--------|----------------|
| Specific matchers, no catch-all | `PROFILE_INITIAL_RULE_UNMATCHED` (422) for POS / remote / retail / Quick Drop / source code | `initial_rule_uncovered_create_path` |
| Context has zero or two winners | Intermittent create failures | `initial_rule_no_winner` / `initial_rule_multiple_winners` **per context** |
| Initial status `closed` | Tenant refuses auto-close; retail must not auto-close | `initial_status_closed_forbidden` |
| Initial status in fulfilment (`out_for_delivery`, `delivered`) | Order born already delivered | `initial_status_fulfilment_forbidden` |

Required simulated contexts (at least):

- Walk-in POS (`order_source_code=pos`, not retail, not quick drop, received)
- Remote / pending dropoff
- Retail-only cart
- Quick Drop
- Each `order_source_code` the tenant assignment will actually use

### E. Skip graph and reachability

Current BFS is **initial → fulfilment**. Orphan enabled stages can still publish.

| Situation | Suggested code |
|-----------|----------------|
| Optional stage Off, previous owner has **two** skip targets | `optional_stage_skip_ambiguous` |
| Optional stage Off, previous owner has **zero** skip targets | `optional_stage_skip_missing` |
| Enabled stage never reachable from any initial | `enabled_stage_unreachable` |
| Cycle except documented QA fail→rework and hold→resume | `illegal_cycle` |
| `allow_back_steps=false` but a backward exec exists | `back_step_forbidden_by_policy` |

### F. Gates vs live evaluators

| Situation | Suggested code |
|-----------|----------------|
| Gate code with no tenant evaluator | `gate_evaluator_missing` |
| `qa_passed` / piece gates while QA / piece tracking Off | `gate_requires_disabled_module` |
| `prep_stage_complete` while preparation Off | `gate_requires_disabled_module` |
| `delivery_stop_active` without delivery module | `gate_requires_disabled_module` |
| Fulfilment without `fin_release_eligible` when PAY_ON_COLLECTION is in play | `fulfilment_missing_collection_gate` (Error or Warn by product) |
| `rack_required` on a non-release action | `rack_gate_wrong_action` |
| `parameters_json` fails catalog JSON Schema | `gate_parameters_invalid` |
| Override permission not on any role of the assigned tenant | `override_permission_not_in_tenant_roles` (Assign-time Warn) |

### G. Assignment (compile may pass)

| Situation | Runtime | When |
|-----------|---------|------|
| Two assignments same tenant + branch + service | `PROFILE_ASSIGNMENT_CONFLICT` | Assign Error |
| Two tenant-scope defaults | Same | Assign Error |
| Service-scoped row whose service never appears on orders | Dead rule | Assign Warn |
| Different profiles per service category | Mixed cart → `PROFILE_SERVICE_SCOPE_CONFLICT` | Assign Warn |
| PILOT on tenant with `is_hq_test_demo=false` | DB + runtime reject | Assign Error |
| Unpinned version, no PUBLISHED | Create fails | Assign Error |
| `current_artifact_id` null (until ADR-0010 cutover) | `The assigned workflow profile has no current compiled artifact` | Publish/Assign Error |
| Operator expects reassignment to move in-flight QA orders | Pins are immutable; only new orders change | Assign Warn with open-order count |

### H. Compiler / live-normalized drift

Until Check policy replaces Compile on **both** repos:

| Situation | Risk |
|-----------|------|
| Policy saved after last compile | Stale artifact vs live rows |
| `validate_live` green, compiler never run | Tenant create still needs `current_artifact_id` |
| HQ flags (`pickup_enabled`, …) On while tenant TS reads only modules/execs/gates | Flags look like runtime but are not |

Publish must require a successful compile commit **or** both sides must already be on live normalized rows with no artifact requirement.

## 4. Warn only (do not block publish)

| Warn | Meaning |
|------|---------|
| `order_control` Off | Hold / resume / stop unavailable; cancel may still work |
| `canceling` Off | No cancel — dangerous for POS mistakes |
| `public_tracking` Off | `/track` may still open for status; **confirm** is disabled |
| `returning` Off | Correct until V1.1 |
| OTP listed optional | Shown; never executable |
| `workboard` Off | No supervisor queue; floor pages still work |
| Service-scoped profiles | Mixed POS carts will require split |
| Unsaved Studio draft vs last compile | Keep existing Stay / Discard / Save prompt |

## 5. Must stay impossible until a later version

Keep hard-off (`unsupported_capability_enabled` and related):

- Partial pickup / partial delivery (V1.3)
- Returns / executable `returning` (V1.1)
- OTP required or OTP-only (V1.3)
- Generic conditional routing DSL (V2)
- B2B fulfilment bypass of credit/collection (never)

## 6. Shop archetypes (named Check policy scenarios)

Run these as named scenarios, like Simulate, not only structural rules.

### Lean plant (processing + counter pickup)

Must be true:

- `processing` + `ready_release` + `pickup_handover`
- `CONFIRM_PICKUP` + `staff_web`
- Skip edges from processing across Off prep/assembly/QA/packing
- Initial rules cover POS (and any other sources in use)
- `driver_delivery` may be Off
- `public_tracking` only if a release-before-public path exists

**Fails today:** pickup On + Ready Off (the Module coverage screenshot that motivated this pack).

### Simple delivery (no stop)

- Ready + `driver_delivery` + `CONFIRM_DELIVERY` + `staff_web`
- Do **not** bind `delivery_stop_active`
- Pickup optional

### Routed POD

- Ready + `driver_delivery` + `delivery_stop_active` + POD evidence methods
- Tenant S10 canary remains a tenant gate, not an HQ compile substitute

### Full floor

- Prep → processing → optional assembly/QA/packing → Ready → pickup and/or delivery
- Exactly one primary owner per non-terminal status
- Skip edges only for Off optional stages

### Counter-only, no delivery

- Ready + pickup
- `driver_delivery` Off
- Public confirm only with pickup-release path

### Retail-only

- Initial status is not `closed`
- A documented owner for retail work
- No auto-close

## 7. Suggested Studio UX

1. **Check policy** on live normalized rows (ADR-0010). Same issue codes as compile until artifacts are retired.
2. Each issue: `code`, field path (module / exec / rule id), EN + AR, **fix hint**.
3. **Archetype simulator:** Lean / Simple delivery / Routed POD / Full floor / Counter-only / Retail.
4. **Create-path matrix:** source × retail × quick drop × remote → winning initial rule or fail.
5. **Channel coverage table** per enabled owner: `staff_web` / `public_web` / `mobile` / `api`.
6. Pilot / Publish remain blocked until Check policy is clean. Graph recommendations stay advisory.

## 8. Tenant symptoms cheat sheet (for HQ support)

| Operator sees in tenant | Likely HQ gap |
|-------------------------|---------------|
| `The assigned workflow profile has no current compiled artifact` | Never compiled / commit did not set `current_artifact_id` |
| `PROFILE_ASSIGNMENT_REQUIRED` | No matching assign for tenant/branch/service |
| `PROFILE_ASSIGNMENT_CONFLICT` | Two equal-specificity assigns |
| `PROFILE_SERVICE_SCOPE_CONFLICT` | Mixed services, different profiles |
| `PROFILE_INITIAL_RULE_UNMATCHED` | Create-path not covered |
| Empty ActionBar on plant / Ready | Missing exec, missing `staff_web`, observer module, or Off owner — **not** the pickup card |
| Ready pickup card “not configured” | `CONFIRM_PICKUP` missing on `pickup_handover`, or bound on `ready_release` instead, or no `staff_web` |
| Compile error `execution_not_from_status_owner` on `CONFIRM_PICKUP:pickup_handover:ready:ready_release` | Direct pickup is legal; add observer `ready` on pickup. **Do not** move the action to Ready |
| Pickup On but nobody can confirm | Ready module Off (no page to host the card) |
| Delivery card “not configured” | Missing `driver_delivery` + `CONFIRM_DELIVERY` + `staff_web` |
| Delivery confirm always stop-gated | `delivery_stop_active` on a simple profile |
| `/track` confirm fails from `ready` | Public cannot direct-handover; needs `RELEASE_FOR_PICKUP` first (`PICKUP_RELEASE_REQUIRED`) |
| `/track` confirm fails in OFD | Missing `public_tracking` + `CONFIRM_DELIVERY` + `public_web` |
| Hold/stop missing | `order_control` Off |

## 9. Related code (tenant)

- `web-admin/lib/services/workflow/workflow-profile-resolution.service.ts`
- `web-admin/lib/services/workflow/semantic-workflow-artifact.service.ts`
- `web-admin/src/features/pickup/ui/ready-fulfilment-panel.tsx`
- `web-admin/lib/services/workflow/stage-worklist-query.service.ts`
- `supabase/migrations/0470_live_normalized_workflow_profile_runtime.sql` (`sys_wf_prof_ver_validate_live`)
