# Changelog — Workflow Order Advance

## Unreleased — 2026-09-04

- **New Order create context gap repair:** the sticky toolbar now exposes bilingual `order_type_id` and editable `order_source_code` selectors, defaulting to `POS` / `pos`. Both values are reducer-backed, enum-validated at `/api/v1/orders/submit-order`, and passed through the canonical submit orchestrator into live Initial-rule resolution. `legacy_unknown` remains unavailable to staff entry; the service still enforces active, tenant-allowed sources.
- **WF leftover close-out:** `createOrderInTransaction` maps `OrderCreatePresetError` to the same 422 profile codes as `createOrder`. Home-collection confirm/assign/fail require `orders:transition`. Legacy JSON editors at `/dashboard/settings/workflows/new` and `[id]/edit` redirect to the hub.
- **HQ leftover close-out:** Studio persist from any tab is blocked when Initial rules lack a create preset or include a wildcard Draft. Check-policy catalog **1.3.0** emits `evidence_without_home_collection`.
- **0487 applied** locally and remotely; types regenerated. `sys_wf_prof_ver_live_rpt` emits `initial_rule_preset_missing`, `initial_rule_preset_unknown`, `initial_rule_wildcard_draft`. Do not edit applied 0479–0487.
- **HQ H1–H3 coded** in `cleanmatexsaas`: Studio Initial-rule preset picker + catalog selects; Check-policy catalog **1.2.0** (later bumped to **1.3.0**); `POST .../simulate-create`; home_collection evidence channel. Tenant pin regenerated under `generated/`.

## Unreleased — 2026-09-03

- **DOC-FINAL 2026-09-04:** Pack refresh after **0479–0486 applied** (local + remote, types regen). Tenant T0–T4 complete. HQ Studio WPs H1–H3 remain in `cleanmatexsaas`.
- **T3 complete:** Engine rejects nested hold, hold from terminal/`draft`, and resume without `hold_from_status`. Jest H1–H4 pass. **0486** HOLD edges + observer exceptions **applied**.
- **T4 complete:** Order type labels (EN/AR `orders.orderTypes.*`), distinct remote-dropoff vs home-collection banners, mobile booking `home_collection` / `collection_and_delivery` fulfillment mapping, access contracts + page gates for `/dashboard/home-collection`, nav dual-write (`navigation.ts` + **0485** applied). Jest: C5/C6 + booking type mapping.
- **T0/T1/T2a/T2b complete:** **0479–0484 applied** (operator, local + remote; types regen). **T2b runtime:** home-collection stage routes, completion service (intake stamps + CONFIRM), reusable `HomeCollectionHandoverCard`, list/detail at `/dashboard/home-collection`.
- **0478 applied** locally and remotely. Typical-owner Observer repair + Cancel/Hold reporter exceptions are live. Do not edit applied `0478`.
- New-order start-rule matching now includes `orderTypeId` (Studio “Order type code”). Create-time `PROFILE_*` failures return HTTP 422 with staff EN/AR copy in `workflow.profileErrors` instead of a generic 500 or “not configured” toast. Floor writers (ActionBar, processing Mark Ready, pickup/delivery handover, delivery proof complete, preparation complete, assembly complete, cancel/return) split runtime integrity codes instead of one `profileUnavailable` sentence or raw English `json.error`.
- HQ Check-policy issue catalog is the emit registry (severity, gates, Studio tab, Auto Fix IDs, seed_must_pass). Tenant pin: [generated/GENERATED_WF_POLICY_ISSUE_CATALOG.md](generated/GENERATED_WF_POLICY_ISSUE_CATALOG.md). File 02 remains narrative for planned codes. Maintain the catalog in HQ via `/manage-wf-policy-issues-catalog`; never hand-edit generated JSON.
- **0474 applied** locally and remotely. HQ Published→Pilot/Draft demote (`sys_wf_prof_ver_demote_sem`) is live. Do not edit applied `0474`.
- **0475 applied** locally and remotely. SIMPLE live-policy DRAFT repair seed is in; Check policy / Pilot / Publish of that draft remain manual. Do not edit applied `0475`.
- **0476 applied** locally and remotely. Public OFD exception is in `validate_live`. Do not edit applied `0476`.
- **0477 applied** locally and remotely. `sys_wf_prof_ver_live_rpt` is the shared structural report. Check policy maps catalog codes; `sys_wf_prof_ver_validate_live` fails closed on any row. Do not edit applied `0477`. Deploy HQ API + Studio, then Check policy / Start Pilot on SIMPLE v4.

