# Workflow Order Advance

**Status:** P1–P6 **in repo**; discovery **signed 2026-07-25**; canary off by default; `0441` still operator-applied  
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
| [01_PRD.md](01_PRD.md) … [13_Production_Readiness_Checklist.md](13_Production_Readiness_Checklist.md) | Design pack |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Work packages |
| [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md) | Remote SQL runbook |

## Delivery guides

| Doc | Purpose |
|-----|---------|
| [developer_guide.md](developer_guide.md) | Repo implementation map and extension notes |
| [developer_guide_mermaid.md](developer_guide_mermaid.md) | Sequence diagrams for engine/public tracking flows |
| [user_guide.md](user_guide.md) | Floor/operator/customer usage notes and smoke steps |
| [user_guide_mermaid.md](user_guide_mermaid.md) | User-facing flow diagrams |
| [deploy_guide.md](deploy_guide.md) | Migration/apply/canary/smoke rollout notes |
| [testing_guide_and_scenarios.md](testing_guide_and_scenarios.md) | Practical validation matrix and commands |
| [technical_docs/README.md](technical_docs/README.md) | Deep implementation notes |

## Progress

- [progress_summary.md](progress_summary.md) · [current_status.md](current_status.md) · [CHANGELOG.md](CHANGELOG.md)
