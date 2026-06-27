# Payment Modal v4 — `usePaymentEngine` Refactor · STATUS

**Last updated:** 2026-06-27
**Program plan (authoritative):** `~/.claude/plans/happy-doodling-volcano.md`
**Design/review:** `Payment_Modal_v4_UX_Review_and_Engine_Plan.md` · **ADR:** `../ADR/ADR_payment_modal_single_engine_two_mode.md`
**Constraints:** no payload-contract change · one engine, two views · behavior-frozen extraction (Phases 1–3) · EN+AR i18n for new strings.

## Progress

| Phase | State | Notes |
|---|---|---|
| 0 — ADR + payload fixtures | ✅ Done | ADR accepted; 8 baseline fixtures captured + validated; oracle test skipped until 2F. |
| 1 — Pure logic extraction | ✅ Done & verified | `use-money-derivations`, `payment-validation` (`derivePaymentValidationItems`), right-rail copy builders, `computeNeedsAdvanced`. 59 new-hook tests + tsc + build. Verbatim lifts; validation/copy don't touch the payload. |
| QA bug-fix track | ✅ 2 fixed, 1 diagnosed | Allocation drawer z-index (Bug 2/3) fixed; gift-card-full backend 400 (Bug 1) diagnosed only. See `Payment_Modal_v4_QA_Bugs_2026-06-27.md`. |
| 2A — catalog hook | ⬜ Next | `use-payment-catalog.ts` (+ `isError`/`refetch`). |
| 2B — gift card / promo | ⬜ | `use-gift-card-and-promo.ts`. |
| 2C — totals | ⬜ | `use-payment-totals.ts` (reads applied promo/gift). |
| 2D — legs (+ quickTender) | ⬜ | `use-payment-legs.ts`. |
| 2E — cash drawer | ⬜ | `use-cash-drawer.ts`. |
| 2F — submit (+ payload oracle) | ⬜ | `use-payment-submit.ts`; activate oracle test vs fixtures. |
| 2G — engine + Full-view split | ⬜ | `use-payment-engine.ts`; `payment-full-view.tsx`; reopen + Collect-Payment smoke. |
| 3 — Full-view UX quick wins | ⬜ | dedupe numbers, quick-tender chips, aria-live, blocker dedupe, etc. |
| 4 — Simple mode + escalation | ⬜ | wire `computeNeedsAdvanced`; `payment-simple-view.tsx`. |
| 5 — keyboard shortcuts | ⬜ | guardrailed Enter/F2/Ctrl+Enter. |
| 6 — responsive / tablet | ⬜ | 2-pane + docked CTA. |
| 7 — full documentation generation | ⬜ | `/documentation` pass over the prd-rules feature checklist. |

## Validation (Phase 0–1 + bug fixes)
eslint clean · `tsc` clean on touched files · production build green · 114 payment-suite + 59 new-hook tests pass.

## Payload fixtures — purpose
The 8 baseline fixtures are the **Phase 2F automated oracle**, not a Phase-1 manual task: once `buildPaymentPayload` is extracted (2F), the oracle test replays each fixture's recorded inputs through it and asserts deep-equality with the recorded payload (deterministic, CI-runnable). Phase 1 is already verified by verbatim lifts + tests + build.
