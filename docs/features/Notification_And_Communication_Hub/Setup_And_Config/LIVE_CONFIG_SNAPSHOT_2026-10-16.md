# Live configuration snapshot (2026-10-16) and how to rebuild it

Purpose: if the live database is lost or restored from an older backup, this lists every setting that was made by hand on 2026-10-16, which of them migration `0632_ntf_live_config_baseline.sql` recreates, and the exact steps for the rest. No secrets are recorded here.

## A. Recreated by migration 0632 (nothing to do by hand except Verify)

| Setting | Value | Where it lives |
|---|---|---|
| `ntf-outbox-processor` | enabled, every minute (`* * * * *`, the registry default) | job registry + pg_cron |
| `ntf-campaign-scheduler` | enabled, every 5 minutes (`*/5 * * * *`, owner choice; default would be every minute) | job registry + pg_cron |
| `ntf-sweep-stale-push-subs` | disabled (enable it in HQ > Operations > Jobs if push is used) | job registry + pg_cron |
| Registry key `ntf.hq.twilio.content_cred_ref` | `cleanmatex_comm` (a label) | Configuration Registry |
| Platform account `twilio-whatsapp-prod` | provider `TWILIO_WHATSAPP`, channel `WHATSAPP`, environment `PRODUCTION`, Account SID `AC692a0a…07e9`, credential reference `cleanmatex_comm` | Providers > Manage connections |
| Sender `whatsapp-main` | `whatsapp:+17017796841` (WHATSAPP_NUMBER), tied to that account | same dialog |

On a rebuilt database the account and sender come back as **PENDING**. Click **Verify** on the account, then on the sender (Providers > Manage connections). Verification is a live check against Twilio and is never faked by a migration.

Needed on the HQ host (not in any migration, they hold secrets): `HQ_TWILIO_ACCOUNT_SID`, `HQ_TWILIO_AUTH_TOKEN`, `NTF_TWILIO_CONTENT_CREDENTIAL_REF=cleanmatex_comm`, `HQ_ENCRYPTION_MASTER_KEY`.

## B. Not in a migration (produced by live Twilio checks) and how to recreate

1. **Template registration and revision `order_created_v4`** (Twilio Content template, language `en`, approved). Providers > **Import Twilio template**: pick the verified account, locale for `order.created` / WHATSAPP / `en`, the sender, paste the Twilio Content SID (`HX…`, read it from the Twilio console), **Fetch and import**. The template must still be approved in Twilio.
2. **Variable bindings** of that revision: open the revision > Bindings, map each ordered Twilio slot to its variable (the same mapping as before: `{{1}}` order number, `{{2}}` estimated ready time).
3. **Route** for the demo tenant `11111111-1111-1111-1111-111111111111`: Tenant Config > the "…" button on any of its rows > Routes > Add route > pick the approved template `order.created · WHATSAPP · en` > Save > **Activate**. State today: `ACTIVE`, owner `PLATFORM`, assignment version 2.
4. An observed approval has no time limit by default (nothing sets a date automatically since 2026-10-16). An operator may set an optional **Approval valid until** date, or remove it, in Tenant Config > "…" > Routes > Add route > after choosing the template (needs `hq_notifications:manage`). A passed date blocks activating routes for that template until it is changed or removed; it never stops a route that is already active. Activation is also refused if the last observed status is no longer APPROVED, or Twilio's own valid-until date on the revision has passed.

## C. Settings that were NOT changed and need an owner decision
- Registry values stored as plain text for secrets (`seed-config-from-env`): the Setup Health "plain secrets" check lists them. Encrypt them from Operations > Configuration Registry once `HQ_ENCRYPTION_MASTER_KEY` is confirmed on the HQ host.
