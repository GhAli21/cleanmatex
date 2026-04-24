class AddressOptionModel {
  const AddressOptionModel({
    required this.id,
    required this.label,
    required this.description,
    this.isDefault = false,
    this.street,
    this.area,
    this.city,
  });

  final String id;
  final String label;
  final String description;
  final bool isDefault;
  final String? street;
  final String? area;
  final String? city;

  AddressOptionModel copyWith({
    String? id,
    String? label,
    String? description,
    bool? isDefault,
    String? street,
    String? area,
    String? city,
  }) {
    return AddressOptionModel(
      id: id ?? this.id,
      label: label ?? this.label,
      description: description ?? this.description,
      isDefault: isDefault ?? this.isDefault,
      street: street ?? this.street,
      area: area ?? this.area,
      city: city ?? this.city,
    );
  }
}
