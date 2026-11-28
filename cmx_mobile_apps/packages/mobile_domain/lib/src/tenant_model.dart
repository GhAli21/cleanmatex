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
    this.isHiddenByCustomer = false,
    this.lastBranchId,
    this.lastBranchName,
    this.lastBranchName2,
    this.activeOrderCount = 0,
  });

  final String tenantOrgId;
  final String name;
  final String? name2;
  final String? logoUrl;
  final String? primaryColor;
  final List<BranchOptionModel> branches;
  final bool isHiddenByCustomer;
  final String? lastBranchId;
  final String? lastBranchName;
  final String? lastBranchName2;
  final int activeOrderCount;

  BranchOptionModel? get resolvedLastBranch {
    if (branches.isEmpty) return null;
    if (lastBranchId != null) {
      for (final b in branches) {
        if (b.id == lastBranchId) return b;
      }
    }
    return branches.first;
  }

  factory TenantModel.fromJson(Map<String, Object?> json) {
    return TenantModel(
      tenantOrgId: json['tenantOrgId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      logoUrl: json['logoUrl'] as String?,
      primaryColor: json['primaryColor'] as String?,
      isHiddenByCustomer: json['isHiddenByCustomer'] == true,
      lastBranchId: json['lastBranchId'] as String?,
      lastBranchName: json['lastBranchName'] as String?,
      lastBranchName2: json['lastBranchName2'] as String?,
      activeOrderCount: (json['activeOrderCount'] as num?)?.toInt() ?? 0,
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
      'isHiddenByCustomer': isHiddenByCustomer,
      if (lastBranchId != null) 'lastBranchId': lastBranchId,
      if (lastBranchName != null) 'lastBranchName': lastBranchName,
      if (lastBranchName2 != null) 'lastBranchName2': lastBranchName2,
      'activeOrderCount': activeOrderCount,
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
    bool? isHiddenByCustomer,
    String? lastBranchId,
    String? lastBranchName,
    String? lastBranchName2,
    int? activeOrderCount,
  }) {
    return TenantModel(
      tenantOrgId: tenantOrgId ?? this.tenantOrgId,
      name: name ?? this.name,
      name2: name2 ?? this.name2,
      logoUrl: logoUrl ?? this.logoUrl,
      primaryColor: primaryColor ?? this.primaryColor,
      branches: branches ?? this.branches,
      isHiddenByCustomer: isHiddenByCustomer ?? this.isHiddenByCustomer,
      lastBranchId: lastBranchId ?? this.lastBranchId,
      lastBranchName: lastBranchName ?? this.lastBranchName,
      lastBranchName2: lastBranchName2 ?? this.lastBranchName2,
      activeOrderCount: activeOrderCount ?? this.activeOrderCount,
    );
  }
}
