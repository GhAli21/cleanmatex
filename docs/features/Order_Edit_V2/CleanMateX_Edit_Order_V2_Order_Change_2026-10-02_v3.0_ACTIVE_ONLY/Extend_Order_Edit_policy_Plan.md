# Extend Order Edit Policy — Comprehensive Resolution Plan

**Status:** Confirmed 2026-10-23. Phase 1 migration `0637_edit_policy_resolution_scopes.sql` was applied locally and remotely by the user; both repositories' types were regenerated and Prisma was updated. Phase 2 tenant resolver, context, capability, Preview, Apply snapshots and tenant UI are complete and validated. Phase 1 retains its remaining section 17 acceptance items. Phases 3–5 have not started.
**Date:** 2026-10-17
**Place in the pack:** Additional plan inside the active Edit Order V2 v3.0 pack. It does not replace that pack.
**Authority of this file:** Edit Policy configuration and resolution, and every Order Change surface this file changes so that resolution is the one Preview and Apply enforce. That includes the SQL resolver, the tenant resolver, order context, capability, Preview, the review-proof digest, the Apply writer’s before and after values, the review screen, the operation catalog, and HQ authoring. Both repositories implement those changes from this file. `WP05-B_HQ_PROGRESS.md` points here for this extension and keeps the completed WP05-B record.
**Authority of the main plan:** `Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md` remains the living sequence and progress ledger for WP01–WP20. Commitment, calculation, tax, payments, refunds, credits, the 300-second review-proof lifetime, Apply transaction rules this file does not name, and cutover stay with that plan. A change this file makes inside a WP05, WP10, WP11, WP12, WP14, WP15, or WP17 file is specified here and recorded on that package’s ledger row.
**Product name:** Edit Policy / سياسة التعديل. Screen copy says Organization / المنشأة. The database identifier stays `tenant_org_id`.
**Names:** HQ is the usual name for the SaaS Backoffice in `cleanmatexsaas`. Platform, platform level, Platform HQ Console, and SaaS Backoffice Admin and Management mean HQ. Organization app means `cleanmatex`. Tenant app, client app, and Tenant-Facing Application mean that app. The customer business is the Organization / المنشأة, and the database identifier stays `tenant_org_id`. Existing file and code identifiers that already contain HQ stay as they are, including `WP05-B_HQ_PROGRESS.md` and `HQ_RBAC_ENFORCEMENT_ENABLED`.
**Execution status:** `Extend_Order_Edit_policy_STATUS.md` in this folder. Every keep-or-improve decision is recorded there.

---

## Integration with the main plan

This plan changes the Order Change path where Edit Policy is loaded, checked, shown, and stored. The main plan keeps the package numbers and the behavior this file does not name.

| This plan changes | Main-plan package | What changes |
|---|---|---|
| Policy tables, default, override scopes, catalog seed | WP05 | New migration. The current version-only assignment stops being the resolver |
| Tenant resolver and capability | WP05 | One SQL function. A missing rule denies, including `CHANGE_UNLISTED`. An unshipped writer stays closed |
| Order context | WP04 loader, WP05 | The edit screen loads the same policy Preview will enforce |
| Preview | WP10 | Re-resolves. Returns the before and after objects in section 5C. Adds their digest to the review proof |
| Apply writer | WP11, WP12, WP15, WP17 | Re-resolves immediately before mutation. Stores the before and after objects in section 5B for operations whose writers already exist |
| Review dialog and policy panel | WP14, WP15 | Same dialog. The operation row shows the name and the before and after line. The panel shows which level won |
| HQ API and Studio | WP05-B | Defaults, override scopes, and effective preview call the same SQL function |

Phase 2 carries the tenant resolver, Preview, and Apply writer together. A new resolver with the old Preview or the old writer is a gap. Phases 3 and 4 carry HQ. Phase 5 proves the tenant path and the Studio preview return the same level and the same decision.

Closing a phase updates `Extend_Order_Edit_policy_STATUS.md` and the touched rows in `Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md`. The package number stays. This plan does not add WP21, and it does not move WP18, WP19, or WP20.

Calculation, tax, payment, refund, credit, commitment, and cutover stay on their current packages. This plan calls those services. It does not replace them.

---

## Execution rule — existing code

This rule applies to every code change made while executing this plan: UI, UX, frontend, backend, API, service, resolver, writer, preview, database, translation, and tests.

Before replacing an existing implementation with the shape this plan describes, compare them. When the code already in the repository is better, do one of these and do not do both:

1. **Improve it.** Change the existing implementation so the result is better than the current code and better than the plan's suggestion. Keep its structure, names, and behavior that are already right.
2. **Keep it.** Leave the existing implementation in place. Do not rewrite it to match a weaker suggestion in this plan.

Then update this plan so it describes the chosen result, and add a row to `Extend_Order_Edit_policy_STATUS.md` with the date, the area, which option was chosen, and what changed in the plan.

A suggestion in this plan is not a reason to discard a better screen, service, or query. The locked resolution order, the fail-closed rules, tenant isolation, and the before/after value contract stay in force. This rule chooses the better implementation of those contracts. It does not drop them.

## Implementation rule — complete the feature in every required area

When implementing any feature from this plan, finish every related area that feature needs before calling it done. A database change without the API that writes it, or a screen without the service behind it, is not a finished feature.

Cover each area that applies:

- database: tables, constraints, functions, grants, comments, and the migration
- backend and services
- APIs, endpoints, and their request and response contracts
- frontend, pages, screens, and UI behavior, including loading, empty, error, and success states
- English and Arabic copy
- tests for the behavior that changed
- documentation for the feature, including this plan and `Extend_Order_Edit_policy_STATUS.md`

Do this in both repositories when the feature needs both. `cleanmatex` carries the shared database, the SQL resolver, and the tenant runtime. `cleanmatexsaas` carries HQ authoring. A feature that changes what HQ saves and what the tenant resolves is done only when both sides agree. A feature that belongs in one repository is not copied into the other.

The feature is production-ready only when those areas are present, consistent, and free of a known gap, bug, or missing piece. Record each completed area, and any area verified and left unchanged, in `Extend_Order_Edit_policy_STATUS.md`.

## Implementation rule — project instructions

While implementing this plan, follow the `CLAUDE.md` of the repository being edited. `cleanmatex/CLAUDE.md` governs the shared migration and the tenant app. `cleanmatexsaas/CLAUDE.md` governs HQ. Load every skill that file requires before the first edit in that area, and use the agents, rules, and docs it names. Do not skip them because this plan already describes the change.

## Implementation rule — separation of concerns

Keep Edit Policy resolution apart from Order Change domain logic. Calculation, tax, payment, refund, credit, and workflow movement stay in their own services. This plan calls those services. It does not copy their rules into the policy resolver, the HQ controller, or a screen.

Reusable UI and shared validation stay domain-agnostic. They do not contain Edit Policy decisions, organization names, or order-status lists. The Edit Policy module owns those decisions and passes plain values into the shared piece.

Each module keeps its own services and its own folder. Tenant resolution stays in `web-admin/lib/services/order-change/`. HQ authoring stays in `platform-api/src/modules/workflow-engine-config/edit-policy/` and `platform-web/src/features/workflow-engine-config/`. A route, a page, or another domain calls those services. It does not grow a second copy of the query or the matrix rules.

## Implementation rule — reusable UI and validation

Before adding UI or validation, search the shared components and shared validators. Use the one that already exists. In `web-admin`, use Cmx components from `src/ui/`. In `platform-web`, use Cmx components from `src/ui/`. Use `cmxMessage` or `useMessage()` for applicable feedback.

When the needed piece will be reused and no shared component has it, add that behavior to the shared component, or add a new shared component, and keep the change backward compatible. A control used once on the Edit Policy tab stays in that feature. A control that a second screen will need becomes shared before the second copy is written.

## Tasks after every phase

Close a phase only after these tasks. The status file is `Extend_Order_Edit_policy_STATUS.md`.

1. Update the phase row in that file to the real result: done, partial, or blocked, with the date and what landed.
2. Update the status line of this plan to the phase just closed. Do not mark a phase done because the code compiled.
3. Add a row for any keep-or-improve choice made in that phase.
4. Refresh, create, or update the documentation that phase changed. Leave historical WP reports and tester result rows unchanged. Record the doc files touched in the status file.
5. Update the touched rows in `Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md`. Phase 1 and Phase 2 update the WP05 row and, when Preview or Apply changed, the WP10, WP11, WP12, WP15, and WP17 rows. Phases 3 and 4 update the WP05-B pointer. Keep each package number.

| Phase | Documentation to refresh before the phase is closed |
|---|---|
| 1 Database | This plan's Phase 1 notes, the migration filename, and `WP05-B_HQ_PROGRESS.md` with that filename once the migration file exists |
| 2 Tenant resolver | This plan's resolver section and the tenant developer notes that describe how an order resolves its Edit Policy |
| 3 HQ API | This plan's API section and the HQ pointer. Request and response examples match the code |
| 4 HQ screens | This plan's screen section and the Studio copy keys actually added |
| 5 Proof | The manual-check result in the status file, then the final documentation task below |

## Final task — generate the extension docs

After Phase 5, and only after the manual check in section 11.4, load the documentation skill and generate or update every doc this extension needs.

- In `cleanmatex`, load `.claude/skills/documentation/SKILL.md`. Update the active Edit Order V2 v3.0 pack for the Edit Policy extension only. Do not replace Order Change documents this plan does not change.
- In `cleanmatexsaas`, load `.claude/skills/documentation/SKILL.md` and `.claude/skills/create-feature-documentation/SKILL.md`. Update `docs/features/Order_Edit_V2/WP05-B_HQ_PROGRESS.md` and any HQ doc that describes Edit Policy authoring. Do not copy this plan into that repository.
- Write from the code that shipped. Mark anything not built as pending. Do not invent routes, permissions, or migration names.
- When the skill's pack list asks for a file the v3.0 pack already has, update that file. Do not create a second folder for the same extension.
- Record the generated and updated files in `Extend_Order_Edit_policy_STATUS.md`.

## Edit Policy extension across both repositories

This section lists the Edit Policy work in `cleanmatex` and `cleanmatexsaas`. It is not an Order Change plan. A phase of this extension is not finished while any row below is still open. "Open" means the file was neither updated for the Edit Policy change nor recorded in `Extend_Order_Edit_policy_STATUS.md` as verified and left unchanged. Both apps must agree on the same SQL function, the same catalog, and the same policy failure codes before the manual check in section 11.4.

`platform-workers` has no queue, job, or processor in this plan. No new permission, feature flag, navigation row, or billing change. No new tenant page and no new HQ page. The existing screens gain the behavior in the later sections.

### Shared database — `cleanmatex/supabase/migrations/`

| Object | This plan |
|---|---|
| New migration after the latest numbered file | Phase 1. Do not edit `0597`, `0599`, `0606`, or `0622` |
| `sys_wf_edit_policy_def_cf` | One published default per profile version |
| `org_wf_edit_policy_asg_cf` | Becomes the override table: `ORGANIZATION` or `PROFILE` |
| `sys_wf_resolve_edit_policy` | The only resolution order. Tenant and HQ both call it |
| Catalog guard and seed | Section 5A. Grammar freeze is dropped. New pairs are not backfilled as `ALLOW` |
| Grants and RLS | Section 15. `anon` and `authenticated` stay revoked |
| Prisma and HQ generated types | The user regenerates both after applying the migration. Section 6.15 |

### Tenant runtime — `cleanmatex/web-admin`

| Area | File | Required result |
|---|---|---|
| Resolver | `lib/services/order-change/order-change-edit-policy-resolver.service.ts` | Calls the SQL function. No TypeScript copy of the four levels |
| Order context | `lib/services/order-change/order-change-context.service.ts` | Same policy Preview will enforce. Passes profile id and version id from the order |
| Capability | `lib/services/order-change/order-change-capability.service.ts` | Missing rule denies, including `CHANGE_UNLISTED`. Unshipped writer stays closed with `OPERATION_NOT_AVAILABLE` |
| Local UX | `src/features/orders/order-change/edit-control-capability.ts`, `use-edit-control-capability.ts` | Uses the policy already loaded. Does not call the server on each click |
| Preview reads | `lib/services/order-change/order-change-preview-reads.ts` | Still the only read path into the resolver |
| Preview | `lib/services/order-change/order-change-preview.service.ts` | Re-resolves. Returns the same before/after objects Apply will store. Adds the snapshot digest to the review proof |
| Review proof | `order-change-capability.service.ts` signer | Domain and 300-second lifetime stay. Digest of code, sequence, before, and after is added |
| Apply | `lib/services/order-change/order-change-apply.service.ts` and `order-change-mutation.service.ts` | Re-resolves immediately before mutation. Writes section 5B before/after for shipped operations |
| Context route | `app/api/v1/orders/[id]/change-context/route.ts` | Returns `resolutionLevel` and `denyReason` from context. No second policy query |
| Preview route | `app/api/v1/orders/[id]/changes/preview/route.ts` | Stays a thin route over the preview service |
| Apply route | `app/api/v1/orders/[id]/changes/route.ts` | Stays a thin route over Apply. No policy logic in the route |
| Follow-up route | `app/api/v1/orders/[id]/changes/follow-up/route.ts` | Unchanged. Payment, refund, and credit stay outside the matrix |
| Edit page | `app/dashboard/orders/[id]/edit/page.tsx` through `edit-order-page-gate.tsx` and `edit-shared-workspace.tsx` | Same page. Policy source line and improved review rows only |
| Policy panel | `edit-policy-info.ts`, `edit-policy-info-button.tsx`, `edit-policy-info-dialog.tsx` | Shows Organization override, profile override, version default, or deny |
| Control notice | `edit-control-notice.tsx` | Operation names for every seeded code, including codes whose writer is not shipped |
| Review | `edit-review-dialog.tsx`, `edit-review-view.ts`, `edit-review-changes.tsx` | Keep the dialog. Improve the operation row. Section 5C |
| Builder | `change-builder.ts`, `edit-workspace-adapter.ts`, `lib/constants/order-change.ts` | A new code is emitted only when its writer is shipped. Until then the control stays closed and the field does not fall through to `CHANGE_UNLISTED` |
| Types | `lib/types/order-change.ts` | Binding and context types carry the resolution level and deny reason |
| Copy | `messages/en/orders/edit.json`, `messages/ar/orders/edit.json` | Section 10, both languages, after a search for an existing key |
| Tests | Resolver, capability, preview, and apply Jest files already beside these services | Section 7.4 and the preview digest. One database test only after the user applies the migration |

