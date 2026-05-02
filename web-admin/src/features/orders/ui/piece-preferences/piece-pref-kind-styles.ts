/**
 * Preference kind visuals: DB stores hex (e.g. #1976D2) or optional Tailwind fragments.
 */

import type { CSSProperties } from 'react';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function normalizeFullHex(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return `#${h.split('').map((c) => c + c).join('')}`;
  }
  if (h.length >= 6) {
    return `#${h.slice(0, 6)}`;
  }
  return `#${h}`;
}

export function parseKindBgHex(kindBg: string | null | undefined): string | null {
  if (!kindBg?.trim()) return null;
  const t = kindBg.trim();
  if (!HEX_RE.test(t)) return null;
  return normalizeFullHex(t);
}

export function hexToRgba(hex: string, alpha: number): string {
  const full = normalizeFullHex(hex).replace('#', '');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Inactive tab: tinted fill + border from kind color */
export function kindToolbarInactiveSurface(hex: string | null): { style: CSSProperties; textClass: string } {
  if (!hex) {
    return {
      style: {},
      textClass: 'border border-gray-200 bg-white text-gray-800 shadow-sm',
    };
  }
  return {
    style: {
      borderWidth: 2,
      borderColor: hex,
      backgroundColor: hexToRgba(hex, 0.14),
      color: '#1f2937',
    },
    textClass: '',
  };
}

/** Chip accent: left stripe + light tint (distinct from pill default gray) */
export function kindChipAccentStyle(hex: string | null): CSSProperties | undefined {
  if (!hex) return undefined;
  return {
    borderLeftWidth: 4,
    borderLeftColor: hex,
    backgroundColor: hexToRgba(hex, 0.1),
  };
}

/** Readable text on top of a solid-ish tinted chip background */
export function contrastTextForHexBg(hex: string): string {
  const full = normalizeFullHex(hex).replace('#', '');
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#111827' : '#ffffff';
}

/** Color-catalog chips: background/tint from the swatch hex (not the kind tab color). */
export function catalogColorChipStyle(hex: string): CSSProperties {
  const full = normalizeFullHex(hex);
  return {
    borderWidth: 1,
    borderColor: full,
    backgroundColor: hexToRgba(full, 0.38),
    color: contrastTextForHexBg(full),
  };
}

/** True if value looks like Tailwind utility fragments (legacy seed data). */
export function isTailwindKindBgToken(kindBg: string | null | undefined): boolean {
  if (!kindBg?.trim()) return false;
  return /^(bg-|text-|border-)/.test(kindBg.trim());
}
