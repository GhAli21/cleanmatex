class PickupSlotModel {
  const PickupSlotModel({
    required this.id,
    required this.label,
    this.label2,
    this.startAt,
    this.endAt,
  });

  final String id;
  final String label;
  final String? label2;
  final DateTime? startAt;
  final DateTime? endAt;
}