### HQ — `cleanmatexsaas`

| Area | File | Required result |
|---|---|---|
| Module | `platform-api/.../workflow-engine-config.module.ts` | Same module. No second Edit Policy module |
| Controller | `edit-policy.controller.ts` | Existing routes stay. Defaults are added under the same controller. Section 8 |
| Service | `edit-policy.service.ts` | Effective preview calls `sys_wf_resolve_edit_policy`. Promotion no longer requires the authored-against version to be fully covered |
| Repository | `edit-policy.repository.ts` | Default and override queries. `listLiveAssignmentPolicyIds(tenant, version)` leaves the preview path |
| DTO and types | `edit-policy.dto.ts`, `edit-policy.types.ts` | Optional authored-against version. Scope, profile id, gap acknowledgement, resolution level |
| Errors | `edit-policy.errors.ts` | Section 13 HQ codes |
| Rules | `edit-policy.rules.ts` | Matrix shape stays. Version coverage is required only when saving a default |
| Permissions | `edit-policy.permissions.ts` | The four existing codes. No new permission |
| Check | `POST .../edit-policies/:id/check` | A reusable policy with a null authored-against version does not fail because statuses cannot be loaded. When the caller passes `workflow_profile_version_id`, the response is the coverage of that version. Structural problems still fail |
| Simulate | `POST .../edit-policies/:id/simulate` | One cell on that policy. It is not a second resolver and it does not look at overrides or defaults |
| Client | `platform-web/lib/api/workflow-engine-config.ts` | `editPolicies` gains defaults, scope on assign, and the new preview fields. Assignment list stops requiring a profile version |
| Hook | `platform-web/src/features/workflow-engine-config/hooks/use-edit-policy.ts` | Loads defaults and both override scopes for the selected organization |
| Screens | `wf-edit-policy-panel.tsx`, `wf-edit-policy-matrix.tsx` | Five sections in section 9, on the existing Edit Policy tab |
| Studio page | `platform-web/app/workflow-engine-config/profiles/[id]/versions/[versionNo]/studio/page.tsx` | Hosts the tab. No new route and no new tab |
| Smart fill | `edit-policy-smart-fill.ts` and its Jest file | Stays a proposal. It does not write the default table. New money and payment codes are proposed `DENY` |
| Copy | `platform-web/messages/en.json`, `platform-web/messages/ar.json` | Section 10 under `editPolicy`, both languages |
| Types | `platform-api/src/database/database.types.ts` and the web generated types | Regenerated by the user after the migration is applied |
| Tests | `edit-policy.service.spec.ts`, `edit-policy.rules.spec.ts` | Section 8.6 |
| Progress pointer | `docs/features/Order_Edit_V2/WP05-B_HQ_PROGRESS.md` | Points at this file. It does not grow a second specification |

### Endpoints that must move together

| Caller | Endpoint | Resolver |
|---|---|---|
| Edit Order page | `GET /api/v1/orders/:id/change-context` | SQL function, through the context service |
| Review | `POST /api/v1/orders/:id/changes/preview` | SQL function, through the preview service |
| Apply | `POST /api/v1/orders/:id/changes` | SQL function again, immediately before mutation |
| Studio effective preview | `POST /workflow-engine-config/edit-policies/effective-preview` | Same SQL function |
| Studio defaults | `GET` and `POST /workflow-engine-config/edit-policies/defaults`, `PATCH /workflow-engine-config/edit-policies/defaults/:defaultId` | Writes `sys_wf_edit_policy_def_cf`. Does not resolve an order |
| Studio overrides | `GET`, `POST`, and `PATCH /workflow-engine-config/edit-policies/assignments` | Writes `org_wf_edit_policy_asg_cf` |

Catalog, get, create, clone, matrix save, lifecycle, audit, check, and simulate stay on `workflow-engine-config/edit-policies`. Their permission gates stay the table in section 8.1.

### Done means both sides

HQ can show a default that the tenant still resolves with the old version join, or the tenant can resolve a default the Studio cannot set. Either state is a gap in this extension. Phase 5 of this plan is the first phase that may be called done, and only after section 11.4 shows the same Edit Policy level and the same decision in both running apps. That does not close an Order Change work package.

## 1. Goal

An organization must be able to change its workflow profile without being forced to change its Edit Policy, and a profile version must be able to carry a published default for every organization that has no override.

Workflow profile and Edit Policy stay separate domains.

| Domain | Question it answers | Physical owner |
|---|---|---|
| Workflow profile | Which statuses can this order occupy, and how does it move? | `sys_wf_profiles_cd`, `sys_wf_profile_ver_mst`, `org_wf_profile_assign_cf` |
| Edit Policy | While the order sits in a status, which edit operation is allowed? | `sys_wf_edit_policy_mst`, `sys_wf_edit_policy_rule_dtl` |

They meet only at the status code. `processing` is a status. The profile decides whether an order can be in `processing`. The Edit Policy decides whether an item can be added there.

A policy can only make an operation stricter. It never bypasses:

- tenant isolation
- a missing `orders:edit` permission
- an uncommitted order
- the Order Change feature being off
- edit-access lock
- currency unresolved
- the locked customer snapshot
- a posted tax document
- payment, refund, or credit collected after Review
- direct table changes around Apply

Those stays in the tenant capability and Apply gates. A cell cannot allow them.

## 2. Current behavior this plan replaces

Today, from migration `0597` and the tenant resolver:

- `sys_wf_edit_policy_mst.workflow_profile_version_id` is `NOT NULL`.
- `uq_wf_edit_policy_ver` is `UNIQUE (id, workflow_profile_version_id)`.
- `org_wf_edit_policy_asg_cf` stores `tenant_org_id` + `workflow_profile_version_id` + `edit_policy_id`.
- `fk_wf_edit_asg_policy` requires the assignment version to equal the policy header version.
- `uq_wf_edit_asg_active` allows one live assignment per organization and profile version.
- The rule guard rejects a status that is not active on that policy's profile version.
- The tenant resolver reads only the assignment for the order's profile version. Zero or many policy ids return no bindings. The capability layer then denies a catalog operation with `CAPABILITY_POLICY_BINDING_MISSING`.
- HQ effective preview uses the same one-assignment lookup.
- There is no default. An organization with no assignment is denied.
- Draft starter policies seeded by `0597` are unassignable. This plan does not publish them and does not turn them into defaults.

That coupling is why one policy row authored for WF1 cannot stay in force when the organization moves to WF2, and why two organizations on the same version already can have different policies only by two assignment rows that both point at policies owned by that same version.

## 3. Locked resolution order

One resolver is used by tenant Preview, tenant Apply, the tenant order context, and the HQ effective preview. There is no second copy of the order in TypeScript.

1. Exactly one active override for this organization. Use it on every profile.
2. Otherwise, exactly one active override for this organization and this profile. Use it.
3. Otherwise, exactly one live default for this profile version pointing to a published Edit Policy. Use it. The workflow version may be Pilot or Published; the Edit Policy must be Published.
4. Otherwise, deny.

### 3.1 Level rules

| Condition at the level being tested | Result |
|---|---|
| Zero live rows | Fall through to the next level |
| Exactly one live row, and its policy is usable for that level | Stop. Return that policy and its live rules for the order status |
| Exactly one live row, and its policy is not usable | Stop. Return `DENY`. Do not fall through |
| Exactly one live row, usable policy, zero rules for this status | Stop. Return that policy id and revision with no rules. Operations deny. Do not fall through |
| Two or more live rows | Stop. Return `DENY`. Do not fall through |

Usable means:

| Level | Policy must be |
|---|---|
| Organization override | `PILOT` or `PUBLISHED`, `rec_status = 1`, `is_active = true` |
| Profile override | `PILOT` or `PUBLISHED`, `rec_status = 1`, `is_active = true` |
| Version default | `PUBLISHED` only, `rec_status = 1`, `is_active = true` |

`DRAFT` and `RETIRED` are never usable. A live link whose policy has been retired is a broken link. It denies. It does not reveal the next level. HQ deactivates that link before the next level can apply.

A null `profile_id` on the order skips level 2. A null `profile_version_id` skips level 3. Both still allow level 1. If level 1 also misses, the result is deny.

### 3.2 What "active" means

A link is live only when `rec_status = 1` and `is_active = true`. A rule is live only when `rec_status = 1` and `is_active = true`. Inactive rules are treated as missing.

### 3.3 Shadowing

While an organization override is active and usable, the profile override and the version default are not read. The profile override row stays stored. Studio shows it and marks it unused. Deactivating the organization override is what lets level 2 or level 3 apply on the next resolve.

### 3.4 Profile change

| Organization state before the change | After the organization moves from profile A to profile B |
|---|---|
| Live organization override | The same policy still wins. Statuses it does not name deny. Profile B's default is not read |
| No organization override, live override for profile A only | Profile A's override does not match. Profile B's published default wins, or the result is deny |
| No organization override, live override for profile B | That profile override wins on every version of profile B |
| No overrides | The published default of the order's new profile version wins, or the result is deny |

The order's stamped `wf_profile_id` and `wf_profile_version_id` are the inputs. The resolver does not look up a different profile than the one stored on the order.

### 3.5 Worked examples

| Case | Organization override | Profile override | Version default | Order | Winner |
|---|---|---|---|---|---|
| A | none | none | D1 published for WF1 v3 | WF1 v3, status `intake` | D1 |
| B | E-strict | E2 on WF1 | D1 for WF1 v3, D9 for WF2 v1 | any profile | E-strict |
| C | none | E2 on WF1 | D9 for WF2 v1 | WF1 v1 or WF1 v4 | E2 |
| D | none | E2 on WF1 | D9 published for WF2 v1 | WF2 v1 | D9 |
| E | none | E2 on WF1 | none for WF2 | WF2 v1 | deny |
| F | two live organization rows | anything | anything | anything | deny |
| G | E-strict, then the policy is retired and the link is still active | E2 | D1 | any | deny |
| H | none | none | D1, and `assembly` has no rule | WF1 v3, status `assembly` | D1's identity, and every operation at `assembly` denies |
| I | none | none | pilot policy marked default by a bad write | any | deny at level 3, then no further level |

Case B is the reason level 1 is first. Case D is the reason a profile override does not follow the organization onto another profile. Case H is the reason a winning policy with a hole does not fall through to another policy.

## 4. Target shape

| Piece | Physical object | Owns |
|---|---|---|
| Decision catalog | `sys_wf_edit_policy_mst`, `sys_wf_edit_policy_rule_dtl` | Name, lifecycle, revision, and the status × operation × target decision. Not owned by one profile version |
| Version default | New `sys_wf_edit_policy_def_cf` | One published policy for one profile version |
| Organization override | Existing `org_wf_edit_policy_asg_cf` | Scope `ORGANIZATION`, or scope `PROFILE` plus `workflow_profile_id` |

One policy row may be the default for several profile versions. One profile version has at most one live default. The same policy row may also be an override. The links decide where it applies.

Extra rules for statuses the version does not use are harmless. Missing rules for statuses the version does use block saving that version's default. They do not block saving the policy itself.

### 4.1 Identifier budget

PostgreSQL object names in this repository stay at or under 30 characters.

| Name | Length | Kind |
|---|---|---|
| `sys_wf_edit_policy_def_cf` | 25 | table |
| `sys_wf_resolve_edit_policy` | 26 | function |
| `sys_wf_edit_def_guard` | 20 | trigger function |
| `sys_wf_edit_cov_status` | 21 | coverage helper |
| `pk_wf_edit_def` | 14 | primary key |
| `fk_wf_edit_def_ver` | 18 | foreign key |
| `fk_wf_edit_def_pol` | 18 | foreign key |
| `uq_wf_edit_def_ver` | 18 | unique index |
| `ck_wf_edit_def_status` | 20 | check |
| `ck_wf_edit_asg_scope` | 20 | check |
| `fk_wf_edit_asg_prof` | 19 | foreign key |
| `fk_wf_edit_asg_pol` | 18 | foreign key, replaces the composite |
| `uq_wf_edit_asg_org` | 18 | unique index |
| `uq_wf_edit_asg_prof` | 19 | unique index |
| `idx_wf_edit_def_pol` | 19 | index |
| `trg_wf_edit_def_guard` | 20 | trigger |

## 5. What stays unchanged

- Decisions `ALLOW`, `ALLOW_WITH_WARNING`, `REQUIRE_OVERRIDE`, `DENY`.
- Rule tuple uniqueness `(edit_policy_id, workflow_status, operation_code, target_type)`.
- Override check: `REQUIRE_OVERRIDE` requires `requires_reason = true` and `override_permission_code`; every other decision requires `override_permission_code` NULL.
- Lifecycle `DRAFT → PILOT → PUBLISHED → RETIRED`, including the actor and timestamp evidence in `ck_wf_edit_pol_life`.
- Published and retired policies stay immutable. A matrix change still happens on Draft or Pilot and still increments `policy_revision`.
- Review proof domain `cleanmatex.order-change.review-proof.v1` and the 300-second lifetime. Policy id and revision stay inside the proof. The value-snapshot digest from section 5C is added to the signed binding. A different winning policy, a new revision, or a different before/after snapshot returns `POLICY_CHANGED_REVIEW_REQUIRED` or `REVIEW_CHANGED`.
- Historical migrations, including `0597`, `0599`, `0606`, and `0622`.
- Billing, plans, tenant role grants, feature flags, and navigation.
- HQ permissions: `workflows.view`, `workflows.edit_policy`, `workflows.edit_policy_promote`, `workflows.edit_policy_assign`.
- Browser and `anon` table grants. They stay revoked.
- The three-stage Order Change flow: local editing uses the policy already loaded; Preview re-resolves; Apply re-resolves immediately before mutation.

