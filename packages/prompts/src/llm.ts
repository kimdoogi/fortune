/**
 * LLM 호출에 쓰는 프롬프트·스키마·검사 (docs/04, 04a). reading Worker와 평가 스크립트가 같이 쓴다.
 * 시스템 프롬프트 = 공통 규칙 + 캐릭터 + 상품별 지시 (점집·상품마다 고정이라 캐시된다, 04 §2).
 */
import type { InterpretOutput, ProductId, ShopId } from "@fortune/shared-types";
import { PROMPTS } from "./generated";
import { findBanned } from "./index";

export const MODEL = "claude-haiku-5-5";

/** 상품별 섹션 키와 목표 글자 수 (04 §4, 04a 상품별 지시) */
export const SECTION_TARGETS: Record<ProductId, Record<string, number>> = {
  daily: { overall: 250, tip: 80 },
  saju_full: {
    overall: 300,
    personality: 220,
    elements: 180,
    yongsin: 180,
    daewoon: 200,
    thisYear: 220,
    love: 160,
    money: 160,
    work: 160,
  },
  tarot_one: { card: 200, message: 130 },
  tarot_three: { past: 220, present: 250, future: 250, advice: 180 },
  obanggi: { flag: 250, message: 380, advice: 220 },
  dream: { symbols: 300, meaning: 350, advice: 200 },
};

export const PRODUCT_SHOP: Record<ProductId, ShopId> = {
  daily: "saju",
  saju_full: "saju",
  tarot_one: "tarot",
  tarot_three: "tarot",
  obanggi: "dolyeong",
  dream: "dream",
};

/** 호출 설정 (04 §2). effort는 평가(§12) 뒤 확정 */
export const CALL = {
  interpret: { effort: "low", maxTokens: 4000, timeoutMs: 20_000 },
  sajuFull: { effort: "low", maxTokens: 8000, timeoutMs: 25_000 },
  classify: { effort: "low", maxTokens: 1000, timeoutMs: 10_000 },
  /** 이어 묻기 (04 §13). effort는 모든 이어 묻기에서 같아야 메시지 캐시가 유지된다 */
  followup: { effort: "low", maxTokens: 2000, timeoutMs: 15_000 },
} as const;

export function callSettings(product: ProductId) {
  return product === "saju_full" ? CALL.sajuFull : CALL.interpret;
}

/** 점집별 대체 문장 (04a 대체 템플릿) */
export const FALLBACKS: Record<ShopId, string> = {
  saju: "오늘은 별자리가 구름에 가려 사주가 잘 읽히지 않는구려. 잠시 뒤에 다시 오시오.",
  tarot: "어머, 카드가 오늘은 수줍어하네요. 조금 있다가 다시 펼쳐 볼까요?",
  dolyeong: "으앙, 방울 소리가 안 들려! 이따 다시 와!",
  dream: "아이고, 할매가 깜빡 졸았구먼. 이따 다시 얘기해 줘.",
};

/** 위기 안내 (04a, LLM을 거치지 않는다) */
export const CRISIS_TEXT =
  "지금 많이 힘드신 것 같아요. 혼자 견디지 않으셔도 괜찮아요.\n" +
  "자살예방상담전화 109 (24시간, 무료)에 전화하면 이야기를 들어 줄 사람이 있어요.\n" +
  "위급한 상황이라면 112 또는 119에 바로 연락해 주세요.";

const OUTPUT_RULES = `[출력 형식]
- greeting: 캐릭터의 첫마디 한 줄 (30자 이하)
- summary: 결과 한 줄 요약 (40자 이하)
- sections: 아래 지시의 섹션을 모두 채운다. 제목이나 머리말 없이 본문만 쓴다.
- advice: 마지막 한마디 (80자 이하)`;

/** 시스템 프롬프트 (사용자마다 바뀌는 값은 넣지 않는다 — 캐시, 04 §2) */
export function systemPrompt(product: ProductId): string {
  const shop = PRODUCT_SHOP[product];
  return [
    PROMPTS.common.text,
    PROMPTS.persona[shop].text,
    OUTPUT_RULES,
    PROMPTS.product[product].text,
  ].join("\n\n");
}

/** 결과에 저장하는 프롬프트 버전 (04 §11) */
export function promptVersion(product: ProductId): string {
  const shop = PRODUCT_SHOP[product];
  return `common@${PROMPTS.common.v}+${shop}@${PROMPTS.persona[shop].v}+${product}@${PROMPTS.product[product].v}`;
}

