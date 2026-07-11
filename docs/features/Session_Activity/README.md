# Session Activity

**Status:** Implemented (v1)  
**Scope:** Client-side UX recovery log for ephemeral toast/alert messages

## Purpose

Ops users often miss short-lived toasts (especially EN/AR). Session Activity keeps a **browser-session** history of errors and warnings so they can re-read messages after a toast disappears.

This is **not** an audit trail, not a substitute for Notifications (`org_ntf_inbox_mst`), and not persisted to the database.

## Platform checklist (N/A for v1)

| Area | Status |
|---|---|
| Permissions / RBAC | N/A — available to all authenticated dashboard users |
| Navigation dual-write | N/A — top-bar control only |
| Feature flags | N/A |
| Tenant settings | N/A |
| Plan limits | N/A |
| API routes | N/A |
| DB migrations | N/A |
| ui-access-contract | N/A |

## Capture policy (v1)

| Type | toast/alert | inline/console | Badge |
|---|---|---|---|
| error | Log | Skip | Yes |
| warning | Log | Skip | Yes |
| info / success | Only if `forceSessionLog` | Skip | No |
| loading | Skip | Skip | No |

Also captures terminal **error** from `cmxMessage.promise()` (not loading).

Opt-out: `skipSessionLog: true` on `MessageOptions`.

## Architecture

- Store/recorder: `web-admin/lib/session-activity/`
- UI: `web-admin/src/features/session-activity/`
- Hook point: `cmx-message.showDirect` + toast/alert promise helpers
- Legacy bridge: `@ui/components/cmx-toast` delegates to `cmxMessage`
- Top bar: `SessionActivityTrigger` (ScrollText icon) before NotificationBell

## Toast UX (same release)

- Error duration: sticky (`Infinity`) + global Sonner `closeButton`
- Warning 7s, info 5s, success 4s
- Durations read from `message-config` via `toast-method`

## Security / privacy

- Client-only; cleared on sign-out and tenant switch
- Redacts card-like numbers, Bearer tokens, JWT-shaped strings
- Residual risk: business error text may still contain names/phones — do not send this log to Sentry

## Related

- [Manual QA Checklist](./Manual_QA_Checklist.md)
- [Implementation Status](./IMPLEMENTATION_STATUS.md)
