# 11 — Mobile Apps (`cmx_mobile_apps`)

There are three Flutter apps: `customer_app`, `staff_app` and `driver_app`, plus shared packages. No STATUS or readiness file was found for them, so this file is based on what other programs say about mobile, not on a mobile audit.

| # | Item | Priority | Evidence | What to do |
|---|---|---|---|---|
| M1 | **No mobile release yet.** "Mobile release still pending." | Decide | HFC `current_status.md` | Decide whether the first pilots need an app. The web app plus WhatsApp notifications and public tracking (`/track/[token]`) may be enough. If an app is needed: store accounts (Apple, Google), signing, privacy labels, and review time. |
| M2 | Customer app: the order payment summary was never opened on a device. | Before mobile launch | Fin View `followups_by_user.md` §3 | — |
| M3 | Customer app booking and retail changes (provider, screen, draft model, l10n) were in progress on 13 Nov. | Before mobile launch | git status 13 Nov | Test booking → order on a device. |
| M4 | No crash reporting found for the apps. | Before mobile launch | — | Add Firebase Crashlytics or Sentry. |
| M5 | Driver app versus the web delivery flow (routes, proof of delivery, OTP). The web flow is signed off (S10). The driver app state is not documented. | Before mobile launch | — | Write a short STATUS for each app with what works today. |
| M6 | Push notifications: the Notification Hub has a push sweep job (decision D4 is open). | Before mobile launch | NTF owner guide | — |

**Suggestion:** launch web-first. Treat the apps as a second release with their own STATUS files and QA.
