# Mandatory: Use `cmxMessage` for User-Facing Feedback

**Status:** Mandatory for all `web-admin` UI work when applicable.

## Rule

When showing **user-facing operational feedback** in web-admin — success, error, warning, info, loading, promise progress, or imperative confirmations — **always use `cmxMessage`** (or `useMessage()`, which wraps it).

```ts
import { cmxMessage, useMessage } from '@ui/feedback'
```

Guide: `web-admin/src/ui/feedback/cmxMessage_developer_guide.md`  
Overview: `web-admin/src/ui/feedback/README.md`

## Required

| Situation | Use |
|-----------|-----|
| Save / submit / delete / action success | `cmxMessage.success(...)` or `useMessage().showSuccess(...)` |
| Action / API failure | `cmxMessage.error(...)` or `useMessage().showError(...)` |
| Non-blocking warning / info | `cmxMessage.warning(...)` / `cmxMessage.info(...)` |
| Async with loading → result | `cmxMessage.promise(...)` |
| Imperative yes/no confirm (not a dedicated dialog component) | `cmxMessage.confirm(...)` |
| Permission / gate denial toast | `cmxMessage.error(...)` / `cmxMessage.warning(...)` |

Pass **translated** strings: resolve via `useTranslations` / `getTranslations` first, then pass the result into `cmxMessage`.

## Not applicable (do not force `cmxMessage`)

| Situation | Prefer instead |
|-----------|----------------|
| Field-level / RHF-Zod validation under inputs | Form field `error` / `CmxFormField` |
| Persistent page banner / summary panel | `CmxSummaryMessage` |
| Dedicated confirm UI in a dialog | `CmxConfirmDialog` |
| Empty list / empty page copy | `CmxEmptyState` + i18n labels |
| Static labels, headings, button text | `next-intl` only (no toast) |
| Server logs / API error payloads (non-UI) | Structured logging / API error contracts |

## Banned for new / changed feature code

- `alert()`, `confirm()`, `window.alert`
- Raw Sonner / `toast()` calls from feature code
- Legacy helpers as the primary API: `showSuccessToast`, `showErrorToast`, `showInfoToast`, `cmxToast` from `@ui/components/cmx-toast` or deprecated `@ui/feedback` toast wrappers

Existing legacy call sites may remain until migrated; **do not add new ones**. Prefer `cmxMessage` / `useMessage` in all new and edited code.

## Quick examples

```ts
import { cmxMessage } from '@ui/feedback'
import { useTranslations } from 'next-intl'

const t = useTranslations('orders')
const tCommon = useTranslations('common')

cmxMessage.success(t('messages.saved'))
cmxMessage.error(result.error ?? tCommon('error'))

const ok = await cmxMessage.confirm({
  title: t('messages.confirmDeleteTitle'),
  description: t('messages.confirmDeleteBody'),
})
```

```ts
import { useMessage } from '@ui/feedback'

const { showSuccess, showError } = useMessage()
showSuccess(t('messages.saved'))
showError(tCommon('error'))
```
