# Guide: Adding a Second Provider to the Notification Hub

**Status:** ready to use. No second provider is built yet (decision R13, kept open by the owner on 2026-10-15).
**Audience:** the platform owner (what to decide, what to collect, what to click) and the engineer or Claude session that writes the connector.
**Last verified against source:** 2026-10-15.

---

## 1. Why add a second provider, and when you can skip it

| Reason | What a second provider gives you |
|---|---|
| Outage cover | When the main provider is down or the circuit breaker opens, messages go to the backup instead of waiting. |
| Delivery quality in your region | A local SMS aggregator often delivers better in Oman, UAE and Saudi Arabia than a global provider, and handles sender-ID rules. |
| Cost | You can route one channel to the cheaper provider. |
| Negotiating power | You are not locked to one vendor. |

You can skip it for now. Without it everything works; the only cost is that **automatic failover has no real target** (it can only fail over to the sandbox connectors, which send nothing). Pause, drain, the circuit breaker, health and reconciliation all work with one provider per channel.

Today's providers: **EMAIL = RESEND**, **SMS = TWILIO_SMS**, **WHATSAPP = TWILIO_WHATSAPP**, **PUSH = VAPID/FCM**, **IN_APP = SUPABASE_REALTIME**. The connector port serves EMAIL, SMS and WHATSAPP. Push and in-app do not need a second provider.

## 2. How a second provider works in the system (short)

- A **connector** is one class that knows how to send one message through one provider on one channel. It implements the `ProviderConnector` port (`platform-api/src/modules/notifications-hq/dispatch/connectors/provider-connector.ts`).
- The **registry** (`ConnectorRegistry`) maps (provider code, channel) to a connector. The dispatcher asks the registry; a provider with no connector keeps using its old dedicated path (Resend, Twilio and Meta stay exactly as they are).
- A provider is **used** in one of two ways, and you can use both:
  1. **As a failover target.** In HQ → Notifications → **Operations** → Failover rules, add a rule "when RESEND is paused or its circuit is open, use PROVIDER_X". Only a provider that has a registered connector, and is itself active, is accepted as a target.
  2. **As the primary** for a tenant or channel. Set the tenant's channel route (table `org_ntf_channel_provider_cf`, edited from HQ → Notifications → Governance / Routes) to the new provider code. There is no database constraint on provider codes, so no migration is needed for this.
- **Delivery receipts** (delivered, bounced) arrive through the webhook endpoint `POST /notifications/webhooks/:provider` and are verified per provider in `WebhooksService`. A provider without webhook support works, but its messages stay at "SENT" and never move to "DELIVERED".
- **BYO (tenant brings its own provider account)** is not affected. A BYO route never goes through a platform connector.

## 3. What you decide (before involving anyone)

For each channel you want a backup for, fill in one row:

| Channel | Keep single provider? | Backup provider (name) | Used as | Countries that matter | Monthly volume estimate |
|---|---|---|---|---|---|
| EMAIL | | | failover / primary | | |
| SMS | | | failover / primary | | |
| WHATSAPP | | | failover / primary | | |

Guidance for choosing:

- **SMS:** choose a provider with a documented HTTPS API, a delivery-receipt webhook, and support for **alphanumeric sender IDs** in your countries (Oman, UAE and Saudi Arabia require sender-ID registration; ask the provider how long approval takes, it can be weeks, so start early).
- **EMAIL:** Amazon SES or SendGrid are both fine. You must be able to verify your sending domain (SPF, DKIM, DMARC) and you need a verified "from" address.
- **WHATSAPP:** the only real second option is **Meta WhatsApp Cloud API directly** (the current provider uses Twilio). Message templates must be pre-approved by Meta. The existing Meta code path already handles route-based WhatsApp templates; ask before building anything new for WhatsApp.
- Prefer a provider with: a **sandbox or test mode**, **idempotency key support**, a **documented rate limit**, and **webhook signatures**.

## 4. What you collect from the provider (checklist)

Do this in the provider's dashboard. Do **not** paste secrets into chat, tickets or git.

- [ ] An account in the right legal entity, with billing set up.
- [ ] **API credentials** (API key, or account id + auth token, or OAuth client). Create a key scoped only to sending.
- [ ] The **sender identity**: verified domain and from address (email), approved sender ID or number (SMS), phone number id and business account (WhatsApp).
- [ ] The **API base URL** and the **send endpoint** documentation link.
- [ ] The **delivery-receipt webhook** documentation: the URL you must register, and how requests are signed (header name, algorithm, secret).
- [ ] **Rate limits** and the maximum message length.
- [ ] The provider's **error codes**: which mean "try again later" and which mean "will never work" (bad number, bad credentials).
- [ ] A **sandbox/test credential** if one exists (best), or a test phone number or mailbox you control.
- [ ] Price per message (needed for the pricing table, see 7.4).

