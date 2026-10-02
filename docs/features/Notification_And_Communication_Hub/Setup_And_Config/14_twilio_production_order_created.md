# Twilio production order-created notifications

Last updated: 2026-10-02. Scope: the tenant application's direct Twilio provider.

The operator supplied an approved English Utility template, `order_created_v4`, Content SID
`HX9db4d9523a6a72c2f1dcf4de53038405`, and reported a successful direct Twilio test.
This does not establish that any tenant's production configuration has been changed.

## Implementation and configuration boundary

The adapter now selects a Content SID by the exact notification event code. A configured
`content_templates` catalog overrides legacy sandbox template/destination settings. An
unmapped event, malformed catalog, invalid SID, or missing mapped variable fails before
calling Twilio. No other event is sent with the order-created template.

Existing providers without `content_templates` retain their existing delivery behavior.
Production mode sends through the direct tenant adapter. The current HQ proxy accepts a
body-only WhatsApp payload; an enabled HQ dispatch flag blocks this template path with
an actionable error rather than sending free text.

The SID is account-specific configuration, not a platform-wide default. Configure only
the tenant and Twilio account that own the approved template. This release does not add
an Arabic template or locale-based SID routing. Obtain and wire the approved Arabic
template before claiming Arabic WhatsApp delivery support; existing EN/AR render fields
are preserved.

## 1. Server prerequisites

Keep these values in the server's secret/environment configuration:

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Account owning the approved template and registered sender |
| `TWILIO_AUTH_TOKEN` | Server-only Twilio authentication secret |
| `TWILIO_WHATSAPP_FROM` | Tested registered live sender, `whatsapp:+<country-code><number>` |
| `NTF_DISPATCH_VIA_HQ` | Set explicitly to `false` for this direct integration |
| `NOTIFICATIONS_OUTBOX_SECRET` | Existing internal outbox dispatcher authentication |

Restart/redeploy after environment changes. The sender's effective precedence is
nonempty environment value, then `sys_ntf_runtime_cf.twilio_whatsapp_from`, then provider
`from_number`. Set a verified live sender instead of inheriting a historical sandbox
sender. Inspect runtime `ntf_dispatch_via_hq` too; an unset environment value falls back
to runtime configuration.

Clear `TWILIO_WHATSAPP_SANDBOX_TO` and runtime `wa_sandbox_to_phone` for go-live. This
production path ignores them, but other legacy paths still use them. Empty environment
values do not suppress a nonempty runtime value.

Do not add credentials to provider JSON, Markdown, or migration files. No migration is
required or applied by this implementation.

## 2. Configure the selected tenant's provider

Sign in to the tenant application as an administrator with `notifications:configure`.
Open `/dashboard/notifications/settings` -> **Channel Settings (Tenant)** ->
**WhatsApp** -> **Approved WhatsApp templates**. This editor is available even while
the channel is disabled, so configuration can be saved before enabling delivery.

1. Leave **Notification event** as `order.created`.
2. Paste `HX9db4d9523a6a72c2f1dcf4de53038405` into **Content SID**.
3. Use the two default mappings: `order_number` -> notification data `order_number`,
   and `estimated_ready_at` -> notification data `estimated_ready_at`. The data source
   fields omit the `$` prefix; the editor adds it when saving. Template variable names
   must match Twilio exactly (named variables here; numbered keys for numbered templates).
4. Click **Save**, or **Save and activate Twilio** if Twilio is inactive. Activation
   switches the current WhatsApp provider; review the displayed provider warning.
5. Reopen the screen and verify the saved event, SID, and mappings. Leave the channel
   disabled until credentials, sender, customer consent, and dispatcher are ready.

Adding another event preserves existing mappings and provider options. Removing an
event leaves production mode enabled; unmapped events fail closed. Neither this
editor nor the customer consent control sends a test message.

For advanced API configuration, the existing authenticated endpoints remain available:
POST/PUT must include `X-CSRF-Token` from `GET /api/auth/csrf-token`. UI requests also
include `X-Tenant-Id` to reject drafts originating in another organization.

1. Read `GET /api/v1/notifications/settings/providers?channel_code=WHATSAPP`.
2. Locate `TWILIO_WHATSAPP`. If absent, create an inactive row with `POST` to that same
   `/providers` path and `channel_code: "WHATSAPP"`, `provider_code: "TWILIO_WHATSAPP"`.
3. Preserve existing intended provider configuration and existing event bindings. Merge
   the fields below into `config`, then `PUT` to the same `/providers` path to configure
   and activate the provider. The PUT replaces `config`; it does not merge JSON for you.
4. Check the successful response and re-read the provider. The current activation API
   deactivates channel providers before activating the target; check the target exists
   before PUT and verify the result if a request fails.

