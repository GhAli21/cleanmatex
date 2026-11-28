import 'address_option_model.dart';

/// Complete registered CleanMateX profile for the authenticated customer.
class CustomerProfileModel {
  const CustomerProfileModel({
    required this.orgCustomerId,
    this.sysCustomerId,
    this.hasSysCustomerId = false,
    this.customerCode,
    this.name,
    this.name2,
    this.displayName,
    this.mobile,
    this.mobileVerified = false,
    this.email,
    this.emailVerified = false,
    this.profileStatus = 'full',
    this.loyaltyPoints = 0,
    this.memberSince,
    this.preferredLanguage,
    this.preferences = const {},
    this.defaultOrderNote,
    this.autoApplyOrderDefaultNote = false,
    this.lastBranchId,
    this.lastBranchName,
    this.lastBranchName2,
    this.addresses = const [],
  });

  final String orgCustomerId;
  final String? sysCustomerId;
  final bool hasSysCustomerId;
  final String? customerCode;
  final String? name;
  final String? name2;
  final String? displayName;
  final String? mobile;
  final bool mobileVerified;
  final String? email;
  final bool emailVerified;
  final String profileStatus;
  final int loyaltyPoints;
  final String? memberSince;
  final String? preferredLanguage;
  final Map<String, Object?> preferences;
  final String? defaultOrderNote;
  final bool autoApplyOrderDefaultNote;
  final String? lastBranchId;
  final String? lastBranchName;
  final String? lastBranchName2;
  final List<AddressOptionModel> addresses;

  String get finishingPref =>
      (preferences['finishing'] as String?) ?? 'hanger';
  String get starchPref => (preferences['starch'] as String?) ?? 'light';
  String get detergentPref =>
      (preferences['detergent'] as String?) ?? 'standard';
  bool get fragrancePref => preferences['fragrance'] != false;

  factory CustomerProfileModel.fromJson(Map<String, Object?> json) {
    final rawPrefs = json['preferences'];
    final prefs = rawPrefs is Map
        ? rawPrefs.map((k, v) => MapEntry(k.toString(), v as Object?))
        : const <String, Object?>{};
    final rawAddresses = json['addresses'] as List? ?? const [];

    return CustomerProfileModel(
      orgCustomerId: json['orgCustomerId'] as String? ?? '',
      sysCustomerId: json['sysCustomerId'] as String?,
      hasSysCustomerId: json['hasSysCustomerId'] == true,
      customerCode: json['customerCode'] as String?,
      name: json['name'] as String?,
      name2: json['name2'] as String?,
      displayName: json['displayName'] as String?,
      mobile: json['mobile'] as String?,
      mobileVerified: json['mobileVerified'] == true,
      email: json['email'] as String?,
      emailVerified: json['emailVerified'] == true,
      profileStatus: json['profileStatus'] as String? ?? 'full',
      loyaltyPoints: (json['loyaltyPoints'] as num?)?.toInt() ?? 0,
      memberSince: json['memberSince'] as String?,
      preferredLanguage: json['preferredLanguage'] as String?,
      preferences: prefs,
      defaultOrderNote: json['defaultOrderNote'] as String?,
      autoApplyOrderDefaultNote: json['autoApplyOrderDefaultNote'] == true,
      lastBranchId: json['lastBranchId'] as String?,
      lastBranchName: json['lastBranchName'] as String?,
      lastBranchName2: json['lastBranchName2'] as String?,
      addresses: rawAddresses
          .whereType<Map<String, Object?>>()
          .map(
            (a) => AddressOptionModel(
              id: a['id'] as String? ?? '',
              label: a['label'] as String? ?? 'Address',
              description: a['description'] as String? ?? '',
              isDefault: a['isDefault'] == true,
            ),
          )
          .where((a) => a.id.isNotEmpty)
          .toList(growable: false),
    );
  }

  CustomerProfileModel copyWith({
    String? name,
    String? displayName,
    String? mobile,
    bool? mobileVerified,
    String? email,
    bool? emailVerified,
    Map<String, Object?>? preferences,
    String? defaultOrderNote,
    bool? autoApplyOrderDefaultNote,
    List<AddressOptionModel>? addresses,
  }) {
    return CustomerProfileModel(
      orgCustomerId: orgCustomerId,
      sysCustomerId: sysCustomerId,
      hasSysCustomerId: hasSysCustomerId,
      customerCode: customerCode,
      name: name ?? this.name,
      name2: name2,
      displayName: displayName ?? this.displayName,
      mobile: mobile ?? this.mobile,
      mobileVerified: mobileVerified ?? this.mobileVerified,
      email: email ?? this.email,
      emailVerified: emailVerified ?? this.emailVerified,
      profileStatus: profileStatus,
      loyaltyPoints: loyaltyPoints,
      memberSince: memberSince,
      preferredLanguage: preferredLanguage,
      preferences: preferences ?? this.preferences,
      defaultOrderNote: defaultOrderNote ?? this.defaultOrderNote,
      autoApplyOrderDefaultNote:
          autoApplyOrderDefaultNote ?? this.autoApplyOrderDefaultNote,
      lastBranchId: lastBranchId,
      lastBranchName: lastBranchName,
      lastBranchName2: lastBranchName2,
      addresses: addresses ?? this.addresses,
    );
  }
}
