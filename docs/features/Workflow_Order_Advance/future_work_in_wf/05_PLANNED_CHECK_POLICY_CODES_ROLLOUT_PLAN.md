# 05 — Planned Check-policy codes rollout plan (DRAFT — plan only, no code changed)

**Date:** 2026-09-04
**Status:** DRAFT for owner review. Zero files changed by this plan. Nothing here has been implemented.
**Repo for implementation:** `cleanmatexsaas` (HQ) — codes are TypeScript catalog + validator/compiler, not tenant migrations.
**Skill:** `/manage-wf-policy-issues-catalog` (loaded to produce this plan)
**Source of truth for "why":** [01_HQ_STUDIO_VALIDATION_GAPS.md](01_HQ_STUDIO_VALIDATION_GAPS.md) (situations) + [02_HQ_STUDIO_ISSUE_CODE_SPEC.md](02_HQ_STUDIO_ISSUE_CODE_SPEC.md) (severity/gate contract)
**Backlog anchor:** `03_VERSIONED_REMAINING_WORK_PLAN.md` — this is the detail behind the "planned Check-policy codes" item.

---

## 1. Why this is a separate plan, not a same-night implementation

`wf-policy-issue-catalog.planned.ts` currently holds **46 codes** with zero severity/gates assigned — they are inert (never emitted, never block anything). Promoting any of them to emitted:

- adds a **new `error`-severity gate** on Check policy / Pilot / Publish / seed for most of them (per file 01's "Block" label),
- with `seed_must_pass: true` — meaning the **platform's own seed data must not violate it**,
- and there are now **two live PILOT profiles on remote** (`WF_V2_HOME_COLLECTION` v1, `WF_V2_SIMPLE` v4) that a careless promotion could retroactively fail.

CLAUDE.md's "plan first, wait for approval before editing" applies to new scope regardless of the hour, and this is real product-law judgment (which situations are actually "Block" vs "Warn" for *this* platform's current profiles), not a mechanical fix. So: plan now, implement after review.

---

## 2. Mandatory pre-flight for every batch below

Before promoting **any** code in a batch:

1. Run the new validator logic against **both** live PILOT versions first, as a dry run (do not deploy/promote yet):
   - `WF_V2_HOME_COLLECTION` — profile `a1000000-0000-4000-8000-000000000073`, version 1
   - `WF_V2_SIMPLE` — profile `a1000000-0000-4000-8000-000000000011`, version 4
2. If either would newly fail `check_policy` with an `error`, that is a **regression**, not a bug report — stop and get a product decision (fix the profile, or the situation is actually `warn` not `error` for this platform, or scope the rule more narrowly) before merging the promotion.
3. Only after both pass clean: `npm run catalog:generate && npm run catalog:check` (platform-api), `npm run catalog:check` (platform-web), `npm run check:wf-policy-issue-catalog` (tenant pin).

This is the same fail-closed discipline already proven today: catalog 1.3.0's `evidence_without_home_collection` was added and verified clean against the live profile before anyone relied on it.

---

## 3. One gap found while planning: a file-01 situation with no planned row

File 01 §D lists `initial_rule_uncovered_create_path` ("Specific matchers, no catch-all" → `PROFILE_INITIAL_RULE_UNMATCHED` 422) as a **Must-add** situation, but it does **not exist** in `wf-policy-issue-catalog.planned.ts` at all — not planned, not emitted. This needs a **new planned row added first** (operation: *add planned*, not promote) before it can ever be sequenced into a batch. Flagging so it isn't silently dropped.

---

## 4. Proposed batch sequencing

