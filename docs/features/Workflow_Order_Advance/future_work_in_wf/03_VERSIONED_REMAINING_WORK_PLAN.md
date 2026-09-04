# 03 — Versioned remaining-work plan (V1.0 close-out through V2)

**Date:** 2026-08-27  
**Repos:** `cleanmatex` (tenant app + **all** migrations) · `cleanmatexsaas` (HQ authoring)  
**Validation handoff:** [00_WF_ENTITY_GLOSSARY.md](00_WF_ENTITY_GLOSSARY.md), [01_HQ_STUDIO_VALIDATION_GAPS.md](01_HQ_STUDIO_VALIDATION_GAPS.md), [02_HQ_STUDIO_ISSUE_CODE_SPEC.md](02_HQ_STUDIO_ISSUE_CODE_SPEC.md)  
**Catalog maintenance:** add/update Check-policy issue codes only in HQ via `/manage-wf-policy-issues-catalog`. File 02 is narrative, not the emit registry.  
**Scope lock:** [ADR_SCOPE_AND_CORRECTION_PASS.md](../ADR_SCOPE_AND_CORRECTION_PASS.md)  
**Runtime target:** [LIVE_NORMALIZED_PROFILE_RUNTIME.md](../LIVE_NORMALIZED_PROFILE_RUNTIME.md) and HQ `ADR-SAAS-MNG-0010`  
**Full Pack:** `CleanMateX_Order_Workflow_V1_Full_Pack_v1.0/` is **reference for V2**, not V1.0 authority

## 1. How to read this plan

| Label | Meaning |
|-------|---------|
| **Must** | Version cannot be called done |
| **Should** | Safety, operability, or UX that belongs in the version |
| **Could** | Optional depth; do not block the version |

Rules that apply to every version:

- HQ authors policy; tenant never gets a graph/Studio editor.
- No screen-local status writers. Stage-owned commands + engine only.
- Reassignment is **new-order-only** unless an explicit migrate command exists.
- Unsupported capabilities (partial, return, OTP-required, DSL) stay fail-closed until that version ships the owning service.
- EN/AR + RTL, RLS / `tenant_org_id`, idempotency, `state_version`, access contracts, and tests are mandatory on every new surface.
- Migrations are created in **cleanmatex only**, never applied by the agent.

```text
Now          V1.0 close     V1.0.x            V1.1              V1.2               V1.3            V2
             S10 + HQ §02   Live resolver     Returns           Outsource          Partial+OTP     Facade +
             validation     Check policy      Stage exec SoT    Richer Studio      B2B hold        projections
             artifact pin   order migrate     Work groups       Milestones                         legacy purge
```

---

## 2. V1.0 remainder — close the current programme

Not a new product version. Unsigned / in-flight V1.0.

### Must

| ID | Item | cleanmatex (tenant) | cleanmatexsaas (HQ) |
|----|------|---------------------|---------------------|
| V10-M1 | Staff routed POD **S10** + T01–T18 + rollback rehearsal | Recreate semantic-snapshot test orders; S10 canary; cancel/hold/resume/stop smoke after `0442`; live PAY_ON_COLLECTION composition | Same published artifact/preview; no extra authoring |
| V10-M2 | Profiles that tenant can actually run | Keep runtime fail-closed; map `PROFILE_ASSIGNMENT_REQUIRED` to **422** (not generic 500) on submit-order | Implement [02 issue spec](02_HQ_STUDIO_ISSUE_CODE_SPEC.md) — pickup↔Ready **modules**, `staff_web`, initial-rule exhaustiveness, `MARK_READY` ban, `current_artifact_id`. **Stop** preset `CONFIRM_PICKUP` on `ready_release`; extend `execution_not_from_status_owner` for direct pickup |
| V10-M3 | Artifact vs live rows must not split-brain | Until resolver cutover: create still needs `current_artifact_id`. Prisma `org_orders_mst` snapshot columns must stay in schema | Pilot/Publish refuse null `current_artifact_id` |
| V10-M4 | ADR-0010 start **or** stay consistent on artifacts | Do not drop artifact reads in tenant while HQ still publishes via compile-only | Do not switch HQ to Check-policy-only while tenant still requires artifacts |

