import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';

import 'app.dart';

void main() {
  AppConfig.fromEnvironment().assertProductionReady();
  runApp(const ProviderScope(child: CustomerApp()));
}
