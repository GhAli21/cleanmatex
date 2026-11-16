# Roadmap to Production — CleanMateX

**Written:** 17 Nov 2026 · **Based on:** this folder's files 01–13 (item codes such as `S0a` and `I11a` point to them).
**Goal:** go from demo to paying laundries safely: first a closed pilot, then public marketing.
**Rule for every phase:** a phase is done only when its **exit check** passes. Do not start marketing (Phase 6) because the calendar says so.

Who does what: **Dev** = engineering work (you or an assistant). **Owner** = only you can do it: apply migrations, accounts, legal, decisions, browser QA, deploy.

Durations are rough estimates for one owner plus an assistant. They are not promises.

**Evidence authority:** every production-state or go/no-go claim in this roadmap requires a dated, read-only check against remote Supabase. Local database output is development-only and cannot close a step or authorize a production action.

**Execution control:** use [Phase_0_to_4_Go_No_Go_Register.md](Phase_0_to_4_Go_No_Go_Register.md) for the single owner/date/status/evidence view before executing a Phase 0–4 task.

---

## Phase 0 — Close the open doors (week 1) · nothing else starts first

The live database is open to anyone holding the public key. This comes before everything else.

**Execution plan for 0.1–0.4:** [S0_privilege_lockdown_PLAN.md](S0_privilege_lockdown_PLAN.md). Each task there updates that plan's Progress Log before the next task starts. Steps 0.5 and 0.6 stay Owner actions.

| Step | What | Who | Item |
|---|---|---|---|
| 0.1 | Migration A: revoke INSERT, UPDATE and DELETE (and SELECT where not needed) from `anon` and `authenticated` on all `sys_*` and `hq_*` tables that have row security off; enable RLS with read-only policies where the browser reads catalogs | Dev writes → Owner applies | S0a |
| 0.2 | Migration B: revoke EXECUTE on every SECURITY DEFINER function from `anon` and `PUBLIC`; grant back only what the browser really calls; change default privileges so new functions start closed; set `search_path` on definer functions | Dev writes → Owner applies | S0b, S0d |
| 0.3 | Migration C: recreate the 7 SECURITY DEFINER views with `security_invoker` (or revoke them) | Dev writes → Owner applies | S0c |
| 0.4 | DB test that fails if any anon-writable table or anon-executable definer function exists; add it to CI | Dev | S0b |
| 0.5 | Supabase Auth: leaked-password protection on. Secure password change (S5) is not needed now. | Owner | S0d |
| 0.6 | Re-run the Supabase security advisor, then smoke-test login, new order, HQ screens and the public tracking page | Owner + Dev | — |

**Exit check:** advisor shows 0 `rls_disabled_in_public` with write grants, 0 anon-executable definer functions, and the app still works end to end.

---

## Phase 1 — Make the platform run by itself (weeks 1–2)

| Step | What | Who | Item |
|---|---|---|---|
| 1.1 | Fix job schedules in HQ › Ops › Jobs (outbox every minute, sweeps hourly or daily, valid cron), then make sure every enabled job has a `cron.job` row | Dev + Owner | I11a |
| 1.2 | Add the **trial-expiry job** (decide: when a trial ends → read-only + banner, or suspend) | Owner decides → Dev builds | B1 |
| 1.3 | Clear the demo outbox backlog (55 QUEUED) before the sender starts | Owner | D13 |
| 1.4 | Error monitoring: Sentry on web-admin and platform-web, with PII scrubbing | Dev | I4 |
| 1.5 | Email: verify the sending domain in Resend (SPF, DKIM, DMARC); set keys for the tenant app and HQ; test password reset | Owner | I6 |
| 1.6 | Set `HQ_ENCRYPTION_MASTER_KEY`, then encrypt registry secrets | Owner | I7 |
| 1.7 | CI: HQ test and build jobs; DB-integration suite nightly; fix the known red tests | Dev | I9, I10 |
| 1.8 | Uptime checks plus the HQ alert webhook | Owner | I5 |