export const CLASSIFY_VERSION = `classify@${PROMPTS.classify.v}`;
export const classifySystemPrompt = (): string => PROMPTS.classify.text;
export const DREAM_SYMBOL_IDS: readonly string[] = PROMPTS.symbolIds;

const withLuckyColor = (p: ProductId) => p === "daily" || p === "saju_full";

/** 구조화 출력 스키마 (04 §5). 섹션은 상품마다 고정 키를 가진 객체 */
export function outputSchema(product: ProductId) {
  const keys = Object.keys(SECTION_TARGETS[product]);
  const sections = Object.fromEntries(
    Object.entries(SECTION_TARGETS[product]).map(([k, n]) => [
      k,
      { type: "string", description: `${n}자 안팎` },
    ]),
  );
  const properties: Record<string, unknown> = {
    greeting: { type: "string", description: "캐릭터의 첫마디 한 줄, 30자 이하" },
    summary: { type: "string", description: "한 줄 요약, 40자 이하" },
    sections: { type: "object", properties: sections, required: keys, additionalProperties: false },
    advice: { type: "string", description: "마지막 한마디, 80자 이하" },
  };
  const required = ["greeting", "summary", "sections", "advice"];
  if (withLuckyColor(product)) {
    properties.luckyColor = { type: "string", description: "facts의 행운의 색을 그대로" };
    required.push("luckyColor");
  }
  return { type: "object", properties, required, additionalProperties: false } as const;
}

export const CLASSIFY_CATEGORIES = ["연애", "재물", "직장", "건강", "가족", "기타"] as const;
export const CLASSIFY_RISKS = [
  "none",
  "self_harm",
  "medical",
  "legal",
  "investment",
  "sexual",
  "violence",
  "other",
] as const;

/** 분류 스키마. 꿈 상징은 사전 ID enum으로 제한한다 (D-028) */
export function classifySchema(symbolIds: readonly string[]) {
  return {
    type: "object",
    properties: {
      category: { type: "string", enum: [...CLASSIFY_CATEGORIES] },
      risk: { type: "string", enum: [...CLASSIFY_RISKS] },
      symbols: symbolIds.length
        ? { type: "array", items: { type: "string", enum: [...symbolIds] } }
        : { type: "array", items: { type: "string" } },
    },
    required: ["category", "risk", "symbols"],
    additionalProperties: false,
  } as const;
}

export type OutputCheck =
  | { ok: true; output: InterpretOutput; lengthWarnings: string[] }
  | { ok: false; reason: "invalid_output" | "banned"; detail: string };

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** 받은 뒤 코드가 검사할 것 (04 §5): 스키마 일치, 금지 표현, 섹션 길이(50~160%, 로그만) */
export function checkOutput(product: ProductId, raw: unknown): OutputCheck {
  if (!raw || typeof raw !== "object")
    return { ok: false, reason: "invalid_output", detail: "not an object" };
  const o = raw as Record<string, unknown>;
  for (const k of ["greeting", "summary", "advice"]) {
    if (!isText(o[k])) return { ok: false, reason: "invalid_output", detail: `missing ${k}` };
  }
  const sec = o.sections as Record<string, unknown> | undefined;
  const targets = SECTION_TARGETS[product];
  if (!sec || typeof sec !== "object")
    return { ok: false, reason: "invalid_output", detail: "missing sections" };
  const sections: Record<string, string> = {};
  const lengthWarnings: string[] = [];
  for (const [k, n] of Object.entries(targets)) {
    const v = sec[k];
    if (!isText(v)) return { ok: false, reason: "invalid_output", detail: `missing section ${k}` };
    sections[k] = v.trim();
    const len = [...v].length;
    if (len < n * 0.5 || len > n * 1.6) lengthWarnings.push(`${k}:${len}/${n}`);
  }
  const output: InterpretOutput = {
    greeting: (o.greeting as string).trim(),
    summary: (o.summary as string).trim(),
    sections,
    advice: (o.advice as string).trim(),
  };
  if (withLuckyColor(product)) {
    if (!isText(o.luckyColor))
      return { ok: false, reason: "invalid_output", detail: "missing luckyColor" };
    output.luckyColor = o.luckyColor.trim();
  }
  const all = [output.greeting, output.summary, output.advice, ...Object.values(sections)].join(
    "\n",
  );
  const hits = findBanned(all);
  if (hits.length) return { ok: false, reason: "banned", detail: hits.join(",") };
  return { ok: true, output, lengthWarnings };
}

