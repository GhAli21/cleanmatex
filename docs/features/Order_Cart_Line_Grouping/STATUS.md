# Order Cart Line Grouping — Status

Design: [DESIGN.md](DESIGN.md) · QA: [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) · Handoff: [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md)

| Phase | State | Notes |
|---|---|---|
| Design | ✅ Approved 2026-11-25 | owner accepted all §11 recommendations + measured "add to matching line" (§4.1) |
| P1 Line identity | ⬜ Not started | no behaviour change; must land before or with P2 |
| P2 Add rule | ⬜ Not started | grew with review B1–B5: re-measure on piece-count change, exact one-share split, Edit prices, combined Edit DB test, customer line qualifier (also `cmx_mobile_apps`) |
| P3 Move piece | ⬜ Not started | |
| P4 Move saved piece (Edit) | ⬜ Not started | after P1–P3 QA (owner decision); 1 catalog migration; HQ: policy rule only, no code |
| PF Create write-path check | ⬜ Not started | **required before the program closes** (owner, 2026-11-25); measure first, change only if it misses the target (DESIGN §9.2) |
| P5 Product line mode | ⏸ On demand | only if staff ask for "always separate" products |

No migrations so far. Planned: P4 (catalog rows), P5 (typed column, on demand).

## Progress log
- 2026-11-25: exploration + design. Verified the server, DB, quote and Edit adapter already accept several lines per product. Live DB: 5/5 tenants `commercial_level = ITEM`; 0 orders with repeated product lines.
- 2026-11-25: owner approved §11 (closed-line rule; measured new line per tap; P4 after P1–P3 QA) and added: offer "Add to line N" when the entered measure matches a line of the same product + service category. Designed as §4.1. Found while checking it: a measured line's measure is the line total, so today the card `+` on a measured product adds a **free** piece (screenshot: 2 cardigans billed 2.5 m). Fixed by P2. AREA excluded from merging (one length × width per line). Live DB: 1 measured product (LENGTH), 0 AREA.
- 2026-11-25: plan audit across DB, server create/Edit, APIs, prints/labels, tests, HQ and mobile (DESIGN §13). New items: Edit unsaved-changes check matches by product (A6), React keys by product (A7), P4 catalog migration + HQ policy rule (A9), stale piece tags after a P4 move (A10), tests to update (A11), UX details (§13.1), requirements table (§14), test plan (§15).
- 2026-11-25: design evaluation (review, no code). Verdict: sound, approve P1. Fix in the design before P2/P3: (E1) §5.3 refuses moves on measured lines, but §4.1 lets staff merge measured pieces into one line, so a merge can never be undone: add "split a measured line" (qty - 1, measure - one share, exact) or drop the merge offer; (E2) check every other way to raise a measured line's quantity (cart stepper, Edit ADD_PIECE) so the free-garment gap is closed everywhere, not only on the grid `+`; (E3) Edit merge into a saved line = CHANGE_ITEM_QUANTITY + ADD_PIECE + CHANGE_ITEM_MEASURE on one line: confirm the one-op-per-line rules and the policy accept the three together, add a DB-integration test; (E4) say in §4 that a saved Edit line keeps its agreed price (L24) when a piece is merged, while a new line takes today's catalog price; (E5) receipts/tracking show two same-name rows: print speed/measure/price note so they can be told apart; (E6) PF is independent of this feature, keep it as a separate closing check, not a gate on P1-P4.
- 2026-11-25: owner asked that the create write path (rows inserted one at a time, `order-service.ts:655-880`) be checked before the plan ends. Added as the PF closing gate (DESIGN §9.2): baseline 3 order shapes, proposed target p95 ≤ 1.5 s for 30 lines / 60 pieces, batch piece writes only if it misses, parity DB test.
- 2026-11-25: review from the measured-units session (DESIGN §13.2), all 5 points verified and adopted: B1 exact one-share split to undo a measured merge (§4.3); B2 free-garment gap also in step 2 `+`/`−`, Add piece, pieces manager and Edit → re-measure on every piece-count change (§4.2); B3 DB-integration test for quantity + add piece + measure on one saved line, and 3 HQ policy rules (§4.5); B4 Edit price rule stated (saved line = agreed price, new line = today's price) and shown in the choice (§4.4); B5 line qualifier (measure / speed / ordinal) on receipts, prints, money view, tracking and the customer app, shipped in P2 (§8.1); shared helper with Measured Pricing P6.
