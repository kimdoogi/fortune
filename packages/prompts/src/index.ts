/**
 * 캐릭터 문장과 LLM 출력 검사에 쓰는 공통 도구 (docs/04 §7, 04a).
 * - findBanned: 금지 표현 목록 v1 (common/banned.json)
 * - fillTemplate: {닉네임} 자리 채우기 + 받침에 맞는 호격 조사(아/야)
 */
import banned from "../common/banned.json";
import greetings from "../greetings.json";

export { banned, greetings };

const PATTERNS = banned.patterns.map((p) => ({
  id: p.id,
  category: p.category,
  re: new RegExp(p.re),
}));
const INVEST_VERB = new RegExp(banned.invest.verb);
const INVEST_WORD = new RegExp(banned.invest.word);

/** 걸린 금지 표현의 id 목록. 비어 있으면 통과 */
export function findBanned(text: string): string[] {
  const hits = PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
  if (INVEST_VERB.test(text) && INVEST_WORD.test(text)) hits.push("투자 단정");
  return hits;
}

/** 마지막 글자에 받침이 있는지. 한글이 아니면 받침 없음으로 본다 */
export function hasFinalConsonant(word: string): boolean {
  const last = [...word].at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

/**
 * "{닉네임}아" 또는 "{닉네임}야"는 받침에 맞게 고쳐 쓴다 (민준아, 하나야).
 * 그 밖의 "{닉네임}"은 그대로 바꾼다.
 */
export function fillTemplate(template: string, nickname: string): string {
  return template
    .replace(/\{닉네임\}[아야](?![가-힣])/g, nickname + (hasFinalConsonant(nickname) ? "아" : "야"))
    .replaceAll("{닉네임}", nickname);
}