## Unreleased — 2026-08-29

- Public tracking OFD confirm maps engine `PROFILE_*` to HTTP 409 and `ACTION_NOT_ALLOWED` to 403 (same helper as stage adapters). GET tracking no longer returns rack location.
- Shared `resolveWorkflowCommandChannel`: cookie session → `staff_web`, bearer JWT → `mobile`. Pickup, physical intake, and delivery complete additionally assign `pos` after a tenant-scoped OPEN POS session is verified (no client header). Client channel fields are ignored.
- Privacy-safe workflow observe events (`wf.policy.*`, `wf.command.*`, pickup/delivery commit, public confirm reject) with in-process counters. Support runbook: [technical_docs/live_runtime_support.md](technical_docs/live_runtime_support.md).
- Live-runtime assurance: Published cache vs Pilot reload, RETIRED/mismatch fail-closed, no assignment/artifact SQL at execute, 0472 `mobile`/`public_web` denies, and a broader no-artifact source scan. Matrix: [technical_docs/live_runtime_assurance.md](technical_docs/live_runtime_assurance.md).
- API contract (`06_API_Contracts.md`) now describes live profile-version runtime, server-derived channels, Workboard version grouping, and public confirm privacy/error mapping.

## Unreleased — 2026-08-28

- Ready list filters stack on the same page: `/dashboard/ready?focus=counter` is the Pickup-desk alias (both handover statuses). `staged`, `unreleased`, `due`, and `norack` combine; legacy exclusive `focus=shelf|collection|no_rack` still maps. Confirm pickup stays on Ready Details. The Ready worklist includes `pickup_handover` statuses `ready` / `ready_for_pickup` only.
- Locked live-normalized runtime law: glossary vocabulary, tenant contract, and HQ ADR-0010 (Accepted). Validator is HQ-only; resolver is tenant-only. Execution is gated (contract freeze → 0470 guard → vertical slice → remaining consumers), not a single waterfall. Direct `CONFIRM_PICKUP` stays `pickup_handover` from observed `ready` → `delivered`.
- **0470 applied** locally and remotely (plus `0471`). Tenant runtime now loads live profile-version rows for create, floor lists, engine, and pickup. New orders persist version binding only; artifact columns stay null. Direct `CONFIRM_PICKUP` from observed `ready` requires live `allow_direct_counter_pickup` plus the pickup observer edge. Unbound orders fail closed. Workboard groups by `wf_profile_version_id`.
- **0473 applied** locally and remotely. Gate warning/override ledger rows may name `profile_version_id` with a nullable historical `profile_artifact_id`. Delivery completion now fails closed when live policy is missing, matching pickup.
- Added [future_work_in_wf/00_WF_ENTITY_GLOSSARY.md](future_work_in_wf/00_WF_ENTITY_GLOSSARY.md): canonical definitions for page, module, `screen_key`, execution, channel, and UI chrome, with Ready/pickup/delivery examples. §1.1 explains that a page may host two modules (Ready Details) without owning their actions.

## Unreleased — 2026-08-27

- Added planning handoff [future_work_in_wf/](future_work_in_wf/README.md): HQ Studio validation gaps, implementable issue-code spec (EN/AR), and versioned remaining work (V1.0 close-out through V2) for tenant and HQ.

## 0.4.16-p7r-delivery-floor — 2026-08-27

- Delivery floor now matches packing/Ready: list rows open `/dashboard/delivery/{id}` with `WorkflowActionBar` plus a stage-owned Confirm Delivery card. Generic `CONFIRM_DELIVERY` stays hidden from the ActionBar.
- Added order-keyed `POST /api/v1/delivery/orders/{orderId}/complete` and `GET /api/v1/delivery/orders/{orderId}/active-stop`. An active pending/in-transit stop uses the existing stop complete command; no dummy route is created.
- Simple vs routed delivery is HQ profile policy, not a new catalog seed. Catalog already has `CONFIRM_DELIVERY` on `driver_delivery` (`TR_OFD_DELIV` has no `gate_set_code`). Bind `delivery_stop_active` / required POD evidence only on routed profiles; leave them unbound for simple tenants, then compile and publish.
- Legacy route create/assign/capturePOD stay `503`. Generic `/actions` and `/transition` still return `403 USE_DELIVERY_COMPLETE_COMMAND`. Fail/cancel delivery commands remain out of scope. S10 routed POD canary remains unsigned.

