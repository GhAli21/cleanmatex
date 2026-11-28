import 'package:flutter/material.dart';

/// Locked responsive thresholds for CleanMateX mobile apps.
class AppBreakpoints {
  const AppBreakpoints._();

  static const double compact = 380;
  static const double mobile = 600;
  static const double tablet = 1024;

  static bool isCompact(double width) => width < compact;
  static bool isMobile(double width) => width < mobile;
  static bool isTablet(double width) => width >= mobile && width < tablet;
  static bool isDesktop(double width) => width >= tablet;
}

/// LayoutBuilder-based responsive wrapper avoiding raw MediaQuery width checks.
class ResponsiveLayoutBuilder extends StatelessWidget {
  const ResponsiveLayoutBuilder({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  final WidgetBuilder mobile;
  final WidgetBuilder? tablet;
  final WidgetBuilder? desktop;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        if (AppBreakpoints.isDesktop(width) && desktop != null) {
          return desktop!(context);
        }
        if (AppBreakpoints.isTablet(width) && tablet != null) {
          return tablet!(context);
        }
        return mobile(context);
      },
    );
  }
}
