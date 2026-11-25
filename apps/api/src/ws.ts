/** 거리 접속 토큰과 WebSocket 전달 (docs/15 §4) */
import { signWsToken } from "@fortune/shared-types";
import type { Env } from "./env";
import { json } from "./http";
import { parseShop } from "./menu";
import { loadProfile } from "./profile";
import type { User } from "./session";

/** GET /api/ws-token?shop=: 세션의 userId와 프로필 닉네임으로 5분짜리 토큰 */
export async function wsToken(url: URL, env: Env, user: User): Promise<Response> {
  const shop = parseShop(url.searchParams.get("shop"));
  const profile = await loadProfile(env, user.id);
  const nickname = profile?.nickname ?? "손님";
  const channel = `${shop}:1`; // 채널 배정(정원 30)은 M3
  const token = await signWsToken(
    { u: user.id, n: nickname, c: channel, exp: Date.now() + 5 * 60_000 },
    env.WS_TOKEN_KEY,
  );
  return json({ token, channel, userId: user.id });
}

/** /ws/village/<shop>:<n> → Durable Object */
export function forwardVillage(req: Request, env: Env, path: string): Promise<Response> | null {
  const m = /^\/ws\/village\/([a-z]+):(\d+)$/.exec(path);
  if (!m) return null;
  const id = env.VILLAGE.idFromName(`village:${m[1]}:${m[2]}`);
  return env.VILLAGE.get(id).fetch(req);
}