Ordered by: isolation (won't interact with other pending changes) → regression risk (checked against the two live profiles) → product-law complexity (nuance in file 01 §C is highest).

| Batch | Codes | Section (file 01) | Severity (file 02) | Regression risk on current profiles | Notes |
|---|---|---|---|---|---|
| **1** | `workboard_must_be_observer`, `module_without_status_membership`, `owner_module_without_execution` | §A | error | **Low** — both live profiles already have `workboard` as `observer` and every enabled module has status membership + an owning execution (verified today while debugging HC1/HC2). Good first batch: mechanical, structural, no fulfilment nuance. | Start here. |
| **2** | `pickup_handover_missing_for_counter`, `delivery_without_ready_release`, `public_tracking_requires_pickup_release`, `core_processing_missing`, `disabled_stage_without_skip_edge` | §A | error (core_processing_missing: warn for documented retail-only) | **Medium** — depends on which optional modules each live profile has On/Off. Must dry-run both. | `core_processing_missing` needs a product call on which profiles count as "documented retail-only" before wiring as anything but warn. |
| **3** | `staff_web_channel_missing`, `public_web_channel_missing`, `execution_permission_invalid`, `legacy_mark_ready_forbidden`, `return_action_not_supported`, `invalid_cross_cutting_module`, `terminal_status_forward_action` | §B | error | **Medium** | `return_action_not_supported` and `legacy_mark_ready_forbidden` should be uncontroversial (returns are hard-off until V1.1 anyway; `MARK_READY` already retired). |
| **4 (highest care)** | `pickup_action_on_wrong_module`, `delivery_action_on_wrong_module`, `release_action_on_wrong_module`, `delivery_stop_gate_on_simple_profile`, `staff_delivery_execution_missing`, `routed_delivery_evidence_incomplete`, `generic_requires_evidence_forbidden`, `evidence_otp_optional_dead` (warn), `pickup_execution_missing`, `direct_pickup_from_ready_not_declared`, `public_pickup_requires_release_path`, `public_cannot_own_pickup_action` | §C | error (one warn) | **High** — this is file 01's most nuanced section (Ready ≠ pickup ≠ delivery module split, plus the already-implemented direct-counter-pickup exception in `wf-policy-validator.service.ts`'s `isExemptDirectCounterPickupIssue`). Get this wrong and a legitimate direct-counter-pickup profile fails Check policy. | Read `isExemptDirectCounterPickupIssue` again before touching this batch — the new codes must respect the same exception, not re-introduce the false positive it was built to remove. |
| **5** | `initial_rule_no_winner`, `initial_rule_multiple_winners`, `initial_status_closed_forbidden`, `initial_status_fulfilment_forbidden` **+ new** `initial_rule_uncovered_create_path` (see §3 above — add planned first) | §D | error | **Medium** — needs simulated-context testing (Walk-in POS, remote/pending-dropoff, retail, Quick Drop, each `order_source_code` in use) per file 01's "Required simulated contexts" list, not just structural checks. | Natural companion to today's H1–H3 Initial-rule work; reuses the `simulate-create` endpoint already built. |
| **6** | `optional_stage_skip_ambiguous`, `optional_stage_skip_missing`, `enabled_stage_unreachable`, `illegal_cycle`, `back_step_forbidden_by_policy` | §E | error | **Medium** — BFS reachability logic; `illegal_cycle` must keep the documented QA fail→rework and hold→resume exceptions from being flagged. |
| **7** | `gate_evaluator_missing`, `gate_requires_disabled_module`, `fulfilment_missing_collection_gate`, `rack_gate_wrong_action`, `gate_parameters_invalid` | §F | error (fulfilment_missing_collection_gate: error or warn — **product decision needed**, file 01 flags this explicitly), `override_permission_not_in_tenant_roles` is assign_warn (§G, not §F) | **Low–Medium** | `fulfilment_missing_collection_gate`'s severity is explicitly undecided in file 01 ("Error or Warn by product") — needs an owner call before wiring. |
| **8 (low risk — Assign-time only)** | `assign_scope_conflict`, `assign_duplicate_tenant_default`, `assign_service_scope_never_used`, `assign_mixed_service_split_required`, `assign_pilot_not_demo_tenant`, `assign_missing_published_for_unpinned`, `assign_policy_invalid`, `assign_does_not_move_open_orders`, `override_permission_not_in_tenant_roles` | §G | assign_error / assign_warn | **Low** — `assign_*` severities never fail Check policy/Pilot/Publish (§G note in file 02), only the Assign action itself. Safest batch to do anytime; doesn't touch already-PILOT profiles retroactively. | `assign_pilot_not_demo_tenant` is worth prioritizing within this batch — it would have been a nice belt-and-suspenders check on today's `WF_V2_HOME_COLLECTION` assignment (which was correctly `is_hq_test_demo: true`, but the validator doesn't currently enforce this itself — Studio/DB governance does). |
| **9** | `policy_check_stale` (warn), `policy_flag_without_runtime_surface` | §H | warn | **Lowest** — informational only, no gate risk. Could go first or last; low value either way. |

---

## 5. Per-batch execution checklist (from the skill, for whoever implements)

For each code in a batch:

1. Delete the `plannedIssue({...})` row from `wf-policy-issue-catalog.planned.ts`.
2. Add the literal to `WF_EMITTED_POLICY_ISSUE_CODE_LIST` **and** `emittedIssue({...})` in `wf-policy-issue-catalog.emitted.ts` (same PR — load-time assert fails if they drift).
3. Wire the emit: compiler `addIssue` (`wf-semantic-profile-compiler.service.ts`) and/or `WorkflowPolicyValidator` via `buildWfPolicyIssue`.
4. Add EN + AR: `workflowEngineConfig.studio.compileIssues.codes.{code}.{title,meaning,steps}` in both `en.json`/`ar.json`.
5. Auto Fix: `mode: 'none'` is the safe default unless file 01 clearly implies an automatic remediation.
6. Bump `WF_POLICY_ISSUE_CATALOG_VERSION` (currently 1.3.0) once per batch, not once per code.
7. Tests: catalog spec, validator/compiler spec for each new emit.
8. `npm run catalog:generate && npm run catalog:check` (platform-api) → `npm run catalog:check` + targeted Jest (platform-web) → `npm run check:wf-policy-issue-catalog` (tenant, after the sibling pin is written).
9. **Pre-flight from §2 above, before any of this**, not after.

---

## 6. What this plan does NOT decide

- Exact wording for EN/AR `meaning`/`steps` per code — write at implementation time, not now.
- Whether `core_processing_missing` and `fulfilment_missing_collection_gate` are `error` or `warn` — explicitly flagged above as open product calls.
- Timing / which batch ships in which release — that's a scheduling call, not a technical one.
- Whether to fold this into V1.0.x (already tracked in `03_VERSIONED_REMAINING_WORK_PLAN.md`) or a separate train.

**Recommendation if asked for one:** Batch 1, then 8 (assign-time, no Pilot/Publish risk), then 2 — in that order gets the safest, most isolated wins first while batch 4 (the hardest) gets the most owner attention time to land correctly.
