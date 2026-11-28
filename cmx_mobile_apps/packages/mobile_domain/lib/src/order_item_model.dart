import 'order_line_qualifier_model.dart';

class OrderItemModel {
  const OrderItemModel({
    required this.id,
    required this.name,
    required this.quantity,
    required this.totalPrice,
    this.name2,
    this.qualifier,
  });

  final String id;
  final String name;

  /// Localized Arabic name (may be null).
  final String? name2;

  /// Piece count, also on a measured line.
  final int quantity;

  /// What the customer pays for the line.
  final double totalPrice;

  /// What tells the line apart; null when there is nothing to add.
  final OrderLineQualifierModel? qualifier;
}
