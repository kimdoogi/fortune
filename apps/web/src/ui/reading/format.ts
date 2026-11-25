/**
 * 결과 화면에 쓰는 작은 순수 함수들: 섹션 순서(04 §4), 간지 한자·오행, 행운의 색 견본.
 */
import { type ProductId, SECTION_TITLES } from "@fortune/shared-types";

/** 상품별 섹션 순서 (04 §4 표 그대로) */
export const SECTION_ORDER: Record<ProductId, string[]> = {
  daily: ["overall", "tip"],
  saju_full: [
    "overall",
    "personality",
    "elements",
    "yongsin",
    "daewoon",
    "thisYear",
    "love",
    "money",
    "work",
  ],
  tarot_one: ["card", "message"],
  tarot_three: ["past", "present", "future", "advice"],
  obanggi: ["flag", "message", "advice"],
  dream: ["symbols", "meaning", "advice"],
};

export interface SectionView {
  key: string;
  title: string;
  text: string;
}

/** 정해진 순서대로, 표에 없는 키는 뒤에 붙인다. 빈 섹션은 뺀다 */
export function orderedSections(
  product: ProductId,
  sections: Record<string, string>,
): SectionView[] {
  const order = SECTION_ORDER[product] ?? [];
  const keys = [
    ...order.filter((k) => k in sections),
    ...Object.keys(sections).filter((k) => !order.includes(k)),
  ];
  return keys
    .map((key) => ({ key, title: SECTION_TITLES[key] ?? key, text: (sections[key] ?? "").trim() }))
    .filter((s) => s.text.length > 0);
}

export type Element = "목" | "화" | "토" | "금" | "수";
export const ELEMENTS: Element[] = ["목", "화", "토", "금", "수"];

/** 오행 색 (사주판·그래프 공통) */
export const ELEMENT_COLOR: Record<Element, string> = {
  목: "#5f9b57",
  화: "#d2553f",
  토: "#c79a3e",
  금: "#958d7a",
  수: "#3d63a3",
};

const STEMS = "갑을병정무기경신임계";
const STEM_HANJA = "甲乙丙丁戊己庚辛壬癸";
const STEM_ELEMENT: Element[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const BRANCHES = "자축인묘진사오미신유술해";
const BRANCH_HANJA = "子丑寅卯辰巳午未申酉戌亥";
const BRANCH_ELEMENT: Element[] = [
  "수",
  "토",
  "목",
  "목",
  "토",
  "화",
  "화",
  "토",
  "금",
  "금",
  "토",
  "수",
];

export interface GlyphInfo {
  ko: string;
  hanja: string;
  element: Element | null;
}

/** 천간 한 글자 → 한자·오행 */
export function stemInfo(ko: string): GlyphInfo {
  const i = STEMS.indexOf(ko);
  return {
    ko,
    hanja: i < 0 ? "" : (STEM_HANJA[i] ?? ""),
    element: i < 0 ? null : (STEM_ELEMENT[i] ?? null),
  };
}

/** 지지 한 글자 → 한자·오행 */
export function branchInfo(ko: string): GlyphInfo {
  const i = BRANCHES.indexOf(ko);
  return {
    ko,
    hanja: i < 0 ? "" : (BRANCH_HANJA[i] ?? ""),
    element: i < 0 ? null : (BRANCH_ELEMENT[i] ?? null),
  };
}

/** "갑자" → [천간, 지지] */
export function pillarInfo(pillar: string): [GlyphInfo, GlyphInfo] {
  const [s = "", b = ""] = Array.from(pillar);
  return [stemInfo(s), branchInfo(b)];
}

const SWATCHES: [RegExp, string][] = [
  [/청록|옥색|비취/, "#2f8f86"],
  [/남색|쪽빛|감색/, "#2b3a78"],
  [/하늘/, "#7fb2e0"],
  [/파랑|파란|푸른|청색|blue/i, "#3461a8"],
  [/연두/, "#9cc46a"],
  [/초록|녹색|푸르/, "#4f8a4a"],
  [/분홍|핑크|연분홍/, "#e48aa4"],
  [/주황|오렌지|살구/, "#e98a3c"],
  [/빨강|빨간|붉|적색|다홍/, "#c8372d"],
  [/금색|황금|금빛/, "#d4a93c"],
  [/노랑|노란|황색|겨자/, "#e2b33a"],
  [/보라|자주|라벤더/, "#6b4a9a"],
  [/은색|은빛|회색|잿빛/, "#b9bcc4"],
  [/갈색|밤색|흙색|황토/, "#8a5a34"],
  [/검정|검은|흑색|먹색/, "#2a2a2e"],
  [/하양|흰|백색|아이보리|크림|베이지/, "#f5efe2"],
];

/** "청록" → 견본 색. 모르는 이름이면 금박색 */
export function colorSwatch(name: string): string {
  for (const [re, hex] of SWATCHES) if (re.test(name)) return hex;
  return "#f2d38a";
}