No new permission, feature flag, menu entry, or tenant authoring screen.

## 5A. Operation catalog — nothing is frozen

The V1 catalog is not a closed list. Migration `0597` seeded 13 operations and 15 pairs, then `trg_wf_edit_ops_grammar` and `trg_wf_edit_tgt_grammar` call `sys_wf_edit_grammar_guard`, which rejects every later insert, update, and delete. This plan removes that freeze and seeds every operation that create-order or the old edit-order screen can already express. The 15-pair baseline was verified read-only on `supabase_local` on 2026-10-23; no extra pair is invented to satisfy the earlier count of 16.

Sources checked for this list:

- `web-admin/lib/services/order-service.ts` — `CreateOrderParams`, `CreateOrderPieceData`, `updateOrder`
- `web-admin/lib/validations/edit-order-schemas.ts` — `updateOrderInputSchema`, `updateOrderItemSchema`, `updateOrderPieceSchema`
- `web-admin/lib/constants/order-change.ts` — `ORDER_CHANGE_OPERATION_CODES`
- `web-admin/src/features/orders/order-change/change-builder.ts`
- `web-admin/src/features/orders/order-change/edit-workspace-adapter.ts` — fields currently sent as `CHANGE_UNLISTED`

### 5A.1 Freeze removal

In the same new migration, before the seed:

1. `DROP TRIGGER trg_wf_edit_ops_grammar ON public.sys_wf_order_edit_ops_cd`
2. `DROP TRIGGER trg_wf_edit_tgt_grammar ON public.sys_wf_order_edit_op_tgt_cd`
3. `DROP FUNCTION public.sys_wf_edit_grammar_guard() RESTRICT`

Do not edit `0597`. Use `RESTRICT`. Do not use `CASCADE`.

Replace the freeze with `sys_wf_edit_catalog_guard`. It allows a later migration to add a row. It still rejects:

- a blank code or a code that is not `^[A-Z][A-Z0-9_]{2,63}$`
- a target type outside `ORDER`, `ITEM`, `PIECE`, `PREFERENCE`
- `DELETE` of an operation or a pair. Deactivate with `is_active = false` and `rec_status = 0`
- a change of `operation_code` after insert
- a change of a pair's `target_type` after insert; deactivate the old pair and insert its replacement
- a pair whose operation row does not exist

HQ does not invent executable codes from the browser. A new operation still arrives through a reviewed migration, together with its English and Arabic names. The difference is that the database no longer treats the first 13 codes as the permanent grammar.

`ck_wf_edit_op_tgt_type` stays limited to `ORDER`, `ITEM`, `PIECE`, and `PREFERENCE`. Every operation below fits one of those four. No fifth target type is added.

### 5A.2 Seed rules

- Insert the missing operations and pairs with `ON CONFLICT DO UPDATE` for `name`, `name2`, `description`, `description2`, and `is_active`, so a re-applied migration refreshes the label and does not create a second row.
- Leave the 13 existing operations and their existing pairs in place. Do not rename them.
- New rows use `created_info = 'Extend Order Edit Policy catalog'`.
- Every seeded pair is `is_active = true` and `rec_status = 1`.
- Do not backfill `ALLOW` rules onto existing policies. A policy that has no live rule for a new pair denies that pair. That keeps organizations that are fail-closed today fail-closed for the new operations.
- A version default still cannot be saved until the published policy has a live decision for every active catalog pair, including the new ones.
- Smart fill may propose a cell. It does not write the catalog and it does not write a default. For a money or payment operation the proposal is `DENY` until HQ chooses otherwise.

### 5A.3 Writer versus catalog

Seeding a code lets HQ decide it. It does not by itself perform the edit.

| Writer state | Runtime |
|---|---|
| Shipped | The policy cell is enforced. `DENY` and a missing cell stay closed. `ALLOW`, warning, and override follow the cell |
| Not shipped | The control stays closed, including when the cell says `ALLOW`. The reason shown to the operator is that this edit is not available yet. Apply rejects the code with `OPERATION_NOT_AVAILABLE` and writes nothing |

`NOT_IMPLEMENTED` must not open a control for a code in the "not shipped" column. That is a deliberate change from the older screen rule, and it applies to these new codes only.

`CHANGE_UNLISTED` is no longer a special allow. After this plan it is a normal catalog operation. No rule for it denies it, on every target. The capability branch in `order-change-capability.service.ts` that returns `ALLOW` / `NOT_IN_POLICY` when no binding exists is removed.

### 5A.4 Operations already seeded

These 13 codes and 15 pairs stay. Their current writers stay.

| Code | Target | Create / old edit source |
|---|---|---|
| `ADD_ITEM` | `ORDER` | Item added on create or on the old item-replacement edit |
| `REMOVE_ITEM` | `ITEM` | Item omitted from the old full item replacement |
| `CHANGE_ITEM_QUANTITY` | `ITEM` | `items[].quantity` |
| `ADD_PIECE` | `ITEM` | `items[].pieces[]` added |
| `REMOVE_PIECE` | `PIECE` | Piece omitted from the old piece list |
| `ADD_PREFERENCE` | `ORDER`, `ITEM`, `PIECE` | `orderServicePrefs`, item `servicePrefs`, piece `servicePrefs` |
| `CHANGE_PREFERENCE` | `PREFERENCE` | Change of a saved preference, including content |
| `REMOVE_PREFERENCE` | `PREFERENCE` | Preference removed |
| `CHANGE_PRIORITY` | `ORDER` | `priority` |
| `CHANGE_SERVICE_SPEED` | `ORDER` | Express / service speed. `express` itself is the separate code below |
| `CHANGE_READY_BY` | `ORDER` | `readyByAt` |
| `CHANGE_ORDER_NOTES` | `ORDER` | `notes` and `customerNotes` |
| `CHANGE_CUSTOMER_SNAPSHOT` | `ORDER` | `customerName`, `customerMobile`, `customerEmail`, `isDefaultCustomer`, `customerDetails` |

`CHANGE_CUSTOMER_SNAPSHOT` stays locked by the existing customer-snapshot rule when that lock applies. A policy cell cannot open it.

### 5A.5 Operations to seed

Names below are the catalog `name` / `name2`. The migration stores both.

#### Order

| Code | Target | English name | Arabic name | Source field | Writer in this plan |
|---|---|---|---|---|---|
| `CHANGE_CUSTOMER` | `ORDER` | Change Customer | تغيير العميل | `customerId` on create and old update | Not shipped. Distinct from the snapshot |
| `CHANGE_BRANCH` | `ORDER` | Change Branch | تغيير الفرع | `branchId` | Not shipped |
| `CHANGE_ORDER_TYPE` | `ORDER` | Change Order Type | تغيير نوع الطلب | `orderTypeId` on create | Not shipped |
| `CHANGE_EXPRESS` | `ORDER` | Change Express | تغيير المستعجل | `express` | Not shipped |
| `CHANGE_QUICK_DROP` | `ORDER` | Change Quick Drop | تغيير التسليم السريع | `isQuickDrop`, `quickDropQuantity` | Not shipped |
| `CHANGE_PAYMENT_NOTES` | `ORDER` | Change Payment Notes | تغيير ملاحظات الدفع | `paymentNotes` | Not shipped. Notes only. It does not collect or refund |
| `CHANGE_ORDER_SOURCE` | `ORDER` | Change Order Source | تغيير مصدر الطلب | `orderSourceCode` | Not shipped |
| `CHANGE_PHYSICAL_INTAKE` | `ORDER` | Change Physical Intake | تغيير الاستلام الفعلي | `physicalIntakeStatus`, `physicalIntakeInfo`, `receivedInfo` | Not shipped |
| `CHANGE_B2B_REFERENCE` | `ORDER` | Change B2B Reference | تغيير مرجع المنشأة التجارية | `b2bContractId`, `costCenterCode`, `poNumber` | Not shipped |
| `CHANGE_DISCOUNT` | `ORDER` | Change Discount | تغيير الخصم | `discountRate`, `discountType`, `promoCodeId`, `giftCardId`, promo and gift-card amounts | Not shipped. Money. Smart fill proposes `DENY`. No silent rewrite of a typed amount |
| `CHANGE_PAYMENT_TYPE` | `ORDER` | Change Payment Type | تغيير نوع الدفع | `paymentTypeCode` on create | Not shipped. Must not rewrite the payment type to unlock collection |

#### Preferences, not new operations

Packing, stain, damage, color, condition, and preference notes are rows in `org_order_preferences_dtl`. They are not their own Edit Policy operations. Add, change, and remove already govern them:

| Code | Targets |
|---|---|
| `ADD_PREFERENCE` | `ORDER`, `ITEM`, `PIECE` |
| `CHANGE_PREFERENCE` | `PREFERENCE` |
| `REMOVE_PREFERENCE` | `PREFERENCE` |

The preference kind travels in the payload as `preference_sys_kind`. It is not a new operation code. The stored kind values are:

| What the operator edits | `preference_sys_kind` |
|---|---|
| Service preference | `service_prefs` |
| Packing | `packing_prefs` |
| Stain | `condition_stain` |
| Damage | `condition_damag` |
| Other conditions (special, pattern, material) | `condition_special`, `condition_pattern`, `condition_material` |
| Color | `color` |
| Preference note | `note` |

`condition_damag` is the stored spelling. A policy cell does not get one row per kind. HQ allows or denies `ADD_PREFERENCE` on item or piece, and that decision covers packing, stain, damage, color, condition, and note together.

Columns such as `packing_pref_code`, piece `color`, and free-text piece or item `notes` are denormalized copies. The edit writes the preference row. It does not also emit `CHANGE_ITEM_PACKING`, `CHANGE_PIECE_COLOR`, `CHANGE_ITEM_STAIN`, or `CHANGE_PIECE_CONDITION`.

The extra charge on a preference row is part of that preference. It is not `CHANGE_ITEM_PRICE`.

#### Item

These govern a persisted item and are not preference rows. A brand-new line is still `ADD_ITEM`.

| Code | Target | English name | Arabic name | Source field | Writer in this plan |
|---|---|---|---|---|---|
| `CHANGE_ITEM_PRODUCT` | `ITEM` | Change Item Product | تغيير منتج الصنف | `productId` on the old full replacement | Not shipped |
| `CHANGE_ITEM_SERVICE` | `ITEM` | Change Item Service | تغيير خدمة الصنف | `serviceCategoryCode` | Not shipped |
| `CHANGE_ITEM_PRICE` | `ITEM` | Change Item Price | تغيير سعر الصنف | `pricePerUnit`, `priceOverride`, `overrideReason` | Not shipped. This is the item price, not a preference. Smart fill proposes `DENY` |

#### Piece

A brand-new piece is still `ADD_PIECE`. Brand and rack are piece identity and location columns on `org_order_item_pieces_dtl`. They are not kinds in `sys_preference_kind_cd`.

| Code | Target | English name | Arabic name | Source field | Writer in this plan |
|---|---|---|---|---|---|
| `CHANGE_PIECE_BRAND` | `PIECE` | Change Piece Brand | تغيير ماركة القطعة | `brand` | Not shipped |
| `CHANGE_PIECE_RACK` | `PIECE` | Change Piece Rack | تغيير رف القطعة | `rackLocation` | Not shipped |

#### General residual

| Code | Targets | English name | Arabic name | Writer in this plan |
|---|---|---|---|---|
| `CHANGE_UNLISTED` | `ORDER`, `ITEM`, `PIECE`, `PREFERENCE` | Change Other Field | تغيير حقل آخر | Catalog only. The change builder stops sending a known field from section 5A.5 as `CHANGE_UNLISTED`. An unknown field may still use this code, and only when the cell allows it |

Adapter fields that are preferences move onto `ADD_PREFERENCE`, `CHANGE_PREFERENCE`, or `REMOVE_PREFERENCE`: `item.packing`, `item.stain`, `item.stainNotes`, `item.damage`, `item.damageNotes`, `item.notes` when the note is kind `note`, `piece.color`, `piece.notes` when the note is kind `note`, `piece.conditions`, `piece.packing`, `piece.stain`, `piece.damage`, and `preference.code`. `item.priceOverride` and `item.overrideReason` move onto `CHANGE_ITEM_PRICE`. `piece.brand` moves onto `CHANGE_PIECE_BRAND`. Until that writer ships, the builder may keep emitting `CHANGE_UNLISTED`, and a missing rule denies it.

Clearing ready-by stays `CHANGE_READY_BY`. It is not a residual field.

### 5A.6 Not seeded as edit operations

These appear on create or on the old update input, and they are not Edit Policy operations:

| Input | Why it is not a catalog operation |
|---|---|
| `tenantId`, `userId`, `userName`, `idempotencyKey`, `expectedUpdatedAt`, `recalculate`, `editReason`, `supabaseClient`, `stockDeductionAudit` | Transport, audit, or concurrency. Not a business edit |
| `totals`, `currencyCode`, `currencyExRate` | Calculated or hard money identity. Policy cannot rewrite them |
| `creditLimitOverrideBy`, `creditLimitOverrideAt` | Credit override audit. Not an order-content edit |
| Payment, refund, and credit collection | Stay in their own flows. Apply does not collect |
| Posted tax document fields | Order Change does not edit the tax document |
| `initialWorkflowScreen` | Workflow placement, not an edit-policy cell |
| Lock and unlock payloads in `edit-order-schemas.ts` | Edit lock, not order content |