## Unreleased — 2026-08-22

- Added versioned stage-owned command adapters for Processing, Assembly, QA pass/fail, Packing, and Ready release. Cookie sessions require CSRF; bearer JWTs share the same `orders:transition` gate. Callers cannot send a guessed `toStatus`.
- Cut ActionBar, Processing list Mark Ready, item auto-complete, and V2 `useOrderTransition` onto those adapters. `FAIL_QA` now requires an auditable reason.
- Unified Ready Details into one **Pickup and collection** panel: make available, collect remaining payment through the existing Order Fin modal, and confirm customer pickup.
- Added focused stage-command route tests and access-contract API dependencies for the new adapters.
- Hardened staff delivery: generic `/actions` and `/transition` reject `CONFIRM_DELIVERY` with `403 USE_DELIVERY_COMPLETE_COMMAND`; the complete route maps workflow `VERSION_CONFLICT` to 409; local DB tests cover pay-on-collection, tenant isolation, OTP reject, already-delivered, engine-failure rollback, happy-path route counters, stale-version rollback, idempotent replay, and serialized dual-complete. Complete requires `delivery:pod` and `orders:transition`. Legacy capturePOD/route writers remain 503. S10 canary is not signed off.
- Cut floor worklists onto server-side `workflow_screen` membership. Semantic orders use the immutable artifact; profile-stamped orders without a compiled artifact are excluded; legacy unsnapshotted orders use the live contract or catalog. Historical `ready`/`delivery` aliases map to `ready_release`/`driver_delivery`.
- Retired graph-pin execution for snapshot orders. The engine, floor lists, Workboard, and new-order initial-status path no longer load a pinned graph. A `wf_profile_id`/`wf_version_no` pin without compiled artifact identity fails closed (`PROFILE_SNAPSHOT_INCOMPLETE` / `PROFILE_INITIAL_RULE_UNMATCHED`). Unsnapshotted historic orders still use live catalogs.
- Added automated semantic-profile assurance: Pilot is executable only on HQ-validated test/demo tenants; latest-assignment still selects PUBLISHED; forged screen/channel edges return no action; missing artifact rows fail closed; `PROFILE_*` integrity codes map to HTTP `409` on stage, actions, transition, pickup, preparation, delivery complete, and available-actions. See [technical_docs/semantic_profile_assurance.md](technical_docs/semantic_profile_assurance.md).


