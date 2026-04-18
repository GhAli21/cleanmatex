import 'dart:developer' as developer;

class AppLogger {
  const AppLogger._();

  static void debug(String message) {
    developer.log(message, name: 'cmx.mobile.debug', level: 500);
  }

  static void info(String message) {
    developer.log(message, name: 'cmx.mobile.info', level: 800);
  }

  static void warning(String message) {
    developer.log(message, name: 'cmx.mobile.warning', level: 900);
  }

  static void error(String message, {Object? error, StackTrace? stackTrace}) {
    developer.log(
      message,
      name: 'cmx.mobile.error',
      level: 1000,
      error: error,
      stackTrace: stackTrace,
    );
  }

  static void critical(
    String message, {
    Object? error,
    StackTrace? stackTrace,
  }) {
    developer.log(
      message,
      name: 'cmx.mobile.critical',
      level: 1200,
      error: error,
      stackTrace: stackTrace,
    );
  }
}
