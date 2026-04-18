import 'package:flutter/widgets.dart';

class TestAppWrapper extends StatelessWidget {
  const TestAppWrapper({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return child;
  }
}
