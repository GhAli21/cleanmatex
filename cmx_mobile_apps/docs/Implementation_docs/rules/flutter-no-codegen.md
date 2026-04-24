---
description: Strict rule to forbid hidden/generated code in CleanMateX Flutter apps
globs:
  - "cmx_mobile_apps/apps/customer_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/staff_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/driver_app/lib/**/*.dart"
  - "cmx_mobile_apps/packages/**/*.dart"
alwaysApply: true
---

# CleanMateX Flutter No Code Generation Rules

## Core Principle

All code must be explicit, readable, and fully visible in source files.

No hidden code. No generated code. No magic.

## Forbidden Tools / Packages

Do NOT use:
- `freezed`
- `json_serializable`
- `built_value`
- `mobx_codegen`
- `injectable` (generator variant)
- `auto_route` (uses code generation)
- Any package that requires `build_runner` for models, unions, DI, or serialization
- Any generator that creates hidden runtime or mapping behavior

If a package requires `build_runner`, reject it unless explicitly approved by the project owner.

## Forbidden Patterns

- No `.g.dart` files anywhere in `cmx_mobile_apps/`
- No `part 'model.g.dart';`
- No `part 'model.freezed.dart';`
- No `@JsonSerializable()`
- No `@freezed`
- No generated unions / sealed-state code
- No hidden mapping logic
- No annotation-driven model generation
- No hidden DI registration generation

## Required Alternative: Manual Models

All models must be written manually. Every model must include, where needed:

- `const` constructor
- `fromJson(Map<String, Object?> json)` factory
- `toJson()` method
- `copyWith(...)` method
- `==` and `hashCode` override
- `toString()` override

Example:
```dart
class OrderSummaryModel {
  const OrderSummaryModel({
    required this.id,
    required this.status,
    required this.garmentCount,
    this.createdAt,
  });

  final String id;
  final String status;
  final int garmentCount;
  final DateTime? createdAt;

  factory OrderSummaryModel.fromJson(Map<String, Object?> json) {
    return OrderSummaryModel(
      id: json['id'] as String,
      status: json['status'] as String,
      garmentCount: (json['garment_count'] as num).toInt(),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'status': status,
        'garment_count': garmentCount,
        if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      };

  OrderSummaryModel copyWith({
    String? id,
    String? status,
    int? garmentCount,
    DateTime? createdAt,
  }) {
    return OrderSummaryModel(
      id: id ?? this.id,
      status: status ?? this.status,
      garmentCount: garmentCount ?? this.garmentCount,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrderSummaryModel &&
          other.id == id &&
          other.status == status &&
          other.garmentCount == garmentCount &&
          other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(id, status, garmentCount, createdAt);

  @override
  String toString() =>
      'OrderSummaryModel(id: $id, status: $status, garmentCount: $garmentCount)';
}
```

## Equality

- Manual `==` / `hashCode` is acceptable
- `equatable` package is acceptable — it does not require code generation
- Never use generated equality tools

## Manual Model Rules

- Use `Map<String, Object?>` (not `dynamic`) for JSON maps
- Cast explicitly: `as String`, `as String?` — no bang operator on JSON fields
- Convert `num` to `int`/`double` safely: `(json['x'] as num).toInt()`
- Keep JSON key names explicit — do not rely on magic field naming conventions
- UI must not know backend JSON structure — parse at the repository/data layer only
- Do not pass raw `Map<String, dynamic>` through the app — use typed models

## AI Behavior

Must:
- ALWAYS write full manual model implementations
- ALWAYS include explicit `fromJson` / `toJson` / `copyWith` when needed
- ALWAYS keep mapping logic visible in source code

Must NEVER:
- Suggest `freezed`
- Suggest `json_serializable`
- Suggest `build_runner`
- Generate `.g.dart` files
- Use annotation-driven patterns

If code generation is suggested or appears in a diff, reject it and rewrite manually.

## Rationale

Manual models give:
- Easier debugging — no hidden generated intermediaries
- No hidden behavior — every line of logic is visible
- Better AI code generation consistency — AI reads and writes real Dart, not annotations
- Fewer version conflicts — no generator version pinning required
- Easier onboarding and maintenance
- Full control over parsing logic
- Less toolchain friction — no `build_runner` watch processes or cache invalidation

The extra boilerplate is the accepted trade-off. Transparency and control outweigh saving a few lines.

## Anti-Patterns to Reject

- Models that rely on generated parts
- Hidden serializers attached via annotations
- Generated `copyWith`
- Generated unions for state classes
- Generated service locators
- Annotation-based DI registration
