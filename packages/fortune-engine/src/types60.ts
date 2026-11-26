/**
 * 족집게집 60유형 (docs/02 §5-10, F19, D-101). 결과 화면에 나오는 세 가지로 정한다:
 * 나의 기운(일간 오행 5) × 두드러진 기운(십신 무리 5 + 고른 편 1) × 기운 세기(센 편·여린 편 2) = 60.
 * 이름은 "다정한 강아지"처럼 형용사(오행) + 동물(무리·세기). 맞음은 같은 세 가지로 코드가 정한다.
 * 웹도 이 파일만 따로 불러 쓴다(@fortune/fortune-engine/src/types60) — 다른 엔진 파일을 import하지 않는다.
 */
import typesJson from "../data/meanings/types.json";

export const TYPE_ELEMENTS = ["목", "화", "토", "금", "수"] as const;
export type TypeElement = (typeof TYPE_ELEMENTS)[number];
/** 두드러진 기운: 비겁 self, 식상 expr, 재성 wealth, 관성 duty, 인성 mind, 고른 편 even */
export const TYPE_GROUPS = ["self", "expr", "wealth", "duty", "mind", "even"] as const;
export type TypeGroup = (typeof TYPE_GROUPS)[number];
export const TYPE_STRENGTHS = ["strong", "soft"] as const;
export type TypeStrength = (typeof TYPE_STRENGTHS)[number];

/** 십신 무리 이름 → 유형 무리 */
export const GROUP_OF_NATURE: Record<string, TypeGroup> = {
  비겁: "self",
  식상: "expr",
  재성: "wealth",
  관성: "duty",
  인성: "mind",
};

interface TypesTable {
  elements: Record<
    TypeElement,
    { id: string; adj: string; color: string; phrase: string; keyword: string }
  >;
  kinds: Record<string, { animal: string; phrase: string; keywords: string[] }>;
}
const TABLE = typesJson as TypesTable;

const EL_ID = Object.fromEntries(TYPE_ELEMENTS.map((e) => [TABLE.elements[e].id, e])) as Record<
  string,
  TypeElement
>;

/** 60유형 id 전부: `${오행 id}-${무리}-${세기}` (예: fire-self-soft). 무리 → 세기 → 오행 순서 */
export const TYPES_60: readonly string[] = TYPE_GROUPS.flatMap((g) =>
  TYPE_STRENGTHS.flatMap((s) => TYPE_ELEMENTS.map((e) => `${TABLE.elements[e].id}-${g}-${s}`)),
);
export const isType = (t: string): boolean => TYPES_60.includes(t);

/** 결과에서 유형 정하기: 일간 오행, 많은 기운(없으면 고른 편), 신강 비율(0.5 이상이면 센 편) */
export function typeKey(element: string, strongGroup: string | null, ratio: number): string {
  const e = TABLE.elements[element as TypeElement] ? (element as TypeElement) : "토";
  const g = strongGroup ? (GROUP_OF_NATURE[strongGroup] ?? "even") : "even";
  const s: TypeStrength = ratio >= 0.5 ? "strong" : "soft";
  return `${TABLE.elements[e].id}-${g}-${s}`;
}

export interface TypeParts {
  element: TypeElement;
  group: TypeGroup;
  strength: TypeStrength;
}
export function typeParts(id: string): TypeParts {
  const [e, g, s] = id.split("-");
  return {
    element: EL_ID[e ?? ""] ?? "토",
    group: (TYPE_GROUPS as readonly string[]).includes(g ?? "") ? (g as TypeGroup) : "even",
    strength: s === "strong" ? "strong" : "soft",
  };
}

export interface TypeInfo {
  id: string;
  /** "다정한 강아지" */
  name: string;
  /** "밝고 다정해서 친구와 어울릴 때 힘이 나는 사람" */
  tagline: string;
  keywords: string[];
  /** 그림 동물 id와 색 이름 (AnimalArt) */
  animal: string;
  color: string;
  element: TypeElement;
}

export const ANIMAL_KO: Record<string, string> = {
  lion: "사자",
  dog: "강아지",
  fox: "여우",
  otter: "수달",
  squirrel: "다람쥐",
  monkey: "원숭이",
  tiger: "호랑이",
  penguin: "펭귄",
  owl: "부엉이",
  panda: "판다",
  bear: "곰",
  sheep: "양",
};

