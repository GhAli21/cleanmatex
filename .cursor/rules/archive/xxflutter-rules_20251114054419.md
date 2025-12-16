# Flutter Mobile App Development Rules

## Overview
Comprehensive rules for Flutter mobile application development.

## Rules

### Project Structure
- Use domain-driven folders
- Organize by features: `lib/features/{feature_name}/`
- Separate UI, providers, and services within each feature
- Keep shared widgets in `lib/shared/widgets/`

### State Management
- Use Riverpod exclusively (no other state management libraries)
- Create StateNotifierProvider for complex state
- Use Provider for simple values
- Never use setState in large widgets

### Widget Best Practices
- Keep widgets small and focused (under 200 lines)
- Extract complex builds into separate methods
- Use const constructors where possible
- Prefer StatelessWidget over StatefulWidget

### Multi-Language Support
- Use easy_localization for i18n
- Never hardcode strings; always use translation keys
- Support English and Arabic locales
- Test RTL layout for Arabic interface

### API Integration
- Use Dio for HTTP requests
- Centralize API client in `lib/core/services/api_service.dart`
- Add interceptors for auth and logging
- Handle errors consistently

### Error Handling
- Create centralized error widgets
- Show user-friendly error messages
- Provide retry mechanisms where appropriate

### Navigation
- Use named routes
- Define routes in `lib/core/routes/app_router.dart`
- Pass data via route arguments, not global state

### Theming
- Define app theme in `lib/core/theme/app_theme.dart`
- Support light and dark modes
- Use Material 3 design system

### Performance
- Use CachedNetworkImage for network images
- Use ListView.builder for long lists
- Avoid unnecessary rebuilds
- Optimize image sizes

### Testing
- Write widget tests for UI components
- Test state management logic
- Test error scenarios
- Test RTL layout

## Don't Do This
- Don't use setState in large widgets
- Don't hardcode strings
- Don't ignore null safety
- Don't skip error handling
- Don't test on one device only
- Don't forget RTL support
- Don't rebuild unnecessarily
