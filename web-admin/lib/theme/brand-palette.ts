/**
 * Brand palette: turns two brand seed colours into every brand-dependent
 * design token for light and dark mode.
 *
 * Pure and dependency-free, so the same code runs on the server (theme
 * resolution) and in the browser (branding preview). Colour maths is done in
 * OKLCH; the output is plain sRGB triplets that any browser understands.
 *
 * @module lib/theme/brand-palette
 */

export type ThemeMode = 'LIGHT' | 'DARK'

/** Space-separated sRGB channels, e.g. "10 182 216". */
export type RgbTriplet = string

export const BRAND_TOKENS = [
  // brand
  'primary',
  'primary-hover',
  'primary-fg',
  'primary-bg',
  'primary-text',
  'brand-secondary',
  'brand-secondary-hover',
  'brand-secondary-fg',
  'brand-secondary-text',
  'focus-ring',
  // neutrals, tinted toward the primary hue
  'background',
  'surface',
  'surface-muted',
  'surface-elevated',
  'card',
  'card-bg',
  'input-bg',
  'muted',
  'secondary-bg',
  'secondary-hover-bg',
  'secondary-fg',
  'ghost-hover-bg',
  'field-hover',
  'table-header-bg',
  'table-row-hover-bg',
  'border',
  'border-subtle',
  'foreground',
  'text-primary',
  'text-secondary',
  'muted-foreground',
] as const

export type BrandToken = (typeof BRAND_TOKENS)[number]
export type BrandPalette = Record<ThemeMode, Record<BrandToken, RgbTriplet>>

type NeutralToken = Exclude<
  BrandToken,
  | 'primary'
  | 'primary-hover'
  | 'primary-fg'
  | 'primary-bg'
  | 'primary-text'
  | 'brand-secondary'
  | 'brand-secondary-hover'
  | 'brand-secondary-fg'
  | 'brand-secondary-text'
  | 'focus-ring'
>

interface Oklch {
  l: number
  c: number
  h: number
}

/** Minimum contrast for text (WCAG 2 AA). */
const MIN_TEXT_CONTRAST = 4.5
const WHITE: RgbTriplet = '255 255 255'
const BLACK: RgbTriplet = '0 0 0'
/** Dark foreground tried before pure black, so text on light brand colours is not harsh. */
const DARK_FG: RgbTriplet = '14 23 38'
/** Below this chroma a seed is a grey: its hue is noise and must not tint the neutrals. */
const ACHROMATIC_CHROMA = 0.02

/** [lightness, chroma] per neutral token; hue comes from the primary seed. */
const NEUTRALS: Record<ThemeMode, Record<NeutralToken, readonly [number, number]>> = {
  LIGHT: {
    background: [0.985, 0.004],
    surface: [1, 0],
    card: [1, 0],
    'card-bg': [1, 0],
    'input-bg': [1, 0],
    'surface-elevated': [1, 0],
    'surface-muted': [0.962, 0.006],
    muted: [0.968, 0.006],
    'table-header-bg': [0.975, 0.005],
    'table-row-hover-bg': [0.97, 0.006],
    'field-hover': [0.97, 0.006],
    'ghost-hover-bg': [0.955, 0.008],
    'secondary-bg': [0.955, 0.008],
    'secondary-hover-bg': [0.925, 0.01],
    border: [0.895, 0.009],
    'border-subtle': [0.925, 0.007],
    foreground: [0.21, 0.02],
    'text-primary': [0.21, 0.02],
    'secondary-fg': [0.21, 0.02],
    'text-secondary': [0.37, 0.02],
    'muted-foreground': [0.52, 0.02],
  },
  DARK: {
    background: [0.135, 0.012],
    surface: [0.175, 0.014],
    card: [0.175, 0.014],
    'card-bg': [0.175, 0.014],
    'input-bg': [0.2, 0.014],
    'surface-elevated': [0.215, 0.016],
    'surface-muted': [0.2, 0.014],
    muted: [0.215, 0.014],
    'table-header-bg': [0.2, 0.014],
    'table-row-hover-bg': [0.22, 0.016],
    'field-hover': [0.22, 0.016],
    'ghost-hover-bg': [0.25, 0.016],
    'secondary-bg': [0.25, 0.016],
    'secondary-hover-bg': [0.3, 0.018],
    border: [0.3, 0.018],
    'border-subtle': [0.26, 0.016],
    foreground: [0.95, 0.005],
    'text-primary': [0.95, 0.005],
    'secondary-fg': [0.95, 0.005],
    'text-secondary': [0.85, 0.01],
    'muted-foreground': [0.72, 0.015],
  },
}

/**
 * CSS variable name used while components still read `rgb(var(--cmx-…-rgb))`.
 * @param token - Brand token name
 * @returns e.g. "--cmx-primary-rgb" for "primary"
 */
export function cssVarName(token: BrandToken): string {
  return `--cmx-${token}-rgb`
}

/**
 * WCAG 2 contrast ratio between two colours.
 * @param a - First colour
 * @param b - Second colour
 * @returns Ratio from 1 (identical) to 21 (black on white)
 */
