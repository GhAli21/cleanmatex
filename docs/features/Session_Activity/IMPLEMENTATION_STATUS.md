# Session Activity — Implementation Status

**Last updated:** 2026-07-11  
**Version:** v1

## Done

- [x] `lib/session-activity` store, recorder, redaction, config
- [x] Unit tests for store / recorder / redaction
- [x] Hook in `cmx-message.showDirect` + toast/alert promise paths
- [x] Skip inline/console capture
- [x] Bridge `@ui/components/cmx-toast` → `cmxMessage`
- [x] Toast durations wired to `message-config`; sticky errors; Toaster `closeButton`
- [x] `SessionActivityTrigger` + panel in top bar
- [x] Mutual-close with NotificationBell
- [x] EN/AR `sessionActivity.json`
- [x] Clear on signOut / switchTenant
- [x] Feature docs + folders_lookup entry

## Deferred (Phase 3)

- [ ] sessionStorage rehydration keyed by tenant+user
- [ ] Full-page activity route + access contract
- [ ] Bulk migrate remaining toast call sites (bridge covers capture today)
- [ ] Optional Info filter if `forceSessionLog` info becomes common

## Known gaps / debt

- Legacy toast has no `showWarningToast` API (warnings only via `cmxMessage`)
- Direct Sonner usage outside bridged helpers would bypass capture (none found beyond toast-method)
