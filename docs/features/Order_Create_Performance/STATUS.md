# Order Create Performance — Status

Plan: [PLAN.md](PLAN.md)

| Phase | State | Notes |
|---|---|---|
| Analysis | ✅ 2026-11-28 | whole Submit path traced (browser, proxy, route, checks, transaction, DB triggers, after commit) |
| P0 Measure | ⏳ not started | step timings + concurrency harness |
| P1 Correctness under load | ⏳ waits for D1, D2 | F1 pool, F2 order number, W2 extra call |
| P2 Shorter request | ⏳ | W3–W6 |
| P3 Fewer statements | ⏸ only if numbers miss | S1, F3 |
| P4 Platform | ⏸ waits for D3 | W1 auth, W7/W8 migrations |

No code or migration yet.

## Progress log
- 2026-11-28: analysis. Already in code from Line Grouping PF (uncommitted): pieces per line, piece preferences in one
  statement. New findings: F1 reads on a second connection inside the Submit transaction while the cloud pool is 2;
  F2 order-number lock held for the whole transaction (one order at a time per Organization); F3 voucher number lock;
  W1–W8 wasted work; S1 item/piece statements per line. Owner decisions D1–D3 open.
