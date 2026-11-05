/// Human-Friendly Codes for the mobile apps (Human-Friendly Codes P8, T8.1).
///
/// A 1:1 Dart copy of the web-admin rules (A-15), so every app reads codes the
/// same way:
/// - `web-admin/lib/validations/code-format-schemas.ts` (formats, scan input)
/// - `web-admin/lib/services/scan-resolve/cmx-code-payload.ts` (staff QR payload)
///
/// Codes: order `ORD-YYYYMMDD-NNNN[-S<n>]`, line `<order>-<n>`,
/// piece `<line>-<n>`, staff QR `CMX<v>:<TYPE>:<code>`.
///
/// Pure Dart: no Flutter imports. Codes are always shown left-to-right, also
/// in Arabic screens (use [ltrCode]).
library;

/// Order number (root or sub-order). Same as ORDER_NUMBER_PATTERN in web-admin.
const String _orderNoBody = r'ORD-(\d{8})-(\d{4,})(?:-S([1-9]\d*))?';

/// Exact order number, upper case.
final RegExp orderNoRe = RegExp('^$_orderNoBody\$');

/// Exact order line number `<order>-<n>`.
final RegExp itemSrnoRe = RegExp('^$_orderNoBody-\\d+\$');

/// Exact piece code `<order>-<line>-<piece>`.
final RegExp pieceCodeRe = RegExp('^$_orderNoBody-\\d+-\\d+\$');

/// Staff QR payload start `CMX<version>:` (any letter case).
final RegExp cmxPayloadPrefixRe = RegExp(r'^CMX\d+:', caseSensitive: false);

/// Longest raw value a scan or typed lookup may send (before normalising).
const int scanRawMaxLength = 128;

/// What a value looks like. [unknown] can still be an external tag.
enum CodeKind { cmx, order, item, piece, unknown }

/// Arabic-Indic (U+0660..0669) and Persian (U+06F0..06F9) digits to ASCII.
String toAsciiDigits(String value) {
  final buffer = StringBuffer();
  for (final rune in value.runes) {
    if (rune >= 0x0660 && rune <= 0x0669) {
      buffer.writeCharCode(0x30 + rune - 0x0660);
    } else if (rune >= 0x06F0 && rune <= 0x06F9) {
      buffer.writeCharCode(0x30 + rune - 0x06F0);
    } else {
      buffer.writeCharCode(rune);
    }
  }
  return buffer.toString();
}

final RegExp _aimPrefixRe = RegExp(r'^\][A-Za-z][0-9A-Za-z]');
final RegExp _controlCharsRe = RegExp('[\u0000-\u001F\u007F-\u009F]');

/// Normalise a scanned or typed value: drop control characters (CR, LF, TAB,
/// GS, ...), drop an AIM prefix (`]C0`, `]Q1`, ...), map Arabic-Indic digits
/// to ASCII, trim. Letter case is kept.
String normalizeScanInput(String raw) {
  var v = raw.replaceAll(_controlCharsRe, '').trim();
  if (_aimPrefixRe.hasMatch(v)) v = v.substring(3);
  return toAsciiDigits(v).trim();
}

/// What a (normalised) value looks like.
CodeKind classifyCode(String raw) {
  final v = normalizeScanInput(raw).toUpperCase();
  if (cmxPayloadPrefixRe.hasMatch(v)) return CodeKind.cmx;
  if (orderNoRe.hasMatch(v)) return CodeKind.order;
  if (itemSrnoRe.hasMatch(v)) return CodeKind.item;
  if (pieceCodeRe.hasMatch(v)) return CodeKind.piece;
  return CodeKind.unknown;
}

/// True when [raw] is an exact order number (after normalising).
bool isOrderNo(String raw) => orderNoRe.hasMatch(normalizeScanInput(raw).toUpperCase());

/// True when [raw] is an exact piece code (after normalising).
bool isPieceCode(String raw) => pieceCodeRe.hasMatch(normalizeScanInput(raw).toUpperCase());

