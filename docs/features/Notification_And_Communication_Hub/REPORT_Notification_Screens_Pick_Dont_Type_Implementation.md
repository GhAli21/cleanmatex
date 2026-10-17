# Notification HQ screens: "pick, don't type" implementation report

Date: 2026-10-17 (Asia/Muscat, UTC+4). Repos: HQ `F:\jhapp\cleanmatexsaas` (platform-web, platform-api), tenant `F:\jhapp\cleanmatex` (migrations, docs).
Source of facts: the work done in this session series, `git status`, `git diff --stat` and `git show --name-status` in both repos. Nothing here is guessed; where an item comes from an earlier status note it is marked so.

## 1. Summary
- Every typed field on the Notification HQ screens whose value already exists in the system is now picked from a list, derived, or validated. Fields: organization, provider, channel, sender kind, credential reference, language, quota metric, broadcast template, ops-config content reference.
- Two migrations: 0634 (sender kind lookup) and 0635 (sender kind check trigger). The owner applied both to local and remote. Next free number: **0636**.
- New read-only API lookups: sender kinds, languages, credential references. The template list now returns `approved_channel_codes`.
- Labels follow `Label - [column]`; the raw `<label>` elements in scope are on the shared `CmxFieldLabel` (extended with an optional `column` prop).
- Final checks: web tsc 0 errors, API tsc 63 errors (same as baseline), eslint 0 errors on changed files, web jest 12 suites / 118 tests, API jest 11 suites / 113 tests, EN/AR parity 5354 = 5354, platform-web build OK.
- Remaining: owner browser QA (PDT1–PDT17) and committing the last uncommitted changes (section 14).

## 2. Timeline of rounds
| # | Round | What happened |
|---|---|---|
| 1 | Phase 1 inventory | Every form, dialog, filter and table field listed and ranked P1/P2/P3 (section 3). |
| 2 | P1 pass | Shared organization LOV `NtfTenantPicker` (+ `useNtfTenantOptions`) on Operations paused organizations, Tenant Config, test-send, Quota overrides, Broadcast, Observability. Failover source/target from active providers of the channel. Tenant Config provider filtered by channel. Connections provider pick list with derived channel. Broadcast template pick list. Test-send recipient format check. `colLabel` moved to `lib/col-label.ts`. |
| 3 | Sender kind lookup (0634) | Table `sys_ntf_sender_kind_cd` + seed; `GET /notifications/sender-kinds`; soft validation on sender create; sender dialog kind list and message-type checkboxes. |
| 4 | Post-migration checks | Owner applied 0634. Types regenerated; `rec_status` filter fixed to the number 1; API switched to the regenerated types. FK not possible (senders have no `provider_code`, kind code not unique alone). |
| 5 | 0635 trigger | Owner chose a trigger. `fn_ntf_sender_kind_check()` on both sender tables; API `senderWriteError` maps 23514 to 400. Dry-run on local inside a rolled-back transaction. |
| 6 | Remaining items ("fix all as expert") | credential_ref picker + validation; tenant-private providers limited to Twilio; Twilio import languages from DB; channel lists from DB; broadcast templates filtered by approved channels; ops-config content ref pick list; GET /tenants role check; missing tests; docs. Remote DB checks read-only. |
| 7 | 0635 applied | Owner confirmed 0635 applied to local and remote; docs updated. |
| 8 | Label cleanups | Raw `<label>` → `CmxFieldLabel` in ops-config dialogs, Operations, `NtfFormField`, then Quota position panel, template preview, Tenant Config. Language-load error hint added to both Twilio import dialogs. |
| 9 | twilio-import-languages | File deleted as unused, then restored on owner request from `git show HEAD:<path>` (original bytes, LF) with a `@deprecated` header (section 12). |

## 3. Phase 1 inventory with final status
Rebuilt from the audit prompt candidates and the STATUS entries; P = priority (P1 bad data/failed send, P2 mistype only, P3 label/coverage).

