---
name: build-prompt
description: Choose, adapt, and assemble the right CleanMateX prompt from the repo prompt pack. Use when deciding which prompt to use, turning a rough request into a stronger prompt, selecting quality blocks or add-on lines, or mapping a task to the right repo domain skills such as frontend, backend, database, i18n, multitenancy, implementation, or documentation.
user-invocable: true
---

# Build Prompt

Use this skill to turn a rough request into a cleaner CleanMateX prompt without manually stitching the prompt pack together.

## Canonical docs

- Prompt index: `docs/dev/claude_code/prompts/index.md`
- Prompt creation guide: `docs/dev/claude_code/prompts/prompt_creation_guide.md`
- Prompt cheat sheet: `docs/dev/claude_code/prompts/prompt_creation_cheat_sheet.md`
- Shared quality blocks: `docs/dev/claude_code/prompts/reusable-quality-blocks.md`

## Read only what you need

- If the user asks how to create a prompt, read the creation guide or cheat sheet first.
- If the user already knows the goal, read `index.md` and only the matching prompt category file.
- Read `reusable-quality-blocks.md` only when the user wants sharper output, stricter review structure, or better evaluation rigor.

## Workflow

1. Identify the real goal:
   - `plan`
   - `build`
   - `review`
   - `fix`
   - `inspect`
   - `design`
   - `model`
   - `strategy`
2. Choose the smallest matching prompt file:
   - `build-prompts.md`
   - `review-prompts.md`
   - `ui-ux-prompts.md`
   - `data-api-prompts.md`
   - `strategy-evaluation-prompts.md`
3. Pick the closest existing prompt instead of starting blank.
4. Replace placeholders with exact scope:
   - feature
   - screen
   - flow
   - route
   - module
   - file area
5. Map the task to repo domain skills. Prompts do not replace skills:
   - frontend -> `/frontend`
   - backend or API -> `/backend`
   - migrations or schema -> `/database`
   - tenant-sensitive logic -> `/multitenancy`
   - translations or copy -> `/i18n`
   - feature delivery -> `/implementation`
   - docs -> `/documentation`
6. Add only the minimum extra control needed:
   - a quality block
   - a review output contract
   - one or two add-on lines
7. Return a final prompt that is narrow, repository-aware, and ready to use.

## Prompt routing

Use this quick map:

- New feature blueprint -> `Feature Planning Prompt`
- Code plus plan -> `Feature Execution Prompt`
- Known defect -> `Bug Investigation Prompt`
- Proactive issue sweep -> `Gap / Bug Hunt Prompt`
- Existing screen critique -> `Screen UX Review Prompt`
- Stronger redesign direction -> `Screen Redesign Prompt`
- Finance + accounting + ops + UX assessment -> `Multi-Perspective Evaluation Prompt`
- Schema planning -> `Migration Design Prompt` or `Data Model / ERD Prompt`
- API shape design -> `API Contract Prompt`

## Output shape

When building a prompt, return:

1. Recommended prompt type
2. Relevant repo skills to keep in mind
3. Final assembled prompt
4. Optional extra quality block or add-on suggestions only if useful

## Guardrails

- Do not load every prompt file unless the user truly needs a broad survey.
- Prefer the smallest relevant prompt file to reduce context cost.
- Do not replace repo rules or domain skills with prompt wording.
- Keep final prompts specific and avoid mixing too many goals at once.
