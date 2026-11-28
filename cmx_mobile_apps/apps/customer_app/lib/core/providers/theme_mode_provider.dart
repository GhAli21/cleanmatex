import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../features/tenant/providers/tenant_provider.dart';

/// User-selected app appearance mode (`light`, `dark`, or `system`).
class CustomerThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => ThemeMode.system;

  void setThemeMode(ThemeMode mode) {
    state = mode;
  }
}

final customerThemeModeProvider =
    NotifierProvider<CustomerThemeModeNotifier, ThemeMode>(
  CustomerThemeModeNotifier.new,
);

/// Derives an optional WCAG-guarded per-Organization accent color override
/// from the currently active tenant.
final activeOrgThemeOverrideProvider = Provider<CmxOrgThemeOverride?>((ref) {
  final tenant = ref.watch(tenantProvider).valueOrNull;
  if (tenant == null) return null;
  if (tenant.primaryColor == null && tenant.logoUrl == null) return null;
  return CmxOrgThemeOverride(
    primaryHex: tenant.primaryColor,
    logoUrl: tenant.logoUrl,
  );
});
