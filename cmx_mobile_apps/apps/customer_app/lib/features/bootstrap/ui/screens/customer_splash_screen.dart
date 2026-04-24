import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../tenant/providers/tenant_provider.dart';

class CustomerSplashScreen extends ConsumerStatefulWidget {
  const CustomerSplashScreen({super.key});

  @override
  ConsumerState<CustomerSplashScreen> createState() =>
      _CustomerSplashScreenState();
}

class _CustomerSplashScreenState extends ConsumerState<CustomerSplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      unawaited(_forwardAfterBootstrap());
    });
  }

  Future<void> _forwardAfterBootstrap() async {
    await ref.read(customerSessionFlowProvider.notifier).bootstrap();
    final tenant = await ref.read(tenantProvider.notifier).hydrateSavedTenant();
    await Future<void>.delayed(const Duration(milliseconds: 450));

    if (!mounted) {
      return;
    }

    final flow = ref.read(customerSessionFlowProvider);
    Navigator.of(context).pushReplacementNamed(
      resolveRouteAfterTenantBootstrap(flow: flow, tenant: tenant),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: AppCardWidget(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      localizations.text('app.title'),
                      style: Theme.of(context).textTheme.headlineMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      localizations.text('splash.body'),
                      style: Theme.of(context).textTheme.bodyLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    AppLoadingIndicator(
                      label: localizations.text('splash.status'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
