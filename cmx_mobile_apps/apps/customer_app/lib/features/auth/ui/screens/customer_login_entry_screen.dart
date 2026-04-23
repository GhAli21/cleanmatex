import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../providers/customer_auth_provider.dart';
import '../widgets/customer_phone_text_field_widget.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerLoginEntryScreen extends StatefulWidget {
  const CustomerLoginEntryScreen({super.key});

  @override
  State<CustomerLoginEntryScreen> createState() =>
      _CustomerLoginEntryScreenState();
}

class _CustomerLoginEntryScreenState extends State<CustomerLoginEntryScreen> {
  late final TextEditingController _textController;
  CustomerAuthProvider? _authProvider;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _authProvider ??= CustomerAuthProvider(CustomerAppScope.of(context));
  }

  @override
  void dispose() {
    _textController.dispose();
    _authProvider?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final authProvider = _authProvider!;

    return AnimatedBuilder(
      animation: authProvider,
      builder: (context, _) {
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
                          onChanged: authProvider.updatePhoneNumber,
                          errorText: authProvider.errorMessageKey == null
                              ? null
                              : localizations.text(
                                  authProvider.errorMessageKey!,
                                ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        SizedBox(
                          width: double.infinity,
                          child: AppCustomButtonWidget(
                            label: localizations.text(
                              'loginEntry.primaryAction',
                            ),
                            onPressed: () async {
                              final didAuthenticate =
                                  await authProvider.submit();
                              if (!context.mounted || !didAuthenticate) {
                                return;
                              }

                              Navigator.of(context).pushNamed(
                                AppRoute.otpVerify,
                              );
                            },
                            icon: Icons.lock_open_outlined,
                            isLoading: authProvider.isSubmitting,
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
