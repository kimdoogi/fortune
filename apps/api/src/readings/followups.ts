/**
 * 이어 묻기 (F15, docs/04 §13, D-071). POST /api/readings/:id/followups
 * 원래 풀이 입력·출력과 앞선 문답을 저장된 문자열 그대로 reading Worker에 넘겨 프롬프트 캐시를 탄다.
 * 같이 본 풀이(F16, D-091)는 문답을 상대 풀이에도 넣고 둘만의 방에 알린다. 한도는 사람마다 따로 센다.
 */
import { findBanned } from "@fortune/prompts";
import {
  FOLLOWUP_BLOCKED,
  FOLLOWUP_MAX_CHARS,
  followupMax,
  isPairProduct,
} from "@fortune/prompts/llm";
import type { FollowupResponse } from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { hasPii } from "../filters";
import { notifyRoom } from "../gunghap/invites";
import { HttpError, json, readBody } from "../http";
import { CRISIS_TEXT } from "../personas";
import { loadProfile } from "../profile";
import type { User } from "../session";
import { nowIso } from "../time";
import { callsLeft, reserveCall } from "../usage";
import { type ReadingRow, findById, findBySeed, listFollowups, toFollowupView } from "./store";

const Body = z.object({
  question: z.string(),
  requestId: z.string().uuid(),
});

const BLOCKED_RISKS = new Set(["sexual", "violence", "other"]);

/** 같이 본 풀이면 초대 코드·상대·내 닉네임 (D-091). seed_key: gunghap:<code> | pair:<code>:<product> */
async function pairOf(
  env: Env,
  row: ReadingRow,
  userId: string,
): Promise<{ code: string; partnerId: string | null; nickname: string } | null> {
  if (!isPairProduct(row.product)) return null;
  const m = /^(?:gunghap:|pair:)([a-z0-9]{10})/.exec(row.seed_key);
  if (!m?.[1]) return null;
  const code = m[1];
  // 초대가 끝났어도 기록은 둘 다 있으니 만료는 보지 않는다
  const inv = await env.DB.prepare("SELECT host_id, guest_id FROM gunghap_invites WHERE code = ?")
    .bind(code)
    .first<{ host_id: string; guest_id: string | null }>();
  const partnerId = !inv ? null : inv.host_id === userId ? inv.guest_id : inv.host_id;
  const nickname = (await loadProfile(env, userId))?.nickname ?? "손님";
  return { code, partnerId, nickname };
}

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
  const max = followupMax(row.product);
  // 내가 물은 것만 센다 (같이 본 풀이에는 상대 문답도 들어 있다)
  const mine = history.filter((h) => h.user_id === user.id).length;

  // 같은 requestId는 한 번만 (이어 묻기 id로 쓴다)
  const dup = history.find((f) => f.id === body.requestId);
  if (dup) {
    const res: FollowupResponse = {
      followup: toFollowupView(dup, user.id),
      followupsLeft: Math.max(0, max - mine),
      todayCallsLeft: await callsLeft(env, user.id),
    };
    return json(res);
  }
  if (mine >= max) {
    throw new HttpError(
      "INVALID_INPUT",
      row.product === "sinjeom"
        ? "오늘은 여기까지! 방울이 쉬고 싶대. 내일 또 와!"
        : `이 풀이에는 ${max}번까지 물어볼 수 있어요. 궁금한 게 더 있으면 새로 점을 봐요`,
    );
  }

  const left = await reserveCall(env, user.id, row.shop);
  const pair = await pairOf(env, row, user.id);
  // 상대 화면에는 "물어보는 중"만 (질문은 답과 함께 보인다: 위험 글이 먼저 보이지 않게)
  if (pair) await notifyRoom(env, pair.code, { t: "asking", id: user.id, product: row.product });
  const work = (async () => {
    let result: Awaited<ReturnType<Env["READING"]["followup"]>>;
    try {
      result = await env.READING.followup({
        shop: row.shop,
        product: row.product,
        originalInput: row.input_json,
        originalOutput: row.output_json,
        history: history.map((h) => ({
          question: h.question,
          answerJson: h.answer_json,
          ...(pair && h.asker ? { asker: h.asker } : {}),
        })),
        question,
        ...(pair ? { asker: pair.nickname } : {}),
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
    const insert = (id: string, readingId: string) =>
      env.DB.prepare(
        `INSERT INTO reading_followups (id, reading_id, user_id, question, answer, answer_json, prompt_version, asker, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
      ).bind(
        id,
        readingId,
        user.id,
        question,
        result.answer,
        result.answerJson,
        result.promptVersion,
        pair?.nickname ?? null,
        createdAt,
      );
    await insert(body.requestId, row.id).run();
    if (pair) {
      // 상대 풀이에도 같은 문답 (D-091)
      const other = pair.partnerId ? await findBySeed(env, pair.partnerId, row.seed_key) : null;
      if (other) await insert(crypto.randomUUID(), other.id).run();
      await notifyRoom(env, pair.code, {
        t: "asked",
        id: user.id,
        product: row.product,
        ok: true,
      });
    }
    const res: FollowupResponse = {
      followup: { id: body.requestId, question, answer: result.answer, createdAt },
      followupsLeft: Math.max(0, max - mine - 1),
      todayCallsLeft: left,
    };
    return json(res);
  })();
  // 실패하면 상대의 "물어보는 중"을 거둔다
  if (pair)
    work.catch(() =>
      notifyRoom(env, pair.code, { t: "asked", id: user.id, product: row.product, ok: false }),
    );
  // 브라우저가 끊겨도 저장까지 마친다 (docs/15 §3)
  ctx.waitUntil(work.catch(() => undefined));
  return work;
}
