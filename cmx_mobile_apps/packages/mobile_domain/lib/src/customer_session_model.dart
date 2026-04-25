class CustomerSessionModel {
  const CustomerSessionModel({
    required this.customerId,
    required this.phoneNumber,
    required this.isGuest,
    this.tenantOrgId,
    this.branchId,
    this.branchName,
    this.branchName2,
    this.displayName,
    this.verificationToken,
    this.hasPassword = false,
  });

  final String customerId;
  final String phoneNumber;
  final bool isGuest;
  final String? tenantOrgId;
  final String? branchId;
  final String? branchName;
  final String? branchName2;
  final String? displayName;
  final String? verificationToken;
  final bool hasPassword;

  bool get hasVerificationToken => (verificationToken ?? '').trim().isNotEmpty;

  Map<String, Object?> toJson() {
    return {
      'customerId': customerId,
      'phoneNumber': phoneNumber,
      'isGuest': isGuest,
      'tenantOrgId': tenantOrgId,
      'branchId': branchId,
      'branchName': branchName,
      'branchName2': branchName2,
      'displayName': displayName,
      'verificationToken': verificationToken,
      'hasPassword': hasPassword,
    };
  }

  factory CustomerSessionModel.fromJson(Map<String, Object?> json) {
    return CustomerSessionModel(
      customerId: json['customerId'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      isGuest: json['isGuest'] as bool? ?? false,
      tenantOrgId: json['tenantOrgId'] as String?,
      branchId: json['branchId'] as String?,
      branchName: json['branchName'] as String?,
      branchName2: json['branchName2'] as String?,
      displayName: json['displayName'] as String?,
      verificationToken: json['verificationToken'] as String?,
      hasPassword: json['hasPassword'] as bool? ?? false,
    );
  }
}
