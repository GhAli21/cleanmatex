# EN / AR Manual Verification

## Verify locale behavior

1. Switch from English to Arabic and confirm the page refreshes into the new locale.
2. Confirm `<html lang>` and `<html dir>` update correctly.
3. Confirm toast placement flips with RTL.
4. Confirm tables, dialogs, filters, and navigation remain usable in Arabic.

## Verify catalog integrity

1. Run `npm run check:i18n`.
2. Confirm there are no direct locale JSON imports in feature code.
3. Confirm new keys appear in matching locale files under `web-admin/messages/en/**` and `web-admin/messages/ar/**`.
