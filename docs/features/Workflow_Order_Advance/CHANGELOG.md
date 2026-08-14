# Changelog — Workflow Order Advance

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
