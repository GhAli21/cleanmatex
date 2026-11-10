/// A service speed the organization offers for booking (server list, in speed order).
class BookingServiceSpeedModel {
  const BookingServiceSpeedModel({
    required this.code,
    required this.name,
    this.name2,
    this.description,
    this.description2,
  });

  factory BookingServiceSpeedModel.fromJson(Map<String, Object?> json) {
    return BookingServiceSpeedModel(
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      description: json['description'] as String?,
      description2: json['description2'] as String?,
    );
  }

  final String code;
  final String name;
  final String? name2;
  final String? description;
  final String? description2;
}
