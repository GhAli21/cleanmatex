import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

class CustomerAuthRepository {
  CustomerAuthRepository({
    AuthApiService? authApiService,
  }) : _authApiService = authApiService ?? AuthApiService();

  final AuthApiService _authApiService;

  Future<CustomerAuthChallengeModel> requestOtp({
    required String phoneNumber,
  }) {
    return _authApiService.requestOtp(phoneNumber: phoneNumber);
  }

  Future<CustomerSessionModel> verifyOtp({
    required CustomerAuthChallengeModel challenge,
    required String otpCode,
  }) {
    return _authApiService.verifyOtp(
      challenge: challenge,
      otpCode: otpCode,
    );
  }
}
