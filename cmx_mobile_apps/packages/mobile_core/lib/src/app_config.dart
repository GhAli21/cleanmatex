class AppConfig {
  const AppConfig({
    required this.appEnv,
    required this.apiBaseUrl,
    required this.tenantOrgId,
    required this.enableDebugLogs,
  });

  final String appEnv;
  final String apiBaseUrl;
  final String tenantOrgId;
  final bool enableDebugLogs;

  bool get isDev => appEnv == 'dev';
  bool get isStaging => appEnv == 'staging';
  bool get isProd => appEnv == 'prod';
  bool get hasApiBaseUrl => apiBaseUrl.trim().isNotEmpty;
  bool get hasTenantOrgId => tenantOrgId.trim().isNotEmpty;

  static AppConfig fromEnvironment() {
    return const AppConfig(
      appEnv: String.fromEnvironment('APP_ENV', defaultValue: 'dev'),
      apiBaseUrl: String.fromEnvironment('API_BASE_URL', defaultValue: ''),
      tenantOrgId: String.fromEnvironment('TENANT_ORG_ID', defaultValue: ''),
      enableDebugLogs: bool.fromEnvironment(
        'ENABLE_DEBUG_LOGS',
        defaultValue: true,
      ),
    );
  }
}
