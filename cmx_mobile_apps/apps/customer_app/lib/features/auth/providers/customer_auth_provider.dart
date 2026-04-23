import 'package:flutter/material.dart';

import '../../../core/app_shell_controller.dart';

class CustomerAuthProvider extends ChangeNotifier {
  CustomerAuthProvider(this._appController);

  final CustomerAppController _appController;

  String _phoneNumber = '';
  bool _isSubmitting = false;
  String? _errorMessageKey;

  bool get isSubmitting => _isSubmitting;
  String? get errorMessageKey => _errorMessageKey;

  void updatePhoneNumber(String value) {
    _phoneNumber = value;
    _errorMessageKey = null;
    notifyListeners();
  }

  Future<bool> submit() async {
    final normalizedPhone = _phoneNumber.replaceAll(RegExp(r'\s+'), '');

    if (normalizedPhone.length < 8) {
      _errorMessageKey = 'loginEntry.phoneValidationError';
      notifyListeners();
      return false;
    }

    _isSubmitting = true;
    _errorMessageKey = null;
    notifyListeners();

    try {
      await _appController.signInWithPhone(phoneNumber: normalizedPhone);
      return true;
    } catch (_) {
      _errorMessageKey = 'loginEntry.genericError';
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }
}
