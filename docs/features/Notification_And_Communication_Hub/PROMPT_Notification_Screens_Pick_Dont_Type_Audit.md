# Prompt for a new session: "pick, don't type" audit of all Notification HQ screens

Written 2026-10-16, revised 2026-10-16 (v2). Copy everything under the line into a new Claude Code session opened in `F:\jhapp\cleanmatex`.

---

## Goal

Make every Notification Hub and Ops screen in the HQ console mistake-proof. An operator should never type a value the system already knows, never pick a value that is invalid for the current context, and never be able to save a combination of fields the server would reject.

Scope: `F:\jhapp\cleanmatexsaas\platform-web\src\features\notifications-hq\ui\` and every notification-related `ops-*` screen.

Repos: tenant `F:\jhapp\cleanmatex` (owns ALL migrations), HQ `F:\jhapp\cleanmatexsaas` (platform-api NestJS, platform-web Next.js, platform-workers).

A field is in scope when ANY of these is true:
1. The operator types a value that already exists in a table (ids, codes, names, locales).
2. The valid values depend on another field (provider depends on channel, sender depends on account, revision depends on registration).
3. Two or more fields together can form a combination the server rejects (platform account with private sender, source provider = target provider, unapproved template revision).
4. The value can be derived from another choice and should not be asked for at all.

## Read first (in this order)
1. `docs/features/Notification_And_Communication_Hub/RESUME_CONTINUATION.md`, `STATUS.md` ("Residual / post-pilot backlog"), `Skipped_On_Purpose.md`.
2. `docs/features/Platform_Operations_Console/qa_test_guide.md` (tester findings, so you do not re-break fixed items).
3. The reference implementation: `notifications-hq/ui/tenant-routes-dialog.tsx` and its test. It already shows event picked from the template catalog, account/sender/revision chained by owner, the `colLabel(key, column)` helper, and `RouteField` built on the shared `CmxFieldLabel`. Copy its patterns; do not invent new ones.

## Rules (from CLAUDE.md, do not skip)
- Load the skill BEFORE writing code: `/frontend`, `/i18n`, `/backend`, `/database` (only if a migration is needed), `/multitenancy` for `org_*` queries, `/code-documentation`.
- NEVER apply a migration (no MCP/CLI writes). Write the new SQL file (next free sequence; never edit an applied migration), say it is UNAPPLIED, STOP, and wait for the owner to apply and regenerate types. `supabase_remote_db` MCP is read-only.
- Cmx components only (`@ui/...`): `CmxSelect`, `CmxInput` (now supports `error`), `CmxFieldLabel`, existing LOV/dialog components. If a shared component is missing something you need, improve the shared component once (backward compatible, no prop renames) instead of building a one-off in the feature folder. Feedback via `cmxMessage`/`useMessage()`.
- Every string i18n with EN and AR in `messages/en.json` and `messages/ar.json` (keep key parity, keep the files' existing formatting and CRLF; never re-serialize the whole JSON). RTL safe (logical `start`/`end` classes), no `any`, no secrets in browser/logs.
- Constants mirror DB strings exactly (case included). Event codes lowercase dotted (`order.created`), language codes lowercase (`en`, `ar`), channel codes uppercase (`WHATSAPP`). Never change case in the UI.
- Do not run `git stash`. Write multi-line scripts with the Write tool, not bash heredocs containing backticks. Preserve CRLF when scripting edits. Run jest targeted, not the full suite.
- Other people and agents edit these files at the same time. Re-read a file right before you edit it, change only what your task needs, and never revert or reformat someone else's uncommitted changes.

## Phase 1: Inventory (no code yet)
List every form, dialog, filter bar, and table in scope. For each input, record one row:

| Screen (sidebar path) | Field | DB table.column | Today: typed / picked / derived | Depends on | Invalid combos possible | Proposed control |

Start with these known candidates (verify each; there will be more):
- Operations > Paused organizations: organization id is typed. Use an organization picker (name + id) showing only organizations not already paused for the chosen scope.
- Tenant Config > Add / Edit: tenant, channel, provider. Provider list filtered to providers that support the chosen channel.
- Quota > Tenant overrides: tenant, metric, period.
- Operations > Failover rules: source and target provider picked from existing providers; they must differ and support the same channel.
- Providers > Connections and Senders: provider, channel, `credential_ref` (pick or validate against the env/registry reference), sender address format validated per channel (E.164 for SMS/WhatsApp, email format for EMAIL).
- Providers > Import Twilio template: language picked from existing locales, template, sender.
- Templates, Broadcast Center / campaigns, test-send dialog: event, channel, language, recipient, variables (variable names picked from the template's placeholders, not typed).
- Ops Config / Jobs: keys picked from the registry, values validated against the key's type and regex (mostly exists; verify).

Rank the rows: P1 = can save bad data or cause a failed send; P2 = mistype risk only; P3 = cosmetic or label/coverage only. Put the table in your first report, then continue with P1 screens first.

## Standing rule: any free field backed by a table becomes an LOV
While working on ANY screen (even one not in the inventory, and even when you are there for another reason), if you find a free-text input whose value lives in another table, convert it to an LOV picker in the same change and add it to the inventory table. Common ones:
- `tenant_org_id` / organization id: pick from organizations (show name + id), filtered by the screen's rule (for example active only, not already configured).
- `provider_code`, `channel_code`, `event_code`, `language_code`, `template_code`, `plan_code`, `currency_code`, `metric`, `period_type`.
- Any `*_id` or `*_code` column with a foreign key or a lookup table (check the FK constraints and code tables in `database.types.ts`).
- Filter bars and search boxes too: a filter on tenant, provider, or channel is a picker, not a text box.
The LOV shows name and code, supports search for long lists, saves the exact stored value (same case), and keeps the `Label - [db_column]` label. If no list endpoint exists for that table, add a typed, tested, read-only one rather than leaving the field typed.
## Phase 2: Fix, one screen at a time
For each screen finish the fix, its test, and its i18n before you start the next one, so partial progress is always shippable.

Control design (same as the Routes dialog):
- Values come from an existing list endpoint. If it lacks fields you need, extend the endpoint (service-level flattening, typed, tested) rather than querying in the browser.
- Options show a human name AND the code/id (`order.created · Order created`, `Twilio Production · WHATSAPP`) so the operator can confirm the choice.
- Lists longer than ~30 items get a searchable LOV dialog with server-side search; short lists use `CmxSelect`.
- Offer only valid options: active providers for the chosen channel, verified accounts, approved revisions, organizations not already in the target state.
- Dependent fields are DERIVED from the primary choice, not chosen separately. A choice with exactly one valid answer is auto-selected and shown read-only. Changing a parent field clears its dependent fields.
- Dependent pickers stay disabled until the parent is chosen, with a hint saying what to pick first.
- Edit mode: if a saved value is now inactive or missing from the list, still show it (marked as inactive) instead of silently blanking it, and block Save until the operator picks a valid one.
- Empty lists show an inline hint that says why and what to do next (for example "No approved revisions; import one under Providers > Templates").
- Disable Save until the form is valid; show field-level errors with `CmxInput`/`CmxSelect` `error`, not only a toast.
- Keep free text only where nothing in the system can supply the value (a Twilio Content SID, a free-text reason). For those, trim, validate the format (regex per field), and show the expected format as a placeholder.
- The server stays the authority: never remove or weaken backend validation; the UI only prevents mistakes earlier.

## Labels and field coverage (owner requirement, every form, dialog, detail view, and table in scope)
- Every field label reads `Label - [db_column]`, for example `Event code - [event_code]`. Use `colLabel(key, column)`; move it to one shared helper in the feature (for example `notifications-hq/lib/col-label.ts`) and reuse it instead of copying it per file. The label text is i18n (EN and AR); the bracketed column is the real DB column (or the real API field when derived) and is never translated.
- When the column depends on context (platform vs private owner), the bracket shows the column that will actually be written (`platform_account_id` vs `private_account_id`).
- Fields that are filters only and are not stored (for example `registration_id` in the Routes dialog) say so in their hint.
- Table column headers follow the same rule (as on the Tenant Config table: `Tenant ID - [tenant_org_id]`).
- Show ALL meaningful fields of the record, not only the ones needed to create it. Check the generated types (`platform-api/src/database/database.types.ts`), the repository `select` list, and `notifications-hq.types.ts`. Editable fields go in the form; read-only ones (id, state, version, created/updated audit columns, derived values) go in a read-only block or an expandable "All fields" section.
- Secrets and credential payloads are never shown; show only that a credential exists and its reference.
- If an endpoint omits a useful, non-secret column, extend it (service-level, typed, tested).
- Empty values show a clear placeholder (for example `-`), not a blank. Dates use the existing HQ date helper.
- Keep every existing `Label - [db_column]` label the owner already added; do not remove or reword them.

## Tests (per changed screen)
Mock hooks and `CmxSelect` as in `tenant-routes-dialog.test.tsx`, and prove:
1. The saved request carries the picked values (exact case).
2. Invalid combinations cannot be chosen (the option is absent or Save is disabled).
3. Changing a parent field clears its dependents.
4. Every label has the `- [column]` suffix and the full field set renders.
5. The empty-list hint appears when the source list is empty.

## Deliverables
- Code for each fix with its tests, and EN + AR i18n for every new string.
- Updated `STATUS.md` and `RESUME_CONTINUATION.md` in the tenant repo, and QA scenarios in `Platform_Operations_Console/qa_test_guide.md` for each changed screen (sidebar path, what to click, expected result). Follow the `qa-guide-concurrent-merge` rule: re-read before writing and only add your own rows.
- Final report: the Phase 1 table updated with an "After" column and status (done / skipped with reason / needs migration), the list of any UNAPPLIED migrations, and what you did NOT verify.

## Verification (definition of done)
`npx tsc --noEmit` in `platform-web` and `platform-api`, eslint on changed files, targeted jest in both, i18n key parity check, and `npm run build` in `platform-web` (run it alone, never alongside another build). A screen is done only when all of these pass for it.

## Stop and ask the owner when
- A fix needs a migration (write it, mark it UNAPPLIED, stop).
- A fix would change an API contract another app uses (feature-flag reads, settings reads).
- The valid-values rule for a field is unclear from the code, the DB constraints, and the docs. Do not guess a business rule.

## Do not
- Do not redesign unrelated screens.
- Do not apply migrations or touch the remote database except read-only checks.
- Do not claim a screen works unless a test or a read-only check proves it; say what you did not verify.
