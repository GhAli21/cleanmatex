# AGENTS FOR MOBILE.md

## Role
Generate production-grade Flutter code for the CleanMateX mobile app only.

Act as a top experienced and professional Flutter and mobile app engineer on every mobile task.

## Mandatory Skill Loading

Before writing mobile code, load the relevant mobile skill from `cmx_mobile_apps/.codex/skills/`.

Required mobile skills:

- `mobile-architecture`
- `flutter-foundation`
- `mobile-ui-system`
- `mobile-customer-ux`
- `mobile-i18n-rtl`
- `mobile-testing`

Task-to-skill rules:

- workspace layout, app-vs-package placement, shared package boundaries -> `mobile-architecture`
- app bootstrap, Riverpod, routing, repositories, session flow, config -> `flutter-foundation`
- theme, reusable widgets, screen composition, loading/empty/error/offline/success states -> `mobile-ui-system`
- customer onboarding, guest mode, tracking flow, booking flow, home/dashboard UX -> `mobile-customer-ux`
- user-facing strings, EN/AR copy, RTL layout behavior, localized formatting -> `mobile-i18n-rtl`
- test planning, validation scope, widget/integration coverage, production-readiness checks -> `mobile-testing`

If a change spans multiple areas, load all relevant skills before implementation.

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
- Ensure consistent theme, fonts, colors, spacing, formatting, and look and feel across the mobile workspace.
- Prefer maintainable reuse over one-off shortcuts.
- Use structured logging or `AppLogger`; do not use `print()` or `debugPrint()` in committed code.
- Always produce proper documentation for mobile work: keep roadmap state current, update current-state docs when scaffold/architecture changes, and document new rules, decisions, and implementation status in the appropriate mobile docs.
- A mobile task is not complete until its required documentation and progress or status updates are applied in the same task.
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
        db_services/
      domain/
      providers/
      ui/
        screens/
        widgets/
        cards/

## Widget expectations
- Use existing project reusable widgets first.
- Prefer canonical shared widget names such as `AppTextFieldWidget`, `AppCustomButtonWidget`, `AppCustomDateField`, `AppDatePickerButton`, `AppDropdown`, `AppFltrMapWidget`, `AppCardWidget`, `AppCheckBoxListTileWidget`, `CustomSwitch`, `AppHeaderWidget`, and `AppLoadingIndicator`.
- Do not create duplicate suffix variants such as `...WidgetWidget`.
- Keep screens modular.
- Ensure dark mode safety when relevant.
- Ensure responsive and RTL-friendly layout behavior.

## Naming and Nomenclature
- Use PascalCase for classes.
- Use camelCase for variables, functions, and methods.
- Use snake_case for file and directory names.
- Use UPPERCASE for environment variables.
- Start functions with verbs when possible.
- Use boolean names like `isLoading`, `hasError`, `canDelete`, `shouldRetry`.
- Prefer full words over abbreviations in file names. Use `_view.dart` instead of `_vw.dart`.
- Prefer `_repository.dart` over `_repo.dart` for repositories.
- Use `{model}_db_service.dart` for DB services.
- Avoid magic numbers; extract meaningful constants.

## Implementation sequence
For each feature request:
1. understand the requested feature
2. load the relevant mobile skill(s) first
3. identify existing reusable code to leverage
4. map the needed files
5. explain assumptions
6. generate code

## Never do these
- never call API directly from widget onPressed handlers
- never hardcode English-only text
- never use dynamic or raw maps as primary app models
- never move business-critical backend logic into Flutter
- never create duplicate helper classes without checking existing code patterns
- never use `print()` or `debugPrint()` for committed debugging output
