# AGENTS.md — CleanMateX Flutter Mobile Apps

## Scope
This file governs AI coding assistants working on the CleanMateX Flutter mobile apps:
- Customer App
- Driver App

The target is production-grade code, not prototypes.

## Product Context
CleanMateX is a multi-tenant SaaS for laundry and dry cleaning operations with:
- customer mobile app
- driver mobile app
- web admin
- backend APIs
- bilingual English/Arabic support
- RTL support
- notifications
- offline tolerance in mobile flows
- role-aware experiences
- GCC-first operational design

The mobile apps must support operational reliability, not just visual polish.

## Technology Direction
Use:
- Flutter stable
- Dart null safety
- Riverpod
- go_router
- centralized networking layer
- typed models
- manual serialization and mapping
- reusable core widgets and theming

Do not introduce alternate stacks or inconsistent patterns without explicit approval.

## Architecture Rules
Use feature-first architecture:

lib/
  core/
  features/

Each feature should typically contain:
- data
- domain
- application
- presentation

Do not mix unrelated concerns in one file.
Do not bypass repositories/providers by calling services directly from widgets.

## Coding Priorities
Prioritize in this order:
1. correctness
2. maintainability
3. resilience
4. clarity
5. performance
6. elegance

Do not optimize for flashy abstractions.
Do not optimize for cleverness.
Optimize for a solo developer maintaining the codebase long-term.

## UI/UX Priorities
Mobile screens must:
- be fast to use
- minimize taps
- support Arabic RTL properly
- handle loading/empty/error states
- preserve input during failures
- support operational workflows clearly

Avoid visual clutter and unstable layout patterns.

## Localization Rules
- Never hardcode user-facing strings.
- Add both English and Arabic keys for any new UI text.
- Respect RTL in layout and interaction patterns.
- Avoid unsafe string concatenation.

## Data and API Rules
- APIs are consumed via repositories/datasources only.
- Use typed request/response models.
- Parse JSON at boundaries manually.
- Convert network/server failures into structured app-safe errors.
- Do not expose raw server errors to users.

## Error Handling
Always handle:
- loading
- success
- empty
- validation failure
- no internet
- timeout
- unauthorized
- server error

Never silently swallow exceptions.

## Offline and Resilience
Assume weak connectivity is real.

For relevant flows:
- preserve form input
- support retry
- queue pending actions where needed
- show pending/sync state clearly

Do not design critical flows as if network is always perfect.

## Security Rules
- Never hardcode secrets or credentials.
- Never log OTPs, tokens, passwords, or sensitive data.
- Respect backend authorization.
- Clear auth/session data correctly on logout.

## No Hidden Code Rule
- Do not use freezed.
- Do not use json_serializable.
- Do not use build_runner.
- Do not introduce `.g.dart` files.
- All model, mapping, and serialization code must be written manually and remain visible in the codebase.
- Prefer explicit code over magic.

## Output Expectations for AI
When generating or editing code:
- preserve architecture
- reuse existing shared widgets/services before inventing new ones
- keep code explicit and readable
- include localization updates when adding UI text
- include route/provider wiring when needed
- do not leave fake placeholders disguised as complete implementation
- do not introduce hidden codegen

When solving a task, think through:
- role using the feature
- source of state
- repository/API dependencies
- offline implications
- error states
- localization impact
- tenant/feature-flag implications

## What Good Output Looks Like
Good output includes:
- well-placed files
- complete wiring
- typed models
- clear provider/controller usage
- localized UI text
- error/loading/empty states
- sensible validation
- minimal duplication
- explicit manual mapping logic

Bad output includes:
- widget-level API calls
- giant screens
- raw JSON everywhere
- half-finished fake repos
- hardcoded strings
- ignoring RTL
- ignoring offline/network failures
- generated hidden code