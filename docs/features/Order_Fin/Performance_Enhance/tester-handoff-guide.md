# Tester handoff and improvement loop

Version: 1.1.1. Status: working procedure; no benchmark or improvement result is implied.

Use this guide with [tester-results.md](tester-results.md), the editable evidence and handoff log. The tester records observations there; the engineer reads those updates before selecting or changing the next implementation. The [test scenarios](testing_guide_and_scenarios.md) provide the detailed cases, while the [benchmark protocol](technical_docs/observability_and_benchmarking.md) defines measurement quality.

## 1. One improvement at a time

The execution policy is: **measure, select one small change, implement, retest, decide, and stop when agreed performance and correctness criteria are satisfied.** The larger implementation plan is a menu of scoped work, not a commitment to execute every phase.

Before starting or resuming that loop, the engineer completes the current-system revalidation record in the results log under Step 0 of the implementation plan. Recheck related ongoing changes, revise solved/changed/inapplicable tasks, and identify fresh evidence needs. Testing against an older build must not be presented as acceptance of a system that changed afterward. In this session application work waits for the user's future implementation request.

Do not bundle unrelated optimizations in one candidate. If a change needs a prerequisite, describe that prerequisite explicitly. Do not begin another optimization while the current candidate has an unexplained regression or missing acceptance evidence. Independent diagnosis and fixture work may continue without pretending the candidate passed.

The test record is evidence, not authorization to apply migrations, bypass operational/authentication gates, post production payments, change business rules or deploy. Those actions retain their existing scope and authorization boundaries.

## 2. Files and ownership

- **Tester:** appends factual run records, sanitized measurements, failed cases, blockers and artifact references in [tester-results.md](tester-results.md). Does not overwrite prior runs or decide how code should change to make an assertion pass.
- **Engineer:** fills the improvement brief and change/build identity, identifies affected cases, reads new runs, records diagnosis and remediation, and selects the next smallest justified action.
- **Acceptance owner:** records the agreed thresholds, required correctness cases and final stop/continue disposition. Name the actual assigned owner; do not invent an assignment or treat an unfilled criterion as accepted.
- **Shared overview:** the engineer updates the log's current checkpoint and [current status](current_status.md) after review. Historical evidence remains in the run records.

No file-watching automation is created. After updating the log, tell the engineer: `Review tester-results.md through <RUN-ID> for <IMP-ID>.` The engineer then reads the file, acknowledges the last reviewed run ID, and records the response. Editing a file alone does not imply that anyone has seen it.

## 3. Identifiers and record integrity

- Use improvement IDs `IMP-001`, `IMP-002`, and so on. Use run IDs such as `IMP-001-BASE-01`, `IMP-001-CAND-01` and `IMP-001-RETEST-01`.
- Every run includes timestamp/time zone, tester, environment, scenario, exact build/commit or sanitized diff identity and fixture revision. A code change after a run needs a new candidate build/run record.
- Keep the original baseline reference and the previous accepted build reference. Compare each candidate to its matched baseline; also report cumulative progress against the original baseline when inputs remain comparable.
- Append corrections as dated amendments referring to the original run. Do not silently fix raw observations or replace failed runs with passing reruns. Mark superseded evidence explicitly.
- Do not copy tokens, browser auth storage, credentials, raw gift-card codes/PINs, customer details or balances into the log. Use safe fixture aliases and sanitized artifacts.

## 4. Engineer prepares the brief before testing

For the next improvement, fill the log's improvement template with:

1. The user-visible problem, measured bottleneck and one change hypothesis. If no successful baseline exists, the first brief is a baseline investigation with no optimization selected yet.
2. Exact current and candidate build identities, changed files/services and the relevant plan phase. Identify any shared-auth, settings, operational or money impact.
3. An executable scenario: navigation, fixture aliases, cart quantities, selected method, locale, branch context, session prerequisite and intended cold/warm state. Use the same fixture definition for baseline and candidate.
4. Required automated/manual cases and which tests involve writes. Link detailed instructions rather than copying secrets or live data.
5. Performance metric, percentile/statistic, threshold, geographic origin, workload/concurrency and sample plan. Record correctness requirements and acceptable error/resource limits separately.
6. Rollback/recovery route and known unrelated baseline failures.

Thresholds remain `PENDING` until explicitly agreed and recorded. The earlier suggested 350/500 ms, one-second and 100 ms values are hypotheses, not default acceptance limits. Meaningful evidence collection can begin while thresholds are being agreed; final acceptance cannot.

## 5. Tester establishes a usable baseline

