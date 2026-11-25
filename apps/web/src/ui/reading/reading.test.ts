import { describe, expect, it } from "vitest";
import { SECTION_ORDER, colorSwatch, orderedSections, pillarInfo } from "./format";
import { EMBLEMS, TAROT_NAMES, toRoman } from "./tarotArt";
import { PUNCT_PAUSE, blockCount, buildTimeline, charDelay, countAt, splitChars } from "./typing";
import { iconKind } from "./visuals";

describe("한 글자씩 (D-044)", () => {
  it("한글 음절·이모지를 한 글자로 센다", () => {
    expect(splitChars("갑목🌙")).toEqual(["갑", "목", "🌙"]);
  });

  it("문장 끝에서 숨을 고른다", () => {
    expect(charDelay(".", 20)).toBe(20 + PUNCT_PAUSE);
    expect(charDelay("가", 20)).toBe(20);
  });

  it("덩어리를 이어서 친다", () => {
    const tl = buildTimeline(
      [
        { text: "가나", ms: 10 },
        { text: "다", ms: 10 },
      ],
      100,
    );
    expect(tl.times).toEqual([0, 10, 120]);
    expect(tl.offsets).toEqual([0, 2]);
    expect(tl.total).toBe(130);
    expect(countAt(tl.times, 0)).toBe(1);
    expect(countAt(tl.times, 50)).toBe(2);
    expect(countAt(tl.times, 120)).toBe(3);
    expect(countAt(tl.times, Number.POSITIVE_INFINITY)).toBe(3);
    expect(blockCount(tl, 0, 3)).toBe(2);
    expect(blockCount(tl, 1, 2)).toBe(0);
    expect(blockCount(tl, 1, 3)).toBe(1);
  });

  it("빈 덩어리는 쉬는 시간을 더하지 않는다", () => {
    const tl = buildTimeline(
      [
        { text: "가", ms: 10 },
        { text: "", ms: 10 },
      ],
      100,
    );
    expect(tl.total).toBe(10);
  });
});

describe("섹션 순서 (04 §4)", () => {
  it("상품 순서대로, 모르는 키는 뒤에, 빈 섹션은 뺀다", () => {
    const s = orderedSections("tarot_three", {
      future: "c",
      extra: "x",
      past: "a",
      present: " ",
      advice: "d",
    });
    expect(s.map((x) => x.key)).toEqual(["past", "future", "advice", "extra"]);
    expect(s[0]?.title).toBe("과거");
  });

  it("사주 정밀은 9섹션", () => {
    expect(SECTION_ORDER.saju_full).toHaveLength(9);
  });
});

describe("간지·색", () => {
  it("기둥을 한자·오행으로", () => {
    const [s, b] = pillarInfo("갑자");
    expect(s).toEqual({ ko: "갑", hanja: "甲", element: "목" });
    expect(b).toEqual({ ko: "자", hanja: "子", element: "수" });
    expect(pillarInfo("무술")[1].element).toBe("토");
  });

  it("행운의 색 이름을 견본으로", () => {
    expect(colorSwatch("청록")).toBe("#2f8f86");
    expect(colorSwatch("남색")).toBe("#2b3a78");
    expect(colorSwatch("빨간색")).toBe("#c8372d");
    expect(colorSwatch("알 수 없는 색")).toBe("#f2d38a");
  });

  it("꿈 상징 아이콘 묶음", () => {
    expect(iconKind("pig")).toBe("animal");
    expect(iconKind("water")).toBe("water");
    expect(iconKind("unknown_id")).toBe("moon");
  });
});

describe("타로 카드 그림 (D-030)", () => {
  it("메이저 아르카나 0~21 모두 이름과 상징이 있다", () => {
    expect(TAROT_NAMES).toHaveLength(22);
    expect(EMBLEMS).toHaveLength(22);
    for (let i = 0; i < 22; i++) {
      const Emblem = EMBLEMS[i];
      expect(Emblem, `카드 ${i}`).toBeTypeOf("function");
      expect(Emblem?.()).toBeTruthy();
    }
  });

  it("로마 숫자", () => {
    expect(toRoman(0)).toBe("0");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
    expect(toRoman(14)).toBe("XIV");
    expect(toRoman(19)).toBe("XIX");
    expect(toRoman(21)).toBe("XXI");
  });
});