### 5A.7 Coverage count

After the seed, the live catalog size is:

- 13 existing operations, including the three preference operations
- 11 new order operations
- 3 new item operations: product, service, price
- 2 new piece operations: brand, rack
- `CHANGE_UNLISTED` on 4 targets

Pair count = 15 existing pairs + 11 + 3 + 2 + 4 = 35 live pairs (30 operations). The earlier 36-pair total was a counting error, corrected against migration `0597` and the read-only local catalog.

Packing, stain, damage, color, condition, and preference notes add no pairs. `sys_wf_edit_cov_status` uses whatever is live in `sys_wf_order_edit_op_tgt_cd` at call time. It does not hard-code 15 or 35. The old `0597` check `status_count * 15` is not repeated.

Existing Draft starter policies from `0597` stay as they are. They do not gain rows for the new pairs. They remain unassignable Drafts. They are not published and they are not defaults.

### 5A.8 Tenant and HQ follow-through

- `ORDER_CHANGE_OPERATION_CODES` gains every code in section 5A.5, including `CHANGE_UNLISTED` which is already in that list.
- The request schema accepts a new code only when its writer is shipped, or accepts it and Apply returns `OPERATION_NOT_AVAILABLE` before any write. Accept-and-reject is the required behavior so a forged body cannot take the old allow path.
- `edit-policy-info` and the HQ matrix load pairs from the catalog API. They do not keep a handwritten list of 13 codes as the source of the matrix.
- English and Arabic labels for the new codes go in the tenant `policyInfo.operations` object and in the HQ `editPolicy` messages. The database `name` / `name2` remain the source for HQ when the screen can read them.
- `order-change-capability.service.ts` deletes the `CHANGE_UNLISTED` allow-without-a-rule branch.
- Tests that expect `CHANGE_UNLISTED` to allow with `NOT_IN_POLICY` are updated to expect deny when no rule exists, and allow only when a live rule says allow.

## 5B. Tenant Apply writer — before values and after values

The policy resolver decides whether an operation may run. The Apply writer in `order-change-apply.service.ts` and `order-change-mutation.service.ts` is what stores the proof of what changed. Each applied operation inserts one row in `org_order_change_ops_dtl`. `before_values` and `after_values` are JSON objects. They are written once, under the order lock, and they are never updated.

The columns `order_item_id`, `order_item_piece_id`, `order_preference_id`, and `client_ref` are the identity. The JSON objects carry the values and the parent context. History reads the JSON. It does not read the live order row to reconstruct the old value.

### 5B.1 Rules for every operation

- Read the before row in the same transaction as the write, after `SELECT ... FOR UPDATE` on the order, and before the mutation. Filter every `org_*` read by `tenant_org_id` and `order_id`.
- `before_values` is the stored row at that moment. `after_values` is the stored row after the write, using the same keys. The request payload is not the after object when the stored result differs from what was typed.
- An add has no prior row. Its `before_values` is `{}`. Parent context goes in `after_values`.
- A remove keeps the full before snapshot. `after_values` repeats the identity and sets `recStatus` to `0`. It does not drop the old values.
- A change writes only that operation's keys, plus parent context, plus order money when the operation can change the total. Unchanged keys of the same operation stay in both objects so the history diff is honest.
- Money is a string with 4 decimal places (`"29.6700"`). A missing amount is `null`, not `0` and not an omitted key.
- A timestamp is UTC ISO-8601. A missing time is `null`.
- Booleans are `true` or `false`. A missing flag is `false` when the column is not nullable, and `null` when the column is nullable.
- Text is the stored value. An empty note is `""`. Do not trim inside the history object after the writer has already stored the trimmed value.
- If the target row is not active for this organization and order, Apply fails with `REMOVAL_NOT_ACTIVE` or `UPDATE_NOT_ACTIVE`. It does not write an empty before object for a change or a remove.
- Do not put tokens, passwords, or the review proof inside these objects.
- `CHANGE_CUSTOMER_SNAPSHOT` remains locked when the customer snapshot is locked. A policy cell cannot open it. When a future writer is allowed to change it, the keys below are the ones it stores.
- An operation whose writer is not shipped never reaches this insert. Apply returns `OPERATION_NOT_AVAILABLE` first.

Parent context keys, included whenever the fact has that parent:

| Key | When |
|---|---|
| `orderId` | Every after object, and every before object except an add |
| `orderItemId` | The fact is an item, a piece, or a preference on an item or a piece |
| `orderItemPieceId` | The fact is a piece, or a preference on a piece |
| `orderPreferenceId` | The fact is a preference that already has an id |
| `clientRef` | The fact was created in this Change and the client sent a reference |

Order money keys, included on every operation that can change the commercial total:

| Key | Meaning |
|---|---|
| `totalAmount` | `org_orders_mst.total_amount` at that moment |
| `taxAmount` | `org_orders_mst.total_tax_amount` at that moment |

Those two keys are in the before object from the locked order, and in the after object from the order after the commercial snapshot for this Change. They are omitted on a pure documentary change that cannot change money: notes, payment notes, source, physical intake, B2B reference, brand, and rack.

### 5B.2 Structural operations

`ADD_ITEM`. Before is `{}`. After:

| Key | Stored from |
|---|---|
| `orderId` | The order |
| `orderItemId` | The new item id |
| `clientRef` | The request reference |
| `productId` | The new item |
| `productName` | The new item |
| `productName2` | The new item |
| `quantity` | The new item |
| `pricePerUnit` | The new item, 4-dp text |
| `totalPrice` | The new item, 4-dp text |
| `priceOverride` | The new item, 4-dp text or `null` |
| `overrideReason` | The new item or `null` |
| `serviceCategoryCode` | The new item or `null` |
| `totalAmount`, `taxAmount` | The order after this Change |

Packing, stain, damage, color, condition, and notes added with that new item are separate `ADD_PREFERENCE` rows. They are not copied into the item object.

`REMOVE_ITEM`. Before and after both use the item snapshot. After sets `recStatus` to `0` and keeps every before key. Keys: `orderId`, `orderItemId`, `productId`, `productName`, `productName2`, `quantity`, `pricePerUnit`, `totalPrice`, `priceOverride`, `preferenceCharge`, `serviceCategoryCode`, `totalAmount`, `taxAmount`. Child pieces and preferences removed by the same item removal get their own operation rows when the writer emits them. The item row still holds the item snapshot.

`CHANGE_ITEM_QUANTITY`. Before and after: `orderId`, `orderItemId`, `productId`, `quantity`, `pricePerUnit`, `totalPrice`, `totalAmount`, `taxAmount`. `quantity` is the only business field that differs unless the price total changes with the quantity.

`ADD_PIECE`. Before is `{}`. After: `orderId`, `orderItemId`, `orderItemPieceId`, `clientRef`, `pieceSeq`, `quantity`, `pricePerUnit`, `totalPrice`, `pieceStatus`, `pieceStage`, `scanState`, `totalAmount`, `taxAmount`. Color, packing, stain, damage, condition, and notes on that new piece are `ADD_PREFERENCE` rows.

`REMOVE_PIECE`. Before and after: `orderId`, `orderItemId`, `orderItemPieceId`, `pieceSeq`, `quantity`, `pricePerUnit`, `totalPrice`, `pieceStatus`, `pieceStage`, `scanState`, `brand`, `totalAmount`, `taxAmount`. After sets `recStatus` to `0`.

### 5B.3 Preference operations

These three operations cover service preferences, packing, stain, damage, other conditions, color, and preference notes. `preferenceKind` is the stored `preference_sys_kind`.

`ADD_PREFERENCE`. Before is `{}`. After:

| Key | Stored from |
|---|---|
| `orderId` | The order |
| `orderPreferenceId` | The new preference id |
| `clientRef` | The request reference when the parent was also created in this Change |
| `level` | `ORDER`, `ITEM`, or `PIECE` |
| `orderItemId` | The parent item, or `null` for an order preference |
| `orderItemPieceId` | The parent piece, or `null` when the level is not `PIECE` |
| `preferenceId` | The catalog row id, or `null` |
| `preferenceCode` | The chosen code |
| `preferenceKind` | `service_prefs`, `packing_prefs`, `condition_stain`, `condition_damag`, `condition_special`, `condition_pattern`, `condition_material`, `color`, or `note` |
| `preferenceContent` | Note text or other content, or `null` |
| `extraPrice` | The preference charge, 4-dp text |
| `totalAmount`, `taxAmount` | The order after this Change |

`CHANGE_PREFERENCE`. Before and after use the same keys as the add, including `orderPreferenceId`. The keys that may differ are `preferenceId`, `preferenceCode`, `preferenceContent`, and `extraPrice`. `level` and the parent ids stay the same. Moving a preference to another parent is not this operation.

`REMOVE_PREFERENCE`. Before is the full preference snapshot, same keys as the add. After repeats those keys and sets `recStatus` to `0`.

### 5B.4 Order operations already shipped

| Operation | Before keys | After keys | Notes |
|---|---|---|---|
| `CHANGE_PRIORITY` | `orderId`, `priority`, `totalAmount`, `taxAmount` | Same keys | `priority` is the stored code |
| `CHANGE_SERVICE_SPEED` | `orderId`, `serviceSpeed`, `totalAmount`, `taxAmount`, `commercialDelta`, `items` | Same keys | `items` is the list of `{ orderItemId, quantity, pricePerUnit, totalPrice }` for items whose price the speed change rewrites. `commercialDelta` is the reviewed 4-dp difference |
| `CHANGE_READY_BY` | `orderId`, `readyBy` | Same keys | `readyBy` is UTC ISO or `null` when cleared. No order-money keys |
| `CHANGE_ORDER_NOTES` | `orderId`, `notes`, `customerNotes` | Same keys | `notes` is the internal staff note. No order-money keys |
| `CHANGE_CUSTOMER_SNAPSHOT` | `orderId`, `customerName`, `customerMobile`, `customerEmail`, `isDefaultCustomer` | Same keys | Only when the snapshot lock allows the write. `customerDetails` is included only when the stored JSON object changed, and it contains the order snapshot, not the customer master |

### 5B.5 Order operations seeded, writer not shipped yet

When the writer is built, these are the keys. Until then Apply does not insert a history row for them.

| Operation | Before keys | After keys |
|---|---|---|
| `CHANGE_CUSTOMER` | `orderId`, `customerId` | Same keys |
| `CHANGE_BRANCH` | `orderId`, `branchId` | Same keys |
| `CHANGE_ORDER_TYPE` | `orderId`, `orderTypeId` | Same keys |
| `CHANGE_EXPRESS` | `orderId`, `express`, `totalAmount`, `taxAmount` | Same keys |
| `CHANGE_QUICK_DROP` | `orderId`, `isQuickDrop`, `quickDropQuantity` | Same keys |
| `CHANGE_PAYMENT_NOTES` | `orderId`, `paymentNotes` | Same keys |
| `CHANGE_ORDER_SOURCE` | `orderId`, `orderSourceCode` | Same keys |
| `CHANGE_PHYSICAL_INTAKE` | `orderId`, `physicalIntakeStatus`, `physicalIntakeInfo`, `receivedInfo` | Same keys |
| `CHANGE_B2B_REFERENCE` | `orderId`, `b2bContractId`, `costCenterCode`, `poNumber` | Same keys. A missing reference is `null` |
| `CHANGE_DISCOUNT` | `orderId`, `discountRate`, `discountType`, `promoCodeId`, `giftCardId`, `promoDiscountAmount`, `giftCardDiscountAmount`, `totalAmount`, `taxAmount` | Same keys. Amounts are 4-dp text. This does not rewrite a typed amount on the way into history |
| `CHANGE_PAYMENT_TYPE` | `orderId`, `paymentTypeCode` | Same keys. The writer does not change the code in order to unlock collection |

### 5B.6 Item and piece operations seeded, writer not shipped yet

| Operation | Before keys | After keys |
|---|---|---|
| `CHANGE_ITEM_PRODUCT` | `orderId`, `orderItemId`, `productId`, `productName`, `productName2`, `serviceCategoryCode`, `pricePerUnit`, `totalPrice`, `totalAmount`, `taxAmount` | Same keys |
| `CHANGE_ITEM_SERVICE` | `orderId`, `orderItemId`, `serviceCategoryCode`, `totalAmount`, `taxAmount` | Same keys |
| `CHANGE_ITEM_PRICE` | `orderId`, `orderItemId`, `pricePerUnit`, `totalPrice`, `priceOverride`, `overrideReason`, `totalAmount`, `taxAmount` | Same keys. All money keys are 4-dp text or `null` |
| `CHANGE_PIECE_BRAND` | `orderId`, `orderItemId`, `orderItemPieceId`, `brand` | Same keys |
| `CHANGE_PIECE_RACK` | `orderId`, `orderItemId`, `orderItemPieceId`, `rackLocation` | Same keys |

### 5B.7 Residual operation

`CHANGE_UNLISTED` is only for a field that has no operation in this section. A preference, a price, a brand, or a rack location must not be stored under this code.

Before: `orderId`, the parent ids, `field`, and `value` set to the stored value of that field. After: the same keys, with `value` set to the stored result. Also include `targetKind` and `targetId` or `clientRef`. No order-money keys unless that unknown field is later given its own operation.

A missing policy rule denies this operation, so the writer does not insert a row.

### 5B.8 What the current writer must change

Today `beforeValuesFor` fills only some shipped operations, and most after objects are the request payload. `CHANGE_SERVICE_SPEED` already stores a real before and after snapshot. The implementation replaces the payload copy with the key lists above for every shipped operation. Adds keep `before_values` as `{}`. The identity columns stay filled exactly as they are today: a new item, piece, or preference id is written on the history row after that row exists.

