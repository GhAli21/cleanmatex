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
  AuthApiService({
    MobileHttpClient? httpClient,
    AppConfig? config,
  }) : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  bool get _hasRemoteConfig =>
      _httpClient.config.hasApiBaseUrl && _httpClient.config.hasTenantOrgId;

  Future<CustomerAuthChallengeModel> requestOtp({
    required String phoneNumber,
  }) async {
    if (phoneNumber.trim().length < 8) {
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
        body: {
          'phone': phoneNumber,
          'purpose': 'login',
        },
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
  }) async {
    if (otpCode.trim().length < 6) {
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
      );
    }

    try {
      final verificationResponse = await _httpClient.postJson(
        '/api/v1/customers/verify-otp',
        body: {
          'phone': challenge.phoneNumber,
          'code': otpCode,
        },
      );

      final isVerified = verificationResponse['verified'] == true;
      final verificationToken = verificationResponse['token'] as String?;
      if (!isVerified ||
          verificationToken == null ||
          verificationToken.isEmpty) {
        throw const AuthServiceException(
          code: 'auth_verification_failed',
          messageKey: 'otpEntry.genericError',
        );
      }

      final sessionResponse = await _httpClient.postJson(
        '/api/v1/public/customer/session',
        body: {
          'tenantId': _httpClient.config.tenantOrgId,
          'verificationToken': verificationToken,
        },
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
}