/// The order number inside an order number, line code or piece code.
/// `ORD-20261031-0007-2-1` gives `ORD-20261031-0007`. Anything else gives null.
String? orderNoFromCode(String raw) {
  final v = normalizeScanInput(raw).toUpperCase();
  if (orderNoRe.hasMatch(v)) return v;
  if (itemSrnoRe.hasMatch(v)) return v.replaceFirst(RegExp(r'-\d+$'), '');
  if (pieceCodeRe.hasMatch(v)) return v.replaceFirst(RegExp(r'-\d+-\d+$'), '');
  return null;
}

// ---------------------------------------------------------------------------
// Staff QR payload `CMX<version>:<TYPE>:<code>` (plan section 6.4)
// ---------------------------------------------------------------------------

/// Payload version written by [encodeCmxPayload].
const int cmxPayloadVersion = 1;

/// Why a value is not a usable payload. Same names as web-admin.
enum CmxPayloadDecodeError { notCmx, unsupportedVersion, badType, emptyCode }

/// Parts of a staff QR payload.
class CmxPayload {
  const CmxPayload({required this.version, required this.type, required this.code});

  final int version;

  /// Doc type prefix from sys_doc_seq_type_cd (ORD, ITM, PEC, ...).
  final String type;

  /// The code, upper case.
  final String code;
}

/// Result of [decodeCmxPayload]: [payload] when ok, else [error].
class CmxPayloadDecodeResult {
  const CmxPayloadDecodeResult._(this.payload, this.error);

  final CmxPayload? payload;
  final CmxPayloadDecodeError? error;

  bool get ok => payload != null;
}

final RegExp _payloadRe = RegExp(r'^CMX(\d+):([^:]*):(.*)$', caseSensitive: false);
final RegExp _typeRe = RegExp(r'^[A-Z]{3,5}$');

/// Build `CMX1:<TYPE>:<code>`. Throws [ArgumentError] on a bad type or empty code.
String encodeCmxPayload(String type, String code) {
  final t = type.trim().toUpperCase();
  if (!_typeRe.hasMatch(t)) {
    throw ArgumentError('CMX payload type must be 3..5 capital letters');
  }
  if (code.trim().isEmpty) {
    throw ArgumentError('CMX payload code must not be empty');
  }
  return 'CMX$cmxPayloadVersion:$t:${code.trim()}';
}

/// Read a payload. The code is upper-cased (our codes are upper case).
CmxPayloadDecodeResult decodeCmxPayload(String raw) {
  final m = _payloadRe.firstMatch(raw.trim());
  if (m == null) return const CmxPayloadDecodeResult._(null, CmxPayloadDecodeError.notCmx);
  final version = int.parse(m.group(1)!);
  if (version != cmxPayloadVersion) {
    return const CmxPayloadDecodeResult._(null, CmxPayloadDecodeError.unsupportedVersion);
  }
  final type = m.group(2)!.trim().toUpperCase();
  if (!_typeRe.hasMatch(type)) {
    return const CmxPayloadDecodeResult._(null, CmxPayloadDecodeError.badType);
  }
  final code = m.group(3)!.trim().toUpperCase();
  if (code.isEmpty) {
    return const CmxPayloadDecodeResult._(null, CmxPayloadDecodeError.emptyCode);
  }
  return CmxPayloadDecodeResult._(CmxPayload(version: version, type: type, code: code), null);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const String _lri = '\u2066'; // LEFT-TO-RIGHT ISOLATE
const String _pdi = '\u2069'; // POP DIRECTIONAL ISOLATE

/// A code wrapped in a left-to-right isolate, so it reads the same in Arabic
/// (RTL) text and lines. Empty stays empty. Use for display only, never to
/// store, send or compare.
String ltrCode(String code) => code.isEmpty ? code : '$_lri$code$_pdi';
