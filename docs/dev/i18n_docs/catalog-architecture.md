# CleanMateX Locale Catalog Architecture

## Canonical model

Locale messages live under:

```text
web-admin/messages/
  en/
  ar/
```

Each namespace is stored as a JSON file or as a namespace folder, never both.

Examples:

```text
web-admin/messages/en/common.json
web-admin/messages/en/orders/index.json
web-admin/messages/en/orders/detail.json
web-admin/messages/ar/common.json
web-admin/messages/ar/orders/index.json
web-admin/messages/ar/orders/detail.json
```

## Rules

- Keep the `en` and `ar` file trees aligned.
- Keep leaf-key sets aligned across both locales.
- Preserve existing fully-qualified key paths unless a collision fix is required.
- Keep `common` curated and small.
- Use `index.json` inside a namespace folder when root keys must stay at that namespace level.
- Do not import locale JSON directly in components or feature code.
- Use the server-side locale loader and `next-intl` hooks/helpers.

## Validation

Run:

```bash
npm run check:i18n
```

The validator checks:

- locale tree parity
- leaf-key parity
- duplicate keys
- file/folder namespace collisions
- invalid JSON and non-object roots
- placeholder parity
- oversize namespace warnings
