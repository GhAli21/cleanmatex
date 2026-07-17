# B19 — Expiry and Idempotency Jobs

## Metadata
Backlog ID: B19 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: NOT_STARTED
Authoritative report sections: §45, §33 (expiry rows), §50-B19
Required decisions: [D008](00_Phase_0_Financial_Semantics/D008_Stored_Value_Funding_Treatment.md) (breakage interaction), [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md) (key retention)
Dependencies: [B07](B07_Financial_Outbox_Processor.md) (hard — job infrastructure)
Blocks: — · Recommended phase: Seq 9

## Confirmed problem
`expireGiftCards` exists with zero callers (DISCONNECTED); wallet/loyalty expiry, pending-payment aging sweep, idempotency-key TTL cleanup, and posting-retry runners are NOT_FOUND (§45).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| gift-card-service.ts:1194 | expireGiftCards ready | no scheduler |
| org_idempotency_keys TTLs | expires_at stored | no cleaner |
| §45 required-paths list | four ordered recovery paths | unimplemented |

## Required outcome
Scheduled runners (per B7 infrastructure): gift-card expiry, wallet/loyalty expiry (when policies exist), pending-payment aging sweep feeding the B30 worklist, idempotency cleanup honoring D010 retention, ERP posting-retry over exceptions.

## Scope
Job registrations + runbooks; expiry event emission (breakage recognition deferred to B25).
**Frontend surface (rule 7):** jobs appear on the B07 ops-visibility screen (last run, next run, outcome counts, manual re-run action); expiry results visible on the respective GC/wallet/loyalty screens.

## Out of scope
Breakage GL (B25); outbox runner itself (B7); snapshot-repair sweep (ships with B2 follow-up).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (expiry events later) |
| Snapshot | NO |
| Reconciliation | YES (aging visibility) |
| Customer receipt | NO |
| Audit/outbox | YES |

## Acceptance criteria
Expired-dated gift card flips to EXPIRED on schedule with ledger event; keys past retention are removed; aged PENDING legs appear in the worklist feed.

## Required tests
integration (schedules), idempotency (re-run safety), regression.

## Dependencies and sequencing
Hard after B7.

## Delivery surfaces

Backend services: job registrations on B7 runner (gift-card expiry via expireGiftCards; wallet/loyalty expiry when policies exist; pending-payment aging sweep; idempotency TTL cleaner; ERP posting-retry over exceptions)
Database/schema: none new
API/endpoints: manual-run endpoints per job (ops-gated)
Frontend page/screen/dialog/action: jobs section on the B07 ops-visibility screen — last run, next run, outcome counts, manual re-run per job; expiry outcomes visible on GC/wallet/loyalty screens (status flips)
Reusable components/helpers: B7 runner + registry
Permissions: ops job permission (B27)
Validation: job idempotency — re-run produces zero duplicate effects
i18n/RTL: EN/AR job names/status
Accessibility: table semantics on ops screen
Audit trail: run log per job (started/finished/counts/actor for manual)
Observability: stuck-job alerting; aging-sweep feeds B30 worklist age column
Jobs/workers: this package IS the jobs
Feature flag: per-job enable
Rollout: one job at a time (GC expiry first) on staging schedules
Rollback: disable job flag; no data mutation to unwind (expiry rows remain valid)

## End-to-end operational flow (operator: ops)

- **Trigger:** system — each registered job fires on its schedule via the B7 runner (gift-card expiry, wallet/loyalty expiry when policies exist, pending-payment aging sweep, idempotency TTL cleaner, ERP posting-retry). Operator trigger: manual re-run per job from the B07 ops-visibility screen.
- **Permissions:** scheduled runs are system-actor; the jobs section of the ops screen and manual-run endpoints are gated behind the ops job permission (B27); unauthorized users see run actions disabled with reason.
- **API/system action:** scheduled invocation through the B7 runner; ops-gated manual-run endpoint per job; read endpoints for last/next run and outcome counts.
- **Backend execution:** each job processes its eligible set in bounded batches inside transactions — e.g. GC expiry flips expired-dated cards to EXPIRED and writes the ledger event; the aging sweep stamps aged PENDING legs for the B30 worklist; the TTL cleaner deletes only keys past the D010 retention window; posting-retry re-dispatches eligible ERP exceptions.
- **Success path:** run log records started/finished/processed counts; expiry outcomes visible on the GC/wallet/loyalty screens (status flips); aged legs appear in the B30 worklist with age badges; ops screen shows the green run.
- **Failure handling:** a job failure marks the run failed with the error captured; partial batches roll back at batch granularity — no half-expired card; one job's failure never blocks the other jobs.
- **Retry logic:** next scheduled run naturally re-processes remaining eligible rows; manual re-run available after fixing the cause; every job is idempotent — re-running produces zero duplicate effects (an already-EXPIRED card, an already-cleaned key, and an already-stamped leg are all no-ops).
- **Audit logging:** run log per job (schedule vs manual, actor for manual, counts, duration); each expiry writes its own ledger event with lineage to the run.
- **Observability:** stuck-job alerting (missed schedule or overlong run); outcome counts trend on the ops screen; the aging sweep feeds the B30 worklist age column; TTL cleaner reports deleted-key counts against the retention policy.
- **Recovery procedures:** failed run → fix cause, manual re-run (idempotent); runaway/incorrect job → disable its per-job flag while the rest keep running; wrongly expired rows are corrected through the governed adjustment path (never direct DB edits), and the expiry job's eligibility query is fixed before re-enable.

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
