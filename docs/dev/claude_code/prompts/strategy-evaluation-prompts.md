# Strategy / Evaluation Prompts

## See Also

- [Prompt Pack Index](./index.md)
- [Reusable Quality Blocks](./reusable-quality-blocks.md)
- [Build Prompts](./build-prompts.md)
- [Review Prompts](./review-prompts.md)
- [UI / UX Prompts](./ui-ux-prompts.md)
- [Data / API Prompts](./data-api-prompts.md)

## 1. Documentation Prompt

Use when: You need checked-in feature docs, rollout docs, or implementation summaries that reflect reality.

Tip: Ask for `confirmed implementation only` if you want the docs to avoid mixing actual behavior with planned follow-ups.

```md
Your task is to create or update the documentation for `[feature/module/change]` in CleanMateX.

Write implementation-ready documentation grounded in this repository's actual behavior, architecture, and rules. Do not write generic product or engineering documentation. Make the output useful for future implementation, review, onboarding, and release work.

Cover the relevant areas:
- feature purpose and scope
- business rules and workflow summary
- permissions, RBAC, and access implications
- navigation, settings, feature flags, and plan-limit impacts
- API routes and service responsibilities
- database changes, migrations, and schema implications
- UI screens, states, and i18n implications
- validation, testing, rollout, and operational notes
- known risks, follow-ups, and open decisions

Required behavior:
- reflect current repository conventions and exact paths where relevant
- distinguish confirmed implementation from planned follow-up work
- keep the structure easy to scan and maintain
- avoid stale boilerplate and vague wording

Output should be concise, structured, and suitable for checked-in project documentation.
```

## 2. PRD / Spec Writing Prompt

Use when: You have an idea or initiative and want a structured feature spec that engineering can act on.

Tip: This is best when you need to turn vague product thinking into decisions that can become tickets, code, and tests.

```md
Your task is to write a product and implementation-ready specification for `[feature/initiative]` in CleanMateX.

Create a practical PRD/spec grounded in this repository's architecture, constraints, and enterprise SaaS workflows. Do not write a vague product brief. The result should help the team design, implement, review, and release the work with minimal ambiguity.

Include:
- problem statement and goals
- scope and non-goals
- user roles and operational workflows
- business rules, states, and edge cases
- data-model and API implications
- permissions, tenant isolation, and audit requirements
- UI/UX expectations and state coverage
- i18n, RTL, feature-flag, settings, and plan-limit implications
- rollout plan, dependencies, acceptance criteria, and risks

Required behavior:
- surface hidden requirements and cross-feature dependencies early
- make decisions concrete enough for implementation
- avoid aspirational language that cannot be translated into code or tests
- keep the spec structured, actionable, and repository-aware

Output should be suitable for checked-in planning or feature documentation in this repository.
```

## 3. Multi-Perspective Evaluation Prompt

Use when: You want one feature, screen, workflow, or design reviewed from several stakeholder angles at once.

Tip: This is the right prompt for finance, accounting, operations, end-user, product, engineering, QA, and security tradeoff reviews. The key is not just listing perspectives, but forcing conflicts and final recommendations to be explicit.

Optional variant: If you want the answer to feel more grounded in real stakeholder viewpoints, replace the lens list with named roles such as:
- CFO / finance lead
- accountant / audit reviewer
- branch operator / cashier
- store manager / tenant admin
- end customer / end-user
- product manager
- senior engineer / architect
- QA / release reviewer

```md
Your task is to evaluate `[feature/screen/workflow/change]` in CleanMateX from multiple professional perspectives and provide a balanced, implementation-ready assessment.

Review it through the following lenses where applicable to this specific scope:
- finance and revenue impact
- accounting correctness and auditability
- end-user usability and workflow clarity
- operations and staff efficiency
- tenant admin and manager control needs
- security, permissions, and tenant isolation
- product scalability and long-term maintainability
- API, data-model, and reporting consistency
- implementation complexity, rollout risk, support burden, and production readiness

For each applicable perspective, assess:
- what is strong
- what is weak or risky
- what may be missing
- what conflicts with another perspective
- what should be changed before implementation or release

Required behavior:
- do not give generic feedback
- identify tradeoffs between perspectives instead of pretending all goals align
- call out hidden requirements, finance and accounting gaps, operational pain points, and UX friction
- distinguish critical blockers from optional improvements
- recommend the best practical direction for this repository, not a theoretical ideal
- keep the evaluation grounded in CleanMateX rules, tenant safety, RBAC, i18n, Cmx UI constraints, and implementation reality
- if a perspective is not relevant, state that briefly and skip deep analysis for that lens

Output format:
1. Executive assessment
2. Findings by perspective
3. Cross-perspective conflicts and tradeoffs
4. Recommended direction
5. Must-fix items before release or implementation
```
