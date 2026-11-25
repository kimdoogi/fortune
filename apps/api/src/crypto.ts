/** 해시·토큰·개인정보 암호화 (docs/15 §8, F14). WebCrypto만 쓴다 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const toBase64Url = (bytes: Uint8Array) =>
  toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export async function sha256Hex(text: string): Promise<string> {
  return [...(await sha256(text))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 기기 토큰: 32바이트 난수 (F14). DB에는 sha256만 저장한다 */
export function randomToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

// ── AES-GCM (docs/09 §4) ──────────────────────────────────
/** 지금 쓰는 키 버전. 키를 바꾸면 올리고 옛 키로 읽어 새 키로 다시 쓴다 */
export const PII_KEY_VERSION = 1;

const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(b64: string): Promise<CryptoKey> {
  let k = keyCache.get(b64);
  if (!k) {
    const raw = fromBase64(b64);
    if (raw.length !== 32) throw new Error("PII_KEY must be base64 of 32 bytes");
    k = crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    keyCache.set(b64, k);
  }
  return k;
}

/** 평문 → base64(iv 12바이트 + 암호문) */
export async function encryptPii(keyB64: string, plain: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toBase64(out);
}

export async function decryptPii(keyB64: string, stored: string): Promise<string> {
  const key = await importKey(keyB64);
  const all = fromBase64(stored);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: all.slice(0, 12) },
    key,
    all.slice(12),
  );
  return dec.decode(plain);
}
