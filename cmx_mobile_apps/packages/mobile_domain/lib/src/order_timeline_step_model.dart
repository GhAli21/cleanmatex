class OrderTimelineStepModel {
  const OrderTimelineStepModel({
    required this.code,
    required this.titleKey,
    required this.descriptionKey,
    required this.isCompleted,
  });

  final String code;
  final String titleKey;
  final String descriptionKey;
  final bool isCompleted;
}
