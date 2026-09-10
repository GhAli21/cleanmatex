# Rack & Bags Modal — i18n Keys

Added under `workflow.ready` in both `web-admin/messages/en/workflow.json` and `web-admin/messages/ar/workflow.json`.

## `workflow.ready.rackBags.*`

| Key | EN | AR |
|---|---|---|
| `title` | Rack & Bags | الرف والأكياس |
| `trigger` | Rack & Bags | الرف والأكياس |
| `customerRackWarning` | Customer has orders on rack(s): {rackCount} B:{bags} H:{hanging} | لدى العميل طلبات على الرف (الأرفف): {rackCount} أكياس:{bags} تعليق:{hanging} |
| `rack` | Rack | الرف |
| `rackPlaceholder` | e.g., Rack A-12 | مثال: رف A-12 |
| `locker` | Locker | الخزانة |
| `code` | Code | الرمز |
| `bags` | Bags | الأكياس |
| `hanging` | Hanging | معلّق |
| `custom` | Custom | مخصص |
| `submit` | Submit | إرسال |

## `workflow.ready.messages.*` (added)

| Key | EN | AR |
|---|---|---|
| `rackBagsLoadFailed` | Failed to load rack & bags details | فشل تحميل بيانات الرف والأكياس |
| `rackBagsSaveFailed` | Failed to save rack & bags details | فشل حفظ بيانات الرف والأكياس |
| `rackBagsSaved` | Rack & bags details saved | تم حفظ بيانات الرف والأكياس |

`npm run check:i18n` passed after these additions (parity, ICU placeholders, no orphans introduced).
