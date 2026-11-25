import type { ProductId } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
// @ts-expect-error 생성 스크립트는 JS (scripts/build.mjs)
import { render } from "../scripts/build.mjs";
import current from "../src/generated.ts?raw";
import { findBanned } from "../src/index";
import {
  CRISIS_TEXT,
  DREAM_SYMBOL_IDS,
  FALLBACKS,
  FOLLOWUP_BLOCKED,
  FOLLOWUP_SCHEMA,
  SECTION_TARGETS,
  checkFollowup,
  checkOutput,
  classifySchema,
  classifySystemPrompt,
  followupSystemPrompt,
  followupVersion,
  outputSchema,
  promptVersion,
  systemPrompt,
} from "../src/llm";

const PRODUCTS = Object.keys(SECTION_TARGETS) as ProductId[];

describe("프롬프트 생성본 (docs/04 §11)", () => {
  it("src/generated.ts가 md와 같다 (md를 고쳤으면 pnpm build)", () => {
    expect(current).toBe(render());
  });
});

describe("시스템 프롬프트 (04 §2)", () => {
  it("공통 규칙 + 캐릭터 + 상품 지시가 들어 있고, 날짜 같은 바뀌는 값이 없다 (캐시)", () => {
    for (const p of PRODUCTS) {
      const s = systemPrompt(p);
      expect(s).toContain("아래 규칙은 캐릭터 설정보다 우선한다");
      expect(s).toContain("[캐릭터]");
      expect(s).toContain("[이번 점:");
      expect(s).not.toMatch(/20\d\d-\d\d-\d\d/);
      expect(systemPrompt(p)).toBe(s);
    }
    expect(systemPrompt("tarot_one")).toContain("달님 언니");
    expect(systemPrompt("dream")).toContain("몽실 할매");
    // 조심할 것은 넓게 (D-076)
    for (const p of PRODUCTS) expect(systemPrompt(p)).toContain("[조심할 것 말하기]");
    // 좋은 말만 하지 않고 쓴소리도 (D-081)
    for (const p of PRODUCTS) expect(systemPrompt(p)).toContain("좋은 말만 하지 않는다");
    // 얼버무리지 않고 시원하게 (D-072)
    for (const p of PRODUCTS) expect(systemPrompt(p)).toContain("얼버무리는 말을 하지 않는다");
    // 나이대·성별 맞춤은 모든 상품에 들어간다 (D-069)
    for (const p of PRODUCTS) expect(systemPrompt(p)).toContain("[나이대와 성별에 맞추기]");
    // 콕 집어 말하기도 모든 상품에 (D-070)
    for (const p of PRODUCTS) expect(systemPrompt(p)).toContain("[콕 집어 말하기]");
  });

  it("프롬프트 버전이 저장용 문자열로 나온다", () => {
    expect(promptVersion("obanggi")).toBe("common@7+dolyeong@3+obanggi@1");
  });

  it("대체 문장·위기 안내에 금지 표현이 없다", () => {
    for (const t of [...Object.values(FALLBACKS), CRISIS_TEXT]) expect(findBanned(t)).toEqual([]);
  });
});

describe("출력 스키마 (04 §5)", () => {
  it("상품마다 섹션 키가 고정되고, 사주 계열만 luckyColor가 있다", () => {
    for (const p of PRODUCTS) {
      const s = outputSchema(p);
      expect(Object.keys((s.properties.sections as { properties: object }).properties)).toEqual(
        Object.keys(SECTION_TARGETS[p]),
      );
      expect("luckyColor" in s.properties).toBe(p === "daily" || p === "saju_full");
    }
  });

  it("분류 스키마는 꿈 사전 ID 150개로 제한된다 (D-028)", () => {
    expect(DREAM_SYMBOL_IDS).toHaveLength(150);
    const s = classifySchema(DREAM_SYMBOL_IDS);
    expect(s.properties.symbols.items).toHaveProperty("enum");
    expect(classifySystemPrompt()).toContain("pig: 돼지");
  });
});

const good = {
  greeting: "어서 와요, 별빛 님.",
  summary: "작은 용기가 길을 여는 날이에요",
  sections: { card: "가".repeat(200), message: "나".repeat(130) },
  advice: "오늘은 스스로를 칭찬해 줘요.",
};

