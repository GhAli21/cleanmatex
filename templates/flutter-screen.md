# Flutter Screen Template

## 📁 Feature Structure

```
lib/features/{feature}/
├── screens/
│   ├── {feature}_list_screen.dart
│   ├── {feature}_detail_screen.dart
│   └── {feature}_form_screen.dart
├── widgets/
│   ├── {feature}_card.dart
│   ├── {feature}_list_item.dart
│   └── {feature}_form_fields.dart
├── providers/
│   ├── {feature}_provider.dart
│   └── {feature}_state.dart
└── models/
    └── {feature}_model.dart
```

---

## 📱 List Screen Template

**File**: `lib/features/{feature}/screens/{feature}_list_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/{feature}_provider.dart';
import '../widgets/{feature}_card.dart';

class {Feature}ListScreen extends ConsumerStatefulWidget {
  const {Feature}ListScreen({super.key});

  @override
  ConsumerState<{Feature}ListScreen> createState() => _{Feature}ListScreenState();
}

class _{Feature}ListScreenState extends ConsumerState<{Feature}ListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final {feature}sAsync = ref.watch({feature}ListProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('{Features}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search {features}...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onChanged: (value) {
                setState(() => _searchQuery = value);
                // Debounce search
                Future.delayed(const Duration(milliseconds: 500), () {
                  if (_searchQuery == value) {
                    ref.read({feature}ListProvider.notifier).search(value);
                  }
                });
              },
            ),
          ),

          // List Content
          Expanded(
            child: {feature}sAsync.when(
              data: ({feature}s) {
                if ({feature}s.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.inbox_outlined,
                          size: 64,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No {features} found',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    await ref.refresh({feature}ListProvider.future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: {feature}s.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final {feature} = {feature}s[index];
                      return {Feature}Card(
                        {feature}: {feature},
                        onTap: () => context.push('/{features}/${{feature}.id}'),
                      );
                    },
                  ),
                );
              },
              loading: () => const Center(
                child: CircularProgressIndicator(),
              ),
              error: (error, stack) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.error_outline,
                      size: 64,
                      color: Theme.of(context).colorScheme.error,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Error loading {features}',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      error.toString(),
                      style: Theme.of(context).textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => ref.refresh({feature}ListProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/{features}/new'),
        icon: const Icon(Icons.add),
        label: const Text('Create {Feature}'),
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Filter {Features}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Add filter options
            ListTile(
              title: const Text('Active'),
              trailing: Checkbox(value: true, onChanged: (v) {}),
            ),
            ListTile(
              title: const Text('Inactive'),
              trailing: Checkbox(value: false, onChanged: (v) {}),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              // Apply filters
              Navigator.pop(context);
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }
}
```

---

## 📄 Detail Screen Template

**File**: `lib/features/{feature}/screens/{feature}_detail_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/{feature}_provider.dart';
import '../models/{feature}_model.dart';

class {Feature}DetailScreen extends ConsumerWidget {
  final String {feature}Id;

  const {Feature}DetailScreen({
    super.key,
    required this.{feature}Id,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final {feature}Async = ref.watch({feature}DetailProvider({feature}Id));

    return Scaffold(
      appBar: AppBar(
        title: const Text('{Feature} Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () => context.push('/{features}/${feature}Id/edit'),
          ),
          IconButton(
            icon: const Icon(Icons.delete),
            onPressed: () => _showDeleteDialog(context, ref),
          ),
        ],
      ),
      body: {feature}Async.when(
        data: ({feature}) => _buildContent(context, {feature}),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 16),
              Text('Error loading {feature}'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.refresh({feature}DetailProvider({feature}Id)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, {Feature}Model {feature}) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    {feature}.name,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  _StatusChip(status: {feature}.status),
                  if ({feature}.description != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      {feature}.description!,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Details Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Details',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 16),
                  _DetailRow(
                    label: 'Created',
                    value: _formatDate({feature}.createdAt),
                  ),
                  const Divider(),
                  _DetailRow(
                    label: 'Updated',
                    value: _formatDate({feature}.updatedAt),
                  ),
                  // Add more detail rows
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showDeleteDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete {Feature}'),
        content: const Text(
          'Are you sure you want to delete this {feature}? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await ref.read({feature}Provider.notifier).delete({feature}Id);
                if (context.mounted) {
                  context.pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('{Feature} deleted')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status.toLowerCase()) {
      case 'active':
        color = Colors.green;
        break;
      case 'pending':
        color = Colors.orange;
        break;
      default:
        color = Colors.grey;
    }

    return Chip(
      label: Text(status),
      backgroundColor: color.withOpacity(0.2),
      labelStyle: TextStyle(color: color),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
          ),
        ],
      ),
    );
  }
}
```

---

## 📝 Form Screen Template

