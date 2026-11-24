import { describe, expect, it } from "vitest";
import { FIRST_LUNAR_YEAR, LAST_LUNAR_YEAR, lunarMonths, lunarToSolar } from "../src/lunar";

describe("음력표 (data/lunar.json)", () => {
  it("1919~2050년을 덮는다", () => {
    expect(FIRST_LUNAR_YEAR).toBeLessThanOrEqual(1919);
    expect(LAST_LUNAR_YEAR).toBeGreaterThanOrEqual(2049);
  });

  it("해마다 12달 또는 13달, 길이는 29·30일", () => {
    for (let y = FIRST_LUNAR_YEAR; y <= LAST_LUNAR_YEAR; y++) {
      const ms = lunarMonths(y);
      expect([12, 13]).toContain(ms.length);
      for (const m of ms) expect([29, 30]).toContain(m.days);
    }
  });

  it("다음 해 1월 1일은 올해 마지막 날의 다음 날이다", () => {
    for (let y = FIRST_LUNAR_YEAR; y < LAST_LUNAR_YEAR; y++) {
      const ms = lunarMonths(y);
      const last = ms.at(-1);
      if (!last) throw new Error("no months");
      const end = lunarToSolar(y, last.month, last.days, last.leap) as string;
      const next = lunarToSolar(y + 1, 1, 1, false) as string;
      const diff = (Date.parse(next) - Date.parse(end)) / 86_400_000;
      expect(diff, `${y}`).toBe(1);
    }
  });

  it("KASI 변환 예시와 같다", () => {
    expect(lunarToSolar(1925, 1, 1, false)).toBe("1925-01-24");
    expect(lunarToSolar(1984, 1, 15, false)).toBe("1984-02-16");
    expect(lunarToSolar(2010, 12, 30, false)).toBe("2011-02-02");
    expect(lunarToSolar(1995, 8, 10, true)).toBe("1995-10-04");
    expect(lunarToSolar(2012, 3, 10, true)).toBe("2012-04-30");
    expect(lunarToSolar(1990, 1, 10, true)).toBeNull(); // 1990년에는 윤1월이 없다
    expect(lunarToSolar(2012, 2, 30, false)).toBeNull(); // 2012년 2월은 작은달
  });

  // KASI 양력→음력(/life/solc)으로 뽑은 무작위 40일. 표는 /life/lunc에서 만들었으므로 다른 경로로 확인하는 셈
  it("KASI 양력→음력 무작위 40일과 맞는다", () => {
    const samples: [string, string][] = [
      ["2036-11-12", "2036-09-25"],
      ["1927-06-06", "1927-05-07"],
      ["1999-09-10", "1999-08-01"],
      ["1959-05-05", "1959-03-28"],
      ["1975-07-11", "1975-06-03"],
      ["1972-09-12", "1972-08-05"],
      ["1994-01-29", "1993-12-18"],
      ["2012-04-05", "2012-03-15"],
      ["2032-05-01", "2032-03-22"],
      ["1928-12-02", "1928-10-21"],
      ["1933-03-28", "1933-03-03"],
      ["2008-05-17", "2008-04-13"],
      ["2022-12-18", "2022-11-25"],
      ["1945-01-21", "1944-12-08"],
      ["2049-08-29", "2049-08-02"],
      ["2049-10-28", "2049-10-02"],
      ["2043-02-06", "2042-12-27"],
      ["2022-01-22", "2021-12-20"],
      ["2047-09-17", "2047-07-28"],
      ["2026-08-22", "2026-07-10"],
      ["1954-06-05", "1954-05-05"],
      ["2018-06-21", "2018-05-08"],
      ["1955-12-26", "1955-11-13"],
      ["1929-05-09", "1929-04-01"],
      ["2014-02-14", "2014-01-15"],
      ["1930-01-26", "1929-12-27"],
      ["2016-12-24", "2016-11-26"],
      ["1996-09-24", "1996-08-12"],
      ["1943-06-15", "1943-05-13"],
      ["1978-08-27", "1978-07-24"],
      ["2024-07-15", "2024-06-10"],
      ["1953-04-13", "1953-02-30"],
      ["1930-02-20", "1930-01-22"],
      ["2019-04-27", "2019-03-23"],
      ["1961-10-16", "1961-09-07"],
      ["2034-02-27", "2034-01-09"],
      ["1936-05-27", "1936-04-07"],
      ["1965-08-01", "1965-07-05"],
      ["1928-11-07", "1928-09-25"],
      ["1976-03-09", "1976-02-09"],
    ];
    for (const [solar, lunar] of samples) {
      const leap = lunar.endsWith("L");
      const [y, m, d] = lunar.replace("L", "").split("-").map(Number) as [number, number, number];
      expect(lunarToSolar(y, m, d, leap), lunar).toBe(solar);
    }
  });
});