Tests for the shipped operations assert the keys in section 5B.2, 5B.3, and 5B.4, including a 4-dp money string and a remove whose after object still contains the old product or preference code and `recStatus` `0`.

## 5C. Preview shows the same values

Preview builds the same before and after objects section 5B defines. The review screen shows those objects in plain language. The operator confirms the values Apply will store.

One shared builder produces the objects. Preview calls it from the loaded order and the projected result. Apply calls it again from the locked rows and the rows just written. The builder lives next to the Apply writer, and neither screen nor Preview keeps a second copy of the key lists.

### 5C.1 What Preview returns

Each operation in the preview response gains `beforeValues` and `afterValues` with the keys in section 5B. Preview also returns display names so the screen does not have to join again:

| Field | Use |
|---|---|
| `seq` | Matches the request operation |
| `code` | Machine code, not the title |
| `titleKey` | Translation key for the operation name |
| `targetLabel` | English name of the item, piece, or preference |
| `targetLabel2` | Arabic name |
| `preferenceKind` | Present for a preference operation |
| `effect` | `add`, `change`, or `remove` |
| `beforeValues` | Section 5B object. `{}` for an add |
| `afterValues` | Section 5B object |
| `changedKeys` | Keys whose before and after differ. Parent ids are not in this list |

An add sets `effect` to `add` and `changedKeys` to the business keys in the after object. A remove sets `effect` to `remove`. A change lists only the keys that differ, including `totalAmount` and `taxAmount` when those amounts differ.

Preview does not return the raw order id, item id, or preference id for display. Those ids stay inside the signed snapshot. The screen uses `targetLabel` and `targetLabel2`.

The digest of every operation's `code`, `seq`, `beforeValues`, and `afterValues` is part of the review proof binding. Apply rebuilds the objects and requires the same digest. A mismatch returns `REVIEW_CHANGED` and writes nothing. The 300-second lifetime stays.

### 5C.2 Review screen

Keep `edit-review-dialog.tsx`. The current dialog is the right review: one `CmxDialog`, the status and totals in `CmxSummaryMessage`, the operation list, the warning messages, the reason field, the compact history, and the footer actions. Do not replace it with a new page, a card grid, or a two-column layout. The dialog is already narrow (`max-w-xl`) and scrolls. That fits a review better than a wider comparison table.

Keep these as they are:

- Header title `workspace.review`
- Summary of current total, estimated total, and financial result
- Apply failure summary and Copy, and the conflict summary
- Warning `CmxSummaryMessage`, the acknowledgement checkbox, and the reason textarea
- History block and its empty state
- Footer: Cancel, Reload on conflict, Apply when ready, Review again otherwise
- Apply stays disabled until the preview status is `READY`
- The dialog stays open when Apply fails
- `text-start`, the existing scroll height, and the Cmx components already imported

Improve only the operation list. Today each row shows the raw operation code and a UUID or client reference. That is the weak part. The same list row becomes:

1. The operation name in the active language. The machine code is not the title.
2. The target name. Arabic uses `targetLabel2` when it is present, then `targetLabel`. A new row with no name yet uses "New item", "New piece", or the preference name.
3. For a preference, one word for the kind: Packing, Stain, Damage, Color, Condition, Note, or Service preference. Damage's stored value remains `condition_damag`.
4. One compact value line, not a second column.

| Effect | Line under the name |
|---|---|
| `add` | "Will be added" and the after values that matter, on the same row |
| `remove` | "Will be removed" and the before values that matter. The words say it is a removal |
| `change` | For each key in `changedKeys`, the field name, then the before value, then the after value, as `Before → After` |

Money uses the order currency and the locale. Dates use the locale and the organization timezone. `true` and `false` use Yes / No and نعم / لا. `null` uses "None" / "بدون". A long note wraps inside the existing scroll area.

`CHANGE_SERVICE_SPEED` shows the speed change on that row. Item prices that change are further lines in the same list item, with the item name and the before and after unit price. The totals stay in the summary already at the top. Do not add a nested expander.

Move each warning, override, or deny so it sits under its operation row. Keep `CmxSummaryMessage` and the checkbox. Do not invent a new warning style. The reason field stays one field under the list.

### 5C.3 What the screen hides

- Order, item, piece, and preference ids
- `clientRef`
- `recStatus`
- Raw `preference_sys_kind`
- The JSON object
- Keys that did not change, except inside an add or a remove, where the shown block is the whole business snapshot
- The review proof

Support can still open the stored history row after Apply. The history screen uses the same field labels, so the review the operator confirmed and the history row read the same way.

### 5C.4 Copy

Add these under `orders.edit.review` in both locale files. Search for an existing key first.

| Key | English | Arabic |
|---|---|---|
| `review.willAdd` | Will be added | ستتم الإضافة |
| `review.willRemove` | Will be removed | ستتم الإزالة |
| `review.before` | Before | قبل |
| `review.after` | After | بعد |
| `review.none` | None | بدون |
| `review.yes` | Yes | نعم |
| `review.no` | No | لا |
| `review.newItem` | New item | صنف جديد |
| `review.newPiece` | New piece | قطعة جديدة |
| `review.kind.packing` | Packing | التغليف |
| `review.kind.stain` | Stain | بقعة |
| `review.kind.damage` | Damage | تلف |
| `review.kind.color` | Color | اللون |
| `review.kind.condition` | Condition | الحالة |
| `review.kind.note` | Note | ملاحظة |
| `review.kind.service` | Service preference | تفضيل الخدمة |

Field labels reuse `policyInfo` names where they already exist. A new field label follows the English and Arabic names in section 5A.

### 5C.5 Accessibility and layout

Keep the current dialog width, scroll, and keyboard order: summary, operation list, reason, then Cancel and Apply. Before and After are words in the line, not color alone. `text-start` stays. A loading review and an empty operation list keep the behavior already on the screen, and an empty list does not offer Apply.

### 5C.6 Files and tests

| File | Change |
|---|---|
| Shared value builder used by Preview and Apply | One function for the section 5B objects |
| `order-change-preview.service.ts` | Returns `beforeValues`, `afterValues`, `changedKeys`, labels, and `effect` |
| Review proof binding | Adds the snapshot digest. Lifetime stays 300 seconds |
| `edit-review-view.ts` | Maps the preview body into the existing list model. It does not invent values |
| `edit-review-dialog.tsx` | Improves the existing operation rows. The dialog shell stays |
| `messages/en/orders/edit.json` and `messages/ar/orders/edit.json` | Section 5C.4 |

Tests: an add has an empty before object and a filled after object; a quantity change lists only `quantity` in `changedKeys` plus the totals when they differ; a preference add includes `preferenceKind` `packing_prefs` and the screen label is Packing; a remove includes the old code and the screen says it will be removed; Apply rejects a preview whose snapshot digest does not match the rows it would write.

## 6. Phase 1 — Database

Create one new migration in `F:\jhapp\cleanmatex\supabase\migrations\`. Take the next sequence when the file is written. At plan time the latest numbered file is `0636`. Do not edit an existing migration. Do not apply the migration. Do not use `DROP ... CASCADE`. The user reviews and applies it.

Suggested file name: `{next}_edit_policy_resolution_scopes.sql`.

**2026-10-23 Phase 1 authoring:** Created `supabase/migrations/0637_edit_policy_resolution_scopes.sql` after verifying `0636` as the latest numbered migration. Section 6.1 returned zero collisions on `supabase_local`; live assignments = 0, distinct live assigned policies = 0, total assignments = 0, policy headers = 5, unresolved assignment versions = 0, inactive fallbacks = 0. The new default table was absent at authoring time. SQL and PL/pgSQL were parsed offline; the agent did not apply the migration or create fabricated behavioral fixtures. **Subsequent user confirmation:** all migrations applied locally and remotely; both repositories' types regenerated and Prisma schema updated. Local read-only verification found `0637` in migration history, 30 operations / 35 pairs, zero defaults, correct browser-role restrictions and `DENY / NO_AUTHORITY` for the no-authority smoke case. Remote application is user-confirmed, not independently verified. Full section 17 behavioral acceptance remains pending; no later phase has started.

The existing `0606` lifecycle and published-field immutability checks and `0599` atomic-save revision marker are retained. Rule ownership cannot move between policies, preventing a rule from bypassing its old policy's published guard. The trusted tenant Prisma connection uses `postgres`; it needs no new grant beyond its owner privileges. HQ receives only the documented server-role grants.

The migration is one transaction. Every new or replaced object gets a SQL comment and `COMMENT ON`, including columns, constraints, indexes, functions, triggers, and grants.

### 6.1 Preflight, run read-only before writing the final migration

```sql
SELECT assignment.tenant_org_id,
       profile_version.profile_id,
       COUNT(*) AS live_assignments
FROM public.org_wf_edit_policy_asg_cf AS assignment
JOIN public.sys_wf_profile_ver_mst AS profile_version
  ON profile_version.version_id = assignment.workflow_profile_version_id
WHERE assignment.rec_status = 1
  AND assignment.is_active = true
GROUP BY assignment.tenant_org_id, profile_version.profile_id
HAVING COUNT(*) > 1;
```

Zero rows means the backfill can proceed. Any row means two live version assignments collapse onto one profile. The migration must raise and list `tenant_org_id` and `profile_id`. It must not pick a winner. The operator deactivates the extra assignment and applies again.

Also record, for the implementer, the current live assignment count and the distinct policy count. Those numbers go in the migration header comment. They are not seed data.

### 6.2 DDL order

Dependent objects force this order.

1. Lock assignments and repeat collision and unresolved-version preflight in the transaction. Drop the grammar triggers and `sys_wf_edit_grammar_guard` as specified in section 5A.1, then create `sys_wf_edit_catalog_guard`, the new `trg_wf_edit_ops_catalog` / `trg_wf_edit_tgt_catalog` triggers, and seed section 5A.5.
2. Add nullable columns on `org_wf_edit_policy_asg_cf`: `scope`, `workflow_profile_id`, `gap_acknowledged`.
3. Drop `trg_org_wf_edit_asg_guard` using `RESTRICT` before backfilling identity columns. Backfill `scope` and `workflow_profile_id` from the existing version, or raise on collision or any unresolved live/inactive version. Keep the trigger absent through old-key clearing, then recreate it at step 14 in this transaction.
4. Set `scope` to `NOT NULL` after the backfill.
5. Add `ck_wf_edit_asg_scope` and `fk_wf_edit_asg_prof`.
6. Keep assignment identity validation suspended only inside this locked transaction; do not expose partially converted rows.
7. Prepare `CREATE OR REPLACE FUNCTION org_wf_edit_asg_guard`; install it after conversion and before recreating the trigger at step 14.
8. Drop `fk_wf_edit_asg_policy`.
9. Drop unique index `uq_wf_edit_asg_active`.
10. `ALTER COLUMN workflow_profile_version_id DROP NOT NULL` on the assignment table.
11. Clear `workflow_profile_version_id` on the backfilled rows only after the new profile id is stored. Keep the old value in `created_info` as `backfill_version_id=<uuid>` so support can see the source version. Do not drop the column.
12. Add `fk_wf_edit_asg_pol` on `edit_policy_id` referencing `sys_wf_edit_policy_mst(id)`.
13. Create `uq_wf_edit_asg_org` and `uq_wf_edit_asg_prof`.
14. Recreate the assignment guard trigger.
15. `ALTER COLUMN workflow_profile_version_id DROP NOT NULL` on `sys_wf_edit_policy_mst`. The existing foreign key `fk_wf_edit_pol_profile` stays. Null means the policy is not authored against one version.
16. `ALTER TABLE sys_wf_edit_policy_mst DROP CONSTRAINT uq_wf_edit_policy_ver RESTRICT` after no foreign key depends on it. It is a UNIQUE constraint, not a standalone index. Policy identity is `id`.
17. `CREATE OR REPLACE` `sys_wf_edit_rule_guard` so a rule status no longer has to belong to the header version.
18. `CREATE OR REPLACE` the publish-time coverage function from `0606` so promotion no longer demands every status of one version.
19. Create `sys_wf_edit_policy_def_cf`, its indexes, `sys_wf_edit_def_guard`, and `sys_wf_edit_cov_status`.
20. Create `sys_wf_resolve_edit_policy`.
21. Grants and comments.
22. Do not insert a default row. Do not insert `ALLOW` rules for the new catalog pairs.

### 6.3 Assignment columns

Existing columns stay. New columns:

| Column | Type | Rule |
|---|---|---|
| `scope` | `TEXT NOT NULL` | `ORGANIZATION` or `PROFILE` |
| `workflow_profile_id` | `UUID NULL` | Required for `PROFILE`. Forbidden for `ORGANIZATION`. Foreign key to `sys_wf_profiles_cd.profile_id` `ON DELETE RESTRICT` |
| `gap_acknowledged` | `BOOLEAN NOT NULL DEFAULT false` | A live `ORGANIZATION` row must have `true`. A `PROFILE` row may have `false` |

`ck_wf_edit_asg_scope`:

```text
(scope = 'ORGANIZATION' AND workflow_profile_id IS NULL AND (rec_status <> 1 OR is_active = false OR gap_acknowledged = true))
OR
(scope = 'PROFILE' AND workflow_profile_id IS NOT NULL)
```

Indexes, both partial on `rec_status = 1 AND is_active = true`:

- `uq_wf_edit_asg_org` on `(tenant_org_id)` where `scope = 'ORGANIZATION'`
- `uq_wf_edit_asg_prof` on `(tenant_org_id, workflow_profile_id)` where `scope = 'PROFILE'`

`workflow_profile_version_id` remains in the table for audit of the old key. New writes leave it null. The guard treats a change of `scope`, `workflow_profile_id`, `edit_policy_id`, or `tenant_org_id` as an identity change and rejects it. Deactivate and insert a new row.

`gap_acknowledged` may change from false to true only while the row is not yet the live organization override, or at insert time. After the row is live, identity fields stay frozen. Acknowledgement is part of insert, not a later silent update.

### 6.4 Assignment guard

Replace `org_wf_edit_asg_guard` in this migration.

- `DELETE` still raises. Deactivate instead.
- A live row requires the policy `id` match, lifecycle `PILOT` or `PUBLISHED`, `is_active`, and `rec_status = 1`. The version column is not part of the match.
- `PROFILE`: the organization must have a live row in `org_wf_profile_assign_cf` for that `wf_profile_id`, with `tenant_org_id` on both sides of the join. Version number on the workflow assignment may be null or any version of that profile. The override covers the profile family.
- `ORGANIZATION`: no workflow-profile assignment is required, and `gap_acknowledged` must be true.
- An inactive row skips the live-policy checks so retirement of the link still saves.

### 6.5 Policy header

`workflow_profile_version_id` becomes nullable.

| Value | Meaning |
|---|---|
| A version id | Historical "authored while editing that version" note. The resolver ignores it |
| NULL | Policy was created as a reusable catalog row |

Existing rows keep their current version id. New HQ creates may omit it. Clone copies the rules and leaves the new header's version null. Clone does not make the new policy the default or an override.

`policy_code` stays immutable and globally unique. Names stay bilingual and required.

The policy guard's published-immutability check still rejects a change of `workflow_profile_version_id` after publish. Draft and Pilot may set or clear it, and that change increments `policy_revision` through the existing save path.

### 6.6 Rule guard

Replace the profile-membership test in `sys_wf_edit_rule_guard`.

A non-delete rule must reference a status that exists in `sys_wf_statuses_cd` and is active. The foreign key already requires existence. The trigger adds `is_active = true` and `rec_status = 1`.

The trigger no longer requires the status to be a member of `sys_wf_prof_ver_mod_st_cf` for the header version. That check moves to the default binding.

Published and retired matrices stay immutable. Each Draft or Pilot rule change still increments `policy_revision` on the header inside the same statement, as it does today.

### 6.7 Promotion coverage

Today, moving a policy to Pilot or Published fails unless every active status of its header version has every catalog pair. That check is what forces a policy to be complete for one version.

After this migration:

- Promotion requires at least one live rule, unique tuples, catalog pairs, real active statuses, and the existing decision checks.
- Promotion does not require coverage of any profile version.
- A policy with zero live rules cannot leave Draft.
- Full coverage is required only when a published policy is activated as a version default.

Replace the function body from `0606` with `CREATE OR REPLACE` in this migration. Do not edit `0606`.

### 6.8 Default table

`sys_wf_edit_policy_def_cf` is a system table. It has no `tenant_org_id`. It does not enable RLS. It is not tenant data.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Stable default-link identity |
| `workflow_profile_version_id` | `UUID NOT NULL` | FK `sys_wf_profile_ver_mst.version_id` `ON DELETE RESTRICT` |
| `edit_policy_id` | `UUID NOT NULL` | FK `sys_wf_edit_policy_mst.id` `ON DELETE RESTRICT` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` | |
| `created_by` | `UUID` | HQ actor |
| `created_info` | `TEXT` | Non-secret provenance |
| `updated_at` | `TIMESTAMPTZ` | |
| `updated_by` | `UUID` | |
| `updated_info` | `TEXT` | |
| `rec_status` | `SMALLINT NOT NULL DEFAULT 1` | Check `IN (0, 1)` |
| `rec_order` | `INTEGER` | |
| `rec_notes` | `TEXT` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | Live only with `rec_status = 1` |

