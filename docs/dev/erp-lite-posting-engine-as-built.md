# ERP-Lite posting engine — as-built (B9)

**Scope:** Tenant `web-admin` service `lib/services/erp-lite-posting-engine.service.ts`. HQ simulation (if any) must stay aligned with this behavior or document drift.

## Entry points

| Method | Purpose |
|--------|---------|
| `preview` | Resolves governance + open period + lines **without** persisting a journal. Used for dry-run / UI validation. |
| `execute` | Builds envelope, runs `executeEnvelope` in a tenant-scoped transaction (unless nested `executeInTransaction`). |
| `executeInTransaction` | Same as execute but uses caller-supplied Prisma transaction client. |
| `retry` / `repost` | Replays a stored log row; reuses stored **idempotency_key** and sets retry/repost linkage on the new envelope. |

All paths call `assertErpLiteEnabledForTenant` where applicable (see end of service).

## Idempotency

- **Key material:** `buildIdempotencyKey(tenant_org_id, txn_event_code, source_doc_id)` unless an existing key is passed (retry/repost).
- **Before journal write:** `findExistingPostedLog` checks for a prior successful post with the same key; if found, the engine logs a **SKIPPED** attempt, records a **duplicate**-type exception, and returns a failed execute result (no second journal).
- **Attempts:** `getNextAttemptNo` increments per tenant + idempotency key for audit (`attempt_no` on the envelope).

Callers should treat **duplicate** as a business-safe outcome (already posted), not always as a hard error in UX—depends on product messaging.

## Precheck vs commit

- **Validation** happens during `resolvePostingContext` (governance, period, accounts, amounts, line conditions). Failures map to `ErpLitePostingError` with attempt/log/exception statuses.
- **Preview** exercises resolution without commit; **execute** runs the same resolution path then persists log + journal inside the transactional block.
- **Partial failure:** On exception after a posting log row may exist; comments in `executeEnvelope` explain using the global Prisma client for `handleExecuteFailure` when the transaction is aborted (PostgreSQL `25P02`).

## Correlation

- Posting log rows store payload and results JSON; use `posting_log_id` from execute results for support. UI surfaces should prefer existing `cmxMessage` / error text from server actions, not raw stack traces.

## Auto-post adapter (`ErpLiteAutoPostService`)

Phase 5 **`lib/services/erp-lite-auto-post.service.ts`** does not call `preview()` before `execute()`. After policy lookup it delegates to **`ErpLitePostingEngineService.execute`** (or **`executeInTransaction`**). The engine already runs **`resolvePostingContext`** (governance, period, accounts, balanced lines) **before** persisting the journal inside the same transactional path as the posting log—this is the effective **precheck** for invoice/payment/refund/expense auto-post flows. Blocking invoice/payment callers use **`assertBlocking*AutoPostSucceeded`** to fail the business transaction when `execute_result.success` is false.

## Related

- Period close precheck: `ErpLitePeriodsService.precheckPeriodClose` (draft journals + open exceptions), not inside the posting engine.
- Constants: `lib/constants/erp-lite-posting.ts`.
