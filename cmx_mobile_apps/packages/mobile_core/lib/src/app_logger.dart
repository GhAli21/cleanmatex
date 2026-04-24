import 'dart:async';
import 'dart:developer' as developer;

class AppLogEntry {
  const AppLogEntry({
    required this.timestamp,
    required this.loggerName,
    required this.level,
    required this.message,
    this.error,
    this.stackTrace,
  });

  final DateTime timestamp;
  final String loggerName;
  final int level;
  final String message;
  final String? error;
  final String? stackTrace;
}

class AppLogger {
  const AppLogger._();

  static const int _maxBufferedEntries = 400;
  static final List<AppLogEntry> _entries = <AppLogEntry>[];
  static final StreamController<List<AppLogEntry>> _entriesStreamController =
      StreamController<List<AppLogEntry>>.broadcast();

  static List<AppLogEntry> get entries =>
      List<AppLogEntry>.unmodifiable(_entries);

  static Stream<List<AppLogEntry>> get entriesStream =>
      _entriesStreamController.stream;

  static void clearEntries() {
    _entries.clear();
    _entriesStreamController.add(entries);
  }

  static void debug(String message) {
    _log(
      message: message,
      name: 'cmx.mobile.debug',
      level: 500,
    );
  }

  static void info(String message) {
    _log(
      message: message,
      name: 'cmx.mobile.info',
      level: 800,
    );
  }

  static void warning(String message) {
    _log(
      message: message,
      name: 'cmx.mobile.warning',
      level: 900,
    );
  }

  static void error(String message, {Object? error, StackTrace? stackTrace}) {
    _log(
      message: message,
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
    _log(
      message: message,
      name: 'cmx.mobile.critical',
      level: 1200,
      error: error,
      stackTrace: stackTrace,
    );
  }

  static void _log({
    required String message,
    required String name,
    required int level,
    Object? error,
    StackTrace? stackTrace,
  }) {
    developer.log(
      message,
      name: name,
      level: level,
      error: error,
      stackTrace: stackTrace,
    );

    _entries.add(
      AppLogEntry(
        timestamp: DateTime.now(),
        loggerName: name,
        level: level,
        message: message,
        error: error?.toString(),
        stackTrace: stackTrace?.toString(),
      ),
    );

    if (_entries.length > _maxBufferedEntries) {
      _entries.removeRange(0, _entries.length - _maxBufferedEntries);
    }

    if (!_entriesStreamController.isClosed) {
      _entriesStreamController.add(entries);
    }
  }

}
