import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerEntryScreen extends StatelessWidget {
  const CustomerEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          localizations.text('app.title'),
          style: textTheme.titleLarge?.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                const SizedBox(height: AppSpacing.xl),
                // Brand icon
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.local_laundry_service_rounded,
                      size: 36,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                AppHeaderWidget(
                  title: localizations.text('entry.title'),
                  subtitle: localizations.text('entry.subtitle'),
                ),
                const SizedBox(height: AppSpacing.xl),
                // Primary CTA: guest
                SizedBox(
                  width: double.infinity,
                  child: AppCustomButtonWidget(
                    label: localizations.text('entry.guestAction'),
                    onPressed: () {
                      Navigator.of(context).pushNamed(AppRoute.guestEntry);
                    },
                    trailingIcon: Icons.arrow_forward_rounded,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                // Secondary: login as text button row
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      localizations.text('entry.loginBody'),
                      style: textTheme.bodyMedium?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).pushNamed(AppRoute.loginEntry);
                      },
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                        ),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        localizations.text('entry.loginAction'),
                        style: textTheme.bodyMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
