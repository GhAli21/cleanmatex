# Notification Hub — Production Implementation Plan

**Status:** DRAFT FOR IMPLEMENTATION REVIEW — documentation created; implementation not started.  
**Date:** 2026-10-03 (Asia/Muscat).  
**Scope:** CleanMateX tenant app, Platform HQ API/UI, platform workers, shared notification schema.  
**Canonical planning authority:** this document in docs/plan/.  
**Detailed specification:** [Schema and contracts](./notification-hub-schema-and-contracts.md).  
**Existing operator runbook:** [Direct Twilio order-created setup](./Setup_And_Config/14_twilio_production_order_created.md).

Approval to create this plan is not approval to apply migrations, deploy, change billing, or send production messages. Every proposed identifier, endpoint and service below is a design target unless explicitly marked existing. No promise of zero defects replaces the acceptance tests and release gates in this plan.

## 1. Outcome and scope

Build a durable, tenant-safe notification platform with a simple operational UI. Business modules describe an event and its audience; policy decides eligible channels; versioned templates resolve typed data; delivery infrastructure selects an authorized sender/account and records every attempt and receipt.

Required channels: IN_APP, EMAIL, SMS, WHATSAPP and PUSH. WEB_SOCKET/Realtime is a transport for persisted inbox updates, not another billable copy of the same notification. Other channels become explicit, tested connectors later; catalog configuration alone never executes a new provider.

Preserve working notification surfaces, established event tokens, customer consent controls and the current direct Twilio configuration. Do not redesign orders, workflow, pricing, tax, customer identity, authentication or SaaS plans.

### 1.1 Requirements and completion evidence

| ID | Requirement | Evidence required |
|---|---|---|
| NTF-01 | Durable capture and replay of accepted business events | Transaction/recovery tests prove capture survives process failure. |
| NTF-02 | Explicit customer/staff audiences and unified policy | Cross-tenant and staff-versus-customer consent tests. |
| NTF-03 | Provider/account/sender ownership and typed configuration | Incompatible sender/account activation fails before save. |
| NTF-04 | Internal version, localized content and external approval separated | Provider approval cannot substitute for internal approval or vice versa. |
| NTF-05 | Scalar/object/collection variables and safe calculations | Schema, cycle, money, timezone, overflow and missing-data tests. |
| NTF-06 | One canonical builder for events, campaigns and test sends | Contract fixtures exercise the same policy/rendering path. |
| NTF-07 | Durable attempts, leases and unknown-acceptance reconciliation | Crash-window and duplicate-worker tests. |
| NTF-08 | Verified, deduplicated, account-correlated receipts | Forged callbacks cause no authoritative mutation. |
| NTF-09 | Structured HQ and tenant UI, EN/AR and RTL | Browser, keyboard, permission and locale checks. |
| NTF-10 | Atomic quotas and trustworthy usage | Concurrency tests; no double accounting on retry/receipt replay. |
| NTF-11 | Safe compatibility transition and rollback | Pilot evidence plus tested route-switch/drain procedures. |
| NTF-12 | Operable lifecycle, privacy, monitoring and support | Runbooks, alerts, restore/reconciliation and retention checks. |

### 1.2 Deliberately deferred scope

- New commercial pricing, invoice/credit calculations and tenant plan entitlements.
- A customer-service conversation inbox, chatbot, OTP/authentication product, voice calling or contact-center routing.
- Arbitrary SQL/JavaScript calculations, user-supplied provider executable code or open-ended HTTP connectors.
- Tenant-authored private logical-template libraries unless separately scoped; private BYO external registrations are required.
- Automatic provider failover after unknown acceptance, and bulk creation of untested provider catalog entries.
- Full rewrite of existing modules, copying runtime implementation between repositories, or a shared package without the required ADR approval.

## 2. Ownership and authoritative boundaries

| Concern | Owner | Consumer/access |
|---|---|---|
| Shared migrations, RLS and schema comments | cleanmatex/supabase/migrations | User reviews/applies; both repos regenerate types afterward. |
| Business events and authoritative business facts | Tenant domain use cases | Notification resolvers consume a typed snapshot. |
| Tenant recipient identity, preferences and consent | cleanmatex | Explicit tenant_org_id at every org_* query/write boundary. |
| Platform catalogs, approved library and platform accounts | HQ platform-api | HQ admin permission checks; tenant consumption through approved API projections. |
| Tenant BYO connections/senders/registrations | Tenant-scoped resources managed through authorized APIs | HQ support uses audited, explicitly selected tenant context. |
| Delivery intent/outbox and attempt authority | Existing tenant outbox extended | HQ transport acknowledges handoff and returns durable outcomes; never invent a second independent intent. |
| Platform provider transport | HQ platform-api/platform-workers | S2S dispatch contract; no browser service credentials. |
| Direct BYO/legacy transport | Tenant adapters during transition | Same result/attempt contract; one selected transport owner per delivery. |
| In-app persistence and realtime | Tenant notification inbox | RLS, recipient-specific visibility and established realtime hooks. |
| System settings/feature flags | HQ | Tenant consumes HQ API; no direct sys_stng_*/sys_feature_flags_* reads. |

HQ owning transport does not authorize it to choose a different customer, override consent, or alter commercial facts. Direct and HQ delivery are mutually exclusive routes for an individual delivery. A scheduled retry stays attached to the same delivery and provider-acceptance evidence.

## 3. Baseline and evidence

Repository evidence is not proof of deployed schema, active configuration or live external delivery. Refresh scoped source/DB-read-only evidence before each implementation slice.

| Existing anchor | Current responsibility / verified gap |
|---|---|
| [Event emitter](../../../web-admin/lib/notifications/event-emitter.ts) | Direct orchestration with caught/dropped errors; no durable capture in this entry point. |
| [Orchestrator](../../../web-admin/lib/notifications/orchestrator.ts), [recipient resolver](../../../web-admin/lib/notifications/recipient-resolver.ts) | Channel orchestration; staff/user and source-order customer identities need an explicit audience contract. |
| [Template renderer](../../../web-admin/lib/notifications/template-renderer.ts), [order variables](../../../web-admin/lib/notifications/order-event-variables.ts) | String substitution; readiness is already formatted and lacks explicit tenant-timezone formatting. |
| [WhatsApp adapter](../../../web-admin/lib/notifications/adapters/whatsapp.ts), [eligibility](../../../web-admin/lib/notifications/whatsapp-customer-eligibility.ts) | Approved per-event Twilio mapping and customer consent recheck are implemented; preserve these controls. |
| [Outbox processor](../../../web-admin/app/api/notifications/process-outbox/route.ts) | Atomic competing-worker claim exists; PROCESSING lease recovery and attempt correlation remain to be added. |
| [Campaign processor](../../../web-admin/app/api/notifications/process-campaigns/route.ts) | Inserts external work outside the canonical recipient/template path and counts queued work as sent. |
| [Template migration](../../../supabase/migrations/0346_ntf_templates_schema.sql) | Existing provider catalog, logical template, internal version and channel-render tables. |
| [Runtime migration](../../../supabase/migrations/0348_ntf_runtime_tables.sql) | Existing inbox, outbox and delivery log; reuse rather than creating replacement ledgers without need. |
| [HQ dispatch](../../../../cleanmatexsaas/platform-api/src/modules/notifications-hq/dispatch/dispatch.service.ts) | Reads idempotency before send; writes dispatch log afterward. |
| [HQ resolver](../../../../cleanmatexsaas/platform-api/src/modules/notifications-hq/dispatch/provider-resolver.service.ts) | Returns provider/mode/credential envelope but does not load template configuration; errors fall back to defaults. |
| [HQ worker](../../../../cleanmatexsaas/platform-workers/src/notifications/dispatch.processor.ts) | BYO envelope not consumed; transient provider failure can finish the job while permanent failure throws a retriable Error; daily usage upsert overwrites individual counts. |
| [HQ webhooks](../../../../cleanmatexsaas/platform-api/src/modules/notifications-hq/webhooks/webhooks.service.ts) | Invalid signatures continue processing; simplified Twilio verification, JSON-only parsing and message-ID-only dedupe need replacement. |
| [Quota](../../../../cleanmatexsaas/platform-api/src/modules/notifications-hq/quota/quota.service.ts), [metering](../../../../cleanmatexsaas/platform-api/src/modules/notifications-hq/dispatch/metering.service.ts) | checkAndReserve reads usage without reserving; read-modify-write counters are not concurrency-safe. |
| [HQ permission guard](../../../../cleanmatexsaas/platform-api/src/common/guards/hq-permission.guard.ts) | Existing enforcement switch and permission matching require scoped release verification; authenticated tenant JWT must not authorize HQ catalog mutations. |

