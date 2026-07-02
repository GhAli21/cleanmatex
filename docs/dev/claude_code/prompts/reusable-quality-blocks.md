# Reusable Quality Blocks

Use these reusable blocks to make prompts sharper without repeating long instructions everywhere.

## See Also

- [Prompt Pack Index](./index.md)
- [Build Prompts](./build-prompts.md)
- [Review Prompts](./review-prompts.md)
- [UI / UX Prompts](./ui-ux-prompts.md)
- [Data / API Prompts](./data-api-prompts.md)
- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)

## Default Quality Add-On Block

Use when: You want stronger, more consistent output quality without rewriting the full prompt.

Tip: Add this block to planning, implementation, review, evaluation, and investigation prompts when you want sharper reasoning and less generic output.

```md
Additional quality requirements:
- optimize for correctness, tenant safety, maintainability, and low regression risk
- prefer existing repository patterns over new abstractions unless clearly justified
- state important assumptions briefly
- distinguish confirmed findings from likely risks or unknowns
- identify hidden dependencies, downstream effects, and rollout implications
- highlight tradeoffs when multiple valid approaches exist
- recommend the safest practical option when multiple valid choices exist
- prioritize blockers and must-fix issues before optional improvements
- call out what is still missing for production readiness when relevant
- identify anything that will create future support burden or troubleshooting complexity
- favor solutions that are easy to debug, test, monitor, support, and hand off
- avoid generic advice; keep the output specific and implementation-ready
```

## Default Review Output Contract

Use when: You want review-style prompts to produce tighter, more actionable results.

Tip: This is especially useful for code review, QA review, release review, security review, performance review, and UX critique prompts.

```md
Output contract:
1. Executive assessment
2. Findings first, ordered by severity or impact
3. Confirmed issues separated from lower-confidence risks or unknowns
4. Tradeoffs or decision tensions if relevant
5. Recommended direction
6. Must-fix items before release, merge, or implementation
```

## Default Evaluation Rules

Use when: You want evaluation prompts to be more rigorous, balanced, and production-aware.

Tip: Pair this with the Multi-Perspective Evaluation Prompt or any strategic review prompt where several stakeholder concerns may conflict.

```md
Evaluation rules:
- stay within the requested scope and avoid unrelated redesigns or refactors
- identify hidden dependencies, downstream effects, and rollout implications
- call out what is confirmed, what is inferred, and what remains unknown
- compare multiple valid options briefly when they exist, then recommend one
- assess long-term maintainability, support burden, production readiness, and operational risk
- favor the safest practical recommendation for this repository over a theoretical ideal
```

## Optional Add-On Lines

Use when: You want to tighten scope or steer how the answer is delivered without rewriting the whole prompt.

Tip: One or two add-on lines are usually enough. Too many constraints can make the answer rigid or repetitive.

Append any of these lines when needed:

- `Wait for my approval before writing code.`
- `Focus on minimal diff and reuse existing patterns aggressively.`
- `If a DB migration is needed, create the SQL file only and stop for review.`
- `If permissions or navigation change, include migration and access-contract implications explicitly.`
- `Prefer implementation over explanation once the plan is clear.`
- `Findings first, summary second.`
- `Call out confirmed issues separately from lower-confidence risks.`
- `Prioritize maintainability, supportability, and production-readiness over cleverness.`
- `Call out anything that will create future support burden or operational fragility.`
- `Recommend the easiest solution to maintain safely at scale.`
- `Favor designs that are easy to debug, monitor, and hand off to future developers.`
