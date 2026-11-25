/** 거리 접속 토큰과 WebSocket 전달 (docs/15 §4). 궁합 둘만의 방은 F16 */
import { avatarString, signWsToken } from "@fortune/shared-types";
import type { Env } from "./env";
import { inviteForMember } from "./gunghap/invites";
import { json } from "./http";
import { parseShop } from "./menu";
import { ageBandAt, loadProfile, natalOf } from "./profile";
import type { User } from "./session";

/**
 * GET /api/ws-token?shop= | ?room=pair:<code>: 세션의 userId·닉네임·외모로 5분짜리 토큰.
 * 둘만의 방은 그 초대의 초대한 사람·손님에게만 준다
 */
export async function wsToken(url: URL, env: Env, user: User): Promise<Response> {
  const profile = await loadProfile(env, user.id);
  const nickname = profile?.nickname ?? "손님";
  // "성별:나이대[:꾸미기 코드]" (F17). 예전 앱은 앞 두 칸만 읽는다
  const look = profile
    ? avatarString(profile.gender, ageBandAt(natalOf(profile)), profile.style)
    : undefined;
  const room = url.searchParams.get("room");
  let channel: string;
  let role: "host" | "guest" | undefined;
  if (room?.startsWith("pair:")) {
    const code = room.slice(5);
    role = (await inviteForMember(env, code, user.id)).role;
    channel = `pair:${code}`;
  } else {
    const shop = parseShop(url.searchParams.get("shop"));
    channel = `${shop}:1`; // 채널 배정(정원 30)은 M3
  }
  const token = await signWsToken(
    {
      u: user.id,
      n: nickname,
      c: channel,
      exp: Date.now() + 5 * 60_000,
      ...(look ? { a: look } : {}),
      // 둘만의 방에서 점집을 고를(travel) 수 있는 사람은 방장뿐 (F16, D-090)
      ...(role ? { r: role } : {}),
    },
    env.WS_TOKEN_KEY,
  );
  return json({ token, channel, userId: user.id });
}

/** /ws/village/<shop>:<n>, /ws/pair/<code> → Durable Object */
export function forwardVillage(req: Request, env: Env, path: string): Promise<Response> | null {
  const village = /^\/ws\/village\/([a-z]+):(\d+)$/.exec(path);
  if (village) {
    const id = env.VILLAGE.idFromName(`village:${village[1]}:${village[2]}`);
    return env.VILLAGE.get(id).fetch(req);
  }
  const pair = /^\/ws\/pair\/([a-z0-9]{10})$/.exec(path);
  if (pair) return env.VILLAGE.get(env.VILLAGE.idFromName(`pair:${pair[1]}`)).fetch(req);
  return null;
}
