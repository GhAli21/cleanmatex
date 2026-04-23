class CustomerSessionModel {
  const CustomerSessionModel({
    required this.customerId,
    required this.phoneNumber,
    required this.isGuest,
    this.tenantOrgId,
    this.displayName,
    this.verificationToken,
  });

  final String customerId;
  final String phoneNumber;
  final bool isGuest;
  final String? tenantOrgId;
  final String? displayName;
  final String? verificationToken;

  bool get hasVerificationToken => (verificationToken ?? '').trim().isNotEmpty;

  Map<String, Object?> toJson() {
    return {
      'customerId': customerId,
      'phoneNumber': phoneNumber,
      'isGuest': isGuest,
      'tenantOrgId': tenantOrgId,
      'displayName': displayName,
      'verificationToken': verificationToken,
    };
  }

  factory CustomerSessionModel.fromJson(Map<String, Object?> json) {
    return CustomerSessionModel(
      customerId: json['customerId'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      isGuest: json['isGuest'] as bool? ?? false,
      tenantOrgId: json['tenantOrgId'] as String?,
      displayName: json['displayName'] as String?,
      verificationToken: json['verificationToken'] as String?,
    );
  }
}
