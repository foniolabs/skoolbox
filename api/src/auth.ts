// Password hashing, session tokens and cookies. WebCrypto only (runs in Workers).

const PBKDF2_ITERATIONS = 100_000; // the most Workers allows
const SESSION_DAYS = 30;
export const COOKIE_NAME = "sb_session";

const enc = new TextEncoder();

const toB64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

/** Format: pbkdf2$<iterations>$<salt b64>$<hash b64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const derived = await derive(password, fromB64(salt), Number(iter));
  return timingSafeEqual(new Uint8Array(derived), fromB64(hash));
}

// Verified against when the username doesn't exist, so response time doesn't reveal it.
let dummyHash: Promise<string> | undefined;
export const burnPasswordCheck = async (password: string) => {
  dummyHash ??= hashPassword("not-a-real-password");
  await verifyPassword(password, await dummyHash);
};

/** A fresh random token for the cookie, and the SHA-256 we store instead of it. */
export async function newSessionToken(): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return {
    token,
    tokenHash: await hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  };
}

export async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(token)));
}

export function sessionCookie(token: string, expiresAt: Date, opts: { secure: boolean; domain?: string }) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (opts.secure) parts.push("Secure");
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join("; ");
}

export function clearedCookie(opts: { secure: boolean; domain?: string }) {
  return sessionCookie("", new Date(0), opts);
}
