# Changelog — Workflow Order Advance

## Unreleased — 2026-09-05 (3)

- **Gate 5 (compiler/artifact retirement) — evidence audit + retirement drafted, not applied.** Investigated whether the legacy compiled-artifact commit mechanism (superseded by ADR-SAAS-MNG-0010's live-normalized runtime) is actually unused, rather than assuming from the docs. Confirmed on both sides: (1) zero application code in `web-admin` reads `sys_wf_prof_ver_artifact_cf` — only generated types and `workflow-engine.no-legacy.test.ts`, which source-scans for its absence; (2) `sys_wf_prof_ver_guard()` (migration `0470`, already applied) no longer checks the artifact table for PUBLISHED — replaced with `sys_wf_prof_ver_validate_live()`; (3) in `cleanmatexsaas`, `WorkflowEngineConfigRepository.commitSemanticProfileArtifact()` (the only writer, wrapping RPC `sys_wf_prof_ver_commit_art`) and `.getCurrentSemanticArtifact()` (the only reader) both had **zero callers** anywhere in HQ; (4) live remote data confirmed it — all 19 current profile versions (3 DRAFT/5 PILOT/11 PUBLISHED) have `current_artifact_id IS NULL`, and `sys_wf_prof_ver_artifact_cf` holds exactly 2 rows, both dated 2026-08-27 (during/before the 0470 cutover), nothing since.
  **HQ dead-code removed** (`cleanmatexsaas`, done this session): `commitSemanticProfileArtifact()`, `getCurrentSemanticArtifact()`, the `WfSemanticArtifactRow` local type alias, and the `WfSemanticArtifactCommit` exported type — all unused. tsc clean (no new errors), eslint clean, `workflow-engine-config` module gates: 10/10 suites, 98/98 tests green.
  **Tenant migration drafted, not applied**: `supabase/migrations/0494_wf_prof_ver_artifact_retirement.sql`. Pre-flight `RAISE`-guards re-verify the "nothing stamped" evidence at apply time (fails loudly rather than silently dropping something in use). Rewrites the four still-live functions that touched the retiring table/columns purely as invalidation bookkeeping (`sys_wf_prof_ver_guard`, `sys_wf_prof_ver_save_policy`, `sys_wf_prof_ver_clone_sem`, `sys_wf_prof_ver_delete_draft_sem` — the last one also drops an artifact-linked `org_wf_gate_decision_mst` ledger join that can never match, 0 ledger rows exist), then drops the FK, the 5 vestigial columns on `sys_wf_profile_ver_mst` (`current_artifact_id`/`compiled_schema_version`/`compiled_checksum`/`compiled_at`/`compiled_by`), the `sys_wf_prof_ver_artifact_cf` table itself (RESTRICT, no CASCADE — its own immutability trigger drops with it), and the two now-orphaned functions (`sys_wf_prof_art_guard`, `sys_wf_prof_ver_commit_art`). `org_wf_gate_decision_mst.profile_artifact_id` is deliberately left untouched — different table, 0 rows, out of scope.
  **Awaiting operator review + apply.** After apply: regenerate `cleanmatexsaas` platform types (HQ rule), re-run the `workflow-engine.no-legacy.test.ts` source-scan (should stay green — table no longer exists to read), and close the residual "Gate 5 compiler retirement" line in the paired HQ plan (`workflow_live_profile_runtime_20260827.plan.md`) and `current_status.md`.

## Unreleased — 2026-09-05 (2)

- **Outbox hardening — dead `ORDER_WORKFLOW_TRANSITIONED` write removed.** Auditing the checklist's "central outbox; no duplicate notify" item found `executeAction` (`workflow-engine.service.ts`) wrote a row into `org_domain_events_outbox` on every transition, but `outbox-processor.service.ts`'s handler registry never had a consumer for that event type — every row was silently claimed and marked processed as a no-op, with zero test coverage. Removed the write, the `emitWorkflowTransitionOutbox` helper, and the now-dead `WORKFLOW_OUTBOX_EVENT_TYPE` constant (and its assertion in `workflow-engine.gates.test.ts`) rather than carry a dead code path forward. **Operator decision: intentionally inert for V1.0** — a real workflow-transition notification consumer is out of scope for this release. Gates: tsc clean, eslint clean, `workflow-engine.gates.test.ts` (10/10) and the two other `workflow-engine*.test.ts` suites green.
  **T17 (central outbox, no duplicate notify) closed.** The real duplicate-notify risk was in the legacy compat route `app/api/v1/orders/[id]/transition/route.ts`, which called `emitNotificationEvent()` directly for `ready`/`cancelled` transitions unconditionally — including when `executeAction` returned a cached idempotent replay rather than a fresh transition, since `executeAction` had no "was this a replay" signal. A client retry with the same `Idempotency-Key` (network retry, double-click, mobile resend) re-sent a real customer/staff notification. Fixed: `ExecuteActionResult` gained an optional `replay?: boolean`, set only on the idempotency-cache-hit path inside `executeAction`; the legacy route now skips the notify call when `result.replay` is true. `executeCancelOrReturnAction` returns `executeAction`'s result unmodified, so cancel/return gets the same protection for free. New `__tests__/api/v1/orders-transition.route.test.ts` proves a fresh transition notifies once and a replay notifies zero times. Gates: tsc clean, eslint clean, 10 suites / 64 tests green (workflow-engine, delivery-completion, pickup-completion, public-order-tracking, the new route test).

## Unreleased — 2026-09-05

- **Delivery Feature Completion — Phases 4–6.** Replaced the Driver Routes placeholder with a tenant-safe dispatcher workspace at `/dashboard/drivers/routes`: eligible `out_for_delivery` orders are prefiltered through the active-stop read API, selected in bulk, previewed, and submitted to the existing transactional create command. Planned routes support manifest inspection, add selected orders, remove stop, cancel, and driver assign/reassign. The shared `DriverPicker` is searchable and surfaces an active-route warning without blocking a valid sequential assignment; it is reused in `DeliveryRouteManifest`. Every mutating interaction has loading, success/error feedback, and Cmx confirmation where destructive. EN/AR catalogs, RTL Storybook coverage, page/API access contract, and generated platform inventories are refreshed.
- **Phase 5 rollout authorized.** `STAFF_DELIVERY_WRITES_ENABLED` is now `true` after the owner confirmed `0491` is applied on local and remote and approved the remaining phases. The only reopened writes are the CSRF/RBAC-protected route command APIs backed by the transactional service and database uniqueness backstop; the legacy delivery service and unsafe POD/OTP routes stay deleted. Focused safety test now proves an authorized route-create request reaches the hardened command.
- **Route visibility contract follow-up applied.** `0492_nav_drivers_routes_orders_read.sql` is applied locally and remotely. It aligns the DB `drivers_routes` navigation row with the page's `drivers:read` + `orders:read` contract, because the dispatcher surface displays order addresses and validates active-stop ownership.

- **Delivery Feature Completion — Phase 1 (schema) drafted, not applied.** Root cause of tonight's manual S10 seed: route creation and driver assignment sit on a legacy `DeliveryService` (`web-admin/lib/services/delivery-service.ts`) with a real bug (`createRoute` isn't transactional and silently swallows stop-insert failures, returning `success: true` with a route claiming stops it doesn't have) and also exposes `capturePOD`/`generateOTP`/`verifyOTP` — a second, unsafe path to `CONFIRM_DELIVERY` that bypasses everything `delivery-completion.service.ts` correctly enforces (pay-on-collection gate, compiled-evidence validation, idempotency). Driver management + route-planning UI were explicitly deferred (placeholder screens say so in their own source comments); no `org_drivers_mst` table existed.
  Full plan reviewed and approved: `C:\Users\JHNLP\.claude\plans\merry-singing-pike.md` (6 phases — schema, backend commands, Drivers CRUD, route-planning UI, legacy retirement + `STAFF_DELIVERY_WRITES_ENABLED` flip, docs sign-off).
  Migration `0490_org_drivers_mst_and_route_safety.sql`: new `org_drivers_mst` (tenant driver master data, RLS, nullable `linked_user_id` FK to `org_users_mst` pre-wired for the separately planned `driver_app` mobile initiative — not built now); composite FK `org_dlv_routes_mst.driver_id → org_drivers_mst`; a **real correctness gap fixed at the DB level** — `org_dlv_stops_dtl`'s only uniqueness constraint was per `(route_id, order_id)`, not per order, so nothing stopped the same order being double-booked onto two different routes — added a partial unique index (`WHERE stop_status_code NOT IN ('cancelled','failed')`) as the actual backstop; and `org_dlv_route_seq_cf`, a small per-tenant/year counter table for race-free route-number generation (atomic UPSERT-increment — no existing generic document-sequence utility fit; `org_tax_doc_seq_counters` is fiscal-grade and the wrong tool). Both new constraints self-check for existing violations and `RAISE` rather than silently resolving them.
  **Awaiting operator apply. No code changes yet — schema only.**
- **Phase 1 applied by operator** (local + remote, confirmed): `org_drivers_mst`, `fk_dlv_route_driver`, `org_dlv_route_seq_cf`, and the `uq_dlv_stops_active_order` partial unique index all present on both databases. `prisma/schema.prisma` updated with `org_drivers_mst` and `org_dlv_route_seq_cf` models (composite PKs/FKs matching the migration exactly) and `npx prisma generate` run — the two new tables are now typed like every other model.
- **Delivery Feature Completion — Phase 2 (backend commands) done.** New `lib/services/delivery/delivery-route-command.service.ts`: `createRoute`, `addOrdersToRoute`, `removeStopFromRoute`, `cancelRoute`, `assignDriver` — all `prisma.$transaction` + `SELECT ... FOR UPDATE` row locking + `claimIdempotencyKey`/`deleteIdempotencyHash`, mirroring `delivery-completion.service.ts`'s proven shape. Uses typed Prisma model calls throughout (`org_dlv_routes_mst`, `org_dlv_stops_dtl`, `org_customer_addresses`, `org_customers_mst`); raw SQL is scoped to exactly the three cases with no Prisma equivalent — `SELECT ... FOR UPDATE` locking, the `org_dlv_route_seq_cf` atomic upsert-and-return route-number sequence, and `org_drivers_mst` access before its Prisma model existed (now typed too). **Real bug found and fixed before it shipped**: the customer-address resolver could return `address: null` for a customer with no address on file, but `org_dlv_stops_dtl.address` is `NOT NULL` at the DB level — fixed with an explicit non-null fallback (`"No address on file — contact customer for pickup/delivery location"`) so a route can always be created and the gap is visible to the dispatcher instead of crashing.
  Moved `listRoutes` into `delivery-route-query.service.ts` (converted from raw Supabase client calls to typed Prisma, matching the rest of that file). **Deleted entirely**: `lib/services/delivery-service.ts` (the legacy non-transactional `createRoute` that silently swallowed stop-insert failures) and `lib/errors/delivery-errors.ts`; deleted the second, unsafe `CONFIRM_DELIVERY` path — `stops/[stopId]/pod/route.ts`, `orders/[orderId]/generate-otp/route.ts`, `orders/[orderId]/verify-otp/route.ts` (all three bypassed `delivery-completion.service.ts`'s pay-on-collection gate, compiled-evidence validation, and idempotency claiming).
  Rewired `POST /api/v1/delivery/routes` and `POST /api/v1/delivery/routes/:id/assign` onto the new command service (CSRF + zod-validated, still gated behind `STAFF_DELIVERY_WRITES_ENABLED=false` — unchanged, flips only in Phase 5). Added `POST /api/v1/delivery/routes/:id/orders` (add orders to a `planned` route), `POST /api/v1/delivery/routes/:id/cancel` (release non-delivered stops, leave delivered ones untouched), `DELETE /api/v1/delivery/routes/:id/stops/:stopId` (remove one stop from a `planned` route).
  New `__tests__/db-integration/delivery-route-command.db.test.ts` — 12/12 passing against the real local DB: happy-path create with sequenced stops, branch-mismatch rejection, non-eligible-order rejection, tenant isolation, idempotent replay, a genuine concurrent double-booking race (two `createRoute` calls sharing one order — exactly one wins with `ORDER_ALREADY_ON_ROUTE`), a direct proof the `uq_dlv_stops_active_order` partial unique index itself rejects a second active stop (`P2010`/`23505`), add-orders lifecycle + `ROUTE_NOT_PLANNED` guard, remove-stop, cancel-leaves-delivered-untouched, driver assignment + inactive-driver rejection, and the driver-double-booking warning (non-blocking, per architecture decision #12). Confirmed zero leaked rows after the run. Updated `__tests__/api/v1/delivery-safety.route.test.ts` and deleted `__tests__/services/delivery-service.test.ts` (tested only the retired service).
  Gates: tsc clean (3 pre-existing unrelated baseline errors only), eslint clean on all touched files, 49/49 delivery jest unit tests, 9/9 existing + 12/12 new DB-integration tests, all green. `npm run build` could not be run this session (tool permission denied) — **pending before Phase 2 is fully closed**.
- **Delivery Feature Completion — Phase 3 (Drivers CRUD) done.** Removed `featureFlag: FLAG_KEYS.DRIVER_APP` from the 3 `drivers`/`drivers_list`/`drivers_routes` nav nodes in `config/navigation.ts` — that flag gates the separate, future driver mobile app, not this staff dispatcher UI (`driver_app` stays on the tenant `feature_flags` JSON default for that future initiative). Dual-write migration `0491_nav_drivers_remove_driver_app_gate.sql` clears the matching `sys_components_cd.feature_flag` and also fixes a pre-existing drift found while reviewing those rows: DB `roles=['admin']` only vs. `navigation.ts`'s 4 roles — corrected to match, per the `/navigation` skill's roles-must-match rule. Removed the same `featureFlags: ['driver_app']` gate from `drivers-access.ts`'s two page contracts (the actual enforcement layer — leaving it would have made the nav fix cosmetic, since the page-level gate would still 503/redirect). `check:ui-access-contract --route=/dashboard/drivers --wire` and `sync:ui-access-contract` both pass clean (drift: 0).
  New `lib/constants/permissions/drivers-perm.ts` (`DRIVERS_PERMISSIONS`/`DELIVERY_PERMISSIONS`, mirroring the 8 already-seeded `drivers:*`/`delivery:*` codes — no new migration needed). New `app/actions/drivers/drivers-actions.ts` (`getDrivers`, `createDriver`, `updateDriver`, `toggleDriverActive`) — explicit `hasPermissionServer` guard per action (stricter than the terminals template it otherwise mirrors), deactivation blocked while the driver has a `planned`/`in_progress` route. New `src/features/drivers/model/driver-schema.ts` (zod) and `lib/types/drivers.ts` (`OrgDriver`). Replaced the `/dashboard/drivers` placeholder with a real `DriversListScreen` (`CmxDataTable`, `CmxSwitch`, `CmxConfirmDialog`, loading/error/empty states, `cmxMessage` for all feedback) + `DriverFormDialog` (RHF + zodResolver). Expanded `drivers.json` in both locales.
  **Real, repo-wide TS pitfall found and fixed while wiring the components**: a `{success:true;data:T}|{success:false;error:string}` discriminated-union return type fails to narrow under this repo's `strict:false` tsconfig (confirmed with an isolated repro) — fixed by matching the actual established convention (`terminals-actions.ts`): a flat `{success:boolean;data?:T;error?:string}` type with a `success && data` / `!success` double-guard at call sites. Saved as a standing memory so it isn't rediscovered next time.
  Gates: tsc clean (same 3 pre-existing baseline errors only), eslint clean, `check:i18n` clean, all 16 access-contract/page-registry/platform-inventory jest tests green. **Manual browser click-through not done this session** — no browser tool available; automated verification only (typecheck/lint/i18n/access-contract/unit tests). `npm run build` still pending (tool permission denied).

## Unreleased — 2026-09-04

- **New Order create context gap repair:** the sticky toolbar now exposes bilingual `order_type_id` and editable `order_source_code` selectors, defaulting to `POS` / `pos`. Both values are reducer-backed, enum-validated at `/api/v1/orders/submit-order`, and passed through the canonical submit orchestrator into live Initial-rule resolution. `legacy_unknown` remains unavailable to staff entry; the service still enforces active, tenant-allowed sources.
- **WF leftover close-out:** `createOrderInTransaction` maps `OrderCreatePresetError` to the same 422 profile codes as `createOrder`. Home-collection confirm/assign/fail require `orders:transition`. Legacy JSON editors at `/dashboard/settings/workflows/new` and `[id]/edit` redirect to the hub.
- **HQ leftover close-out:** Studio persist from any tab is blocked when Initial rules lack a create preset or include a wildcard Draft. Check-policy catalog **1.3.0** emits `evidence_without_home_collection`.
- **0487 applied** locally and remotely; types regenerated. `sys_wf_prof_ver_live_rpt` emits `initial_rule_preset_missing`, `initial_rule_preset_unknown`, `initial_rule_wildcard_draft`. Do not edit applied 0479–0487.
- **0488 applied by operator:** `WF_V2_HOME_COLLECTION` is a standalone normalized unsigned DRAFT v1, with explicit home-collection ownership, commands, channels, evidence, preset-backed Initial rules, and a structural validation postcondition. It creates no tenant assignment; HQ Check policy → Compile → Pilot remains required.
- **Check policy + Compile verified clean (local):** ran `WorkflowPolicyValidator.checkProfileVersion` and `WfSemanticProfileCompilerService.compileProfileVersion` directly (`cleanmatexsaas/platform-api`) against `WF_V2_HOME_COLLECTION` v1 on local DB — both `ok: true`, 0 issues, catalog **1.3.0**. Pilot promotion (`POST .../pilot`, `workflows.manage`) is a mutating, audited lifecycle action and stays an operator step in Studio; not run.
- **Piloted + assigned — confirmed on remote:** `WF_V2_HOME_COLLECTION` v1 `version_status = PILOT`. Tenant `c9ac29d1-219c-4a3a-8887-f860550c32be` ("Demo Saudi Riyadh Dry Clean") is `is_hq_test_demo = true` — governance rule satisfied.
- **HC1 create step confirmed (remote):** `ORD-20260904-0001` created with `order_type_id=HOME_COLLECTION`, `order_source_code=customer_mobile_app` → `status=awaiting_collection`, and `org_orders_mst.wf_profile_id/wf_version_no` bound to `a1000000-…073` / `1` — the order correctly resolved to the new PILOT profile, not a legacy/prior assignment. Remaining HC1 steps (Assign → Confirm) not yet run.
- **Bug found + fixed: floor screens empty for `WF_V2_HOME_COLLECTION` orders (all screens, not just home_collection).** Root cause: `sys_wf_prof_ver_evidence_cf.fulfilment_channel` allows `'home_collection'` at the DB level (CHECK constraint) and HQ's `FULFILMENT_CHANNELS` already includes it, but the tenant-side runtime resolver's zod schema (`semantic-workflow-artifact.service.ts`) only allowed `'pickup'|'delivery'`. Any policy artifact with a `home_collection` evidence row failed whole-artifact validation, so the entire profile version was excluded from every floor-screen worklist (`home_collection`, `processing`, `workboard` all confirmed empty; `WF_V2_SIMPLE`, with no such row, worked fine). Fixed: `semantic-workflow-artifact.service.ts` evidence enum and the matching `EvidenceRow` type in `workflow-policy-resolver.service.ts` now include `'home_collection'`. Typecheck clean on both files. Also fixed a pre-existing, unrelated bug found during typecheck: `home-collection-list-screen.tsx` called `useScreenOrders` with `pageSize`/destructured `loading`, neither of which exist on its interface (`limit`/`isLoading`) — typecheck + eslint clean.
- **Deployed and confirmed on remote:** after deploy, `ORD-20260904-0001` (tenant `c9ac29d1-…`, `WF_V2_HOME_COLLECTION` v1) HC1 Assign → Confirm completed successfully — `status=intake`, `physical_intake_status=received`, `physical_intake_at` stamped. Regression-checked against tenant `11111111-1111-1111-1111-111111111111` (`WF_V2_SIMPLE` v4, unaffected profile) — its HC1 also completed cleanly, confirming the fix didn't disturb an already-working profile. **HC1 CLOSED.** Next: HC2 (Fail) on a new order.
- **FAIL_HOME_COLLECTION notes prompt fixed:** `WorkflowActionBar.tsx`'s `CONTROL_ACTIONS_NEEDING_NOTES` set was missing `WORKFLOW_ACTIONS.FAIL_HOME_COLLECTION` (the same pattern `FAIL_QA`/`HOLD_ORDER_WORK` already use) — clicking Fail fired the action with no reason, which the server correctly rejected (`min_reason_length: 10`), with no way to enter one. Added; typecheck + eslint clean.
- **New platform gap found (pre-existing, not specific to today's work — confirmed present on both `WF_V2_HOME_COLLECTION` and `WF_V2_SIMPLE`):** `intake → preparing` (`CONFIRM_PHYSICAL_INTAKE`, owned by the `new_order` screen) has **no UI trigger** once physical intake is already `received`. The order detail page's only intake-confirm banner is gated to `physical_intake_status === 'pending_dropoff'` (remote/mobile bookings awaiting drop-off); no `WorkflowActionBar` is rendered for the `new_order` screen anywhere, and there's no floor-queue page for it either. **Resolved for the home-collection path specifically** by an operator policy edit in HQ Studio: `CONFIRM_HOME_COLLECTION`'s `to_status` on `WF_V2_HOME_COLLECTION` v1 changed from `intake` to `preparing` (`sys_wf_prof_ver_exec_cf`, confirmed on remote) — home collection confirmation now lands directly in Preparation, skipping the stuck intermediate `intake` stage entirely. The general gap **remains open** for any other path that lands an order at `intake` (e.g. POS/staff drop-off via `CONFIRM_PHYSICAL_INTAKE` draft→intake→preparing) — logged for a follow-up decision, out of scope for this programme.
- **HC2 (Fail) confirmed on remote via order history audit** (`org_order_history`, `ORD-20260904-0003`): `out_for_collection → awaiting_collection` via `FAIL_HOME_COLLECTION`, reason `"not in home i will comeback afternoon"` correctly recorded (≥10 chars, per the notes-prompt fix). **HC2 CLOSED.** Full HC1+HC2 programme now closed for `WF_V2_HOME_COLLECTION` v1.
- **S10 staff routed POD canary SIGNED (2026-09-05).** Real operator (`admin@demo-laundry.example`, tenant `Demo Laundry LLC`), real UI (`/dashboard/delivery/routes/{route}/stops/{stop}`), real order (`ORD-20260903-0005`, `WF_V2_SIMPLE` v4 — the tenant's actively assigned profile). Completed with POD method `NOTES`. Verified atomically on remote: order `delivered` (`state_version` 3→4, `delivered_at` populated), stop `delivered`, route `completed`, `org_order_history` records `CONFIRM_DELIVERY` with a real idempotency key. Route/stop seeded via reviewed one-off migration `0490_s10_canary_route_seed.sql` since `STAFF_DELIVERY_WRITES_ENABLED=false` still blocks route creation through the normal UI/API (unchanged, separate decision) — only the already-live isolated stop-completion command was exercised, which is exactly what S10 needed to prove. Details + full audit trail: `13_Production_Readiness_Checklist.md` 2026-09-05 entry. This closes the single longest-standing blocker in the programme (unsigned since 2026-08-14) — full V1.0 go-live still has other open items (`PAY_ON_COLLECTION` gate, outbox, T01–T18, canary+rollback rehearsal).
- **Fixed stale `delivery-completion.db.test.ts` — S10's database-backed assurance is real again.** Discovered while scoping S10: the test's `seedDelivery()` never set `wf_profile_id`/`wf_version_no`/`wf_profile_version_id` on the orders it seeds, so `loadOrderArtifact` failed closed with `DELIVERY_POLICY_UNAVAILABLE` for 4 of 9 tests — the test predates the Gate 4 live-policy cutover (0470+) making per-order profile binding mandatory. **Not a bug in the delivery completion service** — the service was correctly fail-closing on missing policy binding; the test fixture just never supplied one, so the "database-backed assurance" claimed in `13_Production_Readiness_Checklist.md`/testing guide had been silently stale since Gate 4 shipped. Fixed by binding seeded orders to `WF_V2_ROUTED_POD` v1 (`sys_wf_profiles_cd`/`sys_wf_profile_ver_mst`: profile `a1000000-…061`, version `a1000000-…062`, `require_delivery_stop=true`, PUBLISHED locally / PILOT on remote — same UUIDs both places, confirmed on remote too) and switching evidence from `signature` to `photo` (that profile requires photo unconditionally; signature is optional) across all 10 call sites + both seeded evidence uploads. **All 9/9 tests now pass** against real local DB. Test-only change — no service code touched.
- **Generalized the reason/notes field — retires the `FAIL_HOME_COLLECTION` stopgap.** `WorkflowActionBar`'s hardcoded `CONTROL_ACTIONS_NEEDING_NOTES` Set and global `MIN_CONTROL_NOTES=10` constant are gone. The bar now reads `requiresReason`/`minReasonLength` directly off each action (already flowing from `sys_wf_prof_ver_exec_cf` through `listAvailableActions` — the server DTO already had these fields with a comment saying exactly this; the frontend just never read them). Semantics: `requiresReason=false` → no field; `true` + `minReasonLength=0` → shown, optional; `true` + `minReasonLength>0` → shown, mandatory at that length. Any future action needing notes (e.g. a Level-1 "Release for delivery" card) now needs **zero frontend code** — just set the two columns via Studio. Also fixed a related latent bug: the old global `MIN_CONTROL_NOTES` ignored each action's actual configured `min_reason_length`; now enforced per-action. Verified zero regression: `HOLD_ORDER_WORK`/`RESUME_ORDER_WORK`/`STOP_ORDER_WORK`/`FAIL_QA`/`FAIL_HOME_COLLECTION` all already carry `requires_reason=true, min_reason_length=10` in the live profile — identical behavior to before, just data-driven now. Also fixed the pre-existing `home-collection-handover-card.tsx` bug (`confirmAction.disabled` → `!confirmAction.enabled`, matching `WorkflowActionDto`'s real shape) while in the same code. Typecheck/eslint/i18n all clean on both repos.
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
