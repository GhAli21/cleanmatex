import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_core/mobile_core.dart';

void main() {
  group('classifyCode', () {
    test('reads order, sub-order, line, piece and staff QR', () {
      expect(classifyCode('ORD-20261031-0007'), CodeKind.order);
      expect(classifyCode('ord-20261031-0007-s2'), CodeKind.order);
      expect(classifyCode('ORD-20261031-0007-2'), CodeKind.item);
      expect(classifyCode('ORD-20261031-0007-2-1'), CodeKind.piece);
      expect(classifyCode('CMX1:PEC:ORD-20261031-0007-2-1'), CodeKind.cmx);
      expect(classifyCode('TAG-ABC'), CodeKind.unknown);
      expect(classifyCode('ORD-2026-1'), CodeKind.unknown);
    });

    test('normalises scanner noise and Arabic digits', () {
      expect(normalizeScanInput(']C0ORD-20261031-0007\r\n'), 'ORD-20261031-0007');
      expect(classifyCode('ORD-٢٠٢٦١٠٣١-٠٠٠٧'), CodeKind.order);
      expect(toAsciiDigits('۱۲۳'), '123');
    });
  });

  test('orderNoFromCode gives the order of a line or piece', () {
    expect(orderNoFromCode('ORD-20261031-0007-2-1'), 'ORD-20261031-0007');
    expect(orderNoFromCode('ORD-20261031-0007-S1-3'), 'ORD-20261031-0007-S1');
    expect(orderNoFromCode('ord-20261031-0007'), 'ORD-20261031-0007');
    expect(orderNoFromCode('CMX1:ORD:ORD-20261031-0007'), isNull);
    expect(orderNoFromCode('ORD'), isNull);
  });

  test('isOrderNo and isPieceCode', () {
    expect(isOrderNo(' ORD-20261031-0007 '), isTrue);
    expect(isOrderNo('ORD-20261031-0007-1'), isFalse);
    expect(isPieceCode('ORD-20261031-0007-1-2'), isTrue);
    expect(isPieceCode('ORD-20261031-0007-1'), isFalse);
  });

  group('CMX payload', () {
    test('round trip', () {
      final raw = encodeCmxPayload('pec', 'ORD-20261031-0007-2-1');
      expect(raw, 'CMX1:PEC:ORD-20261031-0007-2-1');
      final r = decodeCmxPayload(raw);
      expect(r.ok, isTrue);
      expect(r.payload!.type, 'PEC');
      expect(r.payload!.code, 'ORD-20261031-0007-2-1');
      expect(r.payload!.version, 1);
    });

    test('errors', () {
      expect(decodeCmxPayload('ORD-20261031-0007').error, CmxPayloadDecodeError.notCmx);
      expect(decodeCmxPayload('CMX2:ORD:X').error, CmxPayloadDecodeError.unsupportedVersion);
      expect(decodeCmxPayload('CMX1:O1:X').error, CmxPayloadDecodeError.badType);
      expect(decodeCmxPayload('CMX1:ORD: ').error, CmxPayloadDecodeError.emptyCode);
      expect(() => encodeCmxPayload('O', 'X'), throwsArgumentError);
      expect(() => encodeCmxPayload('ORD', ' '), throwsArgumentError);
    });
  });

  test('ltrCode wraps in a left-to-right isolate', () {
    expect(ltrCode('ORD-20261031-0007'), '\u2066ORD-20261031-0007\u2069');
    expect(ltrCode(''), '');
  });
}
