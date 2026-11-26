/**
 * 족집게집 "나는 어떤 사람" 입력 만들기 (F19, D-100, docs/04 §3-6).
 * 원국만 쓴다: 일간 + 십신 무리 세기 + 오행 과다·부족 + 신강·신약 + 원국 합충.
 */
import {
  type ChartAnalysis,
  type PillarsResult,
  type TenGod,
  type TypeMatch,
  bestAndWorst,
  typeInfo,
  typeKey,
} from "@fortune/fortune-engine";
import { type NatureBoard, type NatureGroup, TYPE_FACTOR_TEXT } from "@fortune/shared-types";
import { NATURE, SAJU } from "./data";
import { dayMasterFact } from "./saju";

const GROUP_OF: Record<TenGod, NatureGroup> = {
  비견: "비겁",
  겁재: "비겁",
  식신: "식상",
  상관: "식상",
  편재: "재성",
  정재: "재성",
  편관: "관성",
  정관: "관성",
  편인: "인성",
  정인: "인성",
};
const GROUPS: NatureGroup[] = ["비겁", "식상", "재성", "관성", "인성"];
/** 같은 수일 때 먼저 보는 자리 (F19 처리 규칙: 월지 → 일지 → 월간 → 나머지) */
const TIE_ORDER = [
  "monthBranch",
  "dayBranch",
  "monthStem",
  "yearStem",
  "yearBranch",
  "hourStem",
  "hourBranch",
] as const;

/** 원국 십신 자리를 다섯 무리로 센다. strong은 2자리 이상인 가장 많은 무리 */
export function natureGroups(a: ChartAnalysis): {
  counts: Record<NatureGroup, number>;
  strong: NatureGroup | null;
  absent: NatureGroup[];
} {
  const counts = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<NatureGroup, number>;
  for (const god of Object.values(a.tenGods)) if (god) counts[GROUP_OF[god]] += 1;
  const max = Math.max(...GROUPS.map((g) => counts[g]));
  let strong: NatureGroup | null = null;
  if (max >= 2) {
    for (const pos of TIE_ORDER) {
      const god = a.tenGods[pos];
      if (god && counts[GROUP_OF[god]] === max) {
        strong = GROUP_OF[god];
        break;
      }
    }
  }
  return { counts, strong, absent: GROUPS.filter((g) => counts[g] === 0) };
}

const SCENE_LABEL = {
  surface: "겉으로 보이는 나",
  inner: "속마음",
  people: "사람들 사이에서",
  work: "일할 때",
  love: "연애할 때",
  stress: "스트레스 받을 때",
} as const;

export interface NatureParts {
  facts: string[];
  chart: Record<string, unknown>;
  /** LLM 입력 type (04 §3-6) */
  type: { id: string; name: string; best: string[]; worst: string[] };
  board: NatureBoard;
}

/** 결과의 세 가지(나의 기운·많은 기운·기운 세기)로 정한 60유형 (02 §5-10) */
export function natureTypeOf(a: ChartAnalysis): string {
  return typeKey(a.dayMaster.element, natureGroups(a).strong, a.strength.ratio);
}
const typeName = (t: string) => typeInfo(t).name;
const brief = (m: TypeMatch) => ({ type: m.type, score: m.score, label: m.label });
const matchFact = (head: string, m: TypeMatch) =>
  `${head} '${typeName(m.type)}'(${m.label}, ${m.score}점): ${m.factors
    .map((f) => TYPE_FACTOR_TEXT[f.kind])
    .join(", ")}.`;

export function buildNature(natal: PillarsResult, a: ChartAnalysis): NatureParts {
  const p = natal.pillars;
  const hourUnknown = p.hour === null;
  const stem = a.dayMaster.stem;
  const scenes = NATURE.dayMaster[stem];
  if (!scenes) throw new Error(`unknown stem ${stem}`);
  const groups = natureGroups(a);

  const typeId = natureTypeOf(a);
  const info = typeInfo(typeId);
  const { best, worst } = bestAndWorst(typeId);

  const facts: string[] = [
    `이 사람의 유형은 60유형 중 '${info.name}'이다: ${info.tagline}. 키워드: ${info.keywords.join(", ")}. 유형은 나의 기운·많은 기운·기운 세기로 정했다.`,
    dayMasterFact(stem),
  ];
  if (hourUnknown) facts.push("태어난 시간을 몰라 시주 없이 세 기둥으로 본다.");
  for (const [key, label] of Object.entries(SCENE_LABEL)) {
    facts.push(`생활 장면 — ${label}: ${scenes[key as keyof typeof SCENE_LABEL]}`);
  }
  const countText = GROUPS.map((g) => `${g} ${groups.counts[g]}`).join(", ");
  facts.push(`원국 십신 무리 자리 수는 ${countText}이다.`);
  if (groups.strong)
    facts.push(`많은 기운 ${groups.strong}: ${NATURE.groups[groups.strong].strong}`);
  for (const g of groups.absent) facts.push(`없는 기운 ${g}: ${NATURE.groups[g].absent}`);
  for (const e of a.elements.excess) facts.push(SAJU.elements[e]?.excess ?? "");
  for (const e of a.elements.missing) facts.push(SAJU.elements[e]?.missing ?? "");
  facts.push(`${a.strength.label}: ${SAJU.strength[a.strength.label] ?? ""}`);
  for (const m of best) facts.push(matchFact("잘 맞는 유형", m));
  for (const m of worst) facts.push(matchFact("안 맞는 유형", m));
  for (const r of a.relations) {
    const m = SAJU.relations[r.type];
    if (m) facts.push(`${r.a}와 ${r.b}가 ${r.type}: ${m.natal}`);
  }

  const chart = {
    pillars: { year: p.year, month: p.month, day: p.day, hour: p.hour },
    hourUnknown,
    dayMaster: a.dayMaster,
    elements: a.elements,
    tenGods: a.tenGods,
    strength: a.strength,
    groups: { strong: groups.strong, absent: groups.absent },
  };
  const board: NatureBoard = {
    dayMaster: a.dayMaster,
    elements: a.elements.counts,
    strong: groups.strong,
    absent: groups.absent,
    hourUnknown,
    type: typeId,
    best: best.map(brief),
    worst: worst.map(brief),
  };
  const type = {
    id: typeId,
    name: info.name,
    best: best.map((m) => typeName(m.type)),
    worst: worst.map((m) => typeName(m.type)),
  };
  return { facts: facts.filter((f) => f.length > 0), chart, type, board };
}
