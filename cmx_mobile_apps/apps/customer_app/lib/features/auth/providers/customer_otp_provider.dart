import 'package:flutter/material.dart';

import '../../../core/app_shell_controller.dart';

class CustomerOtpProvider extends ChangeNotifier {
  CustomerOtpProvider(this._appController);

  final CustomerAppController _appController;

  String _otpCode = '';
  bool _isSubmitting = false;
  String? _errorMessageKey;

  bool get isSubmitting => _isSubmitting;
  String? get errorMessageKey => _errorMessageKey;

  void updateOtpCode(String value) {
    _otpCode = value;
    _errorMessageKey = null;
    notifyListeners();
  }

  Future<bool> submit() async {
    final normalizedOtp = _otpCode.trim();

    if (normalizedOtp.length < 6) {
      _errorMessageKey = 'otpEntry.codeValidationError';
      notifyListeners();
      return false;
    }

    _isSubmitting = true;
    _errorMessageKey = null;
    notifyListeners();

    try {
      await _appController.verifyOtpCode(otpCode: normalizedOtp);
      return true;
    } catch (_) {
      _errorMessageKey = 'otpEntry.genericError';
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }
}
