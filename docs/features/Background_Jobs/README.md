# Background Jobs

One job platform for CleanMateX: pg-boss in the existing Supabase Postgres, one worker container (`cleanmatex/cmx-workers`), and HQ API (`cleanmatexsaas/platform-api`) consuming the notification delivery queues.

| File | Purpose |
|---|---|
| [DESIGN.md](DESIGN.md) | Approved architecture and plan (§10), review findings (§18–§19) |
| [STATUS.md](STATUS.md) | Current step, evidence, and what is next |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Owner checks per step: page, what to do, expected result |
| [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md) | Handoff for the next session or another assistant |

History: this replaces the I11 runtime plan in [`docs/pending_to_production/16_11_2026/`](../../pending_to_production/16_11_2026/I11_background_execution_EXPERT_REPLAN.md). Those files remain as history and the Progress Log.
