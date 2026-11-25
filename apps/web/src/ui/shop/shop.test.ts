import { describe, expect, it } from "vitest";
import { ApiFailure } from "../../api/client";
import { CHARACTERS } from "./characters";
import { describeFailure } from "./errors";
import { atLeast, birthLine, dailyDateLabel, fanAngles, josaA } from "./helpers";

describe("오류 → 캐릭터 대사 (04 §9)", () => {
  it("하루 상한은 서버 문장을 그대로, 다시 해 보기 없음", () => {
    const f = describeFailure(
      "saju",
      new ApiFailure("DAILY_LIMIT", "내일 다시 오시오.", 429),
      "하늘",
    );
    expect(f).toEqual({ line: "내일 다시 오시오.", retry: false });
  });

  it("하루 상한 문장이 비면 미리 써 둔 대사 (닉네임 채움)", () => {
    const f = describeFailure("dolyeong", new ApiFailure("DAILY_LIMIT", "", 429), "민준", 0);
    expect(f.line).toBe("으음, 오늘은 깃발 다 뽑았어. 내일 또 와!");
  });

  it("LLM 실패는 대체 문장 + 다시 해 보기", () => {
    const f = describeFailure("tarot", new ApiFailure("LLM_UNAVAILABLE", "", 503), "하늘");
    expect(f).toEqual({ line: CHARACTERS.tarot.fallback, retry: true });
  });

  it("위기는 위기 안내로", () => {
    expect(describeFailure("dream", new ApiFailure("CRISIS", "", 400), "하늘").crisis).toBe(true);
  });

  it("코드는 문장에 나오지 않는다", () => {
    for (const code of ["NETWORK", "UNAUTHORIZED", "PROFILE_REQUIRED"] as const) {
      const f = describeFailure("saju", new ApiFailure(code, "", 0), "하늘");
      expect(f.line).not.toMatch(/[A-Z_]{4,}/);
    }
    expect(describeFailure("saju", new Error("x"), "하늘").line).toBe(CHARACTERS.saju.fallback);
  });
});

describe("작은 도우미", () => {
  it("부채꼴 각도는 가운데가 0, 양 끝이 ±절반", () => {
    const a = fanAngles(22, 76);
    expect(a).toHaveLength(22);
    expect(a[0]).toBe(-38);
    expect(a[21]).toBe(38);
    expect(fanAngles(1, 76)).toEqual([0]);
  });

  it("아기도령 호칭", () => {
    expect(josaA("민준")).toBe("아");
    expect(josaA("하늘")).toBe("아");
    expect(josaA("하나")).toBe("야");
  });

  it("태어난 날 한 줄", () => {
    const base = { birthDate: "1996-03-12", calendar: "solar" as const, isLeapMonth: false };
    expect(birthLine({ ...base, birthTime: { kind: "clock", hour: 14, minute: 30 } })).toBe(
      "1996년 3월 12일 양력 · 오후 2시 30분",
    );
    expect(
      birthLine({ ...base, calendar: "lunar", isLeapMonth: true, birthTime: { kind: "unknown" } }),
    ).toBe("1996년 3월 12일 음력 윤달 · 태어난 시간 모름");
    expect(birthLine({ ...base, birthTime: { kind: "branch", branch: "자" } })).toBe(
      "1996년 3월 12일 양력 · 자시",
    );
    expect(birthLine({ ...base, birthTime: { kind: "clock", hour: 0, minute: 0 } })).toBe(
      "1996년 3월 12일 양력 · 오전 12시",
    );
  });

  it("오늘의 운세 날짜", () => {
    expect(dailyDateLabel("2026-11-25")).toBe("11월 25일 수요일");
  });

  it("연출 최소 시간을 지킨다", async () => {
    const t = Date.now();
    await expect(atLeast(Promise.resolve(1), 50)).resolves.toBe(1);
    expect(Date.now() - t).toBeGreaterThanOrEqual(45);
    await expect(atLeast(Promise.reject(new Error("x")), 10)).rejects.toThrow("x");
  });
});