| Screen | Field | DB column | Before | P | Final control / status |
|---|---|---|---|---|---|
| Operations > Paused organizations | organization | tenant_org_id | typed | P1 | DONE: NtfTenantPicker, only organizations not already paused for the scope |
| Operations > Paused organizations / Pause | channel | channel_code | fixed array | P2 | DONE: fixed list ∩ DB channels, inactive marked |
| Operations > Control dialog | reason | control_reason | typed (free text by nature) | P3 | DONE: label `Label - [control_reason]` |
| Operations > Failover rules | source / target provider | provider_code | typed | P1 | DONE: active providers of the channel; target ≠ source; cleared on channel change |
| Operations > Reconcile | from / to | (query params) | date input | P3 | DONE: CmxFieldLabel, no column (not a table column) |
| Tenant Config > Add/Edit | tenant, channel, provider | tenant_org_id, channel_code, provider_code | typed / unfiltered | P1 | DONE: tenant LOV; provider filtered by channel, disabled until channel picked, inactive saved provider blocks Save |
| Tenant Config > Add/Edit | provider active, channel enabled | is_active, channel_enabled | switch | P3 | DONE: CmxFieldLabel with column |
| Connections > Add platform account | provider / channel | provider_code / channel_code | typed | P1 | DONE: provider pick list; channel derived, read-only |
| Connections > Add platform account | credential_ref, credential_version | credential_ref, credential_version | typed | P1 | DONE: pick list of refs in use (+ configured content ref) or "New reference" with format and no-secret check (web + API) |
| Connections > credential kind | credential_kind | credential_kind | typed | P2 | DONE: CmxSelect, disabled (single kind `TWILIO_ACCOUNT_AUTH`), API @IsIn |
| Tenant Config > Connections > private | provider | provider_code | any provider | P1 | DONE: Twilio family only, hint; API 400 for others |
| Connections > Add sender | sender kind, capabilities | sender_kind, capabilities | typed / raw JSON | P1 | DONE: lookup list per provider, message-type checkboxes, advanced JSON object field; DB trigger 0635 |
| Providers > Twilio import (platform + private) | language | language_code | fixed en/ar | P2 | DONE: sys_language_cd via GET /notifications/languages; empty and error hints |
| Providers | channel filter | channel_code | fixed array | P2 | DONE: DB channels |
| Templates > Preview | channel | channel_code | fixed | P2 | KEPT typed enum (renderer-supported channels); change clears recipient and confirmation |
| Templates > Preview | variables | (template placeholders) | typed names | P2 | DONE: names from the template placeholders; CmxFieldLabel |
| Templates > Test send | organization, recipient | tenant_org_id, recipient | typed | P1 | DONE: tenant LOV; email / E.164 check per channel; channels kept EMAIL/SMS enum |
| Quota > Tenant overrides | tenant, metric, period | tenant_org_id, metric, period_type | typed / fixed | P1 | DONE: tenant LOV; metric = DB channels ∩ channel metrics + CAMPAIGN; period kept enum (DB CHECK); duplicate blocked |
| Quota > Position panel | tenant | tenant_org_id | input | P3 | DONE: CmxFieldLabel with column (input kept, see risks) |
| Broadcast > New campaign | tenant, channel, template | tenant_org_id, channel_code, template_code | typed / fixed | P1 | DONE: tenant LOV, DB channels, templates with an APPROVED version on the channel; mismatch cleared |
| Observability | tenant, channel filters | tenant_org_id, channel_code | typed / fixed | P2 | DONE: tenant LOV; catalog channels + channels only in the data; aria-labels |
| Ops Config | key, filters | config_key | picked already | — | VERIFIED: already pickers; value validated by type/regex |
| Ops Config > value | ntf.hq.twilio.content_cred_ref | value | typed | P2 | DONE: pick list of TWILIO_WHATSAPP refs + free entry |
| Ops Config > policy / value dialogs | labels | source_policy, value | raw label | P3 | DONE: CmxFieldLabel with column |
| Jobs | schedule | cron | validated already | — | VERIFIED: cron validated |

## 4. Decisions
Owner decisions:
- Sender kind seed (0634): TWILIO_WHATSAPP/META_WHATSAPP → WHATSAPP_NUMBER (message types template, session); TWILIO_SMS → PHONE_NUMBER, MESSAGING_SERVICE; RESEND → EMAIL_ADDRESS.
- DB enforcement of sender kind by trigger (0635), not FK.
- "Fix all as expert": remaining items decided by me (below).
- Remote DB checks read-only only; never local.
- Restore `twilio-import-languages.ts` as deprecated reference; merge `@deprecated` into its original JSDoc.