### Should

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V10-S1 | Unavailable-state UX | EN/AR empty states on Off modules and bad deep links | Effective preview lists enabled screens + coupling failures |
| V10-S2 | HQ RBAC | — | `HQ_RBAC_ENFORCEMENT_ENABLED=true` before a second operator |
| V10-S3 | Gate RLS / ledger integration tests | Tenant assurance slice | HQ assurance slice |

### Could

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V10-C1 | Retire leftover tenant JSON editors | **Done:** `/dashboard/settings/workflows/new` and `[id]/edit` redirect to the hub; JSON add/edit links removed | Keep `410 LEGACY_WORKFLOW_RETIRED` |
| V10-C2 | Visual a11y / RTL pass | Floor + Workboard + Ready pickup panel | Studio Validation panel |

### V1.0 exit

- S10 signed (or explicitly rejected with a dated product decision).
- Check policy blocks `pickup_without_ready_release`, the Ready/pickup **module** split, and the rest of file 02 sprint order 1–8.
- Both repos still agree on artifact **or** both have switched to live rows (not one of each).
- Pilot assignable only to `is_hq_test_demo` tenants.

---

## 3. V1.0.x — policy platform hardening

Short train after S10 so V1.1 is not blocked by compiler debt.

### Must

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V10x-M1 | `WorkflowPolicyResolver` | Load policy from normalized profile-version tables only; no artifact / graph-pin / template fallback | Same contract in Simulate / Effective preview |
| V10x-M2 | `WorkflowPolicyValidator` | Shared issue codes from file 02 | Studio **Check policy** (replace Compile-as-authority) |
| V10x-M3 | Open-order **version migrate** command (ADR-0010) | Preview eligible orders; validate current status vs target policy; permission + reason + confirmation; idempotent; audit per order; **never** automatic on reassign | HQ UI to launch and monitor migrate |
| V10x-M4 | Channel uniqueness + permission existence | Execute already fail-closed | File 02 `execution_binding_duplicate` extend + `execution_permission_invalid` |
| V10x-M5 | Create hydration + Initial-rule matrix + hold harden + home collection | **T0–T4 + leftover close-out done** (0479–0487 applied). `createOrderInTransaction` maps preset errors; home-collection actions gated; JSON editors retired; New Order now submits selected type/source context (default `POS` / `pos`). See [04 plan](04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md) | **H1–H3 + leftover close-out done** (Studio persist blocked for missing preset / wildcard-draft; catalog **1.3.0** `evidence_without_home_collection`) |

### Should

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V10x-S1 | Gate `parameters_json` JSON Schema | Evaluators already fail unknown | `gate_parameters_invalid` |
| V10x-S2 | Nav from server workflow-context | Hide/disable Off modules using context, not a second client policy | Preview the same contract |
| V10x-S3 | Submit-order error mapping | **Done 2026-09-03:** create `PROFILE_*` → 422 + `workflow.profileErrors`; runtime integrity stays 409 | — |

### Could

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V10x-C1 | Starter-template import | — | ADR-0010 “Use as starter template” with mapped / skipped / issues |
| V10x-C2 | Drop artifact **runtime** columns | Forward migration after recreation + acceptance | Stop writing artifacts; keep rows for audit until purge |

### V1.0.x exit

Tenant create/list/execute/workboard/pickup/delivery/public tracking all use the resolver. HQ Check policy is the lifecycle gate. Open-order migrate exists and is unused by Assign.

---

## 4. V1.1 — projections, stage executions, work groups, returns

Locked in the tenant ADR. **Do not** enable `returning` in HQ until the tenant service exists.

