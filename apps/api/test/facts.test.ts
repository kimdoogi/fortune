import {
  STEMS,
  analyzePillars,
  computeDaewoon,
  computePillars,
  monthlyLuck,
  sewoonOfYear,
} from "@fortune/fortune-engine";
import { findBanned } from "@fortune/prompts";
import type { DolyeongCategory, TarotCategory } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
import { DREAM, DREAM_SYMBOL_IDS, OBANGGI, TAROT } from "../src/facts/data";
import { buildDream, knownSymbolIds } from "../src/facts/dream";
import { buildNature, natureGroups } from "../src/facts/nature";
import { buildObanggi } from "../src/facts/obanggi";
import { buildDaily, buildSajuFull } from "../src/facts/saju";
import { buildTarot } from "../src/facts/tarot";
import { decodeCursor, encodeCursor } from "../src/readings/history";
import { applyMark } from "../src/readings/marks";
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
    const months = monthlyLuck(natal.pillars, a.yongsin, "2026-11");
    const next = sewoonOfYear(2027, natal.pillars);
    const parts = buildSajuFull(natal, a, d, s, months, next);
    expectClean(parts.facts);
    // 월별 운세 (D-079): 좋은 달·조심할 달 문장이 2~3개씩, 화면 띠는 12달
    expect(parts.facts.filter((f) => f.startsWith("좋은 달 ")).length).toBeGreaterThanOrEqual(2);
    expect(parts.facts.filter((f) => f.startsWith("조심할 달 ")).length).toBeGreaterThanOrEqual(2);
    expect(parts.facts.some((f) => f.startsWith("내년 2027년 세운은 정미"))).toBe(true);
    expect(parts.board.months).toHaveLength(12);
    for (const f of parts.facts.filter((x) => x.startsWith("조심할 달 "))) {
      expect(f).toContain("조심할 일: ");
    }
    expect(parts.facts.some((f) => f.startsWith("행운의 색: "))).toBe(true);
    expect(parts.chart.hourUnknown).toBe(c.time === null);
    expect(parts.board.pillars.hour).toBe(natal.pillars.hour);
    expect((parts.luck.sewoon as { pillar: string }).pillar).toBe("병오");
  });

  it.each([...STEMS])("오늘의 운세 일간 %s", (stem) => {
    const parts = buildDaily(stem, "병오", "2026-11-25");
    expectClean(parts.facts);
    expect(parts.facts).toHaveLength(5);
    expect(parts.score).toBeGreaterThanOrEqual(40);
    expect(parts.luckyNumbers).toHaveLength(2);
    expect(parts.facts.some((f) => f.startsWith(`오늘 운세 점수: ${parts.score}점`))).toBe(true);
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

describe("신점 쌀점과 숨은 점괘 (F07, D-087)", () => {
  it("띠·쌀점·깃발 뜻이 facts에 들어가고 카테고리 줄은 없다", async () => {
    const { buildSinjeom } = await import("../src/facts/obanggi");
    const p = buildSinjeom("노랑", { count: 9, grade: "길" }, "호랑이");
    expect(p.facts).toHaveLength(3);
    expect(p.facts[0]).toContain("호랑이띠");
    expect(p.facts[1]).toContain("쌀알 9개");
    expect(p.facts[2]).toContain("노랑 기운");
    expect(p.rice).toEqual({ count: 9, grade: "길" });
    expectClean(p.facts);
  });

  it("쌀알 수는 1~10, 등급은 홀수 좋음·7 최고·짝수 조심, 깃발은 같은 등급", async () => {
    const { throwRice, riceGrade, flagForGrade, FLAG_GRADE, RICE_WEIGHTS, rngFor } = await import(
      "../src/seed"
    );
    expect(Object.values(RICE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(riceGrade(7)).toBe("대길");
    expect(riceGrade(9)).toBe("길");
    expect(riceGrade(3)).toBe("길");
    expect(riceGrade(5)).toBe("평");
    expect(riceGrade(1)).toBe("평");
    for (const n of [2, 4, 6, 8, 10]) expect(riceGrade(n)).toBe("주의");
    // obanggi.json 등급과 같다
    for (const [color, grade] of Object.entries(FLAG_GRADE)) {
      expect(OBANGGI[color as keyof typeof OBANGGI].grade).toBe(grade);
    }
    const rng = await rngFor("user", "sinjeom:2026-11-25");
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const r = throwRice(rng);
      expect(r.count).toBeGreaterThanOrEqual(1);
      expect(r.count).toBeLessThanOrEqual(10);
      seen.add(r.count);
      expect(FLAG_GRADE[flagForGrade(r.grade, rng)]).toBe(r.grade);
    }
    expect(seen.size).toBe(10);
  });
});

describe("점집별 부르는 말 (04 §3-1, D-088)", () => {
  it("타로는 님, 아기도령은 받침에 맞게 아/야, 사주는 그대, 꿈해몽은 아가", async () => {
    const { vocativeFor } = await import("../src/readings/build");
    expect(vocativeFor("tarot", "지또")).toBe("지또 님");
    expect(vocativeFor("dolyeong", "지또")).toBe("지또야");
    expect(vocativeFor("dolyeong", "민준")).toBe("민준아");
    expect(vocativeFor("saju", "지또")).toBe("그대");
    expect(vocativeFor("dream", "지또")).toBe("아가");
  });
});

describe("궁합 facts (F16, D-089)", () => {
  it("관계·두 사람 기운·점수·요인 문장이 들어가고 금지 표현이 없다", async () => {
    const { gunghap } = await import("@fortune/fortune-engine");
    const { buildGunghap } = await import("../src/facts/gunghap");
    const dates = ["1996-06-01", "1997-06-01", "1990-06-01", "2000-06-01", "1991-06-01"];
    for (const x of dates) {
      for (const y of dates) {
        const na = computePillars({ calendar: "solar", date: x, time: "09:00" });
        const nb = computePillars({ calendar: "solar", date: y, time: "21:00" });
        const r = gunghap(na.pillars, nb.pillars);
        const p = buildGunghap(
          { nickname: "하나", zodiac: "쥐", natal: na },
          { nickname: "준호", zodiac: "소", natal: nb },
          r,
          "연인",
        );
        expectClean(p.facts);
        expect(p.facts[0]).toBe("두 사람 사이: 연인.");
        expect(p.facts.some((f) => f.startsWith(`궁합 점수: ${r.score}점`))).toBe(true);
        expect(p.board.factors).toHaveLength(r.factors.length);
        expect(p.board.a.nickname).toBe("하나");
      }
    }
  });

  it("초대 코드는 헷갈리는 글자 없는 10자", async () => {
    const { newInviteCode } = await import("../src/gunghap/invites");
    for (let i = 0; i < 50; i++) expect(newInviteCode()).toMatch(/^[2-9a-hjkmnp-z]{10}$/);
  });
});

describe("족집게집 facts (F19)", () => {
  const cases = [
    { calendar: "solar", date: "1996-02-14", time: "07:30" },
    { calendar: "solar", date: "1984-02-04", time: null },
    { calendar: "lunar", date: "1970-08-15", time: "23:40" },
  ] as const;

  it.each(cases)("$date $time: 장면 여섯 칸과 무리", (c) => {
    const natal = computePillars({ calendar: c.calendar, date: c.date, time: c.time });
    const a = analyzePillars(natal.pillars);
    const parts = buildNature(natal, a);
    expectClean(parts.facts);
    expect(parts.facts.filter((f) => f.startsWith("생활 장면 — "))).toHaveLength(6);
    expect(parts.board.dayMaster).toEqual(a.dayMaster);
    expect(parts.board.hourUnknown).toBe(c.time === null);
    // 대운·세운은 넣지 않는다
    expect(parts.facts.join(" ")).not.toMatch(/대운|세운은|월운/);
  });

  it("십신 무리: 많은 무리는 2자리 이상, 같으면 월지 먼저, 없는 무리 전부", () => {
    const base = analyzePillars(
      computePillars({ calendar: "solar", date: "1996-02-14", time: null }).pillars,
    );
    const tenGods = {
      yearStem: "식신",
      yearBranch: "편재",
      monthStem: "상관",
      monthBranch: "정재",
      dayBranch: "비견",
      hourStem: null,
      hourBranch: null,
    } as const;
    const g = natureGroups({ ...base, tenGods });
    expect(g.counts).toEqual({ 비겁: 1, 식상: 2, 재성: 2, 관성: 0, 인성: 0 });
    expect(g.strong).toBe("재성");
    expect(g.absent).toEqual(["관성", "인성"]);
    const flat = natureGroups({
      ...base,
      tenGods: { ...tenGods, monthStem: "편관", monthBranch: "정인" },
    });
    expect(flat.strong).toBeNull();
  });

  it("맞아요/아니에요 표시는 바꾸고 지울 수 있다", () => {
    let m = applyMark({}, { section: "surface", mark: "yes" });
    m = applyMark(m, { section: "inner", mark: "no" });
    m = applyMark(m, { section: "surface", mark: "no" });
    expect(m).toEqual({ surface: "no", inner: "no" });
    expect(applyMark(m, { section: "inner", mark: null })).toEqual({ surface: "no" });
  });
});
