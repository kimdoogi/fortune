/** 하루 LLM 호출 상한 (사용자당 30회, 분류 호출 포함) (docs/04 §10, D-057) */
import type { ShopId } from "@fortune/shared-types";
import type { Env } from "./env";
import { HttpError } from "./http";
import { DAILY_LIMIT_TEXT } from "./personas";
import { todayKst } from "./time";

export const DAILY_CALLS = 30;

export async function callsLeft(env: Env, userId: string, date = todayKst()): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT llm_calls FROM daily_usage WHERE user_id = ? AND date = ?",
  )
    .bind(userId, date)
    .first<{ llm_calls: number }>();
  return Math.max(0, DAILY_CALLS - (row?.llm_calls ?? 0));
}

/**
 * 호출 1회를 먼저 잡는다. 상한이면 점집 말투로 DAILY_LIMIT.
 * 조건부 UPSERT 한 번이라 동시에 와도 30회를 넘지 않는다. 남은 횟수를 돌려준다.
 */
export async function reserveCall(env: Env, userId: string, shop: ShopId): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO daily_usage (user_id, date, llm_calls) VALUES (?1, ?2, 1)
     ON CONFLICT (user_id, date) DO UPDATE SET llm_calls = llm_calls + 1 WHERE llm_calls < ?3
     RETURNING llm_calls`,
  )
    .bind(userId, todayKst(), DAILY_CALLS)
    .first<{ llm_calls: number }>();
  if (!row) throw new HttpError("DAILY_LIMIT", DAILY_LIMIT_TEXT[shop]);
  return DAILY_CALLS - row.llm_calls;
}