### Must

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V11-M1 | **Return sub-order** | Linked return order; finance/tax/credit; custody; `returning` executable; original not silently rewritten | Lift `returns_enabled` / `returning` only after tenant tests; until then keep `return_action_not_supported` |
| V11-M2 | **Stage executions SoT** | Durable stage execution rows own prep/QA/pack completion; `preparation_status` becomes bridge then projection | Bind stage-complete actions to executions, not header flags |
| V11-M3 | **Work groups MVP** | Mixed-service: parallel plant routes **or** explicit split. Today: `PROFILE_SERVICE_SCOPE_CONFLICT` | Assignments per work group, not only per header; validator for mixed-service |
| V11-M4 | **Projections** | Fulfilment / exception / custody / customer-visible milestone derived from executions + items/pieces | Customer-visible milestone map in profile (read model) |

### Should

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V11-S1 | Split-order as work-group fork | `splitOrder` modelled, not only a processing-status child | — |
| V11-S2 | Order Control floor | Optional hold/resume/stop/cancel page (`order_control`) | Module stays cross-cutting |
| V11-S3 | Additive `operational_status` **projection** | Do **not** rename `current_status` as a go-live gate (ADR rejected big-bang rename) | — |

### Could

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V11-C1 | Cancel worklist | `canceling` queue | — |
| V11-C2 | Return reason catalog UX | Tenant reason codes | HQ bind reason minimums already exist for some actions |

### V1.1 exit

Returns work with finance. Mixed-service either splits cleanly or runs work groups. Prep/QA/pack completion is an execution row. HQ can enable `returning` without tenant crash.

---

## 5. V1.2 — outsourcing, richer HQ designer, milestone notifications

Locked in the tenant ADR.

### Must

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V12-M1 | **Outsourcing jobs** | Vendor job, send/return counts, damage/missing, QA on return, reconciliation; `WF_V2_OUTSOURCE` becomes real | Outsource module, vendor-capable actions/gates; **no money** in workflow |
| V12-M2 | **Richer HQ designer** | Consume via HQ API only | Archetype wizard, create-path matrix, reachability, bilingual issue inspector — **this is file 01/02 as product** |
| V12-M3 | **Customer milestone notifications** | Map milestones → templates (ready, OFD, delivered); public channel still cannot run staff commands | Milestone → event policy; public visibility map constrained |

### Should

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V12-S1 | Partner `api` / `integration` channel | Same stage commands, idempotency, schema | Channel coverage required per exec |
| V12-S2 | Driver/mobile cutover | Mobile uses stage APIs only (P7R already specified) | Require `mobile` when `driver_delivery` On (file 02 channel rules) |
| V12-S3 | Tenant approved-profile picker | Pick among HQ-assigned **published** profiles (read-only) | Assignment list already exists |

### Could

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V12-C1 | Vendor-facing status | Still via facade, not a second engine | Vendor as a channel later (V2 Could) |

### V1.2 exit

Outsource happy path + exception. Studio runs file 02 checks as first-class Validation. Customer notify uses the milestone map.

---

## 6. V1.3 — partial fulfilment and OTP

Coverage matrix §10. Do **not** mix into V1.1.

### Must

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V13-M1 | Partial pickup | Item/piece selection, release lines, collection allocation, idempotent handover | Lift `partial_pickup_enabled` only after tests |
| V13-M2 | Partial delivery | Stop/POD per slice; remaining routing | `partial_delivery_enabled` |
| V13-M3 | OTP/PIN proof | Verifier, retry, rate-limit, expiry, audit | Allow required OTP; retire `evidence_otp_*` hard bans |

### Should

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V13-S1 | Fail / cancel delivery attempt | Replace remaining 503 writers | Execs + reasons |
| V13-S2 | Durable B2B fulfilment hold | Re-check AR reservation at release/handover; block anonymous B2B public confirm | No workflow bypass of credit |

### Could

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V13-C1 | Authenticated B2B contact confirm | Separate from anonymous `/track` | Public-channel rules for B2B |

### V1.3 exit

Partial and OTP are selectable in Studio **only** when tenant evaluators and services pass. Unsupported combos still fail closed if flags are forged.

---

## 7. V2 — platform contract (Full Pack end-state)

V2 is not “more laundry screens”. It is one operational contract.

