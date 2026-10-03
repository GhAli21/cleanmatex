# CleanMateX Edit Order V2 — API Contract Catalog

**Version:** 3.0  
**Date:** 2026-10-02  
**Status:** Normative implementation contract

## 1. API principles

- All routes are tenant-scoped by authenticated server context. Tenant/actor supplied by browser are ignored/rejected.
- Currency and authoritative monetary results come from server state/calculation.
- `wfStateVersion` is the API name for the current physical workflow `state_version` during the compatibility phase.
- `editStateVersion` is the commercial revision/OCC counter.
- Preview is read-only. Apply is atomic and idempotent.
- Apply never performs gateway/refund/notification HTTP calls inside the DB transaction.
- Client temporary IDs are UUIDs and are mapped to persisted UUIDs by Apply.
- Unknown fields are rejected by strict validation.

## 2. Common error envelope

```json
{
  "ok": false,
  "error": {
    "code": "EDIT_STATE_VERSION_CONFLICT",
    "message": "The order changed while you were editing.",
    "details": {},
    "requestId": "..."
  }
}
```

### HTTP mapping

| HTTP | Domain codes |
|---|---|
| 400 | `VALIDATION_ERROR`, malformed operation graph, invalid enum/value |
| 401 | `UNAUTHENTICATED` |
| 403 | `PERMISSION_DENIED`, `EDIT_ACCESS_BLOCKED`, hard `OPERATION_NOT_ALLOWED`, `OVERRIDE_FORBIDDEN` |
| 404 | `ORDER_NOT_FOUND`, `TARGET_NOT_FOUND` (tenant-safe; never disclose foreign-tenant existence) |
| 409 | `EDIT_STATE_VERSION_CONFLICT`, `WORKFLOW_VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `REVIEW_STALE`, conflicting operations |
| 422 | structural/business invariant violations, unsupported finance/fiscal mode, invalid target hierarchy |
| 413 | transport body-size limit exceeded (bounded rejection before JSON allocation) |
| 500 | unexpected internal failure; no sensitive details |
| 503 | required pricing/tax/configuration dependency unavailable where fail-closed is required |

Do not expose stack traces, SQL, secrets, raw gateway payloads, PAN/CVV, or cross-tenant identifiers.

## 3. GET `/api/v1/orders/[id]/change-context`

Purpose: authoritative Edit V2 load model.

### Response 200

```json
{
  "ok": true,
  "data": {
    "orderId": "uuid",
    "orderNo": "string",
    "committedAt": "ISO-8601",
    "editStateVersion": 3,
    "wfStateVersion": 12,
    "workflow": {
      "currentStatus": "preparing",
      "profileId": "uuid|null",
      "profileVersionId": "uuid|null"
    },
    "editAccess": {
      "status": "OPEN",
      "reasonCode": null,
      "reasonText": null,
      "blockedUntil": null
    },
    "permissions": {
      "canEdit": true,
      "canOverride": false,
      "canOverridePrice": false
    },
    "configuration": {
      "featureEnabled": true,
      "newItemPricePolicy": "...",
      "existingDiscountPolicy": "...",
      "reasonPolicy": "..."
    },
    "order": {
      "customer": {},
      "customerSnapshot": {},
      "branchId": "uuid",
      "currencyCode": "OMR",
      "priority": "normal",
      "serviceSpeed": "STANDARD|null",
      "readyBy": "ISO-8601|null",
      "notes": "",
      "customerNotes": ""
    },
    "items": [],
    "pieces": [],
    "preferences": [],
    "financial": {
      "totalAmount": "0.0000",
      "netCollectedAmount": "0.0000",
      "outstandingAmount": "0.0000",
      "overpaidAmount": "0.0000"
    },
    "capabilitySummary": {}
  }
}
```

### Load requirements

- Return persisted IDs for all committed item/piece/preference rows.
- Active arrays exclude `rec_status=0`; history endpoint/view may include inactive facts.
- Item and piece hierarchy must be tenant/order validated.
- Customer ID, branch ID and currency are read-only in Edit V1.
- Do not map a piece UUID to a synthetic `temp-*` value.

## 4. POST `/api/v1/orders/[id]/changes/preview`

### Request

```json
{
  "expectedEditStateVersion": 3,
  "expectedWfStateVersion": 12,
  "sourceContext": "STAFF_EDIT",
  "changeReason": "optional unless policy requires",
  "operations": [
    {
      "seq": 1,
      "code": "CHANGE_ITEM_QUANTITY",
      "target": {"kind":"PERSISTED_ITEM","id":"uuid"},
      "payload": {"quantity": 3}
    }
  ],
  "gateDecisions": []
}
```

### Response 200

Returns normalized operations, before/after summaries, authoritative money, capability decisions, warnings, required reason/override, financial outcome, source-qualified finance follow-up options, and a review proof/fingerprint.

```json
{
  "ok": true,
  "data": {
    "noChange": false,
    "normalizedOperations": [],
    "review": {
      "groups": [],
      "warnings": [],
      "requiresReason": false,
      "requiresOverride": false
    },
    "money": {
      "beforeTotal": "20.0000",
      "afterTotal": "15.0000",
      "commercialDelta": "-5.0000"
    },
    "financial": {
      "outcome": "OVERPAYMENT",
      "outstandingAmount": "0.0000",
      "overpaidAmount": "5.0000",
      "allowedFollowUp": []
    },
    "versions": {"editStateVersion":3,"wfStateVersion":12},
    "reviewProof": "opaque-server-signed-stateless-proof",
    "calculationFingerprint": "hash"
  }
}
```

Preview must perform zero DML against commercial facts, Change/audit/outbox/idempotency, promotion usage/reservations, stored value or snapshots.

## 5. POST `/api/v1/orders/[id]/changes`

Header: `Idempotency-Key: <opaque client UUID/string>` required.

### Request

Same intent as Preview plus required `reviewProof` and `calculationFingerprint`. A public Apply contract must not make reviewed-result binding optional. Implement the proof as a server-signed stateless value; Apply recomputes the bound facts and calculation. Missing/invalid proof is validation failure; expired or materially changed review is 409 `REVIEW_STALE`.

### Apply ordering

1. authenticate, derive tenant/actor, enforce current response-disclosure permission and validate strict input;
2. enter the tenant transaction, lock the order, recognize successful replay before rejecting now-stale versions/proof expiry, then coordinate command/child/source locks;
3. verify edit/workflow versions;
4. verify commitment/access/permission/capabilities/proofs;
5. recompute projection and money;
6. reject stale reviewed result rather than silently applying a new amount;
7. persist stable mutations and financial snapshot;
8. persist Change + ops;
9. increment edit version once;
10. audit/outbox/idempotency in same transaction;
11. commit;
12. return immutable apply response.

### Response 201 (successful Change); 200 (exact replay or no change)

```json
{
  "ok": true,
  "data": {
    "orderChangeId": "uuid",
    "changeNo": 2,
    "revision": 4,
    "wfStateVersion": 12,
    "identityMap": {"client-uuid":"persisted-uuid"},
    "money": {},
    "financial": {
      "outcome": "OVERPAYMENT",
      "outstandingAmount": "0.0000",
      "overpaidAmount": "5.0000"
    }
  }
}
```

Same key + same canonical payload returns this exact frozen response. Same key + different canonical payload returns 409 `IDEMPOTENCY_CONFLICT`.

## 6. History

Proposed V2 read route (not implemented in the current repository):

`GET /api/v1/orders/[id]/changes`

Returns V2 Change master/operation timeline plus separately labelled legacy Edit history. Do not merge lossy legacy snapshots into fake typed operations.

## 7. Finance follow-up APIs (WP16)

These are separate from Change and must be finalized against existing Finance contracts before implementation:

- additional receivable collection adapter;
- focused overpayment/financial resolution adapter.

A Change Apply response may link/route to them but never executes them implicitly.

**Current-code reconciliation / B01:** neither adapter is an implemented V2 endpoint. Do not publish an invented route or enable its action before WP16 freezes the Finance-owned route, strict DTO, source eligibility and execution contract. `order-settlement.service.ts:418` only collects `PAY_ON_COLLECTION`; the existing `collect-payment` route cannot collect a fully paid Create order's new receivable by changing its original payment type. Its request `collectedBy` (`collect-payment/route.ts:22`) is not an acceptable actor source for a V2 adapter: use authenticated `requirePermission` context. The adapter must reuse current payment-leg validation, source-qualified voucher wiring, POS/drawer gates and Finance idempotency, and preserve original settlement classification.

Until the relevant Finance gate closes, `allowedFollowUp` is empty for that unsupported mode and the UI shows its explicit unavailable reason. Required additional collection remains post-Change Finance/workflow policy; Apply never collects payment. Unsupported fiscal/AR or other explicitly unsupported domain modes deny Change. Unavailable follow-up must never be presented as an implemented action, and workflow/payment policy must retain any required collection hold.

The WP16 contract closure must record, for **each** additional-collection and resolution action: actual route/method; existing permission; server-derived actor/tenant/customer/currency; Change/order/source lineage; positive amount and remaining source cap; source-qualified method; approval/reason requirements; mandatory idempotency input; frozen replay response; HTTP/error mapping; uncertain-result retry; POS/drawer requirements; execution status and history link. Refund initiation/approval/processing are distinct lifecycle actions; an initiation response is not proof of cash or gateway settlement. Existing plural refunds API supports authenticated source-qualified initiation (`refunds/route.ts:127`), while `processRefund` requires manual original-method settlement reference (`order-refund.service.ts:992`). No automatic gateway refund is promised.

## 8. Error codes required by V2

`ORDER_NOT_COMMITTED`, `EDIT_ACCESS_BLOCKED`, `EDIT_STATE_VERSION_CONFLICT`, `WORKFLOW_VERSION_CONFLICT`, `ORDER_CHANGE_OPERATION_CONFLICT`, `OPERATION_NOT_ALLOWED`, `OVERRIDE_REQUIRED`, `OVERRIDE_FORBIDDEN`, `PERMISSION_DENIED`, `INVALID_TARGET`, `INVALID_TARGET_HIERARCHY`, `STRUCTURAL_INVARIANT_VIOLATION`, `PRICING_FAILED`, `TAX_RESOLUTION_FAILED`, `FINANCIAL_SNAPSHOT_MISMATCH`, `FINANCIAL_MODE_UNSUPPORTED`, `REVIEW_STALE`, `IDEMPOTENCY_CONFLICT`, `ORDER_CHANGE_NOOP` (response condition, not necessarily error).

## 9. Required concrete DTO closure (B02; WP04/WP10/WP12/WP15)

The JSON examples above are abbreviated illustrations, not permission to expose arbitrary objects. Strict typed schemas must cover the following fields; operation payload allowlists are owned by the Operation Capability Catalog.

| DTO | Required contract |
|---|---|
| Operation | `seq` positive unique integer, catalog `code`, discriminated `target`, strict code-specific `payload`. Order targets use the route order; persisted item/piece/preference targets carry their UUID; new local targets use a client UUID resolving inside this batch. Validate parent hierarchy server-side; never use product ID or piece sequence as line identity. |
| Submitted decision | Operation `seq` plus existing semantic decision fields `gateCode`, `acknowledgementChallenge?`, `overrideReason?`. The server derives permission, actor and outcome. Adapt the existing workflow challenge binding to both commercial/workflow versions and operation digest; an unchanged workflow transition challenge is insufficient. |
| Context item | Persisted item `id`, product/catalog identity, parent order, quantity, selling unit/line amount, existing override facts, preference-charge cache, active status and target capability results. Return exact committed values and currency/tax mode; no implicit repricing. |
| Context piece | Persisted `id`, parent item, display `pieceSeq`, operational status/stage needed by capability policy, active status and permitted attributes. Synthetic `temp-*` IDs are forbidden. |
| Context preference | Persisted `id`, level and parent item/piece IDs, configured preference definition/code/kind/category/content, exact extra price, confirmation state relevant to capability policy and active status. Keep follow-up notes separate from mutable commercial content. |
| Capability decision | Operation code/target, `ALLOW|ALLOW_WITH_WARNING|REQUIRE_OVERRIDE|DENY`, stable reason code, localized message key, warning/override decision requirements and current policy/facts digest. Unknown/missing binding denies the operation. |
| Review group | Operation sequences, target IDs/safe display labels and explicit before/after field values. Item/piece/preference effects refer to stable identities; computed money is separate from submitted intent. |
| Warning | Operation sequence, stable gate/reason code, message key, acknowledgement challenge where required; override requirements use existing permission/minimum reason policy. Do not accept browser-authored warning text as proof. |
| Money | Before/after subtotal, commercial discount, additive charges, VAT/custom tax, rounding and total; currency code/precision and inclusive/exclusive mode; signed commercial delta. All response money is decimal text, not browser-calculated authority. |
| Financial | Current effective payment/credit/refund/reopen components, before/after outstanding and unresolved overpayment, four frozen outcome tokens, and only enabled source-qualified follow-up actions. `netCollectedAmount` alone is insufficient for gift/wallet/credit/B2B cases. Reuse D005 aggregation and snapshot overpayment classification (`order-financial-aggregation.ts:382`, `order-financial-write.service.ts:723`). |
| Apply success | Change ID/number, resulting edit revision and unchanged workflow version, client-to-persisted identity map for every inserted item/piece/preference, authoritative money/financial results and request ID. Persist the exact response on Change for durable replay. |

`change-context` cannot silently return empty arrays on a failed child/catalog/config read. Return the common error envelope or explicit blocked configuration state; an unavailable child source is not an empty order.

### Review proof and race binding

Bind tenant, order, authenticated actor, both expected versions, source, canonical intent/reason/decisions, relevant workflow policy/facts, calculation/configuration/catalog digest, settlement-source fingerprint and expiry. Resolve the digest under current inputs at Apply. A payment/refund/credit race can change financial outcome without changing the two order versions and must produce re-review when it materially changes the reviewed result. Retry a completed identical Apply before version/proof-expiry checks; still enforce current authentication, tenant scope and response disclosure permission.

**WP05 signing-authority gate:** the repository already signs workflow acknowledgement challenges with HMAC-SHA256 and constant-time verification (`workflow/workflow-gate-decision.service.ts:97`, `:131`); the separate facts fingerprint at :110 is an unsigned digest. Current challenge TTL is 300 seconds (:12), and signer resolution at :80 uses `WORKFLOW_GATE_CHALLENGE_SECRET`, then existing `SUPABASE_JWT_SECRET`/`NEXTAUTH_SECRET` fallbacks. This review did not read secret values or verify deployment provisioning. Reuse reviewed server-only signing primitives, not the transition-specific payload or its unsigned fingerprint as authorization. Before public Preview/Apply, WP05 and the Permissions/Security contract owner must record the authoritative secret/provisioning owner, whether existing fallback reuse is acceptable, domain-separated/versioned Change proof payload, chosen review expiry (300 seconds is current acknowledgement precedent), signing-input canonicalization, bounded token parsing and rotation behavior. Current implementation has no key identifier/key-ring or grace-rotation contract. A simple rotation policy may invalidate outstanding reviews and require Preview again; any grace-key policy needs explicit review. Completed identical Apply replay must still succeed through durable Change response lookup despite expiry/rotation, while an uncommitted invalid proof cannot execute. Missing signer fails closed through the configured-dependency error envelope. Do not introduce an env variable or expose a signing/JWT/authentication secret without owner approval; link this gate to Permissions/Security/Tenant Isolation and test tampering, expiry, rotation, actor/tenant/operation mismatch and completed replay.

WP05 adds a server-only, injected-key proof primitive that implements the required domain-separated HMAC payload and constant-time verification without reading an environment variable or enabling an endpoint. It binds tenant, order, authenticated actor, both expected versions, source, canonical intent/reason/decisions digests, profile-version/policy revision, policy facts, calculation fingerprint, settlement-source fingerprint, key identifier, and a 300-second expiry. The injected key-ring interface makes a future approved rotation policy possible, but does not choose a secret owner, provision a key, or grant grace rotation. It remains unconnected to Preview/Apply until those release gates close.

### No-change and idempotency

A validated empty normalized intent returns 200 with `noChange:true`, current versions and `orderChangeId:null`; it writes no Change, revision, audit or outbox. Invalid targets/authorization do not become a successful no-op. A same-key concurrent call serializes on the order/command boundary and either returns the exact completed response body (HTTP 200 on replay; original success is 201) or a bounded retryable conflict; it must not execute twice. On rollback, the transaction-owned claim rolls back too. Durable Change lookup survives expiry/cleanup of the seven-day generic idempotency cache. Freeze the digest fields, resource namespace, no-op replay retention and retryable conflict mapping at WP04/WP11; use the same canonical intent on Preview and Apply and exclude transport-only request IDs from the digest.

### History and limits

`GET /changes` must freeze a bounded cursor-page schema (`limit`, cursor based on Change number/ID), descending deterministic order, safe Change summaries, typed operations with before/after, financial outcome, actor/source/reason and separate labelled legacy entries. Reads require existing order-read and applicable financial-detail permission; do not expose unredacted snapshots to a weaker role. Freeze page maximum and whether detail is returned inline or through an approved read endpoint at WP04/WP15; there is no deployed V2 history route yet.

### Frozen finite limits (WP04)

The following limits are shared contract constants in `web-admin/lib/constants/order-change.ts`. They constrain untrusted transport and graph shape only; authoritative capability and tenant configuration remain server-derived. Context has no request body and keeps the existing general read limiter. Preview and Apply must use the bounded reader before parsing JSON and the dedicated distributed rate checks below when their routes are implemented.

| Limit | Value | Rationale / current convention | Enforcement owner and validation layer | Applies to |
|---|---:|---|---|---|
| Request body | 131,072 bytes (128 KiB) | Fits a 50-operation typed amendment with bounded decisions while preventing allocation abuse. | Shared `readBoundedOrderChangeJson` streams and counts bytes; Preview/Apply routes map overflow to `413`. | Preview, Apply |
| Total operations | 50 | Conservative versus existing Create's 100-item batch while still allowing a substantial correction. | Shared Zod request schema. | Preview, Apply |
| New-item graph fanout | 25 `ADD_ITEM`; 50 `ADD_PIECE`; 50 `ADD_PREFERENCE`; total still 50 | V1 uses a flat operation graph, so these are code-category caps rather than fictional nested DTO arrays. | Shared Zod cross-operation validation. | Preview, Apply |
| Selected piece IDs | 50 per quantity operation | Bounds the only nested UUID collection while allowing a practical piece-level correction. | Shared Zod payload validation. | Preview, Apply |
| Gate decisions | 20 | Reuses the established bounded workflow command decision array. | Shared Zod request validation. | Preview, Apply |
| Reason | 500 characters | Reuses the established legacy Edit reason bound. | Shared Zod validation. | Preview, Apply |
| Notes/content and customer snapshot | Order/customer notes 1,000; piece/preference content 500; customer name/email 255; mobile 50 characters | Reuses existing Edit/New Order field limits without widening stored contracts. | Shared strict operation schemas. | Preview, Apply |
| Review proof | 4,096 characters | Matches the bounded Change acknowledgement contract and leaves body-level protection in place. | Apply schema; Apply verifies signed semantics separately. | Apply |
| Calculation fingerprint | 256 characters | Sufficient for a versioned compact hash/fingerprint and prevents opaque-token inflation. | Apply schema. | Apply |
| Idempotency key | 200 characters, nonblank after trim | Reuses durable money/legacy Edit API convention. | Apply route header schema before DB work. | Apply |
| History cursor/page | Opaque cursor 512 characters; default 20; maximum 100 | Mirrors existing bounded list defaults and 100-row maximum. Cursor must decode to deterministic `(change_no,id)` ordering. | Future History query schema/reader. | History |
| Preview rate | Existing generic tenant/user limits plus 30/minute per `tenantId:userId` and 10/minute per `tenantId:orderId` | Recalculation is costlier than an ordinary read; the per-order key contains accidental refresh storms. | WP10 route through a Change-specific distributed limiter; return V3 `429` with rate headers. | Preview |
| Apply rate | Existing generic tenant/user limits plus 10/minute per `tenantId:userId` and 5/minute per `tenantId:orderId` | Preserves retry room while protecting locks, idempotency, and immutable financial facts. | WP12 route through the same Change-specific distributed limiter; return V3 `429` with rate headers. | Apply |

The current generic Upstash limiter is fail-open. Change-specific Preview/Apply limiting must fail closed with sanitized `503` in production when its distributed limiter is missing or unavailable; local test injection may use a no-op limiter. This is a route integration requirement for WP10/WP12, not permission or capability-policy work. It does not authorize those endpoints before their packages begin.

The body reader rejects both a declared oversized `Content-Length` and a streamed oversized body before JSON parsing. Unknown fields remain rejected by strict schemas. WP04 adversarial tests cover exact and plus-one byte, operation, fanout, nested UUID, reason/content, proof/key, cursor, and pagination limits.

### Security and error mapping

All Preview/Apply and Finance mutations call existing `validateCSRF`; all reads/writes authenticate and derive tenant/actor through `requirePermission`. CSRF refusal is 403 and is adapted to the common V2 envelope without weakening middleware. `ORDER_NOT_COMMITTED` and unsupported financial mode map to 422; `OVERRIDE_REQUIRED` maps to 422 with required decisions; `INVALID_TARGET`/missing tenant-owned target maps to 404, wrong same-tenant hierarchy to 422; conflicts map to 409 as above. Use 403 for global edit-access denial consistently; do not introduce optional 423 behavior without a contract change. Unexpected errors return sanitized 500 plus request ID. Localized UI translates stable codes/message keys; no stack/SQL/internal exception message is returned.
