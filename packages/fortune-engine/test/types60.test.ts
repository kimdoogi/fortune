import { describe, expect, it } from "vitest";
import {
  TYPES_60,
  allTypeMatches,
  bestAndWorst,
  typeInfo,
  typeKey,
  typeMatch,
} from "../src/types60";

describe("60유형 (02 §5-10, D-101)", () => {
  it("오행 5 × 무리 6 × 세기 2 = 60, 이름이 모두 다르다", () => {
    expect(TYPES_60).toHaveLength(60);
    const names = TYPES_60.map((t) => typeInfo(t).name);
    expect(new Set(names).size).toBe(60);
    expect(typeInfo("fire-self-soft").name).toBe("다정한 강아지");
    expect(typeInfo("metal-duty-soft").name).toBe("깔끔한 펭귄");
    expect(typeInfo("water-mind-strong").tagline).toBe(
      "차분하고 생각이 깊어서 생각하고 배우며 길을 찾는 사람",
    );
  });

  it("결과로 유형 정하기: 많은 기운이 없으면 고른 편, 비율 0.5 이상이면 센 편", () => {
    expect(typeKey("화", "비겁", 0.4)).toBe("fire-self-soft");
    expect(typeKey("목", "인성", 0.63)).toBe("wood-mind-strong");
    expect(typeKey("수", null, 0.5)).toBe("water-even-strong");
  });

  it("손으로 계산한 예", () => {
    // 불·나무 상생 +12, 센·여린 +10, 비겁·식상 이웃 +8 → 90 찰떡
    const m = typeMatch("fire-self-strong", "wood-expr-soft");
    expect(m.score).toBe(90);
    expect(m.label).toBe("찰떡");
    // 불·쇠 상극 −8, 둘 다 센 −6, 비겁·재성 한 칸 건너 −8 → 38 부딪힘
    expect(typeMatch("fire-self-strong", "metal-wealth-strong")).toMatchObject({
      score: 38,
      label: "부딪힘",
    });
    // 고른 편은 무리 요인 없음
    expect(typeMatch("earth-even-soft", "earth-mind-soft").factors.map((f) => f.kind)).toEqual([
      "element_same",
      "strength_soft",
    ]);
  });

  it("맞음은 대칭, 잘 맞는·안 맞는 3개씩에서 나는 빠진다", () => {
    for (const a of TYPES_60) {
      for (const b of TYPES_60) expect(typeMatch(a, b).score).toBe(typeMatch(b, a).score);
      const { best, worst } = bestAndWorst(a);
      expect(best).toHaveLength(3);
      expect(worst).toHaveLength(3);
      for (const x of [...best, ...worst]) expect(x.type).not.toBe(a);
      expect((best[0]?.score ?? 0) > (worst[0]?.score ?? 0)).toBe(true);
    }
    expect(allTypeMatches(TYPES_60[0] as string)).toHaveLength(60);
  });
});
