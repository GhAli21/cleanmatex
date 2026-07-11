# Session Activity — Manual QA Checklist

## Setup

1. Sign in to web-admin dashboard (EN locale first).
2. Confirm top bar shows **ScrollText** icon (Session activity) **before** the Notifications bell.

## Core capture

- [ ] Trigger a payment or form error toast → toast appears **and** Session Activity badge increments
- [ ] Open Session Activity → entry shows title, relative time, optional route
- [ ] Expand/click row → description visible if present; unread dot clears for that row
- [ ] Mark all as read → badge clears
- [ ] Copy message → clipboard matches; success toast may appear (not logged)
- [ ] Clear log (with ≤10 entries) → empty state with copy distinguishing from Notifications
- [ ] Fire >10 errors then Clear → confirm dialog appears; cancel keeps entries; confirm clears

## Filters & exclusivity

- [ ] Filters All / Errors / Warnings work
- [ ] Open Session Activity then open Notifications → Session Activity closes (and vice versa)
- [ ] Notification badge count is independent of Session Activity badge

## Auth / tenant

- [ ] Switch tenant → Session Activity empty after reload
- [ ] Sign out / sign in → Session Activity empty

## Promise path

- [ ] Flow using `cmxMessage.promise` that fails → error appears in Session Activity

## Toast UX

- [ ] Error toast stays until dismissed (sticky) and shows close (X) button
- [ ] Warning auto-dismisses ~7s; success ~4s

## i18n / RTL

- [ ] Switch to Arabic → panel strings translated; layout RTL-safe; panel anchors correctly

## Regression

- [ ] Notifications bell still loads unread list and mark-all-read
- [ ] Legacy payment `showErrorToast` still shows toast and appears in Session Activity
