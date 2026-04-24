class BookingPreferenceOptionModel {
  const BookingPreferenceOptionModel({
    required this.id,
    required this.label,
    this.label2,
    this.extraPrice = 0,
  });

  final String id;
  final String label;
  final String? label2;
  final double extraPrice;

  factory BookingPreferenceOptionModel.fromJson(Map<String, Object?> json) {
    return BookingPreferenceOptionModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      label2: json['label2'] as String?,
      extraPrice: (json['extraPrice'] as num?)?.toDouble() ?? 0,
    );
  }
}
