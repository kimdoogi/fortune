/**
 * app Worker (docs/15 §2): API 라우터 + 프론트(Static Assets) + WebSocket 전달.
 * 경로별 처리는 모듈에 두고 여기는 연결만 한다 (docs/09 §3).
 */
import { getDaily } from "./daily";
import type { Env } from "./env";
import { HttpError, fail, json } from "./http";
import { getMenu } from "./menu";
import { getProfile, putProfile } from "./profile";
import { checkDream } from "./readings/check";
import { createReading } from "./readings/create";
import { deleteReading, getReading, listReadings } from "./readings/history";
import { deleteSession, postSession, requireUser } from "./session";
import { forwardVillage, wsToken } from "./ws";

export type { Env };

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path === "/api/health") return json({ ok: true });

  if (path === "/api/session") {
    if (method === "POST") return postSession(req, env);
    if (method === "DELETE") return deleteSession(req, env);
  }

  const ws = forwardVillage(req, env, path);
  if (ws) return ws;

  if (!path.startsWith("/api/")) return env.ASSETS.fetch(req);

  // 여기부터는 세션이 있어야 한다 (F14)
  const user = await requireUser(req, env);

  if (path === "/api/ws-token" && method === "GET") return wsToken(url, env, user);
  if (path === "/api/profile") {
    if (method === "GET") return getProfile(env, user);
    if (method === "PUT") return putProfile(req, env, user);
  }
  if (path === "/api/menu" && method === "GET") return getMenu(url, env, user);
  if (path === "/api/daily" && method === "GET") return getDaily(env, ctx, user);
  if (path === "/api/readings/check" && method === "POST") return checkDream(req, env, user);
  if (path === "/api/readings") {
    if (method === "POST") return createReading(req, env, ctx, user);
    if (method === "GET") return listReadings(url, env, user);
  }
  const one = /^\/api\/readings\/([A-Za-z0-9-]{1,64})$/.exec(path);
  if (one?.[1]) {
    if (method === "GET") return getReading(one[1], env, user);
    if (method === "DELETE") return deleteReading(one[1], env, user);
  }
  return fail("NOT_FOUND", "없는 주소예요");
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.code, e.message, e.status);
      console.error("unhandled", String(e));
      // ErrorCode에 서버 오류 코드가 없어 LLM_UNAVAILABLE(503)로 알린다
      return fail("LLM_UNAVAILABLE", "잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요");
    }
  },
} satisfies ExportedHandler<Env>;