- Added the tenant semantic workflow artifact loader and runtime adapter. Semantic orders now resolve action visibility and command edges from their exact immutable profile artifact rather than mutable profile assignments, graph pins, screens, transitions, or action maps.
- Extended the shared workflow engine to load the order artifact for action list and execute commands, enforce module status visibility, explicit channel bindings, reason requirements, and fail-closed evidence/non-hard-gate behavior. Incomplete or invalid artifact snapshots return typed `PROFILE_*` errors rather than falling back.
- Hardened semantic action ownership: observer screen memberships remain readable but cannot expose or execute actions, even when malformed compiled artifact data contains an execution edge. Shared runtime enforcement requires an enabled `primary_owner` module and `owner` status membership, while preserving only explicit `cross_cutting_command` surfaces such as `public_tracking`.
- Hardened semantic order creation: all semantic create paths now use immutable artifact initial rules, including direct normal intake and Quick Drop. An unmatched semantic policy returns `PROFILE_INITIAL_RULE_UNMATCHED` instead of silently applying legacy status shortcuts.
- Hardened semantic assignment selection: competing equally specific active profile/version bindings now fail closed instead of using creation time as an implicit business-policy precedence rule.
- Completed service-scoped assignment enforcement for order creation. Every distinct item `serviceCategoryCode` resolves its configured profile scope; mixed immutable profile snapshots now return `422 PROFILE_SERVICE_SCOPE_CONFLICT` and require an explicit order split rather than inheriting the first item policy.
- Improved the Ready pickup panel for semantic profiles: an absent configured `pickup_handover` action now shows an EN/AR policy explanation instead of an empty command area. It remains read-only until HQ compiles the required pickup module, membership, execution, and channel.
- Marked `public_tracking` as the `public_web` command channel. Internal web adapters remain `staff_web` by default; channel ownership is assigned server-side.
- Cut Workboard semantic orders over to artifact-derived Workboard membership and primary-owner routing. Its scopes are keyed by immutable artifact ID, preventing two policy revisions from sharing a supervisor queue; legacy orders retain the controlled compatibility path.
- Corrected the Workboard owner aggregate SQL to group by the complete immutable profile snapshot identity, including `wf_profile_artifact_id`. Supervisor stage totals can no longer merge orders governed by separate compiled artifacts.
- Added a semantic order-control consistency check: fixed hold/stop behavior must match the artifact destination, and dynamic resume may restore only a status declared by the artifact. Misconfigured policy is rejected with `PROFILE_EXECUTION_INVALID` rather than silently rewritten by legacy control logic.
- Added `workflow-gate-evaluator.service.ts`, shared by semantic action discovery and execution. It evaluates rack/preparation/financial hard-block gates from the transaction-locked order facts, blocks positive outstanding balances with `GATE_FIN_RELEASE`, and keeps unknown semantic gates fail closed. `CREDIT_INVOICE` calls the isolated B2B payment-hold seam, which is currently non-blocking because order creation owns the existing B2B credit decision; the future B2B feature will replace that implementation with its durable policy.
- Extended the shared evaluator with piece, QA, fulfilment, and evidence facts. `all_pieces_scanned`, `all_items_ready`, `all_pieces_ready`, `qa_passed`, `pickup_collection_settled`, `delivery_collection_settled`, `pickup_release_valid`, `delivery_stop_active`, and `pod_evidence_valid` now use locked tenant order facts. Missing facts fail closed in semantic mode. `partial_fulfilment_supported`, `return_service_available`, and OTP proof remain fail closed. Catalog seed `0463_sys_wf_gate_ops_fulfilment.sql` applied locally and remotely (operator confirmed 2026-08-22). No schema or generated-type change.
- Removed V2 destination guessing from Processing, QA, Assembly, and Packing action callers. The workflow-context compatibility read now projects enabled modules from the order-pinned artifact for semantic orders and fails closed for a bad snapshot; live template-stage configuration remains legacy-order-only.
- Added focused artifact/runtime tests and updated the API, developer, testing, plan, and current-status documentation. Legacy orders and Workboard remain on the temporary pinned-graph compatibility path pending consumer cutover and integration assurance.

## 0.4.9-p7r-delivery-proof-audit — 2026-08-21

- Added the reusable Delivery proof and handover audit card to both Delivery Stop Detail and the Order Details **Delivery Proof** tab.
- Added `GET /api/v1/delivery/orders/{orderId}/proof`, backed by a tenant-scoped service that resolves handover actor, time, notes, payment state, workflow outcome, and completed POD records.
- Removed legacy proof URLs from the ordinary delivery-stop read payload. Private evidence keys remain server-only and are converted to five-minute signed links only for the authorized audit response.
- Added focused service/API tests for tenant isolation, exact tenant-stop key signing, actor resolution, legacy-read compatibility, and stable order-not-found handling.
- Refreshed the README, user/developer/test/deploy/RBAC/API/risk/current-status documentation so proof/audit availability is not confused with the still-blocked staff delivery-completion rollout.

## 0.4.8-pickup-cutover-hardening — 2026-08-15

- Migrations `0447_ready_for_pickup_workflow_status.sql` and `0448_pickup_cutover_integrity.sql` applied successfully to local and remote databases (operator confirmed 2026-08-15). `0448` reconciles the `0447` cutover window, backfills missing fulfilled-release version audit values, and enforces one open pickup release per tenant order.
- Made staged `ready_for_pickup` handover fail closed when its release audit is missing; the service no longer manufactures a replacement record.
- Added first-class bearer-JWT authorization for mobile/integration pickup completion while preserving CSRF protection for browser session calls.
- Added strict pickup route parameter/body validation and focused authorization, service, route, and real-local-database test coverage.
- Local database acceptance passed: all direct/staged handover, missing-release, and active-release uniqueness scenarios succeed.