```json
{
  "channel_code": "WHATSAPP",
  "provider_code": "TWILIO_WHATSAPP",
  "config": {
    "use_sandbox_template": false,
    "content_templates": {
      "order.created": {
        "content_sid": "HX9db4d9523a6a72c2f1dcf4de53038405",
        "content_variable_map": {
          "order_number": "$order_number",
          "estimated_ready_at": "$estimated_ready_at"
        }
      }
    }
  }
}
```

Template keys must match the approved Twilio template exactly. `$order_number` and
`$estimated_ready_at` reference outbox event variables; other strings are literal values.
The SDK receives `contentSid` and JSON `contentVariables` with no `body` parameter.
An empty map `{}` is supported for static templates. Add separate event entries with
their own approved SIDs for other notifications; unmapped WhatsApp events fail closed.

## 3. Record actual customer opt-in

For production templates the source order must belong to the tenant and reference an
active tenant customer with a valid phone. The exact opt-in field is
`org_customers_mst.preferences.notifications.whatsapp === true`. Staff account
marketing preferences do not grant customer consent.

After obtaining the customer's consent, open **Customers** -> the customer's detail
screen -> **Preferences** -> **WhatsApp notifications**. Check the consent option and
click **Save**. A valid international phone is required to enable consent. Uncheck and
save to revoke it, including when the phone is missing or invalid. Users without
`customers:update` see a read-only control. The existing service preferences remain
available below this card.

The UI uses the existing authenticated customer API, with CSRF protection and an
expected-tenant guard, to save a **preferences-only** PATCH. Advanced API example:

```text
PATCH /api/v1/customers/<tenant-customer-id>
Content-Type: application/json
X-CSRF-Token: <token from GET /api/auth/csrf-token>
```

```json
{ "preferences": { "notifications": { "whatsapp": true } } }
```

This scoped path merges existing preferences and notification choices, leaves names
unchanged, writes only the authenticated tenant's customer, and records `updated_by`
and `updated_at`. Send the same body with `false` for revocation. Read the customer
back to verify persistence. Do not bulk-enable existing customers or use this field as
proof of historical consent: it is a boolean preference, not a consent evidence ledger,
and older tenant-linking paths may have copied preferences from other customer records.
Reconfirm consent before using such records.

Consent is read before enqueue and again before every delivery/retry. Revocation,
inactive customers, missing order/customer, changed destination, or a disabled channel
produce `SKIPPED`, with a reason, and do not trigger the transport-failure email fallback.
Database lookup errors remain retryable. An initially unresolved destination can be
resolved on retry only after a fresh successful eligibility check.

## 4. Enable and test through CleanMateX

1. Open `/dashboard/notifications/settings` -> **Channel Settings (Tenant)** ->
   **WhatsApp**. Enable the top switch and wait for **Settings saved**; there is no
   separate Save button. Confirm there is no missing-active-provider warning.
2. Verify the deployed catalog includes `order.created` -> `WHATSAPP`. Repository
   migration `0345_ntf_catalog_seed.sql` seeds it, but repository presence does not
   verify the live database.
3. Ensure the existing dispatcher/cron is operating. For a local controlled test the
   existing inline flag may be used; deployment needs its existing dispatcher setup.
4. At `/dashboard/orders/new`, create one order for an explicitly opted-in test
   customer whose phone is yours. Enter a valid ready date.