Historical feature PLAN/STATUS files contain obsolete identifiers/sequences and completion claims. Keep their history; this enhancement plan and current source govern new work. Do not reserve migration numbers from historical documents.

## 4. Architecture and separation of concerns

~~~mermaid
flowchart TD
  A[Domain transaction] --> B[Durable business event]
  B --> C[Audience resolver]
  C --> D[Policy evaluator]
  D --> E[Notification intent]
  E --> F[Template and locale resolver]
  F --> G[Typed variables and frozen payload]
  G --> H[Tenant outbox delivery]
  H --> I[Claimed attempt and transport owner]
  I --> J[Direct adapter or HQ transport]
  J --> K[Provider acceptance evidence]
  L[Verified provider callback] --> M[Durable receipt inbox]
  M --> N[Receipt normalization and reconciliation]
  K --> N
  N --> O[Delivery state and usage events]
~~~

### 4.1 Non-negotiable invariants

1. Preserve persisted event/channel/provider/status values; any new value requires explicit additive schema and contract work.
2. Every org_* SELECT, INSERT, UPDATE, DELETE, join, nested query and privileged SQL path includes tenant_org_id directly.
3. Customer delivery is authorized by that customer/channel/purpose policy, never a staff member's preference.
4. Provider network calls happen after durable claim creation, outside the business mutation transaction.
5. A unique database claim, not an initial read or retained BullMQ job ID, arbitrates competing sends.
6. Unknown provider acceptance prevents automatic replay/failover until reconciled or explicitly reviewed.
7. Credentials never fall back silently from BYO to platform; database/config errors do not imply missing configuration.
8. Templates are resolved by event, version, channel, language, provider account and authorized sender.
9. Internal approval and external approval remain separate. Submitted/approved external content is imported, not edited locally in place.
10. Required variables fail validation; fake dates, unresolved placeholders and provider sample defaults are not production substitutions.
11. Payload/template/calculation revisions are pinned; retry does not requery and silently change historical item prices/content.
12. Consent, sender eligibility, channel disablement, expiry and suppression are checked again at actual dispatch.
13. Only verified provider receipts affect authoritative state. Receipt identity includes account and receipt event, not message ID alone.
14. Accepted, delivered, read, bounced, skipped, mocked and no-destination outcomes remain distinguishable.
15. Typed metadata uses a versioned, fixed schema; known filterable data has explicit columns.
16. No default tenant currency, country, locale or timezone; required context comes from the owning configuration.

### 4.2 Service/use-case boundaries

Names below are proposed responsibilities, not a requirement to create one file/class for each row. Consolidate closely related operations within existing module boundaries.

| Responsibility | Project | Inputs and outputs |
|---|---|---|
| CaptureNotificationEvent | Tenant domain integration | Stable business occurrence -> durable event in the same transaction where feasible. |
| BuildNotificationIntents | Tenant notification use case | Event/audience -> independent recipient/channel outcomes. |
| ResolveNotificationAudience | Tenant | Typed customer/user audience -> authorized identities; batch resolution avoids N+1. |
| EvaluateNotificationPolicy | Tenant | Identity/channel/purpose/context -> allow/defer/skip with reason and policy revision. |
| ResolveEffectiveNotificationRoute | Tenant + HQ contract | Authorized tenant assignment -> pinned transport/account/sender/binding. |
| ResolveTemplateLocale | HQ library + tenant projection | Event/version/language policy -> compatible approved content or explicit failure. |
| EvaluateTemplateVariables | Notification runtime | Typed snapshot + allowlisted definitions -> typed values and validation trace. |
| RenderChannelPayload | Channel runtime | Typed values -> escaped email, bounded SMS, provider template slots, push or in-app. |
| ClaimAndExecuteDelivery | Selected transport owner | Due delivery + lease -> recorded attempt and normalized adapter result. |
| ManageProviderConnection/Sender | HQ or tenant-scoped administration | Typed configuration + credential handle -> verified revision and atomic activation. |
| Import/SyncProviderTemplate | HQ or tenant BYO administration | Verified account + external ID -> immutable registration evidence, status and bindings. |
| IngestProviderReceipt | HQ/provider callback boundary | Raw verified callback -> durable deduplicated receipt acknowledgment. |
| ApplyProviderReceipt/ReconcileAttempt | Transport/runtime | Normalized receipt -> correlated monotonic delivery facts. |
| Reserve/FinalizeNotificationUsage | HQ/runtime | Delivery identity + unit/currency -> idempotent reservation/usage event. |
| Preview/TestNotification | Shared intent-building contract | Synthetic or authorized real sample -> identical validation/rendering, optional separately authorized test send. |

Domain-specific sources such as orders, invoices, appointments or shipments live in registered producer/resolver modules. The variable evaluator and provider transport do not import order business logic.

## 5. Database and migration plan

The detailed entity dictionary, ownership variants, constraints, JSON envelopes and FK/index requirements are in [Schema and contracts](./notification-hub-schema-and-contracts.md). That document must agree with this plan before SQL is drafted.

### 5.1 Reuse and additions

- Keep sys_ntf_providers_cd, sys_ntf_templates_mst, sys_ntf_template_ver_dtl and sys_ntf_template_chan_dtl.
- Add localized rows rather than adding another language-specific body column. Legacy body/body2 and channel overrides stay readable during transition.
- Add account/sender/external-registration ownership models; platform-private resources are never publicly exposed as a provider catalog.
- Reuse org_ntf_outbox_dtl as the channel delivery identity. Add lease, attempt, pinned revisions, payload contract, provider acceptance and reconciliation fields instead of a redundant delivery master.
- Reuse org_ntf_delivery_log_dtl as the attempt ledger if its verified shape can support append-only attempts; otherwise add an attempt detail table with a documented non-overlapping responsibility.
- Add durable event/intent capture, verified receipt ingestion, route assignments and usage reservation/event records only where existing tables cannot enforce the required invariant.
- Do not retrofit historical “sent” rows as verified delivered/read; retain legacy provenance.

### 5.2 Migration batches and gates

| Batch | Change | Gate before dependent implementation |
|---|---|---|
| M1 | Minimal legacy claim/receipt safety schema where needed | Inventory live objects/constraints and confirm backward compatibility. |
| M2 | Connection, sender and tenant grants; typed config references | Ownership/FK/RLS/security review. |
| M3 | Localized content, variable contract and external registration revisions | Import sample and compatibility validation. |
| M4 | Event/intent capture, outbox leases/pins, attempt and receipt correlation | Race/crash/transaction test design approved. |
| M5 | Route/policy assignments and candidate permission/navigation/flag seeds | Exact access/seed diff reviewed; preserve existing roles and plan mappings. |
| M6 | Usage reservations/events and aggregate consistency | Accounting semantics approved independently of price changes. |
| M7 | Backfill/compatibility projections, if necessary | Dry-run report; explicit affected tenant/count review. |

Assign each next migration sequence only at creation time by inspecting the current migrations directory. Create new forward migrations only. Never apply migrations or reset the DB as part of agent work. After writing each review batch, stop for user review/application confirmation; only then regenerate types and run dependent DB integration checks.

Every future migration must document every created/altered/removed table, column, audit/identity field, FK/check/unique constraint, index, function, trigger, view, sequence, type, schema and RLS policy. Use COMMENT ON for every supported object; explain grants/revokes/removal inline. Enforce <=30-character object names, TEXT strings, DECIMAL(19,4) money and tenant-safe FK/index shapes. No DROP CASCADE by default.

Plan lock budgets, row-count estimates and rollback compatibility before backfills. Use bounded idempotent batches and online-index techniques appropriate to the verified Postgres/runtime version. Do not mix unsupported concurrent-index operations with transaction wrappers.

## 6. Typed variables, collections and calculations

