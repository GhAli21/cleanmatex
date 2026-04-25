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
    required String tenantOrgId,
    BranchOptionModel? branch,
  }) {
    return _authApiService.verifyOtp(
      challenge: challenge,
      otpCode: otpCode,
      tenantOrgId: tenantOrgId,
      branch: branch,
    );
  }

  Future<CustomerSessionModel> refreshSession({
    required CustomerSessionModel session,
  }) {
    return _authApiService.refreshSession(session: session);
  }

  Future<bool> checkHasPassword({
    required String phoneNumber,
    required String tenantId,
  }) {
    return _authApiService.checkHasPassword(
      phoneNumber: phoneNumber,
      tenantId: tenantId,
    );
  }

  Future<CustomerSessionModel> loginWithPassword({
    required String phoneNumber,
    required String password,
    required String tenantId,
    BranchOptionModel? branch,
  }) {
    return _authApiService.loginWithPassword(
      phoneNumber: phoneNumber,
      password: password,
      tenantId: tenantId,
      branch: branch,
    );
  }

  Future<void> setPassword({
    required String verificationToken,
    required String tenantId,
    required String newPassword,
  }) {
    return _authApiService.setPassword(
      verificationToken: verificationToken,
      tenantId: tenantId,
      newPassword: newPassword,
    );
  }
}
