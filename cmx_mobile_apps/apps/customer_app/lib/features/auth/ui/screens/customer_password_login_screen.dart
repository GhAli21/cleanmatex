import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../providers/customer_password_login_provider.dart';

class CustomerPasswordLoginScreen extends ConsumerWidget {
  const CustomerPasswordLoginScreen({
    super.key,
    required this.phoneNumber,
  });

  final String phoneNumber;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final state = ref.watch(customerPasswordLoginProvider);
    final textTheme = Theme.of(context).textTheme;

    ref.listen(customerPasswordLoginProvider, (prev, next) {
      if (!next.isSubmitting && prev?.isSubmitting == true && next.errorMessageKey == null) {
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRoute.home,
          (route) => false,
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('auth.passwordLoginTitle')),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppHeaderWidget(
              title: localizations.text('auth.passwordLoginTitle'),
              subtitle: phoneNumber,
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              obscureText: true,
              keyboardType: TextInputType.visiblePassword,
              textInputAction: TextInputAction.done,
              onChanged: (v) =>
                  ref.read(customerPasswordLoginProvider.notifier).updatePassword(v),
              decoration: InputDecoration(
                labelText: localizations.text('auth.passwordLabel'),
                hintText: localizations.text('auth.passwordHint'),
              ),
            ),
            if (state.errorMessageKey != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                localizations.text(state.errorMessageKey!),
                style: textTheme.bodyMedium?.copyWith(color: AppColors.error),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('auth.signInWithPasswordAction'),
                isLoading: state.isSubmitting,
                onPressed: state.isSubmitting
                    ? null
                    : () => ref
                        .read(customerPasswordLoginProvider.notifier)
                        .submit(phoneNumber: phoneNumber),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(localizations.text('auth.useOtpInsteadAction')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