My decisions (with reasons):
- credential_ref: no registry exists, so the list is refs already bound to platform accounts plus the configured `ntf.hq.twilio.content_cred_ref`; typed refs must match `^[A-Za-z][A-Za-z0-9_.:/-]{2,127}$` and must not look like a secret. Reason: pick what exists, never accept secrets.
- Tenant-private providers: Twilio only, enforced in web and API. Reason: the only BYO connector reads `TWILIO_ACCOUNT_AUTH`.
- Kept as typed constants: quota period (DB CHECK), CAMPAIGN metric, preview channels (renderer support), test-send channels (EMAIL/SMS). Reason: true enums, not lookup data.
- Broadcast channel list = all active catalog channels (includes WEB_SOCKET); templates filtered by approved channels. Reason: derivable from template versions.
- GET /tenants: no new endpoint; it needs only an HQ session (JwtAuthGuard + HqIdentityGuard, no permission key), so every HQ role can call it. Remote read-only role query: only SUPER_ADMIN holds `*`; `hq_notifications:read/manage/test_send/operate` exist. Contract test added.
- Languages: no preselected default; the user picks explicitly. On load error the field stays disabled with an error hint (no static fallback, so inactive languages are never offered).
- `CmxFieldLabel` extended with optional `column` instead of a new component (backward compatible).

## 5. Per-screen changes (platform-web `src/features/notifications-hq/ui` unless noted)
- `operations-screen.tsx`: tenant LOV for pauses; failover pickers; channels ∩ DB; CmxFieldLabel for reconcile dates and control reason.
- `tenant-config-screen.tsx`: tenant LOV; provider filtered by channel; CmxFieldLabel on switches.
- `connections-manager-dialog.tsx`: provider pick list, derived channel; credential ref pick list / new-ref input with validation; version prefill and hint; credential kind select; private providers Twilio only; sender kind list and message-type checkboxes.
- `quota-screen.tsx`: tenant LOV; DB metrics; period labels; duplicate override block; Save disabled without tenant; every field labelled.
- `quota-position-panel.tsx`: CmxFieldLabel `tenant_org_id`.
- `broadcast-center-screen.tsx`: tenant LOV; DB channels; templates by `approved_channel_codes`; clear on channel change.
- `providers-screen.tsx`: DB channel filter.
- `observability-dashboard-screen.tsx`: tenant LOV; catalog channels + data-only channels; aria-labels.
- `template-preview-dialog.tsx`: channel change clears recipient and confirmation; test-send tenant LOV and recipient check; CmxFieldLabel (channel_code; variables without column).
- `twilio-content-import-dialog.tsx`, `private-twilio-import-dialog.tsx`: languages from DB; empty and error hints; disabled state.
- `tenant-routes-dialog.tsx`: labels/pickers (P1 pass).
- `ntf-form-dialog.tsx`: `NtfFormField` renders `CmxFieldLabel` with the resolved column.
- `src/features/ops-config/ui/ops-config-value-dialog.tsx`: content cred ref pick list; CmxFieldLabel `value`.
- `src/features/ops-config/ui/ops-config-policy-dialog.tsx`: CmxFieldLabel `source_policy`.

## 6. New shared components, hooks, helpers (platform-web)
- `ui/ntf-tenant-picker.tsx` (organization LOV), `ui/ntf-field.tsx` (`NtfField` on CmxFieldLabel).
- `hooks/use-ntf-tenant-options.ts`, `hooks/use-ntf-sender-kinds.ts`, `hooks/use-ntf-lookups.ts` (`useNtfLanguages`, `useNtfCredentialRefs`).
- `lib/col-label.ts` (`makeColLabel`), `lib/channel-options.ts` (`ntfChannelOptions`).
- `model/credential-ref.ts` (patterns, kinds, `credentialRefError`).
- `src/ui/primitives/cmx-field-help.tsx`: `CmxFieldLabel` gains optional `column` (renders `- [column]`).

## 7. API endpoints added or changed (platform-api `src/modules/notifications-hq`)
| Endpoint | Permission | Notes |
|---|---|---|
| `GET /notifications/sender-kinds?provider=` (`sender-kinds.controller.ts`) | hq_notifications:read | Returns [] when the lookup is missing |
| `GET /notifications/languages` (`ntf-languages.controller.ts`) | hq_notifications:read | sys_language_cd, is_active, rec_status 1, by display_order |
| `GET /notifications/connections/credential-refs?provider=` | hq_notifications:read (controller default) | Names and versions only; source IN_USE / DEPLOYMENT / BOTH; secret-looking values skipped |
| Template list | unchanged | Adds `approved_channel_codes` (`template-channels.util.ts`); embedded rows stripped |
| Platform account create/update | unchanged | `@Matches` credential_ref/version, `@IsIn` credential_kind, `assertCredentialRefSafe` → 400 |
| Private account create | unchanged | Non-Twilio provider → 400 |
| Sender create/update | unchanged | Soft kind/capability check; DB 23514 → 400 (`senderWriteError`) |
| `GET /tenants` | HQ session only | Verified; contract test `tenant-options-access.spec.ts` |