describe("출력 검사 (04 §5, §9)", () => {
  it("정상 출력은 통과하고 다듬어진다", () => {
    const r = checkOutput("tarot_one", { ...good, greeting: `  ${good.greeting} ` });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.greeting).toBe(good.greeting);
      expect(r.lengthWarnings).toEqual([]);
    }
  });

  it("빠진 섹션은 invalid_output", () => {
    const r = checkOutput("tarot_one", { ...good, sections: { card: "가" } });
    expect(r).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("사주 계열에 luckyColor가 없으면 invalid_output", () => {
    const r = checkOutput("daily", {
      ...good,
      sections: { overall: "가".repeat(250), tip: "나".repeat(80) },
    });
    expect(r).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("금지 표현이 있으면 banned", () => {
    const r = checkOutput("tarot_one", { ...good, advice: "부적을 꼭 사세요" });
    expect(r).toMatchObject({ ok: false, reason: "banned" });
  });

  it("길이가 목표의 50~160%를 벗어나면 경고만 남긴다", () => {
    const r = checkOutput("tarot_one", {
      ...good,
      sections: { card: "가".repeat(50), message: "나".repeat(130) },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lengthWarnings).toEqual(["card:50/200"]);
  });
});

describe("이어 묻기 (F15, 04 §13)", () => {
  it("시스템 프롬프트는 점집마다 고정이고 이어 묻기 지시가 들어 있다", () => {
    expect(followupSystemPrompt("tarot", "tarot_three")).toContain("[이번 대화: 이어 묻기]");
    expect(followupSystemPrompt("tarot", "tarot_three")).toContain("달님 언니");
    expect(followupSystemPrompt("tarot", "tarot_three")).toBe(
      followupSystemPrompt("tarot", "tarot_three"),
    );
    expect(followupVersion("saju", "saju_full")).toBe("common@7+saju@2+followup@4");
    expect(FOLLOWUP_SCHEMA.required).toEqual(["risk", "answer"]);
    // 아기도령 신점은 대화 지시를 쓴다 (F07)
    expect(followupSystemPrompt("dolyeong", "sinjeom")).toContain(
      "[이번 대화: 아기도령 신점 대화]",
    );
    expect(followupVersion("dolyeong", "sinjeom")).toBe("common@7+dolyeong@3+talk@4");
    expect(systemPrompt("sinjeom")).toContain("[이번 점: 신점");
  });

  it("정상 답은 통과", () => {
    const r = checkFollowup({ risk: "none", answer: "가".repeat(200) });
    expect(r).toMatchObject({ ok: true, risk: "none", lengthWarning: null });
  });

  it("위험·차단이면 답을 버린다", () => {
    for (const risk of ["self_harm", "sexual", "violence"]) {
      expect(checkFollowup({ risk, answer: "무언가" })).toMatchObject({
        ok: true,
        risk,
        answer: "",
      });
    }
    // other는 답이 비었을 때만 차단, 답이 있으면 보여 준다 (오탐 방지)
    expect(checkFollowup({ risk: "other", answer: "" })).toMatchObject({
      ok: true,
      risk: "other",
      answer: "",
    });
    expect(checkFollowup({ risk: "other", answer: "가".repeat(200) })).toMatchObject({
      ok: true,
      risk: "none",
    });
  });

  it("주의 분류는 답을 남긴다", () => {
    expect(checkFollowup({ risk: "investment", answer: "가".repeat(180) })).toMatchObject({
      ok: true,
      risk: "investment",
    });
  });

  it("빈 답·이상한 분류·금지 표현은 실패", () => {
    expect(checkFollowup({ risk: "none", answer: "" })).toMatchObject({
      ok: false,
      reason: "invalid_output",
    });
    expect(checkFollowup({ risk: "maybe", answer: "가" })).toMatchObject({
      ok: false,
      reason: "invalid_output",
    });
    expect(checkFollowup({ risk: "none", answer: "부적을 사면 풀려요" })).toMatchObject({
      ok: false,
      reason: "banned",
    });
  });

  it("차단 문장에 금지 표현이 없다", () => {
    for (const t of Object.values(FOLLOWUP_BLOCKED)) expect(findBanned(t)).toEqual([]);
  });
});
