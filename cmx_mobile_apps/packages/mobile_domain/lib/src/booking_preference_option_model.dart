class BookingPreferenceOptionModel {
  const BookingPreferenceOptionModel({
    required this.id,
    required this.label,
    this.label2,
    this.description,
    this.description2,
    this.preferenceSysKind = 'service_prefs',
    this.icon,
    this.colorHex,
    this.extraPrice = 0,
    this.extraTurnaroundMinutes,
    this.sustainabilityScore,
  });

  final String id;
  final String label;
  final String? label2;
  final String? description;
  final String? description2;
  final String preferenceSysKind;
  final String? icon;
  final String? colorHex;
  final double extraPrice;
  final int? extraTurnaroundMinutes;
  final int? sustainabilityScore;

  factory BookingPreferenceOptionModel.fromJson(Map<String, Object?> json) {
    return BookingPreferenceOptionModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      label2: json['label2'] as String?,
      description: json['description'] as String?,
      description2: json['description2'] as String?,
      preferenceSysKind:
          json['preferenceSysKind'] as String? ?? 'service_prefs',
      icon: json['icon'] as String?,
      colorHex: json['colorHex'] as String?,
      extraPrice: (json['extraPrice'] as num?)?.toDouble() ?? 0,
      extraTurnaroundMinutes: (json['extraTurnaroundMinutes'] as num?)?.toInt(),
      sustainabilityScore: (json['sustainabilityScore'] as num?)?.toInt(),
    );
  }
}
