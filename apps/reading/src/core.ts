/**
 * 해석·분류 핵심 로직 (docs/04 §6, §9). Worker 런타임과 무관해서 평가 스크립트(tools/llm-eval)도 그대로 쓴다.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  CALL,
  CLASSIFY_CATEGORIES,
  CLASSIFY_RISKS,
  CLASSIFY_VERSION,
  DREAM_SYMBOL_IDS,
  FALLBACKS,
  FOLLOWUP_SCHEMA,
  MODEL,
  SECTION_TARGETS,
  callSettings,
  checkFollowup,
  checkOutput,
  classifySchema,
  classifySystemPrompt,
  followupMax,
  followupSystemPrompt,
  followupTarget,
  followupVersion,
  outputSchema,
  promptVersion,
  systemPrompt,
} from "@fortune/prompts/llm";
import type {
  ClassifyInput,
  ClassifyResult,
  FollowupInput,
  FollowupResult,
  InterpretInput,
  InterpretOutput,
  InterpretResult,
} from "@fortune/shared-types";
import { type CallOutcome, callModel } from "./llm";

export interface CoreOptions {
  /** 평가에서 effort를 바꿔 비교할 때 (04 §12) */
  effort?: "low" | "medium" | "high";
  log?: (fields: Record<string, unknown>) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** 로그에는 개인정보를 남기지 않는다: 종류, 상품, 토큰, 지연, 결과만 (docs/15 §6) */
const defaultLog = (fields: Record<string, unknown>) =>
  console.log(JSON.stringify({ ev: "llm", ...fields }));

export function fixture(input: InterpretInput): InterpretOutput {
  const sections = Object.fromEntries(
    Object.keys(SECTION_TARGETS[input.product]).map((k) => [
      k,
      `[고정 응답] ${input.shop}/${input.product}의 ${k}`,
    ]),
  );
  const out: InterpretOutput = {
    greeting: "[고정 응답] 어서 오세요",
    summary: "[고정 응답] 개발용 결과예요",
    sections,
    advice: "[고정 응답] 실제 풀이는 LLM_MODE=live에서 나와요",
  };
  if (input.product === "daily" || input.product === "saju_full") out.luckyColor = "청록";
  return out;
}

export function fixtureClassify(input: ClassifyInput): ClassifyResult {
  const hit = DREAM_SYMBOL_IDS.filter((id) => input.text.includes(id)).slice(0, 3);
  return {
    ok: true,
    category: "기타",
    risk: "none",
    symbols: input.kind === "dream" ? (hit.length ? hit : ["pig"]) : [],
  };
}

export async function interpretWith(
  client: Anthropic,
  input: InterpretInput,
  opts: CoreOptions = {},
): Promise<InterpretResult> {
  const pv = promptVersion(input.product);
  const log = opts.log ?? defaultLog;
  const sleep = opts.sleep ?? defaultSleep;
  const settings = callSettings(input.product);
  let maxTokens: number = settings.maxTokens;
  const retried = { api: false, truncated: false, parse: false };
  const fail = (reason: Extract<InterpretResult, { ok: false }>["reason"]): InterpretResult => ({
    ok: false,
    reason,
    fallback: FALLBACKS[input.shop],
    promptVersion: pv,
  });

  for (let attempt = 1; attempt <= 4; attempt++) {
    const t0 = Date.now();
    const r: CallOutcome = await callModel(client, MODEL, {
      system: systemPrompt(input.product),
      messages: [{ role: "user", content: JSON.stringify(input) }],
      schema: outputSchema(input.product),
      maxTokens,
      effort: opts.effort ?? settings.effort,
      timeoutMs: settings.timeoutMs,
    });
    const base = {
      kind: "interpret",
      shop: input.shop,
      product: input.product,
      attempt,
      ms: Date.now() - t0,
    };

    if (r.kind === "text") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.text);
      } catch {
        parsed = null;
      }
      const check = checkOutput(input.product, parsed);
      log({
        ...base,
        result: check.ok ? "ok" : check.reason,
        detail: check.ok ? check.lengthWarnings : check.detail,
        in: r.usage.input_tokens,
        out: r.usage.output_tokens,
        cacheRead: r.usage.cache_read_input_tokens,
        cacheWrite: r.usage.cache_creation_input_tokens,
      });
      if (check.ok) return { ok: true, output: check.output, promptVersion: pv };
      if (check.reason === "banned") return fail("banned");
      if (!retried.parse) {
        retried.parse = true;
        continue;
      }
      return fail("invalid_output");
    }

    log({
      ...base,
      result: r.kind,
      ...("status" in r ? { status: r.status } : {}),
      ...("category" in r ? { category: r.category } : {}),
    });
    if (r.kind === "refusal") return fail("refusal");
    if (r.kind === "timeout") return fail("timeout");
    if (r.kind === "max_tokens") {
      if (retried.truncated) return fail("truncated");
      retried.truncated = true;
      maxTokens = Math.round(maxTokens * 1.5);
      continue;
    }
    if (r.kind === "retryable" && !retried.api) {
      retried.api = true;
      await sleep(1000);
      continue;
    }
    return fail("api_error");
  }
  return fail("api_error");
}

