# Documentation Pack Reference

Use this reference only when the task stays within the main `documentation` skill and needs pack details.

## 1. When To Stay In This Skill

Stay here when:

- the canonical folder is already known
- the task is limited to one feature or sub-scope
- the work is normal doc writing, updating, or pack completion
- there is no active ambiguity about which folder is the source of truth

Switch to specialist skills when that is no longer true.

## 2. Specialist Skill Routing

### `/documentation-canonicalization`

Use when:

- two or more folders appear to cover the same domain
- a numbered PRD folder and a named feature folder overlap
- there are multiple active-looking docs for the same workflow or API surface
- the user asks which doc or folder should be canonical

### `/documentation-audit`

Use when:

- the task is repo-wide or multi-folder
- the user asks for coverage gaps, readiness tiers, stale docs, or missing file reports
- the main output should be an audit or cleanup plan

### `/documentation-pack-repair`

Use when:

- the canonical folder is already chosen
- the task is to fill many missing standard files in that folder
- the work benefits from a stricter file-by-file completion workflow

### `/documentation-archive-migration`

Use when:

- legacy docs need redirect stubs
- historical docs should stop acting like active truth
- old folders need to be converted into archive or support-only state

## 3. Default Feature Pack

For a feature or meaningful sub-scope, the standard pack is:

- `README.md`
- `development_plan.md`
- `progress_summary.md`
- `current_status.md`
- `developer_guide.md`
- `developer_guide_mermaid.md`
- `user_guide.md`
- `user_guide_mermaid.md`
- `deploy_guide.md`
- `testing_guide_and_scenarios.md`
- `CHANGELOG.md`
- `version.txt`
- `technical_docs/`

## 4. What Each File Should Cover

### `README.md`

- overview
- scope boundaries
- main workflows or surfaces
- links to the rest of the pack

### `development_plan.md`

- milestones
- sequencing
- pending workstreams

### `progress_summary.md`

- completed work
- in-progress work
- pending work

### `current_status.md`

- current implementation state
- blockers
- risks
- next recommended actions

### `developer_guide.md`

- module structure
- code flow
- important files and services
- API and data dependencies

### `developer_guide_mermaid.md`

- request flow
- service interaction flow
- lifecycle flow

### `user_guide.md`

- user goals
- main workflows
- expected behaviors
- troubleshooting notes

### `user_guide_mermaid.md`

- workflow or decision flow for users

### `deploy_guide.md`

- scope-specific rollout and operational notes only

### `testing_guide_and_scenarios.md`

- functional scenarios
- edge cases
- failure cases
- expected results

### `CHANGELOG.md`

- meaningful state or documentation changes

### `version.txt`

- current version marker if that scope uses versioning

## 5. Feature Coverage Checklist

Document these when they apply:

- permissions and RBAC
- navigation and route placement
- settings, feature flags, and plan limits
- i18n and bilingual impact
- API routes and contracts
- migrations, schema changes, and RLS
- constants, types, and validation rules
- environment variables and external integrations
- testing scenarios and rollout risks

## 6. Validation

Before finishing:

- verify the folder is still the canonical target
- verify links are not obviously broken
- verify status/progress/changelog do not contradict each other
- verify technical claims match current repo artifacts