### Must

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V2-M1 | Single **Workflow Facade** | Web, mobile, POS, public, partner hit the same versioned commands | Catalog grammar frozen; profiles only compose it |
| V2-M2 | Multidimensional state as **the** contract | `current_status` is a projection of executions + fulfilment + exception; documented operational status | Profiles author projections, not a second god-column |
| V2-M3 | Legacy purge | Drop Legacy/Enhanced RPCs, graph-pin runtime, compiled-artifact **runtime**, tenant JSON editors, unused Gen 0 tables after retention | Remove 410 shims after zero traffic |
| V2-M4 | Controlled conditional transitions | Typed, versioned, explainable conditions — **not** free-form SQL/JS | Validator exhaustiveness for condition branches |

### Should

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V2-S1 | Fleet migrate + profile clone | Bulk migrate with preview | Cross-tenant profile clone with lineage |
| V2-S2 | SLA / queue in profile | Workboard SLA from profile queue policy | Author queue/SLA in Studio |

### Could

| ID | Item | Tenant | HQ |
|----|------|--------|-----|
| V2-C1 | Vendor portal | Vendor status via facade | Vendor channel |
| V2-C2 | Public timeline | Customer timeline from projection | Public visibility map |

### V2 forever non-goals

- Tenant-authored SQL/JS workflow
- HQ editing global catalogs as a silent tenant runtime change
- Auto-moving in-flight orders on reassignment
- Workflow calculating money

---

## 8. Explicitly not missing V1.0 tenant **pages**

These routes already exist. Later versions add **policy + services**, not a second dashboard for the same stage.

| Catalog | Route | V1.0 note |
|---------|-------|-----------|
| `new_order` | `/dashboard/orders/new` | Built |
| `preparation` | `/dashboard/preparation` | Built; profile may skip |
| `processing` | `/dashboard/processing` | Built |
| `assembly` | `/dashboard/assembly` | Built; hide duplicate AssemblyJh nav |
| `qa` | `/dashboard/qa` | Built |
| `packing` | `/dashboard/packing` | Built |
| `ready_release` | `/dashboard/ready` | Built; **required** if pickup On |
| `pickup_handover` | Embedded on Ready Details; list alias `/dashboard/ready?focus=counter` | No standalone page by design |
| `driver_delivery` | `/dashboard/delivery` | Built; S10 unsigned for routed POD |
| `workboard` | `/dashboard/workboard` | Built, read-only |
| `public_tracking` | `/track/{token}` | Built |
| `canceling` / `order_control` | Commands on the order | Optional dedicated pages in V1.1 Should |
| `returning` | None | **V1.1 Must** |

Do **not** rebuild `/dashboard/settings/workflows/new` or `[id]/edit`.

---

## 9. Cross-cutting checklist (every version)

| Area | Tenant | HQ |
|------|--------|-----|
| EN/AR + RTL | New floor strings + `cmxMessage` | New issue `message` / `message2` |
| Isolation | Every `org_*` query filters `tenant_org_id` | Assign DTOs tenant-safe |
| Concurrency | `state_version` + idempotency on every command | Simulate must not write |
| Gating | UI access-contract golden path | `workflows.view` / `workflows.manage` |
| Tests | Tenant isolation, fail-closed unsupported flags, mixed-service | Fixtures per file 02 (Lean plant must fail pickup-without-Ready) |
| Docs | Feature pack 01–13, guides | HQ user/dev/test; coverage matrix §9 = code |

---

## 10. Suggested near-term sequence (owners)

1. **HQ:** file 02 sprint order 1–8 in Check policy / compiler (including the direct-pickup compiler exception).  
2. **Tenant:** submit-order HTTP mapping + keep Prisma snapshot fields.  
3. **Both:** S10 / recreate snapshot orders.  
4. **Both:** ADR-0010 resolver + validator (V1.0.x).  
5. **Product:** V1.1 returns + work groups after V1.0.x, not before.

## 11. Related

- Tenant current status: [current_status.md](../current_status.md)
- Tenant implementation plan: [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)
- HQ current status: `F:/jhapp/cleanmatexsaas/docs/features/SAAS_Platform_Management/Workflow_Engine_HQ/current_status.md`
- HQ coverage matrix §9: `.../profile_policy_coverage_matrix.md`