## 5. What to send to Claude (the prompt)

Copy the block below into a new session, fill the angle brackets, and **attach the provider's API documentation links, not the secrets**. Credentials are entered later by you, in the Configuration Registry (step 7.2).

```text
Add a second notification provider to the CleanMateX Notification Hub.
Read first: docs/features/Notification_And_Communication_Hub/NTF_Guide_To_Add_Second_Provider.md
and docs/features/Notification_And_Communication_Hub/RESUME_CONTINUATION.md.

Provider code (UPPER_SNAKE): <e.g. ACME_SMS>
Channel: <EMAIL | SMS | WHATSAPP>
Used as: <failover target only | primary for some tenants | both>
Docs: <link to the send-message API>, <link to the delivery-webhook docs>, <link to error codes>
Auth style: <API key header | Basic auth account+token | OAuth bearer>
Request format: <JSON | form-encoded>
Required credentials (names only): <apiKey, from, ...>
Sender identity: <how the "from" is chosen>
Max body length: <number or "not documented">
Supports idempotency key: <yes, header X | no>
Delivery receipts via webhook: <yes | no>; signature scheme: <describe or link>
Rate limit: <number per second/minute>
Price per message: <amount and currency>
Sandbox or test mode: <yes/no, how>
Countries that matter: <list>

Do, in order, with no gaps (both repos, EN/AR where UI text is involved):
1. Create the connector as a subclass of HttpProviderConnector, with unit tests.
2. Run it through the connector conformance kit (testing/connector-conformance.ts) and show the result.
3. Register it in the connector registry, reading credentials through the Config Registry (ConfigResolverService), never from code or chat.
4. Write the migration for the new Config Registry keys (secrets encrypted, EN + AR names and guidance), STOP, and wait for me to apply it.
5. If a webhook is needed, add signature verification and the status mapping, with tests.
6. Add the provider to the pricing table seed notes and to the Setup Health provider checks.
7. Update the docs (STATUS.md, plan row A8, runbooks 08 and 09, QA guide) and add QA scenarios for this provider.
8. Report: files changed, test results, what I must do next.
Constraints: follow CLAUDE.md of both repos; never put a secret in code, tests, logs or docs; tenant-safe; one new migration file only, never edit applied migrations.
```

## 6. What Claude does with it (so you can review)

1. **Connector class** under `dispatch/connectors/` extending `HttpProviderConnector`. A typical connector is 40 to 70 lines: it names the credential keys it needs, builds the HTTP request (`buildRequest`), and reads the provider message id from the response (`readMessageId`). The base class already handles missing credentials, timeouts, retries, never throwing, HTTP status classification, and never echoing credentials or the message body. Shape:

   ```ts
   export class AcmeSmsConnector extends HttpProviderConnector {
     readonly providerCode = 'ACME_SMS';
     readonly channel = 'SMS' as const;
     readonly capabilities = { deliveryReceipts: true, templates: false, maxBodyLength: 670, production: true };
     protected readonly requiredCredentialKeys = ['apiKey', 'senderId'] as const;

     constructor(private readonly resolver: ConfigResolverService) { super(); }

     protected async resolveCredentials() {
       // read ntf.hq.acme_sms.api_key and ntf.hq.acme_sms.sender_id from the Config Registry
     }
     protected buildRequest(message, credentials) { /* url, headers, JSON body */ }
     protected readMessageId(response) { /* provider message id */ }
   }
   ```

2. **Conformance kit** (`describeConnectorConformance` in `testing/connector-conformance.ts`): the connector must pass: success, temporary failure, permanent failure, missing credentials, transport throws, and "no secret and no message body in any result". A connector that fails the kit is not registered.
3. **Registration** in `dispatch.module.ts` (`buildConnectorRegistry`). The factory currently receives only `ConfigService`; a real connector needs the Config Registry resolver, so the factory gains that dependency. Sandbox connectors stay unchanged.
4. **Migration** adding the Config Registry keys, for example `ntf.hq.acme_sms.api_key` (secret, encrypted), `ntf.hq.acme_sms.sender_id`, `ntf.hq.acme_sms.webhook_secret`. The migration contains **no values**. It follows `Platform_Operations_Console/config_registry_guide.md` section 6. Claude stops; you apply it and regenerate types.
5. **Webhook** (only if the provider sends receipts): signature check in `WebhooksService`, status mapping to the hub's delivery statuses, tests with a valid and an invalid signature.
6. **Pricing**: the pricing table (`sys_ntf_pricing_cf`) is keyed by channel + provider code + currency + effective date. You add the cost row for the new provider from HQ → Notifications → Pricing, using exactly the same provider code string as the connector, so margin reports are right.
7. **Setup Health**: the provider checks show the new provider's configuration state.
8. **Docs and QA scenarios** for this provider.

