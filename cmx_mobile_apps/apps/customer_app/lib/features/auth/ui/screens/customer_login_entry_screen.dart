import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../../core/providers/network_providers.dart';
import '../widgets/customer_phone_text_field_widget.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../../tenant/providers/tenant_provider.dart';

class CustomerLoginEntryScreen extends ConsumerStatefulWidget {
  const CustomerLoginEntryScreen({super.key, this.initialPhoneNumber = ''});

  final String initialPhoneNumber;

  @override
  ConsumerState<CustomerLoginEntryScreen> createState() =>
      _CustomerLoginEntryScreenState();
}

class _CustomerLoginEntryScreenState
    extends ConsumerState<CustomerLoginEntryScreen> {
  late final TextEditingController _textController;
  bool _isSubmitting = false;
  String? _errorMessageKey;
  bool _hasPassword = false;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.initialPhoneNumber);
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('loginEntry.title')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: AppCardWidget(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.text('loginEntry.title'),
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      localizations.text('loginEntry.body'),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    CustomerPhoneTextFieldWidget(
                      controller: _textController,
                      onChanged: (v) {
                        if (_errorMessageKey != null) {
                          setState(() => _errorMessageKey = null);
                        }
                      },
                      errorText: _errorMessageKey == null
                          ? null
                          : localizations.text(_errorMessageKey!),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      child: AppCustomButtonWidget(
                        label: localizations.text('loginEntry.primaryAction'),
                        onPressed: _isSubmitting ? null : () => _submit(context),
                        icon: Icons.lock_open_outlined,
                        isLoading: _isSubmitting,
                      ),
                    ),
                    if (_hasPassword) ...[
                      const SizedBox(height: AppSpacing.sm),
                      SizedBox(
                        width: double.infinity,
                        child: AppCustomButtonWidget(
                          label: localizations.text('auth.signInWithPasswordAction'),
                          onPressed: _isSubmitting
                              ? null
                              : () => Navigator.of(context).pushNamed(
                                    AppRoute.passwordLogin,
                                    arguments: _textController.text
                                        .replaceAll(RegExp(r'\s+'), ''),
                                  ),
                          isPrimary: false,
                          icon: Icons.password_outlined,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: AppCustomButtonWidget(
                        label: localizations.text('common.back'),
                        onPressed: () => Navigator.of(context).pop(),
                        isPrimary: false,
                      ),
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

  Future<void> _submit(BuildContext context) async {
    final normalized = _textController.text.replaceAll(RegExp(r'\s+'), '');

    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(normalized)) {
      setState(() => _errorMessageKey = 'loginEntry.phoneValidationError');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessageKey = null;
    });

    // Check password availability in parallel with no error on failure (best-effort).
    _checkHasPassword(normalized);

    try {
      await ref
          .read(customerSessionFlowProvider.notifier)
          .signInWithPhone(phoneNumber: normalized);
      if (!context.mounted) return;
      Navigator.of(context).pushNamed(AppRoute.otpVerify);
    } catch (_) {
      if (!context.mounted) return;
      setState(() => _errorMessageKey = 'loginEntry.genericError');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _checkHasPassword(String phone) async {
    try {
      final tenant = ref.read(tenantProvider).valueOrNull;
      if (tenant == null) return;
      final has = await ref
          .read(customerAuthRepositoryProvider)
          .checkHasPassword(phoneNumber: phone, tenantId: tenant.tenantOrgId);
      if (mounted) setState(() => _hasPassword = has);
    } catch (_) {
      // best-effort — never block login flow
    }
  }
}
