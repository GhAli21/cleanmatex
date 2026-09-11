# Twilio WhatsApp — WABA Registration and Template Approval

**Last updated:** 2026-09-12  
**Account checked:** Twilio `cleanmatex_comm` (live API health check)  
**Audience:** Platform operator who needs production WhatsApp (business-initiated) and Meta-approved templates  
**Related:** [09_whatsapp_templates.md](./09_whatsapp_templates.md) (older Meta-direct copy) · [03_env_vars.md](./03_env_vars.md) · HQ Runtime Config (`/notifications/runtime-config`)

---

## How to use this document

Read once top to bottom the first time. After that, jump:

| If you need… | Go to |
|---|---|
| Why templates stay unapproved | [§4](#4-why-templates-are-not-approved) |
| What is healthy vs broken today | [§6](#6-live-account-health-as-of-12-sep-2026) |
| Keep sandbox tests working | [§19](#19-until-the-waba-is-live-keep-sandbox-working) |
| Register a real WhatsApp sender | [§12](#12-step-0--choose-the-production-sender-number) through [§14](#14-step-2--register-the-whatsapp-sender-3060-min) |
| Submit / duplicate templates | [§15](#15-step-3--submit-or-resubmit-templates) |
| Point CleanMateX at the new sender | [§17](#17-step-4--point-cleanmatex-at-the-new-sender) |
| Prove business-initiated send | [§18](#18-step-5--prove-it) |

Do **not** treat the Twilio sandbox number as a production sender. Meta will not approve business-initiated templates on it.

---

## 1. Purpose

CleanMateX sends order WhatsApp through Twilio as the Business Solution Provider (BSP).

Today the app can deliver **sandbox** messages to a number that joined the sandbox (and inside the 24-hour customer window). It **cannot** send true business-initiated WhatsApp to arbitrary customers until:

1. A WhatsApp Business Account (WABA) is registered on Twilio (not sandbox).
2. A WhatsApp **sender** (your own E.164 number) is attached to that WABA.
3. At least one Content template is **Approved** by Meta for that WABA.

This document is the operator playbook for those three items, plus the live findings from the `cleanmatex_comm` account.

---

## 2. Two modes (read this first)

| | Twilio Sandbox | Production WABA |
|---|---|---|
| From number | `whatsapp:+14155238886` (Twilio shared sandbox) | `whatsapp:+YOUR_NUMBER` |
| Who can receive | Only numbers that sent `join <code>` to the sandbox, or a customer who messaged you in the last 24 hours | Any WhatsApp user, using an **Approved** template |
| Template Meta status | Stays `received` or `unsubmitted`. **Business initiated = no** | Moves `pending` → `approved` (or `rejected`) |
| CleanMateX flags | `wa_use_sandbox_template=true`, optional `wa_sandbox_to_phone` | `wa_use_sandbox_template=false`, `wa_sandbox_to_phone` empty, `twilio_whatsapp_from` = new sender |
| Use for | Local / HQ sandbox tests | Real customer order notifications |

You can keep sandbox for local while production uses the WABA. Do not mix the sandbox From number into production runtime config.

---

## 3. Approval status glossary (Twilio Content API)

| Status | Meaning | Can send business-initiated? |
|---|---|---|
| `unsubmitted` | Never sent to WhatsApp | No (session/24h only, type-dependent) |
| `received` | Twilio accepted the submit request. **WhatsApp has not started review** | No |
| `pending` | WhatsApp is reviewing (minutes, up to 48 hours) | No |
| `approved` | WhatsApp approved. Console shows Business initiated = yes | **Yes** |
| `rejected` | WhatsApp rejected. See `rejection_reason` | No |
| `paused` | Negative user feedback (blocks / spam) | No |
| `disabled` | Policy or repeated negative feedback | No |

`received` is **not** a rejection. It means Meta never got a real WABA to review against.

You **cannot** submit the same Content SID twice. Twilio error **92009**. To change or resubmit, **duplicate** the template (new `HX…` SID), then submit the copy.

Official: [WhatsApp approval statuses](https://www.twilio.com/docs/content/content-types-overview) · [Template approvals](https://www.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses)

---

## 4. Why templates are not approved

This is **not** a Meta content rejection. None of the current templates are `rejected`.

Root cause: the only WhatsApp From in use is the **Twilio sandbox**. Sandbox is for in-session testing. It is not a WhatsApp Business Account. Meta will not move templates to `pending` / `approved` on it.

What we observed on this account:

- **`order_created_simple`** (`HXf671d04d86dbedf8df5231159beee93a`) — submitted as **UTILITY**, status **`received`**, `rejection_reason` empty. Twilio has the request. Meta never reviewed it.
- **`notification_order_tracking`** (`HX754046914dd9862c6dc8771154524ff8`) — **`unsubmitted`**.
- Other Content templates — not in WhatsApp review (empty / unsubmitted).

Until a real sender exists, the Content Template Builder will keep showing **Business initiated = no**.

---

## 5. What CleanMateX already wired (repo truth)

Do not re-implement these. Use them after the WABA exists.

| Area | What it does |
|---|---|
| `web-admin/lib/notifications/config.ts` | Reads `sys_ntf_runtime_cf`; env overrides DB if the env value is non-empty; 30s cache |
| WhatsApp adapter | Twilio Content API when sandbox/template flag is on; otherwise free-form `body` (24h window only) |
| Phone pick | `wa_sandbox_to_phone` if set → customer master phone → `org_orders_mst.customer_mobile_number` |
| SMS | Not redirected by the sandbox To override |
| HQ page | `/notifications/runtime-config` lists/edits `sys_ntf_runtime_cf` (secrets masked) |
| Migrations | `0502_ntf_runtime_hub_flags.sql`, `0503_ntf_runtime_wa_sandbox_to.sql` (applied local + remote as of 2026-09-12) |

Secrets stay in env only: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `NOTIFICATIONS_OUTBOX_SECRET`, `RESEND_API_KEY`, `NTF_HQ_SERVICE_ROLE_KEY`, Meta access tokens.

---

## 6. Live account health (as of 12 Sep 2026)

Pulled from Twilio REST + Content APIs. Do not treat balance or message counts as frozen forever.

| Check | Result | Verdict |
|---|---|---|
| Account friendly name | `cleanmatex_comm` | OK |
| Account status / type | Active, Full | OK |
| Balance | ~USD 17.63 | OK for tests; top up before production volume |
| SMS number | `+17017796841` in-use (SMS / MMS / Voice) | OK for SMS. **Not** a WhatsApp sender today |
| WhatsApp From in use | Sandbox `whatsapp:+14155238886` | Gap — not production |
| Messaging Service | None | Gap — add after WABA |
| Production WABA / WhatsApp sender | Missing | **Blocking** for approval |
| Recent messages (last 40) | 2 delivered + 1 inbound (11 Sep); 37 failed **63015** (July) | Account can send; July = sandbox not joined |

July **63015** means: sandbox can only send to numbers that joined (or you were outside the session). That is expected sandbox behavior, not a dead account.

11 Sep deliveries happened after an inbound from the joined test number. That proves credentials and the Content SID path work **inside sandbox**.

---

## 7. Content templates on this account

| Friendly name | Content SID | Type | WhatsApp approval (12 Sep 2026) |
|---|---|---|---|
| `order_created_simple` | `HXf671d04d86dbedf8df5231159beee93a` | `twilio/text` | **`received`** / UTILITY — used by the app today |
| `notification_order_tracking` | `HX754046914dd9862c6dc8771154524ff8` | `twilio/list-picker` | **`unsubmitted`** |
| `notifications_appointment_reminder_template` | `HX954e684ee0bdbc0abbb53d480be6c3a7` | `twilio/quick-reply` | Not in review |
| `notifications_order_update_template` | `HXc6b3346db4f86839420ba5fbe7e1f6f6` | `twilio/quick-reply` | Not in review |
| `verifications_2fa_template` | `HX160a77fd6c62d288204e6f74089d71e8` | `whatsapp/authentication` | Not in review |
| `message_opt_in` | `HX665e8c7bc5a88ee3cc0127c6991c9081` | `twilio/quick-reply` | Not in review |
| `cmx_template_a` | `HX815d1b99f53a6a66fb316a8fcebce501` | `twilio/text` | Not in review |

`order_created_simple` body (Twilio Content):

```text
Order #{{order_number}} has been created and will be ready by {{estimated_ready_at}}.
```

App variables: `order_number`, `estimated_ready_at` (plus `date` in the event payload). Named variables must match the Content template, not OTP-style `{1,2}`.

Older catalog names in [09_whatsapp_templates.md](./09_whatsapp_templates.md) (`cmx_order_ready`, etc.) are **Meta-direct** drafts. They are not the seven Twilio Content SIDs above. Do not mix the two catalogs when submitting.

---

## 8. Runtime flags that control WhatsApp

Table: `sys_ntf_runtime_cf`. HQ: **Notification & Comm Hub → Runtime Config**.  
Resolution: **env (if non-empty) → DB → code default**. Cache 30 seconds. Restart `web-admin` after env edits.

| DB key | Env override | Current seeded / observed | Production target |
|---|---|---|---|
| `twilio_whatsapp_from` | `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` | `whatsapp:+YOUR_WABA_NUMBER` |
| `wa_use_sandbox_template` | `TWILIO_WHATSAPP_USE_SANDBOX_TEMPLATE` | `true` | `false` after template **approved** |
| `wa_sandbox_content_sid` | `TWILIO_WHATSAPP_SANDBOX_CONTENT_SID` | `HXf671d04d86dbedf8df5231159beee93a` | New `HX…` if you duplicated |
| `wa_sandbox_to_phone` | `TWILIO_WHATSAPP_SANDBOX_TO` | **empty** | **empty** |
| `outbox_inline_dispatch` | `NTF_OUTBOX_INLINE_DISPATCH` | `true` (dev seed on local **and** remote) | `false` on remote |
| `twilio_sms_from` | `TWILIO_SMS_FROM` | `+17017796841` | keep SMS number |
| `whatsapp_fallback_email` | `NTF_WHATSAPP_FALLBACK_EMAIL` | `true` | keep `true` until WA is reliable |
| `ntf_dispatch_via_hq` | `NTF_DISPATCH_VIA_HQ` | `false` | leave `false` unless HQ proxy is intended |

**Remote caution:** 0502 seeded **dev** defaults onto remote (`outbox_inline_dispatch=true`, sandbox From, sandbox template). Flip those on remote via HQ before real customer traffic.

`wa_sandbox_to_phone`: if set, **every** WhatsApp send goes to that number. Use only on local, and only with a number that joined the sandbox (`join say-eaten` to +1 415 523 8886 — the join word can expire; re-join if sends fail with 63015).

Phone fallback when To is empty:

1. Customer master phone (`org_customers_mst.phone`)
2. `org_orders_mst.customer_mobile_number`

---

## 9. Direct customer vs Tech Provider

| Who | Path |
|---|---|
| CleanMateX sending as **CleanMateX** (platform-operated WhatsApp) | **WhatsApp Self Sign-up** — this document |
| Each laundry tenant sending as **their own** brand | Meta **Tech Provider** + Twilio ISV later. Out of scope here |

Do Self Sign-up for CleanMateX first. Twilio requires **one WABA per Twilio account**. Additional senders on the same account must use that same WABA.

Official: [Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) · [Tech Provider](https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide)

---

## 10. Display name and Meta verification

- Display name customers see must follow [Meta display name guidelines](https://www.twilio.com/docs/whatsapp/self-sign-up). Recommended: **CleanMateX**.
- If Meta rejects the name, the sender is limited (about 250 business-initiated messages per 24 hours) and can be disconnected.
- **Meta business verification** is free and is **not** “Meta Verified”. Start it as soon as the Business Portfolio exists. Processing can take **weeks**.
- Until verified you typically cannot raise messaging limits, add more than two senders, or request an Official Business Account (green tick). OBA is rare and at Meta’s discretion.

Have `https://www.cleanmatex.com` (or the live public site) ready. Meta uses it when reviewing the display name.

---

## 11. Prerequisites checklist (same day)

- [ ] Twilio account `cleanmatex_comm` is **upgraded** (Console → Upgrade / billing). Balance already exists.
- [ ] Admin access to a Meta Business Portfolio, **or** plan to create one in the signup popup.
- [ ] Facebook login that can admin that portfolio. 2FA on the Meta business is required later for Tech Provider; recommended now.
- [ ] A phone number that meets [§12](#12-step-0--choose-the-production-sender-number).
- [ ] That number is **not** already on WhatsApp (consumer app or Business app).
- [ ] Website and legal business name ready.
- [ ] Do **not** start template resubmit until the sender shows as registered in Twilio.

---

## 12. Step 0 — Choose the production sender number

The number must be WhatsApp-compatible and **not already registered on WhatsApp**.

| Option | Use? | Notes |
|---|---|---|
| Sandbox `+14155238886` | **No** | Shared test sender. Cannot get production approval |
| SMS number `+17017796841` | Maybe | Already on this account (SMS/MMS/Voice). US number works technically; weaker trust for GCC customers. Use only if **not** already on WhatsApp |
| New Twilio number (OM / AE if sold and WhatsApp-capable) | Better | Closer to customer geography |
| Company landline / mobile (non-Twilio) | Fine | Must receive SMS or voice OTP. Must not be on WhatsApp already. Must not be outbound-only |

**Check if a number is already on WhatsApp**

1. Browser: `https://wa.me/<digits>` with country code and **no** `+` (example: `https://wa.me/17017796841`).
2. If WhatsApp opens a chat to that number, it is registered — pick another.
3. Or WhatsApp → New Chat → New Contact → enter the number. “This phone number is on WhatsApp” = taken.
4. Twilio Error Logs: **63110** also means the number is already on WhatsApp.

OTP delivery:

| Number type | Capability | Where the OTP appears |
|---|---|---|
| Twilio | SMS | Twilio Console during signup |
| Twilio | Voice only | You must configure voice/email OTP first (see Twilio Self Sign-up “Voice: Twilio phone numbers”) |
| Non-Twilio | SMS | SMS to that handset |
| Non-Twilio | Voice | Voice call OTP |

Do **not** choose Meta’s “display name only / 555 business number”. Twilio does not support that.

If the number is on an IVR / computer attendant, OTP often fails.

---

## 13. Step 1 — Meta Business Portfolio

1. Check whether the company already has a portfolio at [business.facebook.com](https://business.facebook.com).
2. If yes: request **administrator** access with full permissions.
3. If no: create one during Self Sign-up (step 2), then start verification immediately.
4. Do **not** select a WABA that was created under another BSP. If you already have WhatsApp with another provider, **create a new WABA for Twilio**.

---

## 14. Step 2 — Register the WhatsApp sender (30–60 min)

Official steps: [Register WhatsApp senders using Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)

1. Twilio Console → **Messaging → Senders → WhatsApp Senders** (or search “WhatsApp Senders”).
2. **Create new sender**.
3. Select the number from [§12](#12-step-0--choose-the-production-sender-number). **Continue**.
4. **Continue with Facebook**.
5. Keep **both** windows open (Twilio Console + Meta popup). Same browser. Do **not** share the popup URL. Finish in one sitting.
6. Log in to Facebook. Allow Twilio to manage the WABA. **Get started**.
7. Create or select the Meta Business Portfolio (**CleanMateX**).
8. **Create a new WhatsApp Business Account** (first sender). For a later extra sender, you **must** pick the **same** WABA. One WABA per Twilio account.
9. Create a new WhatsApp Business profile:
   - **WhatsApp Business account name** (internal): `CleanMateX`
   - **Display name** (customer-facing): `CleanMateX`
   - **Category:** Shopping and Retail, or Professional Services (you can change later)
   - Optional: description + website
10. When asked for the phone number: in Twilio Console copy the number, paste into Meta as **Add a new phone number**. Verification method **Text message** if the number has SMS.
11. Twilio Console shows the OTP → copy → paste into Meta → **Next**.
12. Confirm access requests. Popup closes. Twilio finishes registration (a few minutes). Console refreshes with the new sender.

**Success:** WhatsApp Senders lists **your** E.164 number, status registered. It is **not** `+14155238886`.

Then **Edit Sender**:

- Set inbound webhook when you want customer replies in-app (can wait).
- Upload profile picture and complete the business profile.
- After go-live, attach the sender to a **Messaging Service** ([§20](#20-after-go-live-checklist)).

If registration fails, use the troubleshooting section in the Self Sign-up doc (already-registered number, OTP, wrong WABA).

---

## 15. Step 3 — Submit or resubmit templates

Do this **after** the sender is registered. Submitting again on sandbox will stay `received`.

### 15.1 `order_created_simple` (already `received`)

1. Console → **Messaging → Content Template Builder**.
2. Open `order_created_simple`.
3. If status becomes `pending` or `approved` after the WABA exists, **stop** — do not duplicate.
4. If it stays `received` for more than a few hours:
   - Actions → **Duplicate**.
   - New name: `order_created_v2` (WhatsApp name rules: lowercase, underscores).
   - Language: **en** (body is English).
   - **Submit for WhatsApp approval**.
   - Category: **UTILITY**.
5. Put the new `HX…` SID into `wa_sandbox_content_sid` / `TWILIO_WHATSAPP_SANDBOX_CONTENT_SID` (name is historical; it is the Content SID the adapter sends).

Same SID cannot be submitted twice (**92009**). Edits are not supported in place — always duplicate.

### 15.2 What else to submit

Submit only templates you will send as **business-initiated**. Unused templates can stay unsubmitted.

| Template | Submit? | Category |
|---|---|---|
| `order_created_simple` or `order_created_v2` | **Yes** — first | UTILITY |
| `notifications_order_update_template` | Yes if you send status updates | UTILITY |
| `verifications_2fa_template` | Yes if WhatsApp OTP is used | AUTHENTICATION (Meta-controlled body + Copy Code) |
| `notification_order_tracking` | Only if you need list-picker / tracking UI. Duplicate first; extra Meta rules for pickers/cards | UTILITY |
| Appointment reminder / opt-in / `cmx_template_a` | Leave unsubmitted until needed | — |

For a tracking **URL button**, duplicate `order_created_simple` into a card/CTA template with a URL button. Do **not** put a huge free-text blob in one template. Meta will reject vague or abusive-looking bodies. Free-form paragraphs only work inside the 24h window.

Arabic: WhatsApp reviews **each language** separately. Duplicate + language `ar` + Arabic body. Do not mark English content as `ar`.

### 15.3 How to submit (Console)

1. Open the template → **Submit for WhatsApp approval**.
2. Choose category (UTILITY vs MARKETING vs AUTHENTICATION). Wrong category can reject or pause later.
3. Wait. Most decisions: minutes. Some: up to 48 hours.
4. If **`pending` > 48 hours**: Twilio Support ticket, include the template **name** and SID.

API (after you have the new SID):

```http
POST https://content.twilio.com/v1/Content/{ContentSid}/ApprovalRequests/whatsapp
Content-Type: application/json

{ "name": "order_created_v2", "category": "UTILITY" }
```

Use Account SID + Auth Token as Basic auth. Do not commit tokens.

Check status:

```http
GET https://content.twilio.com/v1/Content/{ContentSid}/ApprovalRequests
```

Or list: `GET https://content.twilio.com/v2/ContentAndApprovals`

---

## 16. Meta rejection rules (when status becomes `rejected`)

WhatsApp usually rejects for format, policy, or “too generic / abusable placeholders”.

| Rejection | Fix |
|---|---|
| Variable at the start or end | Add words or punctuation on both sides |
| Adjacent variables `{{1}}{{2}}` | Put words between them, or one variable |
| Non-sequential placeholders | `{{1}}`, `{{2}}`, `{{3}}` in order |
| Newlines / tabs / more than four spaces | Remove extra whitespace |
| `wa.me` link in a CTA | Spell the number; do not use `wa.me` |
| Duplicate of an existing template (different name) | Change **name and** body (OTP templates exempt) |
| Commerce / Business policy | Rewrite; for IDs ask only partial values |
| Gaming / raffle / “win a prize” wording | Remove those words |
| Too vague (`Hi {{1}}, thanks`) | Add concrete business context (order, time, branch) |
| Language mismatch | Language field must match the body |
| More than 10 emojis | Reduce |

Placeholders must not sit at the very beginning or end of the body.

---

## 17. Step 4 — Point CleanMateX at the new sender

Prefer HQ **Runtime Config** so you do not redeploy. Remember: **env wins** if the same key is set and non-empty in `.env.local` / host env. Clear or update those env rows too.

### Production / remote

| Key | Value |
|---|---|
| `twilio_whatsapp_from` | `whatsapp:+YOUR_NEW_E164` |
| `wa_use_sandbox_template` | `false` **only after** the template is **Approved**. Until then keep `true` and the approved/pending Content SID will still fail business-initiated |
| `wa_sandbox_content_sid` | Approved `HX…` (original or `order_created_v2`) |
| `wa_sandbox_to_phone` | empty |
| `outbox_inline_dispatch` | `false` (pg_cron owns dispatch) |

Restart `web-admin` after env changes. DB-only edits apply within ~30 seconds.

Also update tenant provider config if `org_ntf_channel_provider_cf` still has `from_number` = sandbox (`whatsapp:+14155238886`). The adapter uses runtime From first, then provider `from_number`.

### Local sandbox (keep)

| Key | Value |
|---|---|
| `twilio_whatsapp_from` | `whatsapp:+14155238886` |
| `wa_use_sandbox_template` | `true` |
| `wa_sandbox_content_sid` | `HXf671…` or the test SID |
| `wa_sandbox_to_phone` | Your **joined** E.164 (optional but recommended) |
| `outbox_inline_dispatch` | `true` so you do not wait for cron |

---

## 18. Step 5 — Prove it

Business-initiated proof (production sender + approved template):

1. Pick a real WhatsApp number that:
   - did **not** join the sandbox, and
   - did **not** message you in the last 24 hours.
2. Leave `wa_sandbox_to_phone` empty.
3. Create an order (or send `order.created`) so the hub uses `order_created_simple` / `order_created_v2`.
4. Twilio message log: `queued` → `sent` → `delivered`. **Not** `63015`.
5. Content Template Builder: WhatsApp status **Approved**, Business initiated **yes**.

Sandbox proof (until WABA):

1. Re-join sandbox if needed (`join say-eaten` to +1 415 523 8886 — confirm the current join word in Console).
2. Set `wa_sandbox_to_phone` to that joined number.
3. Create an order. Expect delivery to that phone only.

---

## 19. Until the WABA is live — keep sandbox working

The account is healthy for this path.

1. Recipient must have joined the sandbox (join expires; re-join if 63015 returns).
2. Set `wa_sandbox_to_phone` on **local** so POS customer phones do not have to be the joined number.
3. Keep `wa_use_sandbox_template=true` and SID `HXf671…` (or current test SID).
4. Transactional events skip quiet hours in the orchestrator (`order.created` / `ready` / `cancelled`).
5. Do not expect Meta **Approved** or business-initiated on sandbox. That will never happen.

---

## 20. After go-live checklist

- [ ] New WhatsApp sender registered and visible in Twilio.
- [ ] At least `order_created_*` is **Approved**.
- [ ] Remote runtime flags no longer use sandbox From / inline dispatch.
- [ ] Env overlays on the host match HQ (or are empty so DB wins).
- [ ] `web-admin` restarted after env changes.
- [ ] Tenant `org_ntf_channel_provider_cf` `from_number` updated if it still points at sandbox.
- [ ] Messaging Service created; WhatsApp sender added; status callbacks configured.
- [ ] Meta business verification submitted (if not already verified).
- [ ] Inbound webhook set if you want customer replies.
- [ ] `wa_sandbox_to_phone` empty on remote.
- [ ] Smoke: business-initiated order-created to a non-sandbox number.
- [ ] Arabic template submitted if AR customers should get AR copy.

---

## 21. Error codes you will see

| Code | Meaning | What to do |
|---|---|---|
| **63015** | Sandbox cannot send to this number (not joined / not in session) | Join sandbox or use WABA + approved template |
| **63054** | Template unavailable for this account | WABA / MM Lite onboarding incomplete; check approval |
| **63016** / similar session errors | Free-form outside 24h window | Use an approved template |
| **21656 / 92007 / 50529 / 50541** | Content variables mismatch | Named vars must match the template (`order_number`, `estimated_ready_at`) |
| **21211 / 21614** | Invalid To number | Fix E.164 |
| **63110** | Number already registered on WhatsApp | Pick another sender number |
| **92009** | That Content SID was already submitted | Duplicate, then submit the copy |
| **63046** | Template approved (informational) | No action |

---

## 22. Official Twilio / Meta links

| Topic | URL |
|---|---|
| WhatsApp overview | https://www.twilio.com/docs/whatsapp |
| Self Sign-up (this playbook) | https://www.twilio.com/docs/whatsapp/self-sign-up |
| WABA concepts | https://www.twilio.com/docs/whatsapp/tutorial/whatsapp-business-account |
| Template approvals | https://www.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses |
| Submit from Content Template Builder | https://www.twilio.com/docs/content/manage-your-templates-with-the-content-template-builder |
| Content types / status table | https://www.twilio.com/docs/content/content-types-overview |
| Eligibility badges | https://www.twilio.com/docs/content/eligibility-badge-legend |
| Send templated WhatsApp | https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates |
| Tech Provider (later, ISV) | https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide |
| Meta Business Suite | https://business.facebook.com |

---

## 23. Related repo docs

| Doc | Role |
|---|---|
| [00_INDEX.md](./00_INDEX.md) | Setup reading order |
| [03_env_vars.md](./03_env_vars.md) | Env catalog (older; some flags now also live in `sys_ntf_runtime_cf`) |
| [04_provider_activation.md](./04_provider_activation.md) | `TWILIO_WHATSAPP` on `org_ntf_channel_provider_cf` |
| [09_whatsapp_templates.md](./09_whatsapp_templates.md) | Older Meta-direct template copy (`cmx_order_*`) |
| [11_smoke_tests.md](./11_smoke_tests.md) | Channel smoke tests |
| `web-admin/lib/notifications/config.ts` | Runtime key names |
| `web-admin/lib/notifications/whatsapp-phone.ts` | To-number pick order |
| `supabase/migrations/0502_ntf_runtime_hub_flags.sql` | Hub flag seed |
| `supabase/migrations/0503_ntf_runtime_wa_sandbox_to.sql` | `wa_sandbox_to_phone` seed |

---

## 24. Do not

- Do not wait for Meta to approve templates while From is still `+14155238886`.
- Do not set `wa_sandbox_to_phone` on remote / production.
- Do not leave `outbox_inline_dispatch=true` on remote after go-live.
- Do not put Twilio Auth Token, Account SID, or Resend keys in `sys_ntf_runtime_cf` or in this doc.
- Do not edit an existing Content template in place and resubmit the same SID.
- Do not use one giant generated paragraph as a Meta template.
- Do not select “display name only / 555” during Self Sign-up.
- Do not attach a WABA created under another BSP to this Twilio account.
- Do not apply database migrations from the agent. Operators apply SQL; this playbook assumes 0502/0503 are already applied.

---

## 25. Decision still open

**Which production sender number?** `+17017796841` vs a new OM/AE Twilio number vs a company PSTN number.

Until that is chosen, stop at [§12](#12-step-0--choose-the-production-sender-number). Everything after it is the same.
