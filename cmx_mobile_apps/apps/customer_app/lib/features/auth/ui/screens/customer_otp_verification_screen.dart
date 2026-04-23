import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../providers/customer_otp_provider.dart';
import '../widgets/customer_otp_text_field_widget.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerOtpVerificationScreen extends StatefulWidget {
  const CustomerOtpVerificationScreen({super.key});

  @override
  State<CustomerOtpVerificationScreen> createState() =>
      _CustomerOtpVerificationScreenState();
}

class _CustomerOtpVerificationScreenState
    extends State<CustomerOtpVerificationScreen> {
  late final TextEditingController _textController;
  CustomerOtpProvider? _otpProvider;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _otpProvider ??= CustomerOtpProvider(CustomerAppScope.of(context));
  }

  @override
  void dispose() {
    _textController.dispose();
    _otpProvider?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final appController = CustomerAppScope.of(context);
    final otpProvider = _otpProvider!;
    final challenge = appController.pendingChallenge;

    return AnimatedBuilder(
      animation: otpProvider,
      builder: (context, _) {
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
                          onChanged: otpProvider.updateOtpCode,
                          errorText: otpProvider.errorMessageKey == null
                              ? null
                              : localizations
                                  .text(otpProvider.errorMessageKey!),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        SizedBox(
                          width: double.infinity,
                          child: AppCustomButtonWidget(
                            label: localizations.text('otpEntry.primaryAction'),
                            onPressed: () async {
                              final didVerify = await otpProvider.submit();
                              if (!context.mounted || !didVerify) {
                                return;
                              }

                              Navigator.of(context).pushNamedAndRemoveUntil(
                                AppRoute.home,
                                (route) => false,
                              );
                            },
                            icon: Icons.verified_outlined,
                            isLoading: otpProvider.isSubmitting,
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
      },
    );
  }
}
