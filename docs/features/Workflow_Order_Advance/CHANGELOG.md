# Changelog — Workflow Order Advance

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