1. Confirm the intended server/build, approved environment and legitimate fixture setup. Verify currency/precision, permissions and relevant active POS/drawer sessions. Record actual present state; historical fixture failures are not a fresh inspection.
2. If a prerequisite is unavailable, record `BLOCKED` with the observed safe error and recovery owner/action. Do not invent a currency, disable CSRF or bypass a session gate. A blocked happy-path case may still provide separate evidence that safe rejection works.
3. Follow the exact scenario and collect raw sanitized samples. Separate browser/session cold state, infrastructure cold state, warm open, same-cart reopen and changed-cart refresh.
4. Record click-to-visible, current-quote readiness and selected-method/safe-confirmation readiness separately. Use the defined harness/marks; a human stopwatch may identify a gross problem but is not precise readiness proof.
5. Capture success/failure/cancel counts, request/RPC counts when observable, stage timings and available resource metrics. Record unobservable quantities as `NOT_MEASURED`, never zero.
6. Record before/after fixture state where quote preparation can perform maintenance, such as loyalty expiry. Do not run concurrent users or repeat a mutation-producing scenario and assume every repetition starts with identical facts.

Use supported fixture preparation/reconciliation for repeatability; no database reset or unauthorized direct financial edits. For a read-path benchmark, keep real submission out of the measured loop. Write-path tests need the separately authorized disposable fixture and reconciliation described in the test guide.

## 6. Candidate and retest procedure

Run the same scenario against the identified candidate with matched environment, network origin, fixture and concurrency. Record differences that cannot be controlled. Do not attribute a gain to code if the compared runs used different regions, cache/maintenance states, datasets or build modes.

The tester records each required case as `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN` or `NOT_APPLICABLE`. A not-applicable case needs a reason accepted in the brief; a blocked/not-run mandatory case prevents acceptance. A passing automated test and a passing real-browser test are separate evidence.

At minimum, select scope-appropriate cases proving current readiness, expected financial presentation, money preservation, retry/cancel and relevant identity/operational boundaries. Expand to shared session/security tests for auth changes and full affected monetary parity for calculation changes. Do not demand every future/deferred scenario for an unrelated small change, and do not omit necessary guards because the candidate is labelled performance-only.

Record failed assertions and stable error codes with reproduction steps, expected versus actual behavior and sanitized artifact links. For transport failures after submit, record the outcome as unknown until reconciled; do not create another payment or new idempotency identity merely to retry the test.

## 7. Measurement and comparison rules

- Store or link raw samples and state their unit, sample count and calculation method. Do not report p95 from one attempt or assert a reliable tail SLO from a tiny convenience sample.
- Report errors, timeouts and cancellations with their denominators. Show successful latency cohorts separately; do not hide failed attempts by dropping them from outcome counts.
- Use mutually exclusive attempt outcomes: success, error excluding timeout, timed out, cancelled and unclassified. Their sum must equal attempts started. Record fixture/precondition blocks before an attempt separately. An unresolved financial-write outcome is recorded separately from the observed transport result and must be reconciled; it cannot be inferred from a timeout alone.
- State whether an observation covers the handler, full network request or complete browser journey. Proxy/auth and later metadata can lie outside `Server-Timing`.
- Do not add overlapping stage durations as total wall time. RPC counts, executed SQL statements and query cost are different measurements.
- Compare absolute values and the baseline/candidate difference. Percentage changes require a meaningful nonzero comparable baseline; otherwise mark the percentage `NOT_APPLICABLE`.
- Repeated warm measurements and controlled cold observations need their own cohorts. Do not mix locations, payment methods or cold/warm modes into one unexplained percentile.
- If load, sample coverage or artifacts are insufficient, classify the conclusion as `INCONCLUSIVE` even if the first few attempts look faster.

## 8. Engineer reviews the update and closes the loop

For each new run, the engineer must:

1. Read the brief, matched baseline, candidate build and newly appended evidence; record `reviewed_through_run_id`.
2. Verify comparability, sample quality and required correctness/security cases before interpreting speed.
3. Classify findings as fixture/environment, instrumentation, application defect, expected domain behavior, performance regression or insufficient evidence. Do not relabel an unexplained failure as unrelated.
4. Record the diagnosis, affected files, exact corrective action and required retest. If no application change is justified, say so explicitly.
5. If code changes, identify the new candidate build and append a new run request. Never reuse the earlier passing result for the changed build.
6. Record one disposition: `FIX_AND_RETEST`, `MEASURE_AGAIN`, `ACCEPT_AND_MEASURE_NEXT`, `STOP_ACCEPTED` or `REJECT_OR_ROLLBACK`.

`ACCEPT_AND_MEASURE_NEXT` means the current change is supported but the agreed overall goal remains unmet and another measured bottleneck justifies investigation. It does not authorize all deferred proposals.

`STOP_ACCEPTED` requires all agreed mandatory correctness/security cases, comparable performance/error/resource criteria and necessary runtime evidence to pass. Mark remaining proposals deferred; do not add another optimization for speculative benefit. A release/deployment decision is a separate recorded action under the existing release process.

## 9. What to send back to the engineer

Update [tester-results.md](tester-results.md), then send a short handoff:

```text
Review tester-results.md through RUN-ID for IMP-ID.
Candidate build: <identity>.
Result: <PASS / FAIL / BLOCKED / INCONCLUSIVE>.
Main finding: <one sentence>.
Evidence: <sanitized artifact references>.
```

The log is the detailed source of truth; the message points to the latest record. Do not paste credentials or large unredacted traces into chat.
