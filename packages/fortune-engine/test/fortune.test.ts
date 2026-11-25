import { describe, expect, it } from "vitest";
import {
  ELEMENTS,
  STEMS,
  analyzePillars,
  computePillars,
  controlledBy,
  dailyScore,
  ganzhiAt,
  luckyNumbers,
  monthlyLuck,
  withWa,
} from "../src";

const natal = computePillars({ calendar: "solar", date: "1994-03-15", time: "08:30" }).pillars;
const a = analyzePillars(natal);

describe("앞으로 12달 월운 등급 (02 §5-6-1, D-079)", () => {
  it("기신은 용신을 극하는 오행", () => {
    expect(controlledBy("토")).toBe("목");
    expect(controlledBy("금")).toBe("화");
    expect(controlledBy("목")).toBe("금");
  });

  it("12달이 해를 넘겨 이어지고, 15일 월주로 그 달을 대표한다", () => {
    const list = monthlyLuck(natal, a.yongsin, "2026-11");
    expect(list).toHaveLength(12);
    expect(list.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2026-11",
      "2026-12",
      "2027-1",
      "2027-2",
      "2027-3",
      "2027-4",
      "2027-5",
      "2027-6",
      "2027-7",
      "2027-8",
      "2027-9",
      "2027-10",
    ]);
    // 1월 15일은 축월(소한 뒤), 2월 15일은 인월(입춘 뒤)
    expect(list[2]?.pillar.charAt(1)).toBe("축");
    expect(list[3]?.pillar.charAt(1)).toBe("인");
    // 연주는 입춘에서 바뀐다
    expect(list[2]?.yearPillar).toBe(list[0]?.yearPillar);
    expect(list[3]?.yearPillar).not.toBe(list[0]?.yearPillar);
  });

  it("여러 원국에서 좋은 달·조심할 달이 2~3개씩, 겹치지 않는다", () => {
    for (let i = 0; i < 60; i += 7) {
      const gz = ganzhiAt(i);
      const p = { ...natal, day: gz };
      const y = analyzePillars(p).yongsin;
      const list = monthlyLuck(p, y, "2026-03");
      const good = list.filter((m) => m.grade === "good");
      const caution = list.filter((m) => m.grade === "caution");
      expect(good.length).toBeGreaterThanOrEqual(2);
      expect(good.length).toBeLessThanOrEqual(3);
      expect(caution.length).toBeGreaterThanOrEqual(2);
      expect(caution.length).toBeLessThanOrEqual(3);
      expect(Math.min(...good.map((m) => m.score))).toBeGreaterThanOrEqual(
        Math.max(...caution.map((m) => m.score)),
      );
    }
  });

  it("와/과를 받침에 맞춘다", () => {
    expect(withWa("연간")).toBe("연간과");
    expect(withWa("일지")).toBe("일지와");
  });

  it("점수 이유가 붙는다", () => {
    const list = monthlyLuck(natal, a.yongsin, "2026-01");
    for (const m of list.filter((x) => x.score !== 0)) expect(m.reasons.length).toBeGreaterThan(0);
  });
});

describe("오늘의 운세 점수·행운의 숫자 (02 §5-6-2, D-080)", () => {
  it("40~99, 같은 날 같은 일간이면 같은 점수, 등급이 점수와 맞다", () => {
    for (const stem of STEMS) {
      for (let i = 0; i < 60; i++) {
        const r = dailyScore(stem, ganzhiAt(i), "2026-11-25");
        expect(r.score).toBeGreaterThanOrEqual(40);
        expect(r.score).toBeLessThanOrEqual(99);
        expect(dailyScore(stem, ganzhiAt(i), "2026-11-25")).toEqual(r);
        const want =
          r.score >= 85 ? "아주 좋음" : r.score >= 70 ? "좋음" : r.score >= 55 ? "보통" : "조심";
        expect(r.label).toBe(want);
      }
    }
  });

  it("식신·정재 날이 편관 날보다 높다 (흔들림 제외)", () => {
    // 갑 일간: 병인일(식신·비견) vs 경신일(편관·편관)
    const good = dailyScore("갑", "병인", "2026-11-25").score;
    const bad = dailyScore("갑", "경신", "2026-11-25").score;
    expect(good).toBeGreaterThan(bad);
  });

  it("행운의 숫자는 일간을 생하는 오행의 하도수", () => {
    expect(luckyNumbers("갑")).toEqual([1, 6]); // 목 ← 수
    expect(luckyNumbers("병")).toEqual([3, 8]); // 화 ← 목
    expect(luckyNumbers("무")).toEqual([2, 7]); // 토 ← 화
    expect(luckyNumbers("경")).toEqual([5, 10]); // 금 ← 토
    expect(luckyNumbers("임")).toEqual([4, 9]); // 수 ← 금
    expect(ELEMENTS).toHaveLength(5);
  });
});
