# Workflow Order Advance

**Status:** Automated delivery assurance is complete. Migration `0464_require_semantic_order_snapshots.sql` is applied locally and remotely, and semantic-only runtime cutover is active. **Staff POD delivery smoke S10 remains unsigned** until pre-cutover unsnapshotted test orders are recreated and the operator/e2e canary (`p7-harden`) is complete.
**Version:** see [version.txt](version.txt) · [OVERNIGHT_CHECKPOINT.md](OVERNIGHT_CHECKPOINT.md)  
**Authority:** This folder + [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) + Cursor plan  
**Reference only:** [`CleanMateX_Order_Workflow_V1_Full_Pack_v1.0/`](CleanMateX_Order_Workflow_V1_Full_Pack_v1.0/)  
**Evidence:** [`Audit_Reports_Order_Workflow/`](Audit_Reports_Order_Workflow/)  
**Historical:** [`old/`](old/)

## Goal

Replace dual Legacy/Enhanced DB engines with one production **app `WorkflowEngine`**, then deepen the platform in phases — without recreating an overloaded single-status god column forever, and without a tenant-editable state machine.

## Phased product scope (expert lock)

| Phase | Scope |
|-------|--------|
| **V1.0** | Engine cutover, action UX, HQ-authored config, Ready≠release, release records, central outbox, `state_version`, writer elimination |
| **V1.1** | Multidim **projections**, stage executions SoT, work groups (MVP) |
| **V1.2** | Full outsourcing, richer HQ designer (saas), customer milestone mapping |

See [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md).

## Locked principles (V1.0)

1. One app engine writer for order operational transitions  
2. Action codes + `listAvailableActions` ≡ execute policy  
3. **HQ authors/publishes/assigns** profiles; tenant = read-only effective + optional approved-list pick  
4. Cutover column: `current_status` (worklist); dual-write `status`; contract migration later (V1.1)  
5. Concurrency: `state_version` / `expected_state_version`  
6. Reuse central outbox/idempotency; do not invent per-feature outbox without proof  
7. Retail is not auto-`closed`  
8. Delivery finalize = atomic `CONFIRM_DELIVERY` (+ POD payload)  
9. Rename tables only when responsibility is wrong  
10. Full seed + graph validation; EN/AR; RLS; canary  

The staff delivery principle above is an unmet release gate, not a completed claim. Legacy route creation and direct staff delivery shortcuts remain fail-closed until POD evidence, payment/release checks, stop/route updates, the order transition, history, and outbox share one rollback-safe operation. Public `/track/{token}` confirm-received remains available under its separately tested customer contract.

The implemented P7R proof/audit surface is read-only. Authorized staff can review delivery outcome, payment state, handover actor/time/notes, and time-limited evidence links on Delivery Stop Detail and Order Details. It does not enable staff delivery completion or expose private storage keys.

The P7R Workboard is read-only. It resolves queue membership and owner routing only through each order's immutable compiled profile artifact. Orders without a valid snapshot are excluded from operational queues; the Workboard never offers a raw status mutation or a second transition writer.

## Activate canary (after you apply `0427`/`0428` and the current rollout migrations)

```bash
# server
WORKFLOW_ENGINE_V2=true
# client hook
NEXT_PUBLIC_WORKFLOW_ENGINE_V2=true
```

## Design docs

| Doc | Topic |
|-----|--------|
| [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md) | Scope lock vs Full Pack |
| [ADR_SYS_WF_PROFILES.md](ADR_SYS_WF_PROFILES.md) | HQ `sys_wf_profiles_*` shape (migration `0444`) |
| [tenant_workflow_runtime.md](tenant_workflow_runtime.md) | Historical P0 graph-pin runtime (execution retired 2026-08-22) |
| [technical_docs/semantic_profile_assurance.md](technical_docs/semantic_profile_assurance.md) | Automated semantic-profile assurance, recreation, residual |
| [WORKFLOW_TABLES_INVENTORY.md](WORKFLOW_TABLES_INVENTORY.md) | All `work` / `wf` tables: Gen 0–3, live vs deprecated |
| [01_PRD.md](01_PRD.md) … [13_Production_Readiness_Checklist.md](13_Production_Readiness_Checklist.md) | Design pack |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Work packages |
| [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md) | Remote SQL runbook |

## HQ (cleanmatexsaas) handoff

SaaS-only implementation for **live** workflow config screens:

- `F:\jhapp\cleanmatexsaas\docs\features\SAAS_Platform_Management\Workflow_Engine_HQ\HQ_BUILD_LIVE_WORKFLOW_SCREENS.md` ← start here (used tables only)
- `...\HQ_WORKFLOW_CONFIG_IMPLEMENTATION_INSTRUCTIONS.md`
- `...\HQ_WORKFLOW_CONFIG_SCREENS_TABLE_MATRIX.md`

Table generations: [WORKFLOW_TABLES_INVENTORY.md](WORKFLOW_TABLES_INVENTORY.md)  
Do not implement HQ config UI in this tenant repo. Do not build screens for deprecated Gen 0 tables.

## Delivery guides

| Doc | Purpose |
|-----|---------|
| [developer_guide.md](developer_guide.md) | Repo implementation map and extension notes |
| [developer_guide_mermaid.md](developer_guide_mermaid.md) | Sequence diagrams for engine/public tracking flows |
| [user_guide.md](user_guide.md) | Floor/operator/customer usage notes and smoke steps |
| [user_guide_mermaid.md](user_guide_mermaid.md) | User-facing flow diagrams |
| [deploy_guide.md](deploy_guide.md) | Migration/apply/canary/smoke rollout notes |
| [testing_guide_and_scenarios.md](testing_guide_and_scenarios.md) | Practical validation matrix and commands |
| [07_Permissions_RBAC_Nav.md](07_Permissions_RBAC_Nav.md) | RBAC, access-contract, and navigation ownership |
| [risks_and_rollout.md](risks_and_rollout.md) | P7R delivery risk register, release gates, and rollback rules |
| [technical_docs/README.md](technical_docs/README.md) | Deep implementation notes |

## Progress

- [progress_summary.md](progress_summary.md) · [current_status.md](current_status.md) · [CHANGELOG.md](CHANGELOG.md)