## 7. What you do after Claude finishes

### 7.1 Apply the migration
Apply the new migration to the local and remote databases, then regenerate types (both HQ apps) and Prisma. Tell Claude when done.

### 7.2 Enter the credentials (never in git or chat)
HQ → **Operations → Configuration Registry**, find the new `ntf.hq.<provider>.*` keys, open each, enter the value, save. Secret keys are encrypted and shown only as a fingerprint afterwards. Then use **Check now** on the key to confirm the value is read.

### 7.3 Prove it with the sandbox mode first
If the provider has a test mode, set it up with test credentials first. Send a **test** from HQ → Notifications → Templates → *Preview & test* (the recipient must be on `ntf.hq.test_recipients`). Check the message arrives and that the dispatch log row shows the new provider code.

### 7.4 Add the price
HQ → Notifications → **Pricing** → add a row for the new provider code and channel (cost per send).

### 7.5 Register the webhook (if the provider sends receipts)
In the provider's dashboard set the delivery webhook to `https://<your-hq-api-host>/api/hq/v1/notifications/webhooks/<provider>` and enter the signing secret in the Config Registry key Claude created. Send one real message and confirm its status moves from SENT to DELIVERED.

### 7.6 Turn it on
- **As failover target:** HQ → Notifications → **Operations** → *Failover rules*: from `<main provider>` to `<new provider>`, channel, priority 1. The new provider must show a connector in the table.
- **As primary for a tenant:** change that tenant's channel route to the new provider code.

### 7.7 Rehearse failure once
On a non-production tenant: **Pause** the main provider with reason "failover drill", send a message, confirm it went out through the new provider and the log shows the failover. **Resume**. Runbook 09 (provider outage) describes the same drill.

### 7.8 Roll out gradually
Test tenant, then one real pilot tenant for a week, then everyone. Watch Operations → health table (success rate) and Setup Health → `providers.control` and `usage.reconciliation`.

### 7.9 Rollback
Remove the failover rule, or **Pause** the new provider (Operations screen), or point the route back to the previous provider code. No deployment is needed for any of these.

## 8. Rules the connector must obey (the contract)

- `send()` never throws. Every failure becomes a result.
- `SENT` only when the provider accepted the message.
- `FAILED` (temporary, will be retried): rate limit, 5xx, timeout, network.
- `PERMANENT_FAILURE` (never retried): bad credentials, invalid recipient, not configured.
- Error messages carry only the status class and a machine code, **never credentials, recipient or message body**.
- Pass the command's idempotency key to the provider whenever the provider supports one, so a retry cannot send twice.
- No tenant, order or template concept inside a connector.

## 9. Known limits

- Queued messages are **held**, not re-routed, while a provider is paused. Failover applies to messages dispatched after the rule is active.
- The circuit-breaker probe budget and the admission cache are per API instance.
- WhatsApp templates are managed in the existing provider-template flow; a new WhatsApp provider needs its own template approval mapping, which is part of that provider's task.
- PUSH and IN_APP are outside the connector port.

## 10. Where things live

| What | Where |
|---|---|
| Port and result types | `platform-api/src/modules/notifications-hq/dispatch/connectors/provider-connector.ts` |
| HTTP base class | `.../connectors/http-connector.ts` |
| Registry | `.../connectors/connector-registry.ts` |
| Conformance kit | `.../connectors/testing/connector-conformance.ts` |
| Sandbox examples | `.../connectors/sandbox.connector.ts` |
| Registration | `.../dispatch/dispatch.module.ts` (`buildConnectorRegistry`) |
| Pause, breaker, failover | `.../dispatch/operations/` |
| Registry key rules | `docs/features/Platform_Operations_Console/config_registry_guide.md` section 6 |
| Outage runbook | `docs/features/Notification_And_Communication_Hub/Runbooks/09_provider_outage.md` |
