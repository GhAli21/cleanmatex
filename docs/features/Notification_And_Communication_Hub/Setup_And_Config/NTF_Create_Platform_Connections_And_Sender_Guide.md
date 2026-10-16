# NTF — Create Platform Connections & Senders (the ultimate guide)

**Last Updated:** 2026-10-16
**Audience:** any HQ operator or engineer who must connect a messaging provider (Twilio WhatsApp / SMS, Resend email, …) to the Notification Hub. No code changes are needed — only HQ console actions and deployment environment variables.
**Verified against source:** `cleanmatexsaas/platform-api/src/modules/notifications-hq/{provider-accounts,provider-templates,dispatch}` and migration `0571_ntf_provider_account_sender_foundation.sql` (2026-10-16).

Related docs: [15 Operator go-live checklist](./15_operator_go_live_checklist.md) · [13 Twilio WABA & template approval](./13_twilio_waba_and_template_approval.md) · [14 Production order-created template](./14_twilio_production_order_created.md) · [Runbook 01 – Connections](../Runbooks/01_connection_verification_rotation.md) · [Runbook 02 – Senders](../Runbooks/02_sender_registration.md) · [Runbook 03 – Template import](../Runbooks/03_template_import_submission_approval.md) · [Runbook 04 – Route activation](../Runbooks/04_tenant_activation.md).

---

## 0. The 60-second version

```
Twilio console           Deployment env (HQ API)         HQ console (Providers → Manage connections)
────────────────         ───────────────────────         ───────────────────────────────────────────
Account SID + token  →   HQ_TWILIO_ACCOUNT_SID           1. Add connection   (provider TWILIO_WHATSAPP,
WhatsApp sender          HQ_TWILIO_AUTH_TOKEN               credential_ref/version == env values)
(status Online)          NTF_TWILIO_CONTENT_CREDENTIAL_  2. Verify live  → account VERIFIED
                          REF / _VERSION                  3. Add sender  (+E.164 number, whatsapp: address)
                         (redeploy HQ API)                4. Verify live on the sender → VERIFIED
```

Then: import a template (Runbook 03) → create a route (Runbook 04).

---

## 1. Concepts you must know

| Term | Meaning | Table |
|---|---|---|
| **Connection** (a.k.a. provider **account**) | One provider identity, e.g. "our Twilio account for WhatsApp in PRODUCTION". Holds **no secret** — only a *reference* to a deployment-injected secret. | `sys_ntf_prov_acct_mst` |
| **Sender** | A concrete "from" identity that belongs to one connection: a WhatsApp number, an SMS number / Messaging Service, an email address/domain. A connection can own many senders. | `sys_ntf_prov_send_mst` |
| **Platform** vs **tenant-private (BYO)** | *Platform* = HQ-owned, shared by tenants (this guide). *Tenant-private* = a tenant's own provider account with an encrypted credential stored by HQ (Runbook 01 Part B / the tenant row action "Private connections"). | `sys_ntf_*` vs `org_ntf_*` |
| **Verification state** | `PENDING` (default) → `VERIFIED` (only on positive live evidence from the provider). Also `SUSPENDED` (was verified, provider no longer reports it usable) and `REVOKED` (final). Operators can never type a state; it changes only through **Verify live**. | both tables |
| **Credential vault reference** (`credential_ref`) + **version** | Opaque labels that must exactly match deployment settings. They are *not* the secret. | account row |
| **Route** | Binds event + channel + language → one VERIFIED account + one sender + one approved template revision. A route can only be activated with verified provider evidence (Runbook 04). | later step |

