class NewAddressInputModel {
  const NewAddressInputModel({
    required this.label,
    required this.street,
    required this.area,
    required this.city,
  });

  final String label;
  final String street;
  final String area;
  final String city;

  Map<String, Object?> toJson() => {
        'label': label,
        'street': street,
        'area': area,
        'city': city,
      };
}
