---
name: i18n
description: Internationalization for CleanMateX web-admin, including EN/AR locale catalogs, next-intl usage, and RTL-safe UI patterns.
user-invocable: true
---

# Internationalization (i18n) & RTL

## CRITICAL Rules

1. **Check the glossary first — for adds AND updates** — `docs/dev/i18n_docs/GLOSSARY.md` (+ `glossary.en.json` / `glossary.ar.json`). Reuse the approved EN/AR term for any concept it already covers, whether you're writing a key for the first time or editing an existing one's text; don't invent new phrasing and don't let an edit drift away from the glossary term. Add a new, recurring concept to the glossary before keying it.
2. **Avoid duplicate keys as much as possible** — search existing keys first under `web-admin/messages/en/**` and `web-admin/messages/ar/**` for the same concept before adding a new one, even under a different namespace.
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
- Applies to new keys **and** edits to existing keys' text.
- Covers display copy only — never rename DB/code identifiers (`tenant_org_id`, `TenantContext`, etc.).
- Example: concept `tenant` → EN "Organization", AR "المنشأة" — not "Tenant" / "مستأجر".

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

const tCommon = useTranslations('common')
const tOrders = useTranslations('orders')
```

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
