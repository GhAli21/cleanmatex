class BranchOptionModel {
  const BranchOptionModel({
    required this.id,
    required this.name,
    this.name2,
    this.isMain = false,
    this.address,
    this.area,
    this.city,
  });

  final String id;
  final String name;
  final String? name2;
  final bool isMain;
  final String? address;
  final String? area;
  final String? city;

  factory BranchOptionModel.fromJson(Map<String, Object?> json) {
    return BranchOptionModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      isMain: json['isMain'] == true,
      address: json['address'] as String?,
      area: json['area'] as String?,
      city: json['city'] as String?,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'name': name,
      if (name2 != null) 'name2': name2,
      'isMain': isMain,
      if (address != null) 'address': address,
      if (area != null) 'area': area,
      if (city != null) 'city': city,
    };
  }
}
