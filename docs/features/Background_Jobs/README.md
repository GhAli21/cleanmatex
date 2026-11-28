# Background Jobs

One job platform for CleanMateX: pg-boss in the existing Supabase Postgres, one worker container (`cleanmatex/cmx-workers`), and HQ API (`cleanmatexsaas/platform-api`) consuming the notification delivery queues.

| File | Purpose |
|---|---|
| [DESIGN.md](DESIGN.md) | Approved architecture and plan (§10), review findings (§18–§19) |
| [STATUS.md](STATUS.md) | Current step, evidence, and what is next |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Owner checks per step: page, what to do, expected result |
| [RUNBOOK.md](RUNBOOK.md) | Operations: what runs where, HQ → Ops → Jobs, alerts, environment, deploys, pg-boss upgrade, incidents |
| [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md) | Handoff for the next session or another assistant |
| [STEP5_PLAN.md](STEP5_PLAN.md) … [STEP9_PLAN.md](STEP9_PLAN.md) | Detail and evidence of each step (5 notifications, 6 sweeps, 7 HQ screen + alerts, 8 old plumbing removed, 9 proof + soak) |

History: this replaces the I11 runtime plan in [`docs/pending_to_production/16_11_2026/`](../../pending_to_production/16_11_2026/I11_background_execution_EXPERT_REPLAN.md). Those files are marked SUPERSEDED (28 Nov, step 9 docs fold); the I11 PLAN file stays as the dated Progress Log.
