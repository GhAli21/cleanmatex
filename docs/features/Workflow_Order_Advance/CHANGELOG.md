# Changelog — Workflow Order Advance

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