**Golden rules**
1. Secrets (`AC…` SID's auth token, API keys) live **only** in deployment environment variables (or the HQ config registry) — never in the form, never in the database, never in chat.
2. Verification is **fail-closed**: nothing becomes `VERIFIED` without the provider confirming it.
3. Order is always: **env vars → connection → verify connection → sender → verify sender**. A sender cannot be verified before its connection is `VERIFIED`.
4. Identity fields are immutable after creation (see §9). Get them right the first time, or retire the row and create a new one.

---

## 2. Prerequisites

### 2.1 Permissions
- HQ operator with `hq_notifications:manage` (create / update / verify). `hq_notifications:read` only lists.

### 2.2 Provider-side (outside CleanMateX)
For **Twilio WhatsApp**:
- Twilio **Account SID** (`AC` + 32 hex) and **Auth Token** (Twilio Console → Account → API keys & tokens). Use the production account, not a trial/sandbox account, for PRODUCTION.
- A registered **WhatsApp sender** with status **Online** (Twilio Console → Messaging → Senders → WhatsApp senders). Write down its E.164 number (e.g. `+9689XXXXXXX`).
  - The Twilio WhatsApp **sandbox** number (`+14155238886`) is *not* in the Senders API and will correctly never verify.
- (Later, for templates) an approved WhatsApp Content template (`HX…`). See docs 13 and 14.

For **Twilio SMS**: an SMS-capable incoming phone number on that account, or a Messaging Service (`MG…`) with at least one sender attached.

For **Resend email**: a verified sending domain in Resend and an API key.

### 2.3 Catalog codes you may use (must exist in the catalog — FK enforced)

| Provider code (`sys_ntf_providers_cd`) | Typical channel | Live account verify | Live sender verify |
|---|---|---|---|
| `TWILIO_WHATSAPP` | `WHATSAPP` | ✅ | ✅ (Senders API, must be ONLINE) |
| `TWILIO_SMS` | `SMS` | ✅ | ✅ (number or Messaging Service) |
| `META_WHATSAPP` | `WHATSAPP` | ❌ | ❌ |
| `RESEND` | `EMAIL` | ❌ (see §11) | ✅ domain check — but only after the account is VERIFIED |
| `SENDGRID` | `EMAIL` | ❌ | ❌ |
| `FCM`, `ONESIGNAL`, `VAPID` | `PUSH` | ❌ | ❌ |
| `SUPABASE_REALTIME`, `INTERNAL` | `WEB_SOCKET` / `IN_APP` | ❌ | ❌ |

Channel codes: `EMAIL`, `IN_APP`, `PUSH`, `SMS`, `WEB_SOCKET`, `WHATSAPP`.

> ⚠️ The plain code `TWILIO` is **not** in the catalog and fails the foreign key (`fk_ntf_pacct_provider`). Use `TWILIO_WHATSAPP` or `TWILIO_SMS`. (Legacy `TWILIO` is still recognised in code and in the dispatch ledger, but cannot be created from the UI.)

---

## 3. Step 1 — Set the deployment secrets (HQ API) and redeploy

Set on **platform-api** (HQ), e.g. Render → Environment:

| Variable | Required | Value |
|---|---|---|
| `HQ_TWILIO_ACCOUNT_SID` | ✅ | The Twilio Account SID (`AC…`). **Must equal the connection's "Provider account ID".** |
| `HQ_TWILIO_AUTH_TOKEN` | ✅ | The auth token of that same account. |
| `NTF_TWILIO_CONTENT_CREDENTIAL_REF` | ✅ | Any stable label you choose, e.g. `cleanmatex_comm`. **Must equal the connection's "Credential vault reference" exactly (case-sensitive).** |
| `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION` | optional | e.g. `v1`. If set, it **must equal** the connection's "Credential version". If unset, the version is not compared (the form still requires one). |
| `HQ_TWILIO_WHATSAPP_FROM` | optional | Fallback WhatsApp "from" (`whatsapp:+…`) used only when a route's sender has no address. |
| `HQ_TWILIO_SMS_FROM` | optional | SMS "from" for the generic SMS path. |
| `HQ_TWILIO_WEBHOOK_URL` | optional | Public URL of HQ `/notifications/webhooks/twilio` (delivery status / STOP replies). |
| `HQ_RESEND_API_KEY` | only for Resend | Platform Resend key (also used for Resend sender verification). |

Notes
- These values may alternatively be managed through the HQ **config registry** (keys `ntf.hq.twilio.account_sid`, `.auth_token`, `.content_cred_ref`, `.content_cred_ver`, `ntf.hq.resend.api_key`); the env var is the fallback. Either way the secret never enters the connection form.
- **Redeploy / restart HQ API after changing any of them.** Verify uses the process environment at call time.
- The HQ deployment holds **one** Twilio credential pair. Several connection rows may share it (e.g. one `TWILIO_WHATSAPP` row and one `TWILIO_SMS` row for the same SID) because uniqueness is per provider+channel+environment — give each row the same `credential_ref`.

---

## 4. Step 2 — Create the connection (HQ console)

**Path:** HQ console → **Notifications → Providers** (`/en/notifications/providers`) → **Manage connections** → *Platform Connections* dialog → **Add connection**.

### 4.1 Field reference

| UI label | API field | Required | What to enter | Notes / validation |
|---|---|---|---|---|
| Provider | `provider_code` | ✅ | `TWILIO_WHATSAPP` | Catalog code. Immutable after save. |
| Channel | `channel_code` | ✅ | `WHATSAPP` | Catalog code. Immutable. Senders must use the same channel. |
| Environment | `environment_code` | ✅ | `PRODUCTION` (or `TEST`) | TEST and PRODUCTION identities are never interchangeable. Immutable. |
| Account key | `account_key` | ✅ | `twilio-whatsapp-prod` | Your stable label. Unique per provider+channel+environment. Immutable. |
| Provider account ID | `external_account_id` | ✅ | Twilio Account SID `AC…` | Unique per provider+channel+environment. Immutable. Verify compares it with what Twilio returns. |
| Name | `name` | ✅ | `Twilio WhatsApp Production` | Display name (EN). |
| Name (Arabic) | `name2` | – | e.g. `تويليو واتساب (إنتاج)` | |
| Description / (Arabic) | `description`, `description2` | – | Free text, non-secret. | |
| Credential vault reference | `credential_ref` | ✅ | = `NTF_TWILIO_CONTENT_CREDENTIAL_REF` (e.g. `cleanmatex_comm`) | Opaque label. **Never paste the secret.** |
| Credential version | `credential_version` | ✅ | = `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION` (e.g. `v1`) | Required by the form even if the env version is unset. Bump it when you rotate (§9.3). |
| Config | `config` | – | `{}` | Non-secret JSON object only. |

Click **Save**. The connection appears in the *Accounts* list with verification **PENDING**.

### 4.2 Worked example (production WhatsApp)

```
Provider:                   TWILIO_WHATSAPP
Channel:                    WHATSAPP
Environment:                PRODUCTION
Account key:                twilio-whatsapp-prod
Provider account ID:        AC692a0a…            (full 34-char SID)
Name:                       Twilio WhatsApp Production
Credential vault reference: cleanmatex_comm      (== NTF_TWILIO_CONTENT_CREDENTIAL_REF)
Credential version:         v1                   (== NTF_TWILIO_CONTENT_CREDENTIAL_VERSION)
```

---

## 5. Step 3 — Verify the connection

1. In the *Accounts* list select the connection → *Connection details* opens.
2. Click **Verify live** (enabled only for Twilio-family providers).
3. HQ reads the env secrets, checks `credential_ref`/`credential_version` against the env, then calls Twilio `GET /Accounts/{SID}` and requires: the returned SID equals the connection's Provider account ID **and** Twilio status is `active`.
4. Result: **Verification = VERIFIED** with a *Verified at* timestamp, and an audit event `notification_connection.verify_platform`. On failure nothing changes — see §10.

---

## 6. Step 4 — Add a sender under the connection

**Path:** *Platform Connections* dialog → select the connection → scroll to **Senders** → **Add sender**.

### 6.1 Field reference

| UI label | API field | Required | What it is | Rules |
|---|---|---|---|---|
| Sender key | `sender_key` | ✅ | Your stable label, e.g. `whatsapp-main`. | Unique **within the connection**. Immutable. |
| Sender kind | `sender_kind` | ✅ | Category, picked from the lookup `sys_ntf_sender_kind_cd` for the connection's provider (migration 0634). | TWILIO_WHATSAPP / META_WHATSAPP: `WHATSAPP_NUMBER`; TWILIO_SMS: `PHONE_NUMBER`, `MESSAGING_SERVICE`; RESEND: `EMAIL_ADDRESS`. The API rejects other values once the lookup has rows for the provider; before 0634 is applied it is free text. Not branched on in send code. Immutable. |
| Provider sender ID | `external_sender_id` | ✅ | The provider's identity for the sender. | Unique **within the connection**. Immutable. See §6.2. |
| Sender address | `sender_address` | optional in the form, **required in practice** | The human-readable "From" actually used at send time. | WhatsApp: `whatsapp:+E164`. Editable later. |
| Name / Name (Arabic) | `name`, `name2` | name ✅ | Display names. | |
| Capabilities | `capabilities` | – | Optional JSON object, e.g. `{"message_types":["template","session"]}`. For `WHATSAPP_NUMBER` the form shows Message types checkboxes (template, session); other keys go in the advanced JSON field. | Must be a JSON object; `{}` or empty is fine. Values of `message_types` must come from the kind's `allowed_capabilities`. |

The sender's channel is taken from the connection; it must match the connection's channel (`Sender channel must match the owning account channel`).

### 6.2 What to put per provider

**Twilio WhatsApp** (connection channel `WHATSAPP`)

| Field | Value |
|---|---|
| Sender key | `whatsapp-main` |
| Sender kind | `WHATSAPP_NUMBER` |
| Provider sender ID | `+9689XXXXXXX` — E.164: `+`, country code, digits, **no spaces/dashes** |
| Sender address | `whatsapp:+9689XXXXXXX` — same number with the `whatsapp:` prefix |
| Name | `CleanMateX WhatsApp` |

Why the address matters: route dispatch takes the Twilio "From" from **Sender address**; if empty it falls back to `HQ_TWILIO_WHATSAPP_FROM`, and if that is also missing the send is skipped.
Verification extracts the E.164 number from the address (or the sender ID; a leading `whatsapp:` is tolerated) and looks it up in Twilio's WhatsApp Senders API.

**Twilio SMS** (connection channel `SMS`)

| Option | Provider sender ID | Sender address | Sender kind |
|---|---|---|---|
| Phone number | `+9689XXXXXXX` | `+9689XXXXXXX` | `PHONE_NUMBER` |
| Messaging Service | `MG` + 32 hex chars | optional | `MESSAGING_SERVICE` |

**Resend email** (connection channel `EMAIL`): sender ID and address = the From address (e.g. `no-reply@mail.example.com`), kind `EMAIL_ADDRESS`. Verification checks that the address's domain (or its parent) is `verified` in Resend.

Click **Save**. The sender appears with verification **PENDING**.

---

## 7. Step 5 — Verify the sender

1. Make sure the connection is **VERIFIED** (otherwise: `Verify the owning account before verifying its senders`; the button reads "Verify the account first").
2. In the **Senders** list click **Verify live** on the sender row.
3. Outcomes:

| Provider | VERIFIED when | Typical non-verified statuses |
|---|---|---|
| Twilio WhatsApp | Senders API lists `whatsapp:<number>` with status **ONLINE** | `NOT_FOUND` (number not in this Twilio account / wrong format), `OFFLINE`, `PENDING…`/other status ≠ ONLINE |
| Twilio SMS number | Number is an incoming number of the account and SMS-capable | `NOT_FOUND`, `SMS_NOT_CAPABLE` |
| Twilio Messaging Service | Service exists and has ≥ 1 sender | `NOT_FOUND`, `EMPTY_SENDER_POOL` |
| Resend | Domain status `verified` | `NOT_FOUND`, `INVALID_ADDRESS`, other status |

- Success → **VERIFIED** + audit `notification_sender.verify`.
- A previously VERIFIED sender that is no longer usable becomes **SUSPENDED** (+ audit `notification_sender.suspend_on_verify`). Fix at the provider and click Verify live again.
- A non-verified result returns HTTP 409 with the provider status; nothing else changes.
- `REVOKED` senders cannot be re-verified.

---

## 8. After the sender is verified — what next

1. **Import the template** — see §8.1 below, then map `{{1}}…` slots to logical variables in **Bindings** (Runbook 03 / doc 14).
2. **Create and activate the route** (HQ → Notifications → Tenant Configuration → tenant → **Routes**): event + channel + language → account + sender + revision. Save is DRAFT; **Activate** makes it live for that tenant/language only; **Suspend** undoes it instantly (Runbook 04).
3. Confirm with a test order and `hq_ntf_dispatch_log` (doc 15, Step 5).

### 8.1 Import a Twilio template (HQ → Notifications → Providers → *Import Twilio template*)

| Dialog field | What to choose / enter |
|---|---|
| Verified account | Your VERIFIED connection (only verified Twilio WhatsApp accounts are listed). |
| **HQ template** | The approved HQ notification template this Twilio template implements (e.g. *Order Created* · `order.created.default`). Every active template with an APPROVED version is listed. |
| **Logical locale** | `EN · English` or `AR · Arabic` — the language of the Twilio template. |
| Sender restriction | Leave unrestricted unless the approval is specific to one sender; otherwise pick your VERIFIED sender. |
| Twilio Content SID | `HX…` from Twilio Console → Content Template Builder (e.g. `HX9db4d9523a6a72c2f1dcf4de53038405`, `order_created_v4`). |

Click **Fetch and import**: HQ fetches the template and its WhatsApp approval from Twilio server-side. **No seeding is needed**: if the template's WhatsApp locale for that language does not exist yet, HQ creates it on the spot (after Twilio accepted the SID), together with the template version's variables (one per `{{placeholder}}` of the HQ template body, in order of appearance). Existing locales/variables are reused, never modified; a retired locale is refused. The creation is audited as `notification_template_locale.auto_create`.

Then open the new revision → **Bindings** and map every ordered Twilio slot to a variable of that template version (e.g. `order_number`, `estimated_ready_at`).

Rules of thumb
- The language you pick must equal the language of the route you will create later (route activation rejects a mismatch).
- The HQ template version must be `APPROVED`, and its `event_code` must equal the route's event.
- API equivalent: `POST /notifications/provider-template-registrations/import/twilio` with `account_id`, `content_sid`, and either `locale_id` (existing locale) or `template_code` + `language_code` (auto-resolve).

---

## 9. Editing, rotating and retiring

### 9.1 What can be changed

| Object | Editable | Immutable (create a new row instead) |
|---|---|---|
| Connection | `name`, `name2`, `description(2)`, `credential_ref`, `credential_version`, `config`, `is_active` | provider, channel, environment, `account_key`, `external_account_id` |
| Sender | `name`, `name2`, `sender_address`, `capabilities`, `is_active` | channel, `sender_key`, `external_sender_id`, `sender_kind` |

Made a typo in an immutable field? Set the wrong row `is_active = false` (retire — never delete, history and audit stay) and create a correct one.

### 9.2 Retire
Deactivate (`is_active=false`) instead of deleting; routes and audit history may still reference the row.

### 9.3 Rotate the Twilio secret (platform connection)
There is no rotate endpoint for platform secrets — they are deployment values.
1. Update `HQ_TWILIO_AUTH_TOKEN` (and, if you want a new audit trail, `NTF_TWILIO_CONTENT_CREDENTIAL_VERSION`, e.g. `v2`) in the HQ deployment; redeploy.
2. Edit the connection: set **Credential version** to the same new value.
3. Click **Verify live** again and confirm VERIFIED.
Never change the env ref/version without editing the connection (and vice-versa) — they must always match.

---

## 10. Troubleshooting (exact messages)

| You see | Cause | Fix |
|---|---|---|
| *"A platform account needs a credential vault reference and version."* (on Save) | Credential vault reference and/or version left empty. | Fill both (e.g. `cleanmatex_comm` / `v1`). |
| DB error `violates foreign key constraint "fk_ntf_pacct_provider"` | Provider code is not in `sys_ntf_providers_cd` (e.g. `TWILIO`). | Use `TWILIO_WHATSAPP` / `TWILIO_SMS` etc. |
| `fk_ntf_pacct_channel` | Channel code not in the channel catalog. | Use `WHATSAPP`, `SMS`, `EMAIL`, … |
| `duplicate key … uq_ntf_pacct_key` / `uq_ntf_pacct_ext` | Same account key, or same provider account ID, already exists for this provider+channel+environment. | Open the existing row instead, or use a different key/environment. |
| **Verify live** is disabled; text "Live verification is available only for Twilio accounts…" | Provider is not `TWILIO_WHATSAPP` / `TWILIO_SMS` / `TWILIO`, **or** the HQ web deployment predates the Twilio-family fix. | Check the provider; redeploy HQ web + API. |
| 409 *"The platform account has no approved Twilio Content credential binding"* | `NTF_TWILIO_CONTENT_CREDENTIAL_REF` unset, or ≠ the connection's credential vault reference (case-sensitive, no stray spaces). | Make them identical; redeploy; retry. |
| 409 *"The platform account credential version is not approved for Content imports"* | Env `…_VERSION` is set and ≠ connection's Credential version. | Align them (or unset the env version). |
| 503 *"Twilio Content credentials are not available to the HQ importer"* | `HQ_TWILIO_ACCOUNT_SID` or `HQ_TWILIO_AUTH_TOKEN` missing in the HQ API environment. | Set both; redeploy. |
| 503 *"Twilio Content credentials are rejected by the config registry"* | Registry value has a source mismatch / is undecryptable. | Fix the registry entry or use the env var. |
| 409 *"Twilio account credentials could not be verified"* | Wrong auth token, SID not matching the token's account, or Twilio rejected the request. | Re-check SID/token pair in the Twilio console; ensure the Provider account ID == `HQ_TWILIO_ACCOUNT_SID`. |
| 409 *"Twilio returned an account response that does not match the requested identity"* | Provider account ID differs from the SID Twilio returned. | Correct env or recreate the connection with the right SID. |
| 409 *"Twilio account status is 'suspended', not active"* | Twilio account is suspended/closed. | Resolve in Twilio first. |
| 503 *"Twilio … is temporarily unavailable"* | Transient provider outage/timeout. | Retry in a minute (see Runbook 09 for a sustained outage). |
| *"Sender channel must match the owning account channel"* | Sender created under a connection of another channel. | Add the sender under the correct connection. |
| Duplicate key on `uq_ntf_psend_key` / `uq_ntf_psend_ext` | Sender key or provider sender ID already exists under this connection. | Use another key or open the existing sender. |
| *"Capabilities must be a JSON object."* / *"Config must be a JSON object."* | Invalid JSON in those fields. | Use `{}` or a valid object; no arrays/strings. |
| *"Verify the owning account before verifying its senders"* | Connection is not VERIFIED. | Complete §5 first. |
| *"The WhatsApp sender has no E.164 number to verify"* | Sender ID/address not a valid `+` number. | Edit the address to `whatsapp:+<digits>`; if the Provider sender ID itself is wrong, retire and recreate the sender. |
| Sender result `NOT_FOUND` | Number is not a registered WhatsApp sender of **this** Twilio account (or sandbox number). | Compare with Twilio Console → Senders; use the production number. |
| Sender result `OFFLINE` / not ONLINE | Registration with WhatsApp (Meta) isn't complete or was disabled. | Finish/repair in Twilio; click Verify live again. |
| *"A revoked sender cannot be re-verified"* | Sender state is REVOKED (final). | Create a new sender. |
| *"Live sender verification is not supported for provider …"* | Provider has no live connector (Meta, SendGrid, push, …). | Confirm out-of-band; see §11. |

---

## 11. Known limits (be aware, don't invent workarounds)

- Live **account** verification exists only for the Twilio family. Accounts of other providers stay `PENDING` through this UI.
- Live **sender** verification exists for Twilio (SMS + WhatsApp) and Resend (email domain). Because a sender can only be verified after its connection is `VERIFIED`, a Resend platform connection (no live account verify) cannot currently reach a verifiable state through the UI — confirm email domains in the Resend dashboard.
- There is no scheduled re-verification or expiry alerting; re-verify manually after provider-side changes (HQ → Operations / Setup Health shows readiness).
- Route-based dispatch in this release serves **WhatsApp** through Twilio; SMS connections are for verification/inventory and the generic SMS path (`HQ_TWILIO_SMS_FROM`).
- The dispatch ledger and webhook-event tables intentionally use the logical family code `TWILIO` (no catalog FK there); the webhook matcher accepts both `TWILIO` and `TWILIO_WHATSAPP`.

---

## 12. Quick checklist (copy into your ticket)

- [ ] Twilio Account SID + Auth Token in hand; WhatsApp sender is **Online** (number noted)
- [ ] HQ API env: `HQ_TWILIO_ACCOUNT_SID`, `HQ_TWILIO_AUTH_TOKEN`, `NTF_TWILIO_CONTENT_CREDENTIAL_REF` (+ `_VERSION`) set; HQ API redeployed
- [ ] Connection created: `TWILIO_WHATSAPP` / `WHATSAPP` / `PRODUCTION`, key, SID, name, ref == env ref, version == env version
- [ ] **Verify live** → connection **VERIFIED**
- [ ] Sender created: key, kind, `+E164` sender ID, `whatsapp:+E164` address, name
- [ ] **Verify live** on sender → **VERIFIED**
- [ ] Template imported + bindings mapped (doc 14 / Runbook 03)
- [ ] Route created and activated for the pilot tenant (Runbook 04); test order → `SENT` in `hq_ntf_dispatch_log`
- [ ] Evidence (screenshots / SIDs) recorded in `STATUS.md`

---

## 13. Appendix

### 13.1 Verify state in SQL (read-only)

```sql
SELECT id, provider_code, channel_code, environment_code, account_key,
       external_account_id, credential_ref, credential_version,
       verification_state, verified_at, is_active
FROM sys_ntf_prov_acct_mst ORDER BY created_at DESC;

SELECT s.id, a.account_key, s.channel_code, s.sender_key, s.external_sender_id,
       s.sender_address, s.sender_kind, s.verification_state, s.verified_at, s.is_active
FROM sys_ntf_prov_send_mst s JOIN sys_ntf_prov_acct_mst a ON a.id = s.account_id
ORDER BY s.created_at DESC;

SELECT code, is_active FROM sys_ntf_providers_cd ORDER BY code;   -- valid provider codes
```

### 13.2 API equivalents (JWT with `hq_notifications:manage`)

| Action | Call |
|---|---|
| List / create connection | `GET` / `POST /notifications/connections` |
| Update connection | `PATCH /notifications/connections/:id` |
| Verify connection | `POST /notifications/connections/:id/verify` |
| List / create sender | `GET /notifications/senders?accountId=` / `POST /notifications/senders` |
| Update sender | `PATCH /notifications/senders/:id` |
| Verify sender | `POST /notifications/senders/:id/verify` |

Create-connection body:
```json
{
  "provider_code": "TWILIO_WHATSAPP", "channel_code": "WHATSAPP", "environment_code": "PRODUCTION",
  "account_key": "twilio-whatsapp-prod", "external_account_id": "AC…",
  "name": "Twilio WhatsApp Production",
  "credential_ref": "cleanmatex_comm", "credential_version": "v1", "config": {}
}
```
Create-sender body:
```json
{
  "account_id": "<connection uuid>", "channel_code": "WHATSAPP", "sender_key": "whatsapp-main",
  "external_sender_id": "+9689XXXXXXX", "sender_address": "whatsapp:+9689XXXXXXX",
  "sender_kind": "WHATSAPP_NUMBER", "name": "CleanMateX WhatsApp", "capabilities": {}
}
```

### 13.3 Audit events written
`notification_connection.create_platform`, `.update_platform`, `.verify_platform` · `notification_sender.create_platform`, `.update_platform`, `.verify`, `.suspend_on_verify`. Credentials are never included in audit metadata.

### 13.4 Adding a new provider code (engineering note)
New providers (e.g. a second SMS aggregator) first need a row in `sys_ntf_providers_cd` (a migration in the tenant repo — HQ never creates migrations) and, for live verification, a connector plus an entry in the Twilio-style helper (`platform-api/.../notifications-hq/twilio-provider.ts` is the pattern for a provider family; the UI mirror lives in `platform-web/src/features/notifications-hq/model/twilio-provider.ts`). Until then the account stays `PENDING` by design.
