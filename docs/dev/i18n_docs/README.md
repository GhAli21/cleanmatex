# CleanMateX i18n Documentation

Internalization (i18n) documentation for the CleanMateX web-admin application. Supports English (en) and Arabic (ar) with RTL layout.

## Documents

| Document | Description |
|----------|-------------|
| [style-guide.md](./style-guide.md) | Developer style guide: key naming, interpolation, pluralization, formatting, error messages, Arabic-specific rules |
| [common-keys-reference.md](./common-keys-reference.md) | List of all common keys with usage examples |
| [migration-checklist.md](./migration-checklist.md) | Step-by-step checklist for i18n migration |
| [manual-verification-en-ar.md](./manual-verification-en-ar.md) | How to manually verify EN and AR flows |
| [files-changed-i18n-plan.md](./files-changed-i18n-plan.md) | List of all files created or modified during i18n plan implementation |
| [future-suggestions.md](./future-suggestions.md) | Recommendations for future i18n work |

## Quick Reference

- **Translation files:** `web-admin/messages/en.json`, `web-admin/messages/ar.json`
- **Parity check:** `npm run check:i18n` (run before committing)
- **Usage:** `useTranslations('common')` for shared keys; `useTranslations('orders')` for feature keys

## See Also

- [.cursor/rules/i18n.mdc](../../.cursor/rules/i18n.mdc) — Cursor rules for i18n
- [.claude/skills/i18n/SKILL.md](../../.claude/skills/i18n/SKILL.md) — i18n skill
