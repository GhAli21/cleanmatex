# Reusable Order Financial View — STATUS

**Plan:** [PLAN.md](PLAN.md)
**Overall:** DRAFT PLAN — awaiting owner review (2026-10-22). No code changes made.

| Phase | Title | Status | Notes |
|---|---|---|---|
| P0 | Discovery and decision freeze | Not started | |
| P1 | Fix existing bugs (BF-01 … BF-15) | Not started | Must complete before P5 |
| P2 | Database (indexes / permission seed, if needed) | Not started | Stop and wait after each migration file |
| P3 | Backend read model | Not started | |
| P4 | APIs, endpoints, server actions, access contracts | Not started | |
| P5 | Frontend reusable component | Not started | |
| P6 | Pages and screens migration | Not started | |
| P7 | Verification and hardening | Not started | |
| P8 | Order Fin rules file, skill, Cursor rule | Not started | |
| P9 | Documentation update | Not started | |

## Log

- **2026-10-22 (v3):** Owner round-3 decisions D10–D13 applied: the component and service are permission-agnostic (entry points keep session tenant plus `orders:read`); public view shows tender totals by method; payment-modal preset `detailed`; customer portal in scope. Added BF-17 (raw status codes shown) and BF-18 (tenant decimals and hardcoded colors). Structure and UI proposal written to DESIGN.md, under discussion.
- **2026-10-22 (v2):** Owner round-2 decisions D6–D9 applied: no new permission; public-safe view on the token path only; draft source for payment-modal-v4 (the order is unsaved there); detail page default `detailed` with a switch to `full`. Added BF-16 (guessable public fallback path, to verify in P0). Four open items remain (PLAN §10).
- **2026-10-22:** Analysis done and plan drafted. 15 defects/gaps identified (PLAN §4). Owner decisions D1–D5 recorded. Four open items await owner review (PLAN §10).
