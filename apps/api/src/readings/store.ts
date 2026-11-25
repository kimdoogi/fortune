/** readings·request_log 테이블 읽기/쓰기 (docs/09 §2, F10) */
import { FOLLOWUP_MAX } from "@fortune/prompts/llm";
import {
  DISCLAIMER,
  type FollowupView,
  type InterpretOutput,
  type ProductId,
  type ReadingResult,
  type ReadingVisual,
  type ShopId,
} from "@fortune/shared-types";
import type { Env } from "../env";

export interface ReadingRow {
  id: string;
  user_id: string;
  shop: ShopId;
  product: ProductId;
  seed_key: string;
  input_json: string;
  visual_json: string;
  output_json: string;
  created_at: string;
}

const COLUMNS =
  "id, user_id, shop, product, seed_key, input_json, visual_json, output_json, created_at";

export function toResult(
  row: ReadingRow,
  reused: boolean,
  todayCallsLeft: number,
  followups: FollowupView[] = [],
): ReadingResult {
  return {
    id: row.id,
    shop: row.shop,
    product: row.product,
    createdAt: row.created_at,
    visual: JSON.parse(row.visual_json) as ReadingVisual,
    output: JSON.parse(row.output_json) as InterpretOutput,
    reused,
    disclaimer: DISCLAIMER,
    todayCallsLeft,
    followups,
    followupsLeft: Math.max(0, FOLLOWUP_MAX - followups.length),
  };
}

// ── 이어 묻기 (F15) ───────────────────────────────────────
export interface FollowupRow {
  id: string;
  question: string;
  answer: string;
  answer_json: string;
  created_at: string;
}

export async function listFollowups(env: Env, readingId: string): Promise<FollowupRow[]> {
  const res = await env.DB.prepare(
    `SELECT id, question, answer, answer_json, created_at FROM reading_followups
     WHERE reading_id = ? ORDER BY created_at, id`,
  )
    .bind(readingId)
    .all<FollowupRow>();
  return res.results;
}

export const toFollowupView = (f: FollowupRow): FollowupView => ({
  id: f.id,
  question: f.question,
  answer: f.answer,
  createdAt: f.created_at,
});

/** 저장된 풀이 + 이어 묻기 문답 */
export async function resultWithFollowups(
  env: Env,
  row: ReadingRow,
  reused: boolean,
  todayCallsLeft: number,
): Promise<ReadingResult> {
  const f = await listFollowups(env, row.id);
  return toResult(row, reused, todayCallsLeft, f.map(toFollowupView));
}

export function findBySeed(env: Env, userId: string, seedKey: string): Promise<ReadingRow | null> {
  return env.DB.prepare(`SELECT ${COLUMNS} FROM readings WHERE user_id = ? AND seed_key = ?`)
    .bind(userId, seedKey)
    .first<ReadingRow>();
}

/** 남의 id면 null (존재 여부도 알리지 않음, F10) */
export function findById(env: Env, userId: string, id: string): Promise<ReadingRow | null> {
  return env.DB.prepare(`SELECT ${COLUMNS} FROM readings WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<ReadingRow>();
}

export interface NewReading {
  id: string;
  userId: string;
  shop: ShopId;
  product: ProductId;
  seedKey: string;
  input: unknown;
  visual: ReadingVisual;
  output: InterpretOutput;
  promptVersion: string;
  createdAt: string;
}

/** 같은 seed가 이미 있으면 넣지 않고 false (동시에 두 요청이 온 경우) */
export async function insertReading(env: Env, r: NewReading): Promise<boolean> {
  const res = await env.DB.prepare(
    `INSERT INTO readings (id, user_id, shop, product, seed_key, input_json, visual_json, output_json, prompt_version, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, seed_key) DO NOTHING`,
  )
    .bind(
      r.id,
      r.userId,
      r.shop,
      r.product,
      r.seedKey,
      JSON.stringify(r.input),
      JSON.stringify(r.visual),
      JSON.stringify(r.output),
      r.promptVersion,
      r.output.summary,
      r.createdAt,
    )
    .run();
  return res.meta.changes > 0;
}

// ── requestId 중복 방지 (docs/15 §3) ─────────────────────
/** 처리 중 표시가 이보다 오래되면 끊긴 요청으로 보고 다시 잡는다 (waitUntil 30초 + 여유) */
const STALE_MS = 60_000;
const KEEP_MS = 24 * 3_600_000;

export type Claim =
  | { kind: "claimed" }
  | { kind: "done"; readingId: string }
  | { kind: "busy" }
  | { kind: "foreign" };

export async function claimRequest(env: Env, requestId: string, userId: string): Promise<Claim> {
  const now = Date.now();
  const [, claimed] = await env.DB.batch<{ request_id: string }>([
    env.DB.prepare("DELETE FROM request_log WHERE user_id = ? AND created_at < ?").bind(
      userId,
      new Date(now - KEEP_MS).toISOString(),
    ),
    env.DB.prepare(
      `INSERT INTO request_log (request_id, user_id, reading_id, created_at) VALUES (?1, ?2, NULL, ?3)
       ON CONFLICT (request_id) DO UPDATE SET created_at = excluded.created_at
         WHERE request_log.user_id = excluded.user_id AND request_log.reading_id IS NULL
           AND request_log.created_at < ?4
       RETURNING request_id`,
    ).bind(requestId, userId, new Date(now).toISOString(), new Date(now - STALE_MS).toISOString()),
  ]);
  if (claimed?.results.length) return { kind: "claimed" };
  const row = await env.DB.prepare(
    "SELECT user_id, reading_id FROM request_log WHERE request_id = ?",
  )
    .bind(requestId)
    .first<{ user_id: string; reading_id: string | null }>();
  if (!row) return { kind: "busy" };
  if (row.user_id !== userId) return { kind: "foreign" };
  return row.reading_id ? { kind: "done", readingId: row.reading_id } : { kind: "busy" };
}

export async function completeRequest(env: Env, requestId: string, readingId: string) {
  await env.DB.prepare("UPDATE request_log SET reading_id = ? WHERE request_id = ?")
    .bind(readingId, requestId)
    .run();
}

/** 실패하면 지워서 같은 requestId로 다시 시도할 수 있게 한다 */
export async function releaseRequest(env: Env, requestId: string) {
  await env.DB.prepare("DELETE FROM request_log WHERE request_id = ? AND reading_id IS NULL")
    .bind(requestId)
    .run();
}