## 0.4.7-p7r-counter-pickup — 2026-08-15

- Migration `0446_pickup_handover_workflow.sql` applied to local and remote (operator confirmed 2026-08-15)
- Kept `RELEASE_FOR_PICKUP` as the `ready` → `ready` availability event and renamed it **Make available for pickup**
- Added `CONFIRM_PICKUP` on `pickup_handover`, using the existing `TR_READY_DELIV` edge for actual counter handover
- Added `POST /api/v1/pickup/orders/{orderId}/complete` and `PickupCompletionService`: tenant lock, optimistic state version, idempotency replay, pay-on-collection block, partial-release fail-close, release fulfilment, engine/history/outbox in one transaction
- Added Ready-screen Cmx confirmation UX, EN/AR copy, payment-first behavior, and focused service/API regression coverage
- Added a tenant-scoped pickup-release read model used by Ready worklists, Ready details, and safe public tracking: staff can now distinguish **Not yet available for pickup** from **Available for pickup**, including release time.
- Made the active pickup release the prerequisite for public Ready confirmation; the public command delegates to `PickupCompletionService` rather than bypassing counter-handover safeguards.
- Hid completed release actions in the Ready UI and reject duplicate active pickup/delivery releases in `WorkflowEngine`, including calls from API/mobile integrations.

## 0.4.6-sys-wf-profile-presets — 2026-08-14

- Create-only migration (pending review/apply): `0445_sys_wf_profile_presets_seed.sql`
- Additional published HQ profiles (no auto assign):
  - `WF_V2_SIMPLE`, `WF_V2_ASSEMBLY_QA`, `WF_V2_PICKUP_DELIVERY`, `WF_V2_OUTSOURCE`, `WF_V2_ISSUE_REPROCESS`
- Each v1: capabilities + enabled screens + `based_on_template_id` lineage + `config_json` plan hints
- ADR §5A preset catalog updated in [ADR_SYS_WF_PROFILES.md](ADR_SYS_WF_PROFILES.md)

## 0.4.5-sys-wf-profiles-schema — 2026-08-14

- ADR: [ADR_SYS_WF_PROFILES.md](ADR_SYS_WF_PROFILES.md) — HQ profiles own capabilities/screens; graph stays global `sys_wf_*`
- Migration `0444_sys_wf_profiles_and_versions.sql` **applied** to local and remote (operator confirmed 2026-08-14)
  - `sys_wf_profiles_cd`, `sys_wf_profile_ver_mst`, `sys_wf_prof_ver_scr_dtl`
  - Immutability triggers for `PUBLISHED` versions
  - FKs from `org_wf_profile_assign_cf` → profiles / (profile, version)
  - Seed `WF_V2_STANDARD` published v1 (no auto tenant assign)
- Inventory: [WORKFLOW_TABLES_INVENTORY.md](WORKFLOW_TABLES_INVENTORY.md) — Gen 0–3 table map from `work` / `wf` Table Editor searches
- Unblocked: HQ Phase D profile/assign screens in cleanmatexsaas; types regenerated by operator (2026-08-14)

## 0.4.4-p7r-preparation-command — 2026-08-14

- Replaced direct Preparation status mutation with an authenticated, tenant-scoped stage-owned completion command and `POST /api/v1/preparation/{orderId}/complete` adapter
- Made Preparation ready-by metadata, `COMPLETE_PREPARATION`, workflow history, outbox, and idempotency replay storage one rollback-safe transaction
- Required `Idempotency-Key`, `orders:update`, and `orders:transition`; stale versions return the workflow conflict rather than overwriting another operator
- Converted the legacy Preparation server action into a compatibility adapter that ignores browser-provided tenant/user IDs and resolves the authenticated context on the server

## 0.4.3-p7r-foundation — 2026-08-14

