# CleanMateX Order Workflow V1 — API and OpenAPI Specification

**Document ID:** CMX-OW-V1-PACK-008  
**Version:** 1.0  
**Status:** Contract specification  
**Base path:** `/api/v1`

## 1. Principles

- REST/OpenAPI
- Tenant from authenticated context
- Idempotency for state changes
- Expected state version required
- No arbitrary status update endpoint
- Structured errors
- Explicit state dimensions
- Canonical codes separate from localized labels

## 2. Headers

```text
Authorization: Bearer ...
Idempotency-Key: <uuid>
X-Correlation-Id: <uuid>
If-Match-State-Version: <integer>
Accept-Language: en | ar
```

## 3. State response

```json
{
  "order_id": "uuid",
  "commercial_status": "in_progress",
  "operational_status": "processing",
  "fulfilment_status": "partially_fulfilled",
  "exception_status": "needs_attention",
  "custody_summary_status": "mixed",
  "payment_status": "partially_paid",
  "invoice_status": "not_required",
  "customer_milestone_code": "cleaning_in_progress",
  "state_version": 12
}
```

## 4. Workflow queries

```http
GET /orders/{orderId}/workflow-state
GET /orders/{orderId}/available-actions
GET /orders/{orderId}/workflow-timeline
GET /orders/{orderId}/work-groups
```

## 5. Command endpoint

```http
POST /orders/{orderId}/workflow-actions/{actionCode}
```

```json
{
  "expected_state_version": 12,
  "work_group_id": "uuid",
  "reason_code": "optional",
  "notes": "optional",
  "payload": {}
}
```

There is no authoritative `PATCH /orders/{id}/status`.

## 6. Available action

Includes code, English/Arabic labels, primary flag, enabled, required fields, warnings, blockers, permission, confirmation, and override availability.

## 7. HQ endpoints

```http
GET/POST /hq/workflows
GET /hq/workflows/{definitionId}
POST /hq/workflows/{definitionId}/versions
GET/PATCH /hq/workflow-versions/{versionId}
POST /hq/workflow-versions/{versionId}/validate
POST /hq/workflow-versions/{versionId}/simulate
POST /hq/workflow-versions/{versionId}/submit-review
POST /hq/workflow-versions/{versionId}/approve
POST /hq/workflow-versions/{versionId}/publish
POST /hq/workflow-versions/{versionId}/retire
GET/POST /hq/workflow-assignments
PATCH /hq/workflow-assignments/{assignmentId}
```

Tenant users cannot call write endpoints.

## 8. Tenant workflow info

```http
GET /tenant/workflow-profile
GET /tenant/workflow-profile/effective
POST /tenant/workflow-change-requests
GET /tenant/allowed-workflow-profiles
POST /tenant/workflow-profile-selection
```

Last two exist only when HQ enables limited selection.

## 9. Outsourcing

```http
GET/POST /outsource-vendors
PATCH /outsource-vendors/{vendorId}
GET/POST /orders/{orderId}/outsource-jobs
GET /outsource-jobs/{jobId}
POST /outsource-jobs/{jobId}/actions/{actionCode}
```

## 10. Releases

```http
GET/POST /orders/{orderId}/releases
GET/PATCH /releases/{releaseId}
POST /releases/{releaseId}/verify
POST /releases/{releaseId}/collect
POST /releases/{releaseId}/dispatch
POST /releases/{releaseId}/delivery-attempts
POST /releases/{releaseId}/confirm-delivery
POST /releases/{releaseId}/report-failure
POST /releases/{releaseId}/return-to-branch
POST /releases/{releaseId}/cancel
```

Verified release edits are prohibited.

## 11. Pickup

```http
POST /orders/{orderId}/pickup
GET /pickups/{pickupId}
POST /pickups/{pickupId}/actions/{actionCode}
```

## 12. Holds/approvals

```http
GET/POST /orders/{orderId}/holds
POST /holds/{holdId}/resolve
GET/POST /orders/{orderId}/approvals
POST /approvals/{approvalId}/approve
POST /approvals/{approvalId}/reject
```

## 13. Error schema

```json
{
  "error": {
    "code": "STALE_ORDER_STATE",
    "message": "The order changed. Reload and try again.",
    "message_ar": "تم تعديل الطلب. يرجى إعادة التحميل والمحاولة مرة أخرى.",
    "correlation_id": "uuid",
    "details": {
      "expected_state_version": 12,
      "current_state_version": 13
    }
  }
}
```

HTTP mapping: 400 validation, 401 auth, 403 permission, 404 not found, 409 conflict, 422 policy block, 429 rate limit, 500 internal.

## 14. Pagination/filtering

Use cursor pagination for queues. Filters include branch, operational state, stage, fulfilment, exception, custody, vendor, ready-by, service, customer, driver, and release status.

## 15. OpenAPI quality

Every endpoint has schemas, examples, security, errors, idempotency, deprecation markers, and client-generation compatibility.

## 16. Acceptance criteria

- OpenAPI validates.
- Target status is never accepted.
- Writes require idempotency and state version.
- Tenant cannot write HQ configuration.
- State responses use explicit dimensions.
- Localized user-facing messages exist.
