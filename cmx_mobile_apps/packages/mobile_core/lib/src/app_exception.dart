abstract class AppException implements Exception {
  const AppException({
    required this.code,
    required this.messageKey,
    this.originalError,
  });

  final String code;
  final String messageKey;
  final Object? originalError;

  @override
  String toString() {
    return 'AppException(code: $code, messageKey: $messageKey)';
  }
}

class UnexpectedAppException extends AppException {
  const UnexpectedAppException({
    required super.code,
    required super.messageKey,
    super.originalError,
  });
}
