/**
 * 풀이용 점수 규칙: 앞으로 12달 월운 등급(D-079), 오늘의 운세 점수·행운의 숫자(D-080).
 * docs/02-saju-rules.md §5-6-1, §5-6-2. 해석 문장은 쓰지 않고 숫자·등급만 정한다.
 */
import {
  ELEMENTS,
  type Element,
  type Relation,
  type TenGod,
  branchInfo,
  generatedBy,
  luckRelations,
  relationBetween,
  stemInfo,
  tenGodsOfGanzhi,
} from "./analysis";
import type { GanZhi } from "./ganzhi";
import { type Pillars, computePillars } from "./pillars";

/** e를 극하는 오행 (목→토, 화→금, 토→수, 금→목, 수→화) */
export const controlledBy = (e: Element): Element =>
  ELEMENTS[(ELEMENTS.indexOf(e) + 3) % 5] as Element;

// ───────────────────────── 앞으로 12달 (§5-6-1) ─────────────────────────

export type MonthGrade = "good" | "normal" | "caution";

export interface MonthLuck {
  /** 양력 연·월 */
  year: number;
  month: number;
  /** 그 달 15일의 월주·연주 */
  pillar: GanZhi;
  yearPillar: GanZhi;
  tenGods: [TenGod, TenGod];
  relations: Relation[];
  score: number;
  /** 점수의 이유 (예: "용신 수가 들어옴", "일지와 충") */
  reasons: string[];
  grade: MonthGrade;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 받침이 있으면 "과", 없으면 "와" (예: 연간과, 일지와) */
export function withWa(word: string): string {
  const c = word.codePointAt(word.length - 1) ?? 0;
  const hasFinal = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? "과" : "와"}`;
}

function scoreMonth(
  gz: GanZhi,
  natal: Pillars,
  yongsin: { yongsin: Element; huisin: Element },
): { score: number; reasons: string[]; relations: Relation[] } {
  const gisin = controlledBy(yongsin.yongsin);
  let score = 0;
  const reasons: string[] = [];
  const els = [stemInfo(gz.charAt(0)).element, branchInfo(gz.charAt(1)).element];
  for (const e of new Set(els)) {
    const n = els.filter((x) => x === e).length;
    if (e === yongsin.yongsin) {
      score += 2 * n;
      reasons.push(`용신 ${e} 기운이 들어옴`);
    } else if (e === yongsin.huisin) {
      score += n;
      reasons.push(`희신 ${e} 기운이 들어옴`);
    } else if (e === gisin) {
      score -= 2 * n;
      reasons.push(`용신을 누르는 ${e} 기운이 들어옴`);
    }
  }
  const relations = luckRelations("월운", gz, natal);
  for (const r of relations) {
    const core = r.b.startsWith("일지") || r.b.startsWith("일간");
    const where = r.b.split(" ")[0];
    if (r.type === "지지육충" || r.type === "천간충") {
      score -= core ? 2 : 1;
      reasons.push(`${withWa(where ?? "")} 충`);
    } else if (core) {
      score += 1;
      reasons.push(`${withWa(where ?? "")} 합`);
    }
  }
  return { score, reasons, relations };
}

/**
 * from(YYYY-MM)부터 count달의 월운 등급. 좋은 달·조심할 달을 2~3개씩 고른다.
 * 각 달은 양력 15일 정오의 월주로 대표한다.
 */
export function monthlyLuck(
  natal: Pillars,
  yongsin: { yongsin: Element; huisin: Element },
  from: string,
  count = 12,
): MonthLuck[] {
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const dayStem = natal.day.charAt(0);
  const list: MonthLuck[] = [];
  for (let i = 0; i < count; i++) {
    const p = computePillars({
      calendar: "solar",
      date: `${y}-${pad(m)}-15`,
      time: "12:00",
    }).pillars;
    const s = scoreMonth(p.month, natal, yongsin);
    list.push({
      year: y,
      month: m,
      pillar: p.month,
      yearPillar: p.year,
      tenGods: tenGodsOfGanzhi(dayStem, p.month),
      relations: s.relations,
      score: s.score,
      reasons: s.reasons,
      grade: "normal",
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  // 높은 순(같으면 이른 달), 낮은 순(같으면 이른 달)
  const order = list.map((_, i) => i);
  const best = [...order].sort((a, b) => (list[b]?.score ?? 0) - (list[a]?.score ?? 0) || a - b);
  const worst = [...order].sort((a, b) => (list[a]?.score ?? 0) - (list[b]?.score ?? 0) || a - b);
  const pick = (sorted: number[], ok: (s: number) => boolean, taken: Set<number>) => {
    const out = sorted.filter((i) => ok(list[i]?.score ?? 0) && !taken.has(i)).slice(0, 3);
    for (const i of sorted) {
      if (out.length >= 2) break;
      if (!out.includes(i) && !taken.has(i)) out.push(i);
    }
    return out;
  };
  const good = pick(best, (s) => s >= 1, new Set());
  const caution = pick(worst, (s) => s <= -1, new Set(good));
  for (const i of good) (list[i] as MonthLuck).grade = "good";
  for (const i of caution) (list[i] as MonthLuck).grade = "caution";
  return list;
}

// ───────────────────────── 오늘의 운세 (§5-6-2) ─────────────────────────

const DAILY_GOD_POINTS: Record<TenGod, number> = {
  식신: 6,
  정재: 6,
  정관: 5,
  정인: 5,
  편재: 4,
  비견: 2,
  편인: 0,
  상관: -2,
  겁재: -3,
  편관: -4,
};

export type DailyLabel = "아주 좋음" | "좋음" | "보통" | "조심";

/** 날짜·일간으로 정해지는 -5~+5 (FNV-1a) */
function jitter(date: string, stem: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${date}:${stem}`) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 11) - 5;
}

export function dailyScore(
  stem: string,
  iljinGz: GanZhi,
  date: string,
): { score: number; label: DailyLabel } {
  let score = 70;
  for (const g of tenGodsOfGanzhi(stem, iljinGz)) score += DAILY_GOD_POINTS[g];
  const rel = relationBetween("stem", iljinGz.charAt(0), stem);
  if (rel === "천간합") score += 6;
  if (rel === "천간충") score -= 8;
  score = Math.min(99, Math.max(40, score + jitter(date, stem)));
  const label: DailyLabel =
    score >= 85 ? "아주 좋음" : score >= 70 ? "좋음" : score >= 55 ? "보통" : "조심";
  return { score, label };
}

/** 하도수 */
const HADO: Record<Element, [number, number]> = {
  수: [1, 6],
  화: [2, 7],
  목: [3, 8],
  금: [4, 9],
  토: [5, 10],
};

/** 행운의 숫자: 일간을 생하는 오행(행운의 색과 같은 오행)의 하도수 */
export function luckyNumbers(stem: string): [number, number] {
  return HADO[generatedBy(stemInfo(stem).element)];
}
