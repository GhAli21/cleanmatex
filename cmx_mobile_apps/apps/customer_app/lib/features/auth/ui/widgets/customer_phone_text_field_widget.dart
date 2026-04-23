import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';

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

    return TextField(
      controller: controller,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.done,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: localizations.text('loginEntry.phoneLabel'),
        hintText: localizations.text('loginEntry.phoneHint'),
        errorText: errorText,
      ),
    );
  }
}
