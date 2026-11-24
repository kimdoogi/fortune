/**
 * 타로 의미표(data/meanings/tarot.json)와 꿈 사전(data/meanings/dream.json) 콘텐츠 검사.
 * - 타로: 메이저 아르카나 22장 (D-053)
 * - 꿈 사전: 상징 150개, 분류 호출의 enum이 되는 ID (D-028)
 * - 모든 문장이 docs/04-llm-spec.md §7 금지 표현 목록 v1에 걸리지 않는지
 */
import { describe, expect, it } from "vitest";
import { findBanned } from "../../prompts/src/index";
import dream from "../data/meanings/dream.json";
import tarot from "../data/meanings/tarot.json";

interface TarotCard {
  id: number;
  slug: string;
  name: string;
  scene: string;
  keywords: { upright: string[]; reversed: string[] };
  upright: string;
  reversed: string;
  byCategory: Record<string, string>;
}

interface DreamSymbol {
  id: string;
  name: string;
  synonyms: string[];
  category: string;
  tone: string;
  keywords: string[];
  meaning: string;
}

const cards = tarot as TarotCard[];
const symbols = dream as DreamSymbol[];

const TAROT_CATEGORIES = ["연애", "재물", "직장", "오늘"];
const DREAM_CATEGORIES = [
  "동물",
  "사람",
  "자연",
  "물건",
  "장소",
  "행동",
  "신체",
  "음식",
  "색깔",
  "기타",
];
const DREAM_TONES = ["길", "흉", "중립"];

/** 금지 표현 목록 v1은 packages/prompts/common/banned.json 한 곳에서 관리한다 */
const bannedHits = findBanned;

function collectStrings(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
  }
}

const nonEmpty = (s: unknown) => typeof s === "string" && s.trim().length > 0;

describe("타로 의미표 (메이저 아르카나 22장)", () => {
  it("22장이고 id가 0부터 21까지 순서대로다", () => {
    expect(cards).toHaveLength(22);
    expect(cards.map((c) => c.id)).toEqual(Array.from({ length: 22 }, (_, i) => i));
  });

  it("slug와 이름이 겹치지 않는다", () => {
    expect(new Set(cards.map((c) => c.slug)).size).toBe(22);
    expect(new Set(cards.map((c) => c.name)).size).toBe(22);
  });

  for (const c of cards) {
    it(`${c.id} ${c.name}: 필드가 모두 있다`, () => {
      expect(c.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(nonEmpty(c.name)).toBe(true);
      expect(nonEmpty(c.scene)).toBe(true);
      expect(nonEmpty(c.upright)).toBe(true);
      expect(nonEmpty(c.reversed)).toBe(true);
      for (const side of ["upright", "reversed"] as const) {
        const kw = c.keywords[side];
        expect(kw.length).toBeGreaterThanOrEqual(3);
        expect(kw.length).toBeLessThanOrEqual(5);
        expect(kw.every(nonEmpty)).toBe(true);
      }
      expect(Object.keys(c.byCategory).sort()).toEqual([...TAROT_CATEGORIES].sort());
      for (const cat of TAROT_CATEGORIES) expect(nonEmpty(c.byCategory[cat])).toBe(true);
    });
  }
});

describe("꿈 사전 (상징 150개)", () => {
  it("상징이 정확히 150개다", () => {
    expect(symbols).toHaveLength(150);
  });

  it("id가 겹치지 않고 소문자 snake_case다", () => {
    const ids = symbols.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("이름과 동의어가 서로 다른 상징에 겹쳐 나오지 않는다", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const s of symbols) {
      for (const term of new Set([s.name, ...s.synonyms])) {
        const prev = owner.get(term);
        if (prev && prev !== s.id) clashes.push(`"${term}": ${prev} / ${s.id}`);
        owner.set(term, s.id);
      }
    }
    expect(clashes).toEqual([]);
  });

  for (const s of symbols) {
    it(`${s.id}: 필드와 허용 값`, () => {
      expect(nonEmpty(s.name)).toBe(true);
      expect(s.synonyms.length).toBeGreaterThanOrEqual(2);
      expect(s.synonyms.length).toBeLessThanOrEqual(6);
      expect(s.synonyms.every(nonEmpty)).toBe(true);
      expect(new Set(s.synonyms).size).toBe(s.synonyms.length);
      expect(DREAM_CATEGORIES).toContain(s.category);
      expect(DREAM_TONES).toContain(s.tone);
      expect(s.keywords.length).toBeGreaterThanOrEqual(2);
      expect(s.keywords.length).toBeLessThanOrEqual(4);
      expect(s.keywords.every(nonEmpty)).toBe(true);
      expect(nonEmpty(s.meaning)).toBe(true);
    });
  }
});

describe("금지 표현 (docs/04 §7 v1)", () => {
  it("검사 정규식이 실제로 걸러 낸다", () => {
    expect(bannedHits("액운이 꼈어요")).not.toEqual([]);
    expect(bannedHits("부적을 사세요")).not.toEqual([]);
    expect(bannedHits("곧 죽는다")).not.toEqual([]);
    expect(bannedHits("코인은 지금 사야 한다")).toEqual(["투자 단정"]);
    expect(bannedHits("주식은 오늘 팔아야 돼")).toEqual(["투자 단정"]);
    expect(bannedHits("떡을 사면 돼")).toEqual([]);
    expect(bannedHits("돼지는 복을 뜻해요")).toEqual([]);
  });

  it("타로 의미표와 꿈 사전의 모든 문장에 금지 표현이 없다", () => {
    const strings: { path: string; text: string }[] = [];
    collectStrings(tarot, "tarot", strings);
    collectStrings(dream, "dream", strings);
    const violations = strings
      .map(({ path, text }) => ({ path, text, hits: bannedHits(text) }))
      .filter((v) => v.hits.length > 0);
    expect(violations).toEqual([]);
  });
});
