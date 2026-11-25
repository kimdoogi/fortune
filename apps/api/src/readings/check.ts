/**
 * POST /api/readings/check: 꿈 내용 검사 (F08, docs/04 §6).
 * 1차 필터(코드, 차감 없음) → 하루 상한 → 분류 호출(차감) → 위험·상징 처리 → checkId 발급
 */
import type { CheckBlockReason, CheckResponse, ClassifyResult } from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { DREAM_SYMBOL_IDS, dreamSymbol } from "../facts/data";
import { knownSymbolIds } from "../facts/dream";
import { filterDream } from "../filters";
import { HttpError, json, readBody } from "../http";
import { DREAM_CHECK_TEXT, FALLBACK } from "../personas";
import { requireProfile } from "../profile";
import { dreamSeedKey } from "../seed";
import type { User } from "../session";
import { todayKst } from "../time";
import { callsLeft, reserveCall } from "../usage";
import { saveCheck } from "./checks";
import { findBySeed } from "./store";

const CheckSchema = z.object({ shop: z.literal("dream"), text: z.string().max(5000) });

const BLOCKED_RISKS = new Set(["sexual", "violence", "other"]);

const blocked = (reason: CheckBlockReason, todayCallsLeft: number): CheckResponse => ({
  ok: false,
  reason,
  message: DREAM_CHECK_TEXT[reason],
  todayCallsLeft,
});

const symbolViews = (ids: string[]) => ids.map((id) => ({ id, name: dreamSymbol(id)?.name ?? id }));

export async function checkDream(req: Request, env: Env, user: User): Promise<Response> {
  const body = await readBody(req, CheckSchema);
  await requireProfile(env, user.id);
  const text = body.text.trim();

  // 1차 필터: LLM 호출 없음, 차감 없음
  const block = filterDream(text);
  if (block) return json(blocked(block, await callsLeft(env, user.id)));

  // 같은 날 같은 꿈이면 분류도 다시 하지 않는다 (F08 완료 기준: LLM 재호출 없음)
  const stored = await findBySeed(env, user.id, await dreamSeedKey(todayKst(), text));
  if (stored) {
    const visual = JSON.parse(stored.visual_json) as { symbols?: { id: string }[] };
    const ids = (visual.symbols ?? []).map((s) => s.id);
    const checkId = await saveCheck(env, user.id, { text, symbolIds: ids, risk: "none" });
    const res: CheckResponse = {
      ok: true,
      checkId,
      symbols: symbolViews(ids),
      todayCallsLeft: await callsLeft(env, user.id),
    };
    return json(res);
  }

  const left = await reserveCall(env, user.id, "dream");
  let cls: ClassifyResult;
  try {
    cls = await env.READING.classify({ kind: "dream", text, symbolIds: DREAM_SYMBOL_IDS });
  } catch (e) {
    console.error("classify rpc failed", String(e));
    cls = { ok: false, reason: "api_error" };
  }
  if (!cls.ok) throw new HttpError("LLM_UNAVAILABLE", FALLBACK.dream);

  // self_harm: 점을 보지 않고 위기 안내 (docs/04a)
  if (cls.risk === "self_harm") return json(blocked("CRISIS", left));
  if (BLOCKED_RISKS.has(cls.risk)) return json(blocked("BLOCKED", left));

  const ids = knownSymbolIds(cls.symbols);
  if (ids.length === 0) return json(blocked("NO_SYMBOLS", left));

  const checkId = await saveCheck(env, user.id, { text, symbolIds: ids, risk: cls.risk });
  const res: CheckResponse = { ok: true, checkId, symbols: symbolViews(ids), todayCallsLeft: left };
  return json(res);
}
