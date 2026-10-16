# Prompt for a new session: "pick, don't type" audit of all Notification HQ screens

Written 2026-10-16. Copy everything under the line into a new Claude Code session opened in `F:\jhapp\cleanmatex`.

---

## Task

Audit every Notification Hub And Ops screen in the HQ console (`F:\jhapp\cleanmatexsaas\platform-web\src\features\notifications-hq\ui\`) and remove every place where an operator has to TYPE a value that already exists in a database table, each field that could come from different table or where two fields can be filled in a combination that is invalid. Replace each with a pick-from-list (LOV with dialog window) control fed by existing data, so the operator cannot mistype or mismatch.

Repos: tenant `F:\jhapp\cleanmatex` (owns ALL migrations), HQ `F:\jhapp\cleanmatexsaas` (platform-api NestJS, platform-web Next.js, platform-workers).

## Read first (in this order)
1. `docs/features/Notification_And_Communication_Hub/RESUME_CONTINUATION.md` and `STATUS.md` ("Residual / post-pilot backlog"), `Skipped_On_Purpose.md`.
2. `docs/features/Platform_Operations_Console/qa_test_guide.md` (tester findings, so you do not re-break fixed items).

## Rules (from CLAUDE.md, do not skip)
- Load the skill BEFORE writing code: `/frontend`, `/i18n`, `/backend`, `/database` (only if a migration is needed), `/multitenancy` for `org_*` queries, `/code-documentation`.
- NEVER apply a migration (no MCP/CLI writes). Write the new SQL file (next free sequence; never edit an applied migration), say it is UNAPPLIED, STOP, and wait for the owner to apply and regenerate types. `supabase_remote_db` MCP is read-only.
- Cmx components only (`@ui/...`), feedback via `cmxMessage`/`useMessage()`, every string i18n with EN and AR in `messages/en.json` and `messages/ar.json` (keep key parity), RTL safe, no `any`, no secrets in browser/logs.
- Constants mirror DB strings exactly (case included). Event codes are lowercase dotted (`order.created`), language codes lowercase (`en`, `ar`), channel codes uppercase (`WHATSAPP`). Never change case in the UI.
- Do not run `git stash`. Write multi-line scripts with the Write tool, not bash heredocs containing backticks. Preserve CRLF when scripting edits. Run jest targeted, not the full suite.

## Method
1. List every form/dialog/filter in `notifications-hq/ui/` and `ops-*` notification-related screens. For each input write down: the field, the table/column where the valid values already live, and whether the user types it, picks it, or it is derived.
2. Known candidates to check first (verify each, there may be more):
   - Notifications > Operations > "Paused organizations": organization id is typed; replace with an organization picker (name + id), only organizations that are not already paused for the chosen scope.
   - Tenant Config > Add Config / Edit: tenant id, channel, provider (should be pickers; provider list must be filtered to providers that support the chosen channel).
   - Quota > Tenant overrides: tenant id, metric, period.
   - Operations > failover rules: provider codes (pick from existing providers; source and target must differ and support the same channel).
   - Providers > Manage connections and sender forms: provider, channel, `credential_ref` (must be pickable or validated against the env/registry reference, not free text where a list exists), sender address format by channel.
   - Providers > Import Twilio template: language code, template, sender (already partly lists; make the language a pick from existing locales).
   - Templates, Broadcast Center/campaigns, test-send dialog: event, channel, language, recipient, variables.
   - Ops Config / Jobs: keys must be picked from the registry, values validated against the key's type and regex (this largely exists; verify).
3. For each place, apply the same design as the Routes dialog:
   - The value comes from an existing list endpoint. If the list endpoint lacks fields you need, extend the endpoint (service-level flattening, typed, tested) rather than querying in the browser.
   - Dependent fields are DERIVED from the primary choice, not chosen separately. Do not show a choice that has only one valid answer.
   - Offer only valid options (for example only approved templates, only verified accounts, only active providers for that channel).
   - Disable Save until the form is valid; show an inline hint when a list is empty and say what to do next.
   - Keep free text only where nothing in the system can supply the value (for example a Twilio Content SID pasted from Twilio, a free-text reason). For those, validate format and trim.
4. Labels and field coverage (owner requirement, applies to EVERY form, dialog, detail view and table in the Notification Hub screens):
   - Every field label must read `Label - [db_column]`, for example `Event code - [event_code]`, `Route owner - [route_owner]`. Use the same helper pattern as `colLabel(key, column)` in `tenant-routes-dialog.tsx`. The label text stays i18n (EN and AR); the bracketed column name is the real database column (or the real API field when the value is derived) and is never translated. Table column headers follow the same rule, as already done on the Tenant Config table (`Tenant ID - [tenant_org_id]`).
   - Show ALL available fields of the record, not only the ones needed to create it. For each screen, read the table/endpoint it is backed by (generated types in `platform-api/src/database/database.types.ts`, the repository `select` list, and the web model in `notifications-hq.types.ts`) and make sure every meaningful column is visible somewhere: editable fields in the form, read-only fields (id, state, version, created/updated audit columns, derived values such as the account or event a template belongs to) in a read-only block or an expandable "All fields" section. Do not hide a column just because the operator cannot edit it. Secrets and credential payloads are the only exception: never show them, show only that a credential exists and its reference.
   - If an endpoint omits a column that exists in the table and is useful to the operator, extend the endpoint (service-level, typed, tested, never selecting secret columns) instead of leaving the field out.
   - Missing or empty values show a clear placeholder, not a blank. Dates and times follow the existing HQ date helper.
   - Add a test per changed screen asserting that every field label has the `- [column]` suffix and that the full field set is rendered.
   - The same keeps the existing "Label - [db_column]" labels the owner already added; do not remove or reword them.
5. Server stays the authority: do not remove any backend validation; the UI change only prevents mistakes.

## Deliverables
- Code for each fix, with a component test per changed dialog (mock hooks and `CmxSelect` as in `tenant-routes-dialog.test.tsx`) proving that the saved request carries the picked values and that invalid combinations cannot be chosen.
- EN and AR i18n for every new string.
- A table at the end of your report: screen, field, before (typed/picked), after, source table/endpoint.
- Update `STATUS.md` and `RESUME_CONTINUATION.md` in the tenant repo, and the QA guide (`Platform_Operations_Console/qa_test_guide.md`) with scenarios for each changed screen (sidebar path, what to click, expected result).
- Verification: `npx tsc --noEmit`, eslint on changed files, targeted jest in `platform-web` and `platform-api`, i18n parity, and `npm run build` in `platform-web` (run it alone, never alongside another build).


## Do not
- Do not redesign unrelated screens or change API contracts that other apps use (feature-flag reads, settings reads).
- Do not apply migrations or touch the remote database except read-only checks.
- Do not claim a screen works unless a test or a read-only check proves it; say what you did not verify.
