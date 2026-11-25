/**
 * 궁합 점수와 요인 (docs/02-saju-rules.md §5-9, D-089). 해석 문장은 쓰지 않고 요인만 정한다.
 */
import {
  type ChartAnalysis,
  type Element,
  analyzePillars,
  generates,
  relationBetween,
  stemInfo,
} from "./analysis";
import type { Pillars } from "./pillars";

export type GunghapFactorKind =
  | "element_saeng"
  | "element_same"
  | "element_geuk"
  | "stem_hap"
  | "zodiac_hap"
  | "zodiac_samhap"
  | "zodiac_chung"
  | "zodiac_wonjin"
  | "zodiac_same"
  | "daybranch_hap"
  | "daybranch_chung"
  | "yongsin_a"
  | "yongsin_b";

export interface GunghapFactor {
  kind: GunghapFactorKind;
  points: number;
  good: boolean;
  /** 요인의 재료 (예: 일간 오행, 띠) — 문장은 api facts가 만든다 */
  a: string;
  b: string;
}

export type GunghapLabel =
  | "천생연분"
  | "잘 맞는 사이"
  | "맞춰 가면 좋은 사이"
  | "부딪히며 크는 사이";

export interface GunghapResult {
  score: number;
  label: GunghapLabel;
  factors: GunghapFactor[];
  a: ChartAnalysis;
  b: ChartAnalysis;
}

const SAMHAP = ["신자진", "해묘미", "인오술", "사유축"];
const WONJIN = ["자미", "축오", "인유", "묘신", "진해", "사술"];
/** 서로 다른 두 지지가 같은 무리에 있는가 */
const pairIn = (list: string[], x: string, y: string) =>
  x !== y && list.some((g) => g.includes(x) && g.includes(y));

export const BRANCH_ANIMAL: Record<string, string> = {
  자: "쥐",
  축: "소",
  인: "호랑이",
  묘: "토끼",
  진: "용",
  사: "뱀",
  오: "말",
  미: "양",
  신: "원숭이",
  유: "닭",
  술: "개",
  해: "돼지",
};

function labelOf(score: number): GunghapLabel {
  if (score >= 85) return "천생연분";
  if (score >= 72) return "잘 맞는 사이";
  if (score >= 58) return "맞춰 가면 좋은 사이";
  return "부딪히며 크는 사이";
}

function countElement(a: ChartAnalysis, e: Element): number {
  return a.elements.counts[e] ?? 0;
}

/** 두 원국의 궁합 (02 §5-9) */
export function gunghap(pa: Pillars, pb: Pillars): GunghapResult {
  const a = analyzePillars(pa);
  const b = analyzePillars(pb);
  const factors: GunghapFactor[] = [];
  const add = (kind: GunghapFactorKind, points: number, x: string, y: string) =>
    factors.push({ kind, points, good: points >= 0, a: x, b: y });

  // 일간 오행
  const ea = stemInfo(pa.day.charAt(0)).element;
  const eb = stemInfo(pb.day.charAt(0)).element;
  if (ea === eb) add("element_same", 5, ea, eb);
  else if (generates(ea) === eb || generates(eb) === ea) add("element_saeng", 10, ea, eb);
  else add("element_geuk", -5, ea, eb);

  // 일간 천간합
  const sa = pa.day.charAt(0);
  const sb = pb.day.charAt(0);
  if (relationBetween("stem", sa, sb) === "천간합") add("stem_hap", 12, sa, sb);

  // 띠 (연지)
  const ya = pa.year.charAt(1);
  const yb = pb.year.charAt(1);
  const za = BRANCH_ANIMAL[ya] ?? ya;
  const zb = BRANCH_ANIMAL[yb] ?? yb;
  const yRel = relationBetween("branch", ya, yb);
  if (ya === yb) add("zodiac_same", 0, za, zb);
  else if (yRel === "지지육합") add("zodiac_hap", 10, za, zb);
  else if (yRel === "지지육충") add("zodiac_chung", -10, za, zb);
  else if (pairIn(SAMHAP, ya, yb)) add("zodiac_samhap", 8, za, zb);
  else if (pairIn(WONJIN, ya, yb)) add("zodiac_wonjin", -6, za, zb);

  // 일지 (가까운 관계 자리)
  const da = pa.day.charAt(1);
  const db = pb.day.charAt(1);
  const dRel = relationBetween("branch", da, db);
  if (dRel === "지지육합") add("daybranch_hap", 8, da, db);
  else if (dRel === "지지육충") add("daybranch_chung", -8, da, db);

  // 용신 보완: 상대 원국에 내 용신 오행이 2개 이상
  if (countElement(b, a.yongsin.yongsin) >= 2) add("yongsin_a", 6, a.yongsin.yongsin, "");
  if (countElement(a, b.yongsin.yongsin) >= 2) add("yongsin_b", 6, b.yongsin.yongsin, "");

  const raw = 60 + factors.reduce((s, f) => s + f.points, 0);
  const score = Math.min(98, Math.max(35, raw));
  return { score, label: labelOf(score), factors, a, b };
}
