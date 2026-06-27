# Locale Catalog Checklist

- [ ] Add or update matching locale files under `web-admin/messages/en/**` and `web-admin/messages/ar/**`
- [ ] Reuse `common.*` when the copy is generic
- [ ] Keep placeholder names aligned across locales
- [ ] Keep the locale file tree aligned
- [ ] Run `npm run check:i18n`
- [ ] Run `cd web-admin && npx eslint . --quiet` if UI code changed
- [ ] Run `npm run build`
