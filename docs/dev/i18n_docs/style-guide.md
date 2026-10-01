# Locale Style Guide

## Key rules

0. Check [GLOSSARY.md](./GLOSSARY.md) for the term — for new keys **and** when editing an existing
   key's text. Use its approved EN/AR wording for any concept it already covers (e.g. "Organization" /
   "المنشأة" for a tenant, never "Tenant" / "مستأجر"); an edit must not drift away from it either.
1. Search existing keys before adding new ones — avoid duplicate keys as much as possible, even across
   namespaces; reuse or rename rather than add a near-duplicate.
2. Reuse `common.*` for generic UI copy.
3. Keep the `en` and `ar` file trees aligned.
4. Keep placeholder names identical across locales.
5. Preserve existing fully-qualified key paths unless you are fixing a collision.

## Naming

- Prefer semantic names like `orders.table.columns.status`.
- Avoid component-specific names like `label1`.
- Keep error messages in `common.errors.*` or feature-local `errors.*`.

## Validation

```bash
npm run check:i18n
```