## 8. Migrations (tenant repo `supabase/migrations`)
- **0634_ntf_sender_kind_lookup.sql**: new `sys_ntf_sender_kind_cd` (code, provider_code, channel_code, names, allowed_capabilities, display_order, is_active, audit columns) with the seed in section 4. No FK. **Applied by the owner (local and remote).**
- **0635_ntf_sender_kind_check_trigger.sql**: `fn_ntf_sender_kind_check()` (SECURITY DEFINER, pinned search_path), BEFORE INSERT OR UPDATE OF sender_kind, capabilities, account_id on `sys_ntf_prov_send_mst` and `org_ntf_prov_send_mst`; providers without active lookup rows pass; violation → ERRCODE 23514 `ntf_sender_kind: ...`. Includes a commented read-only pre-check. Local dry run in a rolled-back transaction. Remote read-only pre-check: 1 platform sender (WHATSAPP_NUMBER on TWILIO_WHATSAPP, message types template, session), 0 tenant senders: clean. **Applied by the owner (local and remote).**
- No other migration. Next free: **0636**.

## 9. i18n
- Keys added under `notificationsHq` (connections.fields, operations.channelInactive, quota.addOverrideDialog.*, broadcast.createDialog.channelInactive, twilioImport/privateTwilioImport.localeNone and localeError, opsConfig.valueDialog.ref*, observability.filters.periodLabel/channelLabel, sender kind keys).
- Inserted textually (no re-serialisation). Final parity: en 5354 keys, ar 5354 keys, 0 missing either side.

## 10. Tests
- platform-web new: `broadcast-center-screen`, `connections-manager-dialog`, `ntf-tenant-picker`, `observability-dashboard-screen`, `quota-screen`, `tenant-config-screen`, `twilio-content-import-dialog` (incl. language load error). Changed: `operations-screen`, `template-preview-dialog`, `quota-position-panel`, `ops-config-screen` (label queries, hook mocks, prefer-const).
- platform-api new: `credential-refs.spec`, `sender-kinds.spec`, `tenant-options-access.spec`, `template-channels.util.spec`; changed `controller-guards.spec`, `provider-accounts.service.spec`.
- Final: web 12 suites / 118 tests passed; API 11 suites / 113 tests passed.

## 11. Verification (last runs)
| Check | Result |
|---|---|
| platform-web tsc | 0 errors |
| platform-api tsc | 63 errors = baseline, none new |
| eslint changed files | 0 errors (web and API; warnings only, mostly jsdoc) |
| jest web notifications-hq + ops-config | 12 / 118 passed |
| jest API notifications-hq | 11 / 113 passed |
| i18n parity | 5354 / 5354 |
| `npm run build` platform-web | passed |

## 12. Files (from git)
HQ repo, committed in `a8d9052` (2026-10-17 05:12 UTC+4) as part of the owner's commit:
- platform-api: `src/database/database.types.ts`, `src/database/types/database.types.ts`; notifications-hq `__tests__/controller-guards.spec.ts`, `__tests__/tenant-options-access.spec.ts` (A), `provider-accounts/__tests__/credential-refs.spec.ts` (A), `provider-accounts/__tests__/provider-accounts.service.spec.ts`, `provider-accounts/__tests__/sender-kinds.spec.ts` (A), `provider-accounts/ntf-languages.controller.ts` (A), `provider-accounts/provider-accounts.{controller,dto,module,repository,service}.ts`, `provider-accounts/sender-kinds.controller.ts` (A), `templates/__tests__/template-channels.util.spec.ts` (A), `templates/template-channels.util.ts` (A), `templates/templates.{repository,service}.ts`.
- platform-web: tests `broadcast-center-screen`, `connections-manager-dialog`, `ntf-tenant-picker`, `observability-dashboard-screen`, `quota-screen`, `tenant-config-screen`, `twilio-content-import-dialog` (A); `operations-screen`, `template-preview-dialog`, `ops-config-screen` (M); `lib/types/database.ts`; `messages/{ar,en}.json`; notifications-hq `api/notifications-hq-api.ts`, `hooks/index.ts`, `hooks/use-ntf-{lookups,sender-kinds,tenant-options}.ts` (A), `lib/{channel-options,col-label}.ts` (A), `model/credential-ref.ts` (A), `model/notifications-hq.types.ts`, `ui/ntf-field.tsx` (A), `ui/ntf-tenant-picker.tsx` (A), `ui/{broadcast-center-screen,connections-manager-dialog,observability-dashboard-screen,operations-screen,private-twilio-import-dialog,providers-screen,quota-screen,template-preview-dialog,tenant-config-screen,tenant-routes-dialog,twilio-content-import-dialog}.tsx`; `ops-config/ui/ops-config-value-dialog.tsx`.

