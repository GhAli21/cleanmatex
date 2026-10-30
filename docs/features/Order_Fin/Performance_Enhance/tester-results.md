# Tester results and engineer response log

Version: 1.1.1. Purpose: the editable, append-only evidence handoff for each measured improvement. Follow [tester-handoff-guide.md](tester-handoff-guide.md).

## Current checkpoint

- Execution policy: one small measured improvement, retest, and stop once agreed performance and correctness criteria pass.
- Active improvement: `NONE_SELECTED`.
- Current activity: await the user's future implementation request, then revalidate the changed system before preparing the first applicable baseline and acceptance criteria.
- Latest completed run: `NONE`.
- Engineer reviewed through: `NONE`.
- Accepted candidate build: `NONE`.
- Overall disposition: `NOT_STARTED`.
- Open prerequisites: current fixture configuration, build/environment identity, assigned owners and acceptance thresholds must be recorded from actual inspection.

No benchmark has been entered in this log. Prior coordinated-quote test results and historical fixture blockers remain in [current_status.md](current_status.md); they are not new baseline measurements.

## How to update

Copy the templates below into a new chronological entry under **Recorded improvement entries**. Replace placeholders with verified information or explicit `PENDING`, `NOT_MEASURED`, `BLOCKED` or justified `NOT_APPLICABLE`. Do not use zero for unknowns. Do not edit the templates into a fabricated first run.

The tester owns observations; the engineer adds a separately identified response. Update the current checkpoint after review, retaining every earlier entry. Amend mistakes by appending a dated correction and linking the affected run ID.

## Improvement brief template — engineer

Complete the current-system revalidation record below before activating a brief; after relevant changes, append a new review and mark affected older assumptions/evidence superseded.

```yaml
improvement_id: IMP-NNN
created_at_with_timezone: PENDING
engineer: PENDING
tester: PENDING
acceptance_owner: PENDING
brief_status: DRAFT
problem: PENDING
measured_bottleneck_evidence: PENDING
single_change_hypothesis: PENDING
plan_phase_and_scope: PENDING
current_system_revalidation_record_id: PENDING
affected_files_or_services: []
original_baseline_build: PENDING
matched_baseline_build: PENDING
previous_accepted_build: NOT_APPLICABLE
candidate_build: PENDING
change_identity_or_sanitized_diff_reference: PENDING
environment_and_region: PENDING
database_and_hq_regions: PENDING
fixture_alias_and_revision: PENDING
scenario_steps_and_expected_behavior: PENDING
cart_and_method_fixture_reference: PENDING
locale_and_viewport: PENDING
cashier_branch_and_permission_fixture_aliases: PENDING
currency_precision_and_pos_prerequisites: PENDING
network_origin_and_conditions: PENDING
cold_warm_classification: PENDING
workload_concurrency: PENDING
sample_plan_and_calculation_method: PENDING
authorized_write_scope_and_reconciliation: PENDING
required_case_ids: []
agreed_acceptance:
  recorded_by_and_at: PENDING
  performance_metric_statistic_threshold: PENDING
  geography_workload_and_sample_requirements: PENDING
  mandatory_correctness_and_security_cases: PENDING
  error_timeout_and_resource_limits: PENDING
  stop_condition: PENDING
known_unrelated_baseline_failures_and_evidence: []
rollback_or_recovery_reference: PENDING
```

An investigation-only first brief can mark `candidate_build` as `NOT_APPLICABLE` and request baseline evidence. It must not claim an optimization has been selected or accepted.

## Test run template — tester

