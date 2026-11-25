/** checks 테이블: 꿈 검사 결과, 10분 유효 (F08) */
import type { ClassifyRisk } from "@fortune/shared-types";
import type { Env } from "../env";
import type { DreamCheck } from "./build";

export const CHECK_TTL_MS = 10 * 60_000;

export async function saveCheck(env: Env, userId: string, c: DreamCheck): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.batch([
    // 지난 검사는 바로 정리한다 (꿈 내용을 오래 두지 않음)
    env.DB.prepare("DELETE FROM checks WHERE user_id = ? AND created_at < ?").bind(
      userId,
      new Date(now - CHECK_TTL_MS).toISOString(),
    ),
    env.DB.prepare(
      "INSERT INTO checks (id, user_id, text, symbols_json, risk, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, userId, c.text, JSON.stringify(c.symbolIds), c.risk, new Date(now).toISOString()),
  ]);
  return id;
}

/** 내 것이고 10분 안이면 돌려준다 */
export async function loadCheck(env: Env, userId: string, id: string): Promise<DreamCheck | null> {
  const row = await env.DB.prepare(
    "SELECT text, symbols_json, risk FROM checks WHERE id = ? AND user_id = ? AND created_at >= ?",
  )
    .bind(id, userId, new Date(Date.now() - CHECK_TTL_MS).toISOString())
    .first<{ text: string; symbols_json: string; risk: ClassifyRisk }>();
  if (!row) return null;
  return { text: row.text, symbolIds: JSON.parse(row.symbols_json) as string[], risk: row.risk };
}
