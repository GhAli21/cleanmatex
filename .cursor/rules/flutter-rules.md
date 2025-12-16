# Flutter Development Rules

## Overview
Mobile development standards for CleanMateX using Flutter.

## Rules

### Architecture
- Use Riverpod for state management
- Structure into `screens/`, `widgets/`, `providers/`, `services/` directories
- Follow domain-driven folder structure

### UI & UX
- Prefer stateless widgets
- Use responsive design via `LayoutBuilder` and `MediaQuery`
- Keep widgets small and focused

### Logic & Assets
- Separate business logic from UI
- Use `Freezed` and `json_serializable` for models
- Store assets in `assets/` and declare in `pubspec.yaml`

### Internationalization
- Use `intl` for i18n and RTL support
- Load locale from user profile
- Never hardcode strings; use translation keys

## Conventions
- Use domain-driven folders
- Keep widgets under 200 lines
- Extract complex builds into separate methods
- Use const constructors where possible