`uq_wf_edit_def_ver`: unique `(workflow_profile_version_id)` where `rec_status = 1 AND is_active = true`.

`idx_wf_edit_def_pol`: index `(edit_policy_id)` where `rec_status = 1 AND is_active = true`, so retirement of a policy can find the defaults that still point at it.

Replacing a default deactivates the old row (`is_active = false`) and inserts a new row. The application does this in one transaction. The old row's version and policy id are not updated.

### 6.9 Default guard

`sys_wf_edit_def_guard` rejects:

- `DELETE`
- an update that changes `workflow_profile_version_id` or `edit_policy_id`
- a live row whose policy is not `PUBLISHED`, `rec_status = 1`, and `is_active = true`
- a live row whose version is missing, inactive, or not `PUBLISHED` or `PILOT` as a workflow version. A default may be attached to a pilot workflow version so a pilot organization can resolve it. The Edit Policy itself must still be `PUBLISHED`
- a live row that fails `sys_wf_edit_cov_status`

Inactive rows skip the coverage and lifecycle checks so deactivation succeeds.

### 6.10 Coverage helper

`sys_wf_edit_cov_status(policy_id UUID, version_id UUID) RETURNS TABLE(status_code TEXT, operation_code TEXT, target_type TEXT)` returns the missing live cells.

Required set:

- every row in `sys_wf_prof_ver_mod_st_cf` for that version with `rec_status = 1` and `is_active = true`
- crossed with every live row in `sys_wf_order_edit_op_tgt_cd`, including the pairs seeded in section 5A. The helper does not hard-code the old count of 15

Satisfied set: live rules on that policy whose `workflow_status` equals the status code.

The helper returns the missing triples. An empty result means coverage is complete. Zero active statuses on the version is a failure of its own, signaled by the guard as `profile version has no active statuses`, not as an empty success.

The HQ API calls this helper to render the gap list. The trigger calls it and raises if any row comes back.

### 6.11 Resolver function

```text
sys_wf_resolve_edit_policy(
  p_tenant_org_id UUID,
  p_profile_id UUID,
  p_profile_version_id UUID,
  p_workflow_status TEXT
) RETURNS TABLE (...)
```

`LANGUAGE plpgsql`, `STABLE`, `SECURITY INVOKER`, `SET search_path = pg_catalog, public, pg_temp`.

Every read of `org_wf_edit_policy_asg_cf` and `org_wf_profile_assign_cf` includes `tenant_org_id = p_tenant_org_id`. The function does not read "the current tenant" from session state as its only predicate.

Return columns:

| Column | Type | When |
|---|---|---|
| `resolution_level` | `TEXT` | `ORGANIZATION`, `PROFILE`, `VERSION_DEFAULT`, or `DENY` |
| `deny_reason` | `TEXT` | `NONE`, `NO_AUTHORITY`, `AMBIGUOUS_ORGANIZATION`, `AMBIGUOUS_PROFILE`, `AMBIGUOUS_DEFAULT`, `POLICY_NOT_USABLE`, `STATUS_NOT_COVERED` |
| `edit_policy_id` | `UUID` | Winning policy, else null |
| `policy_revision` | `INTEGER` | Winning revision, else null |
| `policy_code` | `TEXT` | |
| `workflow_status` | `TEXT` | Echo of the requested status |
| `operation_code` | `TEXT` | Null on a header-only row |
| `target_type` | `TEXT` | |
| `decision` | `TEXT` | |
| `reason_code` | `TEXT` | |
| `message_key` | `TEXT` | |
| `requires_reason` | `BOOLEAN` | |
| `required_permission_code` | `TEXT` | |
| `override_permission_code` | `TEXT` | |

Row shape:

- Usable winning policy with N live rules for the status: N rows, `deny_reason = NONE`, level set, rule columns filled.
- Usable winning policy with zero live rules for the status: one row, level set, policy id and revision set, `deny_reason = STATUS_NOT_COVERED`, rule columns null.
- Broken, ambiguous, or missing authority: one row, `resolution_level = DENY`, policy columns null, `deny_reason` set, rule columns null.

The function must not union rules from two policies. It evaluates level 1 to completion before reading level 2, and level 2 to completion before reading level 3.

Level 3 additionally requires the default row live and the policy `PUBLISHED`. A pilot policy found through a default row returns `POLICY_NOT_USABLE` and stops.

### 6.12 Grants

Follow `0597`. Do not grant the new table or the new function to `PUBLIC`, `anon`, or `authenticated`.

```text
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sys_wf_edit_policy_def_cf TO service_role;
GRANT EXECUTE ON FUNCTION sys_wf_resolve_edit_policy(UUID, UUID, UUID, TEXT) TO service_role;
```

The tenant server already reads Edit Policy through the trusted server connection, not through the browser role. That same connection must be the role that receives `EXECUTE`. If implementation finds the tenant server role is not `service_role`, grant `EXECUTE` and `SELECT` on the default table to that server role only, and record the role name in the migration comment. Do not open a browser grant to make the resolver work.

The existing RLS policy `org_wf_edit_asg_tenant_read` stays. New assignment columns are covered by that same table policy.

### 6.13 Backfill

For each live assignment:

1. Resolve `profile_id` from `sys_wf_profile_ver_mst` where `version_id = workflow_profile_version_id`.
2. If that join misses, raise. Do not guess a profile.
3. If the preflight collision exists, raise with `tenant_org_id` and `profile_id`.
4. Set `scope = 'PROFILE'`, `workflow_profile_id` to that profile, `gap_acknowledged = false`.
5. Append `backfill_version_id=<old version uuid>` to `created_info` without erasing the existing provenance text.
6. Then null `workflow_profile_version_id`.

Do not create organization-scope rows. Do not insert defaults. Do not publish the Draft starter policies from `0597`. An organization that has no live assignment today stays denied until HQ later publishes a default or creates an override.

Inactive assignment rows acquire `scope = 'PROFILE'`, their resolved profile id, and `gap_acknowledged = false`, without reactivation or clearing their historical version. An unresolved version on any live or inactive row raises and identifies the organization and assignment. No fallback organization override is invented and no row is silently skipped. The preflight fallback count is therefore zero; the operator repairs unresolved history before retrying.

### 6.14 Comments to replace

The new migration issues `COMMENT ON` for the changed meaning of:

- `sys_wf_edit_policy_mst.workflow_profile_version_id`: authored-against note, ignored by resolution.
- `org_wf_edit_policy_asg_cf.workflow_profile_version_id`: historical source version, null on new rows.
- `fk_wf_edit_asg_policy` is dropped, so its comment goes away with it. Comment the new `fk_wf_edit_asg_pol`.

### 6.15 After the user applies the migration

From the `cleanmatex` root, the user runs `npm run prisma:pull`. From `cleanmatexsaas`, the user regenerates platform database types. The agent does not pull before the migration is applied. The tenant resolver can be written against `$queryRaw` before the Prisma model exists. HQ continues to use its Supabase client, not Prisma.

### 6.16 Close Phase 1

Run the tasks in "Tasks after every phase" for Phase 1. The phase stays open until the status file names the migration file and says whether the user has applied it.

## 7. Phase 2 — Tenant resolver

### 7.1 Files

| File | Change |
|---|---|
| `web-admin/lib/services/order-change/order-change-edit-policy-resolver.service.ts` | Call the SQL function. Map rows to the existing binding type plus `resolutionLevel` and `denyReason` |
| `web-admin/lib/services/order-change/order-change-context.service.ts` | Pass `order.wf_profile_id` and `order.wf_profile_version_id`. Stop joining `org_wf_edit_policy_asg_cf` by version |
| `web-admin/lib/services/order-change/order-change-capability.service.ts` | No decision-table change. A `DENY` or `STATUS_NOT_COVERED` result yields no operation binding, so catalog operations still return `CAPABILITY_POLICY_BINDING_MISSING` |
| `web-admin/lib/services/order-change/order-change-preview-reads.ts` | No new call site. It already calls the resolver |
| `web-admin/lib/services/order-change/order-change-preview.service.ts` | Re-resolves through that resolver. Returns the section 5C before and after objects and adds their digest to the review proof |
| `web-admin/lib/services/order-change/order-change-apply.service.ts` | Re-resolves immediately before mutation. Writes section 5B before and after for shipped operations |
| `web-admin/lib/services/order-change/order-change-mutation.service.ts` | Persists those before and after objects on the operation row |
| `web-admin/src/features/orders/order-change/edit-review-dialog.tsx`, `edit-review-view.ts`, `edit-review-changes.tsx` | Keep the dialog. Show the operation name and the before and after line |
| `web-admin/src/features/orders/order-change/edit-policy-info-dialog.tsx` | Show the winning level from the context payload |
| `web-admin/__tests__/services/order-change/order-change-edit-policy-resolver.service.test.ts` | Cases in section 7.4 |

Do not add a TypeScript fallback that re-implements the four levels. If the function is missing, the call fails closed. Do not catch that error and return an empty allow.

### 7.2 Input

```text
tenantId           order tenant, never from the browser body
profileId          order.wf_profile_id
profileVersionId   order.wf_profile_version_id
workflowStatus     order.current_status
```

The resolver returns:

```text
resolutionLevel    ORGANIZATION | PROFILE | VERSION_DEFAULT | DENY
denyReason         as returned by SQL
editPolicyId       nullable
policyRevision     nullable
bindings           only the live rules for this status
```

`STATUS_NOT_COVERED` still returns the policy id and revision so the order screen can name the policy, and so Preview can put that identity into the review proof. The bindings array is empty. Capability therefore denies every catalog operation, including `CHANGE_UNLISTED`. The old allow path with reason `NOT_IN_POLICY` is removed. A shipped writer runs only when a live rule allows that code. A code whose writer is not shipped returns `OPERATION_NOT_AVAILABLE` before any write, even when the cell says `ALLOW`.

### 7.3 Callers

Preview and Apply already re-resolve on the server. They keep doing that. The browser does not call `sys_wf_resolve_edit_policy`. Local editing keeps using the policy loaded with the order. A stale policy id or revision still fails Apply with `POLICY_CHANGED_REVIEW_REQUIRED`.

Context must show the same policy the next Preview will enforce. It must not keep a second query that joins the assignment by version.

### 7.4 Resolver tests

