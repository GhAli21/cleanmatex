# CLAUDE_MOBILE.md

## CleanMateX Mobile App Rules (Flutter Only)

### Mission
Build production-grade Flutter mobile apps for CleanMateX with:
- clean feature-based architecture
- strong typing
- reusable widgets
- multilingual support
- RTL support
- maintainable code
- backend-first business rules
- scalable state management

The app must be optimized for long-term growth, not quick demos.

---

## Non-Negotiable Rules

### Backend is the source of truth
Do not place core business logic in Flutter.

Flutter may:
- collect input
- validate basic form structure
- display data
- orchestrate calls
- queue offline actions

Flutter must not:
- define final pricing
- enforce workflow transitions as authority
- approve permissions as final authority
- calculate finance-critical totals as source of truth
- bypass backend validations

### Never generate random structure
All code must follow the existing project structure and reusable patterns already used in the app.

Do not invent a new architecture when extending an existing feature.

### Reuse before creating
Before generating a new widget, service, provider, or helper:
1. check whether an equivalent already exists
2. extend existing reusable code if suitable
3. only create new code if truly necessary

No duplicate widgets with different names but same behavior.

### No hardcoded UI text
All labels, buttons, messages, errors, placeholders, titles, and dialog text must be localized.

Use:
```dart
AppLocalizations.of(context)!
```

Do not hardcode English or Arabic strings in widgets.

### No hardcoded colors, fonts, or spacing
Use project theme system only:
- AppTheme
- AppColors
- existing spacing and text style patterns

Do not inline arbitrary colors unless explicitly requested.

---

## Required Flutter Architecture

### Feature-based folder structure
Use this style:

```text
lib/
  core/
    theme/
    widgets/
    services/
    utils/
    constants/
  features/
    feature_name/
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
```

Follow the same pattern already used in the project.

### Layer responsibilities

#### UI layer
Responsible for:
- rendering widgets
- collecting input
- showing loading/error/success states
- navigation triggers

Must not:
- call database directly
- contain business rules
- parse complex backend payloads inline

#### Providers layer
Responsible for:
- state management
- async loading lifecycle
- action orchestration
- exposing clean UI state

#### Data layer
Responsible for:
- models
- repositories
- dbservices
- mapping raw backend data

#### Domain layer
Responsible for:
- app-specific business abstractions
- entities
- reusable logic that is not tied to widget tree

---

## State Management Rules

### Use Riverpod only
Use the project’s Riverpod approach consistently.

Do not introduce:
- Bloc
- GetX
- MobX
- Provider package
- ad hoc state patterns

### No business-state setState
setState is acceptable only for tiny local UI concerns such as:
- tab selection
- local expand/collapse
- temporary visual toggles

Do not use setState for:
- fetching data
- form submission lifecycle
- entity lists
- global/shared feature state

### Async state must be explicit
Every async feature must clearly support:
- loading
- success
- empty
- error
- retry

No silent failure.

### Provider naming clarity
Use meaningful names such as:
- customerOrdersProvider
- createOrderProvider
- selectedBranchProvider

Avoid vague names like:
- dataProvider
- mainProvider
- tempProvider

---

## Widget Rules

### Prefer reusable widgets from project core
Use existing widgets such as:
- AppTextFieldWidget
- AppCustomButtonWidget
- AppCustomDateField
- AppDatePickerButton
- AppDropdown
- AppFltrMapWidget
- AppCardWidget
- AppCheckBoxListTileWidget
- CustomSwitch
- AppHeaderWidget
- AppLoadingIndicator

Do not replace them with raw Material widgets unless there is a clear need.

### Widgets must be small and focused
Split large screens into:
- screen
- sections
- cards
- form widgets
- row widgets

Avoid giant files with hundreds of lines of mixed UI.

### Extract repeated UI immediately
If a UI block repeats more than once, extract it.

### Always handle all visual states
Each screen should deliberately support:
- loading
- no data
- error
- populated state

Do not return blank containers for missing states.

---

## Model Rules

### Strong typing only
Do not use loosely typed maps across the feature.

Avoid:
```dart
Map<String, dynamic> item;
dynamic response;
```

Prefer explicit models.

### Manual models are acceptable and preferred when clearer
Because hidden generated code is not preferred, default to clear manual models unless the feature strongly benefits from generators.

Preferred style:
```dart
class OrderModel {
  final String id;
  final String status;
  final DateTime? createdAt;

  OrderModel({
    required this.id,
    required this.status,
    this.createdAt,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
```

