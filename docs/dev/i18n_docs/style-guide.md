# Locale Style Guide

## Key rules

1. Search existing keys before adding new ones.
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
