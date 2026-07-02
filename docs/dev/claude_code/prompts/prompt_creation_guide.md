# Prompt Creation Guide

Use this guide when you want to create a new prompt or choose the right existing one from the CleanMateX prompt pack.

## Goal

This guide helps you answer:

- what kind of prompt do I need?
- which file should I open?
- what should I include in the prompt?
- how do I make the output sharper without making the prompt too long?

## Fast Rule

Before writing a new prompt from scratch:

1. decide the real goal
2. choose the narrowest matching prompt category
3. copy the closest existing prompt
4. replace placeholders with your exact scope
5. add one quality block or one to two add-on lines only if needed

Important:

- prompts do not replace repo rules
- prompts do not replace domain skills
- still apply the relevant skills such as `/frontend`, `/backend`, `/database`, `/i18n`, `/multitenancy`, `/implementation`, and `/documentation`

## Step 1: Decide The Real Goal

Ask yourself what you actually want.

Use one of these goal types:

- `Plan`  
  You want a feature blueprint before coding.
- `Build`  
  You want implementation work.
- `Review`  
  You want findings, risks, or validation.
- `Fix`  
  You want root-cause analysis and a safe bug fix.
- `Inspect`  
  You want proactive gap finding or bug hunting.
- `Design`  
  You want UI, UX, or flow design.
- `Model`  
  You want schema, ERD, migration, or API contract design.
- `Strategy`  
  You want documentation, PRD writing, or multi-perspective evaluation.

If the goal is unclear, the output will usually be weaker.

## Step 2: Choose The Right Prompt File

Open the smallest file that matches your goal:

- [Build Prompts](./build-prompts.md)
  For planning, implementation, refactoring, and continuing in-progress work.
- [Review Prompts](./review-prompts.md)
  For QA, code review, bug investigation, proactive bug hunting, release readiness, performance, and security review.
- [UI / UX Prompts](./ui-ux-prompts.md)
  For screen design, redesign, UX critique, accessibility, responsive behavior, component selection, and microcopy.
- [Data / API Prompts](./data-api-prompts.md)
  For migration planning, API contracts, and data-model work.
- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)
  For documentation, PRD/spec writing, and multi-perspective evaluation.
- [Reusable Quality Blocks](./reusable-quality-blocks.md)
  For reusable quality rules, evaluation rules, review output structure, and optional add-on lines.

If more than one file looks relevant, start with the narrower one.

Then ask: which domain skills still apply?

Examples:

- frontend screen work -> `/frontend`
- backend or API work -> `/backend`
- migrations or schema work -> `/database`
- tenant-sensitive logic -> `/multitenancy`
- translations or UX copy -> `/i18n`
- feature delivery work -> `/implementation`
- checked-in docs -> `/documentation`

## Step 3: Choose The Closest Existing Prompt

Do not start from a blank page unless nothing close exists.

Examples:

- want a new feature blueprint -> `Feature Planning Prompt`
- want code plus plan -> `Feature Execution Prompt`
- want to find defects in an area -> `Gap / Bug Hunt Prompt`
- want to fix one known defect -> `Bug Investigation Prompt`
- want a go/no-go check -> `Release Readiness Prompt`
- want finance + accounting + user + ops evaluation -> `Multi-Perspective Evaluation Prompt`
- want a new screen -> `UI/UX Design Prompt`
- want to improve an existing screen -> `Screen UX Review Prompt` or `Screen Redesign Prompt`
- want schema planning -> `Migration Design Prompt` or `Data Model / ERD Prompt`

## Step 4: Replace Placeholders With Exact Scope

Always replace placeholders with real context.

Weak:

```md
Review this feature.
```

Better:

```md
Review the order payment modal flow in CleanMateX.
```

Best:

```md
Review the order payment modal flow in CleanMateX, especially cash handling, overpayment behavior, permission-aware actions, and EN/AR state coverage.
```

Good prompt inputs usually include:

- exact feature, screen, flow, module, route, or file area
- whether you want planning, review, or implementation
- whether the scope is new work or existing work
- any especially sensitive concerns like finance, accounting, RBAC, tenant safety, or UI consistency

## Step 5: Add Extra Control Only When Needed

