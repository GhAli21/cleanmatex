# Current production enhancement status — 2026-10-10

**Authority:** The dated entries below are historical delivery records. The current implementation authority is [notification-hub-production-implementation-plan.md](./notification-hub-production-implementation-plan.md) and its schema/contract companion.

**Remaining work and sequencing:** see the plan's [section 23.1](./notification-hub-production-implementation-plan.md#231-remaining-work-and-sequencing-snapshot-2026-10-10) for the full outstanding-item breakdown (A1–A9 functional gaps, B1–B4 governance gates, C1–C4 release-readiness), each with its own plan and blocker status. Snapshot dated 2026-10-10 — decays as increments land; re-verify against the entries below before acting on it.

## 2026-10-10 — Campaign processor correctness fixes (process-campaigns / process-outbox)

- [x] **IMPORTANT — local/remote database drift discovered, not caused by this increment, not reconciled here.** `web-admin/types/database.generated.ts`, `web-admin/types/database.ts`, and `web-admin/prisma/schema.prisma` were already modified in the working tree (uncommitted) before this increment touched any file — confirmed via `git log`/`git diff --stat`, since nothing in this increment ever wrote to those three files. They already contain `org_ntf_camp_targets_dtl.inbox_id`, `org_ntf_campaigns_mst.queued_count`, a unique constraint literally named `uq_ntf_camp_tgt_camp_recip`, and a Postgres function `fn_ntf_camp_target_resolve(p_outbox_id, p_tenant_org_id, p_target_status, p_skip_reason) RETURNS boolean` — the exact same objects, names, and shapes this increment's migration `0601` independently designed from scratch by reading the live REMOTE schema. **The REMOTE database (confirmed via a live read-only `supabase_remote` query run before writing migration `0601`) does NOT have any of these objects.** This is near-certain proof that an earlier attempt at this exact task got far enough to prototype these exact schema changes directly against the LOCAL dev database (not through a tracked migration file) and regenerate local types/Prisma from it, before crashing — consistent with this task's own briefing that "a previous attempt... crashed mid-run" (that briefing's "zero diffs" confirmation covered only the route `.ts` files, not these three generated/schema files). **Consequence for the user applying migration 0601:** it should apply cleanly to **remote** (confirmed empty state there). Applying it to **local** may fail on the bare `ADD CONSTRAINT uq_ntf_camp_tgt_camp_recip` line specifically (Postgres has no `ADD CONSTRAINT IF NOT EXISTS`) if local already has a constraint by that exact name from the undocumented prior change — the `ADD COLUMN IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION`/`ON CONFLICT ... DO UPDATE` statements in the same migration are idempotent either way and would not fail. This was reported rather than silently reconciled: no local database reset, direct ALTER/DROP, or migration-skip was performed — per CRITICAL RULE #1 only the user runs a reset, and no `supabase_local` MCP was reachable this session to even inspect local state directly (`ECONNREFUSED`). **Resolved 2026-10-10:** the user applied migration `0601` to both local and remote without incident — the feared `ADD CONSTRAINT` collision on local did not occur (see this entry's "Migration status — APPLIED" bullet below for independent remote-side confirmation of all five new/changed objects). The underlying question of how local acquired matching objects outside a tracked migration remains open but is no longer blocking; flagged here for awareness only.

