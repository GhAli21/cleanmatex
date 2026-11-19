# cmx-ui-design-review

Review (or, when the user asks, fix) web-admin UI against the Cmx design system: a component, page, screen, dialog, form, table, report, print view or chart.

1. Load `.cursor/skills/cmx-ui-design-review/SKILL.md`. The same text is in `.claude/skills/`, `.codex/skills/` and `.agents/skills/`.
2. The rules are in `docs/dev/rules/cmx-design-system.md`. Every finding cites its section.
3. Pick the target: the files, route or component the user named. If they named nothing, use the changed UI files.
4. Run the tools on the target, from `web-admin`:
   - `node scripts/ui/check-design-system.js <files>`
   - `npx eslint <files> --quiet`
5. Read the code for what the tools miss.
6. Report Critical / Important / Minor, each with file:line and the fix. Add the debt seen and what was not checked.
7. Change nothing unless the user asks for fixes.

This command is available in chat with /cmx-ui-design-review.
