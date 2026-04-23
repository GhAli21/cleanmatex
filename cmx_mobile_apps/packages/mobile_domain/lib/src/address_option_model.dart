class AddressOptionModel {
  const AddressOptionModel({
    required this.id,
    required this.label,
    required this.description,
    this.isDefault = false,
  });

  final String id;
  final String label;
  final String description;
  final bool isDefault;
}
