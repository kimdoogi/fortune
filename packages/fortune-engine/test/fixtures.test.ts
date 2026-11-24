/**
 * docs/02a 사주 테스트 케이스 (tests/fixtures/saju/cases.json) 전부를 엔진에 돌린다.
 * 음력 케이스는 엔진에 들어 있는 KASI 음력표(data/lunar.json)로 변환한다.
 */
import { describe, expect, it } from "vitest";
import cases from "../../../tests/fixtures/saju/cases.json";
import { type BirthInput, SajuError, computePillars, iljin } from "../src";

interface Case {
  id: string;
  category: string;
  input: { calendar: "solar" | "lunar"; date: string; time: string | null; isLeapMonth: boolean };
  expected: null | {
    referenceTime: string | null;
    solarDate: string | null;
    pillars: { year: string | null; month: string | null; day: string; hour: string | null } | null;
    flags: { solarTermDay: boolean; ambiguousTime: boolean };
    error: string | null;
  };
  check: string;
}

const all = (cases as { cases: Case[] }).cases;

describe("사주 fixture (docs/02a)", () => {
  it("129건이 모두 있다", () => {
    expect(all).toHaveLength(129);
  });

  for (const c of all) {
    const title = `${c.id} ${c.input.date} ${c.input.time ?? "시간 모름"} — ${c.check}`;
    const exp = c.expected;
    if (!exp) {
      it.todo(title);
      continue;
    }
    it(title, () => {
      const run = () => {
        if (c.category === "iljin" || (c.category === "range" && c.check.startsWith("일진"))) {
          return { iljin: iljin(c.input.date) };
        }
        const input: BirthInput = { ...c.input };
        return computePillars(input);
      };
      if (exp.error) {
        expect(run).toThrow(SajuError);
        try {
          run();
        } catch (e) {
          expect((e as SajuError).code).toBe(exp.error);
        }
        return;
      }
      const out = run();
      if ("iljin" in out) {
        expect(out.iljin).toBe(exp.pillars?.day);
        return;
      }
      expect(out.solarDate).toBe(exp.solarDate);
      expect(out.referenceTime).toBe(exp.referenceTime);
      expect(out.pillars).toEqual(exp.pillars);
      expect(out.flags).toEqual(exp.flags);
    });
  }
});
