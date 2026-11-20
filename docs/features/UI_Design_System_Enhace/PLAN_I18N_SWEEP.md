# i18n sweep: English-only text in web-admin — plan

**Status:** DRAFT 2026-11-19, waiting for owner approval. No code changed yet.

**Goal:** every word a person sees in web-admin comes from `messages/en/**` and `messages/ar/**`, so Arabic users see no English. A lint rule then stops new English-only text.

**Skills to load before code:** `/i18n`, `/frontend`. Glossary first for every key: `docs/dev/i18n_docs/GLOSSARY.md`.

## Progress

| Batch | Status | Date | Result |
|---|---|---|---|
| 0 Plan and inventory | Done | 2026-11-19 | This file. |
| 1 Shared `src/ui` | Done | 2026-11-21 | Intentional `UI008` ignore comments on `cmx-spinner.tsx` (`sr-only` fallback), `cmx-language-switcher.tsx` (`English` endonym), and `cmx-sidebar.tsx` (`CleanMateX v1.0`). |
| 2 Public pages (sign-in family, sign-up, verify, forgot) | Done | 2026-11-21 | Localized `app/page.tsx`, `forgot-password`, `verify-email`, `register`, `register/tenant`, `register/tenant/success` (`messages/{en,ar}/auth.json`). |
| 3 Settings pages and `src/features/settings` | Done | 2026-11-21 | Localized `permissions`, `preferences`, `allsettings`, `branches/[id]`, `SettingsTable`, `FeatureFlagsSettings`, `explain-drawer`, `UserSettings`, `PlanLimitsSettings`, `BranchSettings`; raw `<table>` converted to `<Table>` + `CmxConfirmDialog` on `branches/[id]`. |
| 4 Subscription screen (`tenant-admin`) | Done | 2026-11-21 | Localized `tenant-admin-subscription-screen.tsx` (`settings.subscriptionPage.*`, `formatNumber`, locale dates). |
| 5 Catalog (pages and `src/features/catalog`) | Done | 2026-11-21 | Localized `pricing/[id]`, `customer-categories`, `price-history-timeline`, `bulk-import-modal`, `import-modal`, `preferences`, `pricing` (`messages/{en,ar}/catalog.json`, `CmxConfirmDialog`). |
| 6 Orders, workflow, customers, receipts | Done | 2026-11-21 | Localized `order-detail-error`, `split-confirmation-dialog`, `processing-item-row`, `processing-modal`, `order-items-list`, `receipt-preview`, `qa/[id]`; annotated `CleanMateX` brand in 6 print components + `UI001` in `order-details-print.tsx`. |
| 7 Dashboard widgets and the rest (users, auth, access, erp-lite, finance, inventory, api-docs) | Done | 2026-11-21 | Localized `cmx-permissions-inspector-panel` (`zIndex` scale + `CmxButton`), `dashboard-home-page`, `workflow-stats-widget`, `overdue-orders-widget` (`OrderStatusBadge` + `formatNumber`), `create-user-screen`, `voucher-post-preview-dialog`, `discount-rule-form-dialog`, `api-docs/page.tsx`; annotated `ERP-Lite` brand in 5 ERP-Lite files. |
| 8 Lint guard on everywhere, review, docs | Done | 2026-11-21 | `check:ui --all` reports **0 remaining `UI008` warnings** across all web-admin files; `check:i18n` PASS; `check:ui` on changed files 0 errors / 0 warnings. |

After every batch: update this table, `STATUS.md` and `RESUME_CONTINUATION.md`; QA steps only in `QA_TEST_GUIDE.md` → "i18n sweep".

## Inventory (measured 2026-11-19)

Measured with ESLint `react/jsx-no-literals` (text between tags) plus a scan of string props. Stories and tests excluded.

| Kind | Count | Files |
|---|---|---|
| Text between tags with real words (punctuation like `·`, `:`, `*`, `—` not counted) | 805 (682 without `jhtestui`) | 98 |
| String props with words: `title`, `label`, `placeholder`, `description`, `message`, `aria-label`, `alt` | about 120 | about 50 |
| `cmxMessage.*('English…')` | 12 | — |
| `setError('English…')` shown on screen | 6 | — |

Biggest areas: settings pages (126), subscription screen (66), catalog pages (59) and `src/features/settings` (55), `src/features/catalog` (43), `/register/tenant` (39), orders (32), customer detail (29), dashboard widgets (27), the public auth pages (60 together).

The earlier STATUS note said "about 20". It was counted only from the PR-05 `Alert` move.

## Rulings (proposed; the owner approves or changes)

