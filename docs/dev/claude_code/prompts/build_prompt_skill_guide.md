# Build Prompt Skill Guide

Use this guide when you want to use the `build-prompt` skill instead of manually browsing the prompt docs.

## What The Skill Does

The `build-prompt` skill helps you:

- identify the real goal of your request
- choose the smallest matching prompt category
- pick the closest existing prompt
- map the task to the right repo domain skills
- suggest useful quality blocks or add-on lines
- produce one final assembled prompt

It is a convenience layer on top of the prompt docs. It does not replace them.

## What The Skill Does Not Replace

The skill does not replace:

- repository rules in `AGENTS.md` or `CLAUDE.md`
- domain skills such as `/frontend`, `/backend`, `/database`, `/i18n`, `/multitenancy`, `/implementation`, or `/documentation`
- the prompt docs themselves when you want to study or compare options

Think of it like this:

- docs = reference library
- skill = prompt assistant

## When To Use The Skill

Use the skill when:

- you know roughly what you want, but not which prompt to choose
- you want a polished final prompt quickly
- you want help deciding between planning, implementation, review, UX, bug-hunt, or evaluation framing
- you want the relevant repo skills called out automatically

Do not use the skill when:

- you already know the exact prompt you want
- you want to study all prompt options manually
- you want to browse examples or learn the system in depth

## Best Way To Ask

Good requests for the skill:

- `Use $build-prompt to create the best prompt for reviewing the order payment modal from UX, operations, and accounting perspectives.`
- `Use $build-prompt to build a prompt for investigating a wallet settlement bug with minimal diff and strong regression awareness.`
- `Use $build-prompt to create a feature-planning prompt for a customer wallet ledger feature in CleanMateX.`

Less effective requests:

- `Use $build-prompt for this.`
- `Make me something.`

The more specific your scope is, the better the final prompt will be.

## What To Include In Your Request

Try to include:

- exact feature, screen, flow, route, or file area
- whether you want planning, implementation, review, fix, inspection, design, modeling, or evaluation
- any especially sensitive concerns:
  - finance
  - accounting
  - permissions
  - tenant safety
  - UX
  - production readiness
  - supportability

## Expected Output

The skill should usually return:

1. recommended prompt type
2. relevant repo skills to keep in mind
3. final assembled prompt
4. optional extra quality block or add-on suggestions if useful

## Example Flows

### Example 1: I need a prompt but I do not know the type

You say:

```md
Use $build-prompt to create the right prompt for checking the order payment modal for UX, accounting correctness, missing states, and production risks.
```

Expected direction:

- likely chooses `Multi-Perspective Evaluation Prompt` or `Screen UX Review Prompt`
- suggests skills like `/frontend`, `/i18n`, and maybe `/business-logic`
- returns a final assembled prompt

### Example 2: I know it is a bug, but want better framing

You say:

```md
Use $build-prompt to create a prompt for investigating duplicate wallet credits after payment retry.
```

Expected direction:

- chooses `Bug Investigation Prompt`
- may suggest `/backend`, `/database`, `/multitenancy`, `/implementation`
- may add `Focus on minimal diff and reuse existing patterns aggressively.`

### Example 3: I want proactive issue finding

You say:

```md
Use $build-prompt to create a prompt for inspecting the order submit flow for hidden bugs, permission gaps, missing states, and production fragility.
```

Expected direction:

- chooses `Gap / Bug Hunt Prompt`
- suggests `/implementation`, `/frontend`, `/backend`, or `/multitenancy` depending on scope

## When To Use Docs Instead

Use the docs instead of the skill when you want:

- the full learning path -> [Prompt Creation Guide](./prompt_creation_guide.md)
- the shortest reminder -> [Prompt Creation Cheat Sheet](./prompt_creation_cheat_sheet.md)
- category browsing -> [Prompt Pack Index](./index.md)
- reusable quality blocks -> [Reusable Quality Blocks](./reusable-quality-blocks.md)
- ready-made examples -> [Prompt Examples Gallery](./prompt_examples_gallery.md)

## Recommended Workflow

Best practical workflow:

1. learn from the guide or cheat sheet
2. use docs directly when you know the right prompt
3. use `build-prompt` when you want speed, selection help, or final prompt assembly

## Final Advice

The skill is best for reducing friction, not replacing judgment.

If the scope is unclear, narrow it first.
If the task crosses many domains, let the skill assemble the prompt, but still apply the correct repo skills afterward.
