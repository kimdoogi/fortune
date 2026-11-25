/** 꿈해몽 입력 만들기 (docs/04 §3-5, F08). 상징 뜻은 꿈 사전(dream.json)에서만 가져온다 */
import { dreamSymbol } from "./data";

export interface DreamParts {
  facts: string[];
  symbols: { id: string; name: string; meaning: string }[];
}

/** 사전에 없는 ID는 버린다 (docs/04 §6) */
export function knownSymbolIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].filter((id) => dreamSymbol(id) !== undefined);
}

export function buildDream(symbolIds: readonly string[]): DreamParts {
  const symbols = knownSymbolIds(symbolIds).map((id) => {
    const s = dreamSymbol(id);
    if (!s) throw new Error(`unknown dream symbol ${id}`);
    return { id: s.id, name: s.name, meaning: s.meaning, tone: s.tone, keywords: s.keywords };
  });
  const facts = symbols.map(
    (s) => `꿈 속 '${s.name}'(${s.tone}): ${s.meaning} 키워드: ${s.keywords.join(", ")}.`,
  );
  return { facts, symbols: symbols.map(({ id, name, meaning }) => ({ id, name, meaning })) };
}