Use a transaction-shaped fake that returns the function rows. Assert the mapper, not a second algorithm.

| Test | SQL shape returned | Expected |
|---|---|---|
| Organization wins | level `ORGANIZATION`, one policy, rules for `intake` | those rules only |
| Profile used when organization is absent | level `PROFILE` | those rules |
| Default used when both overrides are absent | level `VERSION_DEFAULT` | those rules |
| Status hole | level `VERSION_DEFAULT`, `STATUS_NOT_COVERED`, policy id set, no operation | empty bindings, policy id kept |
| Ambiguous organization | `DENY` / `AMBIGUOUS_ORGANIZATION` | empty bindings, no policy id |
| Retired policy link | `DENY` / `POLICY_NOT_USABLE` | empty bindings, no fallthrough represented by a second policy |
| No authority | `DENY` / `NO_AUTHORITY` | empty bindings |
| Null profile input | the call still sends null and accepts a `VERSION_DEFAULT` row | mapper does not invent a profile |
| Other organization | not visible because the SQL predicate is the only tenant filter | the test passes the tenant id into the query text assertion |

Add one database integration test, beside the existing order-change DB tests, only after the user has applied the migration locally. It inserts two policies, one organization override, one profile override, and one default, then asserts cases B, C, and D from section 3.5. It deletes none of the committed proof orders already in the local database. Its own rows use a dedicated test organization if one already exists, and they are deactivated rather than deleted when the test finishes, because assignment delete is rejected by the guard.

### 7.5 Close Phase 2

Run the tasks in "Tasks after every phase" for Phase 2.

**2026-10-23 execution:** Completed Phase 2 in `cleanmatex`. Context and Preview call the SQL-backed resolver; Apply locks the tenant-scoped order and calls the same resolver immediately before mutation. The signed review proof binds the canonical before/after snapshot digest, and persistence compares the locked before and stored after values before committing immutable history. All 30 catalog operations are recognized, while the 16 operations without shipped writers and executable residual changes fail with `OPERATION_NOT_AVAILABLE`. The shared Cmx Edit workspace now shows localized compact operation rows plus policy source/deny information and disables unavailable Edit controls without changing Create. Focused Order Change Jest passed 25 suites / 191 tests; two local PostgreSQL integration tests passed with rollback-only fixtures; full ESLint, typecheck, i18n check and production build passed. See `Extend_Order_Edit_policy_STATUS.md` for exact evidence and remaining boundaries. No HQ API/Studio code, Phase 5 work, WP19 or WP20 was started.

## 8. Phase 3 — HQ API

Module: `platform-api/src/modules/workflow-engine-config/edit-policy/`.

Files: `edit-policy.controller.ts`, `edit-policy.service.ts`, `edit-policy.repository.ts`, `edit-policy.dto.ts`, `edit-policy.types.ts`, `edit-policy.rules.ts`, `edit-policy.errors.ts`, `edit-policy.permissions.ts`, and the two existing spec files. The Studio client in `platform-web/lib/api/workflow-engine-config.ts` changes in the same phase so the screens are not left calling the old assignment body.

Do not add a second Nest module. Do not re-implement the resolution order in TypeScript. Effective preview calls `sys_wf_resolve_edit_policy` through the server Supabase client.

### 8.1 Permissions

| Action | Permission |
|---|---|
| List policies, get one, list catalog, list overrides, list defaults, effective preview, audit | `workflows.view` |
| Create, clone, save matrix | `workflows.edit_policy` |
| Promote lifecycle | `workflows.edit_policy_promote` |
| Create or deactivate an override, set or deactivate a default | `workflows.edit_policy_assign` |

### 8.2 Policy catalog

`CreateEditPolicyDto.workflow_profile_version_id` becomes optional. Omit it for a reusable policy. When it is present, it must still be a real version id. It is stored as the authored-against note.

`GET /workflow-engine-config/edit-policies` keeps the optional version query. Add optional `unscoped=true` to list policies whose authored-against version is null. The Studio catalog calls the list without a version filter so one policy can be chosen as a default or as an override.

Clone no longer copies the source version onto the new header.

Matrix save stays `PUT` with `expected_revision`. A revision mismatch stays a conflict. The save no longer calls the version-coverage check. It still rejects duplicate tuples, unknown catalog pairs, unknown or inactive statuses, and a bad override shape.

Promotion to Pilot or Published no longer calls version coverage. It still rejects a policy with zero live rules.

`POST /workflow-engine-config/edit-policies/:id/check` no longer loads statuses from a required header version. A reusable policy with a null authored-against version returns structural issues only, unless the query includes `workflow_profile_version_id`. With that id, check returns the missing cells for that version and does not write a default. `POST /workflow-engine-config/edit-policies/:id/simulate` stays a single-cell read of that policy. It does not call `sys_wf_resolve_edit_policy`.

### 8.3 Defaults

`GET /workflow-engine-config/edit-policies/defaults?workflow_profile_version_id={uuid}`

Response:

```json
{
  "default": {
    "id": "uuid",
    "workflow_profile_version_id": "uuid",
    "edit_policy_id": "uuid",
    "policy_code": "ORDER_CHANGE_STANDARD_V1",
    "name": "Standard Order Change",
    "name2": "تعديل الطلب القياسي",
    "policy_revision": 4,
    "is_active": true
  },
  "missing": [
    { "workflow_status": "assembly", "operation_code": "ADD_ITEM", "target_type": "ORDER" }
  ]
}
```

`default` is null when the version has no live default. `missing` is computed for the policy currently selected in the query `candidate_policy_id`, or for the live default when no candidate is passed.

`POST /workflow-engine-config/edit-policies/defaults`

```json
{
  "workflow_profile_version_id": "uuid",
  "edit_policy_id": "uuid"
}
```

Behavior:

- Reject a policy that is not published, with code `EDIT_POLICY_DEFAULT_NOT_PUBLISHED`.
- Reject coverage gaps with code `EDIT_POLICY_DEFAULT_COVERAGE` and the missing triples in the body. Do not write the row.
- If a live default already exists, deactivate it and insert the new row in one transaction.
- Audit `edit_policy_default_set` with the organization-free version id, the new policy id, and the deactivated default id when one existed.

`PATCH /workflow-engine-config/edit-policies/defaults/:defaultId`

```json
{ "workflow_profile_version_id": "uuid" }
```

The version id is required so a mismatched id cannot deactivate another version's default. Set `is_active = false`. Audit `edit_policy_default_deactivated`.

### 8.4 Overrides

Existing routes stay.

`POST /workflow-engine-config/edit-policies/assignments`

```json
{
  "tenant_org_id": "uuid",
  "edit_policy_id": "uuid",
  "scope": "ORGANIZATION",
  "workflow_profile_id": null,
  "gap_acknowledged": true
}
```

```json
{
  "tenant_org_id": "uuid",
  "edit_policy_id": "uuid",
  "scope": "PROFILE",
  "workflow_profile_id": "uuid",
  "gap_acknowledged": false
}
```

Validation:

| Case | Result |
|---|---|
| `ORGANIZATION` with a profile id | 400 `EDIT_POLICY_SCOPE_PROFILE` |
| `PROFILE` without a profile id | 400 `EDIT_POLICY_SCOPE_PROFILE` |
| `ORGANIZATION` with `gap_acknowledged` not true | 400 `EDIT_POLICY_GAP_ACK_REQUIRED` |
| Policy is Draft or Retired | 400, existing assignment message |
| A live row already exists for that scope | 409 `EDIT_POLICY_OVERRIDE_EXISTS`. The client deactivates it first. The API does not silently replace it |
| Profile scope and the organization has no live workflow assignment for that profile | 400 `EDIT_POLICY_PROFILE_NOT_ASSIGNED` |

List assignments accepts `tenant_org_id` and optional `scope`. The response includes `scope`, `workflow_profile_id`, `gap_acknowledged`, `is_active`, policy code, names, lifecycle, and revision. It also includes `shadowed_by_organization_override: true` on profile rows when that organization has a live organization override.

Deactivate stays `PATCH /assignments/:assignmentId` with `tenant_org_id`. The repository filters `tenant_org_id` and the assignment id together.

Audit:

- `edit_policy_assigned` gains `scope` and `workflow_profile_id`.
- `edit_policy_assignment_deactivated` stays, and gains `scope`.

### 8.5 Effective preview

`POST /workflow-engine-config/edit-policies/effective-preview`

```json
{
  "tenant_org_id": "uuid",
  "workflow_profile_id": "uuid",
  "workflow_profile_version_id": "uuid",
  "workflow_status": "intake",
  "operation_code": "ADD_ITEM",
  "target_type": "ORDER"
}
```

Response adds:

```json
{
  "resolution_level": "ORGANIZATION",
  "deny_reason": "NONE",
  "decision": "ALLOW",
  "policy_id": "uuid",
  "policy_revision": 4,
  "uncovered_statuses": []
}
```

`uncovered_statuses` is the distinct status codes of the requested version that have no live rule on the winning policy. It is empty when the level is `DENY` and no policy won.

The preview still does not evaluate feature flags, actor permissions, or hard domain denials. The audit row `edit_policy_effective_preview` adds `resolution_level`.

Remove the repository lookup `listLiveAssignmentPolicyIds(tenant, version)` from this path so HQ cannot drift from the tenant.

### 8.6 API tests

Extend `edit-policy.service.spec.ts` and `edit-policy.rules.spec.ts`.

- Default coverage failure returns the missing triple and writes nothing.
- Pilot policy cannot be a default.
- Second live override of the same scope returns 409.
- Organization scope without acknowledgement returns 400.
- Profile scope without a profile id returns 400.
- Effective preview maps `ORGANIZATION`, `PROFILE`, `VERSION_DEFAULT`, and `DENY`.
- Matrix save of a status that is absent from the old header version succeeds when the status exists in `sys_wf_statuses_cd`.
- Promotion with zero rules fails.
- Promotion with a partial matrix succeeds.

### 8.7 Close Phase 3

Run the tasks in "Tasks after every phase" for Phase 3.

## 9. Phase 4 — HQ screens

Stay on the existing Workflow Profile Version Studio, Edit Policy tab:

`platform-web/src/features/workflow-engine-config/ui/wf-edit-policy-panel.tsx`
`platform-web/src/features/workflow-engine-config/ui/wf-edit-policy-matrix.tsx`
`platform-web/src/features/workflow-engine-config/hooks/use-edit-policy.ts`
`platform-web/src/features/workflow-engine-config/model/edit-policy-smart-fill.ts`
`platform-web/lib/api/workflow-engine-config.ts`
`platform-web/app/workflow-engine-config/profiles/[id]/versions/[versionNo]/studio/page.tsx` hosts the existing tab and does not gain a route.

No new route. No `navigation.ts` change. No `sys_components_cd` migration.

Messages stay in `platform-web/messages/en.json` and `platform-web/messages/ar.json` under the existing `editPolicy` object. Search those objects before adding a key. Reuse a key that already says the same thing.

### 9.1 Screen sections, top to bottom

1. Policy catalog and matrix.
2. Default for the profile version that is open.
3. Organization override for the selected organization.
4. Profile overrides for that organization.
5. Effective preview.

### 9.2 Catalog and matrix

- The catalog lists policies across versions, with columns: code, English name, Arabic name, lifecycle, revision, authored-against version or "Reusable".
- Create does not require a version.
- The matrix lists active statuses from `sys_wf_statuses_cd` by `display_order`. Statuses that belong to the open version are marked so the default gap is visible. Statuses outside the version remain editable.
- One cell is still one decision for one status, operation, and target.
- Smart fill still only proposes `decision`, `reasonCode`, `messageKey`, `requiresReason`, `overridePermissionCode`, and `requiredPermissionCode`. It does not persist, and it does not write the default table.
- Save, clone, and promote keep their current buttons and their current permission gates.
- A published policy shows the matrix as read-only. The operator clones it to change decisions.

### 9.3 Default section

Shows the open version's live default: policy name in the active language, code, and revision. An empty state says that organizations with no override are denied for this version.

The operator picks a published policy and chooses Save default. If `missing` is not empty, the save button stays disabled and the missing statuses are listed as status, operation, and target. The message names the count.

Success uses `cmxMessage` with the existing saved wording where it fits. Failure uses `cmxMessage` and shows `EDIT_POLICY_DEFAULT_NOT_PUBLISHED` or `EDIT_POLICY_DEFAULT_COVERAGE` in plain language.

Deactivate default asks for confirmation in `CmxConfirmDialog`, then the empty state returns. Deactivation does not delete the policy.

### 9.4 Organization override

The organization picker already on the tab stays. Label it Organization / المنشأة.

The section has one slot. Empty means level 1 does not apply.

Setting it requires:

- a Pilot or Published policy
- a confirmation dialog that says this policy will apply on every profile, and any status it does not name stays closed
- the confirm action sends `gap_acknowledged: true`

While this slot is filled, section 9.5 shows each profile override with the label "Unused while the organization override is active" / "غير مستخدمة طالما أن تجاوز المنشأة نشط". The rows stay visible. Their deactivate action stays available so the operator can remove a stale profile override. Their replace action stays disabled until the organization override is deactivated, so the screen does not imply that a new profile override will start winning.

### 9.5 Profile overrides

One row per live profile override, plus an add action. Add asks for the profile and the policy. The profile list is the profiles assigned to that organization in `org_wf_profile_assign_cf`.

If a live profile override already exists, the add action for that profile is a replace flow: confirm, deactivate the old row, create the new row. The API itself still returns 409 if the client tries to create a second live row. The screen performs the two calls in order and stops if deactivate fails.

Show uncovered statuses of the open version when the selected profile is the open profile. Do not block save on that gap. The helper text says those statuses stay closed.

### 9.6 Effective preview

Inputs already available on the tab, plus status, operation, and target. Output in one summary:

