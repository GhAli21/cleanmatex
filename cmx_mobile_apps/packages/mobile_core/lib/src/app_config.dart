class AppConfig {
  const AppConfig({
    required this.appEnv,
    required this.apiBaseUrl,
    required this.enableDebugLogs,
  });

  final String appEnv;
  final String apiBaseUrl;
  final bool enableDebugLogs;

  bool get isDev => appEnv == 'dev';
  bool get isStaging => appEnv == 'staging';
  bool get isProd => appEnv == 'prod';
  bool get hasApiBaseUrl => apiBaseUrl.trim().isNotEmpty;

  // Tenant is resolved at runtime via QR/code — NOT a build-time dart-define.

  static AppConfig fromEnvironment() {
    return const AppConfig(
      appEnv: String.fromEnvironment('APP_ENV', defaultValue: 'dev'),
      apiBaseUrl: String.fromEnvironment('API_BASE_URL', defaultValue: ''),
      enableDebugLogs: bool.fromEnvironment(
        'ENABLE_DEBUG_LOGS',
        defaultValue: true,
      ),
    );
  }

  void assertProductionReady() {
    if (isProd && !hasApiBaseUrl) {
      throw StateError(
        'Production build requires API_BASE_URL. '
        'Pass it via --dart-define=API_BASE_URL=https://your-domain.com',
      );
    }
  }
}
