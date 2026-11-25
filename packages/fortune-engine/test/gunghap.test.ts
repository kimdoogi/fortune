import { describe, expect, it } from "vitest";
import { BRANCH_ANIMAL, computePillars, gunghap } from "../src";

const p = (date: string, time: string | null = "12:00") =>
  computePillars({ calendar: "solar", date, time }).pillars;

describe("궁합 (02 §5-9, D-089)", () => {
  it("점수는 35~98, 등급은 점수와 맞고, 요인마다 점수 부호와 good이 맞다", () => {
    const dates = [
      "1990-01-15",
      "1994-03-15",
      "1996-02-14",
      "1999-07-21",
      "1984-02-04",
      "2001-11-30",
    ];
    for (const x of dates) {
      for (const y of dates) {
        const r = gunghap(p(x), p(y));
        expect(r.score).toBeGreaterThanOrEqual(35);
        expect(r.score).toBeLessThanOrEqual(98);
        const want =
          r.score >= 85
            ? "천생연분"
            : r.score >= 72
              ? "잘 맞는 사이"
              : r.score >= 58
                ? "맞춰 가면 좋은 사이"
                : "부딪히며 크는 사이";
        expect(r.label).toBe(want);
        for (const f of r.factors) expect(f.good).toBe(f.points >= 0);
      }
    }
  });

  it("같은 원국끼리는 같은 오행·같은 띠", () => {
    const r = gunghap(p("1994-03-15"), p("1994-03-15"));
    expect(r.factors.map((f) => f.kind)).toEqual(
      expect.arrayContaining(["element_same", "zodiac_same"]),
    );
  });

  it("띠 육합·충·삼합·원진을 가린다", () => {
    // 1996 병자(쥐) · 1997 정축(소): 자축 육합
    expect(
      gunghap(p("1996-06-01"), p("1997-06-01")).factors.some((f) => f.kind === "zodiac_hap"),
    ).toBe(true);
    // 1996 쥐 · 1990 경오(말): 자오 충
    expect(
      gunghap(p("1996-06-01"), p("1990-06-01")).factors.some((f) => f.kind === "zodiac_chung"),
    ).toBe(true);
    // 1996 쥐 · 2000 경진(용): 신자진 삼합
    expect(
      gunghap(p("1996-06-01"), p("2000-06-01")).factors.some((f) => f.kind === "zodiac_samhap"),
    ).toBe(true);
    // 1996 쥐 · 1991 신미(양): 자미 원진
    expect(
      gunghap(p("1996-06-01"), p("1991-06-01")).factors.some((f) => f.kind === "zodiac_wonjin"),
    ).toBe(true);
    expect(BRANCH_ANIMAL.자).toBe("쥐");
  });

  it("순서를 바꿔도 점수는 같다", () => {
    const a = p("1990-01-15");
    const b = p("1999-07-21");
    expect(gunghap(a, b).score).toBe(gunghap(b, a).score);
  });
});