- winning level, in the plain words from section 10
- policy name, code, and revision
- decision
- uncovered statuses of the selected version

A `DENY` result says no Edit Policy is in force and edits stay closed. It names `deny_reason` for support, with a plain sentence for each reason code.

### 9.7 UI states

| State | What the operator sees |
|---|---|
| Loading | The existing skeleton for this tab |
| Empty catalog | A short empty state and the create action |
| Empty default | The deny sentence for organizations with no override |
| Coverage gap | Disabled save and the missing triples |
| Organization override active | Profile section marked unused |
| Save conflict 409 | The override already exists; reload the list |
| Permission missing | The action is not rendered. The view permission still shows the sections |
| API error | `cmxMessage` with the server message, and the form values kept |

Use Cmx buttons, selects, dialogs, and tables. Do not add a local button, input, or table. Do not call `alert` or a legacy toast.

### 9.8 Studio tests

Extend `platform-web/__tests__` only where a pure function is added. The coverage-gap disable rule, the acknowledgement flag, and the shadowed-row flag belong in a small model helper next to `edit-policy-smart-fill.ts` if the panel would otherwise hide that logic. Test that helper. Do not add a browser test in this phase.

### 9.9 Close Phase 4

Run the tasks in "Tasks after every phase" for Phase 4. Shared UI added in this phase is recorded in the status file with its path.

## 10. Copy

Search existing keys first. Add a key only when none of these meanings already exists.

| Key | English | Arabic |
|---|---|---|
| `editPolicy.resolution.organization` | Organization override | تجاوز المنشأة |
| `editPolicy.resolution.profile` | Profile override | تجاوز ملف سير العمل |
| `editPolicy.resolution.versionDefault` | Profile version default | السياسة الافتراضية لإصدار ملف سير العمل |
| `editPolicy.resolution.deny` | No Edit Policy is in force. Edits stay closed. | لا توجد سياسة تعديل نافذة. تبقى التعديلات مغلقة. |
| `editPolicy.default.coverageBlocked` | This default is missing decisions for {count} cells. | هذه السياسة الافتراضية تنقصها قرارات لعدد {count} من الخلايا. |
| `editPolicy.default.notPublished` | Only a published Edit Policy can be the default. | يمكن اعتماد سياسة التعديل المنشورة فقط كسياسة افتراضية. |
| `editPolicy.override.unused` | Unused while the organization override is active. | غير مستخدمة طالما أن تجاوز المنشأة نشط. |
| `editPolicy.override.ack` | This policy applies on every profile. A status it does not name stays closed. | تُطبق هذه السياسة على كل ملفات سير العمل. أي حالة غير مذكورة فيها تبقى مغلقة. |
| `editPolicy.override.exists` | An active override already exists. Deactivate it first. | يوجد تجاوز نشط بالفعل. عطّله أولاً. |

Tenant order screen, under `orders.edit.policyInfo`:

| Key | English | Arabic |
|---|---|---|
| `policyInfo.source.organization` | Organization override | تجاوز المنشأة |
| `policyInfo.source.profile` | Profile override | تجاوز ملف سير العمل |
| `policyInfo.source.versionDefault` | Profile version default | السياسة الافتراضية لإصدار ملف سير العمل |
| `policyInfo.source.deny` | No Edit Policy is in force. | لا توجد سياسة تعديل نافذة. |

Tenant file: `web-admin/src/features/orders/order-change/edit-policy-info-dialog.tsx`, plus `web-admin/messages/en/orders/edit.json` and `web-admin/messages/ar/orders/edit.json`.

The dialog already explains Allow, Warning, Override, and Deny. Add one line for the source level next to the policy name and revision. Do not add a tenant control that changes the policy.

## 11. Phase 5 — Proof and docs

### 11.1 Tenant display

`edit-policy-info-dialog.tsx` shows the source level from the context payload. A `DENY` / `NO_AUTHORITY` result uses `policyInfo.source.deny` and keeps the controls closed. A `STATUS_NOT_COVERED` result shows the policy name and says the current status has no decision, so the actions stay closed.

### 11.2 Commands

| Check | When |
|---|---|
| Resolver Jest file | Phase 2 |
| DB integration test | After the user applies the migration locally |
| `platform-api` Edit Policy Jest | Phase 3 |
| `cd platform-api && npm run build` | Phase 3 |
| Studio helper Jest, if added | Phase 4 |
| `cd platform-web && npx eslint . --quiet` on the touched files, then `npm run build` | Phase 4 |
| `npm run check:i18n` in `web-admin` | Phase 5 |
| `cd web-admin && npx eslint . --quiet` on the touched files, then `npm run build` | Phase 5 |

Do not claim a clean full-project typecheck if the known unrelated web-admin errors are still present. Report the command and the result for the files this work touches.

### 11.3 Docs after implementation

- Run the tasks in "Tasks after every phase" for Phase 5 after the manual check.
- Then run "Final task — generate the extension docs". Load the documentation skills named there and generate or update the docs this extension needs. This task is last. It is not a substitute for the doc refresh at the end of Phases 1 through 4.
- `cleanmatexsaas/docs/features/Order_Edit_V2/WP05-B_HQ_PROGRESS.md`: keep the pointer to this file and add the migration filename once it exists. Do not copy this plan into that file.
- This file's status line moves from "Plan only" to the phase that is done. Do not mark a phase done because the code compiled. Mark it done when its tests passed and the user has applied the migration for any phase that needs the new objects.
- Do not rewrite historical WP reports, the manual UI test guide's existing result rows, or tester evidence.

### 11.4 Manual check after both apps are running locally

Use an organization that already has a workflow profile. Do not create a production order.

1. With no override and no default, open Edit Order. Catalog actions stay closed. The policy panel says no Edit Policy is in force.
2. Publish a complete policy and set it as the version default. Reload the order. The panel says profile version default. A status that the matrix allows can be edited locally. Preview still re-resolves.
3. Add an organization override that denies `ADD_ITEM` at the current status. Reload. The panel says organization override. Add item stays closed even though the default allows it.
4. Change nothing in the default. Confirm the organization override still wins.
5. Deactivate the organization override. Reload. The version default wins again.
6. Add a profile override for the order's profile. Reload. The profile override wins over the default.
7. HQ preview for the same organization, profile, version, status, and operation shows the same level and the same decision as the tenant panel.

## 12. Audit

Every mutating HQ action already writes an audit row. This plan adds or extends:

| Action | Metadata |
|---|---|
| `edit_policy_default_set` | version id, policy id, previous default id |
| `edit_policy_default_deactivated` | version id, default id, policy id |
| `edit_policy_assigned` | add `scope`, `workflow_profile_id`, `gap_acknowledged` |
| `edit_policy_assignment_deactivated` | add `scope` |
| `edit_policy_effective_preview` | add `resolution_level` and `deny_reason` |

Do not log order bodies, customer names, or tokens. Organization id is already part of assignment audit and stays.

## 13. Failure codes

| Code | Where | Meaning |
|---|---|---|
| `NO_AUTHORITY` | Resolver | No live level matched |
| `AMBIGUOUS_ORGANIZATION` | Resolver | More than one live organization override |
| `AMBIGUOUS_PROFILE` | Resolver | More than one live profile override for that profile |
| `AMBIGUOUS_DEFAULT` | Resolver | More than one live default for that version |
| `POLICY_NOT_USABLE` | Resolver | The single live link points at a policy the level cannot use |
| `STATUS_NOT_COVERED` | Resolver | The winning policy has no live rule for this status |
| `CAPABILITY_POLICY_BINDING_MISSING` | Tenant capability | No binding for this catalog operation, including `CHANGE_UNLISTED` |
| `OPERATION_NOT_AVAILABLE` | Tenant Apply | The catalog cell allows the code, and the writer for that code is not shipped. No write |
| `EDIT_POLICY_DEFAULT_NOT_PUBLISHED` | HQ API | Default target is not published |
| `EDIT_POLICY_DEFAULT_COVERAGE` | HQ API | Default is missing one or more cells |
| `EDIT_POLICY_SCOPE_PROFILE` | HQ API | Scope and profile id disagree |
| `EDIT_POLICY_GAP_ACK_REQUIRED` | HQ API | Organization override was not acknowledged |
| `EDIT_POLICY_OVERRIDE_EXISTS` | HQ API | A live override already occupies that slot |
| `EDIT_POLICY_PROFILE_NOT_ASSIGNED` | HQ API | The organization is not assigned that workflow profile |
| `POLICY_CHANGED_REVIEW_REQUIRED` | Tenant Apply | Winning policy id or revision changed after Review. Unchanged |

Store these codes in the API error body. Studio maps them through the copy table in section 10. An unknown code still shows the server message.

## 14. Revision and open reviews

| Change | Open reviews |
|---|---|
| Winning policy id changes because a higher level was added or removed | `POLICY_CHANGED_REVIEW_REQUIRED` |
| The same policy's `policy_revision` increments | `POLICY_CHANGED_REVIEW_REQUIRED` |
| A lower level changes while a higher level still wins with the same policy id and revision | The open review stays valid |
| The same policy is both the organization override and the version default, and the organization override is removed | The proof still matches, because id and revision did not change |
| Coverage is filled by a new rule on a Draft or Pilot policy | Revision increments, so open reviews that resolved to that policy fail closed |

Apply does not migrate an open review onto a new policy. The operator runs Preview again.

## 15. Security

- The browser never receives a grant on the policy, rule, default, or assignment tables.
- The resolver is `SECURITY INVOKER` and takes `tenant_org_id` as an argument. Tenant code passes the order's organization, not a body field.
- HQ uses the service role only on the server. Preview and assignment still require `workflows.view` or `workflows.edit_policy_assign`.
- Assignment and default identity are immutable. History is deactivated, not deleted.
- A default cannot be a pilot policy, so a partially reviewed matrix cannot become the floor for every organization on that version.
- An organization override cannot be saved by accident. The acknowledgement flag is a column, checked by the database, not only by the screen.
- RLS on the assignment table stays. The new default table has no tenant column and is not exposed to the Data API.

## 16. Rollout

1. Confirm this plan.
2. Write the migration and stop. The user reviews it.
3. The user applies it locally. If the collision preflight raises, the user deactivates the extra assignment and applies again.
4. Regenerate Prisma and HQ types.
5. Ship the tenant resolver and its tests before the new Studio actions. Backfilled profile overrides keep the current organization behavior for the profile they already used.
6. Ship the HQ API and screens.
7. HQ publishes a strict default per profile version when the matrix is complete. This plan does not seed that default.
8. Run the manual check in section 11.4.
9. Deploy only when the user asks. Local code does not change `cmx.cleanmatex.com` or `hqsaas.cleanmatex.com` by itself.

Organizations with no assignment stay denied between steps 5 and 7. That is the same result they have today. Publishing a wide default would open edits. Do not do that in the migration.

## 17. Acceptance

Phase 1 is accepted when:

- the new migration applies on a database that already has `0597`
- the collision preflight raises on a fabricated duplicate and rolls the transaction back
- a clean database backfills live assignments to `PROFILE`
- no default row was inserted
- a published policy can be saved as the only live default for a version
- a pilot policy is rejected as a default
- a second live default for the same version is rejected
- a second live organization override for the same organization is rejected
- `sys_wf_resolve_edit_policy` returns cases A through I in section 3.5
- `anon` and `authenticated` still have no privilege on the new table
- the grammar triggers are gone and every operation in section 5A is present and active
- a new catalog row can be inserted by a later migration
- `CHANGE_UNLISTED` with no rule denies

Phase 2 is accepted when the resolver tests pass and Preview, context, and Apply all call that one function.

Phase 3 is accepted when the API tests pass and the service build passes.

Phase 4 is accepted when the Studio build and the touched-file lint pass, both languages contain the new keys, and the five sections render the states in section 9.7.

Phase 5 is accepted when every row in "Edit Policy extension across both repositories" is updated or recorded as verified and unchanged, and the manual check in section 11.4 shows the same Edit Policy level and the same decision in both running apps. Acceptance of this plan does not move an Order Change work package.

## 18. Risks

| Risk | Handling |
|---|---|
| Two live version assignments for one organization and one profile | Migration raises. No automatic winner |
| An organization override is broader than the operator expected | Acknowledgement column, confirmation dialog, and the unused label on profile rows |
| A later profile version adds a status | Runtime denies that status. Preview lists it. Publishing the workflow version is not blocked |
| A reusable policy is published with a partial matrix | Allowed. It cannot become a default until coverage is complete |
| Inactive assignment whose version was removed | Migration raises instead of inventing a scope |
| Tenant and HQ drift | Both call `sys_wf_resolve_edit_policy` |
| A new catalog code is allowed by a cell before its writer exists | Apply returns `OPERATION_NOT_AVAILABLE` and the control stays closed |
| Existing policies have no cell for the new pairs | Missing cell denies. No `ALLOW` backfill |
| Open reviews after a default revision | Existing `POLICY_CHANGED_REVIEW_REQUIRED` |
| Browser access to the new table | No grant, same as `0597` |

Item money precision, the 300-second review lifetime, direct table grants, and the postponed committed-column guard stay outside this plan. The operation catalog in section 5A is in scope. A seeded operation whose writer is not shipped stays closed on the screen.

## 19. Implementation gate

Implementation starts at Phase 1 only after this plan is confirmed. The agent writes the migration and stops for review. The agent does not apply it. Later phases start only after the previous phase is in place.

Every phase follows the rules at the top of this plan: existing code, complete areas, `CLAUDE.md` and its skills, separation of concerns, and reusable UI. When existing code is better, improve that code or keep it, update this plan, and record the choice in `Extend_Order_Edit_policy_STATUS.md`. A feature is not done until every required area is covered in each repository that feature needs. Close each phase with "Tasks after every phase". After Phase 5, run "Final task — generate the extension docs".
