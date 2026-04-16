# CLAUDE.md — CleanMateX Flutter Mobile Implementation Rules

## Main Goal
Help build CleanMateX Flutter mobile apps in a way that is:
- production-ready
- scalable
- explicit
- maintainable by one developer
- bilingual EN/AR
- operationally reliable
- fully transparent with no hidden generated code

## Apps in Scope
- Customer App
- Driver App

These apps are not generic consumer apps. They support real business operations such as:
- authentication
- customer profiles
- order creation and tracking
- pickup and delivery
- push notifications
- proof of delivery
- offline-tolerant field workflows

## Required Development Style

### Always do
- Use feature-based organization
- Keep business logic out of widgets
- Use Riverpod for state and DI
- Use repositories for data access
- Use typed models
- Handle loading/error/empty states
- Localize all user-facing strings
- Respect RTL layout
- Keep code readable and explicit
- Prefer reusable shared widgets
- Consider offline/network failure impact
- Write models and mappings manually

### Never do
- Put API calls in screens/widgets
- Hardcode strings
- Hardcode secrets
- Mix unrelated concerns in one file
- Introduce unnecessary abstractions
- Leave placeholder code pretending to be final
- Swallow exceptions silently
- Ignore tenant/role context
- Ignore feature flag implications
- Ignore Arabic layout impact
- Use freezed
- Use json_serializable
- Use build_runner
- Create `.g.dart` dependencies
- Hide important logic behind annotations or generation

## File Structure Preference

lib/
  core/
    constants/
    errors/
    helpers/
    localization/
    routing/
    services/
    theme/
    utils/
    widgets/
  features/
    auth/
    orders/
    customers/
    notifications/
    delivery/
    profile/
    ...

Each feature may include:
- data/
- domain/
- application/
- presentation/

## UI Rules
- Clean, operational, touch-friendly UI
- Low tap count
- Consistent spacing and hierarchy
- Safe handling of loading and failure
- Inputs should preserve user work
- Avoid bloated widget trees
- Extract widgets when they become noisy or reused

## Localization Rules
- Every new label/message/action must use localization keys
- Add both English and Arabic values
- Avoid fragile concatenation
- Support RTL intentionally, not accidentally

## Networking Rules
- Centralize API access
- Centralize auth/session handling
- Map errors into structured app errors
- Keep repositories as the boundary between app and backend
- No raw backend response handling in widgets

## Offline Rules
When relevant to the feature:
- preserve draft input
- support retry
- queue important actions
- expose sync/pending state
- assume field connectivity can be unreliable

Especially important for:
- driver flows
- proof of delivery
- order updates in motion
- photo capture + later sync

## Performance Rules
- Avoid unnecessary rebuilds
- Use const where possible
- Paginate long lists
- Debounce search
- Avoid expensive work in build()
- Dispose listeners/controllers properly

## No Hidden Code Rules
- All important logic must be visible in source code.
- Manual `fromJson`, `toJson`, `copyWith`, and equality are preferred.
- `equatable` is allowed.
- Annotation-driven model generation is forbidden.
- Generated parts are forbidden.
- Avoid magic-heavy libraries that reduce transparency.

## Quality Rules
Before considering a task complete, verify:
- architecture is preserved
- localization added
- routes/providers/repositories updated
- loading/error/empty states handled
- validation included
- no mock leftovers remain
- code is understandable without hidden magic

## Preferred Assistant Behavior
When asked to implement a feature:
1. infer the role and workflow
2. identify files to change
3. preserve existing patterns
4. generate complete wiring, not fragments
5. include localization changes
6. include provider/repository/screen updates together
7. avoid creating extra complexity unless justified

When asked to improve code:
- simplify first
- reduce duplication
- improve separation of concerns
- preserve functionality
- do not rewrite huge areas without reason