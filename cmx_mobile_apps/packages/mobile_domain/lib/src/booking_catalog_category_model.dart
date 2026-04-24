import 'booking_catalog_item_model.dart';

class BookingCatalogCategoryModel {
  const BookingCatalogCategoryModel({
    required this.id,
    required this.name,
    this.name2,
    required this.items,
  });

  final String id;
  final String name;
  final String? name2;
  final List<BookingCatalogItemModel> items;

  factory BookingCatalogCategoryModel.fromJson(Map<String, Object?> json) {
    final rawItems = json['items'] as List? ?? const [];
    return BookingCatalogCategoryModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      items: rawItems
          .whereType<Map<String, Object?>>()
          .map(BookingCatalogItemModel.fromJson)
          .toList(growable: false),
    );
  }
}
