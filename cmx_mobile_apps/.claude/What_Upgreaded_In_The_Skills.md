All 6 skills updated. Here's what changed in each and why:

flutter-foundation — Major upgrade
Added Stack Facts table (actual versions: flutter_riverpod ^2.5.1, http ^1.2.2 not Dio, onGenerateRoute not go_router)
Removed incorrect rule: _vw.dart is valid (display-only widgets) — the old skill banned it as an anti-pattern, which contradicted the rules docs
Removed _view.dart as valid — it's not used in this codebase
Added _remote_datasource.dart / _local_datasource.dart to the naming table
Added supabase_flutter ban explicitly
Added full AppException hierarchy with code
Added ProviderObserver requirement
Added ref.select and autoDispose guidance
Added Melos commands section
Added go_router / auto_route / Dio to anti-patterns explicitly
mobile-architecture — Major upgrade
Fixed: removed Dio client from mobile_services description → MobileHttpClient (wraps http ^1.2.2)
Fixed: removed _view.dart from canonical names → correct table with _vw.dart
Added full workspace layout tree matching actual repo structure
Added package responsibilities table with "Must NOT import" column
Added dependency direction diagram
Added pubspec_overrides.yaml are committed (not gitignored)
Added Melos commands + adding-a-new-package steps
Fixed anti-patterns: _vw.dart was incorrectly listed as bad — removed
mobile-i18n-rtl — Major upgrade
Added how AppLocalizations actually works — inline _localizedValues map in app_localizations.dart, no JSON files, no code generation
Added AppLocalizations.of(context) usage code (no bang operator, with explicit explanation)
Added customerLocaleProvider.notifier.toggleLocale() locale switching pattern
Added EdgeInsetsDirectional / AlignmentDirectional requirement for RTL-sensitive layouts
Added textDirection usage pattern from AppLocalizations
mobile-testing — Major upgrade
Added all Melos validation commands (melos analyze, melos format --check, melos test)
Added TestAppWrapper usage with actual code pattern
Added ProviderContainer + fake overrides unit test pattern
Added coverage targets table (80%/70%/60%)
Added AppException mapping test example
Added anti-pattern: widget tests without TestAppWrapper miss theme/localization
mobile-ui-system — Significant upgrade
Fixed widget list: AppLoadingIndicator → AppLoadingIndicatorWidget (correct name with Widget suffix)
Fixed widget list: AppCustomDateField → AppCustomDateFieldWidget, AppDatePickerButton → AppDatePickerButtonWidget, etc.
Removed AppFltrMapWidget and CustomSwitch (inconsistent, non-standard names)
Added design tokens table with actual values (AppSpacing.xs=4, etc.)
Added screen state implementation code with AppErrorWidget and AppException.messageKey
Added responsive layout section with AppBreakpoints
Added ref.select performance pattern
Added accessibility rules (44×44, WCAG contrast, text scale)
Added ConsumerWidget/const requirement
mobile-customer-ux — Significant upgrade
Added Implemented Routes table with actual AppRoute constants from the codebase
Added Session and Entry Flow section describing the actual bootstrap sequence
Added auth flow detail (phone + OTP → flutter_secure_storage)
Added tenant discovery/confirm flow description
Added screen state requirements table
Added localization/accessibility requirements