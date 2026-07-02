# Prompt Creation Cheat Sheet

Use this when you want the shortest practical reminder for creating a good prompt in CleanMateX.

## 1. Decide The Real Goal

Pick one:

- `Plan`
- `Build`
- `Review`
- `Fix`
- `Inspect`
- `Design`
- `Model`
- `Strategy`

If the goal is mixed, split it into phases.

## 2. Open The Smallest Matching File

- Build -> [Build Prompts](./build-prompts.md)
- Review -> [Review Prompts](./review-prompts.md)
- UI / UX -> [UI / UX Prompts](./ui-ux-prompts.md)
- Data / API -> [Data / API Prompts](./data-api-prompts.md)
- Strategy / Evaluation -> [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)
- Quality blocks -> [Reusable Quality Blocks](./reusable-quality-blocks.md)

Prompts do not replace repo skills. Still apply the relevant domain skills:

- frontend -> `/frontend`
- backend -> `/backend`
- database -> `/database`
- i18n -> `/i18n`
- multitenancy -> `/multitenancy`
- implementation -> `/implementation`
- documentation -> `/documentation`

## 3. Copy The Closest Prompt

Do not start blank unless nothing close exists.

Examples:

- new feature -> `Feature Planning Prompt`
- code + plan -> `Feature Execution Prompt`
- known bug -> `Bug Investigation Prompt`
- proactive issue sweep -> `Gap / Bug Hunt Prompt`
- existing screen critique -> `Screen UX Review Prompt`
- finance + accounting + ops + UX -> `Multi-Perspective Evaluation Prompt`

## 4. Replace Placeholders With Exact Scope

Always name the real thing:

- feature
- screen
- flow
- route
- module
- file area

Better inputs:

- what area?
- what kind of output?
- what sensitive concerns matter most?

## 5. Add Extra Control Only If Needed

Use one of these:

- [Default Quality Add-On Block](./reusable-quality-blocks.md)
- [Default Review Output Contract](./reusable-quality-blocks.md)
- 1 or 2 optional add-on lines

Good add-on examples:

- `Wait for my approval before writing code.`
- `Findings first, summary second.`
- `Focus on minimal diff and reuse existing patterns aggressively.`
- `Prioritize maintainability, supportability, and production-readiness over cleverness.`

## 6. Keep It Narrow

Bad:

- design + implement + test + review + optimize everything

Better:

1. design
2. implement
3. review
4. test

## 7. Ask For The Right Output Shape

Examples:

- `Produce an implementation-ready plan.`
- `Do not write code yet; produce the blueprint first.`
- `Findings first, ordered by severity.`
- `Provide tradeoffs and recommend one direction.`
- `Implement the approved scope and run the required validations.`

## Quick Checklist

- did I choose the right category?
- did I replace placeholders with exact scope?
- did I state plan vs review vs implementation?
- did I mention sensitive concerns?
- did I avoid overloading the prompt?
- did I add only minimal extra control?

## Fast Default Pattern

1. Open [index.md](./index.md)
2. Choose one category file
3. Copy the closest prompt
4. Replace placeholders
5. Add one quality block only if needed
6. Add one optional line only if needed
