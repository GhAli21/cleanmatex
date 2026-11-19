---
name: i18n
description: Internationalization for CleanMateX web-admin, including EN/AR locale catalogs, next-intl usage, and RTL-safe UI patterns.
user-invocable: true
---

# Internationalization (i18n) & RTL

## CRITICAL Rules

1. **Check the glossary first — for every add AND every update, not new keys only** — `docs/dev/i18n_docs/GLOSSARY.md` (+ `glossary.en.json` / `glossary.ar.json`). If the concept a key represents already has an approved term there, that exact EN/AR wording is what the key's value must say — whether you're writing it for the first time or editing an existing key's text. Do not invent new phrasing for a concept the glossary already covers, and do not let an edit quietly drift away from the glossary term. If the concept isn't in the glossary yet but is a recurring platform concept (not a one-off label), add it there too (see the glossary's own "Adding a new term" steps) before writing or changing the locale value.
2. **Avoid duplicate keys as hard as possible** — search existing keys first under `web-admin/messages/en/**` and `web-admin/messages/ar/**` for the same concept before adding a new one, even under a different namespace. Reuse or rename rather than add a near-duplicate; if an update changes what a key means, check whether it should instead become (or merge into) a shared `common.*` key.
3. Reuse `common.*` for generic UI actions, statuses, labels, and feedback.
4. Update both locale trees with identical file paths and identical leaf keys.
5. A namespace may be a file or a folder, never both.
6. Use `index.json` inside a namespace folder when root keys must stay at that namespace level.
7. Do not import locale JSON directly in components or feature code.
8. Load locale messages on the server; consume them through `next-intl`.
9. Run `npm run check:i18n` after translation changes.
10. Preserve RTL behavior for Arabic surfaces.
11. **Mandatory feedback API:** when showing user-facing success/error/warning/info/confirm feedback, resolve the i18n string first, then call `cmxMessage` or `useMessage()` from `@ui/feedback`. See `docs/dev/rules/cmx-message.md`. Do not use legacy toast helpers or `alert()` in new/edited feature code.

## Workflow Checklist

Applies whether you are adding a brand-new key or updating/editing an existing one:

1. Check `docs/dev/i18n_docs/GLOSSARY.md` for the concept — reuse its approved EN/AR term if present.
2. Search the locale tree for an existing key covering the same concept before adding a new one — avoid duplicate keys as much as possible, even across namespaces.
3. Add or update the matching locale files under `web-admin/messages/en/**` and `web-admin/messages/ar/**`, using the glossary term where it applies.
4. Keep the namespace path stable unless you are fixing a real collision.
5. Use `useTranslations('namespace')` or `getTranslations('namespace')`.
6. Validate with `npm run check:i18n`.

## Glossary (check before naming or renaming anything)

- `docs/dev/i18n_docs/GLOSSARY.md` — canonical EN/AR term per platform concept, one key, no duplicates.
- `docs/dev/i18n_docs/glossary.en.json` / `glossary.ar.json` — the term pairs themselves.
- Applies to new keys **and** edits to existing keys' text — an update must not drift away from the
  glossary term either.
- Covers display copy only (what a locale file says). Never rename DB/code identifiers
  (`tenant_org_id`, `TenantContext`, etc.) to match a glossary term — those are internal vocabulary.
- Example: the concept "tenant" → glossary key `tenant` → EN "Organization", AR "المنشأة" — use these
  words in any key for that concept, new or edited, not "Tenant" / "مستأجر".

## Locale Catalog Structure

```text
web-admin/messages/
  en/
    common.json
    orders.json
    workflow.json
    reports.json
  ar/
    common.json
    orders.json
    workflow.json
    reports.json
```

Rules:

- Keep the physical `en` and `ar` trees aligned.
- Keep `common` small and curated.
- Use deeper nesting only when a namespace file becomes too large.
- Use `index.json` inside a namespace folder when root keys must stay at that namespace level.

## Translation Usage

```typescript
import { useTranslations } from 'next-intl'
import { cmxMessage } from '@ui/feedback'

const tCommon = useTranslations('common')
const tOrders = useTranslations('orders')

cmxMessage.success(tOrders('messages.saved'))
cmxMessage.error(tCommon('error'))
```

## User-facing feedback

- Labels/headings/buttons: i18n keys only (no toast).
- Operational feedback (save/delete/API result/permission denial toast): **`cmxMessage` / `useMessage()`** with an already-translated string.
- Field validation stays under the form field; persistent banners use `CmxSummaryMessage`; dedicated confirms use `CmxConfirmDialog` when that is the UX.

## ICU And Placeholder Rules

- Prefer ICU for dynamic counts and structured placeholders.
- Placeholder names must match across locales.

Example:

```json
"ordersSelected": "{count, plural, one {# order selected} other {# orders selected}}"
```

## Error Message Conventions

- Generic errors: `common.errors.*`
- Feature-specific errors: `<feature>.errors.*`
- Parameterized strings: `"loadFailed": "Failed to load {resource}"`

## Validation

```bash
npm run check:i18n
cd web-admin && npx eslint . --quiet
npm run build
```