- [x] **Five requested correctness bugs in `web-admin/app/api/notifications/process-campaigns/route.ts` (Phase A `activateCampaign`, Phase B `dispatchTargets`) are fixed, and the live code review surfaced two additional, more severe bugs in the exact same statements that are fixed in the same change.** Scope: campaign processor correctness only — campaign authoring, approval workflow, targeting/segmentation, billing, plan limits, feature flags, navigation, and permissions were not touched. HQ (`cleanmatexsaas`) was not touched.
  - **Bug 1 — raw-text template bypass, confirmed.** `dispatchTargets` wrote `campaign.name`/`campaign.description` directly into the inbox/outbox rows (lines 241-242 and 264-265 of the pre-fix file), never calling any renderer, and never populated `title2`/`body2`/`rendered_subject2`/`rendered_body2` at all (so even the no-template fallback had zero Arabic content). Fixed by adding `renderTemplateByCode(templateCode, channelCode, variables)` to `web-admin/lib/notifications/template-renderer.ts` — a template_code-keyed sibling of the existing `renderChannelTemplate`, reusing the same APPROVED-version-selection query shape and the same private `interpolate()` substitution core (not duplicated; this is deliberately the minimal `template_code`-keyed path, not the separate NTF-06 canonical template-builder unification work, which stays out of scope). `dispatchTargets` now renders once per batch (content does not vary per recipient) and writes the real bilingual rendered title/body everywhere, falling back to the campaign's own bilingual `name`/`name2`/`description`/`description2` only when `template_code` is NULL.
  - **Bug 2 — `sent_count` conflated "queued" with "sent", confirmed and corrected with a real semantic split.** Migration `0601_ntf_campaign_processor_correctness.sql` adds `org_ntf_campaigns_mst.queued_count` (new column — confirmed via a live schema query that no such column, or any other candidate, already existed) and corrects `sent_count`'s `COMMENT ON` to mean exactly what the UI's "Sent" label implies. `dispatchTargets` now increments `queued_count` when a target is hex-handed to `org_ntf_outbox_dtl` (EMAIL/SMS/WHATSAPP/PUSH, still in flight) and `sent_count` only for IN_APP, whose inbox write is synchronous, immediately-terminal delivery with no further async step. `sent_count`/`failed_count` for the external channels are incremented later, atomically, only once process-outbox resolves the linked row — see Bug 3. UI: `campaign-detail-page.tsx` gained a new "Queued" stat card (`campaigns.detail.queued`, EN "Queued" / AR "قيد الانتظار", added to both locale trees) between "Total" and "Sent" so "Sent" now visibly means confirmed-sent, not enqueued; `campaign-list-page.tsx`'s existing `{sent_count}/{total_targets} sent` text and progress bar needed no code change — they now render the corrected, more accurate value automatically, and the previously-full green progress segment correctly shows a neutral in-flight gap instead of implying full delivery that had not happened.
  - **Bug 3 — missing terminal target status, confirmed and fixed with a new atomic DB function, not an application-level read-then-write.** `org_ntf_camp_targets_dtl.status` never advanced past `QUEUED` for external channels. Fixed via migration `0601`'s `fn_ntf_camp_target_resolve(p_outbox_id, p_tenant_org_id, p_target_status, p_skip_reason)`: one atomic `UPDATE ... WHERE outbox_id = ... AND tenant_org_id = ... AND status = 'QUEUED' RETURNING campaign_id`, immediately followed by the matching `sent_count`/`failed_count` increment on `org_ntf_campaigns_mst` in the same function — guarded on `status = 'QUEUED'` so a duplicate/redelivered call for the same `outbox_id` is a safe no-op (mirrors the "atomic increment, immune to lost updates" shape migration `0598` established for `org_ntf_usage_daily`, applied here to the same class of concurrent-resolution problem; no advisory lock needed since this is a single statement with no prior SELECT round-trip). New `web-admin/lib/notifications/campaign-target-sync.ts` (`mapOutboxStatusToCampaignTargetStatus`, `resolveCampaignTargetForOutbox`) is the typed call-site wrapper, called from `process-outbox/route.ts`'s `finalizeClaim()` only when the resolved row's `source_entity_type === 'campaign'` (a no-op for every order-sourced row). `dispatchWhatsAppInline` in `adapters/outbox.ts` was deliberately **not** touched — it is only ever reached from the event-orchestrator path (`enqueueOutbox`), which `process-campaigns` never calls, so it can never receive a campaign-sourced row; this was verified by reading its only call site before deciding not to change it.
  - **Bug 4 — missing target-creation idempotency, confirmed and fixed at the DB layer as instructed, not with an application lock.** Migration `0601` adds `UNIQUE(campaign_id, recipient_user_id)` (`uq_ntf_camp_tgt_camp_recip`, kept ≤ 30 chars per the DB-object-length rule; NULL `recipient_user_id` rows are never deduped by this constraint — Postgres treats NULL as distinct, matching the column's documented "NULL = external-address-only" meaning). **Before adding the constraint, a live read-only query against the remote database confirmed zero existing `(campaign_id, recipient_user_id)` duplicates — in fact zero rows at all in either `org_ntf_campaigns_mst` or `org_ntf_camp_targets_dtl`** (the campaign engine has not yet been exercised against real data), so no backfill was needed and the constraint could be added with no pre-existing-data risk. `activateCampaign`'s insert was changed to `.upsert(targetRows, { onConflict: 'campaign_id,recipient_user_id', ignoreDuplicates: true })`, the same pattern already used elsewhere in this codebase (`preference-catalog.service.ts`).
  - **Bug 5 — campaign-specific dispatch-time consent recheck: investigated, and the plan's own premise was found to not hold for the real data model; a different, real gap was found and fixed instead.** `web-admin/lib/notifications/customer-dispatch-consent.ts` and `whatsapp-customer-eligibility.ts` were read in full: both are hard-gated on `sourceEntityType === 'order'` and resolve consent via `org_orders_mst.customer_id → org_customers_mst.preferences`. Campaign targets (`org_ntf_camp_targets_dtl.recipient_user_id`, sourced from `target_segment.user_ids`) are explicitly auth/portal user ids per the column's own migration-0361 comment ("auth.users; NULL = external address only") and have no order and no `org_customers_mst` row at all — there is no `customer_id` to resolve. Calling either function for a campaign target would either always return "not applicable" (EMAIL/SMS) or always and incorrectly block every WhatsApp campaign send with "cannot be verified without a source order" (WhatsApp) — reusing them as-is would not fix anything and would break WhatsApp campaigns outright, so they were correctly left untouched. The **real** gap found by reading `orchestrator.ts` (the one-off event path) side-by-side with the campaign processor: orchestrator checks `notificationSettingsService.isChannelEnabled(tenantOrgId, channelCode)` — a tenant-level channel kill-switch (`org_ntf_settings_cf`) — before sending anything, including marketing sends; `dispatchTargets` never did. A tenant that disabled a channel entirely could still have campaign messages queued and sent through it, bypassing the tenant's own operational kill-switch. Fixed by calling the same shared `notificationSettingsService.isChannelEnabled` at the top of `dispatchTargets`, deferring (not permanently skipping) the whole batch when the channel is disabled, so the campaign resumes once the tenant re-enables it — mirroring how `orchestrator.ts` treats a disabled channel. The existing user-level `marketing_consent AND is_enabled` check in `dispatchTargets` was re-verified against `notificationSettingsService.hasMarketingConsent` (the one-off path's equivalent) and found to already be at least as strict (it ANDs `is_enabled`; the one-off path's helper does not), so no change was needed there.
  - **Two additional, more severe bugs found while reading the live file for the above (not on the original list, fixed in the same migration/diff because they sit in the exact statements being corrected, do not touch money/billing, and require no destructive data migration):**
    1. **`event_code: 'campaign.send'` referenced a value that did not exist in `sys_ntf_events_cd`**, confirmed by a live query returning zero rows. `org_ntf_inbox_mst.event_code` is `NOT NULL` with a `REFERENCES sys_ntf_events_cd(code)` foreign key, and `org_ntf_outbox_dtl.event_code` carries the same FK (nullable column, but the processor always populated it with this non-existent value) — **every single campaign dispatch insert, on every channel including IN_APP, was failing its foreign key and erroring out before this fix.** This was not a counting/mislabeling bug; campaign dispatch was completely non-functional. Fixed by seeding `campaign.send` into `sys_ntf_events_cd` in migration `0601` (category `MARKETING`, `is_transactional = false`, `requires_consent = true`, distinct from the pre-existing `campaign.approved`/`launched`/`completed`/... admin lifecycle events, which are about a campaign, not the marketing message itself).
    2. **The IN_APP branch assigned an `org_ntf_inbox_mst` row id to `org_ntf_camp_targets_dtl.outbox_id`**, which is a real foreign key to `org_ntf_outbox_dtl(id)` (confirmed via `pg_get_constraintdef`) — every IN_APP target's own status-advancing update was silently failing its FK check and leaving the target stuck on `PENDING` forever (the `{data,error}` result was never checked), which on the next cron tick would re-attempt the same insert, hit the inbox table's own `UNIQUE(idempotency_key)`, and still never advance the target — an undetected infinite-retry loop for every IN_APP campaign. Fixed by adding a new nullable `org_ntf_camp_targets_dtl.inbox_id` column in migration `0601` and writing the inbox row's id there instead, leaving `outbox_id` NULL for IN_APP targets (which now also go straight to the terminal `SENT` status immediately, since the inbox write has no further async step — see Bug 2/3 above).
  - **Also fixed while touching these exact lines (CLAUDE.md CRITICAL RULE #4, not one of the 5/7 bugs above but a hard, non-negotiable rule):** three `org_ntf_camp_targets_dtl` `.update()` calls inside `dispatchTargets` (the `SKIPPED`, `QUEUED`, and `FAILED` status writes) filtered only `.eq('id', target.id)` with no `tenant_org_id` predicate at all. All three now also filter `.eq('tenant_org_id', target.tenant_org_id)`.
  - **Idempotency-conflict reconciliation.** Both the IN_APP and outbox insert branches now handle a `23505` (unique violation on `idempotency_key`) by looking up the already-existing row and resolving the target from it, instead of either crashing or leaving the target stuck PENDING — closing the loop for the specific race where two overlapping `process-campaigns` invocations fetch the same `PENDING` target before either writes it (a real, narrower race that is **not** fully closed — see residual limitations).
  - **Migration status — APPLIED.** `supabase/migrations/0601_ntf_campaign_processor_correctness.sql` is created, fully commented, and has been **applied by the user to both local and remote databases (2026-10-10)**; tenant database types/Prisma were regenerated. Independently re-verified by a live read-only query against the remote database (not taken on report alone): `campaign.send` exists in `sys_ntf_events_cd`, `org_ntf_camp_targets_dtl.inbox_id` exists, `org_ntf_campaigns_mst.queued_count` exists, the `uq_ntf_camp_tgt_camp_recip` unique constraint exists, and `fn_ntf_camp_target_resolve()` exists — all five objects confirmed present. The local/remote drift this migration's authoring agent flagged below (local dev DB appearing to already have matching objects from an earlier, undocumented direct change) did not block application to either database. It seeds `campaign.send` into `sys_ntf_events_cd`; adds `org_ntf_camp_targets_dtl.inbox_id` (nullable, FK to `org_ntf_inbox_mst`) and `UNIQUE(campaign_id, recipient_user_id)` (`uq_ntf_camp_tgt_camp_recip`); adds `org_ntf_campaigns_mst.queued_count`; corrects the `sent_count`/`failed_count` column comments; and creates `fn_ntf_camp_target_resolve()`.
  - **RPC type bridge in `campaign-target-sync.ts` — kept permanently, not removed.** Unlike migration `0598`'s two bridges (removed once applied — see this file's top entry), this one is not a stand-in for missing type generation: now that `0601` is applied and types are regenerated, `fn_ntf_camp_target_resolve` is present in `Database['public']['Functions']`, but Supabase's generator never emits `| null` for an RPC function's TEXT argument regardless of the SQL parameter's actual nullability — confirmed by inspecting every generated `Functions.*.Args` entry in `database.ts`, none are ever typed `| null`. The real generated type for `p_skip_reason` is `string`, not `string | null`. Calling `.rpc()` directly with `p_skip_reason: skipReason ?? null` would not type-check, and coercing to `skipReason ?? ''` to satisfy it would be a behavior change — the SQL side does `COALESCE(p_skip_reason, skip_reason)`, so NULL preserves the existing `skip_reason` but `''` would overwrite it. The bridge is what lets the real NULL continue to be sent; the file's inline comment has been corrected to explain this (it previously described the bridge as temporary, inherited from the `0598` pattern, which does not apply here).
  - **Separately discovered, same bug class, NOT fixed here (out of scope — reported for a future increment):** `POST /api/v1/notifications/campaigns/[id]/test` emits event code `campaign.test_send`, which also does not exist in `sys_ntf_events_cd` (confirmed by live query returning zero rows) — the same class of bug as `campaign.send` above, but on a different, event-catalog-driven mechanism (the orchestrator), not the Phase A/B processor this increment's scope covers. Its effect is less severe than `campaign.send`'s was: the orchestrator resolves zero eligible channels for an unknown event and silently no-ops rather than erroring, so the test-send button currently does nothing with no error shown to the operator. Fixing it is a one-line seed migration (mirroring `campaign.send`'s), left for a dedicated follow-up rather than folded into this migration's unrelated scope.
  - **Residual limitations, explicitly not fixed (reported, not silently expanded into):** (a) Phase B has no claim/lease-token system like `process-outbox`'s — the `upsert(ignoreDuplicates)` + idempotency-key reconciliation close the specific duplicate-target and duplicate-insert bugs asked for, but two genuinely concurrent `process-campaigns` invocations can still race on which one increments a given batch's `queued_count`/`skip_count` (the pre-existing non-atomic `campaign.queued_count + queued` read-then-write pattern, unchanged, matching the file's existing convention before this fix). Building a full claim-token system for Phase B is a larger, separate change. (b) When WhatsApp→EMAIL fallback is enabled and a campaign's WhatsApp send permanently fails, the fallback EMAIL outbox row it creates (`enqueueEmailFallbackFromWhatsApp`, unchanged) carries the same `source_entity_type`/`source_entity_id` but is never linked back to the campaign target's `outbox_id` (which still points at the failed WhatsApp row) — the target is correctly marked `FAILED` for its WhatsApp attempt, but a subsequent fallback EMAIL success is not separately reflected in the campaign's counters. This mirrors how the fallback already behaves for order-triggered sends (its own independent outbox row, not folded back into the original event's accounting) and was left unwired as a genuinely obscure, feature-flagged edge case outside the five requested bugs.
  - **Validation.** Targeted Jest: 2 new focused suites (`__tests__/notifications/campaign-target-sync.test.ts` — pure status-mapping + RPC call-shape/no-op/error paths; `__tests__/notifications/template-renderer-by-code.test.ts` — channel-specific render, IN_APP fallback, plain-text fallback, no-recursion-past-IN_APP), both fully green; the full pre-existing `__tests__/notifications/*` suite (23 suites / 195 tests, including `whatsapp-adapter.test.ts`, which exercises `adapters/outbox.ts`) re-run and passes unchanged, confirming the deliberate decision not to touch `dispatchWhatsAppInline`. Scoped ESLint (`process-campaigns/route.ts`, `process-outbox/route.ts`, `template-renderer.ts`, `campaign-target-sync.ts`, `campaign-detail-page.tsx`) is clean. `npm run check:i18n` passes (new `campaigns.detail.queued` key added to both EN/AR trees, parity confirmed). No route/page compilation-affecting file required a full `npm run build` per this task's own instructions, but `campaign-detail-page.tsx` is a UI file touched for the new stat card — `tsc --noEmit` was run (see this entry's companion run) to catch any type regression from the `Campaign` type's new `queued_count` field.

- [x] **The 12-topic operational runbook set required by plan section 21 ("Observability, operations and readiness") is authored**, as a new `docs/features/Notification_And_Communication_Hub/Runbooks/` folder (12 topic files + `index.md`). This is the definition-of-done item in section 24: *"Recovery/rollback/retention/runbooks are exercised and owners are assigned"* — this increment authors the runbooks against actually-verified current behavior; it does not perform a live exercise/drill or assign human owners, both of which remain pending and are called out explicitly inside the runbooks themselves (especially Runbook 12).
- Each runbook was written only after reading the actual route/controller/service/migration files it describes — no step, button, script, or dashboard is invented. Per-topic grounded status:
  - **Partial** (real, executable procedure exists for part of the topic, with explicit gaps documented): `01_connection_verification_rotation.md` (Twilio-only live verify; rotation exists only for tenant-private accounts), `02_sender_registration.md` (CRUD implemented; no live sender verification connector for any provider), `03_template_import_submission_approval.md` (Twilio Content import/binding implemented; CleanMateX never submits to a provider for approval, and no Meta importer exists), `04_tenant_activation.md` (full route lifecycle API/UI implemented but SHADOW-ONLY — activating a route does not change any live customer-facing send today), `05_consent_opt_out.md` (WhatsApp opt-in + EMAIL/SMS opt-out implemented; no bounce/complaint/opt-out-number suppression-list table exists), `06_safe_test.md` (only a campaign-scoped self-test route exists; no generic per-template preview/test-send API; `notifications:send_test` permission named in the plan is not enforced by any current route — flagged as a discrepancy), `07_retry_vs_reconciliation.md` (automatic retry is cron-scheduled; reconciliation exists in code but has **no cron schedule** — manual invocation only — and only resolves WhatsApp/Twilio rows authoritatively), `11_billing_usage_reconciliation.md` (atomic/idempotent metering + locked quota reads implemented per migration `0598`; no pre-send reservation and no provider-invoice reconciliation exist).
  - **Not implemented** (capability does not exist in either repo; the runbook states what would need to be built rather than inventing steps): `08_incident_pause_drain.md` (no dedicated pause/drain control; only manual per-channel/provider config toggles and direct `cron.unschedule` calls), `09_provider_outage.md` (no automatic failover, account-health endpoint, or circuit breaker; only one live route per channel exists today), `10_restore_and_retention_cleanup.md` (combined file — no notification-specific restore drill and no retention/cleanup job of any kind exists; rows accumulate indefinitely), `12_operator_handover.md` (no standing handover checklist existed before this set).
- **Discrepancy found and reported, not silently corrected:** the plan's own section 16 callout (dated 2026-10-09) states migration `0598_ntf_usage_metering_atomic_idempotent.sql` is "created, not yet applied," while this file's own top entry below (same date) states it was "applied by the user to both local and remote databases." Source evidence (`metering.service.ts` calling the RPC directly with no bridging cast, consistent with the regenerated-types claim below) supports this file's applied claim over the plan's stale prose. Recorded in `Runbooks/11_billing_usage_reconciliation.md` rather than silently edited into the plan.
- **Other discrepancy found and reported:** the plan's access-model section (11.1) lists `notifications:send_test` as an existing verified tenant permission required for test sends; a repo-wide search of `web-admin/app/api/v1/notifications/**` found no route referencing it — the only implemented test-send route (`campaigns/[id]/test`) is gated by `notifications:manage` instead. Recorded in `Runbooks/06_safe_test.md`.
- No code, migration, permission, navigation, feature-flag, or billing change was made. This is a documentation-only increment. No file under `web-admin/app/api/notifications/` or `web-admin/lib/notifications/` was edited (a concurrent increment was fixing bugs in `process-campaigns/route.ts` at the same time; that file and its siblings were read-only for this task).

---

- [x] **HQ notification usage-metering and quota-check concurrency fix is implemented** (plan section 16 "Quota, usage and financial boundaries" and section 20 test matrix row "Parallel quota reservations and repeated receipts"). Approved scope only: a pure concurrency-correctness fix — no quota value, price, plan default, or override semantics changed; `QuotaService.resolveQuota()` and `PricingService` are untouched (confirmed by diff). Two confirmed bugs fixed:
  - **Lost-update race in `MeteringService.meter()`** (`platform-api/.../dispatch/metering.service.ts`): previously a SELECT then application-level UPDATE/INSERT against `org_ntf_usage_daily`, so two concurrent calls for the same (tenant, channel, date, provider, currency) bucket could read the same starting counters and lose an increment. Now delegates to a single new atomic SQL entry point, `fn_ntf_meter_usage_atomic` (migration `0598_ntf_usage_metering_atomic_idempotent.sql`, **unapplied — awaiting user review/apply**), which performs one indivisible `INSERT ... ON CONFLICT DO UPDATE SET col = col + delta` statement.
  - **Broken worker upsert** (`platform-workers/src/notifications/dispatch.processor.ts`): its `onConflict` target (`tenant_org_id,channel_code,usage_date,provider_code`) stopped matching any real constraint once migration `0366` added `currency_code` to `idx_ntf_usage_natural` — every queued-channel (SMS/WhatsApp/Push with `NTF_QUEUE_ENABLED=true`) usage metering call has been silently broken since. Now calls the same `fn_ntf_meter_usage_atomic` RPC, with its `{data, error}` result actually checked and logged (previously discarded unawaited-of-error).
  - **Idempotency.** Neither call site carried any command identity, so a BullMQ retry/redelivery or any repeated metering call for the same logical dispatch command had no way to avoid double-applying its delta. `MeterParams` gained a required `idempotencyKey` (threaded from `dto.idempotencyKey` / `job.data.idempotencyKey`, the same value already globally unique on `hq_ntf_dispatch_log`). New ledger table `org_ntf_usage_apply_evt` (migration `0598`) claims that key before any increment — `UNIQUE(idempotency_key)` makes usage application at-most-once per logical command; a second attempt is a no-op (`applied: false`), not an error.
  - **Quota hard-cap read.** `QuotaRepository.getUsageInPeriod()` now calls a second new function, `fn_ntf_quota_usage_locked` (migration `0598`), which takes the same per-(tenant_org_id, channel_code) Postgres advisory lock as `fn_ntf_meter_usage_atomic` before summing `sent_count`, so the hard-cap check can never read a half-applied concurrent increment for the same tenant+channel. **Honest residual limitation, by design and explicitly out of scope:** this does not close the wider check-then-send-then-record race between two *different* concurrent dispatch commands — `QuotaService.checkAndReserve` (pre-send) and `MeteringService.meter` (post-send) are still two calls separated by real provider-call I/O time. Fully closing that gap requires a true pre-send reservation released on send failure — the reservation/expiry/release ledger the plan calls out as separate future M6 scope; building that was explicitly declined per the user's approved instruction ("row lock OR atomic increment", not a full reservation system).
  - **Migration status — APPLIED.** `supabase/migrations/0598_ntf_usage_metering_atomic_idempotent.sql` is created, fully commented (table/function/column/index/policy `COMMENT ON`), and has been **applied by the user to both local and remote databases** (2026-10-09); tenant database types/Prisma and HQ `platform-api` database types were regenerated and confirmed to include `fn_ntf_meter_usage_atomic`, `fn_ntf_quota_usage_locked`, and `org_ntf_usage_apply_evt`. One FK target (`sys_notification_channel_cd` → correct current name `sys_ntf_channel_cd`, renamed by migration `0364`) was caught and corrected after an initial apply attempt failed; the corrected file is what applied successfully. The temporary narrow call-site RPC bridging types have been removed from the two `platform-api` call sites (`metering.service.ts`, `quota.repository.ts`) now that the regenerated `Database['public']['Functions']` type includes both functions — both now call `client.rpc(...)` directly with no cast. `platform-workers/src/notifications/dispatch.processor.ts`'s equivalent bridging interface is intentionally **kept**: that package's `getSupabaseAdmin()` (`platform-workers/src/lib/supabase.ts`) calls plain `createClient()` with no `Database` generic at all and has no `database.types.ts` of its own, so its `.rpc()` calls cannot resolve argument types from type regeneration regardless of what `platform-api`'s generated types contain — removing it would silently widen to `any`-shaped args. Giving that client a `Database` generic is a larger, separate change (either duplicating/importing `platform-api`'s generated types into `platform-workers`, or generating its own) and is out of scope for this concurrency-only fix.
  - **Validation:** 20 new/updated focused Jest tests across 3 suites (`metering.service.spec.ts` rewritten for the RPC contract, new `quota.repository.spec.ts`, new `quota.service.spec.ts` pinning `resolveQuota`/`checkAndReserve` precedence as unchanged) — all pass, plus the full `notifications-hq` suite (11 suites / 62 tests) passes unchanged, independently re-run and confirmed. `platform-api` `nest build` succeeds; `platform-workers` `tsc` build shows only 3 pre-existing, unrelated errors (confirmed present before this change via `git stash`: an `ioredis`/`bullmq` dual-version type conflict in `main.ts`, and two untyped-Supabase-client `.update()` calls in `dispatch.processor.ts`/`push-fcm.ts`) — zero new errors introduced. Scoped ESLint on touched `platform-api` files is clean except 2 pre-existing unused-type-alias errors in `quota.repository.ts` that predate this change (confirmed via `git show HEAD`) and were left untouched as out-of-scope. `platform-workers` has no ESLint/Jest configured at all (pre-existing, confirmed) — its only available validation is `tsc`/build. No billing, plan, feature-flag, navigation, or permission change was made.
  - **Follow-up fix, same increment: BullMQ redelivery could duplicate-send to a real customer.** While verifying this fix, a separate confirmed bug was found in `platform-workers/src/notifications/dispatch.processor.ts`: unlike `dispatch.service.ts`'s synchronous path (which guards every `hq_ntf_dispatch_log` write with `.eq('status', PENDING)` via `finalizeReservedCommand`), the worker called the provider (Twilio/Meta/FCM) unconditionally at the top of every job execution with no check of the command's current status. A BullMQ redelivery of a job whose send, log update, and metering had already completed (e.g. the process crashed or Redis lost the completion ack just after success) would re-send to the real customer a second time. Fixed by reading the existing `hq_ntf_dispatch_log.status` for the job's `(idempotency_key, tenant_org_id)` before any provider call and returning early (no send, no log write, no metering) when it is already `SENT` or `PERMANENT_FAILURE`. `PENDING`/`FAILED` are deliberately **not** treated as terminal — `FAILED` is the expected status while a legitimate transient-failure retry is in flight (the function still throws afterward to let BullMQ retry it), so gating on `PENDING` alone would have broken normal retries. `platform-workers` `tsc` build confirmed zero new errors beyond the same 3 pre-existing ones above. No test added (package has no Jest config, pre-existing, out of scope to introduce here). **Residual limitation:** this closes the "already-finished job redelivered" case; it does not add a lock against two truly concurrent executions of the same BullMQ job id, which the existing queue/worker concurrency model is assumed to already prevent (not re-verified here).

- [x] **Outbox reconciliation (WhatsApp/Twilio only) and EMAIL/SMS dispatch-time consent recheck are implemented tenant-side** (plan invariants 4.1.6/4.1.12/4.1.13, sections 8.2 step 6 and 11.2). Two independent, additive slices:
  - **Reconciliation.** New `web-admin/lib/notifications/reconciliation-service.ts`, invoked by a new internal scheduler-only route `POST /api/notifications/reconcile-outbox` (same `Bearer {NOTIFICATIONS_OUTBOX_SECRET}` boundary as `process-outbox`; no pg_cron schedule was added — wiring one requires a migration mirroring `0350_ntf_outbox_cron.sql`'s `cron.schedule`, intentionally left for explicit user approval rather than created here). For every active tenant it finds outbox rows either explicitly held `reconcile_state = 'ACCEPTANCE_UNCERTAIN'` (migration 0556) or `PROCESSING` with a claim lease expired more than 2 minutes past its 5-minute bound (a crashed worker that recorded nothing) — every query filters `tenant_org_id` directly. **Real authoritative reconciliation exists only for `WHATSAPP` rows sent through `TWILIO_WHATSAPP` that captured a provider message SID**: it calls Twilio's `messages(sid).fetch()` and finalizes from the verified answer only — `delivered/sent/queued/accepted` → `SENT` (+ an immutable `org_ntf_receipts_tr` receipt row), `failed/undelivered` → `FAILED_TEMPORARY`/`FAILED_PERMANENT` per the same permanent-error classification the live adapter uses, and a Twilio `404` (message never created) is treated as proven non-submission and re-enters the normal retry path. **Everything else dead-letters to `FAILED_PERMANENT`** with an explicit `RECONCILIATION_REQUIRED:` operator-review message — rows with no captured SID, `META_WHATSAPP` rows, and non-WHATSAPP channels (`EMAIL`/`SMS`/`PUSH`) all land here today, since no provider-message-SID capture or status-lookup exists yet for those paths; this is a confirmed, reported gap, not a silent drop (every dead-letter is a normal, auditable `FAILED_PERMANENT` row with its own delivery-log entry). To make the Twilio lookup possible at all, `adapters/whatsapp.ts` now captures and persists `provider_message_id` (the Twilio SID) on every outcome where Twilio returned a Message resource (success or rejected-with-response); a thrown `create()` call still yields no SID by construction and is a known, inherent reconciliation-after-crash limitation for that specific case. `app/api/notifications/process-outbox/route.ts` and `adapters/outbox.ts` (inline WhatsApp dispatch) both persist this SID through to `org_ntf_outbox_dtl.provider_message_id` and `org_ntf_delivery_log_dtl.provider_message_id`.
  - **Consent/suppression at dispatch.** New shared `web-admin/lib/notifications/customer-dispatch-consent.ts`, wired into `adapters/email.ts` and `adapters/sms.ts` (WhatsApp already rechecked consent at dispatch via the pre-existing `whatsapp-customer-eligibility.ts` — unchanged). EMAIL/SMS use an **opt-out** model (`preferences.notifications.<channel> === false` blocks; absent/true/undefined send exactly as before) rather than WhatsApp's opt-in model, specifically so introducing this check cannot change behavior for any customer who has never touched the toggle — only an explicit opt-out is newly enforced. A blocked send records `SKIPPED` (non-retryable) or `FAILED_TEMPORARY` (retryable lookup failure) — never silently dropped, never a false failure, never a fallback to another channel. **Confirmed schema gap, reported rather than invented:** there is no bounce/complaint/opted-out-number suppression-*list* table anywhere under `supabase/migrations` as of migration `0596` — only the per-customer preference flag exists. Email bounce/complaint and SMS carrier opt-out suppression-list enforcement remain pending future schema work. PUSH was evaluated and intentionally left unchanged: its recipients are staff/app users via `org_ntf_push_subs_dtl` device subscriptions, not tenant customers, so customer consent does not apply — its existing subscription-active/failure-count model already serves the equivalent role.
  - **Validation:** 24 new focused Jest tests (`__tests__/notifications/{customer-dispatch-consent,email-sms-dispatch-consent,reconciliation-service}.test.ts`) plus all 159 pre-existing notification tests pass unchanged (8 pre-existing `whatsapp-adapter.test.ts` assertions were updated to expect the now-captured `providerMessageId` field — a deliberate additive-field change, not a behavior change). Full TypeScript typecheck (0 errors) and scoped ESLint (0 errors) pass. No migration, billing, plan, feature-flag, navigation, or permission change was made; no HQ (`cleanmatexsaas`) file was touched (reconciliation/consent is tenant-owned per plan section 2).

- [x] **SHADOW-ONLY.** `ResolveEffectiveNotificationRoute` and a shadow-only ORDER_CREATED → WHATSAPP comparison are implemented tenant-side (plan sections 4.2, 17.2, 22). **No tenant was cut over to live HQ/route-based WhatsApp sending; no provider call, quota reservation, or outbox claim behavior changed for any tenant.** `web-admin/lib/notifications/route-resolver.ts` reads the single ACTIVE row (if any) in `org_ntf_route_assign_cf` for an explicit tenant/event/channel/language tuple — every query filters `tenant_org_id` directly — and returns either the pinned PLATFORM/PRIVATE account/sender/revision identity plus ordered binding structure (from `sys_ntf_prov_tmpl_bind_dtl` or `org_ntf_ptbind_dtl`), or an explicit `NO_ACTIVE_ROUTE`/`LOOKUP_ERROR` result (absence and failure are never conflated). A bounded 30s in-process cache (max 500 entries) is invalidatable per tenant/tuple via `invalidateEffectiveNotificationRouteCache`; it never caches indefinitely or across tenants. `web-admin/lib/notifications/shadow-route-comparison.ts` calls the resolver in addition to — never instead of — the existing direct-Twilio `order.created` → WHATSAPP path inside `deliverWhatsAppOutbox` (`web-admin/lib/notifications/adapters/whatsapp.ts`): it never sends, never reserves/charges quota, and never touches the outbox claim/lease machinery a second time; any internal failure is swallowed so the legacy send can never be affected. The legacy path has no recipient-language signal today (confirmed: none exists anywhere in the current event-emitter/orchestrator/outbox-row contract), so per invariant 4.1.16 ("no default locale") the shadow comparison does not guess one — it lists the languages actually configured with an ACTIVE route for that tenant/event/channel and compares each, rather than inventing a recipient language. **Storage decision:** comparisons are recorded as a single structured `logger.info`/`logger.warn` line (feature: 'notifications', shadow: true), not a new table and not `org_ntf_outbox_dtl.metadata` (that column already has a distinct, adapter-consumed purpose — "channel-specific payload overrides" — and reusing it for diagnostics risked an adapter misreading pilot data, plus no migration is approved in this increment); a structured log line is reviewable by an operator without creating an unreviewed durable ledger. 45 new/updated focused Jest tests cover: exact-tuple matching, PLATFORM vs PRIVATE binding sources, cross-tenant non-leak, `NO_ACTIVE_ROUTE` vs `LOOKUP_ERROR` distinction, cache TTL/invalidation, and — critically — that `deliverWhatsAppOutbox`'s legacy Twilio send is byte-for-byte identical (same `createMessage` call, same result) whether no route, an ACTIVE route, or a throwing shadow lookup is present; all pre-existing `whatsapp-adapter.test.ts` assertions continue to pass unchanged with the shadow code live in the loop. Scoped ESLint, full TypeScript typecheck (0 errors), targeted Jest (`__tests__/notifications/*`, 159 passed), EN/AR i18n parity, and the production build all pass. No migration, billing, plan, feature-flag, navigation, or permission change was made. Remaining before any live cutover: an explicit language/locale signal on the legacy event-emitter/outbox contract, recorded pilot evidence, and the separate cutover gate per plan section 22 step 5.
- [x] HQ platform/tenant-private provider-account ("connection") and sender administration API+UI is implemented. HQ exposes `GET/POST /notifications/connections` (+ `PATCH`/`:id/verify`) for platform accounts and `GET/POST /notifications/senders` for platform senders, with parallel tenant-scoped `.../tenants/:tenantOrgId` routes for BYO accounts/senders, a write-only tenant credential endpoint (`.../:id/credential`, never read back), and `.../:id/verify`. Verification performs a real Twilio Account API check (TWILIO only this increment) and only marks an account `VERIFIED` after Twilio reports `active`; rotating a tenant credential resets the account to `PENDING`. The HQ Providers screen gained a "Manage connections" dialog; the Tenant Configuration screen gained per-tenant "Private connections" and "Routes" dialogs, the latter completing UI wiring (create DRAFT/edit/activate/suspend/retire) for the already-implemented route lifecycle API. Backend: new `provider-accounts` NestJS module (controller/service/repository/DTOs) plus two new `TwilioContentImporterService` live-verification methods, with 14 new focused Jest tests, all green; `ProviderTemplatesModule` now exports that service for reuse instead of duplicating credential resolution. Frontend: new types/API-client/hooks for connections, senders, and routes (the route API+hooks had no prior UI at all). Scoped platform-api/platform-web lint, full TypeScript typecheck (0 errors), EN/AR i18n parity, and both production builds pass. No migration, billing, plan, feature-flag, navigation, or permission change was made; sender-level live verification and a full route-eligibility-aware resource picker remain future work.
- [x] HQ private Twilio import onboarding UI is implemented; `tenant-config-screen.tsx` now sequences import → review → immutable binding → refresh for eligible private BYO Twilio WhatsApp rows. The new controlled dialog (`private-twilio-import-dialog.tsx`) only submits the tenant's own selected account, optional sender, canonical locale, and Content SID through the already-applied private candidates/import endpoints; it never displays credentials, provider snapshots, or approval evidence. Scoped platform-web lint, full TypeScript typecheck, EN/AR i18n parity, and the full platform-web/platform-api Jest suites (platform-api provider-templates suite unchanged and still green) pass. Production build passes. No migration, billing, plan, feature-flag, navigation, or permission change was made.
- [x] Shared schema applied through `0593_ntf_private_account_credentials.sql`; the operator regenerated database types and tenant Prisma after each applied migration.
- [x] Migration `0583_ntf_route_private_account_nullable.sql` is applied; `platform_account_id` is nullable so valid PRIVATE routes can be created.
- [x] P1 durable dispatch/receipt safety and P2 platform provider-account, sender, localized-contract, provider-registration, route-assignment, and private-resource foundations are implemented.
- [x] HQ route administration: tenant-scoped create, optimistic draft edit, activate, suspend, and retire APIs use canonical HQ permissions, audit logs, ownership-branch validation, and approved account/sender/template/locale/binding checks for platform and private routes.
- [x] HQ provider-template registration discovery APIs expose redacted platform registrations and immutable revision metadata for route configuration.
- [x] Migration `0586_ntf_platform_template_import_command.sql` is applied. It provides the service-role-only atomic persistence boundary for authenticated platform provider-template imports.
- [x] HQ can import a selected Twilio WhatsApp Content SID through a server-only authenticated connector. The request contains only resource selectors; the connector fetches the Content and approval records, then persists the redacted observation through `0586`.
- [x] HQ Providers includes the bilingual controlled Twilio import form, backed by redacted verified account/sender/locale candidates; the platform API module imports `AuditModule` so deployment can resolve its audit dependency.
- [x] The Twilio importer now preserves connector-derived ordered slot evidence in its JSON snapshot; the generated Supabase JSON boundary compiles cleanly, and focused importer tests cover repeated positional placeholders and slot evidence.
- [x] Migration `0588_ntf_platform_template_binding_command.sql` is applied. HQ exposes revision-scoped binding candidates and an immutable binding-definition command; the Providers screen now supports registration/revision review and ordered slot mapping before the one-time command is submitted.
- [x] HQ can refresh the current Twilio provider revision through a managed confirmation flow. The server re-fetches the stored Content SID using the verified account, creates a fresh immutable revision, advances the current pointer atomically, and requires the new revision to be mapped before use.
- [x] Migration `0592_ntf_private_template_import_command.sql` is applied and generated database types are available. It provides `cmx_import_org_ntf_prov_tmpl`, an atomic service-role-only tenant-private WhatsApp import command with direct tenant predicates and account/sender/locale validation.
- [x] Migration `0593_ntf_private_account_credentials.sql` is applied. HQ private Twilio import decrypts only the selected tenant account envelope, validates its Account SID against `external_account_id`, and invokes the tenant-scoped 0592 command without exposing credentials.
- [x] HQ exposes redacted tenant-private registration/revision discovery, immutable binding definition, and current-revision Twilio refresh. Every private read and command includes the declared tenant; credentials, provider snapshots, and approval evidence remain excluded from browser responses. The HQ platform-web feature client and tenant-scoped registration/revision, binding, and refresh query/mutation hooks are implemented. Eligible BYO Twilio WhatsApp tenant configurations now open a tenant-private revision review, immutable binding, and refresh workflow. Scoped platform-web lint and EN/AR parity checks pass. The HQ API private import-candidate endpoint is implemented with direct tenant predicates; its controlled import dialog integration and focused validation are in progress.
- [x] Migration `0596_ntf_private_template_binding_command.sql` is applied and generated types are available. HQ exposes tenant-scoped private binding candidates and a one-time audited binding command, with direct tenant predicates on every private read and write.
- [x] Provider/tenant account+sender management APIs and UI workflows are implemented (2026-10-09 entry above); route creation/edit/lifecycle UI is implemented. WhatsApp/Twilio reconciliation and EMAIL/SMS dispatch-time consent recheck are implemented (2026-10-09 entry above, top); META_WHATSAPP/EMAIL/SMS/PUSH reconciliation lookups, a bounce/complaint/opt-out suppression-list schema, dispatch resolver live cutover, operational runbooks, and pilot evidence remain required before production rollout.

---
# CMX-PRD-019 — Notification Hub: Status

**Project:** CleanMateX Notification & Communication Hub
**PRD:** CMX-PRD-019
**Last Updated:** 2026-10-03
**Overall Status:** P1 legacy-transport safety implemented; P2–P7 remain pending.

## 2026-10-03 — P1/M1 durable legacy dispatch safety

- [x] User applied shared migration `0556_ntf_outbox_claim_safety.sql` to local and remote databases, then regenerated tenant and HQ database types and tenant Prisma.
- [x] Tenant outbox workers now acquire tenant-scoped claim tokens and leases, conditionally finalize only their own claim, append immutable attempt logs, and hold thrown provider calls as `ACCEPTANCE_UNCERTAIN` rather than resend them.
- [x] Optional inline WhatsApp dispatch now uses the same durable claim/finalization rules and no longer bypasses the outbox safety boundary.
- [x] HQ reserves `hq_ntf_dispatch_log` as `PENDING` before provider submission, returns a matched concurrent command rather than duplicate-send, and rejects incomplete BYO routes instead of using platform credentials.
- [x] HQ preserves raw callback bytes for signature verification, rejects invalid callbacks before persistence, validates Twilio form callbacks against the configured callback URL, and scopes provider-status projection to compatible provider codes.
- [x] Focused tenant and HQ suites pass; tenant production build passes.

**Required HQ configuration before Twilio callback activation:** set `HQ_TWILIO_WEBHOOK_URL` to the exact HTTPS callback URL registered in Twilio. The P1 verifier rejects Twilio callbacks when this value is absent or differs from Twilio's signed URL.

**Still pending:** M1-B append-only acceptance/receipt correlation schema, durable receipt projection, provider account/sender/template revisions, typed variables/collections, route assignments, HQ and tenant administration UX, quota reservations, campaigns hardening, pilot evidence, and production rollout gates.

No billing, plan, feature-flag, navigation, permission, or external-send behavior was enabled by this increment. Deployment and live provider callback verification remain operator-controlled.

## 2026-10-03 — Production architecture implementation planning

- [x] Created the [canonical production implementation plan](./notification-hub-production-implementation-plan.md) covering both repositories, shared schema, services/APIs, provider transport, HQ/tenant UI, security, tests and rollout.
- [x] Created the supporting [schema and contract specification](./notification-hub-schema-and-contracts.md), including platform/private ownership, localized/provider revisions, typed collections/calculations and delivery evidence.
- [ ] Review the proposed implementation slices and schema/API decisions.
- [ ] Implement and verify phases P0–P7; all enhancement implementation remains pending.

This increment changes documentation only. Historical completion labels below do not establish production readiness for the proposed enhancements. No code, SQL, migration application, deployment, provider configuration or external send was performed.

---

## 2026-10-02 — Direct Twilio production templates and operator UI

- [x] Per-event Content SID/maps, production recipient/consent checks, tenant-safe retries and dispatch claims.
- [x] Existing Notification Settings template editor and customer Preferences consent control (EN/AR).
- [x] Existing permission/API access contracts; no schema, migration, navigation, or permission additions.
- [x] [Operator setup and order-created test runbook](Setup_And_Config/14_twilio_production_order_created.md).
- [ ] Deployment, tenant configuration, and live CleanMateX order-created delivery verification.

The approved template's direct Twilio test succeeded per the operator. Repository changes
do not establish deployment, active tenant configuration, or live order-created delivery.

Validation for this increment: 133 targeted tests across 13 suites, production build, full ESLint, EN/AR catalog parity,
scoped access-contract checks, and platform-inventory validation passed. Standalone
typecheck remains blocked by existing FX BigInt/ES2017 errors and the missing required
subscription currency in `lib/services/tenants.service.ts`; no notification-scope errors
remain. The existing build configuration skips TypeScript errors. Storybook stories
lint clean, but its build attempt exited with native code 3221226356 without a source
diagnostic. Live browser and external delivery checks remain pending.

---

## Phase Summary

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| Exploration | ✅ COMPLETE | 2026-06-06 | Architecture + roadmap locked |
| Phase 1 — Foundation + In-App | ✅ COMPLETE | 2026-06-11 | Migs 0344–0349; bell UI live |
| Phase 2 — Email + Outbox Worker | ✅ COMPLETE | 2026-06-11 | Mig 0350; outbox pg_cron live |
| Phase 3 — WhatsApp + SMS + Push | ✅ COMPLETE | 2026-06-12 | Migs 0351–0356; all channel adapters wired |
| Frontend — Bell UI (Track A) | ✅ COMPLETE | 2026-06-12 | Bell, drawer, center page, prefs page |
| Phase 4 — Campaign Engine | ✅ COMPLETE | 2026-06-12 | Migs 0361–0363; campaign CRUD + UI + scheduler |
| HQ Phase B0 — Guards, Encryption, Audit | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: JwtAuthGuard, AES-256-GCM, AuditService |
| HQ Phase B1 — EMAIL Dispatch Proxy | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: GovernanceService, EMAIL provider send |
| HQ Phase B2 — Quota & Pricing | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: QuotaService, PricingService, MeteringService |
| HQ Phase B3 — SMS / WA / Push + Workers | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: BullMQ workers, all 4 channel providers |
| HQ Phase BYO — Encrypted BYO Credentials | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: AES-GCM per-tenant cred encryption |
| HQ Phase A — Template Library UI | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: DRAFT→APPROVED→RETIRED state machine |
| HQ Phase C — Observability + Broadcast | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: dashboards, campaign CRUD |
| HQ Phase X — Hardening | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: throttle, _stripSecrets, ADR-002 |

---

## Phase 1 — Foundation + In-App ✅

**Completed:** 2026-06-11

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0344 — notif_catalog_schema | ✅ Applied | 2026-06-09 |
| 0345 — notif_catalog_seed | ✅ Applied | 2026-06-09 |
| 0346 — notif_templates_schema | ✅ Applied | 2026-06-09 |
| 0347 — notif_tenant_settings | ✅ Applied | 2026-06-09 |
| 0348 — notif_runtime_tables | ✅ Applied | 2026-06-09 |
| 0349 — ntf_permissions_and_nav | ✅ Applied | 2026-06-09 |

### Deliverables

- [x] Event catalog schema (27 categories, 116 events)
- [x] Template schema (providers, templates, versions, channels)
- [x] Tenant channel settings + user preferences tables
- [x] Runtime tables: org_notifications_mst, org_notification_outbox_dtl, org_notif_delivery_log_dtl
- [x] Supabase Realtime enabled on org_notifications_mst
- [x] Permissions seeded: notifications:read/manage/view_log/configure/send_test
- [x] Navigation entries seeded in sys_components_cd
- [x] IN_APP adapter, outbox adapter, orchestrator, event emitter
- [x] Notification bell — real-time badge via Supabase Realtime
- [x] Notification center page — tabs, pagination, mark-read
- [x] 3 order events wired: order.created, order.ready, order.cancelled
- [x] i18n keys (EN + AR) — npm run check:i18n green
- [x] npm run build green

---

## Phase 2 — Email + Outbox Worker ✅

**Completed:** 2026-06-11

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0350 — ntf_outbox_cron | ✅ Applied | 2026-06-11 |

### Deliverables

- [x] pg_cron outbox processor job registered (every 1 min)
- [x] pg_cron retry sweep job registered (every 5 min)
- [x] /api/notifications/process-outbox route — Bearer-authenticated
- [x] Email adapter (Resend provider)
- [x] Outbox processor: dispatches to correct adapter by channel_code
- [x] Quiet hours enforcement in orchestrator
- [x] Marketing consent check in orchestrator
- [x] Notification preferences API: GET/PUT /api/v1/notifications/preferences
- [x] Notification settings API: GET/PUT /api/v1/notifications/settings

---

## Phase 3 — WhatsApp + SMS + Push ✅

**Completed:** 2026-06-12

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0351 — notif_push_subscriptions | ✅ Applied | 2026-06-12 |
| 0352 — notif_channel_provider_cf | ✅ Applied | 2026-06-12 |
| 0353 — notif_push_sweep_cron | ✅ Applied | 2026-06-12 |
| 0355 — ntf_config_table_cron_fix | ✅ Applied | 2026-06-12 |
| 0356 — ntf_provider_cf_is_enabled | ✅ Applied | 2026-06-12 |

### Deliverables

- [x] org_ntf_push_subs_dtl + org_ntf_channel_provider_cf tables
- [x] sys_ntf_runtime_cf — runtime config key/value (GUC workaround)
- [x] SECURITY DEFINER ntf_trigger_outbox_proc() function
- [x] Settings service singleton with 30s cache
- [x] Push subscription management API
- [x] Provider management API (GET/POST/PUT/DELETE)
- [x] WhatsApp, SMS, Push adapters
- [x] VAPID service worker (public/sw.js) + push client library
- [x] Channel Settings UI + Delivery Log page
- [x] Provider activation run for all tenants

### WhatsApp Template Approval

| Template | Status |
|----------|--------|
| cmx_order_ready | ⏳ Pending META approval |
| cmx_order_cancelled | ⏳ Pending META approval |
| cmx_payment_received | ⏳ Pending META approval |
| cmx_payment_reminder | ⏳ Pending META approval |
| cmx_order_delayed | ⏳ Pending META approval |

---

## Phase 4 — Campaign Engine ✅

**Completed:** 2026-06-12

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0361 — ntf_campaign_engine_tables | ✅ Applied | 2026-06-12 |
| 0362 — ntf_campaign_scheduler_cron | ✅ Applied | 2026-06-12 |
| 0363 — nav_marketing_campaigns | ✅ Applied | 2026-06-12 |

### Deliverables

- [x] Campaign tables: org_ntf_campaigns_mst, org_ntf_camp_targets_dtl, org_ntf_usage_daily, org_ntf_audit_dtl
- [x] Campaign state machine: DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → RUNNING → COMPLETED
- [x] Full campaign CRUD API (list/create/detail/status/test)
- [x] ntf_trigger_campaign_proc() SECURITY DEFINER + ntf-campaign-scheduler pg_cron job (every 1 min)
- [x] /api/notifications/process-campaigns — Phase A: activate + create targets; Phase B: consent-gate + dispatch
- [x] Campaign list page, create form, detail page (Cmx components, RTL-aware)
- [x] Routes: /dashboard/marketing/campaigns + /dashboard/marketing/campaigns/[id]
- [x] Navigation entry marketing_campaigns (gated by campaigns_enabled flag)
- [x] i18n notifications.campaigns.* keys (EN + AR)
- [x] npm run build green + npm run check:i18n green

### Pending (cleanmatexsaas)

- [ ] Campaign quota limits per plan tier (Free=0, Starter=2, Pro=20, Enterprise=unlimited)
- [ ] HQ campaign quota dashboard

---

## Migration Manifest (complete, cleanmatex)

| Seq | File | Phase |
|-----|------|-------|
| 0344 | notif_catalog_schema | 1 |
| 0345 | notif_catalog_seed | 1 |
| 0346 | notif_templates_schema | 1 |
| 0347 | notif_tenant_settings | 1 |
| 0348 | notif_runtime_tables | 1 |
| 0349 | ntf_permissions_and_nav | 1 |
| 0350 | ntf_outbox_cron | 2 |
| 0351 | notif_push_subscriptions | 3 |
| 0352 | notif_channel_provider_cf | 3 |
| 0353 | notif_push_sweep_cron | 3 |
| 0355 | ntf_config_table_cron_fix | 3 |
| 0356 | ntf_provider_cf_is_enabled | 3 |
| 0361 | ntf_campaign_engine_tables | 4 |
| 0362 | ntf_campaign_scheduler_cron | 4 |
| 0363 | nav_marketing_campaigns | 4 |
| 0364 | ntf_table_naming_unification | HQ-prep |
| 0365 | hq_audit_logs_improve | HQ-B0 |
| 0366 | ntf_dispatch_mode_currency | HQ-B0 |
| 0367 | hq_ntf_dispatch_log | HQ-B1 |
| 0369 | sys_ntf_quota_plan_cf | HQ-B2 |
| 0370 | org_ntf_quota_override_cf | HQ-B2 |
| 0371 | sys_ntf_pricing_cf | HQ-B2 |
| 0373 | hq_ntf_webhook_events | HQ-B3 |

---

## Permissions Reference

| Code | Purpose | Roles |
|------|---------|-------|
| notifications:read | View own notifications (bell, center) | All roles |
| notifications:manage | Mark read, manage prefs, campaign ops | admin, tenant_admin, super_admin |
| notifications:view_log | View delivery log | admin, tenant_admin, super_admin |
| notifications:configure | Manage tenant channel settings | admin, tenant_admin, super_admin |
| notifications:send_test | Send test notification | admin, tenant_admin, super_admin |

---

## Environment Variables Required

```
NOTIFICATIONS_OUTBOX_SECRET=<32+ char random string>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID public key>
VAPID_PRIVATE_KEY=<VAPID private key>
RESEND_API_KEY=<Resend API key>
TWILIO_ACCOUNT_SID=<Twilio SID>
TWILIO_AUTH_TOKEN=<Twilio auth token>
```

---

## Feature Flags

| Flag Code | Default | Governs |
|-----------|---------|---------|
| notifications_enabled | false | Entire hub |
| email_notifications_enabled | false | Email channel |
| sms_notifications_enabled | false | SMS channel |
| whatsapp_notifications_enabled | false | WhatsApp channel |
| push_notifications_enabled | false | Push channel |
| campaigns_enabled | false | Campaign Engine |

---

## Next Steps

1. META WhatsApp template approval — update template IDs above when received
2. Campaign quota enforcement — integrate cleanmatexsaas quota API in `process-campaigns` route (HQ-B2 gate endpoint ready)
3. Event wiring — wire remaining order/payment events from the event catalog (see PLAN.md Step 2.7)
4. Run `scripts/dev/update-types.ps1` in cleanmatexsaas to regenerate types for 0366 columns

---

## HQ Phases (cleanmatexsaas) — ALL COMPLETE as of 2026-06-16

All HQ phases were implemented in `F:\jhapp\cleanmatexsaas`. The architecture decision was revised from "management UI only" to a **single-egress HQ dispatch proxy** (ADR-002): all external sends (EMAIL/SMS/WA/PUSH) route through `platform-api`; cleanmatex holds zero provider secrets.

| HQ Phase | Scope | Status | Date |
|----------|-------|--------|------|
| B0 | JwtAuthGuard, AES-256-GCM encryption, AuditService | ✅ COMPLETE | 2026-06-16 |
| B1 | EMAIL dispatch proxy, GovernanceService, provider credential UI | ✅ COMPLETE | 2026-06-16 |
| B2 | QuotaService, PricingService, MeteringService, dispatch gate | ✅ COMPLETE | 2026-06-16 |
| B3 | SMS/WA/Push providers, BullMQ workers, webhook ingestion | ✅ COMPLETE | 2026-06-16 |
| BYO | Encrypted bring-your-own credentials (AES-GCM, per-tenant) | ✅ COMPLETE | 2026-06-16 |
| A | Template library: DRAFT→APPROVED→RETIRED UI in platform-web | ✅ COMPLETE | 2026-06-16 |
| C | Observability dashboard + Broadcast Center UI | ✅ COMPLETE | 2026-06-16 |
| X | Throttle on webhooks, `_stripSecrets` pattern, ADR-002 | ✅ COMPLETE | 2026-06-16 |

**HQ env vars required** (in `platform-api/.env`):
```
HQ_ENCRYPTION_MASTER_KEY=<32-byte hex>
NTF_DISPATCH_VIA_HQ=true
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
META_WHATSAPP_TOKEN=...
FCM_SERVICE_ACCOUNT_JSON=...
```

**See:** `F:\jhapp\cleanmatexsaas\docs\dev\features_notification_hub_hq\` for full HQ documentation.

---

## 2026-06-15 — Table Naming Unification (migration 0364)

**Status:** COMPLETE

### What changed

All 7 notification tables with inconsistent abbreviations renamed to the `_ntf_` standard:

| Old name | New name |
|---|---|
| `org_notif_push_subs_dtl` | `org_ntf_push_subs_dtl` |
| `org_notif_campaign_targets_dtl` | `org_ntf_camp_targets_dtl` |
| `org_notification_campaigns_mst` | `org_ntf_campaigns_mst` |
| `org_notification_audit_dtl` | `org_ntf_audit_dtl` |
| `org_notification_usage_daily` | `org_ntf_usage_daily` |
| `sys_notification_channel_cd` | `sys_ntf_channel_cd` |
| `sys_notification_type_cd` | `sys_ntf_type_cd` |

9 indexes and 1 RLS policy also renamed. Sweep function recreated.
All TypeScript string literals updated. Prisma schema updated. Build green.

**Next migration seq:** 0365
