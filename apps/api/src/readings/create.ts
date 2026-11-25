/**
 * POST /api/readings (docs/15 §3, F05~F08):
 * 인증 → 검증 → seed_key → 저장본 있으면 반환 → requestId 중복 방지 → 하루 상한 → 계산 → 해석 → 저장
 */
import { FOLLOWUP_MAX } from "@fortune/prompts/llm";
import {
  DISCLAIMER,
  type InterpretResult,
  type ReadingRequest,
  type ReadingResult,
} from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { HttpError, fail, json, readBody } from "../http";
import { DREAM_CHECK_EXPIRED, FALLBACK, IN_FLIGHT_TEXT } from "../personas";
import { ageBandAt, natalOf, requireProfile } from "../profile";
import type { User } from "../session";
import { nowIso, todayKst } from "../time";
import { callsLeft, reserveCall } from "../usage";
import { planReading } from "./build";
import { loadCheck } from "./checks";
import {
  claimRequest,
  completeRequest,
  findById,
  findBySeed,
  insertReading,
  releaseRequest,
  resultWithFollowups,
} from "./store";

const requestId = z.string().min(8).max(64);
const tarotCategory = z.enum(["연애", "재물", "직장", "오늘"]);
const dolyeongCategory = z.enum(["연애", "재물", "직장", "건강", "기타"]);

export const ReadingRequestSchema = z.discriminatedUnion("shop", [
  z.object({ shop: z.literal("saju"), product: z.literal("saju_full"), requestId }),
  z.object({
    shop: z.literal("tarot"),
    product: z.enum(["tarot_one", "tarot_three"]),
    category: tarotCategory,
    requestId,
  }),
  z.object({
    shop: z.literal("dolyeong"),
    product: z.literal("obanggi"),
    category: dolyeongCategory,
    requestId,
  }),
  z.object({
    shop: z.literal("dream"),
    product: z.literal("dream"),
    checkId: z.string().min(1).max(64),
    requestId,
  }),
]);

export async function createReading(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  user: User,
): Promise<Response> {
  const body: ReadingRequest = await readBody(req, ReadingRequestSchema);
  const profile = await requireProfile(env, user.id);
  const today = todayKst();
  const ageBand = ageBandAt(natalOf(profile), today);

  let check: Awaited<ReturnType<typeof loadCheck>> = null;
  if (body.shop === "dream") {
    check = await loadCheck(env, user.id, body.checkId);
    if (!check) throw new HttpError("INVALID_INPUT", DREAM_CHECK_EXPIRED);
  }
  const plan = await planReading(body, {
    userId: user.id,
    profile,
    ageBand,
    today,
    ...(check ? { check } : {}),
  });

  // 같은 seed 저장본이 있으면 LLM 없이 그대로 (docs/03 결과 고정)
  const stored = await findBySeed(env, user.id, plan.seedKey);
  if (stored)
    return json(await resultWithFollowups(env, stored, true, await callsLeft(env, user.id)));

  const { input, visual } = await plan.build();

  const claim = await claimRequest(env, body.requestId, user.id);
  if (claim.kind === "foreign") throw new HttpError("INVALID_INPUT", "입력 형식이 올바르지 않아요");
  if (claim.kind === "busy") throw new HttpError("RATE_LIMITED", IN_FLIGHT_TEXT);
  if (claim.kind === "done") {
    const row = await findById(env, user.id, claim.readingId);
    if (row) return json(await resultWithFollowups(env, row, true, await callsLeft(env, user.id)));
    throw new HttpError("RATE_LIMITED", IN_FLIGHT_TEXT);
  }

  let left: number;
  try {
    left = await reserveCall(env, user.id, plan.shop);
  } catch (e) {
    await releaseRequest(env, body.requestId);
    throw e;
  }

  // 브라우저가 끊겨도 저장까지 끝낸다 (docs/15 §3)
  const work = (async (): Promise<Response> => {
    let result: InterpretResult;
    try {
      result = await env.READING.interpret(input);
    } catch (e) {
      console.error("interpret rpc failed", plan.shop, plan.product, String(e));
      result = { ok: false, reason: "api_error", fallback: FALLBACK[plan.shop], promptVersion: "" };
    }
    if (!result.ok) {
      // 실패한 결과는 저장하지 않는다. 같은 seed로 다시 보면 새로 생성 (docs/04 §9)
      await releaseRequest(env, body.requestId);
      return fail("LLM_UNAVAILABLE", result.fallback || FALLBACK[plan.shop]);
    }
    const id = crypto.randomUUID();
    const createdAt = nowIso();
    const inserted = await insertReading(env, {
      id,
      userId: user.id,
      shop: plan.shop,
      product: plan.product,
      seedKey: plan.seedKey,
      input,
      visual,
      output: result.output,
      promptVersion: result.promptVersion,
      createdAt,
    });
    if (!inserted) {
      // 다른 요청이 같은 seed를 먼저 저장했다
      const winner = await findBySeed(env, user.id, plan.seedKey);
      if (!winner) throw new Error("reading insert conflict without a stored row");
      await completeRequest(env, body.requestId, winner.id);
      return json(await resultWithFollowups(env, winner, true, left));
    }
    await completeRequest(env, body.requestId, id);
    const out: ReadingResult = {
      id,
      shop: plan.shop,
      product: plan.product,
      createdAt,
      visual,
      output: result.output,
      reused: false,
      disclaimer: DISCLAIMER,
      todayCallsLeft: left,
      followups: [],
      followupsLeft: FOLLOWUP_MAX,
    };
    return json(out);
  })();
  ctx.waitUntil(work.catch((e) => console.error("reading save failed", String(e))));
  return work;
}
