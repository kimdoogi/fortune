import { findBanned } from "@fortune/prompts";
import { WISH_COLORS } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
import { BLESSINGS, checkWish } from "../src/wishes";

describe("당산나무 소원 글 검사 (F18)", () => {
  it("보통 소원은 통과", () => {
    expect(checkWish("올해는 꼭 운전면허 따기")).toBeNull();
    expect(checkWish("가족 모두 건강하게")).toBeNull();
  });

  it("빈 글·긴 글·개인정보는 막는다", () => {
    expect(checkWish("   ")).toBe("EMPTY");
    expect(checkWish("가".repeat(41))).toBe("TOO_LONG");
    expect(checkWish("010-1234-5678로 연락 오게")).toBe("PII");
  });

  it("위기 낱말은 저장하지 않고 위기 안내", () => {
    expect(checkWish("그냥 죽고 싶어")).toBe("CRISIS");
    expect(checkWish("사라지고  싶다")).toBe("CRISIS");
  });

  it("덕담은 색마다 있고 금지 표현이 없다", () => {
    for (const c of WISH_COLORS) {
      expect(BLESSINGS[c].length).toBeGreaterThan(1);
      for (const line of BLESSINGS[c]) expect(findBanned(line)).toEqual([]);
    }
  });
});
