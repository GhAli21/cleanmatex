# CleanMateX Prompt Pack Index

Use these prompt templates when you want implementation-ready help that stays aligned with CleanMateX repository rules, architecture, and delivery standards.

## How To Use

- Replace placeholders like `[feature name]`, `[screen/module]`, and `[goal]`.
- Start with the narrowest prompt that matches what you actually want.
- Combine prompts only when the work genuinely crosses multiple concerns.
- Add one or two reusable quality blocks or add-on lines when you need tighter control.

## Prompt Tips

- Be explicit about whether you want planning only, review only, or implementation.
- Name the exact file, screen, route, flow, or feature whenever possible.
- If you want stricter output, ask for `findings first`, `must-fix only`, or `wait for approval before coding`.
- For high-quality answers, ask for tradeoffs and hidden requirements instead of only asking for recommendations.

## Cross-Cutting Quality Principle

Across all prompts, prefer solutions that are maintainable, supportable, production-ready, and easy for the team to operate over clever but fragile designs.

When relevant, ask the evaluation to:
- identify anything that increases long-term maintenance cost, support burden, operational complexity, or release risk
- recommend the most practical solution that can be safely owned by the team over time
- favor designs that are easy to debug, monitor, test, and hand off to future developers

## Prompt And Skill Relationship

Prompts do not replace repository rules or domain skills. Use prompts to frame the task, and still apply the relevant repo guidance and domain skills such as `/frontend`, `/backend`, `/database`, `/i18n`, `/multitenancy`, `/implementation`, and `/documentation` when the work touches those areas.

## Files

- [Prompt Creation Guide](./prompt_creation_guide.md)
  Use when you want a step-by-step guide for choosing, adapting, or creating the right prompt.
- [Prompt Creation Cheat Sheet](./prompt_creation_cheat_sheet.md)
  Use when you want the shortest daily reference for choosing and adapting prompts quickly.
- [Prompt Examples Gallery](./prompt_examples_gallery.md)
  Use when you want finished example prompts for common CleanMateX scenarios.
- [Build Prompt Skill Guide](./build_prompt_skill_guide.md)
  Use when you want to use the `build-prompt` skill instead of browsing the prompt docs manually.
- [Reusable Quality Blocks](./reusable-quality-blocks.md)
  Use for shared quality requirements, review output shape, evaluation rules, and optional add-on lines.
- [Build Prompts](./build-prompts.md)
  Use for planning, implementation, refactoring, and continuing in-progress work.
- [Review Prompts](./review-prompts.md)
  Use for QA, code review, bug investigation, proactive gap hunting, release readiness, performance, and security review.
- [UI / UX Prompts](./ui-ux-prompts.md)
  Use for screen design, redesign, UX critique, accessibility, responsive behavior, component selection, and microcopy.
- [Data / API Prompts](./data-api-prompts.md)
  Use for migration planning, API contracts, and data model / ERD work.
- [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)
  Use for documentation, PRD/spec writing, and multi-perspective evaluation.

## Quick Routing

- How do I create or choose a prompt? [Prompt Creation Guide](./prompt_creation_guide.md)
- Need the short version? [Prompt Creation Cheat Sheet](./prompt_creation_cheat_sheet.md)
- Need finished examples? [Prompt Examples Gallery](./prompt_examples_gallery.md)
- Want to use the skill instead? [Build Prompt Skill Guide](./build_prompt_skill_guide.md)
- Build: [Build Prompts](./build-prompts.md)
- Review: [Review Prompts](./review-prompts.md)
- Data / API: [Data / API Prompts](./data-api-prompts.md)
- UI / UX: [UI / UX Prompts](./ui-ux-prompts.md)
- Strategy / Evaluation: [Strategy / Evaluation Prompts](./strategy-evaluation-prompts.md)
- Reusable Controls: [Reusable Quality Blocks](./reusable-quality-blocks.md)
