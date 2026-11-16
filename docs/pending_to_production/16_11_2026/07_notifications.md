# 07 — Notifications (Notification Hub and Platform Ops Console)

Code is complete in both repos (A1–A8, A10, R0–R14, pick-don't-type). What is left is operator setup, deploy and QA. Sources: `docs/features/Notification_And_Communication_Hub/RESUME_CONTINUATION.md` §7, `OWNER_REMAINING_WORK_GUIDE.md`, `Platform_Operations_Console/STATUS.md`.

| # | Item | Priority | What to do |
|---|---|---|---|
| N1 | **Live provider setup.** The demo tenant had no provider accounts, senders, template registrations or routes. Needed: a Twilio (or other) account, a WhatsApp sender approved by Meta, approved WhatsApp templates (EN and AR) for order created, ready and delivered, and an SMS sender ID registered in each country. | Blocker | Runbook 03 and `Setup_And_Config/13_twilio_waba_and_template_approval.md`. Meta and sender-ID approval can take days or weeks, so **start now**. |
| N2 | **Email domain.** A Resend 403 was seen; probably the from-domain is not verified. Set `RESEND_WEBHOOK_SECRET` and the Resend webhook. | Blocker | Same as file 03, I6. |
| N3 | **Arabic body of `order.created.default` v2**, and the matching approved Arabic Twilio Content template. | Blocker for Arabic-speaking customers | Templates → Add Version. |
| N4 | **Customer opt-in.** 0 opted-in customers. WhatsApp marketing needs opt-in, and transactional messages need a lawful basis. | Blocker | Decide the default opt-in at order intake, and record consent (ties to file 01, B4). |
| N5 | Deploy HQ, then re-QA T18, T19, T22, T23, T42, the read-only-role check, and pick-don't-type PDT1–PDT33. | Blocker | file 12 |
| N6 | Staging-only rows: T1–T3, T5–T8, T10–T12, T20–T21, T26–T28, T30–T32, T35–T37. | Before public launch | Run them, or mark each "not run, reason". |
| N7 | Restore drill D1–D6 (Redis plus DB restore without double-sending). | Before public launch | file 03, I3 |
| N8 | Fix the two stuck demo outbox rows. `ntf-reconcile-outbox` last run FAILED. | Blocker | `/ops/jobs` |
| N9 | Owner decisions D1–D5: second real provider; who may view the tenant Permissions catalog; the dead Filters button on HQ Settings › Audit Trail; push sweep on or off; cron wording. | Before public launch | Decide, or park them in `Skipped_On_Purpose.md`. |
| N10 | Per-key config: only `ntf.hq.resend.from_email` reads through the resolver; the other keys stay `ENV_OVERRIDES_DB`. | After launch | Convert one key at a time. |
| N11 | Ops screens were never browser-tested; their Arabic copy needs native review. | Before public launch | file 12 |
| N12 | Cost control: check quota caps per plan (`sys_ntf` quota) before customers can send campaigns. | Before public launch | Set plan quotas and a WhatsApp cost alert. |