1. **`/dashboard/jhtestui` (menu "JWT Test", `admin:manage`):**
   - It is a developer tool that shows tokens and session data, so it is not translated.
   - The lint rule skips that folder, with the reason written next to the setting.
   - Separate question for the owner: should it be in the production menu at all?
2. **Example placeholders:**
   - Examples of people or business data are translated, e.g. "John Doe", "My Laundry Business", "Muscat", "Birthday Gift", "At least 8 characters".
   - Code formats stay as they are, e.g. `PROD-00001`, `LOYALTY10`, `CUSTOM_PREF`, `UUID`, `OMR`, `VISA`, `HYPERPAY`. They show what to type, and they are the same in both languages.
3. **Where keys go:**
   - Each key goes in the namespace of the feature that owns the screen.
   - Generic words reuse `common.*`: Cancel, Save, Edit, Delete, Actions, Status, Type, Name, Code, Previous, Next, Refresh, Error, Success, Warning.
   - Search the existing keys before adding one. No near-duplicates.
4. **Glossary words win.** Example: "Tenant Settings" becomes the glossary term "Organization settings" / "إعدادات المنشأة". Terms that are missing and keep coming back are added to the glossary first.
5. **Arabic:**
   - Formal Modern Standard Arabic, matching the existing catalog.
   - Placeholders keep the same names in both languages.
   - Counts use ICU plurals.
   - After each batch I give the owner a short list of the new Arabic strings to read.
6. **Units of text:**
   - A sentence with values inside becomes one key with placeholders, e.g. `{count} orders`, not "orders" glued to a number.
   - A sentence split by a link or bold part uses `t.rich`.
7. **Feedback:**
   - The 12 English `cmxMessage` calls get keys.
   - The 6 `setError('…')` calls store a key or a translated string.
   - Rule `docs/dev/rules/cmx-message.md` stays as is.
8. **Lint guard (no new package):**
   - **Text between tags:** `react/jsx-no-literals` (already installed with `eslint-plugin-react`), with `allowedStrings` for punctuation and symbols.
   - **String props:** a `no-restricted-syntax` selector, `JSXAttribute[name.name=/^(title|label|placeholder|description|message|aria-label|alt)$/] > Literal[value=/[A-Za-z]{2,}/]`.
   - **Scope:** `src/**` and `app/**`, excluding stories, tests and `jhtestui`.
   - **Turned on folder by folder:** the rule goes on for a folder as soon as its batch is clean, so nothing slips back in. Batch 8 turns it on everywhere.
9. **Tests:** most tests mock `next-intl` to return the key. Tests in touched files that look for English text are changed to look for the key. New logic gets a test. Wording changes need none.
10. **No behaviour change:** this sweep only moves text into the catalog. Layout, logic and money display stay the same.

## Not in this plan

- English error text that comes from the server (API `error` fields shown as is). That needs a server-side message-code plan of its own.
- Date, number and currency formats (already locale-aware through `next-intl`/`Intl`).
- Two sign-up pages exist: `/register` (linked from sign-in) and `/register/tenant` (reachable by URL only). Both are translated here. Whether both should exist is an owner question.
- HQ (`cleanmatexsaas`) and the mobile apps.

## Each batch, step by step

1. Load `/i18n` + `/frontend`. Read the batch's files.
2. List the strings. For each one, check the glossary and search the existing keys. Reuse a key or add one, in EN and AR together.
3. Change the code to `useTranslations` / `getTranslations` (server components) / `t.rich`.
4. Update the tests in touched files.
5. Run:
   - `npm run check:i18n`;
   - `npx eslint <batch files> --quiet`;
   - `npx tsc --noEmit`;
   - the jest suites of the touched features.
6. Turn the lint rule on for the batch's folders. ESLint for those folders must show 0.
7. Every 2 batches, and at the end: `npm run build` (after checking that no other `next build` is running).
8. Update this table, STATUS, RESUME and `QA_TEST_GUIDE.md` → "i18n sweep" (page, what to look at, expected, in Arabic).

## Batch 8: verification, review, docs

- Lint rule on for all of `src/**` and `app/**`; full `npx eslint . --quiet` 0.
- `check:i18n`, typecheck, the touched jest suites, build.
- One fresh read-only reviewer, with this Review Focus:
  1. no English left on a screen in Arabic;
  2. glossary terms used;
  3. no duplicate keys;
  4. placeholders match between EN and AR;
  5. no changed behaviour.
- Fix Critical and Important findings, writing a failing test first.
- STATUS result section.
- `docs/dev/i18n_docs/` note on the lint guard.

## Risk

- **Size:** about 800 strings in about 100 files. Batches keep each diff reviewable.
- **Arabic quality** is the main risk. The owner reads the list after each batch.
- **Other sessions:** files another session has uncommitted (for example the File Util stage pages) are skipped until they are committed.
