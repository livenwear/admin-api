import { randomBytes } from 'crypto';

/** Crockford Base32 — no ambiguous 0/O/1/I */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Short public product id, e.g. `lvn_K7H2M9QX`
 * Cryptographically random, URL-safe, non-guessable at scale.
 */
export function generateProductPublicId(bytes = 5): string {
  const buf = randomBytes(bytes);
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return `lvn_${out}`;
}

export function isProductPublicId(value: string): boolean {
  return /^lvn_[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8,12}$/i.test(value);
}
