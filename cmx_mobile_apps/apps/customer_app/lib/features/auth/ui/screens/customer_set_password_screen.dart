import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../providers/customer_set_password_provider.dart';

class CustomerSetPasswordScreen extends ConsumerWidget {
  const CustomerSetPasswordScreen({
    super.key,
    required this.verificationToken,
  });

  final String verificationToken;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final state = ref.watch(customerSetPasswordProvider);
    final textTheme = Theme.of(context).textTheme;

    ref.listen(customerSetPasswordProvider, (prev, next) {
      if (next.isSuccess) {
        ref.read(customerSetPasswordProvider.notifier).reset();
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRoute.home,
          (route) => false,
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('auth.setPasswordTitle')),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppHeaderWidget(
              title: localizations.text('auth.setPasswordTitle'),
              subtitle: localizations.text('auth.setPasswordBody'),
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              obscureText: true,
              keyboardType: TextInputType.visiblePassword,
              textInputAction: TextInputAction.next,
              onChanged: (v) =>
                  ref.read(customerSetPasswordProvider.notifier).updateNewPassword(v),
              decoration: InputDecoration(
                labelText: localizations.text('auth.passwordLabel'),
                hintText: localizations.text('auth.passwordHint'),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              obscureText: true,
              keyboardType: TextInputType.visiblePassword,
              textInputAction: TextInputAction.done,
              onChanged: (v) =>
                  ref.read(customerSetPasswordProvider.notifier).updateConfirmPassword(v),
              decoration: InputDecoration(
                labelText: localizations.text('auth.confirmPasswordLabel'),
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
                label: localizations.text('auth.setPasswordAction'),
                isLoading: state.isSubmitting,
                onPressed: state.isSubmitting
                    ? null
                    : () => ref
                        .read(customerSetPasswordProvider.notifier)
                        .submit(verificationToken: verificationToken),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil(
                  AppRoute.home,
                  (route) => false,
                ),
                child: Text(localizations.text('auth.skipSetPasswordAction')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
