/** 해석 데이터 표 (docs/02 §7, docs/03). 파일은 packages/fortune-engine/data/meanings/ */
import dreamJson from "@fortune/fortune-engine/data/meanings/dream.json";
import obanggiJson from "@fortune/fortune-engine/data/meanings/obanggi.json";
import sajuJson from "@fortune/fortune-engine/data/meanings/saju.json";
import tarotJson from "@fortune/fortune-engine/data/meanings/tarot.json";
import type { FlagColor, FlagGrade } from "@fortune/shared-types";

export interface SajuMeanings {
  dayMaster: Record<string, { nature: string; keywords: string[]; summary: string }>;
  tenGods: Record<string, { keywords: string[]; natal: string; luck: string }>;
  elements: Record<string, { excess: string; missing: string }>;
  strength: Record<string, string>;
  yongsin: Record<
    string,
    { colors: string[]; direction: string; activities: string[]; advice: string }
  >;
  relations: Record<string, { natal: string; luck: string }>;
}

export interface TarotMeaning {
  id: number;
  slug: string;
  name: string;
  scene: string;
  keywords: { upright: string[]; reversed: string[] };
  upright: string;
  reversed: string;
  byCategory: Record<string, string>;
}

export interface FlagMeaning {
  id: string;
  grade: FlagGrade;
  keywords: string[];
  meaning: string;
  byCategory: Record<string, string>;
}

export interface DreamSymbol {
  id: string;
  name: string;
  synonyms: string[];
  category: string;
  tone: string;
  keywords: string[];
  meaning: string;
}

export const SAJU = sajuJson as SajuMeanings;
export const TAROT = tarotJson as TarotMeaning[];
export const OBANGGI = obanggiJson as Record<FlagColor, FlagMeaning>;
export const DREAM = dreamJson as DreamSymbol[];

const tarotById = new Map(TAROT.map((c) => [c.id, c]));
export function tarotCard(id: number): TarotMeaning {
  const c = tarotById.get(id);
  if (!c) throw new Error(`unknown tarot card ${id}`);
  return c;
}

const dreamById = new Map(DREAM.map((s) => [s.id, s]));
export const dreamSymbol = (id: string) => dreamById.get(id);
/** 분류 호출에 넘기는 꿈 사전 상징 ID 전체 (docs/04 §6, D-028) */
export const DREAM_SYMBOL_IDS = DREAM.map((s) => s.id);

/** 용신 오행 → 행운의 색 (docs/04 §5 luckyColor는 코드가 정한다) */
export const LUCKY_COLOR: Record<string, string> = {
  목: "청록",
  화: "붉은색",
  토: "노란색",
  금: "흰색",
  수: "남색",
};