Maintain separate contracts for event data, template variable definitions and provider component bindings.

- Scalar types: string, boolean, integer, decimal, date, datetime and money/currency pairs.
- Structured types: object and collection with fixed item schema, deterministic ordering and bounded nesting.
- Source kinds: event, approved context, literal and derived operation; registered resolvers may materialize a snapshot.
- Calculations: allowlisted, versioned operations such as count, sum, coalesce, condition, date difference and duration addition. Typecheck dependencies; reject cycles, excessive depth/work and unknown paths.
- Formatting: selected language, tenant timezone, currency precision and channel escaping are explicit. Decimal values travel as decimal strings, not floating-point arithmetic.
- Distinguish count(item rows) from sum(piece quantity). Do not derive official invoice total from unit price times quantity.
- Collection rendering declares columns, localized labels, sort, maximum rows/characters, empty behavior and overflow action. Full ordered item data remains one collection, not dynamically generated placeholders.
- Email may render a repeated table; WhatsApp approved-template variables use bounded inline summaries or an approved receipt-link/media component. Approved variable values cannot contain newlines. [Twilio variable rules](https://www.twilio.com/docs/content/using-variables-with-content-api).
- Ready-after-N-days must specify base milestone, calendar days/working days/hours, tenant timezone, calendar and cutoff. Prefer authoritative ready_by_at from the order/workflow service. Notification estimates must not override the promise stored on the order.
- Missing required data blocks publish/send. Optional fallback text must be explicitly defined, localized and compatible with the approved external template.

The current order-created producer exposes order_number, estimated_ready_at and date as strings. Introduce raw ready_by_at and typed data additively; preserve aliases until every consumer is migrated. Provider slot names are imported exactly. Validate the existing long named slot against actual provider account evidence rather than renaming it automatically to fit general documentation.

Publication validation covers event-contract compatibility, variable types, dependencies, collection bounds, required fields, exact provider slots, component positions, language, content hash and provider approval state. Preview should expose the source and rendered value to authorized editors without displaying unnecessary customer data.

## 7. Provider and channel contracts

### 7.1 Connector registry

Each explicitly implemented connector declares configuration/secret schemas, compatible channels, payload schema, capabilities, sender types, error classification, rate limits, receipt parser/verifier, supported API version and verification strategy.

Expose capabilities by provider + channel + content type. Do not assume every connector supports media, templates, read receipts, template synchronization or idempotent submission. Preserve existing provider codes such as TWILIO_SMS and TWILIO_WHATSAPP; audit runtime alias drift before introducing mappings.

Connection activation is transactional: validate revision/ownership/secret handle/sender -> atomically select active assignment -> invalidate effective-route cache across processes -> audit. A failed activation leaves the previous active route usable. Separate connectivity verification from an actual message send.

Secrets use existing encrypted/vault-backed infrastructure through credential references and revision handles. Workers fetch/decrypt on use within the authorized account scope; queue payloads contain handles rather than reusable plaintext credentials. Rotation keeps old pending attempts reconcilable; credential failures never switch account ownership silently.

### 7.2 Channel-specific requirements

| Channel | Payload and verification | Delivery behavior |
|---|---|---|
| WHATSAPP | Typed template or explicitly allowed in-session text; account/sender/language/category and approval checks | Twilio sends ContentSid + serialized ContentVariables, excluding Body/MediaUrl in template mode. Meta sends the approved template component contract. |
| SMS | Normalized destination, permitted sender/service, encoding-aware segment calculation and channel length policy | Segment/cost preview, country/carrier restrictions, callbacks and purpose-specific opt-out controls; do not truncate commercial text silently. |
| EMAIL | Verified domain/from/reply-to, sanitized HTML + text, approved immutable attachments | Delivery/bounce/complaint outcomes, suppression and attachment/link authorization. |
| PUSH | Tenant-owned user/device endpoints, validated title/body/data and safe deep link | Per-device attempt results, invalid-token retirement, TTL/collapse policy; no subscriptions is a skip. |
| IN_APP | Tenant/user-scoped inbox content and authorized source link | Persist first; realtime announces committed data; distinguish inbox creation from reading. |

WhatsApp outside the customer-service window requires approved templates; free text is not a fallback. [Twilio WhatsApp](https://www.twilio.com/docs/whatsapp/api), [Content sends](https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder).

SMS segmentation depends on encoding; Unicode/Arabic requires a correct segment estimator rather than “160 characters” as a universal rule. Verify connector/country exceptions and quote estimated versus actual segments separately. [Twilio SMS](https://www.twilio.com/docs/glossary/what-sms-character-limit).

Resend requires verified sending domains. Implement appropriate verified-domain checks for each email connector. [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).

### 7.3 Normalized result and error handling

Result dimensions: submission acceptance, provider message ID, delivery receipt state, retry classification, retry-after, error code/category, skipped reason, measured units and uncertainty. Existing database status values remain compatible; new detailed facts are additive until an audited contract migration changes them.

Retry only explicit transient failures using bounded exponential backoff/jitter and provider guidance. Stop permanent failures without wasting retry attempts. Unknown acceptance goes to reconciliation/manual review. [FCM retry guidance](https://firebase.google.com/docs/cloud-messaging/scale-fcm), [BullMQ permanent failure handling](https://docs.bullmq.io/patterns/stop-retrying-jobs).

Development mocks and provider sandboxes have explicit provenance. A mock success or no-destination result must never inflate production sent/delivered usage.

## 8. Durable runtime, idempotency and receipts

### 8.1 Event capture and fan-out

For transaction-backed producers, record the event inside the same business transaction without provider calls. Stable identity combines tenant, source operation/occurrence, event token and producer revision; do not change existing persisted event tokens. Repeated processing builds the same intent, not duplicate notification deliveries.

For producers that cannot share the transaction, define an authenticated idempotent intake and reconciliation protocol. Do not claim atomic business-event capture for a best-effort HTTP request.

Resolve recipients in bounded batches. Create independent per-channel results so a failed email render does not prevent an eligible in-app or WhatsApp delivery. Record skip/defer reasons without creating unnecessary external queue work.

### 8.2 Claim and crash windows

1. Persist outbox identity, route/payload pins and due/expiry times.
2. Atomically acquire a lease/claim token and create an attempt before any provider request.
3. If HQ owns transport, durably accept a command keyed to that delivery. Bridge database commit to Redis enqueue through recoverable publication, not an unprotected DB/Redis dual-write.
4. The worker verifies its current lease/claim and policy eligibility, then calls the chosen adapter.
5. Persist provider acceptance/result with conditional finalization using the claim token. Ignore stale worker finalization.
6. Recover expired leases. Retry only proven unsubmitted/retryable attempts; reconcile any attempt that might have been accepted.

Do not assume arbitrary providers support exactly-once submission. Use provider idempotency where supported, with stable keys and documented retention; otherwise use acceptance reconciliation and explicit operator controls.

Due-work discovery is deterministic using the existing scheduled_at/next_retry_at fields, priority and stable ID, with fair tenant batching. TTL expiry precedes delivery. Queue delays obey quiet hours and the explicit effective recipient/tenant timezone. Repeated consent revocation or channel disablement produces a recorded skip, not a new fallback channel.

### 8.3 Callback ingestion

- Select a known connector/account webhook configuration through an opaque endpoint handle. A URL/body tenant ID alone never establishes ownership.
- Verify the exact raw request, configured public callback URL and provider-required fields using official algorithms/SDKs. Handle Twilio form data and provider JSON explicitly.
- Reject unverified events before authoritative receipt insertion/state mutation; keep a bounded sanitized security audit separately if necessary.
- Persist verified receipt events durably before acknowledgment. Process asynchronously with replayable error handling.
- Dedupe by provider/account/event identity, or documented status/timestamp/payload identity when no event ID exists. One message can generate accepted, delivered and read events.
- Parse every supported event in a batched callback, not only the first nested status.
- Correlate provider message IDs within account/channel scope and resolve tenant from stored acceptance evidence.
- Support callbacks arriving before local send finalization; keep unmatched verified receipts for bounded reconciliation.
- Preserve append-only receipt facts; apply a channel-specific transition graph so late callbacks cannot regress delivered/read state.
- Normalize inbound opt-out events into the same recipient suppression/consent service. A full conversational UI remains deferred.

Use official Twilio validation rather than simplified HMAC over raw body. [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security).

## 9. Effective policy, routing and locale

Precedence: enforced platform safety -> tenant channel/route policy -> event/purpose rule -> actual recipient preference/consent -> eligible compatible template/sender. Persist the effective policy revision and reason trace.

Define transactional and marketing purposes separately. Transactional is not a universal bypass of user preferences, channel rules or local compliance review. Preserve urgent/security exceptions only where explicitly defined and approved.

Language selection: explicit authorized recipient preference -> tenant configured language -> explicitly permitted fallback with compatible approved content. Do not silently send English when Arabic was selected and its provider template is unavailable.

For published templates, create new revisions rather than editing existing pinned content. Retirement prevents new assignment; treatment of queued work depends on a declared retirement reason. Provider paused/rejected/deleted status or emergency disablement blocks dispatch even if a prior revision was approved.

Runtime consumers use revisioned effective projections/caches, with invalidation and bounded freshness. HQ/API errors are distinguishable from absence. Cached policy can continue only under declared freshness/eligibility rules; security revocation and stale mandatory external approval must not fail open.

Fallback is explicit per event/purpose/channel, independently checks destination and consent, renders that channel's own template, respects budget and links attempts. Do not enable fallback after timeout/unknown acceptance without reconciliation.

## 10. API and endpoint implementation catalog

**Existing HQ mount:** API_PREFIX or /api/hq/v1 in platform-api/src/main.ts. HQ tables below use /api/hq/v1/notifications as the documented default. Deployment prefixes remain configurable.

**Tenant base:** /api/v1/notifications. Existing route families and [id] slug names stay consistent. All new routes below are PROPOSED.

### 10.1 Common API standards

- Authentication and authorization precede data access; tenant identity comes from trusted request context. Reject X-Tenant-Id/session mismatches.
- Request validation uses typed DTO/Zod schemas derived from the same contract definitions; reject unknown security-sensitive fields and mass assignment.
- Cursor pagination, bounded page sizes and approved sorting/filtering; recipient masks are default. Exports require permission and audited limits.
- Configuration mutations carry expected revision/version; conflicts return 409 with a reload path. Use idempotency keys for sends, provider submission, activation and replay.
- Same key + same canonical payload returns the original outcome; same key + different tenant/payload returns a conflict without data disclosure.
- Save, validate, provider submit, publish, assign, activate, preview and send-test are separate explicit operations.
- 202 means durable command acceptance, not delivery. Polling/detail APIs expose current outcomes.
- Structured errors contain stable code, localized-safe message key/parameters, field errors, retryability and request ID; no secrets/provider raw error payloads.
- Existing /dispatch request and response contracts stay compatible; use an additive command resource for the typed async contract.
- Generate OpenAPI/contract fixtures, validate request/response examples and check compatibility in CI. Document auth, side effects, revisions and rate limits per operation.

### 10.2 HQ administrative APIs

Relative paths below are inside the HQ notification base.

| Method and path | State | Responsibility |
|---|---|---|
| GET /governance/providers; GET/PATCH /governance/providers/:code | Existing; extend | Connector metadata and capability projection; preserve seeded codes. |
| GET/PATCH /governance/channels/:code | Existing; extend | Supported channel configuration and safety controls. |
| GET/POST /connections; GET/PATCH /connections/:id | Proposed | Platform-owned connections; tenant-private administration uses a selected-tenant scoped resource. |
| POST /connections/:id/verify; POST /connections/:id/rotate-credentials | Proposed | Verification or write-only credential rotation, with safe result projection. |
| GET/POST /senders; PATCH /senders/:id; POST /senders/:id/verify | Proposed | Connection-linked sender identity and verification state. |
| GET/POST /templates; GET/PATCH /templates/:code | Existing; extend | Logical template library. |
| GET/POST /templates/:code/versions; PATCH /templates/:code/versions/:id | Existing; extend | Draft revision and variable contract editing with optimistic concurrency. |
| GET/PUT /templates/:code/versions/:id/channels/:channelCode | Existing; retain | Legacy channel-render compatibility; GET list route also remains. |
| GET/PUT /templates/:code/versions/:id/locales/:languageCode/channels/:channelCode | Proposed | Explicit localized content and channel renderer configuration. |
| POST /templates/:code/versions/:id/validate; POST .../preview | Proposed | Whole-revision validation and side-effect-free sample preview. |
| POST /templates/:code/versions/:id/approve; POST .../retire | Existing; strengthen | Internal approval/retirement; immutable approved content. |
| GET/POST /provider-templates; GET /provider-templates/:id | Proposed | Platform external registration and imported approved content. |
| POST /provider-templates/:id/sync; POST .../submit | Proposed | Fetch provider evidence; explicit draft submission if connector supports it. |
| GET /provider-templates/:id/revisions; POST .../validate-bindings | Proposed | Immutable external snapshots and slot validation. |
| GET /tenants/:tenantOrgId/routes; PUT /tenants/:tenantOrgId/routes/:id | Proposed | Audited grants/assignment to an explicitly selected tenant. |
| POST /tenants/:tenantOrgId/routes/:id/activate | Proposed | Atomic validated assignment activation and cache invalidation. |
| GET/POST /tenants/:tenantOrgId/connections; PATCH .../connections/:id | Proposed | BYO management under composite tenant identity, never the global account endpoint. |
| GET/POST /tenants/:tenantOrgId/senders; GET/POST .../provider-templates | Proposed | Private tenant resource management; same verification/sync/revision lifecycle. |
| GET /observability/summary; GET /observability/usage-trend; GET /observability/tenants/:tenantOrgId | Existing; extend | Accepted/delivered/skipped/unknown/latency metrics and tenant support projection. |
| GET /deliveries/:id; GET /deliveries/:id/attempts; GET .../receipts | Proposed | Audited support timeline and correlation evidence. |
| POST /deliveries/:id/reconcile; POST .../retry; POST .../cancel | Proposed | Guarded operator actions; retry eligibility differs from reconciliation. |
| GET /operations/dead-letter; GET /operations/health | Proposed | Actionable failed/unknown work and account/channel health. |
| GET/POST /broadcasts; POST /broadcasts/:id/preview | Extend verified broadcast controller | Same intent builder, recipient policy and progress model; exact existing action paths audited in P0. |

Private tenant endpoints must mirror verification, rotation, sender and registration actions with tenant-qualified identities. Generate their API definitions from ownership-aware DTOs; never accept a body flag that turns a private object into a platform object.

### 10.3 Tenant operational APIs

| Method and path | State | Permission / behavior |
|---|---|---|
| GET /settings; existing settings mutation | Existing; extend | notifications:configure; typed channel/purpose policy. Preserve verified current HTTP methods. |
| GET/POST/PUT /settings/providers | Existing; compatibility | notifications:configure; legacy config validation and atomic activation migration. |
| GET /connections; POST /connections; PATCH /connections/:id | Proposed | notifications:configure; BYO write-only secrets and owned metadata. |
| POST /connections/:id/verify; POST .../rotate-credentials | Proposed | notifications:configure; no implicit test send. |
| GET /senders; POST /senders; PATCH /senders/:id; POST .../verify | Proposed | notifications:configure; own resources or authorized platform choices. |
| GET /templates/available; GET /templates/:id | Proposed | notifications:configure; filtered compatible approved library. |
| GET/POST /provider-templates; POST /provider-templates/:id/sync | Proposed | notifications:configure; imported private BYO templates and exact external slots. |
| GET /routes; PUT /routes/:id; POST /routes/:id/activate | Proposed | notifications:configure; typed assignment and revision validation. |
| POST /preview | Proposed | notifications:configure; synthetic or authorized source, no external side effect. |
| POST /test-sends; GET /test-sends/:id | Proposed | notifications:send_test plus appropriate source read permission; consent and rate limit still apply. |
| GET /delivery-log; GET /delivery-log/:id | Existing list + proposed detail | notifications:view_log; timeline and mask-safe filtering. |
| POST /delivery-log/:id/retry; POST .../cancel; POST .../reconcile | Proposed | New reviewed capability or existing configure role with explicit action policy; never grant by read permission. |
| Existing inbox/read-all/:id/read/unread-count routes | Existing; preserve | Recipient-specific notifications:read and tenant predicates. |
| Existing user-prefs routes | Existing; extend | Self-only preference rules; customer consent stays separate. |
| Existing /campaigns CRUD/status/test routes | Existing; strengthen | notifications:manage; test side effect also requires send_test, with compatibility/access-contract review. |
| Existing customer notification preference GET/PATCH | Existing; preserve | customers:read/customers:update, tenant guards and preference merge semantics. |

### 10.4 Runtime and callback APIs

| Operation | Caller / contract |
|---|---|
| POST /api/hq/v1/notifications/dispatch | Existing S2S legacy endpoint; retain guarded compatible response. |
| POST /api/hq/v1/notifications/dispatch/commands | Proposed S2S only; contract_version=2, stable command UUID, tenant/delivery/attempt identities, payload fingerprint and pinned route. Returns 202 + command identity. |
| GET /api/hq/v1/notifications/dispatch/commands/:id | Proposed S2S; scoped durable result, uncertainty and provider acceptance evidence. |
| Internal result/event publication | Proposed durable bridge; idempotent tenant outbox finalization and receipt reconciliation, authenticated consumers. |
| Existing process-outbox/process-campaigns/internal-dispatch routes | Preserve scheduler/service-only auth; delegate to services and apply lease/tenant guards. No browser invocation. |
| Provider webhook ingestion route | Preserve required external callback compatibility; proposed account-handle routing with provider verification and bounded request size. |
| Meta verification challenge route | Implement/verify GET challenge separately from signed POST status ingestion; connector ownership determines token. |

The dispatch command is a discriminated payload: whatsapp_template, authorized whatsapp_session_text, sms_text, email, push or in_app where applicable. It is not an arbitrary payload object interpreted by unchecked casts. Do not expose internal S2S commands to tenant UI clients.

## 11. Authorization, privacy and audit

### 11.1 Access model

Existing tenant permissions verified in migration/navigation/access contracts: notifications:read, notifications:manage, notifications:view_log, notifications:configure and notifications:send_test. Customer preference controls retain customer permissions.

Proposed HQ capability family, subject to live registry verification before seeding: hq_notifications:read, hq_notifications:configure, hq_notifications:approve, hq_notifications:assign, hq_notifications:send_test and hq_notifications:operate. These are planned keys, not existing grants. Any new tenant operational permission should be separately scoped and use resource:action.

Reuse current HQ auth/permission utilities, but validate permission grammar/enforcement: the reviewed guard has a bootstrap switch and different wildcard behavior from the helper. Provision/test exact grants for notification actions; do not casually change global matching or flip enforcement for unrelated modules. Release requires server-enforced HQ capabilities and denial of tenant JWTs on global administration.

All new permissions need dedicated reviewed seed migration(s), matching constants, API/page/action guards and inventory refresh. No UI-only authorization. Read, configure, approve, assign, send-test, export and replay are distinct capabilities even if initially granted to the same admin.

### 11.2 Security tasks

- Model tenant ownership in composite FKs and every query/write. HQ service role bypasses RLS, so app-level authorization and tenant predicates remain mandatory.
- Review Data API exposure and grants separately from row policies. Enable RLS for newly exposed tables; platform-private account/credential/registration and HQ operational tables have no public or tenant direct-read policy. Use narrowly authorized server APIs and explicit grants/revokes rather than assuming the sys_* prefix protects a table.
- CSRF protection for cookie-authenticated writes; existing session and X-Tenant-Id protections remain.
- No authorization from user-editable user_metadata, browser-provided prices, recipient ownership, actor IDs or template approval flags.
- Write-only secret fields; masked projections; redaction across logs, error messages, audits, traces, exports and queue monitoring.
- Provider URLs, links/media fetches and callbacks use approved destinations and bounded redirects; prevent SSRF, private-network access and arbitrary secret exfiltration.
- Escape HTML/text/URL/component values in the correct context; forbid executable template helpers and prototype/path injection.
- Track consent purpose, channel, actor/source, time and revocation history without claiming a boolean alone establishes every jurisdiction's legal basis.
- Apply email bounce/complaint, SMS opt-out and WhatsApp revocation suppression consistently at dispatch.
- Establish approved retention windows for event data, recipient addresses, payloads, receipts, usage and audit metadata. Minimize PII snapshots; encrypt sensitive storage where the classification requires it.
- Restrict raw provider payloads and recipient reveals; audited support access is distinct from routine tenant delivery logs.
- Define data residency, subprocessors, permitted sender countries and jurisdiction review per deployment. Do not invent local regulatory requirements or bypass sender registration.

### 11.3 Audit events

Configuration create/update, credential rotation, verification, template import/submit/sync, internal approve/retire, grant/assignment/activation, consent change, test send, retry/cancel/reconcile, recipient reveal/export and emergency disablement.

Audit records include trusted actor, tenant where applicable, before/after revision identifiers, resource IDs, result/reason and request/correlation IDs. Store no secret or unnecessary message body. Delivery/receipt ledgers remain authoritative even if an analytics aggregate or presentation audit fails.

## 12. HQ UI/UX implementation

Extend existing /notifications pages rather than adding a parallel admin console.

| Existing screen | Enhancement |
|---|---|
| /notifications/providers | Connector catalog plus Accounts and Senders tabs; typed setup wizard, masked credential status, verify/rotate actions, capabilities and compatibility. |
| /notifications/channels | Channel limits, supported payload types, policy explanation and safe disablement. |
| /notifications/templates | Master/detail library with version tabs: Overview, Variables, Languages/Channels, Provider Registrations, Validation/Preview and History. |
| /notifications/tenant-config | Explicit tenant selection, platform grants/BYO resources, event/language routing and atomic activation. |
| /notifications/runtime-config | Typed operational configuration, safe cache/queue settings, ownership/source and validation; secrets stay write-only. |
| /notifications/analytics | Accepted/delivered/read/skipped/unknown facts, queue lag, account health, receipt lag and failure categories. |
| /notifications/broadcasts | Purpose/audience/template wizard, preflight, consent counts, scheduling and accurate queued/accepted/delivered progress. |
| /notifications/quota and /notifications/pricing | Reservation/usage visibility; preserve commercial rates and pricing behavior until separately approved. |

### 12.1 Template editor

Show logical event/template code separately from actual provider name/Content SID. Display canonical language and exact provider language, connection, category, content type, sender compatibility, internal approval and provider approval independently.

Variables use a grid with code, type, required flag, source, example, format and validation. Collections open a child-column editor; derived variables use an operation/operand builder, not SQL/JavaScript text. Provider bindings show component, position, exact slot key and selected variable.

Do not let users type variable_count; derive internal variable count, provider slot count and collection row count independently. Add/remove/reorder must produce an explicit sequence and validate component-specific constraints.

Preview supports EN/AR, tenant timezone, synthetic scenarios and authorized tenant samples. Show variable errors beside the definition and in a validation summary; unknown facts are not disguised as sample defaults.

Approved versions are read-only with Clone to draft. External submitted templates are imported/synchronized, not silently changed. Submit to provider, approve internally and activate assignment are explicit separate actions.

### 12.2 Connection/sender onboarding

Choose connector -> platform/BYO ownership -> enter nonsecret identifiers/write-only credentials -> verify connection -> register/import sender -> import approved template -> map variables -> preview -> controlled test -> activate.

Each step explains what is required and why a later step is blocked. Verification must say whether it checked credentials/account access, sender registration, approval, or actual delivery; one green badge cannot represent all four.

## 13. Tenant UI/UX implementation

| Existing surface | Enhancement |
|---|---|
| /dashboard/notifications/settings | Channels, Connections/Senders, Event Templates, Scheduling/Preferences and Test/Diagnostics tabs. Preserve existing WhatsApp editor compatibility. |
| /dashboard/notifications/delivery-log | Masked filterable timeline: queued, attempted, accepted, delivered/read, failure/skip/unknown reasons; controlled retry/reconcile/cancel. |
| /dashboard/notifications | Existing inbox/bell behavior preserved; reliable unread/read/realtime states and safe source links. |
| /dashboard/marketing/campaigns and /[id] | Structured approved template selection, audience preflight, scheduling and actual delivery progress. |
| /dashboard/settings/preferences | Self-service user preferences; clearly separate staff from customer notification policy. |
| Customer detail Preferences | Existing WhatsApp opt-in/revoke control retained; approved channel-purpose consent expansion uses the same merge-safe API. |

Tenants choose only granted platform resources or their own private resources. Show actual template/provider/language/sender information in a readable summary, while avoiding implementation jargon in routine customer flows.

Test workflow: choose event/template/language/sender -> select synthetic or authorized source -> preview and validate -> select a controlled eligible recipient -> explicitly Send test -> follow the same delivery timeline. Tests are rate-limited, tagged and metered according to declared test policy; they do not fabricate business events or override consent.

No auto-send on Save/Verify/Preview. No silent activation, secret reveal or arbitrary recipient lookup. Preserve dirty forms when switching tabs and warn before discarding user edits. Network failures retain entered values; optimistic concurrency conflicts offer reload/compare.

### 13.1 Component, accessibility and localization rules

- Use existing Cmx primitives/forms/data display/overlays exclusively; feature code uses no raw button/input/select/form/dialog/table or legacy component imports.
- Use cmxMessage/useMessage for applicable feedback with resolved i18n strings. Field errors, CmxSummaryMessage and CmxConfirmDialog retain their established roles.
- Reuse shared API hooks/form patterns, server validation and cancellation/loading conventions. Keep business logic out of components.
- Keyboard-operable tabs/grids/dialogs, correct focus return, meaningful labels, non-color-only statuses, screen-reader announcements and responsive layouts.
- EN/AR keys in matching namespace files; consult GLOSSARY before adding/editing terms and reuse common keys.
- RTL layout with LTR isolates for Content SIDs, codes, numbers and URLs; preview follows recipient language, not necessarily editor language.
- Distinguish date-only values from instants; use tenant timezone intentionally; derive currency precision from currency metadata.
- Storybook coverage for eligible feature components: variants, readonly/permission states, loading/error, empty collections, validation, long names and RTL.
- Avoid heavy payloads in list screens; load revision/receipt details on demand with bounded pagination.

## 14. Attachments, receipt links and source authorization

Full order/invoice details come from authoritative immutable document artifacts, not notification-side financial recomputation.

Persist a document/artifact version reference and tenant ownership. A renderer may generate/refresh a delivery link to the same artifact when authorized; it must not regenerate content from a changed order during retry.

Links use bounded expiry/access policies and non-guessable tokens or authenticated access appropriate to the recipient. Recipient access must not require a staff dashboard session unless that is intentional. Internal source IDs are not public access credentials.

Validate MIME/type/size, permitted hosts and provider media requirements before sending. Plan link expiry relative to deferred delivery and provider media fetching; cleanup cannot delete artifacts still required for pending delivery.

## 15. Campaigns, broadcasts and batch behavior

Campaign/broadcast targets call the same audience/policy/template/intent builder as transactional events. Do not insert plain campaign descriptions directly into external outbox rows.

Freeze campaign configuration revision and audience selection criteria; materialize bounded targets with stable idempotency. Recheck actual consent/suppression/destination at send time. Staff and customer audiences cannot be implicitly substituted.

Preflight shows eligible, suppressed, invalid-destination and unavailable-template counts with reasons. Counters distinguish targets, queued, accepted, delivered, skipped and failed; queued is not sent.

Use cursor-based batches, per-tenant/account throughput and pause/cancel checkpoints. Marketing batches must not starve transactional/security work. Configuration edits create a new revision; changing a running audience/content requires a declared restart/amendment workflow.

## 16. Quota, usage and financial boundaries

Reserve quota atomically against a delivery identity before the billable action. Model reservation expiry, release, finalization and reconciliation. Parallel workers cannot exceed an enforced hard cap through read-then-send races.

Record usage as idempotent events, then derive daily aggregates with atomic increments/rebuildable projections. Worker retries and webhook replays cannot double count.

Keep separate measures: logical notifications, recipient/channel deliveries, provider submission attempts, SMS segments, accepted messages, delivery receipts and provider-reported charges. Do not sum mixed currencies or units.

Separate estimated provider cost, actual reconciled provider charge and tenant sell price. Reuse finance/pricing authority; notification code must not redefine subscription currency, exchange-rate logic, tax or billable invoice lines.

Existing commercial policies remain unchanged during transport hardening. Moving accounting to a ledger is a correctness change with a reviewed conversion/reconciliation plan; changing prices, charge timing or plan quotas needs separate approval.

## 17. Configuration, feature flags and infrastructure

### 17.1 Existing environment/configuration integration

Verify each name and precedence in the active runtime before modification:

- Tenant HQ route controls: NTF_DISPATCH_VIA_HQ, NTF_HQ_SERVICE_ROLE_KEY, NTF_HQ_DISPATCH_URL.
- HQ service/encryption controls: HQ_SERVICE_ROLE_KEY, HQ_ENCRYPTION_MASTER_KEY.
- HQ queue: NTF_QUEUE_ENABLED and REDIS_URL; never log credential-bearing connection URLs.
- Provider credentials: existing HQ_RESEND_*, HQ_TWILIO_* and HQ_META_* variables; migrate to connection handles without deleting compatibility sources prematurely.
- Existing direct tenant Twilio/Meta/email/push config remains supported until a verified per-tenant cutover.
- API_PREFIX controls HQ mount; external webhook public URL must be explicit and proxy-safe.
- HQ_RBAC_ENFORCEMENT_ENABLED requires permission provisioning and production gate review; do not flip it blindly.

New operational settings are PROPOSED: lease duration, attempt cap, maximum delay/TTL, account concurrency, queue batch/fairness limits, receipt replay/retention, approval freshness, allowed link hosts, test-send limits and payload/collection bounds. Resolve typed values through existing HQ settings mechanisms and tenant effective projections; seed only reviewed settings.

### 17.2 Rollout

Prefer one explicit tenant/cohort route capability for the new runtime and additional verified connector capabilities over many overlapping flags. Candidate code ntf_delivery_v2 is proposed, not seeded or confirmed available. Use create-feature-flag workflow if approved; do not change existing plan-bound mappings.

Off-state: legacy behavior with P1 safety fixes. Shadow-state: validate/render and compare without provider sends or billable reservations. On-state: exactly one active delivery owner for the selected tenant/event/channel.

### 17.3 Infrastructure

Use current PostgreSQL, Supabase, Redis/BullMQ, NestJS and Next.js architecture; no new broker is required initially.

Implement recoverable DB-to-queue publication and worker readiness/liveness, graceful shutdown, provider timeouts, bounded concurrency and saturation monitoring. Do not hold DB transactions open across provider calls.

Contract drift checks cover API/worker/direct connector parity without copying implementation code between repos. Keep dependencies pinned/lockfiles reviewed. Schedule provider API-version deprecation review; existing hardcoded Meta API version requires verification before upgrading.

## 18. File and module implementation inventory

Existing anchors below are scoped entry points, not authorization to rewrite every file. Exact per-slice files are listed again before implementation.

### 18.1 Tenant existing files

- web-admin/lib/notifications/event-emitter.ts, orchestrator.ts, recipient-resolver.ts, user-prefs.ts, settings-service.ts, types.ts, template-renderer.ts and order-event-variables.ts.
- web-admin/lib/notifications/adapters/outbox.ts, email.ts, sms.ts, whatsapp.ts, push.ts and push/*.
- web-admin/lib/notifications/adapters/whatsapp-template-config.ts and whatsapp-content-variables.ts; preserve current successful mapping fixtures.
- web-admin/lib/notifications/whatsapp-customer-eligibility.ts and whatsapp-phone.ts.
- web-admin/app/api/notifications/process-outbox/route.ts and process-campaigns/route.ts; identify the existing internal dispatch route through scoped inventory before changing it.
- web-admin/app/api/v1/notifications/settings/providers/route.ts and related settings/user-prefs/delivery-log/campaign routes.
- web-admin/src/features/notifications/{api,hooks,model,ui,access}; existing customer preference editor/API/service remains the consent entry point.
- web-admin/app/dashboard/notifications/{page.tsx,settings/page.tsx,delivery-log/page.tsx} and existing marketing campaign pages.
- web-admin/config/navigation.ts; only if menu changes are approved, paired sys_components_cd migration.
- web-admin/messages/en/** and ar/** scoped notification/customer/common namespaces.
- web-admin/__tests__/notifications/** and existing customer preference/permission tests.

Proposed new tenant responsibilities: event/intent service, policy evaluator, effective-route client, variable schema/evaluator, channel renderers, attempt/receipt reconciliation, connection/assignment services and API endpoints in section 10. Place constants/types in lib/constants/ and lib/types/ with reexports; validate all names against persisted values. UI components stay in existing feature folders.

### 18.2 HQ existing files

- platform-api/src/modules/notifications-hq/templates/{templates.controller.ts,templates.service.ts,templates.repository.ts,dto/templates.dto.ts}.
- platform-api/src/modules/notifications-hq/governance/{governance.service.ts,governance.repository.ts,controllers/*}.
- platform-api/src/modules/notifications-hq/dispatch/{dispatch.service.ts,provider-resolver.service.ts,dispatch.queue.ts,metering.service.ts,dto/*,providers/*}.
- platform-api/src/modules/notifications-hq/webhooks/{webhooks.controller.ts,webhooks.service.ts}.
- platform-api/src/modules/notifications-hq/{quota,pricing,observability,broadcast} scoped services/controllers/repositories.
- platform-api/src/modules/notifications-hq/notifications-hq.types.ts and generated database types after user-applied schema.
- platform-workers/src/notifications/dispatch.processor.ts and providers/*.
- platform-web/src/features/notifications-hq/{api,hooks,model,ui}; existing /notifications pages.
- HQ EN/AR catalogs, permission/navigation sources and access guards discovered within the relevant scope before edits.

Proposed HQ responsibilities: connections/senders, provider registrations/revisions, localized template/variable APIs, typed async command acceptance, credential resolver, durable receipt processing, route projections and usage reservations. Prefer submodules within notifications-hq; create new top-level Nest modules only when their boundary requires it.

### 18.3 Cross-project contracts and generated artifacts

Update both copies of docs/dev/rules/integration-contracts.md for approved API/schema ownership changes. Regenerate both apps' DB types after user application. Refresh OpenAPI/contract fixtures, page access contracts and platform inventories as applicable. No generated inventory is hand-edited to conceal drift.

## 19. Work packages, dependencies and exit gates

All tasks below are pending. Complete and document one reviewed slice at a time; do not interpret historical feature checkmarks as completion of these tasks.

| Phase | Work packages | Depends on | Exit gate |
|---|---|---|---|
| P0 — Baseline/contracts | Scope exact files, read-only schema comparison, ADR decisions where required, permission/secret/config inventory, event and provider contract fixtures | Plan review | Ownership, identifiers, existing/live differences and acceptance criteria recorded. |
| P1 — Safety/legacy transport | Invalid webhook rejection/official verification; durable pre-send claim; BYO worker parity; correct transient/permanent retry; tenant predicates; lease recovery design | P0; M1 if required | Forgery, race, crash, credential and retry tests pass; working direct Twilio stays compatible. |
| P2 — Accounts/templates | M2/M3 drafts and review; accounts/senders/grants; localized content; typed variable contract; provider registration/revisions/import/sync | P1; user-applied schema | Matching account/language/sender and immutable publication validated. |
| P3 — Durable runtime | M4; event capture/intents; outbox pins/leases; attempt result normalization; DB/queue bridge; receipt correlation/reconciliation | P2; approved producer integration | No duplicate under tested races; unknown acceptance blocked; event recovery and callback-before-finalization pass. |
| P4 — APIs/UI | Administrative and tenant APIs; structured HQ editor/onboarding; tenant settings/preview/test/delivery timeline; access/i18n/stories | P2/P3; M5 where needed | EN/AR/RTL and denied-action browser flows pass; side-effect boundaries verified. |
| P5 — Producers/campaigns | First order event pilot; audit all approved producer call sites; campaign/broadcast canonical builder; preference precedence and cancellation | P3/P4 | Staff/customer identity and queued-versus-delivered counters correct; transactional work not starved. |
| P6 — Usage/resilience | M6; atomic reservation/ledger; fair scheduling, limits, circuit breakers, account health, monitoring and privacy retention | P3/P5; accounting policy review | Concurrent cap tests, exact replay accounting and reconciliation report pass. |
| P7 — Release/handover | Shadow comparison, pilot actual sends, alerts/runbooks, operator training, restore/drain/rollback exercise, phased tenant expansion | All required gates | Recorded release evidence; no critical unresolved defect or unapproved billing/auth/schema change. |

### 19.1 Per-package execution checklist

- [ ] Refresh scoped baseline and list exact files; preserve unrelated workspace edits.
- [ ] Load project/domain skills and confirm repo ownership.
- [ ] Write tests for business/security/concurrency behavior before or alongside the change.
- [ ] Draft new SQL only if approved, with all object comments and rollback compatibility; stop for user migration review/application.
- [ ] Implement service/use-case layer, contracts and UI with no unchecked any or controller business logic.
- [ ] Run applicable targeted tests, lint, typecheck, i18n/access checks and builds.
- [ ] Review diff for tenant predicates, secret leakage, compatibility and money/consent behavior.
- [ ] Update canonical plan checkboxes and feature docs with evidence; mark remaining live checks pending.

## 20. Test and acceptance matrix

| Scenario | Required observable result |
|---|---|
| Same business occurrence processed twice | One intent/channel delivery per allowed recipient, with stable event identity. |
| Business transaction rolls back | Its notification event cannot appear as committed work. |
| Commit succeeds then process crashes | Durable event is found and fan-out resumes. |
| Two workers claim one due row | One valid claim/attempt; stale finalization rejected. |
| HQ accepts command but Redis enqueue fails | Durable publication replays without duplicate provider submission. |
| Provider accepts then DB finalization fails | Unknown/accepted evidence reconciles; no blind replay. |
| Transient provider rejection / 429 | Correct retry delay/backoff and lease behavior. |
| Permanent rejection | No automatic repeated provider requests; actionable reason. |
| Callback forged/missing secret/wrong account | No authoritative receipt/status mutation or tenant disclosure. |
| Form callback, batched Meta statuses and early receipt | Correct verification/parsing; all events correlated eventually. |
| Receipt duplicate or reordered delivered/read | Dedupe and non-regressing channel transition facts. |
| Same command key reused with different payload/tenant | Conflict, no send and no previous tenant's data returned. |
| BYO decrypt/credential failure | No platform fallback; masked actionable configuration error. |
| Activation fails midway or concurrent edit occurs | Prior route preserved; revision conflict handled. |
| Cross-tenant ID in connection/sender/template/delivery/customer/push writes | Denied at API/query/FK boundaries, including service-role paths. |
| Staff opt-in but customer opted out | Customer external delivery blocked. |
| Consent revoked after enqueue; channel disabled before send | Recorded skip; no alternative channel bypass. |
| Required variable missing / dependency cycle / unsupported source | Publish/render blocked with field-level diagnostics. |
| Zero/one/many items, nested pieces and long localized descriptions | Bounded, correctly ordered output with explicit overflow; no fake rows. |
| Persisted invoice total differs from qty times price | Notification uses authoritative totals and currency. |
| Date-only, timezone boundary, DST and working-day calculation | Defined date semantics; authoritative readiness respected. |
| Arabic requested with no eligible approved template | Explicit unavailable/fallback decision; no silent language switch. |
| WhatsApp template payload | Exact SID/slots, no Body/MediaUrl; no newline-containing variable values. |
| SMS Unicode/extension characters/long text | Accurate segment estimate and configured limit behavior. |
| Push partly invalid/no subscriptions | Per-device result, tenant-safe retirement, no fake sent count. |
| Email bounced/complained; inbound opt-out | Suppression prevents subsequent disallowed send. |
| Campaign paused/cancelled during batch | Unstarted targets stop; accepted attempts remain accounted honestly. |
| Parallel quota reservations and repeated receipts | Hard-cap enforcement and one ledger effect per charge/usage event. |
| Preview/verify/save on UI | No provider message sent; dirty data retained after errors. |
| Unauthorized test/export/replay or HQ tenant JWT | Action denied on server and disabled/hidden correctly in UI. |
| EN/AR, RTL, keyboard and narrow viewport | Readable codes, correct focus, accessible errors and responsive forms. |
| Secret logs/exports/replay payloads | Redaction verified; sensitive recipient reveal audited. |
| Legacy configured Twilio order-created flow | Existing event/key aliases continue working during migration. |
| Restore, queue drain and deployment rollback | No duplicate automatic resend; accepted/unknown attempts retained for reconciliation. |

Use deterministic clocks, injected providers, actual concurrency and database constraints for meaningful tests. Do not mock away the races the architecture must solve. Live sandbox tests supplement contracts; real authorized pilot delivery and callback evidence remains a distinct release gate.

### 20.1 Validation commands and known limitations

Commands are verified from current package scripts where stated. Reconfirm before execution; do not run a full suite by default.

Tenant web-admin: targeted npm test / Jest paths under __tests__/notifications; npm run typecheck; npx eslint . --quiet; npm run check:i18n; required access-contract/inventory checks; npm run build after frontend changes.

HQ platform-api: targeted npm test for notifications-hq specs; npm run build; typecheck using its confirmed tsconfig/toolchain. Avoid the existing lint script's broad --fix churn; use a scoped nonmutating lint invocation.

HQ platform-web: targeted Jest/Playwright; npx eslint . --quiet; confirmed typecheck invocation; npm run build; npm run verify:schema after applied schema/type regeneration.

Platform-workers: npm run build. It currently has no test script; add a reviewed lightweight test harness or export deterministic handlers to a verified harness before claiming worker behavior covered.

Prior tenant increment reported passing targeted tests/build/lint/i18n, but standalone typecheck had unrelated FX BigInt/target and tenant subscription-currency errors; build currently skips TypeScript errors. Recheck, isolate and resolve/record these baseline blockers; a build cannot replace typecheck evidence. Prior Storybook build exited natively without a source diagnostic; stories must be compiled/previewed before marking that gate passed.

For this documentation task, validate relative links, identifiers, examples, phase/endpoint consistency and git diff --check only. No application build or external send is necessary.

## 21. Observability, operations and readiness

Trace business_event_id -> intent_id -> delivery_id -> attempt_id -> HQ command -> provider message -> receipt. PII is excluded from metric labels and routine logs.

Metrics: due queue lag, claim/lease recovery, acceptance/delivery latency by channel/account, failure categories, unknown acceptance age, unmatched/invalid receipt volume, consent skips, throttling, account saturation, reservation drift and usage reconciliation differences.

Set initial operational objectives during P0 using actual tenant/provider throughput, not invented guarantees. Record proposed SLO thresholds as targets and validate them under load; exclude scheduled/quiet-hour delays from immediate-delivery latency.

Alert on invalid-signature spikes, stalled publication, expired leases, unresolved acceptance, receipt mismatch, disabled/expired credentials, provider approval regression, quota ledger drift and transactional starvation.

Runbooks: connection verification/rotation; sender registration; template import/submission/approval; tenant activation; consent/opt-out; safe test; retry versus reconciliation; incident pause/drain; provider outage; restore; retention cleanup; billing/usage reconciliation; operator handover.

Dead-letter operations require reason, permission, preflight and idempotent audit. A retry is not deletion/recreation of evidence. Unknown acceptance must never appear as an ordinary Retry button without its additional review path.

## 22. Compatibility rollout and rollback

1. Apply reviewed additive schema through the user; regenerate types in both repos and deploy backward-compatible readers.
2. Import legacy config into candidate connections/bindings without activating or replacing current routes. Dry-run reports list affected rows and unresolved evidence.
3. Validate exact live provider account/template/sender/language evidence and preserve current aliases. Failed imports remain legacy; they do not create half-active routes.
4. Shadow policy/rendering comparisons without sends, quota charges or campaign progress mutations.
5. Activate a controlled tenant/event/channel cohort. Existing attempts finish through their original owner; pause/drain unresolved work before changing ownership.
6. Verify actual provider acceptance, delivery callback correlation, consent enforcement, locale, duplicates and usage for pilot cases.
7. Expand only after recorded gates. Monitor and retain legacy reader compatibility until the deprecation window is explicitly approved.

Rollback changes route selection for new work; it does not delete accounts/template revisions/attempt/receipt evidence or replay accepted/unknown work. Resolve in-flight leases and HQ commands before switching transport. Do not drop additive schema during a routine application rollback.

Restore from backup can replay old queue/acceptance state; use provider reconciliation and a reviewed recovery window before re-enabling workers. Test database/Redis consistency recovery.

## 23. Decisions and follow-ups with explicit gates

| Decision | Recommended starting point | Gate |
|---|---|---|
| Transport ownership | Tenant intent/outbox authority; HQ transport for platform accounts; direct BYO compatibility where supported | P0 route/credential ownership contract. |
| First producer scope | order.created pilot, then approved lifecycle/payment/other event integrations | Verify exact producer transactions/call sites before edits. |
| Private logical-template authoring | Deferred; import private provider registrations against approved typed event contracts | Separate product/security scope if needed. |
| HQ permission provisioning | Existing utilities + exact reviewed grants; production enforcement mandatory | Registry/schema audit and approved seed/application, no global casual rewrite. |
| Provider named-slot discrepancy | Import exact approved names and validate with account evidence | Do not auto-rename working estimated_ready_at. |
| Working-day calculation | Consume authoritative due date; optional estimate only with named calendar/base/cutoff | Business SLA owner approval. |
| Retention/residency/compliance | Deployment-specific approved policy; minimize stored PII | Required before production cohort expansion. |
| Quota units/charge timing | Preserve commercial policy; define atomic reservation and reconciliation units | Accounting policy review before M6/pilot metering. |
| Capacity/SLO thresholds | Measure current traffic, account throughput and queue behavior | Load-test evidence before broad rollout. |
| Shared implementation package | Not required initially; use generated contracts/fixtures | User-written Approved_By_Jh ADR marker if later proposed. |

Each unresolved item has a phase gate. Implementation may proceed on independent work, but no dependent production activation is allowed while its gate remains unresolved.

## 24. Documentation deliverables and definition of done

Maintain this plan and its schema/contract companion as planning truth. Update existing feature guides rather than publishing duplicate active manuals.

For every implemented slice document permissions, navigation/screen paths, tenant/system settings, flags/plan impacts, EN/AR keys, API operations, migration identifiers/comments, constants/types, credential/env sources, queue behavior, tests, live evidence and rollback.

Definition of done:

- [ ] All applicable requirements in section 1 have linked test/review evidence.
- [ ] Schema is user-applied and verified; types/generated contracts agree.
- [ ] Tenant isolation, server permissions, callbacks and secrets pass security tests.
- [ ] Provider/direct/queued paths use compatible typed contracts and outcome semantics.
- [ ] EN/AR/RTL and controlled UI workflows pass browser/accessibility checks.
- [ ] Builds, lint, typecheck and targeted tests pass, or unrelated baseline blockers have explicit release disposition.
- [ ] Real authorized pilot cases show provider receipt correlation and correct usage; deployment status is recorded.
- [ ] Recovery/rollback/retention/runbooks are exercised and owners are assigned.
- [ ] No unresolved critical defect, unknown ownership, unapproved commercial change or silently bypassed release gate.

## 25. Reference verification

Primary provider/database guidance was checked on 2026-10-03; revalidate when implementing version-sensitive operations:

- [Twilio variable rules](https://www.twilio.com/docs/content/using-variables-with-content-api).
- [Twilio Content SID sends](https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder).
- [Twilio WhatsApp concepts](https://www.twilio.com/docs/whatsapp/api).
- [Twilio webhook verification](https://www.twilio.com/docs/usage/webhooks/webhooks-security).
- [Twilio SMS encoding/segmentation](https://www.twilio.com/docs/glossary/what-sms-character-limit).
- [FCM throughput/retry guidance](https://firebase.google.com/docs/cloud-messaging/scale-fcm).
- [BullMQ permanent-failure handling](https://docs.bullmq.io/patterns/stop-retrying-jobs).
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Supabase changelog review identified the September 2026 Postgres minor-upgrade notice involving ltree, pgcrypto and btree_gist. No dependency upgrade or DB maintenance is performed by this plan; verify actual engine/extensions/cipher usage before related schema/credential work. [Upgrade notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