export async function classifyWith(
  client: Anthropic,
  input: ClassifyInput,
  opts: CoreOptions = {},
): Promise<ClassifyResult> {
  const ids =
    input.kind === "dream" ? (input.symbolIds?.length ? input.symbolIds : DREAM_SYMBOL_IDS) : [];
  const log = opts.log ?? defaultLog;
  const sleep = opts.sleep ?? defaultSleep;
  let retried = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const r = await callModel(client, MODEL, {
      system: classifySystemPrompt(),
      messages: [{ role: "user", content: JSON.stringify({ kind: input.kind, text: input.text }) }],
      schema: classifySchema(ids),
      maxTokens: CALL.classify.maxTokens,
      effort: CALL.classify.effort,
      timeoutMs: CALL.classify.timeoutMs,
    });
    const base = { kind: "classify", version: CLASSIFY_VERSION, attempt, ms: Date.now() - t0 };
    if (r.kind === "text") {
      let o: { category?: string; risk?: string; symbols?: unknown } | null = null;
      try {
        o = JSON.parse(r.text);
      } catch {
        o = null;
      }
      const category = CLASSIFY_CATEGORIES.find((c) => c === o?.category);
      const risk = CLASSIFY_RISKS.find((c) => c === o?.risk);
      const valid = new Set(ids);
      const symbols = Array.isArray(o?.symbols)
        ? [
            ...new Set(
              (o.symbols as unknown[]).filter(
                (s): s is string => typeof s === "string" && valid.has(s),
              ),
            ),
          ]
        : null;
      log({
        ...base,
        result: category && risk && symbols ? "ok" : "invalid_output",
        in: r.usage.input_tokens,
        out: r.usage.output_tokens,
        cacheRead: r.usage.cache_read_input_tokens,
      });
      if (category && risk && symbols)
        return { ok: true, category, risk, symbols: symbols.slice(0, 5) };
      if (!retried) {
        retried = true;
        continue;
      }
      return { ok: false, reason: "invalid_output" };
    }
    log({ ...base, result: r.kind });
    if (r.kind === "refusal") return { ok: false, reason: "refusal" };
    if (r.kind === "timeout") return { ok: false, reason: "timeout" };
    if ((r.kind === "retryable" || r.kind === "max_tokens") && !retried) {
      retried = true;
      if (r.kind === "retryable") await sleep(1000);
      continue;
    }
    return { ok: false, reason: "api_error" };
  }
  return { ok: false, reason: "api_error" };
}

/**
 * 이어 묻기 (F15, docs/04 §13). 원래 풀이 입력·출력과 앞선 문답을 저장된 문자열 그대로 이어 붙여
 * 앞부분이 프롬프트 캐시에서 읽히게 한다. 위험 검사와 답을 한 번에 받는다 (D-071).
 */
export async function followupWith(
  client: Anthropic,
  input: FollowupInput,
  opts: CoreOptions = {},
): Promise<FollowupResult> {
  const pv = followupVersion(input.shop, input.product);
  const log = opts.log ?? defaultLog;
  const sleep = opts.sleep ?? defaultSleep;
  const fail = (reason: Extract<FollowupResult, { ok: false }>["reason"]): FollowupResult => ({
    ok: false,
    reason,
    fallback: FALLBACKS[input.shop],
    promptVersion: pv,
  });
  const max = followupMax(input.product);
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: input.originalInput },
    { role: "assistant", content: input.originalOutput },
    // 몇 번째 대화인지 같이 보낸다 (신점 마지막 답은 정리, F07). 순번은 매번 같아 캐시가 유지된다
    ...input.history.flatMap((h, i): Anthropic.MessageParam[] => [
      { role: "user", content: JSON.stringify({ question: h.question, turn: i + 1, of: max }) },
      { role: "assistant", content: h.answerJson },
    ]),
    {
      role: "user",
      content: JSON.stringify({
        question: input.question,
        turn: input.history.length + 1,
        of: max,
      }),
    },
  ];
  let maxTokens: number = CALL.followup.maxTokens;
  const retried = { api: false, truncated: false, parse: false };

  for (let attempt = 1; attempt <= 4; attempt++) {
    const t0 = Date.now();
    const r: CallOutcome = await callModel(client, MODEL, {
      system: followupSystemPrompt(input.shop, input.product),
      messages,
      cacheConversation: true,
      schema: FOLLOWUP_SCHEMA,
      maxTokens,
      // effort는 고정 (바꾸면 메시지 캐시가 깨진다, 04 §13)
      effort: CALL.followup.effort,
      timeoutMs: CALL.followup.timeoutMs,
    });
    const base = {
      kind: "followup",
      shop: input.shop,
      turn: input.history.length + 1,
      attempt,
      ms: Date.now() - t0,
    };
    if (r.kind === "text") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(r.text);
      } catch {
        parsed = null;
      }
      const check = checkFollowup(parsed, followupTarget(input.product));
      log({
        ...base,
        result: check.ok ? "ok" : check.reason,
        risk: check.ok ? check.risk : undefined,
        detail: check.ok ? check.lengthWarning : check.detail,
        in: r.usage.input_tokens,
        out: r.usage.output_tokens,
        cacheRead: r.usage.cache_read_input_tokens,
        cacheWrite: r.usage.cache_creation_input_tokens,
      });
      if (check.ok) {
        return {
          ok: true,
          risk: check.risk,
          answer: check.answer,
          answerJson: r.text,
          promptVersion: pv,
        };
      }
      if (check.reason === "banned") return fail("banned");
      if (!retried.parse) {
        retried.parse = true;
        continue;
      }
      return fail("invalid_output");
    }
    log({ ...base, result: r.kind });
    if (r.kind === "refusal") return fail("refusal");
    if (r.kind === "timeout") return fail("timeout");
    if (r.kind === "max_tokens") {
      if (retried.truncated) return fail("truncated");
      retried.truncated = true;
      maxTokens = Math.round(maxTokens * 1.5);
      continue;
    }
    if (r.kind === "retryable" && !retried.api) {
      retried.api = true;
      await sleep(1000);
      continue;
    }
    return fail("api_error");
  }
  return fail("api_error");
}