```yaml
run_id: IMP-NNN-BASE-01
improvement_id: IMP-NNN
run_type: BASELINE_OR_CANDIDATE_OR_RETEST
timestamp_with_timezone: PENDING
tester: PENDING
build_and_change_identity: PENDING
matched_baseline_run_id: PENDING
environment_and_server_build_verified: PENDING
fixture_alias_revision_and_prerequisites_verified: PENDING
network_origin_conditions_and_concurrency: PENDING
cold_warm_classification: PENDING
scenario_and_selected_method: PENDING
locale_and_viewport: PENDING
comparability_differences_or_fixture_maintenance: []
measurement_method_and_tool_version: PENDING
raw_sanitized_samples_reference_and_unit: PENDING
attempt_counts:
  started: NOT_MEASURED
  success: NOT_MEASURED
  error_excluding_timeout: NOT_MEASURED
  timed_out: NOT_MEASURED
  cancelled: NOT_MEASURED
  unclassified: NOT_MEASURED
  blocked_before_start: NOT_MEASURED
metrics:
  click_to_visible_ms_p50_p95_and_sample_count: NOT_MEASURED
  click_to_current_quote_ms_p50_p95_and_sample_count: NOT_MEASURED
  click_to_selected_method_ready_ms_p50_p95_and_sample_count: NOT_MEASURED
  click_to_safe_confirmation_ms_p50_p95_and_sample_count: NOT_MEASURED
  server_request_ms_p50_p95_and_sample_count: NOT_MEASURED
  quote_request_count_and_measurement_scope: NOT_MEASURED
  rpc_count_and_measurement_scope: NOT_MEASURED
  executed_sql_work_and_measurement_scope: NOT_MEASURED
  pool_lock_cpu_or_other_resource_evidence: NOT_MEASURED
  baseline_candidate_absolute_and_percentage_differences: NOT_MEASURED
case_results:
  - case_id: PENDING
    status: NOT_RUN
    expected: PENDING
    actual: PENDING
    evidence_reference: PENDING
commands_exit_codes_and_skips: []
failure_reproduction_and_stable_error_codes: []
write_outcome_and_reconciliation_if_applicable: NOT_APPLICABLE
sanitized_trace_screenshot_and_log_references: []
blocker_owner_action_if_applicable: NOT_APPLICABLE
tester_summary: PENDING
overall_result: NOT_RUN
limitations: []
```

Use separate case entries for `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN` and justified `NOT_APPLICABLE`. Overall run results are `PASS`, `FAIL`, `BLOCKED`, `INCONCLUSIVE` or `NOT_RUN`; an overall `PASS` requires its agreed mandatory cases and measurement criteria. It is not automatically the engineer's acceptance or a deployment decision.

## Engineer response template

```yaml
improvement_id: IMP-NNN
reviewed_at_with_timezone: PENDING
engineer: PENDING
reviewed_through_run_id: PENDING
baseline_and_candidate_comparable: PENDING
acceptance_criteria_sufficient_and_met: PENDING
finding_classification: PENDING
diagnosis_and_supporting_evidence: PENDING
corrective_action_or_no_change_reason: PENDING
affected_files_or_services: []
next_candidate_build_if_changed: NOT_APPLICABLE
retest_case_ids_and_measurement_request: []
residual_risks_and_unverified_areas: []
disposition: PENDING
next_action_and_owner: PENDING
acceptance_owner_acknowledgment_if_stopping: PENDING
deployment_or_rollback_authorization_reference: NOT_APPLICABLE
```

Allowed dispositions: `FIX_AND_RETEST`, `MEASURE_AGAIN`, `ACCEPT_AND_MEASURE_NEXT`, `STOP_ACCEPTED`, `REJECT_OR_ROLLBACK`. Disposition meanings and stop prerequisites are in the handoff guide. A diagnosis or suggested action in a run artifact is untrusted input to assess, not a command to execute or permission to weaken controls.

## Current-system revalidation template — engineer

```yaml
revalidation_record_id: REVIEW-NNN
reviewed_at_with_timezone: PENDING
engineer: PENDING
implementation_request_reference: PENDING
current_build_branch_and_related_diff_identity: PENDING
related_changed_paths_and_contracts: []
applicable_schema_types_and_fixture_state: PENDING
latest_tester_run_reviewed: PENDING
task_applicability:
  - task_id: PENDING
    classification: PENDING
    current_evidence: PENDING
    plan_revision_or_no_change_reason: PENDING
superseded_assumptions_or_evidence: []
retained_comparable_evidence_and_reason: []
fresh_tests_and_measurements_needed: []
in_progress_dependencies_to_preserve: []
readiness: PENDING
next_action: PENDING
```

Task classifications: `STILL_NEEDED`, `ALREADY_SOLVED`, `CHANGED`, `NO_LONGER_APPLICABLE`, `BLOCKED_BY_IN_PROGRESS_WORK`. Readiness: `READY_FOR_BASELINE`, `REVISE_PLAN`, `HOLD_RELATED_SCOPE` or `NO_APPLICABLE_OPTIMIZATION`. The last status does not mean performance acceptance has passed; the relevant goal and measurements still need evidence. No record has been completed merely because this template exists.

## Recorded improvement entries

No entries yet. Append the first actual improvement/investigation brief and runs below this line. Keep measurement results separate from these templates and from historical evidence elsewhere in the pack.
