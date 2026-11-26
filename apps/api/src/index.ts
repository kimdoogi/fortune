/**
 * app Worker (docs/15 §2): API 라우터 + 프론트(Static Assets) + WebSocket 전달.
 * 경로별 처리는 모듈에 두고 여기는 연결만 한다 (docs/09 §3).
 */
import { getDaily } from "./daily";
import type { Env } from "./env";
import { createInvite, joinInvite, viewInvite } from "./gunghap/invites";
import { HttpError, fail, json } from "./http";
import { getMenu } from "./menu";
import { createPairReading, getPairResult, submitPairDream } from "./pair/readings";
import { getProfile, putProfile, putStyle } from "./profile";
import { checkDream } from "./readings/check";
import { createReading } from "./readings/create";
import { createFollowup } from "./readings/followups";
import { deleteReading, getReading, listReadings } from "./readings/history";
import { deleteSession, postSession, requireUser } from "./session";
import { addStone, createWish, getWishes, setOutcome } from "./wishes";
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
  if (path === "/api/profile/style" && method === "PUT") return putStyle(req, env, user);
  if (path === "/api/menu" && method === "GET") return getMenu(url, env, user);
  if (path === "/api/daily" && method === "GET") return getDaily(env, ctx, user);
  if (path === "/api/readings/check" && method === "POST") return checkDream(req, env, user);
  if (path === "/api/readings") {
    if (method === "POST") return createReading(req, env, ctx, user);
    if (method === "GET") return listReadings(url, env, user);
  }
  // 같이 보기 (F16). /api/gunghap/invites/... 는 D-089 때 경로 (같은 처리)
  if ((path === "/api/pair/invites" || path === "/api/gunghap/invites") && method === "POST")
    return createInvite(req, env, user);
  const gi = /^\/api\/(?:pair|gunghap)\/invites\/([a-z0-9]{10})(?:\/(join|reading|result))?$/.exec(
    path,
  );
  if (gi?.[1]) {
    const code = gi[1];
    if (!gi[2] && method === "GET") return viewInvite(code, env, user);
    if (gi[2] === "join" && method === "POST") return joinInvite(code, req, env, user);
    if (gi[2] === "reading" && method === "POST")
      return createPairReading(code, req, env, ctx, user);
    if (gi[2] === "result" && method === "GET")
      return getPairResult(code, url.searchParams.get("product"), env, user);
  }
  const pr = /^\/api\/pair\/([a-z0-9]{10})\/(readings|dream|result)$/.exec(path);
  if (pr?.[1]) {
    const code = pr[1];
    if (pr[2] === "readings" && method === "POST")
      return createPairReading(code, req, env, ctx, user);
    if (pr[2] === "dream" && method === "POST") return submitPairDream(code, req, env, ctx, user);
    if (pr[2] === "result" && method === "GET")
      return getPairResult(code, url.searchParams.get("product"), env, user);
  }
  // 당산나무 소원 (F18)
  if (path === "/api/wishes") {
    if (method === "GET") return getWishes(env, user);
    if (method === "POST") return createWish(req, env, user);
  }
  if (path === "/api/wishes/stone" && method === "POST") return addStone(env, user);
  const wo = /^\/api\/wishes\/([A-Za-z0-9-]{1,64})\/outcome$/.exec(path);
  if (wo?.[1] && method === "POST") return setOutcome(wo[1], req, env, user);
  const fu = /^\/api\/readings\/([A-Za-z0-9-]{1,64})\/followups$/.exec(path);
  if (fu?.[1] && method === "POST") return createFollowup(fu[1], req, env, ctx, user);
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
