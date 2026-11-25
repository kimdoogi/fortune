/** 타로 입력 만들기 (docs/04 §3-3, F06). 카드 의미는 tarot.json에서만 가져온다 */
import type { TarotCardView, TarotCategory } from "@fortune/shared-types";
import type { DrawnCard } from "../seed";
import { tarotCard } from "./data";

export interface TarotParts {
  facts: string[];
  /** LLM 입력용 cards (docs/04 §3-3) */
  cards: { position: string; card: string; reversed: boolean }[];
  /** 화면용 (ReadingVisual) */
  views: TarotCardView[];
}

export function buildTarot(drawn: DrawnCard[], category: TarotCategory): TarotParts {
  const facts: string[] = [];
  for (const d of drawn) {
    const c = tarotCard(d.id);
    const dir = d.reversed ? "역방향" : "정방향";
    const keywords = d.reversed ? c.keywords.reversed : c.keywords.upright;
    facts.push(`${d.position} 자리: '${c.name}' 카드 ${dir}. 그림: ${c.scene}.`);
    facts.push(
      `'${c.name}' ${dir}의 뜻: ${d.reversed ? c.reversed : c.upright} 키워드: ${keywords.join(", ")}.`,
    );
    const line = c.byCategory[category];
    if (line) facts.push(`'${c.name}'를 ${category} 쪽으로 보면: ${line}`);
  }
  return {
    facts,
    cards: drawn.map((d) => ({
      position: d.position,
      card: tarotCard(d.id).name,
      reversed: d.reversed,
    })),
    views: drawn.map((d) => ({
      position: d.position,
      id: d.id,
      name: tarotCard(d.id).name,
      reversed: d.reversed,
    })),
  };
}