If the base prompt is not enough, use one of these:

### Option A: Add A Quality Block

Use [Reusable Quality Blocks](./reusable-quality-blocks.md) when you want stronger output quality without rewriting the whole prompt.

Best default choice:

- `Default Quality Add-On Block`

Use this when you want:

- better tradeoff reasoning
- clearer assumptions
- stronger production-readiness thinking
- less generic advice

### Option B: Add A Review Output Contract

Use:

- `Default Review Output Contract`

Use this when you want:

- findings first
- severity ordering
- confirmed issues separated from weaker risks

### Option C: Add A Few Add-On Lines

Use one to two only.

Examples:

- `Wait for my approval before writing code.`
- `Findings first, summary second.`
- `Focus on minimal diff and reuse existing patterns aggressively.`
- `Prioritize maintainability, supportability, and production-readiness over cleverness.`

## Step 6: Keep The Prompt Narrow

The prompt gets weaker when it tries to do too many things at once.

Bad:

- design the feature
- implement it
- review it
- test it
- evaluate it from ten perspectives
- write docs

Better:

1. design
2. implement
3. review
4. test
5. document

If you need several phases, use separate prompts.

## Step 7: Use The Right Output Shape

Ask for the output shape you want.

Good examples:

- `Produce an implementation-ready plan.`
- `Findings first, ordered by severity.`
- `Provide a balanced evaluation with tradeoffs and recommended direction.`
- `Do not write code yet; produce the blueprint first.`
- `Implement the approved scope and run the required validations.`

If you do not control output shape, the answer may be too broad or too abstract.

## Prompt Writing Checklist

Before sending the prompt, check:

- did I choose the right prompt category?
- did I replace placeholders with exact scope?
- did I state whether I want planning, review, or implementation?
- did I mention any especially important concerns?
- did I avoid mixing too many goals in one prompt?
- did I add only the minimum extra control needed?

## Common Mistakes

### Mistake 1: Too broad

Example:

```md
Help me with this module.
```

Why it is weak:

- unclear goal
- unclear scope
- unclear output shape

### Mistake 2: Too many goals at once

Example:

```md
Design, implement, test, review, and optimize this feature.
```

Why it is weak:

- creates shallow output across too many areas

### Mistake 3: No repository framing

Example:

```md
Design a payment feature.
```

Better:

```md
Design the payment feature in CleanMateX using existing repository patterns, tenant-safe access, EN/AR UI coverage, and Cmx components only.
```

### Mistake 4: Too many add-on constraints

Why it is weak:

- makes answers rigid
- increases repetition
- can reduce reasoning quality

## Recommended Default Pattern

If you are unsure, use this process:

1. open [index.md](./index.md)
2. choose one category file
3. copy the closest prompt
4. replace placeholders
5. add `Default Quality Add-On Block` only if needed
6. add one optional line only if needed

## Examples

### Example 1: New feature design

Use:

- [Build Prompts](./build-prompts.md) -> `Feature Planning Prompt`

Then add:

- `Wait for my approval before writing code.`

### Example 2: Known bug in payment flow

Use:

- [Review Prompts](./review-prompts.md) -> `Bug Investigation Prompt`

Then add:

- `Focus on minimal diff and reuse existing patterns aggressively.`

### Example 3: Want to discover hidden issues in an area

Use:

- [Review Prompts](./review-prompts.md) -> `Gap / Bug Hunt Prompt`

Then add:

- `Findings first, summary second.`

### Example 4: Finance + accounting + UX + ops evaluation

Use:

- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md) -> `Multi-Perspective Evaluation Prompt`

Then optionally add:

- `Prioritize maintainability, supportability, and production-readiness over cleverness.`

### Example 5: Existing screen needs improvement

Use:

- [UI / UX Prompts](./ui-ux-prompts.md) -> `Screen UX Review Prompt`

or:

- `Screen Redesign Prompt`

depending on whether you want critique or a stronger redesign direction.

## Final Advice

The best prompts are:

- narrow
- explicit
- repository-aware
- production-aware
- not overloaded

If you are in doubt, start smaller. A precise prompt usually beats a comprehensive but overloaded one.
