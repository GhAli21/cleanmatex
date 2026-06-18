---
name: i18n
description: EN/AR i18n and RTL rules for CleanMateXSAAS Platform HQ. Use only when adding/changing UI text, translation keys, RTL-aware layout, locale-aware formatting, or bilingual DB display.
user-invocable: true
version: 1.1.0
effort: low
references:
  - @.claude/skills/i18n/reference.md
  - @.claude/docs/frontend_standards.md
  - @.claude/docs/ui_blueprint.md
  - CLAUDE.md
agents: []
---

# i18n Skill — CleanMateXSAAS Platform HQ

## Purpose

Apply bilingual English/Arabic support with next-intl and RTL-safe UI. Keep this skill compact; read `reference.md` only when examples are needed.

## Hard Rules

1. Search existing keys in `platform-web/messages/` before adding new ones.
2. Reuse `common.*` for shared actions, labels, statuses, and feedback.
3. Add/update every new key in both `en.json` and `ar.json`.
4. Do not hardcode user-facing strings in components.
5. Preserve Arabic RTL layout behavior.
6. Run `npm run check:i18n` after translation changes.
7. If layout changed, verify Arabic forms, tables, navigation, modals, and dropdowns.

## Minimal Workflow

```text
1. Search existing keys.
2. Reuse common or feature key if available.
3. Add missing key to en.json and ar.json.
4. Use tCommon for common keys and feature t() for feature keys.
5. Add RTL classes only where direction matters.
6. Run npm run check:i18n.
7. Report keys, files, RTL impact, and validation result.
```

## Key Placement

Common keys:

```text
save, cancel, delete, edit, create, update, search, filter, clearFilters,
loading, error, success, actions, status, date, import, export, close,
optional, required, itemCount, warningCount, errorCount
```

Feature namespaces:

```text
tenants, billing, analytics, platformSettings, support, errors
```

## Usage Pattern

```typescript
import { useTranslations } from 'next-intl';

const tCommon = useTranslations('common');
const t = useTranslations('tenants');

<CmxButton>{tCommon('save')}</CmxButton>
<h1>{t('title')}</h1>
```

Rules:

- Shared label/action/status → `tCommon('key')`.
- Feature-specific text → `t('key')`.
- Shared errors → `useTranslations('errors')`.
- Domain errors → feature namespace `errors.*`.

## Translation Pattern

```json
// en.json
{ "tenants": { "createSuccess": "Tenant created successfully" } }
```

```json
// ar.json
{ "tenants": { "createSuccess": "تم إنشاء المستأجر بنجاح" } }
```

## RTL Rules

```tsx
<div className="text-left rtl:text-right" />
<div className="ml-4 rtl:ml-0 rtl:mr-4" />
<ChevronRight className="rtl:rotate-180" />
```

Rules:

- Rotate only directional icons: arrows, chevrons, next/previous indicators.
- Do not rotate universal icons: user, settings, calendar, status, warning.
- Use `rtl:` utilities only where layout direction changes.

## Bilingual DB Display

DB bilingual convention:

```text
name / name2
description / description2
```

Display by locale:

```typescript
const label = locale === 'ar' ? row.name2 : row.name;
```

Do not drop either language from API responses unless the contract explicitly allows it.

## Validation

```bash
cd platform-web
npm run check:i18n
```

Run `npm run build` when UI/routing/layout changed.

## Final Response Contract

```text
- Keys reused or added
- Files changed
- RTL impact
- Validation result
- Missing Arabic review or follow-up, if any
```
