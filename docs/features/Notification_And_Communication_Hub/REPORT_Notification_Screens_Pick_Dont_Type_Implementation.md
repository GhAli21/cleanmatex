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

## 18. Browser QA round 1 (production, read-only, 2026-10-17)
| Row | Result | Note / fix |
|---|---|---|
| PDT1 | PASS | Failover pickers. Channel list = channels the operations API accepts (no WEB_SOCKET): intended. |
| PDT2 | PASS | Paused-org scopes exclude IN_APP and WEB_SOCKET by design (not governed by HQ dispatch). Picker search hardened (#9). |
| PDT3 | PASS | Labels now render " - [column]" (#7). |
| PDT4 | FAIL → fixed | Platform add started on TWILIO_WHATSAPP; now empty unless only one provider fits (#6). |
| PDT5 | FAIL → fixed | SMS preview chip "In-app text": correct fallback (version has no SMS text) but unclear; now "No SMS text: the in-app text is used", warning badge (#5). |
| PDT6 | PASS | Analytics filter layout widened (#10). |
| PDT7–PDT9 | not run | Writes; not done on production. |
| PDT10 | FAIL → fixed | `sk_live_abc123` not flagged; Save enabled with invalid ref or empty required fields. Secret check widened (web + API); Save disabled until valid (#3). |
| PDT11 | FAIL → fixed | Private add preselected TWILIO_WHATSAPP; now the row channel's Twilio provider or none; header shows organization `name · id` (#6). |
| PDT12 | PASS (guide aligned) | Language is required (import needs language_code), so no "No language" option; QA guide updated (#4). |
| PDT13 | BLOCKED → explained | 0 overrides: all 12 remote rows are soft-deleted (is_active false, rec_status 0, deleted 2026-10-17 04:47–04:48 UTC+4). Not a list bug. Real bug found: re-saving a soft-deleted combo upserted without reactivating it; upsert now sets is_active true, rec_status 1 (#1). |
| PDT14 | PASS | — |
| PDT15 | PASS | Providers search icon fixed (#10). |
| PDT16 | PASS | — |
| PDT17 | not run | Needs a QA_NOTIFICATIONS_READ login. |

Other findings: #2 sender capabilities JSON validated live (inline error, Save disabled). #7 CmxFieldLabel and CmxDataTable header text always contain " - ["; Operations "Organization id" → "Organization ID". #8 Tenant Config headers: status → "Active", channelEnabled → "Channel enabled" (EN/AR). #9 organization search keeps previous results while loading (keepPreviousData); the input was never disabled; debounce 300 ms, the rest is API time. #10 shell search wrapper self-start (icon inside the input); analytics toolbar items-start and tenant picker w-full sm:w-80; column names no longer split mid-token. Quota "Reason" clipping is the pinned Actions column over a scrolled table (scroll reveals it): left as is. #11 intended (operations DTO scopes). #12 the 401 on /auth/me is the expired-access-token probe; the API client refreshes and retries: harmless.
Tests: web 15 suites / 144 passed (new: 7 connections cases, cmx-field-label); API quota/provider-accounts 7 suites / 67 passed (new: reactivation, secret patterns). Note: another session was editing many of the same notifications-hq files at the same time; only the files above were changed in this round.

## 19. Missed fields (2026-10-22)
Found after round 1: typed lookups the audit missed. A platform-web-wide sweep followed (every `<CmxInput>`/`<input>`/`<textarea>` whose value, id, name or placeholder names an id/code, plus UUID placeholders in en.json).

Fixed in notifications-hq:
| Screen | Field | Was | Now |
|---|---|---|---|
| Quota > Tenant position (`quota-position-panel.tsx`) | Organization - [tenant_org_id] | UUID text box (placeholder 00000000-…) + "Show position" | NtfTenantPicker (search + `name · id`); the position loads as soon as an organization is picked (no button: the pick is the intent; Retry stays on errors). Label "Organization" / "المنشأة". |
| Pricing > Add (`pricing-screen.tsx`) | Currency - [currency_code] | text box (upper-cased) | CmxSelect from sys_currency_cd (`code · name`); an edited row keeps its own code even if inactive. |
| Templates > Create (`templates-screen.tsx`) | Event code - [event_code] | text box | CmxSelect from sys_ntf_events_cd (`code · name`, FK target); Create disabled until an event is picked. |

API (platform-api `notifications-hq/provider-accounts`): new read-only `GET /notifications/events` and `GET /notifications/currencies` (`ntf-catalog-lookups.controller.ts`, guard JwtAuthGuard + HqPermissionGuard, `hq_notifications:read`, so pricing operators do not also need `currencies.view`). Both added to the controller-guards spec.

Fixed outside notifications-hq (same picker, simple swaps):
| File | Field | Now |
|---|---|---|
| `src/features/ops-operations/ui/ops-operation-param-form.tsx` | Operations Catalog params `tenant_org_id` (uuid, 6 remote operations) and `channel_code` (text, 2 operations) | NtfTenantPicker and the channel catalog select; every param label is now "Label - [param name]" (CmxFieldLabel). |
| `src/features/erp-lite-governance/ui/posting-simulation-screen.tsx` | Tenant org (placeholder 00000000-…) | NtfTenantPicker, label "Organization - [tenant_org_id]", Validate disabled until picked. |
| `src/features/erp-lite-governance/ui/template-detail-page.tsx` (assignment row) | "Tenant org id" | NtfTenantPicker |
| `src/features/erp-lite-governance/ui/template-studio-workspace.tsx` (assignment row) | "Tenant org id" | NtfTenantPicker |

Not changed (listed for owners; each needs its own lookup source, so not a simple picker swap). Line numbers as of this round:
- ERP-Lite: `posting-simulation-screen.tsx:97` source event code; `template-detail-page.tsx:449,455,500,869,875,1009,1015` and `template-studio-workspace.tsx:262,272,487,497,559,1078,1089,1222,1233` country / plan / account / operational / target account codes; phase codes `governance-packages-workspace.tsx:178,388`, `package-detail-page.tsx:665`, `packages-list-page.tsx:220`, `templates-list-page.tsx:167`, `template-studio-workspace.tsx:233`, `catalog/events-screen.tsx:80`, `catalog/resolvers-screen.tsx:89`, `catalog/usage-codes-screen.tsx:122`; `governance-packages-workspace.tsx:641` and `package-detail-page.tsx:1662` failure action; `package-detail-page.tsx:1191,1210,1229,1257` amount source / line type / usage code id / resolver id (verify: may be read-only); `catalog/account-group-form-fields.tsx:192` report role code.
- Billing: `app/billing/plans/[id]/page.tsx:302` currency; `app/billing/subscriptions/new/page.tsx:204,214` and `src/features/tenants/ui/steps/subscription-step.tsx:200,214` discount code / payment method id.
- Catalog: `app/catalog/items/[code]/edit/page.tsx:183`, `app/catalog/templates/[itemCode]/[serviceCategoryCode]/edit/page.tsx:274` item type code.
- System codes: `app/system-codes/payment-setup/payment-methods/new/page.tsx:112`, `.../[code]/page.tsx:269,277,354` gateway / replacement / settlement type; `app/system-codes/settlement/overpayment-resolutions/[code]/page.tsx:240` permission code.
- Workflow engine: permission / gate set / order source codes in `app/workflow-engine-config/actions/new/page.tsx:81`, `actions/[code]/edit/page.tsx:96`, `initial-rules/new/page.tsx:83`, `initial-rules/[code]/edit/page.tsx:100`, `transitions/new/page.tsx:81,85`, `transitions/[code]/edit/page.tsx:98,102`, `src/features/workflow-engine-config/ui/wf-edit-policy-matrix.tsx:219,228`, `wf-semantic-executions-editor.tsx:471`, `wf-tenant-scope-fields.tsx:50` (another session is editing workflow-engine-config: left alone).
- Other: `components/settings/NavigationItemForm.tsx:217` main permission code; `src/features/tenants/ui/tenant-user-roles/resource-scope-picker.tsx:107` resource id; `src/features/currency-setup/ui/currency-table.tsx:210,211` country / region filters.
- Kept typed on purpose: new identity codes on create (template_code, plan_code, role/permission codes, ERP-Lite catalog codes, setting codes), provider external ids (Twilio Content SID, external account/sender ids), recipients, free-text searches.

Tests: `quota-position-panel.test.tsx` rewritten (picker, no load before a pick, auto-load, retry); new `catalog-code-pickers.test.tsx` (currency, event + Create gate); `ops-operations-screen.test.tsx` (+1 case; the typed "not-a-uuid" step removed: the picker cannot produce it, `ops-params.test.ts` still covers uuid validation); new `__tests__/features/erp-lite-governance/posting-simulation-tenant-picker.test.tsx`; API `catalog-lookups.spec.ts` + guards spec rows. Unused keys left in place: `quota.position.tenantPlaceholder`, `invalidTenant`, `load`.


## 20. Shared organization picker and the §19 fields (2026-10-22, uncommitted, no migration)

### 20.1 What moved
- `NtfTenantPicker` (notifications-hq) is now the shared **`CmxTenantPicker`** in `platform-web/src/ui/forms/cmx-tenant-picker.tsx`, built on the new shared **`CmxSearchableSelect`** (`src/ui/forms/cmx-searchable-select.tsx`). The search hook moved to `src/ui/forms/use-cmx-tenant-options.ts` (`useCmxTenantOptions`, `CMX_TENANT_OPTIONS_LIMIT` = 50).
- Chain: `CmxTenantPicker` -> `useCmxTenantOptions` (300 ms debounce) -> `tenantsApi.list` -> `GET /tenants` (HQ session only) -> `org_tenants_mst`. Shows `name · id` (Arabic name in Arabic), marks inactive, keeps a saved id visible, saves the exact `tenant_org_id`.
- Old files kept as thin re-exports with a full `@deprecated` note: `src/features/notifications-hq/ui/ntf-tenant-picker.tsx` and `hooks/use-ntf-tenant-options.ts` (`useNtfTenantLabel` still lives there).
- All imports switched to `@ui/forms` (no cross-feature imports left): notifications-hq broadcast-center, notifications-audit, observability-dashboard, operations, quota-position-panel, quota, template-preview-dialog, tenant-config screens; `ops-operations/ui/ops-operation-param-form.tsx`; ERP-Lite posting-simulation-screen, template-detail-page, template-studio-workspace.
- i18n: `common.lov.*` (search, searchPlaceholder, placeholder, loading, empty, error, inactive, none, any, default) and `common.tenantPicker.*`. `notificationsHq.tenantPicker.*` is now unused and left in place.

### 20.2 New shared LOVs (src/ui/forms, all exported from `@ui/forms`)
| Component | Saves | Source |
|---|---|---|
| `CmxSearchableSelect` | exact value | generic; search box when > 10 options (client) or server search |
| `CmxCodeTableSelect` | code | `GET /codes/:tableName` (registered code tables, e.g. sys_country_cd, sys_currency_cd) |
| `CmxPlanSelect` | plan_code | `GET /billing/plans` -> sys_pln_subscription_plans_mst |
| `CmxTenantPermissionSelect` | permission code | `GET /tenant-api/permissions` -> sys_auth_permissions |
| `CmxDiscountCodeSelect` | discount code | **new** `GET /billing/lookups/discount-codes` -> sys_bill_discount_codes_mst |
| `CmxTenantPaymentMethodSelect` | payment method id | **new** `GET /billing/lookups/tenants/:tenantOrgId/payment-methods` -> sys_bill_payment_methods_mst |

Feature-level LOVs (only one feature uses them): `erp-lite-governance/ui/erp-lite-lov.tsx` (`ErpCatalogSelect`, `useErpEnumOptions`, `erpPhaseOptions`), `payment-setup/ui/payment-setup-lov.tsx` (`PaymentGatewaySelect`, `PaymentMethodCodeSelect`, `SettlementTypeSelect`), `catalog/ui/catalog-item-type-select.tsx` (`CatalogItemTypeSelect`).

### 20.3 Fields converted (every label reads "Label - [db_column]")
| Area | Screen / file | Field | Source |
|---|---|---|---|
| ERP-Lite | posting-simulation-screen | source_event_code | ERP-Lite events catalog (evt_code); Run blocked until picked |
| ERP-Lite | template-detail-page, template-studio-workspace | country_code | sys_country_cd ("Any country") |
| ERP-Lite | template-detail-page, template-studio-workspace | plan_code | CmxPlanSelect ("Any plan") |
| ERP-Lite | template-detail-page, template-studio-workspace | target account_code | postable COA lines of the template |
| ERP-Lite | template-studio (new), templates-list, packages-list, governance-packages-workspace (new/edit), package-detail, catalog events / resolvers / usage-codes | phase_code / phase_scope_code | DB CHECK V1/V2/V3 (+ALL for scope) |
| ERP-Lite | governance-packages-workspace, package-detail | failure_action_code | DB CHECK BLOCK_TXN / FINANCE_EXCEPTION |
| ERP-Lite | package-detail rule lines | entry_side, line_type_code | DB CHECK DR/CR; MAIN/VAT/ADJUSTMENT |
| ERP-Lite | package-detail rule lines | usage_code_id, resolver_id | usage-codes / resolvers catalogs (one of the two, as the CHECK requires) |
| ERP-Lite | catalog/account-group-form-fields | stmt_section | DB CHECK ASSETS..EXPENSES (the old "CURRENT" placeholder was not a valid value) |
| Billing | app/billing/plans/[id] (Add price) | currency_code | sys_currency_cd |
| Billing | app/billing/subscriptions/new | tenant_org_id | CmxTenantPicker (was a `<select>` of the first 100 tenants) |
| Billing | app/billing/subscriptions/new | discount_code | new discount-codes lookup |
| Billing | app/billing/subscriptions/new | payment_method_id | new tenant payment-methods lookup; resets when the organization changes |
| Billing | tenants wizard subscription-step | discount_code | new discount-codes lookup |
| Catalog | app/catalog/items/[code]/edit, app/catalog/templates/.../edit | item_type_code | `GET /catalog/item-types` -> sys_item_type_cd |
| System codes | payment-methods/new, payment-methods/[code] | gateway_code | `GET /hq/v1/payment-setup/payment-gateways` -> sys_payment_gateway_cd |
| System codes | payment-methods/[code] | replacement_code | `GET /hq/v1/payment-setup/payment-methods` (itself left out) |
| System codes | payment-methods/[code] | settlement_type_code | DB CHECK (migration 0291), 4 values |
| System codes | overpayment-resolutions/[code] | permission_code | CmxTenantPermissionSelect |
| Navigation | components/settings/NavigationItemForm | main_permission_code | CmxTenantPermissionSelect ("No permission (always visible)") |
| Currency setup | currency-table filter | country_code | sys_country_cd ("All") |

### 20.4 Fields skipped, and why
- **Workflow engine (all §19 rows):** another session has uncommitted work in `src/features/workflow-engine-config` (`model/edit-policy-smart-fill.ts` modified, not committed). Left alone as instructed.
- Tenants wizard **payment_method_id**: a new organization cannot have saved payment methods yet, so there is nothing to pick. Recommendation: remove the field from the wizard.
- Currency-table **region** filter: no region lookup table exists.
- `resource-scope-picker` resource id: already a catalog picker for types that have a catalog; the typed UUID is only the fallback for types without a tenant catalog endpoint.
- Kept typed on purpose: COA "Account code" (new line identity), operational default "Operational code" (per-template identity, no lookup), `amount_source_code` (free varchar, no lookup), `report_role_code` (no constraint or lookup).
- Not in §19 but noticed: `payment-setup/ui/payment-method-form-drawer.tsx` still types replacementCode (gateway is already a pick list there). Small follow-up.

### 20.5 Endpoints
- New, read-only: `GET /billing/lookups/discount-codes` and `GET /billing/lookups/tenants/:tenantOrgId/payment-methods` (`platform-api/src/modules/billing/billing-lookups.controller.ts`, `services/billing-lookups.service.ts`; JwtAuthGuard + HqPermissionGuard, `@RequireHqPermission('billing.view')`; ParseUUIDPipe on the id; payment methods return non-secret columns only). Registered in `billing.module.ts`. Web client `billingApi.lookups` in `platform-web/lib/api/billing.ts`.
- Reused: `/codes/:tableName`, `/billing/plans`, `/tenant-api/permissions`, `/catalog/item-types`, `/hq/v1/payment-setup/*`, ERP-Lite catalog endpoints, `GET /tenants`.
- **Migrations: none.** Next free number stays 0637.

### 20.6 Changed files
- New (platform-web): `src/ui/forms/cmx-searchable-select.tsx`, `cmx-tenant-picker.tsx`, `use-cmx-tenant-options.ts`, `cmx-code-table-select.tsx`, `cmx-plan-select.tsx`, `cmx-tenant-permission-select.tsx`, `cmx-billing-lov.tsx`; `src/features/erp-lite-governance/ui/erp-lite-lov.tsx`; `src/features/payment-setup/ui/payment-setup-lov.tsx`; `src/features/catalog/ui/catalog-item-type-select.tsx`.
- New (platform-api): `src/modules/billing/billing-lookups.controller.ts`, `src/modules/billing/services/billing-lookups.service.ts`, `src/modules/billing/__tests__/billing-lookups.spec.ts`.
- Edited (platform-web): `src/ui/forms/index.ts`; `messages/en.json`, `messages/ar.json`; `lib/api/billing.ts`; the two deprecated notifications-hq files; the 12 import-swap files in 20.1; ERP-Lite posting-simulation-screen, template-detail-page, template-studio-workspace, templates-list-page, packages-list-page, governance-packages-workspace, package-detail-page, catalog/events-screen, catalog/resolvers-screen, catalog/usage-codes-screen, catalog/account-group-form-fields; `app/billing/plans/[id]/page.tsx`; `app/billing/subscriptions/new/page.tsx`; `src/features/tenants/ui/steps/subscription-step.tsx`; `app/catalog/items/[code]/edit/page.tsx`; `app/catalog/templates/[itemCode]/[serviceCategoryCode]/edit/page.tsx`; `app/system-codes/payment-setup/payment-methods/new/page.tsx`, `.../[code]/page.tsx`; `app/system-codes/settlement/overpayment-resolutions/[code]/page.tsx`; `components/settings/NavigationItemForm.tsx`; `src/features/currency-setup/ui/currency-table.tsx`.
- Edited (platform-api): `src/modules/billing/billing.module.ts`.
- Tests: new `__tests__/ui/forms/cmx-searchable-select.test.tsx`, `cmx-tenant-picker.test.tsx`, `pick-dont-type-lovs.test.tsx`; rewritten `__tests__/features/erp-lite-governance/posting-simulation-tenant-picker.test.tsx` (organization and event both picked; no submit without an event) and `__tests__/features/notifications-hq/ntf-tenant-picker.test.tsx` (re-export identity); mocks switched to `@/src/ui/forms/use-cmx-tenant-options` in 9 notifications-hq / ops suites.

### 20.7 Checks (2026-10-22)
- platform-web `tsc --noEmit`: 0 errors. platform-api `tsc --noEmit`: 63 errors = the pre-existing baseline (none in billing).
- Jest web: 25 suites / 204 tests pass (notifications-hq, erp-lite-governance, ops-config, ops-health, ops-operations, ui/forms). Jest API: `billing-lookups.spec.ts` 3/3 pass.
- ESLint on the 40 changed web files: 0 new errors; 3 pre-existing `no-explicit-any` errors in untouched lines (`NavigationItemForm.tsx:56`, `lib/api/billing.ts` dunning section); JSDoc warnings only.
- i18n parity: en 5489 keys = ar 5489 keys, no key missing on either side.
- `next build` (platform-web): compiled successfully.

### 20.8 Risks
- `billing.view` is not yet enforced anywhere else in billing. A role without it sees "could not load" in the discount / payment-method pickers (both fields are optional; HqPermissionGuard also accepts `billing.*` and `*`).
- ERP-Lite template pages have no i18n; their new labels are English, like the rest of those pages.
- Catalog item type: a cleared value is saved as '' exactly as before (unchanged behaviour).
- CHECK lists (phase, failure action, line type, entry side, statement section, settlement type) are copied from the migrations; if a migration widens a CHECK, the list must be widened too.

### 20.9 What is left
- Workflow-engine fields from §19 once the other session has committed.
- Owner decision: drop the wizard payment method field; grant `billing.view` to billing roles.
- payment-method-form-drawer replacementCode (small follow-up).
- Browser QA rows PDT24–PDT33 after deploy.
