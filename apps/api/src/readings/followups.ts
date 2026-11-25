/**
 * 이어 묻기 (F15, docs/04 §13, D-071). POST /api/readings/:id/followups
 * 원래 풀이 입력·출력과 앞선 문답을 저장된 문자열 그대로 reading Worker에 넘겨 프롬프트 캐시를 탄다.
 */
import { findBanned } from "@fortune/prompts";
import { FOLLOWUP_BLOCKED, FOLLOWUP_MAX, FOLLOWUP_MAX_CHARS } from "@fortune/prompts/llm";
import type { FollowupResponse } from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { hasPii } from "../filters";
import { HttpError, json, readBody } from "../http";
import { CRISIS_TEXT } from "../personas";
import type { User } from "../session";
import { nowIso } from "../time";
import { callsLeft, reserveCall } from "../usage";
import { findById, listFollowups, toFollowupView } from "./store";

const Body = z.object({
  question: z.string(),
  requestId: z.string().uuid(),
});

const BLOCKED_RISKS = new Set(["sexual", "violence", "other"]);

export async function createFollowup(
  readingId: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  user: User,
): Promise<Response> {
  const body = await readBody(req, Body);
  const question = body.question.trim().replace(/\s+/g, " ");

  // 1차 필터 (코드): 길이, 개인정보, 금칙어 — LLM을 부르지 않는다
  if (!question) throw new HttpError("INVALID_INPUT", "물어볼 말을 한 줄 써 주세요");
  if ([...question].length > FOLLOWUP_MAX_CHARS) {
    throw new HttpError("INVALID_INPUT", `질문은 ${FOLLOWUP_MAX_CHARS}자까지 쓸 수 있어요`);
  }
  if (hasPii(question)) {
    throw new HttpError("INVALID_INPUT", "전화번호 같은 개인정보는 빼고 물어봐 주세요");
  }
  if (findBanned(question).length) {
    throw new HttpError("BLOCKED_CONTENT", "그 표현은 빼고 다시 물어봐 주세요");
  }

  const row = await findById(env, user.id, readingId);
  if (!row) throw new HttpError("NOT_FOUND", "없거나 볼 수 없는 결과예요");
  const history = await listFollowups(env, row.id);

  // 같은 requestId는 한 번만 (이어 묻기 id로 쓴다)
  const dup = history.find((f) => f.id === body.requestId);
  if (dup) {
    const res: FollowupResponse = {
      followup: toFollowupView(dup),
      followupsLeft: Math.max(0, FOLLOWUP_MAX - history.length),
      todayCallsLeft: await callsLeft(env, user.id),
    };
    return json(res);
  }
  if (history.length >= FOLLOWUP_MAX) {
    throw new HttpError(
      "INVALID_INPUT",
      `이 풀이에는 ${FOLLOWUP_MAX}번까지 물어볼 수 있어요. 궁금한 게 더 있으면 새로 점을 봐요`,
    );
  }

  const left = await reserveCall(env, user.id, row.shop);
  const work = (async () => {
    let result: Awaited<ReturnType<Env["READING"]["followup"]>>;
    try {
      result = await env.READING.followup({
        shop: row.shop,
        originalInput: row.input_json,
        originalOutput: row.output_json,
        history: history.map((h) => ({ question: h.question, answerJson: h.answer_json })),
        question,
      });
    } catch (e) {
      console.error("followup rpc failed", String(e));
      throw new HttpError("LLM_UNAVAILABLE", "잠시 문제가 생겼어요. 잠시 후 다시 물어봐 주세요");
    }
    if (!result.ok) throw new HttpError("LLM_UNAVAILABLE", result.fallback);
    // 위험 글은 답을 보여주지 않고 저장도 하지 않는다 (F15)
    if (result.risk === "self_harm") throw new HttpError("CRISIS", CRISIS_TEXT);
    if (BLOCKED_RISKS.has(result.risk))
      throw new HttpError("BLOCKED_CONTENT", FOLLOWUP_BLOCKED[row.shop]);

    const createdAt = nowIso();
    await env.DB.prepare(
      `INSERT INTO reading_followups (id, reading_id, user_id, question, answer, answer_json, prompt_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
    )
      .bind(
        body.requestId,
        row.id,
        user.id,
        question,
        result.answer,
        result.answerJson,
        result.promptVersion,
        createdAt,
      )
      .run();
    const res: FollowupResponse = {
      followup: { id: body.requestId, question, answer: result.answer, createdAt },
      followupsLeft: Math.max(0, FOLLOWUP_MAX - history.length - 1),
      todayCallsLeft: left,
    };
    return json(res);
  })();
  // 브라우저가 끊겨도 저장까지 마친다 (docs/15 §3)
  ctx.waitUntil(work.catch(() => undefined));
  return work;
}