- Added the server-disabled `POST /api/v1/delivery/stops/{stopId}/complete` P7R contract and stage-owned completion service
- Made `WorkflowEngine.executeAction` transaction-composable so stage operations can commit POD, stop, route, workflow history, and outbox writes atomically
- Added tenant-scoped stop/route/order locking, method-specific POD checks, idempotency replay/conflict handling, route counter refresh, and the `PAY_ON_COLLECTION` remaining-balance block
- Added focused fail-closed API coverage; staff delivery remains disabled pending database-backed acceptance coverage and rollout approval

## 0.4.2-delivery-no-go — 2026-08-14

- Release audit reopened `integ-delivery` and P7 hardening; full V1.0 is not production-ready
- Disabled legacy raw-status quick actions and the staff direct **Mark delivered** shortcut
- Corrected the Delivery worklist to the canonical `driver_delivery` screen key
- Added seeded permission guards to delivery mutation APIs and explicit tenant predicates to affected updates/lookups
- Permission-gated order transition/edit/repair controls and added confirmation for terminal `STOP_ORDER_WORK`
- Kept public anonymous confirm-received available under its separately tested contract
- Remaining blockers: atomic POD/order/stop/route commit, durable validated evidence, route consistency, idempotency/concurrency, and deferred-payment collection policy

## 0.4.1-rpc-grants-deployed — 2026-08-14

- Operator confirmed `0442_retire_workflow_rpc_grants.sql` applied successfully to local and remote databases
- Legacy/Enhanced workflow function definitions remain retained for controlled rollback
- Post-apply workflow smoke and pilot T01-T18 remain production acceptance gates

## 0.4.0-workflow-engine-cutover — 2026-08-13

- Cut all production workflow mutation routes/services over to configured application-engine actions
- Retired raw order status PATCH/bulk mutation contracts with authenticated `410` responses
- Replaced screen-contract and allowed-transition RPC readers with tenant-safe catalog/application-engine reads
- Added create-only migration `0442_retire_workflow_rpc_grants.sql`; functions are retained for controlled rollback
- Added order-control policy tests and anonymous opaque public-tracking Playwright coverage
- Verified 49 focused Jest tests and 2 anonymous Playwright scenarios

## 0.3.10-p7-doc-pack-hardening — 2026-07-25

- Added targeted Jest coverage for public tracking token utilities and service fallback behavior
- Refreshed workflow feature docs for opaque public tracking links, pay-on-collection notice behavior, and delivered-state confirm disabling
- Added the missing documentation-pack guides: developer, user, deploy, testing, and technical notes

## 0.3.9-p4-public-tracking-token — 2026-07-25

- Added create-only migration `0441_public_order_tracking_tokens.sql` for opaque `/track/{token}` customer links
- Added token-based public tracking page + APIs while keeping readable legacy links as rollout compatibility fallback
- Dashboard public-link copy actions and receipt QR generation now prefer opaque tracking paths instead of `{tenantId}/{orderNo}`

## 0.3.8-p4-public-tracking-ux — 2026-07-25

- Public tracking now surfaces the remaining `PAY_ON_COLLECTION` amount inline with the current order status
- Confirm-received button now disables once the order reaches `delivered` or the public confirm succeeds
- Public confirm action errors now stay inline on the tracking page instead of collapsing into the full-page load error state

## 0.3.7-p6-tenant-profile-ui — 2026-07-25

- `settings/workflows` now switches to a read-only V2 tenant profile view when `workflow_engine_v2` is enabled
- Added tenant-safe workflow profile read service using existing template tables plus published `org_wf_profile_assign_cf` / `sys_wf_*` catalogs when present
- Added EN/AR workflow profile tabs for overview, assignments, approved templates, operational screens, and category overrides

## 0.3.6-p4-public-confirm-actor — 2026-07-25

- Public confirm-received → `CONFIRM_DELIVERY` + `WORKFLOW_SYSTEM_ACTOR` when V2 on
- Migration (create only): `0437_sys_wf_public_confirm_actor.sql` (system user + `public_tracking` + `TR_READY_DELIV`)
- IP rate limit helper for public confirm; ActionBar `hasLoaded` false-bounce fix
- P3: `PATCH /api/orders/.../status` + `POST /api/orders/bulk-status` return 410 when V2 on

