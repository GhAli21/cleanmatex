# Development Plan (summary) — Human-Friendly Codes

The full, authoritative plan is [`IMPLEMENTATION_PLAN_Human_Friendly_Codes.md`](./IMPLEMENTATION_PLAN_Human_Friendly_Codes.md) (status §1, tasks §21, decisions §20). This page is the short view.

| Phase | Scope | Migrations | State (2026-11-01) |
|---|---|---|---|
| P0 | Inventory + seed lists | — | DONE |
| P1 | DB engine: lookups, config, counters, functions, consistency view, registry | `0666`–`0672` | DONE (applied) |
| P2 | Order numbering cutover | `0674` | DONE (applied) |
| P2.1 | Split family root, tenant hard-delete guard | `0677`, `0678` | DONE (applied) |
| P2.2 | HQ tenant create uses `creating` | — | Code done, waiting for deploy |
| P3 | Item / piece codes, tag rules | `0682`, `0683` | DONE (applied) |
| P3b | Tenant-wide scan, code chips, search | — (flag `0684`, applied) | Code done, waiting for deploy |
| P4 | Labels, CODE128 + QR, Labels & Tags settings | `0685` | DONE (applied); deploy + real-scanner test pending |
| P5 | Store credit notes `SCN` | `0687` | Applied 2026-11-01; waiting for deploy |
| P6 | HQ permissions, deprecated image columns | `0688`, `0689` | DONE (applied 2026-11-01) |
| P7 | HQ API + HQ screens | — | Code done, waiting for deploy |
| P8 | Mobile, notifications, rule text | — | Code done, waiting for deploy / mobile release |
| P9 | Docs pack, QA + perf guides, ADR-004, close-out | — | DONE (docs); QA and perf runs are user-run |
| P10 | Backfill waves for other master data | one per table | Not planned in detail (template plan §5.13; separate approval) |

Next free migration number: `0690`.
