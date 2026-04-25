import 'dart:convert';

import 'branch_option_model.dart';

class TenantModel {
  const TenantModel({
    required this.tenantOrgId,
    required this.name,
    this.name2,
    this.logoUrl,
    this.primaryColor,
    this.branches = const [],
  });

  final String tenantOrgId;
  final String name;
  final String? name2;
  final String? logoUrl;
  final String? primaryColor;
  final List<BranchOptionModel> branches;

  factory TenantModel.fromJson(Map<String, Object?> json) {
    return TenantModel(
      tenantOrgId: json['tenantOrgId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      logoUrl: json['logoUrl'] as String?,
      primaryColor: json['primaryColor'] as String?,
      branches: (json['branches'] as List? ?? const [])
          .whereType<Map<String, Object?>>()
          .map(BranchOptionModel.fromJson)
          .where((branch) => branch.id.isNotEmpty)
          .toList(growable: false),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'tenantOrgId': tenantOrgId,
      'name': name,
      if (name2 != null) 'name2': name2,
      if (logoUrl != null) 'logoUrl': logoUrl,
      if (primaryColor != null) 'primaryColor': primaryColor,
      'branches': branches.map((branch) => branch.toJson()).toList(),
    };
  }

  String toJsonString() => jsonEncode(toJson());

  static TenantModel? fromJsonString(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, Object?>) return TenantModel.fromJson(decoded);
    } catch (_) {}
    return null;
  }

  TenantModel copyWith({
    String? tenantOrgId,
    String? name,
    String? name2,
    String? logoUrl,
    String? primaryColor,
    List<BranchOptionModel>? branches,
  }) {
    return TenantModel(
      tenantOrgId: tenantOrgId ?? this.tenantOrgId,
      name: name ?? this.name,
      name2: name2 ?? this.name2,
      logoUrl: logoUrl ?? this.logoUrl,
      primaryColor: primaryColor ?? this.primaryColor,
      branches: branches ?? this.branches,
    );
  }
}
