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
  SECTION_TARGETS,
  checkOutput,
  classifySchema,
  classifySystemPrompt,
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
  });

  it("프롬프트 버전이 저장용 문자열로 나온다", () => {
    expect(promptVersion("obanggi")).toBe("common@1+dolyeong@1+obanggi@1");
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
