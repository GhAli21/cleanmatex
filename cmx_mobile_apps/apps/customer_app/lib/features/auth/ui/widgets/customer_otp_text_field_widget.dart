import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_l10n/mobile_l10n.dart';

class CustomerOtpTextFieldWidget extends StatelessWidget {
  const CustomerOtpTextFieldWidget({
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
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.done,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(6),
      ],
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: localizations.text('otpEntry.codeLabel'),
        hintText: localizations.text('otpEntry.codeHint'),
        errorText: errorText,
      ),
    );
  }
}
