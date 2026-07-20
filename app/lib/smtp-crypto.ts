const ITERATIONS = 100_000
const SALT_BYTES = 16
const KEY_BYTES = 32

function b64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ""
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function generateSmtpPassword(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return b64(arr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function hashSmtpPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_BYTES * 8
  )
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(bits)}`
}

export async function verifySmtpPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$")
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false
  const iterations = parseInt(parts[1], 10)
  const salt = fromB64(parts[2])
  const expected = fromB64(parts[3])
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    expected.length * 8
  )
  const actual = new Uint8Array(bits)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
