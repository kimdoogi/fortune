import { describe, expect, it } from "vitest";
import { fillTemplate, findBanned, greetings, hasFinalConsonant } from "../src/index";

describe("findBanned (docs/04 §7)", () => {
  it("불안 조장·예언 표현을 잡는다", () => {
    expect(findBanned("올해는 액운이 꼈으니 부적을 사세요")).toEqual(["액운", "부적"]);
    expect(findBanned("이대로면 큰일 난다")).toEqual(["큰일 난다"]);
    expect(findBanned("반드시 헤어지게 됩니다")).toEqual(["반드시 망·실패·헤어"]);
  });

  it("투자 단정은 동사와 대상 단어가 같이 있을 때만", () => {
    expect(findBanned("이번 달에 코인을 사야 해요")).toEqual(["투자 단정"]);
    expect(findBanned("마음에 드는 옷을 사야 해요")).toEqual([]);
    expect(findBanned("주식 이야기는 전문가와 상의해요")).toEqual([]);
  });

  it("평범한 풀이 문장은 통과", () => {
    expect(findBanned("죽음 카드는 끝이 아니라 새로운 시작을 뜻해요")).toEqual([]);
    expect(findBanned("오늘은 차분하게 정리하기 좋은 날이에요")).toEqual([]);
  });
});

describe("fillTemplate (04a 호격 조사)", () => {
  it("받침을 본다", () => {
    expect(hasFinalConsonant("민준")).toBe(true);
    expect(hasFinalConsonant("하나")).toBe(false);
    expect(hasFinalConsonant("Tom")).toBe(false);
  });

  it("아/야를 받침에 맞게 고친다", () => {
    expect(fillTemplate("딸랑딸랑! {닉네임}아, 왔구나!", "민준")).toBe("딸랑딸랑! 민준아, 왔구나!");
    expect(fillTemplate("딸랑딸랑! {닉네임}아, 왔구나!", "하나")).toBe("딸랑딸랑! 하나야, 왔구나!");
    expect(fillTemplate("{닉네임} 님, 어서 와요", "하나")).toBe("하나 님, 어서 와요");
  });

  it("인사말 전체에 금지 표현이 없고, 닉네임 자리가 모두 채워진다", () => {
    const all = Object.values(greetings).flatMap((g) => Object.values(g).flat());
    for (const line of all) {
      expect(findBanned(line)).toEqual([]);
      expect(fillTemplate(line, "하나")).not.toContain("{");
    }
  });
});
