import { describe, expect, it } from "vitest";
import { filterDream, hasPii } from "../src/filters";

describe("개인정보 패턴", () => {
  it.each([
    "내 번호는 010-1234-5678이야",
    "01012345678로 연락해",
    "010 1234 5678",
    "02-123-4567",
    "주민번호 900101-1234567",
    "9001011234567",
    "mail me at dream@example.com",
    "계좌 110-123-456789",
    "１２３４５６７８９０１２",
  ])("걸린다: %s", (t) => {
    expect(hasPii(t)).toBe(true);
  });

  it.each([
    "돼지 세 마리가 집에 들어왔어",
    "2024-10-12에 꾼 꿈",
    "10층 건물에서 떨어졌어",
    "새벽 3시 반에 깼어",
  ])("통과: %s", (t) => {
    expect(hasPii(t)).toBe(false);
  });
});

describe("꿈 1차 필터", () => {
  it("빈 글", () => expect(filterDream("   ")).toBe("EMPTY"));
  it("300자 초과", () => {
    expect(filterDream("가".repeat(300))).toBeNull();
    expect(filterDream("가".repeat(301))).toBe("TOO_LONG");
  });
  it("개인정보", () => expect(filterDream("010-1234-5678 꿈")).toBe("PII"));
  it("금지 표현", () => expect(filterDream("부적을 받는 꿈을 꿨어")).toBe("BANNED"));
  it("보통 꿈은 통과", () => expect(filterDream("돼지를 품에 안았어")).toBeNull());
});