**Exit check:** `cron.job_run_details` shows every enabled job ran successfully for 48 hours; a deliberately expired demo trial changes state; one test error shows up in Sentry; one reset email arrives.

---

## Phase 2 — Production environment and data (week 2)

| Step | What | Who | Item |
|---|---|---|---|
| 2.1 | **Decision:** a new production Supabase project (recommended) or clean the current one | Owner | I2 |
| 2.2 | If new: apply all migrations from scratch on a staging copy first, and fix anything that does not replay cleanly | Dev + Owner | I2 |
| 2.3 | Backups: confirm daily backups plus PITR on the plan; run **one restore drill** and record it | Owner | I3, N7 |
| 2.4 | Production env variables for web-admin, platform-api, platform-web and workers; build memory flag | Owner | I8 |
| 2.5 | Data cleanup list (if you reuse the current project) | Owner | file 13 |
| 2.6 | Deploy all three apps together from the committed code | Owner | I1, H1 |

**Exit check:** production has no demo tenants or test data, a restore drill is logged, and all three apps are deployed from one commit.

---

## Phase 3 — Legal and commercial basics (weeks 1–3, start in parallel with Phase 0)

These have outside lead times, so **start them on day 1**.

| Step | What | Who | Item |
|---|---|---|---|
| 3.1 | Lawyer: Terms of Service, Privacy Policy, DPA (Oman, UAE, Bahrain; Saudi Arabia later) in EN/AR | Owner | B4 |
| 3.2 | Publish them on marketing-web and in the app; sign-up checkbox that stores the version and time accepted | Dev | B4 |
| 3.3 | Data residency statement (Supabase region) in the Privacy Policy | Owner | B5 |
| 3.4 | Tax adviser session: the decisions in 06-T7, your own VAT on subscription invoices (B8), and current UAE and Oman e-invoicing dates (T2) | Owner | T7, B8, T2 |
| 3.5 | WhatsApp: Meta business verification, sender approval, EN/AR templates (order created, ready, delivered); SMS sender IDs per country | Owner | N1, N3 |
| 3.6 | Customer opt-in rule at order intake (lawful basis recorded) | Owner decides → Dev | N4 |
| 3.7 | Customer data rights: an "anonymize customer" action that keeps order and finance records | Dev | U4 |

**Exit check:** legal pages are live and acceptance is stored; at least the WhatsApp templates are approved; the adviser's answers are written into `Tax_Config/KIT_FACTS.md`.

---

## Phase 4 — Prove the product in a browser (weeks 2–4)

The code is largely finished; what is missing is proof that it works for a real user.

| Step | What | Who | Item |
|---|---|---|---|
| 4.1 | **"New laundry from zero"** script: sign-up → Setup Health all green → first order → payment → receipt → ready → delivered. Write it as the customer onboarding checklist | Owner + Dev | B9, Q1 |
| 4.2 | Fix the onboarding gaps it finds: tax setup confirmation (T3), Express rule (SP5), emirate per UAE branch (T10), tax periods (T11), ERP-Lite account mapping (P12), good business-type templates (C2) | Dev | — |
| 4.3 | HQ configuration: Edit Policy rules for speed, discount and price; `INIT_MOBILE_RETAIL`; HQ role matrix and grants | Owner | E3, W6, S4 |
| 4.4 | Browser QA **Blocker** rows Q2–Q11 and Q12, EN and AR (the tester bot can run most of them) | Owner (+ bot) | file 12 |
| 4.5 | Triage and fix what QA finds; repeat 4.4 for failed rows | Dev | — |
| 4.6 | Real hardware at the pilot store: receipt printer, label printer, scanner, cash drawer, tablet | Owner | Q20, O3 |
| 4.7 | Native Arabic review of all screens | Owner (reviewer) | Q19 |

**Exit check:** Q1 passes with no help from a developer; every Blocker QA row in file 12 passes or has a fixed retest.

---

## Phase 5 — Closed pilot (weeks 5–8)

1–3 friendly laundries in **Oman, UAE or Bahrain** (not Saudi Arabia: ZATCA Phase 2 is not built). Counter payments only. You invoice them by hand.

