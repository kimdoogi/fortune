/** WebSocket 접속 토큰: userId·채널·만료에 HMAC-SHA256 서명 (docs/15 §4) */
export interface WsTokenPayload {
  u: string;
  n: string;
  c: string;
  exp: number;
}

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signWsToken(p: WsTokenPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(p)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyWsToken(token: string, secret: string, now = Date.now()) {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await key(secret),
    fromB64url(sig),
    enc.encode(body),
  );
  if (!ok) return null;
  const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as WsTokenPayload;
  return p.exp > now ? p : null;
}