export function contrastRatio(a: RgbTriplet, b: RgbTriplet): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Every brand-dependent token for both modes, from two seed colours.
 *
 * The seeds are used unchanged as the solid colours. Text placed on them, and
 * brand-coloured text placed on surfaces, is derived so it stays readable.
 * @param primaryHex - Primary seed as `#RRGGBB`
 * @param secondaryHex - Secondary seed as `#RRGGBB`
 * @returns Triplets keyed by mode then token
 * @throws Error when a seed is not `#RRGGBB`
 */
export function computeBrandPalette(primaryHex: string, secondaryHex: string): BrandPalette {
  const primary = toOklch(parseHex(primaryHex))
  const secondary = toOklch(parseHex(secondaryHex))
  return {
    LIGHT: buildMode('LIGHT', primary, secondary),
    DARK: buildMode('DARK', primary, secondary),
  }
}

function buildMode(mode: ThemeMode, primary: Oklch, secondary: Oklch): Record<BrandToken, RgbTriplet> {
  const tint = primary.c < ACHROMATIC_CHROMA ? 0 : 1
  const neutrals = {} as Record<NeutralToken, RgbTriplet>
  for (const [token, [l, c]] of Object.entries(NEUTRALS[mode]) as Array<[NeutralToken, readonly [number, number]]>) {
    neutrals[token] = fromOklch({ l, c: c * tint, h: primary.h })
  }

  const primarySolid = fromOklch(primary)
  const secondarySolid = fromOklch(secondary)
  const primaryFg = readableOn(primarySolid)
  const secondaryFg = readableOn(secondarySolid)
  const primaryText = readableText(primary, neutrals.surface, mode)

  return {
    ...neutrals,
    primary: primarySolid,
    'primary-fg': primaryFg,
    'primary-hover': hoverOf(primary, primaryFg),
    'primary-bg': fromOklch({ l: mode === 'LIGHT' ? 0.96 : 0.25, c: Math.min(primary.c, 0.04), h: primary.h }),
    'primary-text': primaryText,
    'focus-ring': primaryText,
    'brand-secondary': secondarySolid,
    'brand-secondary-fg': secondaryFg,
    'brand-secondary-hover': hoverOf(secondary, secondaryFg),
    'brand-secondary-text': readableText(secondary, neutrals.surface, mode),
  }
}

/** White if readable on `solid`, else a dark navy, else whichever of black/white contrasts more. */
function readableOn(solid: RgbTriplet): RgbTriplet {
  if (contrastRatio(WHITE, solid) >= MIN_TEXT_CONTRAST) return WHITE
  if (contrastRatio(DARK_FG, solid) >= MIN_TEXT_CONTRAST) return DARK_FG
  return contrastRatio(BLACK, solid) >= contrastRatio(WHITE, solid) ? BLACK : WHITE
}

/** Hover moves lightness away from the foreground so the label stays readable. */
function hoverOf(solid: Oklch, fg: RgbTriplet): RgbTriplet {
  const delta = fg === WHITE ? -0.05 : 0.05
  return fromOklch({ ...solid, l: clamp01(solid.l + delta) })
}

/** The seed, darkened (light mode) or lightened (dark mode) until it is readable as text on `surface`. */
function readableText(seed: Oklch, surface: RgbTriplet, mode: ThemeMode): RgbTriplet {
  const step = mode === 'LIGHT' ? -0.02 : 0.02
  let l = seed.l
  let colour = fromOklch({ ...seed, l })
  // Stop only at the end the step is heading for: a black seed in dark mode starts at l = 0 and must still climb.
  while (contrastRatio(colour, surface) < MIN_TEXT_CONTRAST && (step < 0 ? l > 0 : l < 1)) {
    l = clamp01(l + step)
    colour = fromOklch({ ...seed, l })
  }
  return colour
}

function parseHex(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Invalid colour: ${hex}`)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function relativeLuminance(triplet: RgbTriplet): number {
  const [r, g, b] = triplet.split(' ').map((channel) => srgbToLinear(Number(channel) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

// sRGB <-> OKLab matrices: Björn Ottosson, https://bottosson.github.io/posts/oklab/
function toOklch([r8, g8, b8]: [number, number, number]): Oklch {
  const r = srgbToLinear(r8 / 255)
  const g = srgbToLinear(g8 / 255)
  const b = srgbToLinear(b8 / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lab = {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
  return { l: lab.l, c: Math.hypot(lab.a, lab.b), h: Math.atan2(lab.b, lab.a) }
}

function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

/** OKLCH to an sRGB triplet; out-of-gamut colours lose chroma, never hue or lightness. */
function fromOklch(colour: Oklch): RgbTriplet {
  let c = colour.c
  let rgb = oklchToLinearRgb({ ...colour, c })
  const inGamut = (channels: number[]) => channels.every((v) => v >= -0.0005 && v <= 1.0005)
  for (let i = 0; i < 80 && !inGamut(rgb); i++) {
    c *= 0.95
    rgb = oklchToLinearRgb({ ...colour, c })
  }
  return rgb.map((v) => Math.round(clamp01(linearToSrgb(clamp01(v))) * 255)).join(' ')
}
