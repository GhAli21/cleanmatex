# 00 — Workflow entity glossary

**Date:** 2026-08-28
**Audience:** HQ Studio authors, tenant floor engineers, support
**Status:** Canonical vocabulary for the direct normalized runtime
**Does not replace:** [04_Status_and_Vocabulary.md](../04_Status_and_Vocabulary.md) (status/action/transition codes), [05_Business_Rules_and_Gates.md](../05_Business_Rules_and_Gates.md) (gates), HQ coverage matrix

Read this **before** [01_HQ_STUDIO_VALIDATION_GAPS.md](01_HQ_STUDIO_VALIDATION_GAPS.md) and [02_HQ_STUDIO_ISSUE_CODE_SPEC.md](02_HQ_STUDIO_ISSUE_CODE_SPEC.md). Most Studio/runtime mix-ups happen when two of the words below are treated as synonyms.

> **Architecture authority (2026-08-28):** Profile versions are live normalized
> policy rows under ADR-SAAS-MNG-0010. Artifacts, checksums, graph snapshots,
> action maps, screen contracts, templates, and catalog transitions are not
> runtime policy authority. Action maps/screen contracts may be explicitly
> imported as starter-template data into a Draft/Pilot version.

---

## 1. The one rule

A **page** is a URL. A **module** is policy. A **`screen_key`** is the shared identifier for that policy. A **status** is where the order sits. An **action** is the command that moves it.

They are **not** 1:1.

```text
HQ Studio "Module coverage" toggle
        │
        ▼
  screen_key  ─────────────  catalog row in sys_wf_screens_cd
        │
        ├── enabled as a profile MODULE (On/Off + module_mode)
        ├── bound to STATUSES (owner vs observer)
        ├── owns EXECUTIONS (action + from → to + channels + gates)
        │
        └── may be hosted on zero, one, or two TENANT PAGES
            (or only as an embedded card / public adapter)
```

**Wrong:** “Pickup is On, so there must be `/dashboard/pickup`, and Confirm pickup belongs to the Ready module because the button is on Ready.”
**Right:** Pickup **module** `pickup_handover` is On. Its **card** is mounted on the Ready **page**. The executable `CONFIRM_PICKUP` must keep `screen_key = pickup_handover`.

### 1.1 Example — can one page include many screens, modules, and actions?

**Short answer:** a **page can host more than one module**, and therefore more than one `screen_key` and more than one set of actions. That is allowed. It is **not** the normal plant pattern, and it does **not** mean the page owns those modules.

Layers (do not flatten them):

| Layer | What it is | Cardinality on one page |
|--------|------------|-------------------------|
| **Page** | A URL the operator or customer opens | Exactly one URL |
| **Module** (`screen_key`) | Policy owner in HQ | Usually **one**. Ready Details hosts **two**. |
| **Action** | A command bound to a **module**, not to the URL | Many, but each action still belongs to one module |

A page does **not** “contain screens” the way a folder contains files. The page is only a **host**. Each button still asks the engine with **one** `screen_key`. Catalog **screen** = **module** = `screen_key`. There is no extra screen object besides that.

#### Usual case: one page ↔ one module

`/dashboard/processing` hosts module `processing`.
The ActionBar calls `useWorkflowActions(orderId, 'processing')`.
Staff see `COMPLETE_PROCESSING` (and whatever else is bound on that module).
That page does **not** run pickup or delivery commands.

Most plant floors work this way: preparation, processing, assembly, QA, packing, delivery list/details.

#### Special case: one page ↔ two modules (Ready Details)

Ready Details `/dashboard/ready/[id]` is the important exception:

```text
PAGE  /dashboard/ready/[id]
 │
 ├── MODULE ready_release
 │     actions: RELEASE_FOR_PICKUP, RELEASE_FOR_DELIVERY
 │     UI: fulfilment panel + ActionBar(screen="ready_release")
 │
 └── MODULE pickup_handover
       action: CONFIRM_PICKUP
       UI: pickup card (same page)
       engine call still uses screen="pickup_handover"
```

So **that one page includes two modules and several actions.** Those actions do **not** become “Ready-module actions” just because they sit on the Ready URL.

Delivery Details is similar in spirit: one page, module `driver_delivery`, several UI pieces (card, maybe ActionBar, stop/POD panel). Staff confirm is still that **one** module.