## 0.3.5-adr-cancel-hold-stop — 2026-07-25

- ADR lock: cancel allowlist + hold/resume + STOP_ORDER_WORK + no auto Fin unwind + return V1.1
- Migration (create only): `0436_sys_wf_cancel_hold_stop_adr.sql` (consolidated; unapplied 0436/0437 drafts removed)
- Orchestrator: narrow cancel; remove auto unwind; RETURN deferred
- Engine: `hold_from_status`, gate `prep_not_completed`, HOLD/RESUME/STOP
- UI: order_control ActionBar; cancel dialog Fin-hint (V2)

## 0.3.4-p3b-cancel-return-p5 — 2026-07-25

- Cancel/return orchestrator (superseded by 0.3.5 for money + allowlist)
- Engine writes `cancelled_*` / `returned_*` audit columns on CANCEL/RETURN
- P5: `POST …/transition` never calls Legacy/Enhanced when `workflow_engine_v2` is on

## 0.3.3-p3-stage-engine — 2026-07-25

- `useOrderTransition` uses `/available-actions` + `/actions` under client canary
- Engine: `preferredToStatus`, rack from input for gates/write; action list includes `toStatus`
- `WorkflowActionBar` on processing / assembly / qa / packing
- Migration (create only): `0434_sys_wf_stage_skip_transitions.sql` for template skip edges

## 0.3.2-graph-fix-flag — 2026-07-24

- Graph check #2 gap `ready_release:packing→ready` → fix migration `0431` (deactivate bad MARK_READY map)
- HQ flag migration `0432_add_feature_flag_workflow_engine_v2` via create-feature-flag skill
- Cleaned `check_sys_wf_graph.sql` (removed pasted result rows)

## 0.3.1-prod-decision — 2026-07-24

- Expert lock: rename map **deferred**; additive V1.0 only ([PRODUCTION_DECISION_RENAME.md](PRODUCTION_DECISION_RENAME.md))
- HQ catalog key `workflow_engine_v2` + `resolveWorkflowEngineV2Enabled(tenantId)`
- `WorkflowActionBar` on preparation + ready; FastItemizer uses prep `/complete` under canary
- Graph integrity SQL: `scripts/workflow/check_sys_wf_graph.sql`

## 0.3.0-p1-p2-engine — 2026-07-24

- Added migrations (create only): `0427_sys_wf_catalogs_and_state_version.sql`, `0428_org_wf_release_records.sql`
- Implemented `WorkflowEngine` + `available-actions` / `actions` APIs + action constants
- Wired prep complete (ban `sorting`), transition canary, POD→`CONFIRM_DELIVERY`, retail initial rules under flag
- P3 partial: confirm-physical-intake, batch auto-ready via engine; writer inventory doc
- Engine writes release rows on RELEASE_FOR_* (after `0428`); sets `ready_at` / `delivered_at`
- Added `initial-status-resolver`, `useWorkflowActions`, Prisma `state_version` fields
- Overnight checkpoint; remote discovery still unsigned (MCP execute_sql)

## 0.2.1-p0-discovery — 2026-07-24

- Prefer **remote** DB for discovery; added [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md)
- Locked reuse of `org_domain_events_outbox` + `org_idempotency_keys` from code
- Closed 06 API inventory + accepted HQ/release defers
- Remote MCP `execute_sql` pending reconnect (auth succeeded; client registration failed)

## 0.2.0-p0-correction — 2026-07-24

### Changed (expert correction pass after ChatGPT review)

- Added ADR: engine-first V1.0; V1.1 projections/work groups; V1.2 outsourcing/HQ designer
- HQ-authored publish/assign; tenant read-only effective profile + approved-list pick
- Concurrency → `state_version` (not `updated_at` alone)
- Retail auto-`closed` removed
- Delivery finalize → atomic `CONFIRM_DELIVERY`
- Outbox → reuse central service
- Rename policy → additive-first
- Stage executions / multidim / work groups deferred to V1.1 (not dropped forever)
- Progress status corrected: P0 incomplete; P1 blocked
- Tests expanded for V1.0; deeper suites listed for V1.1+

## 0.1.0-p0-design — 2026-07-24

- Initial design pack draft (superseded in part by 0.2.0 correction)
