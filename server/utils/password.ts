/**
 * Password hashing with PBKDF2-SHA256 via WebCrypto.
 *
 * Why not bcrypt/scrypt: they run in JS on Workers and blow the CPU budget.
 * WebCrypto PBKDF2 runs natively in both Cloudflare Workers and Node (scripts/),
 * and 100,000 iterations is the maximum Workers allows.
 *
 * Stored format: pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>
 * No imports on purpose: scripts/create-user.ts loads this file directly with Node.
 */
const ITERATIONS = 100_000
const KEY_LEN_BITS = 256

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, KEY_LEN_BITS)
}

export async function hashUserPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`
}

export async function verifyUserPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const [algo, iter, saltB64, hashB64] = stored.split('$')
  if (algo !== 'pbkdf2_sha256' || !iter || !saltB64 || !hashB64) return false
  const actual = new Uint8Array(await derive(password, unb64(saltB64), Number(iter)))
  const expected = unb64(hashB64)
  if (actual.length !== expected.length) return false
  let diff = 0 // constant-time compare
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!
  return diff === 0
}

/** Readable temporary password: no 0/O/1/l/I. Format xxxx-xxxx-xxxx. */
export function generateTempPassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const chars = Array.from(bytes, b => alphabet[b % alphabet.length])
  return [0, 4, 8].map(i => chars.slice(i, i + 4).join('')).join('-')
}

export const PASSWORD_MIN_LENGTH = 10