// ── 이어 묻기 (F15, 04 §13) ─────────────────────────────────

/** 한 풀이에 물을 수 있는 횟수 (D-071) */
export const FOLLOWUP_MAX = 3;
export const FOLLOWUP_MAX_CHARS = 100;
export const FOLLOWUP_TARGET = 200;

/** 이어 묻기 시스템 프롬프트: 공통 규칙 + 캐릭터 + 이어 묻기 지시. 점집마다 고정 (캐시) */
export function followupSystemPrompt(shop: ShopId): string {
  return [PROMPTS.common.text, PROMPTS.persona[shop].text, PROMPTS.followup.text].join("\n\n");
}

export function followupVersion(shop: ShopId): string {
  return `common@${PROMPTS.common.v}+${shop}@${PROMPTS.persona[shop].v}+followup@${PROMPTS.followup.v}`;
}

/** 이어 묻기 출력 스키마. 바꾸면 캐시가 깨지므로 고정한다 */
export const FOLLOWUP_SCHEMA = {
  type: "object",
  properties: {
    risk: { type: "string", enum: [...CLASSIFY_RISKS] },
    answer: {
      type: "string",
      description:
        "200자 안팎. 첫 문장은 결론(된다/온다/언제)으로 시작. '가능성', '~것 같아요', '알 수 없어요' 금지. 위험·차단이면 빈 문자열",
    },
  },
  required: ["risk", "answer"],
  additionalProperties: false,
} as const;

/** 차단(sexual, violence, other)일 때 보여주는 문장 (04a 이어 묻기) */
export const FOLLOWUP_BLOCKED: Record<ShopId, string> = {
  saju: "그 이야기는 이 자리에서 나눌 수 없구려. 풀이에 대해 다른 것을 물어보시오.",
  tarot: "음… 그 이야기는 카드에게 묻기 어려워요. 풀이에 대해 다른 걸 물어봐 줄래요?",
  dolyeong: "그건 아기도령이 말 못 해! 다른 거 물어봐!",
  dream: "아이고, 그 얘기는 할매가 못 들어 주겄어. 꿈 얘기로 다시 물어봐.",
};

export type FollowupRisk = (typeof CLASSIFY_RISKS)[number];

export type FollowupCheck =
  | { ok: true; risk: FollowupRisk; answer: string; lengthWarning: string | null }
  | { ok: false; reason: "invalid_output" | "banned"; detail: string };

/** 이어 묻기 출력 검사: 스키마, 위험 분류, 금지 표현, 길이(로그만) */
export function checkFollowup(raw: unknown): FollowupCheck {
  if (!raw || typeof raw !== "object")
    return { ok: false, reason: "invalid_output", detail: "not an object" };
  const o = raw as Record<string, unknown>;
  const risk = CLASSIFY_RISKS.find((r) => r === o.risk);
  if (!risk) return { ok: false, reason: "invalid_output", detail: "bad risk" };
  const answer = typeof o.answer === "string" ? o.answer.trim() : "";
  // 위험·차단이면 답은 버린다 (코드가 위기 안내·차단 문장을 보여 준다)
  if (risk === "self_harm" || risk === "sexual" || risk === "violence") {
    return { ok: true, risk, answer: "", lengthWarning: null };
  }
  // other는 오탐이 잦다: 답을 썼으면 보여 주고(none으로 본다), 비었을 때만 차단 (F15)
  if (risk === "other") {
    if (!answer) return { ok: true, risk, answer: "", lengthWarning: null };
  }
  if (!answer) return { ok: false, reason: "invalid_output", detail: "empty answer" };
  const shownRisk: FollowupRisk = risk === "other" ? "none" : risk;
  const hits = findBanned(answer);
  if (hits.length) return { ok: false, reason: "banned", detail: hits.join(",") };
  const len = [...answer].length;
  const warn =
    len < FOLLOWUP_TARGET * 0.5 || len > FOLLOWUP_TARGET * 1.6
      ? `answer:${len}/${FOLLOWUP_TARGET}`
      : null;
  return { ok: true, risk: shownRisk, answer, lengthWarning: warn };
}
