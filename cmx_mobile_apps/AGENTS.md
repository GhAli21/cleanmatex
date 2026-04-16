# AGENTS FOR MOBILE.md

## Role
Generate production-grade Flutter code for the CleanMateX mobile app only.

## Core rules
- Respect existing project architecture and naming.
- Use feature-based organization.
- Use Riverpod for state management.
- Do not place direct Supabase, REST, or database calls inside UI widgets.
- Use provider → repository → data source flow.
- Keep backend as source of truth.
- Do not generate hidden or overly magical patterns by default.
- Prefer readable manual models and clear code.
- Reuse existing shared widgets and theme utilities.
- Use localization for every user-facing string.
- Support English and Arabic, including RTL.
- Do not hardcode colors, spacing, or strings.
- Do not rewrite unrelated files.

## Code generation constraints
- Favor maintainable code over clever code.
- Prefer small widgets and extracted sections.
- Always include loading, empty, error, and success handling.
- Use explicit typed models and typed method signatures.
- Normalize error handling instead of leaking raw backend payloads into UI.
- When appropriate, generate provider tests and widget tests.

## Folder expectations
Use and preserve structure similar to:

lib/
  core/
  features/
    <feature>/
      data/
        models/
        repositories/
        dbservices/
      domain/
      providers/
      ui/
        screens/
        widgets/
        cards/

## Widget expectations
- Use existing project reusable widgets first.
- Keep screens modular.
- Ensure dark mode safety when relevant.
- Ensure responsive and RTL-friendly layout behavior.

## Implementation sequence
For each feature request:
1. understand the requested feature
2. identify existing reusable code to leverage
3. map the needed files
4. explain assumptions
5. generate code

## Never do these
- never call API directly from widget onPressed handlers
- never hardcode English-only text
- never use dynamic or raw maps as primary app models
- never move business-critical backend logic into Flutter
- never create duplicate helper classes without checking existing code patterns
