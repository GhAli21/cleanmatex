class ServiceOptionModel {
  const ServiceOptionModel({
    required this.id,
    required this.title,
    this.title2,
    required this.description,
    this.description2,
    required this.priceLabel,
    this.priceLabel2,
  });

  final String id;
  final String title;
  final String? title2;
  final String description;
  final String? description2;
  final String priceLabel;
  final String? priceLabel2;
}
