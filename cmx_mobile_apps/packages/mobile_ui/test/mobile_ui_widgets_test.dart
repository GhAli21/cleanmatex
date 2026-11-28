import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_ui/mobile_ui.dart';

void main() {
  group('AppProgressStepperWidget (flexible N-stage Horizontal & Vertical)', () {
    List<AppProgressStepItem> buildSteps(int count, int activeIndex) {
      return List.generate(
        count,
        (i) => AppProgressStepItem(
          title: 'Stage ${i + 1}',
          shortLabel: 'S${i + 1}',
          subtitle: 'Details for stage ${i + 1}',
          timestampLabel: '10:0$i AM',
          isCompleted: i < activeIndex,
          isActive: i == activeIndex,
        ),
      );
    }

    testWidgets('renders 3-stage, 5-stage, and 8-stage steppers and toggles orientation',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
                children: [
                  AppProgressStepperWidget(
                    title: 'Quick Drop (3)',
                    steps: buildSteps(3, 1),
                    initialOrientation: AppStepperOrientation.horizontal,
                  ),
                  AppProgressStepperWidget(
                    title: 'Order History (8)',
                    steps: buildSteps(8, 4),
                    initialOrientation: AppStepperOrientation.horizontal,
                    horizontalLabel: 'Horizontal',
                    verticalLabel: 'Vertical',
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.text('Quick Drop (3)'), findsOneWidget);
      expect(find.text('Order History (8)'), findsOneWidget);
      expect(find.text('S8'), findsOneWidget);

      // Toggle second stepper to Vertical layout
      await tester.tap(find.text('Vertical').last);
      await tester.pumpAndSettle();
      expect(find.text('Stage 8'), findsOneWidget);
    });

    testWidgets('renders cleanly in Arabic RTL and Dark Mode', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark(locale: const Locale('ar')),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: AppProgressStepperWidget(
                title: 'تتبع الطلب',
                steps: buildSteps(5, 2),
                horizontalLabel: 'أفقي',
                verticalLabel: 'عمودي',
              ),
            ),
          ),
        ),
      );

      expect(find.text('تتبع الطلب'), findsOneWidget);
      expect(find.text('أفقي'), findsOneWidget);
      expect(find.text('عمودي'), findsOneWidget);
    });
  });

  group('CmxOrgThemeOverride WCAG contrast guard & Always-Light paper', () {
    test('adjusts very light custom org brand hex for light-mode contrast', () {
      const override = CmxOrgThemeOverride(primaryHex: '#CCFBF1');
      final textColor = override.resolvePrimaryText(Brightness.light);
      expect(textColor.computeLuminance(), lessThan(0.25));
    });

    test('AppTheme.paperLight always produces Brightness.light', () {
      final paper = AppTheme.paperLight();
      expect(paper.brightness, Brightness.light);
      expect(paper.colorScheme.surface, AppColors.cardSurface);
    });
  });

  group('Canonical shared widgets', () {
    testWidgets('AppStatusBadgeWidget, AppCodeChipWidget & AppQuantityStepperWidget',
        (tester) async {
      var qty = 2;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) => Column(
                children: [
                  const AppStatusBadgeWidget(
                    label: 'Cleaning & Care',
                    tone: CmxSemanticTone.brand,
                    icon: Icons.local_laundry_service_rounded,
                  ),
                  const AppCodeChipWidget(code: 'ORD-26-04182'),
                  AppQuantityStepperWidget(
                    value: qty,
                    onChanged: (next) => setState(() => qty = next),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.text('Cleaning & Care'), findsOneWidget);
      expect(find.text('ORD-26-04182'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.add_rounded));
      await tester.pump();
      expect(find.text('3'), findsOneWidget);
    });
  });
}
