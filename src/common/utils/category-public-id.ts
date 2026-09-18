import { randomBytes } from 'crypto';

/** Crockford Base32 — no ambiguous 0/O/1/I */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Short public category id, e.g. `lvc_K7H2M9QX`
 * Namespaced separately from products (`lvn_`) for safe URL parsing.
 */
export function generateCategoryPublicId(bytes = 8): string {
  const buf = randomBytes(bytes);
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return `lvc_${out}`;
}

export function isCategoryPublicId(value: string): boolean {
  return /^lvc_[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5,16}$/i.test(value);
}
