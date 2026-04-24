class BookingCatalogItemModel {
  const BookingCatalogItemModel({
    required this.id,
    required this.categoryId,
    required this.name,
    this.name2,
    this.description,
    this.description2,
    required this.unitPrice,
    required this.unit,
    this.imageUrl,
  });

  final String id;
  final String categoryId;
  final String name;
  final String? name2;
  final String? description;
  final String? description2;
  final double unitPrice;

  /// Unit type from backend: 'per_piece', 'per_kg', etc.
  final String unit;
  final String? imageUrl;

  factory BookingCatalogItemModel.fromJson(Map<String, Object?> json) {
    return BookingCatalogItemModel(
      id: json['id'] as String? ?? '',
      categoryId: json['categoryId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      description: json['description'] as String?,
      description2: json['description2'] as String?,
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0.0,
      unit: json['unit'] as String? ?? 'per_piece',
      imageUrl: json['imageUrl'] as String?,
    );
  }
}
