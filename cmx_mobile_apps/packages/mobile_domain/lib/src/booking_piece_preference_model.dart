class BookingPiecePreferenceModel {
  const BookingPiecePreferenceModel({
    required this.pieceSeq,
    this.servicePreferenceIds = const [],
    this.packingPrefCode,
    this.colorCode,
    this.notes = '',
  });

  /// 1-based position matching item quantity (piece 1, 2, 3…).
  final int pieceSeq;

  /// Multi-select service preference codes for this piece.
  final List<String> servicePreferenceIds;

  /// Single packing preference code (fold, hang, box, etc.).
  final String? packingPrefCode;

  /// Color preference code from the color kind.
  final String? colorCode;

  /// Customer note for this specific piece.
  final String notes;

  BookingPiecePreferenceModel copyWith({
    int? pieceSeq,
    List<String>? servicePreferenceIds,
    String? packingPrefCode,
    bool clearPackingPref = false,
    String? colorCode,
    bool clearColorCode = false,
    String? notes,
  }) {
    return BookingPiecePreferenceModel(
      pieceSeq: pieceSeq ?? this.pieceSeq,
      servicePreferenceIds:
          servicePreferenceIds ?? this.servicePreferenceIds,
      packingPrefCode:
          clearPackingPref ? null : (packingPrefCode ?? this.packingPrefCode),
      colorCode: clearColorCode ? null : (colorCode ?? this.colorCode),
      notes: notes ?? this.notes,
    );
  }
}
