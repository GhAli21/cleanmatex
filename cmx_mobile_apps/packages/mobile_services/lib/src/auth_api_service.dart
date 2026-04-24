import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

class AuthServiceException extends AppException {
  const AuthServiceException({
    required super.code,
    required super.messageKey,
    super.originalError,
  });
}

class AuthApiService {
  AuthApiService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  bool get _hasRemoteConfig => _httpClient.config.hasApiBaseUrl;

  Future<CustomerAuthChallengeModel> requestOtp({
    required String phoneNumber,
  }) async {
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(phoneNumber.trim())) {
      throw const AuthServiceException(
        code: 'auth_invalid_phone',
        messageKey: 'loginEntry.phoneValidationError',
      );
    }

    if (!_hasRemoteConfig) {
      return CustomerAuthChallengeModel(
        phoneNumber: phoneNumber,
        challengeId: 'challenge-$phoneNumber',
      );
    }

    try {
      await _httpClient.postJson(
        '/api/v1/customers/send-otp',
        body: {'phone': phoneNumber, 'purpose': 'login'},
      );
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'loginEntry.genericError',
        originalError: error,
      );
    }

    return CustomerAuthChallengeModel(
      phoneNumber: phoneNumber,
      challengeId: 'challenge-$phoneNumber',
    );
  }

  Future<CustomerSessionModel> verifyOtp({
    required CustomerAuthChallengeModel challenge,
    required String otpCode,
    required String tenantOrgId,
  }) async {
    if (!RegExp(r'^[0-9]{6}$').hasMatch(otpCode.trim())) {
      throw const AuthServiceException(
        code: 'auth_invalid_otp',
        messageKey: 'otpEntry.codeValidationError',
      );
    }

    if (!_hasRemoteConfig) {
      return CustomerSessionModel(
        customerId: 'customer-${challenge.phoneNumber}',
        phoneNumber: challenge.phoneNumber,
        isGuest: false,
        tenantOrgId: tenantOrgId,
      );
    }

    try {
      final verificationResponse = await _httpClient.postJson(
        '/api/v1/customers/verify-otp',
        body: {'phone': challenge.phoneNumber, 'code': otpCode},
      );

      final isVerified = verificationResponse['verified'] == true;
      final verificationToken = verificationResponse['token'] as String?;
      if (!isVerified || verificationToken == null || verificationToken.isEmpty) {
        throw const AuthServiceException(
          code: 'auth_verification_failed',
          messageKey: 'otpEntry.genericError',
        );
      }

      final sessionResponse = await _httpClient.postJson(
        '/api/v1/public/customer/session',
        body: {'tenantId': tenantOrgId, 'verificationToken': verificationToken},
      );

      final data = sessionResponse['data'];
      if (data is! Map<String, Object?>) {
        throw const AuthServiceException(
          code: 'auth_invalid_session_payload',
          messageKey: 'otpEntry.genericError',
        );
      }

      return CustomerSessionModel.fromJson(data);
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'otpEntry.genericError',
        originalError: error,
      );
    }
  }

  Future<bool> checkHasPassword({
    required String phoneNumber,
    required String tenantId,
  }) async {
    if (!_hasRemoteConfig) {
      return false;
    }

    try {
      final response = await _httpClient.getJson(
        '/api/v1/public/customer/auth-options',
        queryParameters: {'tenantId': tenantId, 'phone': phoneNumber},
      );
      final data = response['data'];
      if (data is Map<String, Object?>) {
        return data['hasPassword'] == true;
      }
      return false;
    } on MobileHttpException {
      return false;
    }
  }

  Future<CustomerSessionModel> loginWithPassword({
    required String phoneNumber,
    required String password,
    required String tenantId,
  }) async {
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(phoneNumber.trim())) {
      throw const AuthServiceException(
        code: 'auth_invalid_phone',
        messageKey: 'loginEntry.phoneValidationError',
      );
    }

    if (password.length < 8) {
      throw const AuthServiceException(
        code: 'auth_password_too_short',
        messageKey: 'auth.passwordMinLengthError',
      );
    }

    try {
      final response = await _httpClient.postJson(
        '/api/v1/public/customer/login',
        body: {'tenantId': tenantId, 'phone': phoneNumber, 'password': password},
      );

      final data = response['data'];
      if (data is! Map<String, Object?>) {
        throw const AuthServiceException(
          code: 'auth_invalid_login_payload',
          messageKey: 'auth.invalidPasswordError',
        );
      }

      return CustomerSessionModel.fromJson(data);
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'auth.invalidPasswordError',
        originalError: error,
      );
    }
  }

  Future<void> setPassword({
    required String verificationToken,
    required String tenantId,
    required String newPassword,
  }) async {
    if (!_hasRemoteConfig) {
      return;
    }

    try {
      await _httpClient.postJson(
        '/api/v1/public/customer/password',
        body: {
          'tenantId': tenantId,
          'verificationToken': verificationToken,
          'newPassword': newPassword,
        },
      );
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'common.remoteRequestError',
        originalError: error,
      );
    }
  }

  Future<CustomerSessionModel> refreshSession({
    required CustomerSessionModel session,
  }) async {
    if (!_hasRemoteConfig) {
      return session;
    }

    try {
      final response = await _httpClient.postJson(
        '/api/v1/public/customer/auth/refresh',
        headers: {'Authorization': 'Bearer ${session.verificationToken}'},
        body: {'tenantId': session.tenantOrgId},
      );

      final data = response['data'];
      if (data is! Map<String, Object?>) {
        throw const AuthServiceException(
          code: 'auth_invalid_refresh_payload',
          messageKey: 'common.remoteRequestError',
        );
      }

      return CustomerSessionModel.fromJson(data);
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'common.remoteRequestError',
        originalError: error,
      );
    }
  }
}
