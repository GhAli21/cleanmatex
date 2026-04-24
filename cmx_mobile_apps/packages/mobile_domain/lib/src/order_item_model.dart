class OrderItemModel {
  const OrderItemModel({
    required this.id,
    required this.name,
    required this.quantity,
    required this.totalPrice,
    this.name2,
  });

  final String id;
  final String name;

  /// Localized Arabic name (may be null).
  final String? name2;
  final int quantity;
  final double totalPrice;
}