HQ repo, uncommitted now (`git diff --stat`: 18 files, +75 / −39):
- platform-web tests: `notifications-hq/{operations-screen,quota-position-panel,twilio-content-import-dialog}.test.tsx`, `ops-config/ops-config-screen.test.tsx`.
- `messages/{ar,en}.json` (localeError).
- `notifications-hq/model/twilio-import-languages.ts` (deleted, then restored with deprecation note: net change is the note only).
- `notifications-hq/ui/{ntf-form-dialog,operations-screen,private-twilio-import-dialog,quota-position-panel,template-preview-dialog,tenant-config-screen,twilio-content-import-dialog}.tsx`.
- `ops-config/ui/{ops-config-policy-dialog,ops-config-value-dialog}.tsx`, `src/ui/primitives/cmx-field-help.tsx`.
- `.gitignore` is also modified: not part of this work.

Tenant repo:
- Committed: `supabase/migrations/0634_ntf_sender_kind_lookup.sql`, `0635_ntf_sender_kind_check_trigger.sql`; docs in `5e8441c5` / `6aa5a729`.
- Uncommitted (this work): `docs/features/Notification_And_Communication_Hub/{STATUS,RESUME_CONTINUATION,PROMPT_Notification_Screens_Pick_Dont_Type_Audit}.md`, `docs/features/Platform_Operations_Console/qa_test_guide.md`, and this report (new).
- Uncommitted, not part of this work: `GrokBot_HQ_Owner_UI_Tasks_2026-10-17.md`, Order Edit V2 files under `web-admin` and `docs/features/Order_Edit_V2`.

## 13. Deprecated file note
`platform-web/src/features/notifications-hq/model/twilio-import-languages.ts` held only `TWILIO_IMPORT_LANGUAGES = ['en','ar']` and `TwilioImportLanguage`. Nothing imports it (checked with `git grep` on HEAD and the working tree, incl. untracked, across platform-web, platform-api, platform-workers). Restored from `git show HEAD:<path>` (245 bytes, LF, no BOM) with a `@deprecated` header (use, replacement chain, date, reason, kept for reference) and `@deprecated` on both exports; the original description and code are unchanged.

## 14. Known risks and limitations
- Credential refs: no registry, so a "New reference" can still name a ref that does not exist in the deployment; only format and no-secret are checked.
- Sender kind check is soft for providers without lookup rows (by design).
- Broadcast channel list includes WEB_SOCKET (active in the catalog).
- Typed enums kept: quota period, CAMPAIGN, preview channels, test-send channels; they must be updated in code if the DB rules change.
- Quota position panel tenant stays a text input (now labelled), not the LOV.
- Migration headers: the "UNAPPLIED"/status comment line was removed from 0634 (line 1) and 0635 (line 3) on 2026-10-17 so they match the older migrations (no status in headers); no SQL changed. These files are already committed, so the removal shows as an uncommitted 2-line diff. Applied status lives in STATUS.md (both applied by the owner, local and remote).
- `CmxFieldLabel` uses text-xs, so converted labels are slightly smaller than the former text-sm.
- API tsc baseline of 63 errors remains (pre-existing, outside this work).

## 15. Deviations from the prompt rules
- Read-first docs listed in the audit prompt were not all read at the start of the session.
- 0635 was dry-run on the LOCAL DB inside a rolled-back transaction before the owner's read-only-remote rule; afterwards all DB checks were read-only REST GETs against the remote (psql auth failed; Prisma remote MCP needed auth).
- `rg` is not installed on the Windows machine; `Select-String` and `git grep` were used instead.
- Several of the files touched are LF (not CRLF); their existing line endings were preserved.

## 16. What remains
- Owner browser QA: rows PDT1–PDT17 in the QA guide.
- Commit the uncommitted HQ and tenant-repo changes listed in section 12.

## 17. Links
- [STATUS.md](STATUS.md)
- [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md)
- [QA guide](../Platform_Operations_Console/qa_test_guide.md) (PDT rows)
- [Audit prompt](PROMPT_Notification_Screens_Pick_Dont_Type_Audit.md) (Tracking section)
