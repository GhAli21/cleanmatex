import 'package:flutter/material.dart';

import 'app_spacing.dart';

class AppResponsiveScrollScaffold extends StatelessWidget {
  const AppResponsiveScrollScaffold({
    super.key,
    this.appBar,
    required this.child,
    this.padding = const EdgeInsetsDirectional.fromSTEB(
      AppSpacing.lg,
      AppSpacing.lg,
      AppSpacing.lg,
      AppSpacing.lg,
    ),
  });

  final PreferredSizeWidget? appBar;
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        appBar: appBar,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          top: appBar == null,
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight,
                  ),
                  child: IntrinsicHeight(
                    child: Padding(
                      padding: padding,
                      child: Align(
                        alignment: Alignment.center,
                        child: child,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