### Model names must be domain-clear
Use:
- CustomerModel
- OrderItemModel
- DeliveryRouteModel

Avoid:
- DataModel
- GeneralModel
- InfoModel

---

## API / Repository Rules

### No direct API/database call inside UI
Never do this inside a widget:
```dart
await supabase.from('orders').insert({...});
```

Use provider → repository → dbservice flow.

### Repository must abstract data source
The UI should not care whether data comes from:
- Supabase
- REST API
- local cache
- mock

Keep that behind repository boundaries.

### Error handling must be normalized
Repositories should return predictable outputs or throw predictable exceptions.

Do not let raw backend errors leak straight into UI wording.

### Pagination-ready by design
For lists that can grow, design with pagination or lazy loading in mind from the start.

---

## Form Rules

### Strong validation
Forms must include:
- required checks
- type checks
- range checks where needed
- friendly error messages
- submit disable/loading handling

### Keep validation split
Use:
- UI validation for basic input quality
- backend validation for authoritative rules

### No multi-step form chaos
For long forms:
- break into sections
- use reusable field widgets
- keep submit orchestration outside field widgets

---

## Navigation Rules

### Use project routing standard
If the feature uses go_router, follow it consistently.

Do not mix multiple navigation strategies unless project already does.

### Navigation should not carry raw fragile maps
Pass:
- ids
- typed params
- route-safe values

Do not pass giant mutable structures through routes unless necessary.

---

## Localization and RTL Rules

### Every new feature must include localization keys
When adding UI, also provide:
- English keys
- Arabic keys

Only include newly added keys when updating localization files.

### RTL must be considered in layout
Do not force left/right assumptions in:
- padding
- row alignment
- icons placement
- back arrows
- text alignment

Use direction-aware layout patterns.

### Arabic UI must not be treated as afterthought
Design must work equally in EN and AR.

---

## Theming Rules

### Theme consistency is mandatory
Use project theme utilities.

Do not hardcode:
- font sizes everywhere
- border radii everywhere
- container decoration everywhere

Extract style patterns into reusable styles when needed.

### Dark mode compatibility
All UI must be compatible with dark mode if the project supports it.

---

## Offline and Sync Rules

### Offline support must be intentional
For mobile-critical features, think about:
- cache
- pending actions
- retry
- sync conflicts

### Offline does not mean authority
Offline queue can store intent, but final acceptance must come from backend.

### Duplicate submission prevention
Any critical submit action should guard against:
- multiple taps
- duplicate requests
- stale form state

---

## Performance Rules

### Avoid unnecessary rebuilds
Use:
- const constructors
- focused providers
- extracted widgets
- memoized computations when needed

### Large lists must be optimized
Use builders and lazy loading patterns.

### Do not overfetch
Fetch only what the screen needs.

---

## Testing Rules

### Generate testable code
Code should be written so it can be tested without rewriting architecture later.

### Minimum expected tests
For meaningful features, generate:
- provider tests
- repository tests where logic exists
- widget tests for important UI flows

---

## CleanMateX-Specific Mobile Rules

### Respect user roles
UI and actions must adapt to role and permission context.

Relevant roles may include:
- admin
- staff
- driver
- customer
- business operator

Do not expose actions blindly.

### Respect customer engagement levels
The mobile app ecosystem must support customer types such as:
- guest
- stub profile
- full profile
- B2B-linked users

Do not assume every user is a fully registered app-first user.

### Respect workflow stages
UI must reflect configured workflow states and not invent its own simplified truth.

### Support bilingual and GCC-first usage
The mobile stack must remain aligned with EN/AR, RTL, GCC operational expectations, and the overall technical direction defined for CleanMateX.

---

## AI Assistant Behavior Rules

### Before generating code, always do this
1. understand the feature goal
2. identify impacted layers
3. propose file structure
4. explain approach
5. then generate code

### Do not rewrite unrelated code
Only change what is necessary.

### Prefer extension over replacement
If a screen or provider exists, extend it safely instead of replacing it with a brand-new pattern.

### No fake completeness
If something depends on backend/API that does not exist yet:
- say so clearly
- scaffold correctly
- do not pretend it is fully wired

---

## Output Style Rules for AI

When asked to implement a Flutter feature, always provide in this order:
1. feature summary
2. architecture impact
3. files to create/update
4. full code
5. localization keys
6. notes about backend assumptions
7. test recommendations
