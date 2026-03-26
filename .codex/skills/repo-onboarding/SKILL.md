---
name: repo-onboarding
description: Understand the repository before making changes
---

# Purpose
Use this skill when starting work in an unfamiliar or complex repository.

# Steps
1. Inspect repository structure.
2. Identify main apps, modules, domains, and shared layers.
3. Determine how to run the project.
4. Determine how to lint, typecheck, test, and build the project.
5. Identify risky or sensitive areas:
   - auth
   - tenant boundaries
   - billing / plans
   - permissions
   - database schema
   - CI/CD
6. Summarize likely conventions:
   - naming
   - foldering
   - component reuse patterns
   - state/data-fetching patterns
7. Return:
   - architecture summary
   - key entry points
   - important commands
   - sensitive areas
   - suggested AGENTS.md improvements

# Rules
- Do not change files.
- Do not speculate wildly.
- Prefer evidence from the codebase.