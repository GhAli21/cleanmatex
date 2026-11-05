# Notification Integration Requests: roadmap (DRAFT for discussion, 2026-11-05)

**Status:** under discussion with the owner. Nothing here is built. Decisions still open are in section 6.

**Goal:** when any feature in any app needs to send a notification, the work follows one managed path: request, approval, implementation, test. It should not be improvised per feature.

## 1. What exists today (checked 2026-11-05)

| Fact | Evidence | Meaning |
|---|---|---|
| Tenant app has one entry point | `web-admin/lib/notifications/event-emitter.ts` `emitNotificationEvent()`, 6 feature callers | Wiring is small; the deciding is the real work |
| 118 events and 117 templates are seeded; only 4 event codes ever reached the outbox | remote: `sys_ntf_events_cd`, `sys_ntf_templates_mst`, `org_ntf_outbox_dtl` | Most requests will wire an existing event, not create one |
| Example: `loyalty.points_added`, `points_redeemed`, `tier_changed` already have a template and channel map | remote | A loyalty request is mainly: where to fire, who receives, which channels |
| HQ features have no equivalent entry point | no module outside `notifications-hq` calls the dispatcher | The first HQ request will have to build one |
| Prior art for a handoff doc | `cleanmatexsaas/docs/features/Notification_And_Communication_Hub/Notification_HANDOFF_from_User_Session_Lifecycle.md` | Free-form handoffs already happen; the form replaces them |
| Empty requests folder exists | `cleanmatexsaas/docs/features/Notification_And_Communication_Hub/Notification_Integration_Requests_HQ/` | Owner's chosen home |

## 2. The owner's idea

1. Template `NTF_Request_Form.md`.
2. A Preparation skill fills one request file with full details and recommendations.
3. One file per request in the requests folder.
4. An Implementation skill: explore, plan, implement, document.
5. A Test skill tests the implemented request.
6. Unique code `NTF-RQST-00000x-[HQ/CMX/CUST-MOB-APP/...]-[feature]-[type]`.

## 3. Additions proposed by Claude

**A. Request types decide the path.** The type is the last part of the code, so the form scales with the work.

| Type | Meaning | Usually needs |
|---|---|---|
| `WIRE` | Event and template exist; fire it from the feature | Code, tests |
| `NEW-EVENT` | Event does not exist | Migration, template EN/AR, then wiring |
| `TEMPLATE` | Change text or add a channel to an existing event | New version; provider approval if WhatsApp |
| `RECIPIENT` | New kind of recipient | Hub resolver change |
| `HUB-CHANGE` | The hub lacks a capability | Hub work first; other requests wait on it |

**B. One request covers one feature family, not one event.** Loyalty points added, redeemed and tier changed is one request.

**C. A register file.** `REGISTER.md` has one row per request: code, source, feature, type, status, link. It gives the next number and an at-a-glance view. The number is a document code, not a database value.

**D. A lifecycle with a real stop.** `DRAFT` > `READY_FOR_REVIEW` > `APPROVED` > `IMPLEMENTING` > `IMPLEMENTED` > `TESTED` > `LIVE`, or `REJECTED` / `PARKED`. Implementation refuses to start without `APPROVED`. Migrations still stop for the owner to apply.

**E. Questions the Preparation skill must answer, because these are what go wrong:**
- **Trigger:** the exact business moment, and after which commit. Never inside the money or order transaction.
- **Recipients:** customer, staff, role, or organization admin, and how each is resolved.
- **Channels per recipient**, and the fallback order.
- **Legal class:** transactional or marketing, and whether consent is required. Seeded values are defaults to check, not facts.
- **Variables:** a typed list with sample values; money with currency; dates in the organization's timezone.
- **Text:** EN and AR, SMS length, tone. WhatsApp needs a provider-approved template, which adds outside lead time.
- **Idempotency key**, so a retry never sends twice.
- **Volume and quiet hours:** bursts, quota and cost impact.
- **Organization control:** can an organization turn it off, and is it plan-limited or behind a feature flag?
- **Deep link** target on web and mobile.
- **Failure rule:** a failed notification must never fail the business action.

**F. Source and destination are different things.** The code names who asks. The form also records where it arrives. A mobile app never emits; a server does. So a `CUST-MOB-APP` request normally means push receipt, deep link and preference screens, and it may need a paired server request.

**G. Thin skills, one source of text.** The form, rules and checklists live once, next to the requests folder. Each repo gets three short skills that point there, so two repos cannot drift. Each repo's `CLAUDE.md` gets one row in the "load first" table.

**H. The Test skill proves it end to end.** Fired after commit; double fire sends one; consent and suppression refuse; failure does not break the business action; EN and AR render with no unresolved placeholder; preview and test send pass; the record is visible in `/notifications/audit` (Sending log, Organization outbox, Send attempts). Results are written back into the request file, plus scenarios for the QA guide.

**I. A guard later, not now.** A check script can fail when code emits an event with no approved request. Add it once the process has proved itself.

## 4. Proposed code format

`NTF-RQST-000001-CMX-LOYALTY-WIRE`

Sources: `HQ`, `CMX`, `CUST-MOB-APP`, `STAFF-MOB-APP`, `CMX-API`. Feature is one uppercase word or hyphenated words. The file name is the code plus `.md`.

## 5. Roadmap

| Phase | Output | Size |
|---|---|---|
| 0. Foundation | Form, register, rules, three skills, `CLAUDE.md` rows in both repos | Docs only |
| 1. Pilot | Run loyalty end to end through all three skills, then fix the form from what it teaches | One real feature |
| 2. HQ entry point | HQ equivalent of `emitNotificationEvent`, delivered as the first `HUB-CHANGE` request, with one HQ feature as proof | Code |
| 3. Coverage map | Which of the 114 never-fired events each feature should fire, ranked by business value; each family becomes a request when wanted | Analysis |
| 4. Guard | Check script from 3.I | Small code |

## 6. Open decisions

1. One requests folder and one register for all sources, or one per repo? (Claude's guess: one, because the number must be unique across repos.)
2. Who approves: the owner for every request, or only for types other than `WIRE`?
3. Is `HQ`/`CMX`/`CUST-MOB-APP`/`STAFF-MOB-APP`/`CMX-API` the right source list?
4. Skill names. Claude's guess: `ntf-integration-prepare`, `ntf-integration-implement`, `ntf-integration-test`.
