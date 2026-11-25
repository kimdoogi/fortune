/**
 * GET /api/daily: 오늘의 운세 (F13, docs/04 §8). 일간(10개) × 오늘 일진으로 정해져 사용자끼리 공유한다.
 * KV에 없으면 daily_gen 행을 먼저 넣은 요청만 생성하고, 나머지는 KV를 1초 간격으로 최대 10초 확인한다.
 * 하루 30회 상한에 넣지 않고 readings에도 저장하지 않는다.
 * TODO(docs/04 §8): 전날 12:00 Cron → Batch API로 다음 날 10건을 미리 만들어 KV에 넣는다
 */
import { iljin } from "@fortune/fortune-engine";
import {
  DISCLAIMER,
  type DailyResponse,
  type InterpretInput,
  type InterpretOutput,
  type InterpretResult,
} from "@fortune/shared-types";
import type { Env } from "./env";
import { buildDaily } from "./facts/saju";
import { HttpError, json } from "./http";
import { FALLBACK } from "./personas";
import { natalOf, requireProfile } from "./profile";
import type { User } from "./session";
import { nowIso, todayKst } from "./time";

const TTL_S = 2 * 24 * 3600;
const POLL_MS = 1000;
const POLL_MAX_MS = 10_000;
/** 생성하던 요청이 죽었다고 보는 시간 (해석 시간 초과 20초 + 여유) */
const GEN_STALE_MS = 60_000;

interface Stored {
  output: InterpretOutput;
  promptVersion: string;
}

export const dailyKey = (date: string, stem: string) => `daily:${date}:${stem}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 일간별 공용 결과라 개인 정보(닉네임 등)를 넣지 않는다 */
export function dailyInput(date: string, stem: string, todayIljin: string): InterpretInput {
  const parts = buildDaily(stem, todayIljin, date);
  return {
    shop: "saju",
    product: "daily",
    today: date,
    user: { nickname: "그대", gender: "female", ageBand: "전체" },
    facts: parts.facts,
    question: null,
    chart: { dayMaster: { stem } },
    luck: {
      daewoon: null,
      sewoon: null,
      iljin: { date, pillar: todayIljin, tenGods: parts.tenGods },
    },
  };
}

async function generate(env: Env, date: string, stem: string, todayIljin: string): Promise<Stored> {
  let result: InterpretResult;
  try {
    result = await env.READING.interpret(dailyInput(date, stem, todayIljin));
  } catch (e) {
    console.error("daily interpret rpc failed", String(e));
    result = { ok: false, reason: "api_error", fallback: FALLBACK.saju, promptVersion: "" };
  }
  if (!result.ok) throw new HttpError("LLM_UNAVAILABLE", result.fallback || FALLBACK.saju);
  const stored: Stored = { output: result.output, promptVersion: result.promptVersion };
  await env.KV.put(dailyKey(date, stem), JSON.stringify(stored), { expirationTtl: TTL_S });
  return stored;
}

async function getOrCreate(
  env: Env,
  ctx: ExecutionContext,
  date: string,
  stem: string,
  todayIljin: string,
): Promise<Stored> {
  const key = dailyKey(date, stem);
  const cached = await env.KV.get<Stored>(key, "json");
  if (cached) return cached;

  const won = await env.DB.prepare(
    "INSERT OR IGNORE INTO daily_gen (date, stem, created_at) VALUES (?, ?, ?)",
  )
    .bind(date, stem, nowIso())
    .run();
  if (won.meta.changes > 0) {
    const work = generate(env, date, stem, todayIljin).catch(async (e) => {
      // 실패하면 행을 지워 다음 요청이 다시 만들 수 있게 한다
      await env.DB.prepare("DELETE FROM daily_gen WHERE date = ? AND stem = ?")
        .bind(date, stem)
        .run();
      throw e;
    });
    ctx.waitUntil(work.catch(() => undefined));
    return work;
  }

  for (let waited = 0; waited < POLL_MAX_MS; waited += POLL_MS) {
    await sleep(POLL_MS);
    const v = await env.KV.get<Stored>(key, "json");
    if (v) return v;
  }
  // 만들던 요청이 끊겼으면 행을 지워 다음 요청이 다시 만들게 한다
  await env.DB.prepare("DELETE FROM daily_gen WHERE date = ? AND stem = ? AND created_at < ?")
    .bind(date, stem, new Date(Date.now() - GEN_STALE_MS).toISOString())
    .run();
  throw new HttpError("LLM_UNAVAILABLE", FALLBACK.saju);
}

export async function getDaily(env: Env, ctx: ExecutionContext, user: User): Promise<Response> {
  const profile = await requireProfile(env, user.id);
  const stem = natalOf(profile).pillars.day.charAt(0);
  const date = todayKst();
  const todayIljin = iljin(date);
  const stored = await getOrCreate(env, ctx, date, stem, todayIljin);
  // 점수·숫자는 코드 계산이라 KV에 두지 않고 매번 붙인다 (D-080)
  const parts = buildDaily(stem, todayIljin, date);
  const out: DailyResponse = {
    date,
    iljin: todayIljin,
    dayMaster: stem,
    score: parts.score,
    scoreLabel: parts.scoreLabel,
    luckyNumbers: parts.luckyNumbers,
    result: stored.output,
    disclaimer: DISCLAIMER,
  };
  return json(out);
}