`/track/{token}` is one **page** and one **module** (`public_tracking`). Depending on status it may *call* the pickup **service** (which still executes `pickup_handover`). The page is not owning pickup.

#### Pickup-desk URL (alias, not a second product)

Do **not** add `/dashboard/pickup`. The Pickup desk is the Ready list with a query:

| URL | Meaning |
|-----|---------|
| `/dashboard/ready` | All Ready-area orders (`ready` + `ready_for_pickup`) |
| `/dashboard/ready?focus=counter` | **Pickup desk alias.** Same page, both handover paths (staged `ready_for_pickup` and direct `ready`). Confirm still opens Ready Details. |
| `/dashboard/ready?focus=counter&due=1` | Pickup desk plus remaining balance. Filters stack; they are not exclusive chips. |
| `/dashboard/ready?staged=1` | Waiting at counter only (`ready_for_pickup`) |
| `/dashboard/ready?unreleased=1` | Not yet available (`ready`). Legacy `?focus=shelf` still maps here. |
| `/dashboard/ready?due=1` | Remaining balance due. Legacy `?focus=collection`. |
| `/dashboard/ready?norack=1` | Missing rack. Legacy `?focus=no_rack`. |

Confirm pickup still opens **Ready Details** and still executes `pickup_handover`. `focus=pickup` / `focus=desk` are synonyms for the Pickup-desk alias. Status and due/rack flags combine with `focus=counter`; they do not replace it.

#### What is not true

- Turning three modules On in Studio does **not** merge them onto one page.
- One module Off does **not** delete the page (nav is still there).
- Many actions on one page does **not** mean they all share one `screen_key`.
- Binding `CONFIRM_PICKUP` to `ready_release` because “it is on the Ready page” makes the pickup card (which asks for `pickup_handover`) find nothing. **Host page ≠ owner module.**

#### Direct answers

| Question | Answer |
|----------|--------|
| Many **modules** on one page? | Possible, rare. Today: Ready Details = `ready_release` + `pickup_handover`. |
| Many **screens** on one page? | Only if you mean those modules (`screen_key`s). |
| Many **actions** on one page? | Yes. Each action still belongs to **one** module. The UI may list module A in the ActionBar and module B on a card. |

---

## 2. Entity catalog (definitions)

### 2.1 Catalog `screen_key`

| | |
|--|--|
| **What** | Stable snake_case id in `sys_wf_screens_cd.screen_key`. Global catalog, not tenant-owned. |
| **Who authors** | Platform migrations in `cleanmatex`. HQ Studio **selects** keys; it does not invent new ones. |
| **Used for** | Profile modules, executions, `listAvailableActions({ screen })`, `executeAction({ screen })`, worklist membership, leave-action maps. |
| **Not** | A Next.js route. Not a React component name. Not an order status. |

**Catalog keys (V1.0):**

`new_order`, `preparation`, `processing`, `assembly`, `qa`, `packing`, `ready_release`, `pickup_handover`, `driver_delivery`, `canceling`, `returning`, `order_control`, `workboard`, `public_tracking`

**Historical aliases (never write in new policy):**

| Alias (do not use) | Canonical `screen_key` |
|--------------------|------------------------|
| `ready` | `ready_release` |
| `delivery` | `driver_delivery` |

`web-admin/lib/constants/workflow-screens.ts` lists **floor worklist** keys. It **omits** `pickup_handover` on purpose: pickup is not a standalone worklist screen. The catalog and profile modules still include it.

**Policy vs host alias:** new profile rows always use `ready_release` / `driver_delivery`. Tenant floor URLs and `workflow_screen=ready` / `delivery` are **host aliases only**. Do not write those aliases into live executions or modules.

### 2.2 Module (profile module)

| | |
|--|--|
| **What** | One catalog `screen_key` **turned On or Off** on a profile version, with a `module_mode`. HQ Studio “Module coverage”. |
| **Stored** | `sys_wf_prof_ver_module_cf` live rows. |
| **Modes** | `primary_owner` — may own statuses and execute commands. `observer` — may show work; **cannot** execute. `cross_cutting_command` — execute without owning the plant status (cancel, order control, public tracking). |
| **On/Off** | Off means “this profile must not use that stage/command surface”. It does **not** delete the tenant page and does **not** hide static RBAC nav (nav is not profile-filtered in V1.0). |

**Example:** Lean plant: `processing` On, `qa` Off. `/dashboard/qa` still exists. Orders should never land in `qa` if skip edges are correct. Deep-link into QA should fail closed or show empty / not-configured.

