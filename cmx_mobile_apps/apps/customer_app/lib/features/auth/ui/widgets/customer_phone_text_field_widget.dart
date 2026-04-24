import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerPhoneTextFieldWidget extends StatelessWidget {
  const CustomerPhoneTextFieldWidget({
    super.key,
    required this.controller,
    required this.onChanged,
    this.errorText,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fieldTextColor =
        isDark ? AppColors.textPrimaryDark : AppColors.textPrimary;
    final hintColor = isDark ? AppColors.textMutedDark : AppColors.textMuted;
    final fillColor = isDark ? AppColors.surfaceDark : Colors.white;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;

    return TextField(
      controller: controller,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.done,
      onChanged: onChanged,
      style: TextStyle(color: fieldTextColor),
      cursorColor: Theme.of(context).colorScheme.primary,
      decoration: InputDecoration(
        labelText: localizations.text('loginEntry.phoneLabel'),
        hintText: localizations.text('loginEntry.phoneHint'),
        errorText: errorText,
        filled: true,
        fillColor: fillColor,
        labelStyle: TextStyle(color: hintColor),
        hintStyle: TextStyle(color: hintColor),
        floatingLabelStyle: TextStyle(
          color: Theme.of(context).colorScheme.primary,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
        ),
        ),
    );
  }
}
