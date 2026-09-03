# Future work in workflow (profile validation + version plan)

**Date:** 2026-08-27  
**Audience:** HQ Workflow Studio (cleanmatexsaas) and tenant Workflow Order Advance (cleanmatex)  
**Status:** Planning handoff — not an implementation sign-off  
**Does not replace:** [ADR_SCOPE_AND_CORRECTION_PASS.md](../ADR_SCOPE_AND_CORRECTION_PASS.md), HQ coverage matrix, or V1.0 production checklist

This folder holds related deliverables:

1. **Shared vocabulary** so page, module, and `screen_key` are not treated as the same thing.
2. **All profile-setup gaps** HQ should fold into Validation / Check policy / Pilot / Publish / Assign (not Compile-as-authority).
3. **The remaining product plan** from V1.0 close-out through V1.1, V1.2, V1.3, and V2, split by tenant vs HQ.
4. **Create hydration + fulfilment types + Initial rules + Hold** — implementation plan (Now), including HQ create presets and home collection.

## Read in this order

| File | Purpose | Give to |
|------|---------|---------|
| [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md) | Definitions: page vs module vs `screen_key`, actions, executions, channels, UI chrome, worked examples | Anyone touching Studio or tenant workflow |
| [01_HQ_STUDIO_VALIDATION_GAPS.md](01_HQ_STUDIO_VALIDATION_GAPS.md) | Situations, couplings, archetypes, warn vs block | HQ Studio / `WorkflowPolicyValidator` owners |
| [02_HQ_STUDIO_ISSUE_CODE_SPEC.md](02_HQ_STUDIO_ISSUE_CODE_SPEC.md) | Narrative for planned codes and operator intent | HQ `WorkflowPolicyValidator` authors |
| [GENERATED_WF_POLICY_ISSUE_CATALOG.md](../generated/GENERATED_WF_POLICY_ISSUE_CATALOG.md) | **Emit registry** — severity, gates, Studio tab, Auto Fix IDs, seed_must_pass. Maintain in HQ via `/manage-wf-policy-issues-catalog` | HQ catalog generate; tenant seed CI |
| [03_VERSIONED_REMAINING_WORK_PLAN.md](03_VERSIONED_REMAINING_WORK_PLAN.md) | Must / Should / Could by version, both repos | Product + both engineering tracks |
| [04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md](04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md) | Create presets, Initial-rule matrix, home collection, hold (**tenant T0–T4 + leftover close-out done**, 0479–0487 applied). HQ H1–H3 + leftover close-out done (catalog **1.3.0**) | Product + tenant + HQ Studio |

## Authority and limits

- Tenant runtime truth **today:** `WorkflowPolicyResolver` on live profile-version rows (`web-admin/lib/services/workflow/workflow-policy-resolver.service.ts`), consumed by create, floor lists, engine, pickup, Workboard, delivery, and public tracking. Workboard groups by `wf_profile_version_id`. Privacy-safe observe events and support diagnosis: [live_runtime_support.md](../technical_docs/live_runtime_support.md).
- HQ policy truth **today:** `WorkflowPolicyValidator` + Check policy, with issue metadata from the typed catalog (`catalog/`). Add/update/retire codes only in HQ after loading `/manage-wf-policy-issues-catalog`. Structural write-lock codes come from tenant `sys_wf_prof_ver_live_rpt` (`0477`) and are mapped through the same catalog. `WfSemanticProfileCompilerService` still emits compatibility codes that the validator maps, except reporter codes which SQL replaces. Soft Studio graph advice is **not** a publish gate.
- DB minimum check: `sys_wf_prof_ver_live_rpt` + `sys_wf_prof_ver_validate_live` in `0478` (after `0477`). Structural only; it does **not** replace the catalog. Named observer-execute exceptions: pickup `CONFIRM_PICKUP` from observed `ready`, public `CONFIRM_DELIVERY` from observed OFD, canceling `CANCEL_ORDER` from observed `intake`, order_control `HOLD_ORDER_WORK` from observed allowlisted plant statuses (`processing` plus 0486). Create-preset / wildcard-draft reporter rows are in **0487** (applied). Do not edit applied 0470–0487.
- Vocabulary: [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md) is canonical for page vs module vs `screen_key`.
- Full Pack under `CleanMateX_Order_Workflow_V1_Full_Pack_v1.0/` is **reference** for V2, not V1.0 authority.
- Do **not** build a tenant Workflow Studio. HQ authors; tenant consumes.

## Snapshot that motivated this pack

A published-looking Module coverage of `new_order` + `processing` + `pickup_handover` + `workboard` + `canceling`, with `ready_release` Off, is invalid for tenant counter pickup: the pickup **card** lives only on Ready Details, and `CONFIRM_PICKUP` must stay on the `pickup_handover` **module** even though that card is on the Ready **page**. See file 01 glossary + §3.A/C and file 02 `pickup_without_ready_release` / `pickup_action_on_wrong_module`.

Order create can still fail with `The assigned workflow profile has no current compiled artifact` when `sys_wf_profile_ver_mst.current_artifact_id` is null. That is independent of module On/Off. See file 01 §2.H.

## Related

- Vocabulary: [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md)
- Tenant: [LIVE_NORMALIZED_PROFILE_RUNTIME.md](../LIVE_NORMALIZED_PROFILE_RUNTIME.md), [08_UI_UX_Screens.md](../08_UI_UX_Screens.md), [current_status.md](../current_status.md)
- HQ: `F:/jhapp/cleanmatexsaas/docs/features/SAAS_Platform_Management/Workflow_Engine_HQ/profile_policy_coverage_matrix.md` (§9 publish checks)
- HQ ADR: `ADR-SAAS-MNG-0010` (Check policy on live rows; artifacts not runtime authority after cutover)
