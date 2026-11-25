import {
  STEMS,
  analyzePillars,
  computeDaewoon,
  computePillars,
  sewoonOfYear,
} from "@fortune/fortune-engine";
import { findBanned } from "@fortune/prompts";
import type { DolyeongCategory, TarotCategory } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
import { DREAM, DREAM_SYMBOL_IDS, TAROT } from "../src/facts/data";
import { buildDream, knownSymbolIds } from "../src/facts/dream";
import { buildObanggi } from "../src/facts/obanggi";
import { buildDaily, buildSajuFull } from "../src/facts/saju";
import { buildTarot } from "../src/facts/tarot";
import { decodeCursor, encodeCursor } from "../src/readings/history";
import { FLAG_COLORS } from "../src/seed";

function expectClean(facts: string[]) {
  expect(facts.length).toBeGreaterThan(0);
  for (const f of facts) {
    expect(f.trim().length).toBeGreaterThan(0);
    expect(f).not.toContain("undefined");
    expect(findBanned(f), f).toEqual([]);
  }
}

describe("사주 facts", () => {
  const cases = [
    { calendar: "solar", date: "1996-02-14", time: "07:30", gender: "female" },
    { calendar: "solar", date: "1984-02-04", time: null, gender: "male" },
    { calendar: "lunar", date: "1970-08-15", time: "23:40", gender: "male" },
    { calendar: "solar", date: "2010-06-01", time: "12:00", gender: "female" },
  ] as const;

  it.each(cases)("$date $time", (c) => {
    const natal = computePillars({ calendar: c.calendar, date: c.date, time: c.time });
    const a = analyzePillars(natal.pillars);
    const d = computeDaewoon(natal, c.gender, "2026-11-25", c.time === null);
    const s = sewoonOfYear(2026, natal.pillars);
    const parts = buildSajuFull(natal, a, d, s);
    expectClean(parts.facts);
    expect(parts.facts.some((f) => f.startsWith("행운의 색: "))).toBe(true);
    expect(parts.chart.hourUnknown).toBe(c.time === null);
    expect(parts.board.pillars.hour).toBe(natal.pillars.hour);
    expect((parts.luck.sewoon as { pillar: string }).pillar).toBe("병오");
  });

  it.each([...STEMS])("오늘의 운세 일간 %s", (stem) => {
    const parts = buildDaily(stem, "병오");
    expectClean(parts.facts);
    expect(parts.facts).toHaveLength(3);
  });
});

describe("타로 facts", () => {
  const categories: TarotCategory[] = ["연애", "재물", "직장", "오늘"];
  it("22장 × 정·역 × 카테고리 모두 깨끗하다", () => {
    for (const card of TAROT) {
      for (const reversed of [false, true]) {
        for (const category of categories) {
          const parts = buildTarot([{ position: "오늘", id: card.id, reversed }], category);
          expectClean(parts.facts);
          expect(parts.cards[0]).toEqual({ position: "오늘", card: card.name, reversed });
        }
      }
    }
  });
});

describe("오방기 facts", () => {
  const categories: DolyeongCategory[] = ["연애", "재물", "직장", "건강", "기타"];
  it("다섯 색 × 카테고리", () => {
    for (const color of FLAG_COLORS) {
      for (const category of categories) {
        const parts = buildObanggi(color, category);
        expectClean(parts.facts);
        expect(parts.facts).toHaveLength(3);
        expect(parts.flag.color).toBe(color);
      }
    }
  });
});

describe("꿈 facts", () => {
  it("사전 150개 상징", () => {
    expect(DREAM_SYMBOL_IDS).toHaveLength(150);
    for (const s of DREAM) expectClean(buildDream([s.id]).facts);
  });

  it("없는 ID는 버리고 중복은 한 번만", () => {
    expect(knownSymbolIds(["pig", "nope", "pig", "dragon"])).toEqual(["pig", "dragon"]);
    const parts = buildDream(["pig", "nope"]);
    expect(parts.symbols.map((s) => s.id)).toEqual(["pig"]);
    expect(parts.symbols[0]?.meaning.length).toBeGreaterThan(0);
  });
});

describe("기록 커서", () => {
  it("왕복", () => {
    const c = encodeCursor("2026-11-25T03:00:00.000Z", "abc");
    expect(decodeCursor(c)).toEqual(["2026-11-25T03:00:00.000Z", "abc"]);
    expect(decodeCursor("!!!")).toBeNull();
    expect(decodeCursor(btoa("[1,2]"))).toBeNull();
  });
});