export function typeInfo(id: string): TypeInfo {
  const p = typeParts(id);
  const el = TABLE.elements[p.element];
  const kind = TABLE.kinds[`${p.group}-${p.strength}`] ?? TABLE.kinds["even-soft"];
  const animal = kind?.animal ?? "sheep";
  return {
    id,
    name: `${el.adj} ${ANIMAL_KO[animal] ?? animal}`,
    tagline: `${el.phrase} ${kind?.phrase ?? ""}`.trim(),
    keywords: [el.keyword, ...(kind?.keywords ?? [])],
    animal,
    color: el.color,
    element: p.element,
  };
}

// ── 맞음 (02 §5-10) ─────────────────────────────────────
export type TypeFactorKind =
  | "element_saeng"
  | "element_same"
  | "element_geuk"
  | "strength_pair"
  | "strength_clash"
  | "strength_soft"
  | "group_same"
  | "group_help"
  | "group_clash";

export type TypeMatchLabel = "찰떡" | "잘 맞음" | "맞춰 가면 괜찮음" | "부딪힘";

export interface TypeMatch {
  type: string;
  score: number;
  label: TypeMatchLabel;
  factors: { kind: TypeFactorKind; good: boolean }[];
}

const POINTS: Record<TypeFactorKind, number> = {
  element_saeng: 12,
  element_same: 4,
  element_geuk: -8,
  strength_pair: 10,
  strength_clash: -6,
  strength_soft: 2,
  group_same: 4,
  group_help: 8,
  group_clash: -8,
};

/** 무리 순환 (비겁 → 식상 → 재성 → 관성 → 인성 → 비겁). 이웃은 돕고 한 칸 건너는 부딪힌다 */
const CYCLE: TypeGroup[] = ["self", "expr", "wealth", "duty", "mind"];

function labelOf(score: number): TypeMatchLabel {
  if (score >= 80) return "찰떡";
  if (score >= 68) return "잘 맞음";
  if (score >= 56) return "맞춰 가면 괜찮음";
  return "부딪힘";
}

/** 내 유형 a와 상대 유형 b의 맞음 (대칭) */
export function typeMatch(a: string, b: string): TypeMatch {
  const pa = typeParts(a);
  const pb = typeParts(b);
  const kinds: TypeFactorKind[] = [];

  const ia = TYPE_ELEMENTS.indexOf(pa.element);
  const ib = TYPE_ELEMENTS.indexOf(pb.element);
  const d = (ib - ia + 5) % 5;
  if (d === 0) kinds.push("element_same");
  else if (d === 1 || d === 4) kinds.push("element_saeng");
  else kinds.push("element_geuk");

  if (pa.strength !== pb.strength) kinds.push("strength_pair");
  else if (pa.strength === "strong") kinds.push("strength_clash");
  else kinds.push("strength_soft");

  if (pa.group !== "even" && pb.group !== "even") {
    const ga = CYCLE.indexOf(pa.group);
    const gb = CYCLE.indexOf(pb.group);
    const gd = (gb - ga + 5) % 5;
    if (gd === 0) kinds.push("group_same");
    else if (gd === 1 || gd === 4) kinds.push("group_help");
    else kinds.push("group_clash");
  }

  const raw = 60 + kinds.reduce((s, k) => s + POINTS[k], 0);
  const score = Math.min(98, Math.max(30, raw));
  return {
    type: b,
    score,
    label: labelOf(score),
    factors: kinds.map((kind) => ({ kind, good: POINTS[kind] >= 0 })),
  };
}

/** 나와 60유형 모두의 맞음 (TYPES_60 순서, 나 포함) */
export function allTypeMatches(me: string): TypeMatch[] {
  return TYPES_60.map((t) => typeMatch(me, t));
}

/** 잘 맞는 유형·안 맞는 유형 n개씩. 나를 빼고, 같으면 TYPES_60에서 내 다음 순서가 먼저 */
export function bestAndWorst(me: string, n = 3): { best: TypeMatch[]; worst: TypeMatch[] } {
  const start = Math.max(0, TYPES_60.indexOf(me));
  const ordered = Array.from(
    { length: 59 },
    (_, i) => TYPES_60[(start + 1 + i) % 60] as string,
  ).map((t, i) => ({ m: typeMatch(me, t), i }));
  const best = [...ordered].sort((x, y) => y.m.score - x.m.score || x.i - y.i).slice(0, n);
  const worst = [...ordered].sort((x, y) => x.m.score - y.m.score || x.i - y.i).slice(0, n);
  return { best: best.map((x) => x.m), worst: worst.map((x) => x.m) };
}
