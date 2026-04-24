import 'package:flutter/material.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerLogsScreen extends StatelessWidget {
  const CustomerLogsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.text('system.logsTitle')),
        actions: [
          IconButton(
            onPressed: () {
              AppLogger.clearEntries();
            },
            icon: const Icon(Icons.delete_outline),
            tooltip: l10n.text('system.logsClearAction'),
          ),
        ],
      ),
      body: SafeArea(
        child: StreamBuilder<List<AppLogEntry>>(
          stream: AppLogger.entriesStream,
          initialData: AppLogger.entries,
          builder: (context, snapshot) {
            final entries = snapshot.data ?? const <AppLogEntry>[];
            if (entries.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  AppCardWidget(
                    child: Text(
                      l10n.text('system.logsEmptyState'),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  ),
                ],
              );
            }

            final reversed = entries.reversed.toList(growable: false);
            return ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: reversed.length,
              separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (context, index) {
                final entry = reversed[index];
                return AppCardWidget(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${entry.timestamp.toIso8601String()} • ${entry.loggerName}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        entry.message,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      if (entry.error != null && entry.error!.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          entry.error!,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                      if (entry.stackTrace != null &&
                          entry.stackTrace!.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        SelectableText(
                          entry.stackTrace!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