**File**: `lib/features/{feature}/screens/{feature}_form_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/{feature}_provider.dart';
import '../models/{feature}_model.dart';

class {Feature}FormScreen extends ConsumerStatefulWidget {
  final String? {feature}Id;

  const {Feature}FormScreen({
    super.key,
    this.{feature}Id,
  });

  @override
  ConsumerState<{Feature}FormScreen> createState() => _{Feature}FormScreenState();
}

class _{Feature}FormScreenState extends ConsumerState<{Feature}FormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.{feature}Id != null) {
      _loadExisting{Feature}();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadExisting{Feature}() async {
    try {
      final {feature} = await ref.read(
        {feature}DetailProvider(widget.{feature}Id!).future,
      );
      _nameController.text = {feature}.name;
      _descriptionController.text = {feature}.description ?? '';
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading {feature}: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.{feature}Id != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit {Feature}' : 'Create {Feature}'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Name Field
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Name *',
                hintText: 'Enter {feature} name',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Name is required';
                }
                if (value.length > 255) {
                  return 'Name must be less than 255 characters';
                }
                return null;
              },
            ),

            const SizedBox(height: 16),

            // Description Field
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Enter description (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 4,
              maxLength: 1000,
            ),

            const SizedBox(height: 24),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isLoading ? null : () => context.pop(),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: FilledButton(
                    onPressed: _isLoading ? null : _handleSubmit,
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(isEdit ? 'Update' : 'Create'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isLoading = true);

    try {
      final data = {
        'name': _nameController.text,
        'description': _descriptionController.text.isEmpty
            ? null
            : _descriptionController.text,
      };

      if (widget.{feature}Id != null) {
        await ref.read({feature}Provider.notifier).update(
              widget.{feature}Id!,
              data,
            );
      } else {
        await ref.read({feature}Provider.notifier).create(data);
      }

      if (mounted) {
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.{feature}Id != null
                  ? '{Feature} updated successfully'
                  : '{Feature} created successfully',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }
}
```

---

## 🎯 Provider Template (Riverpod)

**File**: `lib/features/{feature}/providers/{feature}_provider.dart`

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api_client.dart';
import '../models/{feature}_model.dart';

// List Provider
final {feature}ListProvider = FutureProvider<List<{Feature}Model>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final response = await api.get('/{features}');
  return (response.data['data'] as List)
      .map((json) => {Feature}Model.fromJson(json))
      .toList();
});

// Detail Provider
final {feature}DetailProvider = FutureProvider.family<{Feature}Model, String>(
  (ref, id) async {
    final api = ref.watch(apiClientProvider);
    final response = await api.get('/{features}/$id');
    return {Feature}Model.fromJson(response.data['data']);
  },
);

// State Notifier for mutations
class {Feature}Notifier extends StateNotifier<AsyncValue<List<{Feature}Model>>> {
  {Feature}Notifier(this._api) : super(const AsyncValue.loading());

  final ApiClient _api;

  Future<void> load() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final response = await _api.get('/{features}');
      return (response.data['data'] as List)
          .map((json) => {Feature}Model.fromJson(json))
          .toList();
    });
  }

  Future<void> create(Map<String, dynamic> data) async {
    await _api.post('/{features}', data: data);
    await load();
  }

  Future<void> update(String id, Map<String, dynamic> data) async {
    await _api.patch('/{features}/$id', data: data);
    await load();
  }

  Future<void> delete(String id) async {
    await _api.delete('/{features}/$id');
    await load();
  }

  Future<void> search(String query) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final response = await _api.get('/{features}', queryParameters: {
        'search': query,
      });
      return (response.data['data'] as List)
          .map((json) => {Feature}Model.fromJson(json))
          .toList();
    });
  }
}

final {feature}Provider =
    StateNotifierProvider<{Feature}Notifier, AsyncValue<List<{Feature}Model>>>(
  (ref) => {Feature}Notifier(ref.watch(apiClientProvider))..load(),
);
```

---

## 📦 Model Template

**File**: `lib/features/{feature}/models/{feature}_model.dart`

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

part '{feature}_model.freezed.dart';
part '{feature}_model.g.dart';

@freezed
class {Feature}Model with _${Feature}Model {
  const factory {Feature}Model({
    required String id,
    required String name,
    String? description,
    required String status,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _{Feature}Model;

  factory {Feature}Model.fromJson(Map<String, dynamic> json) =>
      _${Feature}ModelFromJson(json);
}
```

---

## ✅ Checklist for New Screen

- [ ] Create screen file
- [ ] Create provider for state management
- [ ] Create model with freezed
- [ ] Run code generation: `flutter pub run build_runner build`
- [ ] Add to router configuration
- [ ] Implement loading states
- [ ] Implement error states
- [ ] Implement empty states
- [ ] Add pull-to-refresh
- [ ] Add form validation
- [ ] Handle errors gracefully
- [ ] Test on different screen sizes
- [ ] Test RTL layout (Arabic)
- [ ] Add loading indicators
- [ ] Test navigation

---

**Last Updated**: 2025-01-09
