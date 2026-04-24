import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../widgets/customer_otp_text_field_widget.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerOtpVerificationScreen extends ConsumerStatefulWidget {
  const CustomerOtpVerificationScreen({super.key});

  @override
  ConsumerState<CustomerOtpVerificationScreen> createState() =>
      _CustomerOtpVerificationScreenState();
}

class _CustomerOtpVerificationScreenState
    extends ConsumerState<CustomerOtpVerificationScreen> {
  late final TextEditingController _textController;
  bool _isSubmitting = false;
  String? _errorMessageKey;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController();
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final flow = ref.watch(customerSessionFlowProvider);
    final challenge = flow.pendingChallenge;

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('otpEntry.title')),
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
                      localizations.text('otpEntry.title'),
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      localizations.text('otpEntry.body'),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    if (challenge != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        challenge.phoneNumber,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    CustomerOtpTextFieldWidget(
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
                        label: localizations.text('otpEntry.primaryAction'),
                        onPressed: _isSubmitting ? null : () => _submit(context),
                        icon: Icons.verified_outlined,
                        isLoading: _isSubmitting,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: AppCustomButtonWidget(
                        label: localizations.text('common.back'),
                        onPressed: () {
                          Navigator.of(context).pop();
                        },
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
    final normalizedOtp = _textController.text.trim();
    if (!RegExp(r'^[0-9]{6}$').hasMatch(normalizedOtp)) {
      setState(() {
        _errorMessageKey = 'otpEntry.codeValidationError';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessageKey = null;
    });

    try {
      await ref
          .read(customerSessionFlowProvider.notifier)
          .verifyOtpCode(otpCode: normalizedOtp);
      if (!context.mounted) return;

      // Offer set-password if session has a verification token (first login).
      final session = ref.read(customerSessionFlowProvider).session;
      final token = session?.verificationToken ?? '';
      if (token.isNotEmpty && !(session?.hasPassword ?? false)) {
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRoute.setPassword,
          (route) => false,
          arguments: token,
        );
      } else {
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRoute.home,
          (route) => false,
        );
      }
    } catch (_) {
      if (!context.mounted) return;
      setState(() => _errorMessageKey = 'otpEntry.genericError');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}