5. At `/dashboard/notifications/delivery-log`, select `WHATSAPP`, click **Refresh**,
   and find `order.created`. Confirm recipient and inspect **Status**/**Error**.
6. Match the Twilio message in its messaging logs and confirm actual delivery on the
   phone. Application `SENT` records accepted initiation, not handset delivery.

The ready-date variable currently contains a date label without time, and missing or
invalid input can produce `Pending`. This patch preserves that existing producer
behavior; the controlled test must use a real ready date. The campaign **Send Test**
button emits `campaign.test_send` and does not validate this order-created integration.

## 5. Verification and rollback

Targeted suites live under `web-admin/__tests__/notifications/`, plus
`__tests__/services/customers.notification-preferences.test.ts`. They cover event
selection, strict substitutions, legacy compatibility, stale sandbox settings,
tenant filters, consent/revocation, retry failures, and dispatcher skips.

For an operational rollback, first disable the tenant WhatsApp channel. Restore the
previous provider JSON only after reviewing its destination/template behavior; removing
the live catalog can reactivate historical legacy settings. Existing marked production
outbox rows skip if their production provider is removed or changed. Do not replay
`SENT` rows or change old migrations.

## Change inventory

| Surface | Change |
|---|---|
| Provider configuration | `config.content_templates` per-event SID and variable mappings |
| Customer preference | Existing tenant `preferences.notifications.whatsapp` gate and preferences-only PATCH persistence |
| API/permissions | Existing provider API (`notifications:configure`), customer PATCH (`customers:update`), internal dispatcher secret; no new permission |
| Navigation/screens | Existing settings, new-order and delivery-log routes; no navigation change |
| Schema/migrations | None |
| Feature flags/plan limits | None added; existing notification gates preserved |
| i18n/UI | EN/AR template editor and customer consent card; keys `notifications.settings.templates.*` and `customers.whatsappConsent.*`; English provider template only, Arabic approval/routing pending |
| Secrets/env | Existing server variables only; no secret values written |

### Active implementation files (tenant repository)

| Responsibility | Files relative to `web-admin/` |
|---|---|
| Template editor | `src/features/notifications/ui/whatsapp-template-settings.tsx`, `ui/notification-settings-page.tsx` in the same feature |
| Provider client and form contract | `src/features/notifications/api/notification-provider-api.ts`, `hooks/use-notification-providers.ts`, `model/whatsapp-template-settings.ts` in the same feature |
| Consent editor/client | `src/features/customers/ui/customer-whatsapp-consent-card.tsx`, `api/customer-notification-api.ts`, `hooks/use-customer-notification-consent.ts` in the same feature |
| Customer screen integration | `app/dashboard/customers/[id]/page.tsx` |
| Tenant provider API | `app/api/v1/notifications/settings/providers/route.ts` |
| Customer persistence | `app/api/v1/customers/[id]/route.ts`, `lib/services/customers.service.ts` |
| Dispatch and eligibility | `lib/notifications/adapters/whatsapp.ts`, `whatsapp-template-config.ts` in the same adapter directory; `lib/notifications/whatsapp-customer-eligibility.ts` |
| Enqueue and processing | `lib/notifications/adapters/outbox.ts`, `app/api/notifications/process-outbox/route.ts` |
| Access declarations | `src/features/notifications/access/notifications-access.ts`, `src/features/customers/access/customers-access.ts` |
| Localized UI | `messages/en/notifications.json`, `messages/ar/notifications.json`, `messages/en/customers.json`, `messages/ar/customers.json` |
| Isolated UI examples | `src/features/notifications/ui/WhatsAppTemplateEditor.stories.tsx`, `src/features/customers/ui/CustomerWhatsAppConsentEditor.stories.tsx` |

Platform inventories are regenerated from the access declarations by the repository
scripts. They are not hand-maintained sources for this feature.

## HQ and tenant UI responsibilities

Current repository inspection found HQ `/notifications/tenant-config` can already save
the same provider JSON, channel state, dispatch mode, and encrypted BYO credentials.
The tenant direct adapter consumes the shared provider config. HQ's JSON editor is not
the structured editor added to the tenant screen. Its activation path also needs review
for competing active providers and cache invalidation before treating it as equivalent
to the tenant activation API.

HQ `/notifications/templates` manages internal bilingual content/version approvals;
its APPROVED status does not verify Twilio/Meta approval. `/notifications/runtime-config`
manages runtime keys with masked secrets, subject to environment precedence. The HQ
dispatch adapter and worker currently send plain-text Body payloads and do not consume
the event SID/map configuration. Keep direct dispatch for this implementation.

Proposed next scope, pending cross-project approval:

1. Extend HQ `platform-web/src/features/notifications-hq/ui/tenant-config-screen.tsx`
   with structured event, Content SID, and variable fields using the existing persisted
   contract. Preserve unrelated JSON and encrypted credentials.
2. Update its API/model plus HQ governance controller/service/repository to validate
   config, verify platform authorization, safely activate one provider, and invalidate
   cached routing. No migration is needed for these existing config fields.
3. Extend HQ dispatch resolver, direct provider, and worker to honor Content SID/maps
   before enabling HQ sending for these templates. Preserve tenant ownership, current
   customer consent, and queued recipient identity across the handoff.
4. Keep tenant UI responsible for that tenant's channel/event choices, customer consent,
   and delivery logs. A global externally-approved template catalog, Twilio sync, and
   self-service credential onboarding are separate scopes requiring explicit contracts.

No HQ files or live settings were changed in this implementation. HQ authorization
global guards were not audited; do not interpret controller JWT authentication alone
as verified platform-admin authorization.

Related: [setup index](00_INDEX.md), [developer guide](../developer_guide.md),
[test scenarios](../testing_scenarios.md), [historical registration session](13_twilio_waba_and_template_approval.md).

Official references: [Twilio Content template sending](https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder),
[WhatsApp opt-in requirements](https://www.twilio.com/docs/whatsapp/api),
[message delivery status](https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks).
