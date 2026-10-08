/**
 * Temporary-password generator (pure apart from the injected random source).
 *
 * Always satisfies the platform policy (upper, lower, number, 8+ chars) and avoids look-alike characters
 * (0/O, 1/l/I) because an administrator may read the password out to the user. Uses the Web Crypto random source
 * by default — never Math.random.
 */

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%&*?'
const ALL = UPPER + LOWER + DIGITS + SYMBOLS

/** Random integers in [0, max) — injectable for tests. */
export type RandomInt = (max: number) => number

/** Uniform random integer from crypto.getRandomValues (rejection sampling avoids modulo bias). */
export const cryptoRandomInt: RandomInt = (max) => {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return buf[0] % max
}

/**
 * @param length - Total length (minimum 12 enforced)
 * @param random - Random source
 * @returns A password with at least one upper, lower, digit and symbol
 */
export function generateTemporaryPassword(length = 14, random: RandomInt = cryptoRandomInt): string {
  const size = Math.max(12, length)
  const pick = (set: string) => set[random(set.length)]
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < size) chars.push(pick(ALL))
  // Fisher–Yates so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
