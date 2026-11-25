import { describe, expect, it } from "vitest";
import { HttpError } from "../src/http";
import {
  ProfileSchema,
  ageBandAt,
  ageBandOf,
  birthTimeToClock,
  branchMiddleTime,
  natalOf,
} from "../src/profile";

describe("태어난 시간 변환 (F02)", () => {
  it("시·분", () => {
    expect(birthTimeToClock({ kind: "clock", hour: 7, minute: 5 })).toBe("07:05");
  });
  it("12지시는 가운데 시각", () => {
    expect(branchMiddleTime("자")).toBe("00:30");
    expect(branchMiddleTime("축")).toBe("02:30");
    expect(branchMiddleTime("오")).toBe("12:30");
    expect(branchMiddleTime("해")).toBe("22:30");
    expect(birthTimeToClock({ kind: "branch", branch: "묘" })).toBe("06:30");
  });
  it("모름은 null", () => {
    expect(birthTimeToClock({ kind: "unknown" })).toBeNull();
  });
});

describe("나이대 (F02, D-017)", () => {
  it.each([
    [13, null],
    [14, "10대"],
    [19, "10대"],
    [20, "20대"],
    [29, "20대"],
    [30, "30대"],
    [39, "30대"],
    [40, "40대 이상"],
    [90, "40대 이상"],
  ])("만 %i세 → %s", (age, band) => {
    expect(ageBandOf(age)).toBe(band);
  });

  const natal = (date: string) =>
    natalOf({
      calendar: "solar",
      birthDate: date,
      isLeapMonth: false,
      birthTime: { kind: "unknown" },
    });

  it("만 14세 생일 전날은 UNDER_14", () => {
    expect(() => ageBandAt(natal("2012-11-26"), "2026-11-25")).toThrowError(
      expect.objectContaining({ code: "UNDER_14" }),
    );
    expect(ageBandAt(natal("2012-11-25"), "2026-11-25")).toBe("10대");
  });
});

describe("생년월일 오류 안내 (F02)", () => {
  const code = (f: () => unknown) => {
    try {
      f();
    } catch (e) {
      return e instanceof HttpError ? e.code : "other";
    }
    return null;
  };
  const base = { isLeapMonth: false, birthTime: { kind: "unknown" } as const };

  it("없는 날짜", () => {
    expect(code(() => natalOf({ ...base, calendar: "solar", birthDate: "1990-02-30" }))).toBe(
      "INVALID_DATE",
    );
  });
  it("1920년 이전", () => {
    expect(code(() => natalOf({ ...base, calendar: "solar", birthDate: "1919-12-31" }))).toBe(
      "OUT_OF_RANGE",
    );
  });
  it("없는 윤달", () => {
    expect(
      code(() =>
        natalOf({ ...base, calendar: "lunar", birthDate: "2001-02-10", isLeapMonth: true }),
      ),
    ).toBe("NO_SUCH_LEAP_MONTH");
  });
});

describe("프로필 입력 검증", () => {
  const ok = {
    nickname: "  별빛  ",
    calendar: "solar",
    birthDate: "1996-02-14",
    isLeapMonth: false,
    birthTime: { kind: "branch", branch: "자" },
    gender: "female",
    consent: true,
  };
  it("통과하면 닉네임을 다듬는다", () => {
    const r = ProfileSchema.safeParse(ok);
    expect(r.success && r.data.nickname).toBe("별빛");
  });
  it("동의 없음, 짧은 닉네임, 잘못된 시각은 실패", () => {
    expect(ProfileSchema.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...ok, nickname: " 별 " }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...ok, nickname: "가".repeat(11) }).success).toBe(false);
    expect(
      ProfileSchema.safeParse({ ...ok, birthTime: { kind: "clock", hour: 24, minute: 0 } }).success,
    ).toBe(false);
  });
});
