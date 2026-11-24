/**
 * app Worker (docs/15 §2). M1: 상태 확인, 사주 계산 확인용 API, 거리 접속 토큰, WebSocket 전달.
 * 세션·DB·하루 상한은 F14·M4에서 붙인다.
 */
import {
  type Gender,
  SajuError,
  analyzePillars,
  computeDaewoon,
  computePillars,
  luckAt,
} from "@fortune/fortune-engine";
import { type ApiError, type ErrorCode, type ShopId, signWsToken } from "@fortune/shared-types";

import type Reading from "../../reading/src/index";

interface Env {
  ASSETS: Fetcher;
  READING: Service<Reading>;
  VILLAGE: DurableObjectNamespace;
  WS_TOKEN_KEY: string;
}

const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const fail = (code: ErrorCode, message: string, status: number) =>
  json({ error: { code, message } } satisfies ApiError, status);

/** 한국 시간 오늘 날짜 */
export function todayKst(now = Date.now()): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
}

interface ChartRequest {
  calendar: "solar" | "lunar";
  date: string;
  time: string | null;
  isLeapMonth?: boolean;
  gender: Gender;
}

async function chart(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as ChartRequest | null;
  if (!body || (body.gender !== "male" && body.gender !== "female")) {
    return fail("INVALID_INPUT", "입력 형식이 올바르지 않아요", 400);
  }
  try {
    const natal = computePillars(body);
    const today = todayKst();
    return json({
      natal,
      analysis: analyzePillars(natal.pillars),
      daewoon: computeDaewoon(natal, body.gender, today, body.time === null),
      today: luckAt(natal.pillars, today),
    });
  } catch (e) {
    if (e instanceof SajuError) return fail(e.code, "생년월일이나 시간을 다시 확인해 주세요", 400);
    throw e;
  }
}

async function wsToken(url: URL, env: Env): Promise<Response> {
  const shop = url.searchParams.get("shop") as ShopId | null;
  if (!shop || !SHOPS.includes(shop)) return fail("INVALID_INPUT", "점집을 다시 골라 주세요", 400);
  // M1: 세션이 없어 임시 id를 쓴다. F14에서 익명 계정 id로 바꾼다
  const userId = crypto.randomUUID();
  const nickname = (url.searchParams.get("nickname") ?? "손님").slice(0, 10);
  const channel = `${shop}:1`; // 채널 배정(정원 30)은 M3
  const token = await signWsToken(
    { u: userId, n: nickname, c: channel, exp: Date.now() + 5 * 60_000 },
    env.WS_TOKEN_KEY,
  );
  return json({ token, channel, userId });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") return json({ ok: true });
    if (url.pathname === "/api/dev/chart" && req.method === "POST") return chart(req);
    if (url.pathname === "/api/dev/reading" && req.method === "POST") {
      const out = await env.READING.interpret({
        shop: "saju",
        product: "daily",
        today: todayKst(),
        user: { nickname: "개발", gender: "female", ageBand: "20대" },
        facts: [],
        question: null,
      });
      return json(out);
    }
    if (url.pathname === "/api/ws-token") return wsToken(url, env);
    const ws = /^\/ws\/village\/([a-z]+):(\d+)$/.exec(url.pathname);
    if (ws) {
      const id = env.VILLAGE.idFromName(`village:${ws[1]}:${ws[2]}`);
      return env.VILLAGE.get(id).fetch(req);
    }
    if (url.pathname.startsWith("/api/")) return fail("NOT_FOUND", "없는 주소예요", 404);
    return env.ASSETS.fetch(req);
  },
};
