class BookingPreferenceKindModel {
  const BookingPreferenceKindModel({
    required this.kindCode,
    required this.name,
    this.name2,
    this.kindBgColor,
    this.mainTypeCode,
    this.icon,
    this.recOrder,
  });

  final String kindCode;
  final String name;
  final String? name2;
  final String? kindBgColor;
  final String? mainTypeCode;
  final String? icon;
  final int? recOrder;

  factory BookingPreferenceKindModel.fromJson(Map<String, Object?> json) {
    return BookingPreferenceKindModel(
      kindCode: json['kindCode'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      kindBgColor: json['kindBgColor'] as String?,
      mainTypeCode: json['mainTypeCode'] as String?,
      icon: json['icon'] as String?,
      recOrder: (json['recOrder'] as num?)?.toInt(),
    );
  }
}