| Step | What | Who | Item |
|---|---|---|---|
| 5.1 | Run with `TENANT_GUARD_MODE=log` plus a report file; read the report weekly | Owner + Dev | S1 |
| 5.2 | Workflow soak on the pilot profiles; Order Edit V2 pilot (WP19) | Owner | W1, E5 |
| 5.3 | Weekly review: Sentry errors, job runs, outbox failures, slow pages, support messages | Owner + Dev | — |
| 5.4 | Support line: one WhatsApp number plus email, with a response time you can keep | Owner | B6 |
| 5.5 | Load test on staging (~50k orders in one organization; main screens and end-of-day reports) | Dev | I12 |
| 5.6 | Pentest-style review of public routes plus rate limits on sign-up, booking and tracking | Dev | S11 |
| 5.7 | Data integrity: composite tenant FKs on order and money tables first | Dev writes → Owner applies | S2 |

**Exit check:** 4 weeks without data loss or a cross-tenant incident; the tenant-guard report is clean, so switch to `enforce` (S1); pilot laundries would recommend it.

---

## Phase 6 — Ready to sell publicly (weeks 8–12)

| Step | What | Who | Item |
|---|---|---|---|
| 6.1 | **Subscription billing**: choose a GCC gateway with recurring cards, then build checkout, auto-renew, dunning retry and dunning email | Owner chooses → Dev | B2, B3 |
| 6.2 | Pricing page = HQ plans = feature-flag mappings; currency and VAT shown correctly | Owner + Dev | B7, B8 |
| 6.3 | HQ offboarding: export data, suspend, delete after the retention period | Dev | H4 |
| 6.4 | Simple CSV import of customers and prices for new laundries | Dev | H13 |
| 6.5 | Remove dead HQ system-code features. MFA (S7) is not needed now. The branch pricing PATCH (S10) is already closed. | Dev | H10 |
| 6.6 | Runbook owners named; an "app down / DB down / payments stuck" page | Owner | I13 |
| 6.7 | Marketing site: EN/AR copy check, lead form → HQ, analytics with consent | Owner + Dev | B10 |

**Exit check:** a stranger can sign up, pay for a plan, set up, and run a day of orders without contacting you.

---

## Phase 7 — Grow markets and features (after launch)

Order by demand from real customers:

1. **Online payments for laundries' customers**: a real gateway adapter (Thawani/Tap in Oman, Network/Tap in the UAE, …) (P1), then settlement automation (P2).
2. **Saudi Arabia**: ZATCA Phase 2 (T1) plus tax-document cancel/supersede (P3). Only then market there.
3. **Mobile apps**: write a STATUS per app, add crash reporting, publish to the stores, test on devices (file 11).
4. **Hardening**: remaining DB integrity (S2, S3), role change revokes sessions (S8), the role-rank reset rule (S9), cmx-api session check (S6).
5. **Product**: customer identity across laundries (U3), public quote API (SP6), parked Check-policy codes (W4), analytics and support PRDs (H13).
6. **Yearly ops**: confirm Islamic holidays and National Days (SP1, SP2); review tax kit facts.

---

## Critical path at a glance

```
Day 1 ─┬─ Phase 0 (security) ──► Phase 1 (jobs, monitoring, email) ──► Phase 2 (prod env, backups) ─┐
       └─ Phase 3 (legal, WhatsApp, tax adviser — long lead times) ─────────────────────────────────┤
                                                                       Phase 4 (onboarding + QA) ◄──┘
                                                                              │
                                                                       Phase 5 (closed pilot, 4 wks)
                                                                              │
                                                                       Phase 6 (billing, public launch)
                                                                              │
                                                                       Phase 7 (gateways, Saudi Arabia, apps)
```

**Earliest realistic dates if nothing slips:** pilot starts around week 5; public launch around week 12.

## Keeping this roadmap current

- Tick a step by adding ✅ and the date in its row. When a phase exit check passes, write the date under the phase title.
- New findings go into the matching domain file (01–13) first, then into a phase here.
- When asked "what's next", answer from the first phase whose exit check has not passed.
