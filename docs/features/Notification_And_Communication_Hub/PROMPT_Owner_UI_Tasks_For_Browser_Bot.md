# Prompt for the owner's browser/UI bot: Notification Hub owner tasks in the HQ console

Written 2026-10-17. Give everything under the line to a bot that can drive a browser. The bot does NOT need repository access. It must follow the safety rules at the end.

---

## Context
You operate the CleanMateX HQ console (web app, https://hqsaas.cleanmatex.com, language switch EN/AR, sign in with the account the owner gives you). Do the tasks below IN ORDER, exactly as written, in the browser UI only. Do not run SQL, do not call APIs directly, do not edit code. Report evidence (what you saw, and a screenshot or the visible text) for every task.

## Task 1: delete the 6 QA test quota overrides on the Saudi demo tenant
Tenant id: `c9ac29d1-219c-4a3a-8887-f860550c32be`.
1. Sidebar group "Notification & Comm Hub" > **Quota Management** > tab **Tenant Overrides**.
2. Search/filter for that tenant id. You must see exactly 6 rows and every one has the reason text `QA retest test data - generous cap`.
3. If the count is not exactly 6, or any row has a different reason, or any row belongs to another tenant: STOP, delete nothing, and report what you see.
4. Otherwise delete those 6 rows one by one (row menu or "Remove cap"/delete, confirm each dialog).
5. Reload the page and confirm no override remains for that tenant. Record the result.

## Task 2: create three limited HQ test users
Sidebar group **HQ Auth / RBAC**.
A. First create three roles in **HQ Roles** (open Roles, "New role"). Tick ONLY the permissions listed:
   - Role `QA Ops Read`: `hq_ops:read`
   - Role `QA Ops Config No Secrets`: `hq_ops:read` and `hq_ops:manage_config` (do NOT tick `hq_ops:manage_secrets`)
   - Role `QA Notifications Read`: `hq_notifications:read`
   If a permission is not listed in the picker, stop and report it; do not tick a similar-looking one.
B. Then in **HQ Users** (New user) create three users and assign one role each. Use the email pattern `qa+opsread@<owner domain>`, `qa+opsconfig@<owner domain>`, `qa+notifread@<owner domain>`. The owner gives you the domain and a password policy. Never write passwords in your report; say only "set" or "invite sent".
C. Verify: sign in as each user (private window) and confirm what they can and cannot open:
   - `QA Ops Read` user: can open Operations > Jobs/Config/Setup Health (read-only); every edit/run button is hidden or disabled.
   - `QA Ops Config No Secrets` user: can edit non-secret config values; cannot reveal or edit a secret value (secret keys are blocked).
   - `QA Notifications Read` user: can open Notification screens read-only; no Add/Edit/Activate/Suspend/Pause/Test-send buttons.
   Report each observation as PASS or FAIL with the exact thing you saw. Sign out of those users afterwards.

## Task 3: check the job schedules
Sidebar > Operations > **Jobs**. Report the table for jobs whose name starts with `ntf-`: name, schedule, enabled, last run status, and whether the "drift" flag shows. Expected: `ntf-outbox-processor` every minute; `ntf-campaign-scheduler` every 5 minutes (a deliberate override, may show as an override not as drift); `ntf-outbox-retry`, `ntf-quota-rsv-sweep`, `ntf-reconcile-outbox` every 5 minutes; `ntf-retention-sweep` daily 04:00; `ntf-sweep-stale-push-subs` weekly Sunday 03:00, enabled. Change NOTHING; only report differences.

## Task 4: run the QA scenarios
The owner gives you the file `qa_test_guide.md` (docs/features/Platform_Operations_Console/qa_test_guide.md). Run scenarios T1 to T46 in order. For each: PASS, FAIL or BLOCKED, one line of evidence, and for FAIL the exact steps and what you saw. Skip any step that would send a real message to a real customer; use only the test recipients and the demo tenant named in the guide. Do not mark a scenario PASS from memory; execute it.

## Task 5 (human only, do not attempt): restore drill rehearsal on staging and assigning runbook owners. List them in your report as "left for the owner".

## Report format
One table per task: item, expected, actual, PASS/FAIL/BLOCKED, evidence. End with a short list of anything unexpected.

## Safety rules
- Never reveal, copy or type secret values (tokens, keys, passwords) into your report or any text field.
- Touch only what a task names. Do not change other tenants, other users, routes, templates, providers, config values or jobs.
- If a screen differs from these instructions, or a confirmation dialog mentions something you did not expect, stop that task and report; do not improvise.
- Do not send test messages unless a QA scenario explicitly says so, and then only to the allow-listed test recipient.