### 2.3 Tenant page

| | |
|--|--|
| **What** | A Next.js App Router URL operators or customers open. |
| **Who owns** | Tenant `web-admin` routes + `web-admin/config/navigation.ts` + `sys_components_cd` (RBAC nav). **Not** authored per profile. |
| **Relation to module** | Many plant modules have a dedicated page. Some modules have **no** page. Some pages host **two** modules. See [§1.1](#11-example--can-one-page-include-many-screens-modules-and-actions). |

### 2.4 Status (`current_status`)

| | |
|--|--|
| **What** | Operational worklist value on `org_orders_mst.current_status` (codes in [04](../04_Status_and_Vocabulary.md)). |
| **Examples** | `processing`, `ready`, `ready_for_pickup`, `out_for_delivery`, `delivered`. |
| **Not** | A screen. `ready` is a **status**. `ready_release` is a **screen_key**. |

One status has **exactly one** `primary_owner` module on a valid profile. Other modules may **observe** that status (read-only membership).

### 2.5 Action (`action_code`)

| | |
|--|--|
| **What** | Named command in `sys_wf_actions_cd` (`COMPLETE_PROCESSING`, `RELEASE_FOR_PICKUP`, `CONFIRM_PICKUP`, …). |
| **Does** | Ask the engine to take a legal edge. Does not write `current_status` from the UI. |
| **Retired** | `MARK_READY` — do not bind. Plant uses stage complete; Ready uses release; pickup uses `CONFIRM_PICKUP`. |

The **same** `action_code` can exist on **two modules** when callers differ. Canonical case: `CONFIRM_DELIVERY` on `driver_delivery` (`staff_web`) **and** on `public_tracking` (`public_web`).

### 2.6 Transition (`transition_code`)

| | |
|--|--|
| **What** | Catalog reference edge (`TR_*`, legacy `REL_*`) in `sys_wf_transitions_cd`, useful for starter-template mapping and history. |
| **Relation** | A live executable is defined directly by its profile version, `screen_key`, action, source status, destination status, channels, and gates. Catalog transition/action maps do not decide runtime behavior. |
| **Example** | `RELEASE_FOR_PICKUP` → `TR_READY_PICKUP` (`ready` → `ready_for_pickup`). `CONFIRM_PICKUP` staged → `TR_PICKUP_DELIV` (`ready_for_pickup` → `delivered`). |

See [04 §4](../04_Status_and_Vocabulary.md).

### 2.7 Execution (executable binding)

| | |
|--|--|
| **What** | Profile row: “on this **module**, from this **status**, this **action** goes to that **status**, with these **channels** and **gates**.” |
| **Stored** | `sys_wf_prof_ver_exec_cf` with child channel rows in `sys_wf_prof_ver_exec_ch_cf`. |
| **Identity** | Parent execution: `version_id + screen_key + from_status + action_code + to_status`. Child channel: `execution_id + channel_code`. One execution may support multiple channels. |
| **Runtime** | Tenant `listAvailableActions` / `executeAction` require this `screen` to match. The wrong `screen_key` is not “close enough”. |

### 2.8 Channel (`channel_code`)

Who is allowed to **invoke** that execution.

| Code | Typical caller |
|------|----------------|
| `staff_web` | Tenant dashboard (ActionBar or stage card) |
| `public_web` | `/track/{token}` only |
| `mobile` / `api` / `integration` / `pos` | Reserved adapters (must be bound explicitly) |

Plant/Ready/pickup/delivery staff commands need `staff_web` or the tenant UI shows empty ActionBar / `notConfigured` card. Public confirm needs `public_web`. Binding only `mobile` is not a substitute for the dashboard.

### 2.9 Gate (`gate_code`)

A check evaluated **inside** the command transaction against locked order facts (`rack_required`, `fin_release_eligible`, `delivery_stop_active`, …). Not a screen setting. Not a silent money/status rewrite. Detail: [05](../05_Business_Rules_and_Gates.md).

### 2.10 Module-status membership

| | |
|--|--|
| **What** | “Module M may see / own status S.” |
| **`visibility_mode`** | `owner` — this module is the primary owner of that status (and may execute ordinary commands from it). `observer` — show on worklist / card. Observer **membership** is not a general execute grant. |
| **Exception** | Fulfilment only: `pickup_handover` stays `primary_owner` of `ready_for_pickup`. It may **observe** status `ready` so a declared `CONFIRM_PICKUP` edge from `ready` → `delivered` can run. That is observer **membership on a status**, not `module_mode = observer`. Observing `ready` does **not** move ownership of `ready` off `ready_release`. `module_mode = observer` (Workboard) still cannot execute. |

### 2.11 Initial rule

Matcher that chooses the order’s **first** `current_status` at create (source, retail, quick drop, remote, …). Unmatched create → `PROFILE_INITIAL_RULE_UNMATCHED`. Assignment (which profile) is a different step.

### 2.12 Profile stack

| Entity | Meaning |
|--------|---------|
| **Profile** | Named HQ policy product (`sys_wf_profiles_cd`). |
| **Profile version** | Draft/Pilot/Published revision (`sys_wf_profile_ver_mst`). Pilot is editable only for test/demo tenants; Published is immutable. |
| **Policy / live rows** | Modules, memberships, executions/channels/gates, initial rules, evidence, and switches used directly by runtime. |
| **Validation** | HQ `WorkflowPolicyValidator` (detailed Check policy) plus the DB relational guard; neither creates a runtime artifact. Tenant `WorkflowPolicyResolver` loads the bound version’s live rows; it does not validate Studio. |
| **Assignment** | Which tenant / branch / service uses which version. Affects **new** orders only. |
| **Order binding** | `wf_profile_id`, `wf_profile_version_id`, and `wf_version_no` on `org_orders_mst`. Existing orders retain this direct binding when assignment changes. |

### 2.13 UI chrome (not policy)

| Surface | What it is | What it is not |
|---------|------------|----------------|
| **Sidebar nav** | RBAC dual-write (`navigation.ts` + `sys_components_cd`). | Profile module On/Off. |
| **`WorkflowActionBar`** | Generic command list for `useWorkflowActions(orderId, screenKey)`. | The only way to run a command. |
| **Stage card** | Dedicated pickup / delivery confirm UI that calls a **stage-owned API** (`PickupCompletionService`, delivery complete). | A second engine. Same engine, fixed `screen`. |
| **Workboard** | Supervisor queue page. Observer only. | A stage that completes work. |
| **Empty / `notConfigured`** | Policy missing exec, channel, or module. | “Build a new page.” |

Ready Details **hides** `RELEASE_FOR_PICKUP` from the ActionBar because `ReadyFulfilmentPanel` owns that command. Delivery Details **hides** generic `CONFIRM_DELIVERY` because the delivery card / complete API owns it.

---

## 3. Screen → page → typical owner status → typical actions

| `screen_key` | Tenant page (V1.0) | Typical owned statuses | Typical staff actions | Notes |
|--------------|--------------------|------------------------|------------------------|-------|
| `new_order` | `/dashboard/orders/new` | `draft`, `intake` | Intake / send to plant | Create + POS |
| `preparation` | `/dashboard/preparation` | `preparing` | `COMPLETE_PREPARATION` | Optional; skip if Off |
| `processing` | `/dashboard/processing` | `processing` | `COMPLETE_PROCESSING` | Core plant |
| `assembly` | `/dashboard/assembly` | `assembly` | `COMPLETE_ASSEMBLY` | Optional |
| `qa` | `/dashboard/qa` | `qa` | `PASS_QA`, `FAIL_QA` | Optional |
| `packing` | `/dashboard/packing` | `packing` | `COMPLETE_PACKING` | Optional |
| `ready_release` | `/dashboard/ready` | `ready` | `RELEASE_FOR_PICKUP`, `RELEASE_FOR_DELIVERY` | **Does not** confirm handover |
| `pickup_handover` | **No URL.** Card on Ready Details. List alias: `/dashboard/ready?focus=counter` (both Ready-area handover statuses unless `staged` / `unreleased` narrows) | `ready_for_pickup` (owner); `ready` (observe, direct only) | `CONFIRM_PICKUP` | Embedded by design |
| `driver_delivery` | `/dashboard/delivery` | `out_for_delivery` | Staff `CONFIRM_DELIVERY` | Card + complete API |
| `workboard` | `/dashboard/workboard` | Observes plant/ready | **None** | Must stay `observer` |
| `public_tracking` | `/track/{token}` | Observes fulfilment statuses | Public `CONFIRM_DELIVERY` (`public_web`); pickup adapter may call pickup **service** | Not a staff floor |
| `canceling` | No dedicated floor page | Cross-cutting | `CANCEL_ORDER` | Commands on the order |
| `order_control` | No dedicated floor page (V1.1 Should) | Cross-cutting | `HOLD_*` / `RESUME_*` / `STOP_*` | Optional module |
| `returning` | None until V1.1 | — | `RETURN_ORDER` | Keep Off |

---

## 4. How the pieces attach at runtime

```text
Order (current_status, state_version, wf_profile_id, wf_profile_version_id, wf_version_no)
        │
        ▼
Caller picks a SCREEN_KEY + CHANNEL
  • ActionBar(screen="ready_release") + staff_web
  • PickupHandoverCard → screen="pickup_handover" + staff_web
  • Delivery complete → screen="driver_delivery" + staff_web
  • /track confirm OFD → screen="public_tracking" + public_web
        │
        ▼
listAvailableActions / executeAction
  • module enabled?
  • module_mode allows execute?
  • membership for from_status?
  • execution row for screen + action + from → to?
  • channel bound?
  • gates pass?
        │
        ▼
Engine writes current_status + history + outbox
```

If HQ binds `CONFIRM_PICKUP` on `ready_release`, the pickup card still queries `pickup_handover` → **not configured**. The pickup API still executes `pickup_handover` → **fail closed**. The Ready ActionBar might show a leftover button that **skips** pickup completion. That is why “wrong module” is not the same as “wrong page”.

---

## 5. Worked examples

### 5.1 Counter pickup (the mix-up that motivated this file)

**Shop:** processing + make available + confirm at counter. No driver.

| Layer | Value |
|-------|--------|
| Pages staff use | `/dashboard/processing`, `/dashboard/ready` |
| Modules On | `processing`, `ready_release`, `pickup_handover` (`staff_web`) |
| Status path | `processing` → `ready` → (`ready_for_pickup`) → `delivered` |
| Ready page, release | Execution: `ready_release` + `RELEASE_FOR_PICKUP` |
| Ready page, confirm card | Execution: `pickup_handover` + `CONFIRM_PICKUP` |

**Direct counter** (customer already at the desk, no shelf wait): `CONFIRM_PICKUP`
from `ready` → `delivered`, still on `pickup_handover`, with pickup **observing**
`ready`. Do **not** move that execution onto `ready_release`. The direct-policy
validator has a narrow fulfilment exception for this declared observation; the
tenant runtime does not grant general observer execution.

**Illegal Studio combo:** `pickup_handover` On, `ready_release` Off. There is no host page for the card and no release owner.

### 5.2 Simple driver delivery (no stop)

| Layer | Value |
|-------|--------|
| Pages | `/dashboard/ready`, `/dashboard/delivery` |
| Modules | `ready_release` + `driver_delivery` |
| Ready | `RELEASE_FOR_DELIVERY` (`ready` → `out_for_delivery`) |
| Delivery card | Staff `CONFIRM_DELIVERY` on `driver_delivery` + `staff_web` |
| Do not bind | `delivery_stop_active` |

Pickup may be Off. Public tracking is optional and separate.

### 5.3 Public confirm

`/track/{token}` is the **page**. `public_tracking` is the **module**.

| Order status | What `/track` does | Policy needed |
|--------------|-------------------|---------------|
| `ready` | Reject (`PICKUP_RELEASE_REQUIRED`) | Public cannot direct-handover |
| `ready_for_pickup` | Calls **pickup complete service** (still `CONFIRM_PICKUP` / `pickup_handover`) | Ready + `RELEASE_FOR_PICKUP` + pickup module. Do **not** bind `CONFIRM_PICKUP` onto `public_tracking` |
| `out_for_delivery` | `executeAction` `CONFIRM_DELIVERY` on `public_tracking` + `public_web` | Ready + `RELEASE_FOR_DELIVERY` + that public execution |

Same customer button, two different owners depending on status.

### 5.4 QA Off in a full-floor sequence

| Layer | Value |
|-------|--------|
| Page | `/dashboard/qa` still in nav |
| Module | `qa` Off |
| Required | Skip execution from previous owner (`processing` or `assembly`) to the next **enabled** owner — exactly one destination |
| If missing | Order can land on unowned `qa` and nobody can leave |

---

## 6. Mix-up table (say X, people hear Y)

| If someone says | They often mean (wrong) | Use instead |
|-----------------|-------------------------|-------------|
| “Ready screen” | Status `ready`, or the pickup card | Page `/dashboard/ready` **or** module `ready_release` — pick one |
| “Pickup screen” | `/dashboard/pickup` | Module `pickup_handover`; UI is a **card** on Ready Details |
| “Turn on pickup” | A new dashboard route | Enable module + `CONFIRM_PICKUP` + `staff_web` **and** keep `ready_release` On |
| “Put Confirm pickup on Ready” | Bind executable to `ready_release` | Mount the card on the Ready **page**; keep `screen_key = pickup_handover` |
| “Empty ActionBar” | Policy is fine, UI bug | Missing exec, missing `staff_web`, observer module, or the command lives on a **card** |
| “Public tracking” | Staff floor | Customer **page** `/track/{token}` + module `public_tracking` |
| “Delivery confirm” | One binding | Staff: `driver_delivery`. Public OFD: `public_tracking`. Never Ready/pickup |
| “Workboard stage” | A plant owner | Observer queue only |
| “Reassign profile” | Move in-flight QA orders | New orders only; the order’s `wf_profile_id` / `wf_profile_version_id` / `wf_version_no` binding stays |

---

## 7. Ownership vs host (cheat sheet)

| Command | Must be bound on module | May appear on page |
|---------|-------------------------|-------------------|
| `RELEASE_FOR_PICKUP` / `RELEASE_FOR_DELIVERY` | `ready_release` | `/dashboard/ready` |
| `CONFIRM_PICKUP` | `pickup_handover` | Same Ready Details page (card) |
| Staff `CONFIRM_DELIVERY` | `driver_delivery` | `/dashboard/delivery/{id}` (card) |
| Public `CONFIRM_DELIVERY` (OFD) | `public_tracking` | `/track/{token}` |
| `COMPLETE_PROCESSING` | `processing` | `/dashboard/processing` |
| `CANCEL_ORDER` | `canceling` | Order surfaces, not a plant stage page |
| Workboard commands | **Forbidden** | `/dashboard/workboard` is read-only |

---

## 8. Related code (tenant)

| Concern | Where |
|---------|--------|
| Catalog screen keys (floor list) | `web-admin/lib/constants/workflow-screens.ts` |
| Action codes | `web-admin/lib/constants/workflow-actions.ts` |
| Leave-action defaults | `web-admin/lib/constants/workflow-leave-actions.ts` |
| Direct policy resolver | **Target (ADR-0010):** `web-admin/lib/services/workflow/workflow-policy-resolver.service.ts`. Until cutover, semantic orders still load the compiled artifact via `semantic-workflow-artifact.service.ts`. |
| Pickup card screen | `web-admin/src/features/pickup/hooks/use-pickup-handover.ts` (`pickup_handover`) |
| Ready release actions | `web-admin/src/features/pickup/ui/ready-fulfilment-panel.tsx` (`ready_release`) |
| Pickup execute | `web-admin/lib/services/pickup/pickup-completion.service.ts` |
| Public confirm | `web-admin/lib/services/public-order-tracking.service.ts` |
| Catalog seed | `supabase/migrations/0427_sys_wf_catalogs_and_state_version.sql` (+ `0436` `order_control`, `0437` `public_tracking`, `0446` `pickup_handover`) |

HQ Studio: `cleanmatexsaas` `WorkflowPolicyValidator` and Module coverage UI. Do not implement Studio in this repo.

---

## 9. Related docs

- Validation situations: [01_HQ_STUDIO_VALIDATION_GAPS.md](01_HQ_STUDIO_VALIDATION_GAPS.md)
- Issue codes: [02_HQ_STUDIO_ISSUE_CODE_SPEC.md](02_HQ_STUDIO_ISSUE_CODE_SPEC.md)
- Version plan (includes page table): [03_VERSIONED_REMAINING_WORK_PLAN.md](03_VERSIONED_REMAINING_WORK_PLAN.md) §8
- Status / action / transition codes: [04_Status_and_Vocabulary.md](../04_Status_and_Vocabulary.md)
- Floor UX: [08_UI_UX_Screens.md](../08_UI_UX_Screens.md)
- Live resolver contract: [LIVE_NORMALIZED_PROFILE_RUNTIME.md](../LIVE_NORMALIZED_PROFILE_RUNTIME.md)
- HQ matrix: `cleanmatexsaas` `.../Workflow_Engine_HQ/profile_policy_coverage_matrix.md`
