# 06 — API Contracts

**Status:** P0 correction pass · **Date:** 2026-07-24  
Routes below are **target contracts** for V1.0; align to existing `/api/v1/orders/...` style in P2 implementation. Gaps listed at end must be closed before P0 sign-off.

## 1. Available actions

`GET /api/v1/orders/{orderId}/available-actions?screen={screenKey}`

```json
{
  "stateVersion": 12,
  "actions": [
    {
      "actionCode": "COMPLETE_PREPARATION",
      "label": "Complete preparation",
      "label2": "إكمال التحضير",
      "enabled": false,
      "blockedReasons": [
        { "code": "GATE_PREP_INCOMPLETE", "message": "…", "message2": "…" }
      ]
    }
  ]
}
```

## 2. Execute action

`POST /api/v1/orders/{orderId}/actions`

Headers: `Idempotency-Key` (required)

```json
{
  "screen": "driver_delivery",
  "actionCode": "CONFIRM_DELIVERY",
  "expectedStateVersion": 12,
  "input": {
    "pod": { "photoIds": [], "signatureId": null, "notes": null },
    "releaseId": null
  }
}
```

```json
{
  "orderId": "…",
  "currentStatus": "delivered",
  "stateVersion": 13,
  "effects": ["history", "outbox"]
}
```

**Errors:** `409 VERSION_CONFLICT`, `409 IDEMPOTENCY_CONFLICT`, `422 GATE_FAILED` (+ reasons), `403 FORBIDDEN`, `404 NOT_FOUND`.

## 3. Worklist

Existing orders list filtered by screen membership (`current_status IN …`).

## 4. Create

Existing create; must call `InitialStatusResolver`; persist source/type/snapshot/`state_version=1`. No retail→`closed` shortcut.

## 5. Release (V1.0)

| Method | Path (target) | Purpose |
|--------|---------------|---------|
| POST | `/api/v1/orders/{id}/releases` | Create partial/full release intent |
| GET | `/api/v1/orders/{id}/releases` | List releases |
| POST | `/api/v1/orders/{id}/actions` + `RELEASE_*` | Advance after Fin OK |

Release body (target): lines (item/piece ids), channel (`pickup`|`delivery`), amounts TBD with Fin.

## 6. HQ profile APIs (V1.0 — may be saas + tenant consume)

| Capability | Notes |
|------------|--------|
| Publish profile version | HQ |
| Assign profile to tenant/service/branch | HQ |
| List approved profiles for tenant | Tenant read |
| Get effective profile | Tenant read |

Exact HQ OpenAPI: document in cleanmatexsaas integration contract; tenant app consumes via HQ API (no direct `sys_feature_flags_*` / stng tables).

## 7. Public confirm-intake

Maps to `CONFIRM_PHYSICAL_INTAKE`; auth + rate limit required. Spec detail: Pending fill from existing public routes.

## 8. Mobile / cmx-api

V1.0: use same action APIs; **no second transition surface**. Offline: must send `expectedStateVersion`; 409 → refresh actions.

## 9. P0 sign-off gaps

- [x] state_version contract
- [x] blocker reason shape
- [x] atomic CONFIRM_DELIVERY input
- [x] Existing path inventory (baseline for P2 align) — see below
- [ ] HQ OpenAPI link once saas contract exists (**accepted defer** to HQ integration doc)
- [ ] Release JSON schema finalized with Fin (**accepted defer** to P4 with Fin owners)

### Existing path inventory (remote-facing app today)

| Path | Today | V1.0 target |
|------|-------|-------------|
| `POST /api/v1/orders/[id]/transition` | Legacy + Enhanced fork | `POST …/actions` (`executeAction`) |
| `GET /api/v1/workflows/screens/[screen]/contract` | Screen contract | Membership + available-actions |
| `POST /api/v1/preparation/[id]/complete` | Writes toward `sorting` | `COMPLETE_PREPARATION` |
| `POST /api/v1/orders/[id]/batch-update` | May auto-ready | Engine action only |
| `GET /api/dashboard/workflow-stats` | Legacy-shaped | Membership aggregates |
| Public/staff confirm-intake routes | Legacy | `CONFIRM_PHYSICAL_INTAKE` |

Exact OpenAPI path freeze happens in P2 when routes are implemented; inventory above is sufficient for P0 design sign-off.

## 10. Related

- [05_Business_Rules_and_Gates.md](05_Business_Rules_and_Gates.md)
