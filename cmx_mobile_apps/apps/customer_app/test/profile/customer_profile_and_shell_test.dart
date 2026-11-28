import 'package:customer_app/features/profile/ui/screens/customer_profile_screen.dart';
import 'package:customer_app/features/shell/ui/screens/customer_shell_screen.dart';
import 'package:customer_app/features/tenant/providers/tenant_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

class _TestTenantNotifier extends TenantNotifier {
  @override
  Future<TenantModel?> build() async {
    return const TenantModel(
      tenantOrgId: 'demo-tenant-org-id',
      name: 'Al-Noor Laundry',
      name2: 'مغسلة النور',
      lastBranchId: 'demo-main-branch',
      lastBranchName: 'Al Khuwair Main',
      branches: [
        BranchOptionModel(
          id: 'demo-main-branch',
          name: 'Al Khuwair Main',
          isMain: true,
        ),
      ],
    );
  }
}

void main() {
  testWidgets('Profile renders full CleanMateX account details & theme controls',
      (tester) async {
    await tester.pumpWidget(
      TestAppWrapper(
        overrides: [tenantProvider.overrideWith(_TestTenantNotifier.new)],
        child: const CustomerProfileScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Your profile'), findsOneWidget);
    expect(find.text('Al-Noor Laundry'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Language'), 300);
    expect(find.text('Language'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Appearance'), 300);
    expect(find.text('Appearance'), findsOneWidget);
  });

  testWidgets(
      '4-tab CustomerShellScreen switches across Home, Orders, Receipts, Account',
      (tester) async {
    await tester.pumpWidget(
      TestAppWrapper(
        overrides: [tenantProvider.overrideWith(_TestTenantNotifier.new)],
        child: const CustomerShellScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Orders'), findsOneWidget);
    expect(find.text('Receipts'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);

    await tester.tap(find.text('Receipts'));
    await tester.pumpAndSettle();
    expect(find.text('Digital Receipts'), findsOneWidget);

    await tester.tap(find.text('Account'));
    await tester.pumpAndSettle();
    expect(find.text('Your profile'), findsOneWidget);
  });
}
